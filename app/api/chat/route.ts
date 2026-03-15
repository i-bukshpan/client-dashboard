import { google } from '@ai-sdk/google'
import { streamText } from 'ai'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const { messages, clientId } = await req.json()

  // 1. Fetch Client Context
  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single()

  let driveContext = ''
  if (client?.google_drive_folder_id) {
    try {
      // Internal fetch to drive API
      const driveUrl = new URL(req.url).origin + `/api/drive/list?clientId=${clientId}`
      const driveRes = await fetch(driveUrl)
      const { files } = await driveRes.json()
      
      if (files && files.length > 0) {
        driveContext = `
מסמכים זמינים ב-Google Drive של הלקוח:
${files.map((f: any) => `- ${f.name} (${f.webViewLink})`).join('\n')}
`
      }
    } catch (e) {
      console.error('Failed to fetch drive context:', e)
    }
  }

  const systemPrompt = `אתה סוכן AI אישי ומקצועי של מערכת Linkנט. 
התפקיד שלך הוא לעזור ליועץ הכלכלי לנהל את הלקוח ${client?.name || 'הנוכחי'} בצורה הטובה ביותר.

נתוני הלקוח:
- שם: ${client?.name}
- סטטוס: ${client?.status}
- טלפון: ${client?.phone || 'לא הוזן'}
- אימייל: ${client?.email || 'לא הוזן'}

${driveContext}

הוראות:
1. ענה תמיד בעברית מקצועית, אדיבה ועניינית.
2. אתה יכול לראות נתונים מה-DB (בעתיד הקרוב תהיה לך גישה לכל המודולים ולמסמכי Google Drive).
3. אם שואלים אותך שאלות שכרגע אין לך עליהן מידע מלא, ציין שאתה בשלבי למידה של התיק.
4. היה פרואקטיבי - הצע פעולות כמו "לקבוע פגישה" או "לעדכן משימה" במידה וזה נראה רלוונטי לשיחה.`

  // 2. Stream Response from Gemini
  const result = await streamText({
    model: google('models/gemini-1.5-pro-latest'),
    system: systemPrompt,
    messages,
  })

  return result.toTextStreamResponse()
}
