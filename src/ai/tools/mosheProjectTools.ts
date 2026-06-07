/**
 * src/ai/tools/mosheProjectTools.ts
 *
 * כלים לפרויקטי נדל"ן — פרויקטים, קונים, תשלומים, עסקאות
 * גישה: moshe_admin + admin
 */

import { SchemaType, type FunctionDeclaration } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── listProjects ──────────────────────────────────────────────────────────────

export const listProjectsDeclaration: FunctionDeclaration = {
  name: 'listProjects',
  description:
    'מחזיר רשימת פרויקטי הנדל"ן. השתמש כאשר המשתמש שואל "אילו פרויקטים יש", "רשימת פרויקטים".',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      status: {
        type: SchemaType.STRING,
        description: 'סינון לפי סטטוס: active, pending, closed',
      },
      allowed_ids: {
        type: SchemaType.STRING,
        description: 'רשימת UUIDs מופרדים בפסיק — לשימוש פנימי לסינון הרשאות שותף',
      },
    },
    required: [],
  },
}

export async function listProjects(
  args: { status?: string; allowed_ids?: string },
  allowedProjectIds?: string[] | null
): Promise<Record<string, unknown>> {
  let query = db
    .from('moshe_projects')
    .select('id, name, address, status, total_project_cost, start_date, created_at')
    .order('created_at', { ascending: false })

  if (args.status) query = query.eq('status', args.status)
  if (allowedProjectIds !== null && allowedProjectIds !== undefined) {
    query = query.in('id', allowedProjectIds)
  }

  const { data, error } = await query
  if (error) return { found: false, error: error.message }

  return {
    found: true,
    count: (data ?? []).length,
    projects: (data ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      address: p.address || '',
      status: p.status,
      total_cost: p.total_project_cost,
      start_date: p.start_date,
    })),
  }
}

// ─── getProjectBalance ─────────────────────────────────────────────────────────

export const getProjectBalanceDeclaration: FunctionDeclaration = {
  name: 'getProjectBalance',
  description:
    'מחזיר את המאזן הפיננסי הנוכחי (בש"ח) של פרויקט נדל"ן. ' +
    'המאזן = סך התקבולים שנגבו מקונים פחות סך ההוצאות ששולמו. ' +
    'השתמש בכל פעם שהמשתמש שואל על יתרה / מאזן / כמה כסף יש בפרויקט.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      project: {
        type: SchemaType.STRING,
        description: 'מזהה הפרויקט (UUID) או שם הפרויקט, למשל "רחוב הרצל 12".',
      },
    },
    required: ['project'],
  },
}

export async function getProjectBalance(args: { project?: string }): Promise<Record<string, unknown>> {
  const query = (args.project || '').trim()
  if (!query) return { found: false, error: 'לא צוין שם או מזהה פרויקט.' }

  const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query)
  const projectQuery = looksLikeUuid
    ? db.from('moshe_projects').select('id, name').eq('id', query).limit(1)
    : db.from('moshe_projects').select('id, name').ilike('name', `%${query}%`).limit(2)

  const { data: projects, error: projErr } = await projectQuery
  if (projErr) return { found: false, error: `שגיאת מסד נתונים: ${projErr.message}` }
  if (!projects || projects.length === 0) return { found: false, error: `לא נמצא פרויקט בשם "${query}".` }
  if (projects.length > 1) {
    return {
      found: false,
      ambiguous: true,
      error: `נמצאו כמה פרויקטים תואמים ל-"${query}". יש לדייק.`,
      candidates: projects.map((p: any) => p.name),
    }
  }

  const project = projects[0]

  const [{ data: buyerPayments }, { data: projectPayments }] = await Promise.all([
    db.from('moshe_buyer_payments').select('amount, is_received').eq('project_id', project.id),
    db.from('moshe_project_payments').select('amount, is_paid').eq('project_id', project.id),
  ])

  const received = (buyerPayments ?? [])
    .filter((p: any) => p.is_received)
    .reduce((sum: number, p: any) => sum + Number(p.amount), 0)
  const paid = (projectPayments ?? [])
    .filter((p: any) => p.is_paid)
    .reduce((sum: number, p: any) => sum + Number(p.amount), 0)
  const balance = received - paid

  return {
    found: true,
    project_name: project.name,
    balance,
    received,
    paid,
    currency: 'ILS',
    balance_formatted: '₪' + balance.toLocaleString('he-IL', { maximumFractionDigits: 0 }),
    received_formatted: '₪' + received.toLocaleString('he-IL', { maximumFractionDigits: 0 }),
    paid_formatted: '₪' + paid.toLocaleString('he-IL', { maximumFractionDigits: 0 }),
  }
}

// ─── getProjectSummary ─────────────────────────────────────────────────────────

export const getProjectSummaryDeclaration: FunctionDeclaration = {
  name: 'getProjectSummary',
  description:
    'מחזיר סיכום מלא של פרויקט — קונים, תשלומים, שותפים, עובדים, הלוואות. ' +
    'השתמש כאשר המשתמש אומר "ספר לי על פרויקט X", "מה הסטטוס של פרויקט X".',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      project: { type: SchemaType.STRING, description: 'שם הפרויקט או UUID' },
    },
    required: ['project'],
  },
}

export async function getProjectSummary(args: { project?: string }): Promise<Record<string, unknown>> {
  const query = (args.project || '').trim()
  if (!query) return { found: false, error: 'לא צוין פרויקט.' }

  const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query)
  const { data: projects } = looksLikeUuid
    ? await db.from('moshe_projects').select('*').eq('id', query).limit(1)
    : await db.from('moshe_projects').select('*').ilike('name', `%${query}%`).limit(1)

  if (!projects || projects.length === 0) return { found: false, error: `לא נמצא פרויקט "${query}".` }
  const project = projects[0]

  const [
    { data: buyers },
    { data: buyerPayments },
    { data: projectPayments },
    { data: partners },
    { data: loans },
  ] = await Promise.all([
    db.from('moshe_buyers').select('id, name, total_amount').eq('project_id', project.id),
    db.from('moshe_buyer_payments').select('amount, is_received').eq('project_id', project.id),
    db.from('moshe_project_payments').select('amount, is_paid, due_date').eq('project_id', project.id),
    db.from('moshe_partners').select('name, phone').eq('project_id', project.id),
    db.from('moshe_loans').select('lender, total_amount, interest_rate').eq('project_id', project.id),
  ])

  const totalReceived = (buyerPayments ?? []).filter((p: any) => p.is_received).reduce((s: number, p: any) => s + Number(p.amount), 0)
  const totalPaid = (projectPayments ?? []).filter((p: any) => p.is_paid).reduce((s: number, p: any) => s + Number(p.amount), 0)
  const pendingProjectPayments = (projectPayments ?? []).filter((p: any) => !p.is_paid).reduce((s: number, p: any) => s + Number(p.amount), 0)

  return {
    found: true,
    project: {
      id: project.id,
      name: project.name,
      address: project.address,
      status: project.status,
      total_cost: project.total_project_cost,
    },
    finance: {
      balance: totalReceived - totalPaid,
      total_received: totalReceived,
      total_paid: totalPaid,
      pending_payments: pendingProjectPayments,
    },
    buyers_count: (buyers ?? []).length,
    buyers: (buyers ?? []).map((b: any) => ({ name: b.name, total: b.total_amount })),
    partners: (partners ?? []).map((p: any) => p.name),
    loans_count: (loans ?? []).length,
    total_loans: (loans ?? []).reduce((s: number, l: any) => s + Number(l.total_amount), 0),
  }
}

// ─── getPendingPayments ────────────────────────────────────────────────────────

export const getPendingPaymentsDeclaration: FunctionDeclaration = {
  name: 'getPendingPayments',
  description:
    'מחזיר תשלומים שטרם שולמו בפרויקט (הוצאות ממתינות). ' +
    'השתמש כאשר המשתמש שואל "מה צריך לשלם", "אילו תשלומים ממתינים".',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      project: { type: SchemaType.STRING, description: 'שם הפרויקט (חובה)' },
    },
    required: ['project'],
  },
}

export async function getPendingPayments(args: { project?: string }): Promise<Record<string, unknown>> {
  const query = (args.project || '').trim()
  if (!query) return { found: false, error: 'לא צוין פרויקט.' }

  const { data: projects } = await db
    .from('moshe_projects')
    .select('id, name')
    .ilike('name', `%${query}%`)
    .limit(1)

  if (!projects || projects.length === 0) return { found: false, error: `לא נמצא פרויקט "${query}".` }
  const project = projects[0]

  const { data: payments } = await db
    .from('moshe_project_payments')
    .select('id, amount, due_date, notes')
    .eq('project_id', project.id)
    .eq('is_paid', false)
    .order('due_date', { ascending: true })

  const total = (payments ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0)

  return {
    found: true,
    project_name: project.name,
    count: (payments ?? []).length,
    total_pending: total,
    total_formatted: '₪' + total.toLocaleString('he-IL', { maximumFractionDigits: 0 }),
    payments: (payments ?? []).map((p: any) => ({
      id: p.id,
      amount: p.amount,
      due_date: p.due_date || 'לא נקבע',
      notes: p.notes || '',
    })),
  }
}

// ─── addProjectPayment ─────────────────────────────────────────────────────────

export const addProjectPaymentDeclaration: FunctionDeclaration = {
  name: 'addProjectPayment',
  description: 'מוסיף תשלום הוצאה לפרויקט (הוצאה מתוכננת). השתמש כאשר המשתמש אומר "הוסף תשלום לפרויקט X".',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      project: { type: SchemaType.STRING, description: 'שם הפרויקט (חובה)' },
      amount: { type: SchemaType.NUMBER, description: 'סכום (חובה)' },
      due_date: { type: SchemaType.STRING, description: 'תאריך יעד YYYY-MM-DD' },
      notes: { type: SchemaType.STRING, description: 'הערות' },
    },
    required: ['project', 'amount'],
  },
}

export async function addProjectPayment(args: {
  project?: string; amount?: number; due_date?: string; notes?: string
}): Promise<Record<string, unknown>> {
  if (!args.project || !args.amount) return { pending: false, error: 'חסרים פרטי פרויקט וסכום.' }

  const { data: projects } = await db
    .from('moshe_projects')
    .select('id, name')
    .ilike('name', `%${args.project}%`)
    .limit(1)

  if (!projects || projects.length === 0) return { pending: false, error: `לא נמצא פרויקט "${args.project}".` }
  const project = projects[0]

  return {
    pending: true,
    action_type: 'addProjectPayment',
    action_params: {
      project_id: project.id,
      amount: args.amount,
      due_date: args.due_date || null,
      notes: args.notes || '',
    },
    confirmation_message:
      `האם להוסיף תשלום של ₪${args.amount.toLocaleString('he-IL')} לפרויקט "${project.name}"` +
      (args.due_date ? ` לתאריך ${args.due_date}` : '') + '?',
  }
}

export async function executeAddProjectPayment(params: {
  project_id: string; amount: number; due_date?: string | null; notes?: string
}): Promise<Record<string, unknown>> {
  const { error } = await db.from('moshe_project_payments').insert({
    project_id: params.project_id,
    amount: params.amount,
    due_date: params.due_date || null,
    notes: params.notes || null,
    is_paid: false,
  })
  if (error) return { success: false, error: error.message }
  return { success: true, message: `תשלום של ₪${params.amount.toLocaleString('he-IL')} נוסף בהצלחה.` }
}

// ─── markPaymentPaid ───────────────────────────────────────────────────────────

export const markPaymentPaidDeclaration: FunctionDeclaration = {
  name: 'markPaymentPaid',
  description: 'מסמן תשלום פרויקט כשולם. השתמש כאשר המשתמש אומר "שולם", "סמן שולם".',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      payment_id: { type: SchemaType.STRING, description: 'UUID של התשלום' },
    },
    required: ['payment_id'],
  },
}

export async function markPaymentPaid(args: { payment_id?: string }): Promise<Record<string, unknown>> {
  if (!args.payment_id) return { pending: false, error: 'חסר מזהה תשלום.' }
  return {
    pending: true,
    action_type: 'markPaymentPaid',
    action_params: { payment_id: args.payment_id },
    confirmation_message: `האם לסמן את התשלום כ"שולם"?`,
  }
}

export async function executeMarkPaymentPaid(params: { payment_id: string }): Promise<Record<string, unknown>> {
  const { error } = await db
    .from('moshe_project_payments')
    .update({ is_paid: true, paid_at: new Date().toISOString() })
    .eq('id', params.payment_id)
  if (error) return { success: false, error: error.message }
  return { success: true, message: 'התשלום סומן כשולם.' }
}

// ─── addTransaction ────────────────────────────────────────────────────────────

export const addTransactionDeclaration: FunctionDeclaration = {
  name: 'addTransaction',
  description:
    'מוסיף עסקה חופשית (הכנסה/הוצאה) לפרויקט. ' +
    'השתמש כאשר המשתמש אומר "הוסף עסקה לפרויקט X", "רשום הוצאה/הכנסה".',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      project: { type: SchemaType.STRING, description: 'שם הפרויקט (חובה)' },
      type: { type: SchemaType.STRING, description: 'income או expense (חובה)' },
      amount: { type: SchemaType.NUMBER, description: 'סכום (חובה)' },
      category: { type: SchemaType.STRING, description: 'קטגוריה' },
      date: { type: SchemaType.STRING, description: 'תאריך YYYY-MM-DD (ברירת מחדל: היום)' },
      notes: { type: SchemaType.STRING, description: 'הערות' },
    },
    required: ['project', 'type', 'amount'],
  },
}

export async function addTransaction(args: {
  project?: string; type?: string; amount?: number; category?: string; date?: string; notes?: string
}): Promise<Record<string, unknown>> {
  if (!args.project || !args.type || !args.amount) return { pending: false, error: 'חסרים פרמטרים.' }
  if (!['income', 'expense'].includes(args.type)) return { pending: false, error: 'סוג חייב להיות income או expense.' }

  const { data: projects } = await db
    .from('moshe_projects')
    .select('id, name')
    .ilike('name', `%${args.project}%`)
    .limit(1)
  if (!projects || projects.length === 0) return { pending: false, error: `לא נמצא פרויקט "${args.project}".` }
  const project = projects[0]

  const date = args.date || new Date().toISOString().split('T')[0]
  const typeLabel = args.type === 'income' ? 'הכנסה' : 'הוצאה'

  return {
    pending: true,
    action_type: 'addTransaction',
    action_params: {
      project_id: project.id,
      type: args.type,
      amount: args.amount,
      category: args.category || null,
      date,
      notes: args.notes || '',
    },
    confirmation_message:
      `האם להוסיף ${typeLabel} של ₪${args.amount.toLocaleString('he-IL')}` +
      (args.category ? ` (${args.category})` : '') +
      ` לפרויקט "${project.name}" בתאריך ${date}?`,
  }
}

export async function executeAddTransaction(params: {
  project_id: string; type: string; amount: number; category?: string | null; date: string; notes?: string
}): Promise<Record<string, unknown>> {
  const { error } = await db.from('moshe_transactions').insert({
    project_id: params.project_id,
    type: params.type,
    amount: params.amount,
    category: params.category || null,
    date: params.date,
    notes: params.notes || null,
  })
  if (error) return { success: false, error: error.message }
  return { success: true, message: 'העסקה נוספה בהצלחה.' }
}

// ─── addBuyer ──────────────────────────────────────────────────────────────────

export const addBuyerDeclaration: FunctionDeclaration = {
  name: 'addBuyer',
  description: 'מוסיף קונה חדש לפרויקט. השתמש כאשר המשתמש אומר "הוסף קונה", "רשום קונה חדש לפרויקט X".',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      project: { type: SchemaType.STRING, description: 'שם הפרויקט (חובה)' },
      name: { type: SchemaType.STRING, description: 'שם הקונה (חובה)' },
      phone: { type: SchemaType.STRING, description: 'טלפון' },
      email: { type: SchemaType.STRING, description: 'מייל' },
      unit_description: { type: SchemaType.STRING, description: 'תיאור הדירה/יחידה' },
      total_amount: { type: SchemaType.NUMBER, description: 'מחיר העסקה הכולל' },
      notes: { type: SchemaType.STRING, description: 'הערות' },
    },
    required: ['project', 'name'],
  },
}

export async function addBuyer(args: {
  project?: string; name?: string; phone?: string; email?: string; unit_description?: string; total_amount?: number; notes?: string
}): Promise<Record<string, unknown>> {
  if (!args.project || !args.name) return { pending: false, error: 'חסרים שם פרויקט ושם קונה.' }

  const { data: projects } = await db
    .from('moshe_projects')
    .select('id, name')
    .ilike('name', `%${args.project}%`)
    .limit(1)
  if (!projects || projects.length === 0) return { pending: false, error: `לא נמצא פרויקט "${args.project}".` }
  const project = projects[0]

  return {
    pending: true,
    action_type: 'addBuyer',
    action_params: {
      project_id: project.id,
      name: args.name,
      phone: args.phone || null,
      email: args.email || null,
      unit_description: args.unit_description || null,
      total_amount: args.total_amount || null,
      notes: args.notes || null,
    },
    confirmation_message:
      `האם להוסיף קונה "${args.name}"` +
      (args.unit_description ? ` (${args.unit_description})` : '') +
      ` לפרויקט "${project.name}"` +
      (args.total_amount ? ` בסכום ₪${args.total_amount.toLocaleString('he-IL')}` : '') + '?',
  }
}

export async function executeAddBuyer(params: {
  project_id: string; name: string; phone?: string | null; email?: string | null;
  unit_description?: string | null; total_amount?: number | null; notes?: string | null
}): Promise<Record<string, unknown>> {
  const { error } = await db.from('moshe_buyers').insert({
    project_id: params.project_id,
    name: params.name,
    phone: params.phone || null,
    email: params.email || null,
    unit_description: params.unit_description || null,
    total_amount: params.total_amount || null,
    notes: params.notes || null,
  })
  if (error) return { success: false, error: error.message }
  return { success: true, message: `קונה "${params.name}" נוסף בהצלחה.` }
}
