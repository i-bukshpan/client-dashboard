'use server'

import { supabase } from '@/lib/supabase'

const MODELS = ['gemini-flash-latest', 'gemini-pro-latest']

async function callGemini(prompt: string): Promise<string | null> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!apiKey) return null

  for (const model of MODELS) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
          }),
        }
      )
      if (res.status === 404) break
      if (res.status === 429 || res.status === 503) {
        await new Promise(r => setTimeout(r, attempt * 3000))
        continue
      }
      if (!res.ok) return null
      const data = await res.json()
      return data.candidates?.[0]?.content?.parts?.[0]?.text || null
    }
  }
  return null
}

/**
 * מייצר תדריך הכנה לפגישה עם לקוח:
 * סיכום מצב כספי, פגישות אחרונות, משימות פתוחות.
 */
export async function generateMeetingPrep(clientId: string): Promise<{
  success: boolean
  text?: string
  error?: string
}> {
  try {
    const [clientRes, paymentsRes, meetingsRes, remindersRes] = await Promise.all([
      supabase.from('clients').select('name, status, advisor_status, internal_notes').eq('id', clientId).single(),
      supabase.from('payments').select('amount, payment_type, payment_status, description, payment_date')
        .eq('client_id', clientId).order('payment_date', { ascending: false }).limit(5),
      supabase.from('meeting_logs').select('meeting_date, subject, summary, action_items')
        .eq('client_id', clientId).order('meeting_date', { ascending: false }).limit(3),
      supabase.from('reminders').select('title, due_date, priority')
        .eq('client_id', clientId).eq('is_completed', false).order('due_date', { ascending: true }).limit(5),
    ])

    const client = clientRes.data
    const payments = paymentsRes.data || []
    const meetings = meetingsRes.data || []
    const reminders = remindersRes.data || []

    const prompt = `אתה יועץ פיננסי מנוסה. הכן תדריך קצר ומעשי לפגישה עם הלקוח הבא.

שם הלקוח: ${client?.name}
סטטוס: ${client?.status || 'לא מוגדר'}
הערות פנימיות: ${client?.internal_notes || 'אין'}

תשלומים אחרונים:
${payments.map(p => `- ${p.description || p.payment_type}: ₪${p.amount} (${p.payment_status}) - ${p.payment_date}`).join('\n') || 'אין'}

פגישות אחרונות:
${meetings.map(m => `- ${m.meeting_date}: ${m.subject}\n  סיכום: ${m.summary || 'אין'}\n  משימות: ${m.action_items || 'אין'}`).join('\n') || 'אין'}

משימות פתוחות:
${reminders.map(r => `- ${r.title} (${r.priority}) - עד ${r.due_date}`).join('\n') || 'אין'}

כתוב תדריך הכנה לפגישה הכולל:
1. נקודות מרכזיות לדיון
2. שאלות מומלצות לשאול
3. נושאים דחופים שיש לטפל בהם
4. המלצות לפעולה

כתוב בעברית, קצר וממוקד (עד 300 מילים).`

    const text = await callGemini(prompt)
    if (!text) return { success: false, error: 'לא הצלחנו ליצור תדריך' }

    return { success: true, text }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * מחלץ משימות מסיכום פגישה ויוצר תזכורות אוטומטית.
 */
export async function extractTasksFromSummary(meetingId: string, summary: string): Promise<{
  success: boolean
  count?: number
  error?: string
}> {
  try {
    // Get meeting's client_id
    const { data: meeting } = await supabase
      .from('meeting_logs')
      .select('client_id, meeting_date')
      .eq('id', meetingId)
      .single()

    if (!meeting) return { success: false, error: 'פגישה לא נמצאה' }

    const prompt = `נתח את סיכום הפגישה הבא וחלץ את כל המשימות וההחלטות שמצריכות פעולה.

סיכום הפגישה:
${summary}

החזר JSON בלבד (ללא טקסט נוסף) בפורמט:
{
  "tasks": [
    {
      "title": "כותרת המשימה בעברית",
      "due_days": 7,
      "priority": "דחוף" | "רגיל" | "נמוך"
    }
  ]
}

כללים:
- רק משימות ברורות ומעשיות
- due_days = מספר ימים מהיום עד מועד היעד
- אם אין משימות ברורות, החזר tasks: []`

    const text = await callGemini(prompt)
    if (!text) return { success: false, error: 'לא הצלחנו לחלץ משימות' }

    let tasks: Array<{ title: string; due_days: number; priority: string }> = []
    try {
      const clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      const parsed = JSON.parse(clean)
      tasks = parsed.tasks || []
    } catch {
      return { success: false, error: 'שגיאה בעיבוד תשובת ה-AI' }
    }

    if (tasks.length === 0) return { success: true, count: 0 }

    // Create reminders for each extracted task
    const today = new Date()
    const remindersToInsert = tasks.map(task => {
      const dueDate = new Date(today)
      dueDate.setDate(today.getDate() + (task.due_days || 7))
      return {
        client_id: meeting.client_id,
        title: task.title,
        due_date: dueDate.toISOString().split('T')[0],
        priority: task.priority || 'רגיל',
        is_completed: false,
        category: 'meeting',
        description: `חולץ אוטומטית מפגישה מתאריך ${meeting.meeting_date}`,
      }
    })

    const { error } = await supabase.from('reminders').insert(remindersToInsert)
    if (error) return { success: false, error: error.message }

    return { success: true, count: remindersToInsert.length }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
