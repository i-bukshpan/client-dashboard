import { SchemaType, type FunctionDeclaration } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── getMosheCalendarEvents ───────────────────────────────────────────────────

export const getMosheCalendarEventsDeclaration: FunctionDeclaration = {
  name: 'getMosheCalendarEvents',
  description:
    'מחזיר פגישות קרובות מיומן הפורטל. השתמש כאשר המשתמש שואל "מה הפגישות שלי בפורטל", "מה הלו"ז בפורטל היום".',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      days_ahead: {
        type: SchemaType.INTEGER,
        description: 'כמה ימים קדימה להציג (ברירת מחדל: 7)',
      },
    },
    required: [],
  },
}

export async function getMosheCalendarEvents(args: {
  days_ahead?: number
}): Promise<Record<string, unknown>> {
  const daysAhead = args.days_ahead ?? 7
  const now = new Date()
  const future = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000)

  const { data, error } = await db
    .from('moshe_calendar_events')
    .select('*')
    .gte('start_time', now.toISOString())
    .lte('start_time', future.toISOString())
    .order('start_time', { ascending: true })
    .limit(30)

  if (error) return { found: false, error: error.message }

  const events = (data ?? []).map((a: any) => ({
    id: a.id,
    title: a.title,
    start: a.start_time,
    end: a.end_time,
    type: a.type,
    notes: a.notes || '',
  }))

  return {
    found: true,
    count: events.length,
    events,
    period: `${daysAhead} הימים הקרובים`,
  }
}

// ─── createMosheCalendarEvent ─────────────────────────────────────────────────────────

export const createMosheCalendarEventDeclaration: FunctionDeclaration = {
  name: 'createMosheCalendarEvent',
  description:
    'קובע פגישה חדשה ביומן הפורטל (משה). השתמש כאשר המשתמש אומר "קבע פגישה", "תזמן פגישה בפורטל". זה היומן המרכזי שבו יש להשתמש כרגע.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      title: { type: SchemaType.STRING, description: 'נושא הפגישה (חובה)' },
      start_time: {
        type: SchemaType.STRING,
        description: 'תאריך ושעת התחלה בפורמט ISO 8601, למשל 2026-06-15T10:00:00 (חובה)',
      },
      end_time: {
        type: SchemaType.STRING,
        description: 'תאריך ושעת סיום (אופציונלי)',
      },
      type: {
        type: SchemaType.STRING,
        description: 'סוג: meeting, reminder או other (ברירת מחדל: meeting)',
      },
      notes: { type: SchemaType.STRING, description: 'הערות נוספות (אופציונלי)' },
    },
    required: ['title', 'start_time'],
  },
}

export async function createMosheCalendarEvent(args: {
  title: string
  start_time: string
  end_time?: string
  type?: string
  notes?: string
}): Promise<Record<string, unknown>> {
  if (!args.title || !args.start_time) {
    return { error: 'חסרים שדות חובה: נושא הפגישה או זמן ההתחלה.' }
  }

  return {
    message: `האם תרצה לקבוע פגישה/אירוע "${args.title}" בפורטל בתאריך ${new Date(args.start_time).toLocaleString('he-IL')}?`,
    pending: true,
    options: [
      { id: 'confirm', title: 'מאשר' },
      { id: 'cancel', title: 'ביטול' },
    ],
    actionParams: args,
  }
}

export async function executeCreateMosheCalendarEvent(
  params: { title: string; start_time: string; end_time?: string; type?: string; notes?: string }
) {
  const { error } = await db.from('moshe_calendar_events').insert({
    title: params.title,
    start_time: params.start_time,
    end_time: params.end_time || null,
    type: params.type || 'meeting',
    notes: params.notes || null,
  })

  if (error) {
    throw new Error(`שגיאה בשמירת פגישה בפורטל: ${error.message}`)
  }
  return { success: true, message: 'הפגישה ביומן הפורטל נוצרה בהצלחה.' }
}

// ─── cancelMosheCalendarEvent ─────────────────────────────────────────────────────────

export const cancelMosheCalendarEventDeclaration: FunctionDeclaration = {
  name: 'cancelMosheCalendarEvent',
  description: 'מבטל פגישה/אירוע קיים מיומן הפורטל לפי מזהה ה-ID של הפגישה.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      event_id: { type: SchemaType.STRING, description: 'מזהה ה-ID של האירוע לביטול' },
    },
    required: ['event_id'],
  },
}

export async function cancelMosheCalendarEvent(args: { event_id: string }): Promise<Record<string, unknown>> {
  if (!args.event_id) return { error: 'חסר מזהה פגישה.' }

  const { data: event, error: lookupError } = await db
    .from('moshe_calendar_events')
    .select('title')
    .eq('id', args.event_id)
    .single()

  if (lookupError || !event) {
    return { error: 'פגישה לא נמצאה ביומן הפורטל.' }
  }

  return {
    message: `האם לבטל את הפגישה "${event.title}" מיומן הפורטל?`,
    pending: true,
    options: [
      { id: 'confirm', title: 'בטל פגישה' },
      { id: 'cancel', title: 'השאר פגישה' },
    ],
    actionParams: args,
  }
}

export async function executeCancelMosheCalendarEvent(params: { event_id: string }) {
  const { error } = await db.from('moshe_calendar_events').delete().eq('id', params.event_id)
  if (error) throw new Error(`שגיאה בביטול פגישה בפורטל: ${error.message}`)
  return { success: true, message: 'הפגישה בוטלה והוסרה מיומן הפורטל.' }
}
