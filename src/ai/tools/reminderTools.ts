/**
 * src/ai/tools/reminderTools.ts
 *
 * כלים לניהול תזכורות WhatsApp עבור הבוט הפנימי.
 * תומך ב: יצירת תזכורת ידנית, צפייה ברשימה, מחיקה.
 */

import { SchemaType, type FunctionDeclaration } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── createReminder ────────────────────────────────────────────────────────────

export const createReminderDeclaration: FunctionDeclaration = {
  name: 'createReminder',
  description:
    'יוצר תזכורת שתישלח למשתמש ב-WhatsApp בזמן מסוים. ' +
    'השתמש כאשר המשתמש אומר "תזכיר לי מחר", "תזמן לי תזכורת", "תשלח לי הודעה ב-X לגבי Y".',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      message: {
        type: SchemaType.STRING,
        description: 'תוכן התזכורת שתישלח (חובה)',
      },
      scheduled_at: {
        type: SchemaType.STRING,
        description: 'תאריך ושעת שליחה בפורמט ISO 8601, למשל 2026-06-15T08:00:00. השעה תעוגל אוטומטית לכפולות של 5 דקות. בתזכורת מחזורית - זהו מועד ההתחלה. (חובה)',
      },
      cron_expression: {
        type: SchemaType.STRING,
        description: 'אופציונלי. ביטוי cron חוקי עבור תזכורות מחזוריות. למשל "0 9 * * 0" לכל יום ראשון ב-9:00, או "0 9 1 * *" לכל ראשון לחודש ב-9:00. אם נשלח, התזכורת תחזור על עצמה לפי ה-cron.',
      },
    },
    required: ['message', 'scheduled_at'],
  },
}

export async function createReminder(args: {
  message?: string
  scheduled_at?: string
  cron_expression?: string
}, ctx: { phone: string; name?: string }): Promise<Record<string, unknown>> {
  if (!args.message?.trim()) return { error: 'חסר תוכן לתזכורת.' }
  if (!args.scheduled_at) return { error: 'חסר תאריך שליחה.' }

  const scheduledDate = new Date(args.scheduled_at)
  if (isNaN(scheduledDate.getTime())) return { error: 'תאריך לא תקין.' }

  // Round to nearest 5 minutes
  const ms5 = 1000 * 60 * 5;
  const roundedTime = Math.round(scheduledDate.getTime() / ms5) * ms5;
  scheduledDate.setTime(roundedTime);

  // Validate not in the past (allow 2 min grace)
  if (scheduledDate.getTime() < Date.now() - 2 * 60 * 1000) {
    return { error: `התאריך שציינת (${args.scheduled_at}) כבר עבר או מעוגל לעבר. אנא ציין תאריך עתידי.` }
  }

  // Display in Israel timezone
  const displayTime = scheduledDate.toLocaleString('he-IL', {
    timeZone: 'Asia/Jerusalem',
    weekday: 'short', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  let confMsg = `האם לרשום תזכורת: "${args.message.trim()}" לשליחה ב-${displayTime}?`
  if (args.cron_expression) {
    confMsg = `האם לרשום תזכורת מחזורית: "${args.message.trim()}" שתתחיל ב-${displayTime} (לפי מחזוריות: ${args.cron_expression})?`
  }

  return {
    pending: true,
    action_type: 'createReminder',
    action_params: {
      phone: ctx.phone,
      user_name: ctx.name || null,
      message: args.message.trim(),
      scheduled_at: scheduledDate.toISOString(), // always store as UTC
      cron_expression: args.cron_expression || null,
    },
    confirmation_message: confMsg,
  }
}

export async function executeCreateReminder(params: {
  phone: string
  user_name?: string | null
  message: string
  scheduled_at: string
  cron_expression?: string | null
}): Promise<Record<string, unknown>> {
  const isRecurring = !!params.cron_expression;
  const { error } = await db.from('bot_reminders').insert({
    phone: params.phone,
    user_name: params.user_name || null,
    message: params.message,
    reminder_type: 'custom',
    scheduled_at: params.scheduled_at,
    is_sent: false,
    is_recurring: isRecurring,
    recur_cron: params.cron_expression || null,
  })
  if (error) return { success: false, error: error.message }
  return { success: true, message: `✅ התזכורת נרשמה! תקבל הודעה ב-WhatsApp בזמן שנקבע.` }
}

// ─── listMyReminders ───────────────────────────────────────────────────────────

export const listMyRemindersDeclaration: FunctionDeclaration = {
  name: 'listMyReminders',
  description:
    'מציג את רשימת התזכורות הפתוחות של המשתמש הנוכחי. ' +
    'השתמש כאשר המשתמש שואל "אילו תזכורות יש לי?", "הראה לי את התזכורות שלי".',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {},
    required: [],
  },
}

export async function listMyReminders(ctx: { phone: string }): Promise<Record<string, unknown>> {
  const { data, error } = await db
    .from('bot_reminders')
    .select('id, message, scheduled_at, reminder_type, is_recurring, recur_cron')
    .eq('phone', ctx.phone)
    .eq('is_sent', false)
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(20)

  if (error) return { found: false, error: error.message }

  const reminders = (data ?? []).map((r: any) => ({
    id: r.id,
    message: r.message,
    scheduled: new Date(r.scheduled_at).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }),
    type: r.reminder_type === 'custom' ? 'ידנית' : 'אוטומטית',
    recurring: r.is_recurring ? (r.recur_cron || 'כן') : 'לא',
  }))

  return {
    found: true,
    count: reminders.length,
    reminders,
  }
}

// ─── deleteReminder ────────────────────────────────────────────────────────────

export const deleteReminderDeclaration: FunctionDeclaration = {
  name: 'deleteReminder',
  description:
    'מוחק תזכורת פתוחה של המשתמש לפי תיאור או מזהה. ' +
    'השתמש כאשר המשתמש אומר "מחק את התזכורת", "בטל את התזכורת של X".',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      reminder_id: { type: SchemaType.STRING, description: 'UUID של התזכורת (אם ידוע)' },
      reminder_description: { type: SchemaType.STRING, description: 'חלק מתוכן התזכורת לחיפוש' },
    },
    required: [],
  },
}

export async function deleteReminder(args: {
  reminder_id?: string
  reminder_description?: string
}, ctx: { phone: string }): Promise<Record<string, unknown>> {
  let reminderId = args.reminder_id

  if (!reminderId && args.reminder_description) {
    const { data } = await db
      .from('bot_reminders')
      .select('id, message')
      .eq('phone', ctx.phone)
      .eq('is_sent', false)
      .ilike('message', `%${args.reminder_description}%`)
      .limit(1)

    if (data && data.length > 0) reminderId = data[0].id
  }

  if (!reminderId) return { error: 'לא נמצאה תזכורת תואמת. נסה לציין תוכן ברור יותר.' }

  const { data: reminder } = await db
    .from('bot_reminders')
    .select('message')
    .eq('id', reminderId)
    .eq('phone', ctx.phone)
    .single()

  if (!reminder) return { error: 'התזכורת לא נמצאה.' }

  return {
    pending: true,
    action_type: 'deleteReminder',
    action_params: { reminder_id: reminderId },
    confirmation_message: `האם למחוק את התזכורת: "${reminder.message}"?`,
  }
}

export async function executeDeleteReminder(params: { reminder_id: string }): Promise<Record<string, unknown>> {
  const { error } = await db.from('bot_reminders').delete().eq('id', params.reminder_id)
  if (error) return { success: false, error: error.message }
  return { success: true, message: 'התזכורת נמחקה בהצלחה.' }
}
