/**
 * src/ai/tools/clientTools.ts
 *
 * כלים לניהול לקוחות (טבלת clients)
 * גישה: admin בלבד
 */

import { SchemaType, type FunctionDeclaration } from '@google/generative-ai'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const db = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── searchClients ─────────────────────────────────────────────────────────────

export const searchClientsDeclaration: FunctionDeclaration = {
  name: 'searchClients',
  description:
    'מחפש לקוחות לפי שם, טלפון או מייל. השתמש כאשר המשתמש שואל "מצא את הלקוח X", "מה הפרטים של X".',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      query: {
        type: SchemaType.STRING,
        description: 'מחרוזת חיפוש — שם, טלפון או מייל (חובה)',
      },
      status: {
        type: SchemaType.STRING,
        description: 'סינון לפי סטטוס: active, inactive, prospect, archived',
      },
    },
    required: ['query'],
  },
}

export async function searchClients(args: {
  query?: string
  status?: string
}): Promise<Record<string, unknown>> {
  if (!args.query?.trim()) return { found: false, error: 'חסרת מחרוזת חיפוש.' }
  const q = args.query.trim()

  let query = db
    .from('clients')
    .select('id, name, phone, email, status, notes, portfolio_value, advisory_goal')
    .or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`)
    .limit(10)

  if (args.status) query = query.eq('status', args.status)

  const { data, error } = await query
  if (error) return { found: false, error: error.message }
  if (!data || data.length === 0) return { found: false, error: `לא נמצאו לקוחות התואמים "${q}".` }

  return { found: true, count: data.length, clients: data }
}

// ─── getClientDetails ──────────────────────────────────────────────────────────

export const getClientDetailsDeclaration: FunctionDeclaration = {
  name: 'getClientDetails',
  description:
    'מחזיר פרטים מלאים של לקוח כולל פגישות ומשימות אחרונות. השתמש כאשר המשתמש שואל "ספר לי על לקוח X".',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      client_id: { type: SchemaType.STRING, description: 'UUID של הלקוח' },
      client_name: { type: SchemaType.STRING, description: 'שם הלקוח לחיפוש אם אין UUID' },
    },
    required: [],
  },
}

export async function getClientDetails(args: {
  client_id?: string
  client_name?: string
}): Promise<Record<string, unknown>> {
  let clientId = args.client_id

  if (!clientId && args.client_name) {
    const { data } = await db
      .from('clients')
      .select('id')
      .ilike('name', `%${args.client_name}%`)
      .limit(1)
    if (!data || data.length === 0) return { found: false, error: `לא נמצא לקוח "${args.client_name}".` }
    clientId = data[0].id
  }

  if (!clientId) return { found: false, error: 'חסר מזהה לקוח.' }

  const [{ data: client }, { data: appointments }, { data: tasks }] = await Promise.all([
    db.from('clients').select('*').eq('id', clientId).single(),
    db
      .from('appointments')
      .select('id, title, start_time, status')
      .eq('client_id', clientId)
      .order('start_time', { ascending: false })
      .limit(5),
    db
      .from('tasks')
      .select('id, title, status, priority, due_date')
      .eq('client_id', clientId)
      .limit(5),
  ])

  if (!client) return { found: false, error: 'לקוח לא נמצא.' }

  return {
    found: true,
    client: {
      id: client.id,
      name: client.name,
      phone: client.phone,
      email: client.email,
      status: client.status,
      portfolio_value: client.portfolio_value,
      advisory_goal: client.advisory_goal,
      notes: client.notes,
    },
    recent_appointments: (appointments ?? []).slice(0, 3),
    open_tasks: (tasks ?? []).filter((t: any) => t.status !== 'done'),
  }
}

// ─── createClient (bot tool) ───────────────────────────────────────────────────

export const createClientDeclaration: FunctionDeclaration = {
  name: 'createClient',
  description:
    'יוצר לקוח חדש במערכת. השתמש כאשר המשתמש אומר "הוסף לקוח חדש", "רשום לקוח".',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      name: { type: SchemaType.STRING, description: 'שם הלקוח (חובה)' },
      phone: { type: SchemaType.STRING, description: 'טלפון' },
      email: { type: SchemaType.STRING, description: 'מייל' },
      notes: { type: SchemaType.STRING, description: 'הערות' },
      status: {
        type: SchemaType.STRING,
        description: 'סטטוס: active, prospect (ברירת מחדל: active)',
      },
    },
    required: ['name'],
  },
}

export async function createClientTool(args: {
  name?: string; phone?: string; email?: string; notes?: string; status?: string
}): Promise<Record<string, unknown>> {
  if (!args.name?.trim()) return { pending: false, error: 'חסר שם לקוח.' }

  const validStatuses = ['active', 'inactive', 'prospect', 'archived']
  const status = args.status && validStatuses.includes(args.status) ? args.status : 'active'

  return {
    pending: true,
    action_type: 'createClient',
    action_params: {
      name: args.name,
      phone: args.phone || null,
      email: args.email || null,
      notes: args.notes || null,
      status,
    },
    confirmation_message:
      `האם להוסיף לקוח חדש בשם "${args.name}"` +
      (args.phone ? ` טלפון: ${args.phone}` : '') +
      (args.email ? ` מייל: ${args.email}` : '') + '?',
  }
}

export async function executeCreateClient(params: {
  name: string; phone?: string | null; email?: string | null; notes?: string | null; status: string; created_by?: string
}): Promise<Record<string, unknown>> {
  const { error } = await db.from('clients').insert({
    name: params.name,
    phone: params.phone || null,
    email: params.email || null,
    notes: params.notes || null,
    status: params.status,
    created_by: params.created_by || null,
  })
  if (error) return { success: false, error: error.message }
  return { success: true, message: `לקוח "${params.name}" נוסף בהצלחה.` }
}
