/**
 * src/ai/tools/appointmentTools.ts
 *
 * כלים לניהול פגישות (טבלאות: appointments, clients, profiles)
 * גישה: admin בלבד
 */

import { SchemaType, type FunctionDeclaration } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── getUpcomingAppointments ───────────────────────────────────────────────────

export const getUpcomingAppointmentsDeclaration: FunctionDeclaration = {
  name: 'getUpcomingAppointments',
  description:
    'מחזיר פגישות קרובות. השתמש כאשר המשתמש שואל "מה הפגישות שלי", "מה יש לי היום/מחר/השבוע", "לוח זמנים".',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      days_ahead: {
        type: SchemaType.INTEGER,
        description: 'כמה ימים קדימה להציג (ברירת מחדל: 7)',
      },
      employee_id: {
        type: SchemaType.STRING,
        description: 'UUID של עובד ספציפי — אם לא צוין, מציג את כל הפגישות',
      },
    },
    required: [],
  },
}

export async function getUpcomingAppointments(args: {
  days_ahead?: number
  employee_id?: string
}): Promise<Record<string, unknown>> {
  const daysAhead = args.days_ahead ?? 7
  const now = new Date()
  const future = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000)

  let query = db
    .from('appointments')
    .select(`
      id, title, start_time, end_time, status, notes,
      clients(name, phone),
      profiles!appointments_employee_id_fkey(full_name)
    `)
    .gte('start_time', now.toISOString())
    .lte('start_time', future.toISOString())
    .eq('status', 'scheduled')
    .order('start_time', { ascending: true })
    .limit(20)

  if (args.employee_id) {
    query = query.eq('employee_id', args.employee_id)
  }

  const { data, error } = await query
  if (error) return { found: false, error: error.message }

  const appointments = (data ?? []).map((a: any) => ({
    id: a.id,
    title: a.title,
    start: a.start_time,
    end: a.end_time,
    client: a.clients?.name || 'לא משויך',
    client_phone: a.clients?.phone || null,
    employee: a.profiles?.full_name || 'לא משויך',
    notes: a.notes || '',
  }))

  return {
    found: true,
    count: appointments.length,
    appointments,
    period: `${daysAhead} הימים הקרובים`,
  }
}

// ─── createAppointment ─────────────────────────────────────────────────────────

export const createAppointmentDeclaration: FunctionDeclaration = {
  name: 'createAppointment',
  description:
    'קובע פגישה חדשה. השתמש כאשר המשתמש אומר "קבע פגישה", "תזמן פגישה", "יש לי פגישה".',
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
        description: 'תאריך ושעת סיום בפורמט ISO 8601 (ברירת מחדל: שעה אחרי ההתחלה)',
      },
      client_name: { type: SchemaType.STRING, description: 'שם הלקוח — יחופש בDB' },
      notes: { type: SchemaType.STRING, description: 'הערות לפגישה' },
    },
    required: ['title', 'start_time'],
  },
}

export async function createAppointment(
  args: { title?: string; start_time?: string; end_time?: string; client_name?: string; notes?: string }
): Promise<Record<string, unknown>> {
  if (!args.title || !args.start_time) {
    return { pending: false, error: 'חסרים נושא הפגישה ושעת התחלה.' }
  }

  const startTime = new Date(args.start_time)
  const endTime = args.end_time
    ? new Date(args.end_time)
    : new Date(startTime.getTime() + 60 * 60 * 1000)

  // חיפוש לקוח לפי שם
  let clientId: string | null = null
  let clientName = args.client_name || null
  if (args.client_name) {
    const { data: clients } = await db
      .from('clients')
      .select('id, name')
      .ilike('name', `%${args.client_name}%`)
      .limit(1)
    if (clients && clients.length > 0) {
      clientId = clients[0].id
      clientName = clients[0].name
    }
  }

  const startFormatted = startTime.toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })
  const endFormatted = endTime.toLocaleString('he-IL', { timeStyle: 'short' })

  return {
    pending: true,
    action_type: 'createAppointment',
    action_params: {
      title: args.title,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      client_id: clientId,
      notes: args.notes || '',
    },
    confirmation_message:
      `האם לקבוע פגישה "${args.title}"${clientName ? ` עם ${clientName}` : ''} ` +
      `בתאריך ${startFormatted} עד ${endFormatted}?`,
  }
}

export async function executeCreateAppointment(params: {
  title: string; start_time: string; end_time: string; client_id?: string | null; notes?: string
}): Promise<Record<string, unknown>> {
  const { error } = await db.from('appointments').insert({
    title: params.title,
    start_time: params.start_time,
    end_time: params.end_time,
    client_id: params.client_id || null,
    notes: params.notes || null,
    status: 'scheduled',
  })
  if (error) return { success: false, error: error.message }
  return { success: true, message: `פגישה "${params.title}" נקבעה בהצלחה.` }
}

// ─── cancelAppointment ─────────────────────────────────────────────────────────

export const cancelAppointmentDeclaration: FunctionDeclaration = {
  name: 'cancelAppointment',
  description:
    'מבטל פגישה קיימת. השתמש כאשר המשתמש אומר "בטל פגישה", "הפגישה עם X בוטלה".',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      appointment_id: { type: SchemaType.STRING, description: 'UUID של הפגישה לביטול' },
      search_title: { type: SchemaType.STRING, description: 'נושא הפגישה לחיפוש אם אין UUID' },
    },
    required: [],
  },
}

export async function cancelAppointment(args: {
  appointment_id?: string
  search_title?: string
}): Promise<Record<string, unknown>> {
  let appointmentId = args.appointment_id
  let appointmentTitle = ''

  if (!appointmentId && args.search_title) {
    const { data } = await db
      .from('appointments')
      .select('id, title, start_time')
      .ilike('title', `%${args.search_title}%`)
      .eq('status', 'scheduled')
      .order('start_time', { ascending: true })
      .limit(1)

    if (!data || data.length === 0) {
      return { pending: false, error: `לא נמצאה פגישה בשם "${args.search_title}".` }
    }
    appointmentId = data[0].id
    appointmentTitle = data[0].title
  }

  if (!appointmentId) {
    return { pending: false, error: 'יש לספק מזהה פגישה או שם לחיפוש.' }
  }

  return {
    pending: true,
    action_type: 'cancelAppointment',
    action_params: { appointment_id: appointmentId },
    confirmation_message: `האם לבטל את הפגישה "${appointmentTitle || appointmentId}"?`,
  }
}

export async function executeCancelAppointment(params: {
  appointment_id: string
}): Promise<Record<string, unknown>> {
  const { error } = await db
    .from('appointments')
    .update({ status: 'cancelled' })
    .eq('id', params.appointment_id)
  if (error) return { success: false, error: error.message }
  return { success: true, message: 'הפגישה בוטלה בהצלחה.' }
}

// ─── updateAppointmentStatus ───────────────────────────────────────────────────

export const updateAppointmentStatusDeclaration: FunctionDeclaration = {
  name: 'updateAppointmentStatus',
  description: 'עדכון סטטוס פגישה (scheduled/done/cancelled).',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      appointment_id: { type: SchemaType.STRING, description: 'UUID של הפגישה' },
      status: {
        type: SchemaType.STRING,
        description: 'הסטטוס החדש: scheduled, done, cancelled',
      },
    },
    required: ['appointment_id', 'status'],
  },
}

export async function updateAppointmentStatus(args: {
  appointment_id?: string
  status?: string
}): Promise<Record<string, unknown>> {
  const validStatuses = ['scheduled', 'done', 'cancelled']
  if (!args.appointment_id || !args.status || !validStatuses.includes(args.status)) {
    return { pending: false, error: 'פרמטרים לא תקינים.' }
  }
  const statusLabels: Record<string, string> = { scheduled: 'מתוכננת', done: 'הסתיימה', cancelled: 'בוטלה' }
  return {
    pending: true,
    action_type: 'updateAppointmentStatus',
    action_params: { appointment_id: args.appointment_id, status: args.status },
    confirmation_message: `האם לסמן את הפגישה כ"${statusLabels[args.status]}"?`,
  }
}

export async function executeUpdateAppointmentStatus(params: {
  appointment_id: string; status: string
}): Promise<Record<string, unknown>> {
  const { error } = await db
    .from('appointments')
    .update({ status: params.status })
    .eq('id', params.appointment_id)
  if (error) return { success: false, error: error.message }
  return { success: true, message: 'סטטוס הפגישה עודכן בהצלחה.' }
}
