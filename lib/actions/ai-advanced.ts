'use server'

import { google } from '@ai-sdk/google'
import { generateText, generateObject } from 'ai'
import { supabase } from '@/lib/supabase'
import { z } from 'zod'

/**
 * 1. Meeting Prepper:
 * Generates a concise briefing for an upcoming meeting.
 */
export async function generateMeetingPrep(clientId: string) {
  try {
    // Fetch Client Context
    const { data: client } = await supabase.from('clients').select('*').eq('id', clientId).single()
    const { data: recentMeetings } = await supabase.from('meeting_logs').select('*').eq('client_id', clientId).order('meeting_date', { ascending: false }).limit(3)
    const { data: openTasks } = await supabase.from('reminders').select('*').eq('client_id', clientId).eq('is_completed', false).order('due_date', { ascending: true }).limit(5)

    const prompt = `
אתה מתמחה בפיננסים ועוזר ליועץ להתכונן לפגישה.
הלקוח: ${client?.name}
סטטוס: ${client?.status}

סיכומי פגישות אחרונים:
${recentMeetings?.map(m => `- ${m.subject}: ${m.summary}`).join('\n')}

משימות פתוחות:
${openTasks?.map(t => `- ${t.title} (עד יום: ${t.due_date})`).join('\n')}

תפקידך:
ייצר "דף הכנה" קצרצר (עד 3 נקודות) לפגישה הבאה. 
התמקד במה שחשוב ביותר: נושאים פתוחים, חובות של הלקוח, או הזדמנויות שעלו בשיחות קודמות.
ענה בעברית מקצועית וממוקדת.
`

    const { text } = await generateText({
      model: google('models/gemini-1.5-pro-latest'),
      prompt,
    })

    return { success: true, text }
  } catch (error: any) {
    console.error('Error generating meeting prep:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 2. Task Intelligence:
 * Extracts tasks from a meeting summary and inserts them into reminders.
 */
export async function extractTasksFromSummary(meetingId: string, summary: string) {
  try {
    const { data: meeting } = await supabase.from('meeting_logs').select('client_id').eq('id', meetingId).single()
    if (!meeting) throw new Error('Meeting not found')

    const prompt = `
נתח את סיכום הפגישה הבא ושלוף ממנו משימות לביצוע (Action Items).
החזר רשימה של משימות עם כותרת קצרה, תיאור קצר, ורמת עדיפות (דחוף/רגיל/נמוך).

סיכום הפגישה:
"${summary}"
`

    const { object } = await generateObject({
      model: google('models/gemini-1.5-pro-latest'),
      schema: z.object({
        tasks: z.array(z.object({
          title: z.string(),
          description: z.string(),
          priority: z.enum(['דחוף', 'רגיל', 'נמוך']),
          daysToComplete: z.number().optional().default(7)
        }))
      }),
      prompt,
    })

    // Insert tasks into Supabase
    const tasksToInsert = object.tasks.map(t => {
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + (t.daysToComplete || 7))
      
      return {
        client_id: meeting.client_id,
        title: t.title,
        description: t.description,
        priority: t.priority,
        due_date: dueDate.toISOString(),
        is_completed: false,
        category: 'meeting_followup'
      }
    })

    const { error } = await supabase.from('reminders').insert(tasksToInsert)
    if (error) throw error

    return { success: true, count: object.tasks.length }
  } catch (error: any) {
    console.error('Error extracting tasks:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 3. Smart Prioritization:
 * Analyzes open tasks and suggests the best order for today.
 */
export async function prioritizeTasks(clientId: string) {
  try {
    const { data: tasks } = await supabase
      .from('reminders')
      .select('*')
      .eq('client_id', clientId)
      .eq('is_completed', false)
      .order('due_date', { ascending: true })

    if (!tasks || tasks.length === 0) return { success: true, suggestions: [] }

    const prompt = `
אתה יועץ ארגוני. עזור לי לתעדף את המשימות הבאות עבור הלקוח.
נתח את המשימות והצע סדר ביצוע הגיוני (מה קודם).
עבור כל משימה, הסבר בקצרה למה היא בעדיפות הזו.

רשימת משימות:
${tasks.map((t, idx) => `${idx + 1}. ${t.title} (יעד: ${t.due_date}, עדיפות נוכחית: ${t.priority})`).join('\n')}

החזר את התשובה בעברית.
`

    const { text } = await generateText({
      model: google('models/gemini-1.5-pro-latest'),
      prompt,
    })

    return { success: true, text }
  } catch (error: any) {
    console.error('Error prioritizing tasks:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 4. Client AI Report:
 * Generates a comprehensive summary of recent client activity.
 */
export async function generateClientAIReport(clientId: string) {
  try {
    const { data: client } = await supabase.from('clients').select('*').eq('id', clientId).single()
    const { data: recentMeetings } = await supabase.from('meeting_logs').select('*').eq('client_id', clientId).order('meeting_date', { ascending: false }).limit(5)
    const { data: recentPayments } = await supabase.from('payments').select('*').eq('client_id', clientId).order('payment_date', { ascending: false }).limit(10)
    const { data: openTasks } = await supabase.from('reminders').select('*').eq('client_id', clientId).eq('is_completed', false).limit(10)

    const prompt = `
אתה אנליסט פיננסי בכיר. ייצר דוח סיכום תקופתי עבור הלקוח ${client?.name}.
התבסס על הנתונים הבאים:

פגישות אחרונות:
${recentMeetings?.map(m => `- ${m.subject} (${m.meeting_date}): ${m.summary}`).join('\n')}

תנועות כספיות אחרונות:
${recentPayments?.map(p => `- ${p.description}: ${p.amount} ₪ (${p.payment_status})`).join('\n')}

משימות פתוחות:
${openTasks?.map(t => `- ${t.title} (${t.priority})`).join('\n')}

משימה:
כתוב סיכום מקצועי (3-4 פסקאות) שסוקר את ההתקדמות, מציין נקודות לשיפור, וממליץ על צעדים הבאים.
השתמש בשפה מכובדת, עסקית ומעודדת. ענה בעברית.
`

    const { text } = await generateText({
      model: google('models/gemini-1.5-pro-latest'),
      prompt,
    })

    return { success: true, report: text }
  } catch (error: any) {
    console.error('Error generating client report:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 5. Cash Flow Forecaster:
 * Analyzes patterns and predicts next month's cashflow.
 */
export async function getCashflowInsights(clientId: string) {
  try {
    const { data: payments } = await supabase
      .from('payments')
      .select('*')
      .eq('client_id', clientId)
      .order('payment_date', { ascending: false })

    if (!payments || payments.length === 0) return { success: true, insights: "אין מספיק נתוני תשלומים לביצוע ניתוח." }

    const prompt = `
נתח את תזרים המזומנים של הלקוח על סמך רשימת התשלומים הבאה:
${payments.map(p => `- ${p.amount} ₪, ${p.payment_type}, תאריך: ${p.payment_date}`).join('\n')}

משימה:
1. זהה דפוסים (הוצאות קבועות, הכנסות מחזוריות).
2. הערך מה יהיה המצב הכספי בחודש הקרוב (תחזית).
3. תן 2 טיפים לשיפור התזרים.
ענה בקיצור ולעניין בעברית.
`

    const { text } = await generateText({
      model: google('models/gemini-1.5-pro-latest'),
      prompt,
    })

    return { success: true, insights: text }
  } catch (error: any) {
    console.error('Error getting cashflow insights:', error)
    return { success: false, error: error.message }
  }
}
