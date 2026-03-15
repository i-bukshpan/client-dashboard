import { googleAI } from '@/lib/ai-provider'
import { streamText, tool } from 'ai'
import { supabase } from '@/lib/supabase'
import { z } from 'zod'
import { fetchGoogleSheetData } from '@/lib/google-sheets'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const { messages, clientId } = await req.json()

  let systemPrompt = ''

  if (clientId === 'dashboard') {
    // 1a. Dashboard Context
    const { data: dashboardData } = await (await fetch(new URL(req.url).origin + '/api/dashboard/summary')).json()
    
    systemPrompt = `אתה סוכן AI אישי ומקצועי של מערכת Linkנט המנהל את כל העסק של נחמיה.
היום בדשבורד:
- פגישות: ${dashboardData?.meetingsCount || 0}
- משימות פתוחות: ${dashboardData?.tasksCount || 0}
- משימות באיחור: ${dashboardData?.overdueCount || 0}

הנחיות:
1. עזור לנחמיה לנהל את היום שלו ביעילות.
2. אתה יכול להוסיף פגישות ומשימות עבור לקוחות שונים.
3. דבר בעברית מקצועית ואדיבה.
`
  } else {
    // 1b. Specific Client Context
    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single()

    // 1c. Fetch Client Links (Google Sheets, etc.)
    const { data: links } = await supabase
      .from('client_links')
      .select('*')
      .eq('client_id', clientId)

    let linksContext = ''
    if (links && links.length > 0) {
      linksContext = '\nקישורים ומסמכים זמינים ללקוח:\n' + 
        links.map(l => `- ${l.title}: ${l.url} (${l.link_type})`).join('\n')
      
      const sheetLinks = links.filter(l => l.link_type === 'google_sheets')
      if (sheetLinks.length > 0) {
        linksContext += '\n\nהנחיה: אם יש קישור לגוגל שיטס, השתמש בכלי readGoogleSheet כדי לנתח את הנתונים במידה והמשתמש מבקש.'
      }
    }

    systemPrompt = `אתה סוכן AI אישי ומקצועי של מערכת Linkנט. 
התפקיד שלך הוא לעזור ליועץ הכלכלי לנהל את הלקוח ${client?.name || 'הנוכחי'} בצורה הטובה ביותר.

נתוני הלקוח:
- שם: ${client?.name}
- סטטוס: ${client?.status}
${linksContext}

הוראות:
1. ענה תמיד בעברית מקצועית.
2. אתה יכול להוסיף פגישות ומשימות ספציפיות ללקוח זה.
3. השתמש בקישורים שסופקו כדי לקבל קונטקסט על העבודה עם הלקוח.
4. אם יש קישור גוגל שיטס, השתמש בכלי readGoogleSheet לניתוח הנתונים.`
  }

  // 2. Stream Response from Gemini with Tools
  const result = await streamText({
    model: googleAI('gemini-1.5-pro'),
    system: systemPrompt,
    messages,
    tools: {
      readGoogleSheet: tool({
        description: 'קריאת נתונים מתוך קובץ גוגל שיטס (Google Sheets) המשויך ללקוח',
        parameters: z.object({
          url: z.string().describe('הקישור המלא לקובץ הגוגל שיטס'),
        }),
        execute: async ({ url }) => {
          const data = await fetchGoogleSheetData(url)
          if (!data.success) return { error: `נכשל בניסיון לקרוא את הקובץ: ${data.error}` }
          return { 
            message: 'הקובץ נקרא בהצלחה.', 
            content: data.condensed,
            rowCount: data.rowCount
          }
        }
      }),
      createMeeting: tool({
        description: 'יצירת פגישה חדשה במערכת',
        parameters: z.object({
          subject: z.string().describe('נושא הפגישה'),
          meetingDate: z.string().describe('תאריך ושעה בפורמט ISO'),
          clientId: z.string().optional().describe('מזהה הלקוח (אם ידוע)'),
          summary: z.string().optional().describe('תיאור קצר של הפגישה'),
        }),
        execute: async ({ subject, meetingDate, clientId: mClientId, summary }) => {
          const targetClientId = mClientId || clientId
          if (targetClientId === 'dashboard') return { error: 'נא לציין לאיזה לקוח לקבוע את הפגישה' }
          
          const { error } = await supabase
            .from('meeting_logs')
            .insert([{
              client_id: targetClientId,
              subject,
              meeting_date: meetingDate,
              summary: summary || '',
              status: 'planned',
              meeting_type: 'scheduled'
            }])
          
          if (error) return { success: false, error: error.message }
          return { success: true, message: `הפגישה "${subject}" נקבעה בהצלחה.` }
        }
      }),
      createTask: tool({
        description: 'יצירת משימה או תזכורת חדשה',
        parameters: z.object({
          title: z.string().describe('כותרת המשימה'),
          dueDate: z.string().describe('תאריך יעד בפורמט ISO'),
          priority: z.enum(['דחוף', 'רגיל', 'נמוך']).default('רגיל'),
          clientId: z.string().optional().describe('מזהה הלקוח (אם ידוע)'),
        }),
        execute: async ({ title, dueDate, priority, clientId: tClientId }) => {
          const targetClientId = tClientId === 'dashboard' ? null : (tClientId || clientId)
          const { error } = await supabase
            .from('reminders')
            .insert([{
              client_id: targetClientId,
              title,
              due_date: dueDate,
              priority,
              is_completed: false
            }])
          
          if (error) return { success: false, error: error.message }
          return { success: true, message: `המשימה "${title}" נוספה.` }
        }
      })
    }
  })

  return result.toTextStreamResponse()
}
