// ── Agent Tool Definitions & Executor ──────────────────────────────────────

import { supabase } from '@/lib/supabase'
import { readPublicDriveFile } from './drive-reader'
import type { AgentContext, GeminiTool } from './types'

// ── Tool Declarations (sent to Gemini) ─────────────────────────────────────

export const agentTools: GeminiTool[] = [
  {
    functionDeclarations: [
      // ── READ TOOLS ──────────────────────────────────────────────────────

      {
        name: 'get_today_summary',
        description: 'מחזיר סיכום של היום: פגישות, משימות קרובות, תשלומים ממתינים. השתמש כשנשאל "מה קורה היום" או "מה יש לי".',
        parameters: { type: 'object', properties: {} },
      },

      {
        name: 'get_today_meetings',
        description: 'מחזיר פגישות לתאריך מסוים (ברירת מחדל: היום). כולל שם הלקוח, נושא, סוג פגישה.',
        parameters: {
          type: 'object',
          properties: {
            date: {
              type: 'string',
              description: 'תאריך בפורמט YYYY-MM-DD. אם לא מצוין — ישתמש בתאריך היום.',
            },
          },
        },
      },

      {
        name: 'get_upcoming_reminders',
        description: 'מחזיר משימות ותזכורות פתוחות לימים הקרובים. ניתן לסנן לפי לקוח ספציפי.',
        parameters: {
          type: 'object',
          properties: {
            days: {
              type: 'number',
              description: 'כמה ימים קדימה לבדוק (ברירת מחדל: 7)',
            },
            client_id: {
              type: 'string',
              description: 'מזהה לקוח לסינון (אופציונלי)',
            },
          },
        },
      },

      {
        name: 'search_clients',
        description: 'מחפש לקוחות לפי שם, טלפון, או אימייל. מחזיר רשימת תוצאות.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'מחרוזת חיפוש — שם הלקוח, טלפון, או אימייל',
            },
          },
          required: ['query'],
        },
      },

      {
        name: 'get_client_summary',
        description: 'מחזיר סיכום מלא על לקוח: פרטים אישיים, מצב כספי, פגישות אחרונות, משימות פתוחות.',
        parameters: {
          type: 'object',
          properties: {
            client_id: {
              type: 'string',
              description: 'מזהה הלקוח (UUID)',
            },
          },
          required: ['client_id'],
        },
      },

      {
        name: 'get_meetings_for_client',
        description: 'מחזיר היסטוריית פגישות עם לקוח ספציפי, מהחדשה לישנה.',
        parameters: {
          type: 'object',
          properties: {
            client_id: {
              type: 'string',
              description: 'מזהה הלקוח',
            },
            limit: {
              type: 'number',
              description: 'מספר פגישות להחזיר (ברירת מחדל: 10)',
            },
          },
          required: ['client_id'],
        },
      },

      {
        name: 'get_financial_report',
        description: 'מחזיר דוח כספי של לקוח: הכנסות, הוצאות, תשלומים ממתינים. ניתן לסנן לפי תאריכים וסוג.',
        parameters: {
          type: 'object',
          properties: {
            client_id: {
              type: 'string',
              description: 'מזהה הלקוח',
            },
            date_from: {
              type: 'string',
              description: 'תאריך התחלה YYYY-MM-DD (אופציונלי)',
            },
            date_to: {
              type: 'string',
              description: 'תאריך סיום YYYY-MM-DD (אופציונלי)',
            },
          },
          required: ['client_id'],
        },
      },

      {
        name: 'get_client_links',
        description: 'מחזיר קישורים של לקוח (Google Drive, Sheets, Docs וקישורים נוספים).',
        parameters: {
          type: 'object',
          properties: {
            client_id: {
              type: 'string',
              description: 'מזהה הלקוח',
            },
          },
          required: ['client_id'],
        },
      },

      {
        name: 'read_google_drive_file',
        description: 'קורא את תוכן קובץ מגוגל דרייב/דוקס/שיטס המשותף עם קישור פתוח. עובד רק עם קבצים ציבוריים.',
        parameters: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'הכתובת המלאה של הקובץ מגוגל דרייב/דוקס/שיטס',
            },
          },
          required: ['url'],
        },
      },

      // ── WRITE TOOLS ─────────────────────────────────────────────────────

      {
        name: 'create_reminder',
        description: 'יוצר תזכורת או משימה חדשה במערכת.',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'כותרת המשימה' },
            due_date: { type: 'string', description: 'תאריך יעד YYYY-MM-DD' },
            priority: {
              type: 'string',
              enum: ['דחוף', 'רגיל', 'נמוך'],
              description: 'עדיפות המשימה',
            },
            client_id: { type: 'string', description: 'מזהה לקוח לקישור המשימה (אופציונלי)' },
            description: { type: 'string', description: 'תיאור מפורט (אופציונלי)' },
            category: { type: 'string', description: 'קטגוריה: phone_call, meeting, review, document, payment, other' },
            recurrence_rule: {
              type: 'string',
              enum: ['daily', 'weekly', 'monthly', 'yearly'],
              description: 'חזרתיות (אופציונלי)',
            },
          },
          required: ['title', 'due_date', 'priority'],
        },
      },

      {
        name: 'complete_reminder',
        description: 'מסמן משימה/תזכורת כהושלמה.',
        parameters: {
          type: 'object',
          properties: {
            reminder_id: { type: 'string', description: 'מזהה המשימה (UUID)' },
          },
          required: ['reminder_id'],
        },
      },

      {
        name: 'create_meeting',
        description: 'יוצר רישום פגישה חדשה עם לקוח.',
        parameters: {
          type: 'object',
          properties: {
            client_id: { type: 'string', description: 'מזהה הלקוח' },
            meeting_date: { type: 'string', description: 'תאריך הפגישה YYYY-MM-DD' },
            subject: { type: 'string', description: 'נושא הפגישה' },
            meeting_type: { type: 'string', description: 'סוג: פגישה, שיחת טלפון, זום, אחר' },
            summary: { type: 'string', description: 'סיכום הפגישה (אופציונלי)' },
            action_items: { type: 'string', description: 'משימות המשך (אופציונלי)' },
          },
          required: ['client_id', 'meeting_date', 'subject'],
        },
      },

      {
        name: 'generate_meeting_summary',
        description: 'מייצר סיכום מפורט לפגישה מתוך רשימות. מחזיר סיכום ורשימת משימות המשך.',
        parameters: {
          type: 'object',
          properties: {
            meeting_notes: { type: 'string', description: 'תוכן הפגישה, נקודות שנדונו, מה שנאמר' },
            meeting_id: { type: 'string', description: 'מזהה פגישה קיימת לעדכון (אופציונלי)' },
          },
          required: ['meeting_notes'],
        },
      },

      {
        name: 'update_client_status',
        description: 'מעדכן את הסטטוס של לקוח (סטטוס כללי או סטטוס יועץ).',
        parameters: {
          type: 'object',
          properties: {
            client_id: { type: 'string', description: 'מזהה הלקוח' },
            status: {
              type: 'string',
              description: 'סטטוס כללי: פעיל, ליד, ארכיון',
            },
            advisor_status: {
              type: 'string',
              description: 'סטטוס יועץ: onboarding, active, inactive, vip',
            },
          },
          required: ['client_id'],
        },
      },

      {
        name: 'update_client_notes',
        description: 'מעדכן את ההערות הפנימיות של לקוח.',
        parameters: {
          type: 'object',
          properties: {
            client_id: { type: 'string', description: 'מזהה הלקוח' },
            notes: { type: 'string', description: 'תוכן ההערות החדשות' },
          },
          required: ['client_id', 'notes'],
        },
      },

      {
        name: 'create_payment',
        description: 'מוסיף תשלום חדש (הכנסה או הוצאה) ללקוח.',
        parameters: {
          type: 'object',
          properties: {
            client_id: { type: 'string', description: 'מזהה הלקוח' },
            amount: { type: 'number', description: 'סכום התשלום' },
            payment_type: {
              type: 'string',
              enum: ['income', 'expense', 'subscription', 'salary', 'rent', 'utility', 'other'],
              description: 'סוג התשלום',
            },
            description: { type: 'string', description: 'תיאור התשלום (אופציונלי)' },
            payment_date: { type: 'string', description: 'תאריך YYYY-MM-DD (ברירת מחדל: היום)' },
            payment_status: {
              type: 'string',
              enum: ['שולם', 'ממתין', 'בוטל'],
              description: 'סטטוס (ברירת מחדל: ממתין)',
            },
          },
          required: ['client_id', 'amount', 'payment_type'],
        },
      },
    ],
  },
]

// ── Tool Executor ──────────────────────────────────────────────────────────

export async function executeTool(
  toolName: string,
  args: Record<string, any>,
  context: AgentContext
): Promise<any> {
  const clientId = args.client_id || context.clientId

  switch (toolName) {

    // ── get_today_summary ──────────────────────────────────────────────
    case 'get_today_summary': {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayStr = today.toISOString().split('T')[0]
      const nextWeek = new Date(today)
      nextWeek.setDate(today.getDate() + 7)

      const [meetingsRes, remindersRes, paymentsRes] = await Promise.all([
        supabase
          .from('meeting_logs')
          .select('*, clients(name)')
          .gte('meeting_date', todayStr)
          .lt('meeting_date', `${todayStr}T23:59:59`)
          .order('meeting_date', { ascending: true }),
        supabase
          .from('reminders')
          .select('*, clients(name)')
          .eq('is_completed', false)
          .lte('due_date', nextWeek.toISOString())
          .order('due_date', { ascending: true })
          .limit(10),
        supabase
          .from('payments')
          .select('*, clients(name)')
          .eq('payment_status', 'ממתין')
          .order('payment_date', { ascending: true })
          .limit(10),
      ])

      return {
        date: todayStr,
        meetings_today: meetingsRes.data || [],
        upcoming_reminders: remindersRes.data || [],
        pending_payments: paymentsRes.data || [],
        summary: {
          meetings_count: meetingsRes.data?.length || 0,
          reminders_count: remindersRes.data?.length || 0,
          pending_payments_count: paymentsRes.data?.length || 0,
        },
      }
    }

    // ── get_today_meetings ─────────────────────────────────────────────
    case 'get_today_meetings': {
      const dateStr = args.date || new Date().toISOString().split('T')[0]
      const { data, error } = await supabase
        .from('meeting_logs')
        .select('*, clients(name, phone)')
        .gte('meeting_date', `${dateStr}T00:00:00`)
        .lte('meeting_date', `${dateStr}T23:59:59`)
        .order('meeting_date', { ascending: true })

      if (error) return { error: error.message }
      return { date: dateStr, meetings: data || [], count: data?.length || 0 }
    }

    // ── get_upcoming_reminders ─────────────────────────────────────────
    case 'get_upcoming_reminders': {
      const days = args.days || 7
      const future = new Date()
      future.setDate(future.getDate() + days)

      let query = supabase
        .from('reminders')
        .select('*, clients(name)')
        .eq('is_completed', false)
        .lte('due_date', future.toISOString())
        .order('due_date', { ascending: true })
        .limit(20)

      if (args.client_id) {
        query = query.eq('client_id', args.client_id)
      }

      const { data, error } = await query
      if (error) return { error: error.message }
      return { reminders: data || [], count: data?.length || 0, days_ahead: days }
    }

    // ── search_clients ────────────────────────────────────────────────
    case 'search_clients': {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, phone, email, status, advisor_status')
        .or(`name.ilike.%${args.query}%,phone.ilike.%${args.query}%,email.ilike.%${args.query}%`)
        .order('name')
        .limit(10)

      if (error) return { error: error.message }
      return { clients: data || [], count: data?.length || 0 }
    }

    // ── get_client_summary ────────────────────────────────────────────
    case 'get_client_summary': {
      if (!clientId) return { error: 'נדרש מזהה לקוח' }

      const [clientRes, paymentsRes, meetingsRes, remindersRes] = await Promise.all([
        supabase.from('clients').select('*').eq('id', clientId).single(),
        supabase
          .from('payments')
          .select('amount, payment_type, payment_status, payment_date, description')
          .eq('client_id', clientId)
          .order('payment_date', { ascending: false })
          .limit(10),
        supabase
          .from('meeting_logs')
          .select('meeting_date, subject, summary, meeting_type')
          .eq('client_id', clientId)
          .order('meeting_date', { ascending: false })
          .limit(5),
        supabase
          .from('reminders')
          .select('title, due_date, priority')
          .eq('client_id', clientId)
          .eq('is_completed', false)
          .order('due_date', { ascending: true })
          .limit(5),
      ])

      if (clientRes.error) return { error: clientRes.error.message }

      const payments = paymentsRes.data || []
      const totalIncome = payments
        .filter(p => p.payment_type === 'income' && p.payment_status === 'שולם')
        .reduce((sum, p) => sum + p.amount, 0)
      const totalExpense = payments
        .filter(p => p.payment_type === 'expense' && p.payment_status === 'שולם')
        .reduce((sum, p) => sum + p.amount, 0)
      const pendingCount = payments.filter(p => p.payment_status === 'ממתין').length

      return {
        client: clientRes.data,
        financial: {
          total_income: totalIncome,
          total_expense: totalExpense,
          balance: totalIncome - totalExpense,
          pending_payments: pendingCount,
          recent_payments: payments.slice(0, 5),
        },
        meetings: meetingsRes.data || [],
        open_reminders: remindersRes.data || [],
      }
    }

    // ── get_meetings_for_client ───────────────────────────────────────
    case 'get_meetings_for_client': {
      if (!clientId) return { error: 'נדרש מזהה לקוח' }
      const limit = args.limit || 10

      const { data, error } = await supabase
        .from('meeting_logs')
        .select('*')
        .eq('client_id', clientId)
        .order('meeting_date', { ascending: false })
        .limit(limit)

      if (error) return { error: error.message }
      return { meetings: data || [], count: data?.length || 0 }
    }

    // ── get_financial_report ──────────────────────────────────────────
    case 'get_financial_report': {
      if (!clientId) return { error: 'נדרש מזהה לקוח' }

      let query = supabase
        .from('payments')
        .select('*')
        .eq('client_id', clientId)
        .order('payment_date', { ascending: false })

      if (args.date_from) query = query.gte('payment_date', args.date_from)
      if (args.date_to) query = query.lte('payment_date', args.date_to)

      const { data, error } = await query
      if (error) return { error: error.message }

      const payments = data || []
      const income = payments.filter(p => p.payment_type === 'income' && p.payment_status === 'שולם')
      const expense = payments.filter(p => p.payment_type === 'expense' && p.payment_status === 'שולם')
      const pending = payments.filter(p => p.payment_status === 'ממתין')

      return {
        total_income: income.reduce((s, p) => s + p.amount, 0),
        total_expense: expense.reduce((s, p) => s + p.amount, 0),
        balance: income.reduce((s, p) => s + p.amount, 0) - expense.reduce((s, p) => s + p.amount, 0),
        pending_total: pending.reduce((s, p) => s + p.amount, 0),
        pending_count: pending.length,
        payments: payments.slice(0, 20),
      }
    }

    // ── get_client_links ──────────────────────────────────────────────
    case 'get_client_links': {
      if (!clientId) return { error: 'נדרש מזהה לקוח' }

      const { data, error } = await supabase
        .from('client_links')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })

      if (error) return { error: error.message }
      return { links: data || [], count: data?.length || 0 }
    }

    // ── read_google_drive_file ────────────────────────────────────────
    case 'read_google_drive_file': {
      if (!args.url) return { error: 'נדרשת כתובת URL של הקובץ' }
      return readPublicDriveFile(args.url)
    }

    // ── create_reminder ───────────────────────────────────────────────
    case 'create_reminder': {
      const { data, error } = await supabase
        .from('reminders')
        .insert({
          title: args.title,
          due_date: args.due_date,
          priority: args.priority,
          client_id: args.client_id || null,
          description: args.description || null,
          category: args.category || null,
          recurrence_rule: args.recurrence_rule || null,
          is_completed: false,
        })
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, reminder_id: data.id, reminder: data }
    }

    // ── complete_reminder ─────────────────────────────────────────────
    case 'complete_reminder': {
      const { error } = await supabase
        .from('reminders')
        .update({ is_completed: true })
        .eq('id', args.reminder_id)

      if (error) return { success: false, error: error.message }
      return { success: true }
    }

    // ── create_meeting ────────────────────────────────────────────────
    case 'create_meeting': {
      if (!clientId) return { success: false, error: 'נדרש מזהה לקוח' }

      const { data, error } = await supabase
        .from('meeting_logs')
        .insert({
          client_id: clientId,
          meeting_date: args.meeting_date,
          subject: args.subject,
          meeting_type: args.meeting_type || null,
          summary: args.summary || null,
          action_items: args.action_items || null,
        })
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, meeting_id: data.id, meeting: data }
    }

    // ── generate_meeting_summary ──────────────────────────────────────
    case 'generate_meeting_summary': {
      const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
      if (!apiKey) return { error: 'מפתח API לא מוגדר' }

      const prompt = `אתה מזכיר מקצועי. סכם את הפגישה הבאה בעברית בצורה מובנית.

תוכן הפגישה:
${args.meeting_notes}

החזר JSON בפורמט:
{
  "summary": "סיכום פגישה של 3-5 משפטים",
  "action_items": "רשימת משימות המשך ממוספרת"
}`

      const summaryModels = ['gemini-flash-latest', 'gemini-pro-latest']
      let res: Response | null = null
      for (const m of summaryModels) {
        for (let attempt = 1; attempt <= 3; attempt++) {
          const r = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
              }),
            }
          )
          if (r.status === 404) break
          if (r.status === 429 || r.status === 503) {
            await new Promise(x => setTimeout(x, attempt * 3000))
            continue
          }
          res = r
          break
        }
        if (res) break
      }

      if (!res || !res.ok) return { error: 'שגיאה ביצירת סיכום' }
      const geminiData = await res.json()
      const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || ''

      let result: any = { summary: text, action_items: '' }
      try {
        const clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
        const parsed = JSON.parse(clean)
        result = parsed
      } catch {}

      // Optionally update the meeting record
      if (args.meeting_id && result.summary) {
        await supabase
          .from('meeting_logs')
          .update({ summary: result.summary, action_items: result.action_items })
          .eq('id', args.meeting_id)
      }

      return { success: true, ...result }
    }

    // ── update_client_status ──────────────────────────────────────────
    case 'update_client_status': {
      if (!clientId) return { success: false, error: 'נדרש מזהה לקוח' }

      const updateData: Record<string, string> = {}
      if (args.status) updateData.status = args.status
      if (args.advisor_status) updateData.advisor_status = args.advisor_status

      const { error } = await supabase.from('clients').update(updateData).eq('id', clientId)
      if (error) return { success: false, error: error.message }
      return { success: true, updated: updateData }
    }

    // ── update_client_notes ───────────────────────────────────────────
    case 'update_client_notes': {
      if (!clientId) return { success: false, error: 'נדרש מזהה לקוח' }

      const { error } = await supabase
        .from('clients')
        .update({ internal_notes: args.notes })
        .eq('id', clientId)

      if (error) return { success: false, error: error.message }
      return { success: true }
    }

    // ── create_payment ────────────────────────────────────────────────
    case 'create_payment': {
      if (!clientId) return { success: false, error: 'נדרש מזהה לקוח' }

      const today = new Date().toISOString().split('T')[0]
      const { data, error } = await supabase
        .from('payments')
        .insert({
          client_id: clientId,
          amount: args.amount,
          payment_type: args.payment_type,
          description: args.description || null,
          payment_date: args.payment_date || today,
          payment_status: args.payment_status || 'ממתין',
        })
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, payment_id: data.id, payment: data }
    }

    default:
      return { error: `כלי לא מוכר: ${toolName}` }
  }
}
