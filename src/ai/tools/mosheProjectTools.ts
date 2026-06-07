/**
 * src/ai/tools/mosheProjectTools.ts
 *
 * כלים לפרויקטי נדל"ן — פרויקטים, קונים, תשלומים, עסקאות
 * גישה: moshe_admin + admin
 *
 * ⚠️ הנוסחאות מסונכרנות עם האתר החי:
 *   src/app/moshe/projects/[id]/page.tsx
 *   src/app/moshe/page.tsx
 */

import { SchemaType, type FunctionDeclaration } from '@google/generative-ai'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const db = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── listProjects ──────────────────────────────────────────────────────────────

export const listProjectsDeclaration: FunctionDeclaration = {
  name: 'listProjects',
  description:
    'מחזיר רשימת פרויקטי הנדל"ן של הפורטל (פרויקטי משה פרוש). ' +
    'השתמש כאשר המשתמש שואל "אילו פרויקטים יש", "רשימת פרויקטים", "פרויקטים בפורטל".',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      status: {
        type: SchemaType.STRING,
        description: 'סינון לפי סטטוס: active, pending, closed',
      },
    },
    required: [],
  },
}

export async function listProjects(
  args: { status?: string },
  allowedProjectIds?: string[] | null
): Promise<Record<string, unknown>> {
  let query = db
    .from('moshe_projects')
    .select('id, name, address, status, total_project_cost, start_date, created_at')
    .order('created_at', { ascending: false })

  if (args.status) query = query.eq('status', args.status)
  else query = query.neq('status', 'closed') // ברירת מחדל: לא סגורים

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
// נוסחה מסונכרנת עם: src/app/moshe/projects/[id]/page.tsx שורות 99-129

export const getProjectBalanceDeclaration: FunctionDeclaration = {
  name: 'getProjectBalance',
  description:
    'מחזיר את כל ה-KPIs הפיננסיים של פרויקט בפורטל, זהה לאתר החי. ' +
    'כולל: מאזן אמיתי, מאזן צפוי, הכנסות, הוצאות, יתרת הלוואות (בלי ריבית), כסף בקופה. ' +
    'השתמש כאשר המשתמש שואל "מה המאזן", "כמה כסף יש", "מה הסטטוס הכספי".',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      project: {
        type: SchemaType.STRING,
        description: 'שם הפרויקט או UUID. לדוגמה: "רחוב הרצל 12" או UUID.',
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
  if (projErr) return { found: false, error: projErr.message }
  if (!projects || projects.length === 0) return { found: false, error: `לא נמצא פרויקט "${query}".` }
  if (projects.length > 1) {
    return {
      found: false,
      ambiguous: true,
      error: `נמצאו מספר פרויקטים תואמים. יש לדייק.`,
      candidates: projects.map((p: any) => p.name),
    }
  }
  const project = projects[0]

  // שולף את כל הטבלאות הדרושות לנוסחה
  const [
    { data: projPayments },
    { data: buyerPayments },
    { data: transactions },
    { data: partnerTransactions },
    { data: loans },
    { data: loanPayments },
  ] = await Promise.all([
    db.from('moshe_project_payments').select('amount, is_paid').eq('project_id', project.id),
    db.from('moshe_buyer_payments').select('amount, is_received').eq('project_id', project.id),
    db.from('moshe_transactions').select('amount, type').eq('project_id', project.id),
    db.from('moshe_partner_transactions').select('amount, type').eq('project_id', project.id),
    db.from('moshe_loans').select('id, total_amount').eq('project_id', project.id),
    db.from('moshe_loan_payments').select('loan_id, amount, is_paid, is_interest').eq('project_id', project.id),
  ])

  const pp  = (projPayments ?? []) as any[]
  const bp  = (buyerPayments ?? []) as any[]
  const tx  = (transactions ?? []) as any[]
  const ptx = (partnerTransactions ?? []) as any[]
  const lo  = (loans ?? []) as any[]
  const lp  = (loanPayments ?? []) as any[]

  // ── נוסחאות זהות לדף פרויקט באתר החי ──────────────────────────────────────
  const totalPaid      = pp.filter(x => x.is_paid).reduce((s: number, x: any) => s + Number(x.amount), 0)
  const totalScheduled = pp.reduce((s: number, x: any) => s + Number(x.amount), 0)
  const totalReceived  = bp.filter(x => x.is_received).reduce((s: number, x: any) => s + Number(x.amount), 0)
  const totalExpected  = bp.reduce((s: number, x: any) => s + Number(x.amount), 0)
  const txIncome       = tx.filter(x => x.type === 'income').reduce((s: number, x: any) => s + Number(x.amount), 0)
  const txExpense      = tx.filter(x => x.type === 'expense').reduce((s: number, x: any) => s + Number(x.amount), 0)
  const totalInvested  = ptx.filter(x => x.type === 'investment').reduce((s: number, x: any) => s + Number(x.amount), 0)
  const totalWithdrawn = ptx.filter(x => x.type === 'withdrawal').reduce((s: number, x: any) => s + Number(x.amount), 0)
  const ptxExpense     = ptx.filter(x => x.type === 'expense').reduce((s: number, x: any) => s + Number(x.amount), 0)

  // הלוואות — בלי ריבית (is_interest=false OR is_interest IS NULL)
  const totalLoans   = lo.reduce((s: number, l: any) => s + Number(l.total_amount), 0)
  const loanPaidBack = lp
    .filter((p: any) => p.is_paid && !p.is_interest)
    .reduce((s: number, p: any) => s + Number(p.amount), 0)
  const loanInterestPaid = lp
    .filter((p: any) => p.is_paid && p.is_interest)
    .reduce((s: number, p: any) => s + Number(p.amount), 0)
  const loanNetReceived = totalLoans - loanPaidBack  // יתרת ההלוואה (בלי ריבית)

  // KPIs — בדיוק כמו בדף הפרויקט
  const realBalance     = (totalReceived + txIncome + totalInvested) - (totalPaid + txExpense + ptxExpense + totalWithdrawn)
  const expectedBalance = (totalExpected + txIncome + totalInvested) - (totalScheduled + txExpense + ptxExpense + totalWithdrawn)
  const cashInFund      = (loanNetReceived + totalReceived + txIncome + totalInvested) - (totalPaid + txExpense + ptxExpense + totalWithdrawn)

  const f = (n: number) => '₪' + n.toLocaleString('he-IL', { maximumFractionDigits: 0 })

  return {
    found: true,
    project_name: project.name,
    // KPIs — זהים לאתר
    real_balance:       { value: realBalance,     formatted: f(realBalance) },
    expected_balance:   { value: expectedBalance, formatted: f(expectedBalance) },
    income_received:    { value: totalReceived + txIncome,  formatted: f(totalReceived + txIncome) },
    expenses_paid:      { value: totalPaid + txExpense + ptxExpense + totalWithdrawn - totalInvested, formatted: f(totalPaid + txExpense + ptxExpense + totalWithdrawn - totalInvested) },
    loan_net_remaining: { value: loanNetReceived, formatted: f(loanNetReceived), note: 'ללא ריבית' },
    cash_in_fund:       { value: cashInFund,      formatted: f(cashInFund) },
    // פרטים נוספים
    collection_rate:    totalExpected > 0 ? Math.round((totalReceived / totalExpected) * 100) : 0,
    interest_paid:      loanInterestPaid,
    currency: 'ILS',
  }
}

// ─── getProjectSummary ─────────────────────────────────────────────────────────

export const getProjectSummaryDeclaration: FunctionDeclaration = {
  name: 'getProjectSummary',
  description:
    'מחזיר סיכום מלא של פרויקט בפורטל — KPIs, קונים, תשלומים, שותפים, עובדים, הלוואות. ' +
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
  // נשתמש ב-getProjectBalance לקבל את הנוסחאות, ואז נוסיף מידע נוסף
  const balanceResult = await getProjectBalance(args)
  if (!balanceResult.found) return balanceResult

  const query = (args.project || '').trim()
  const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query)
  const { data: projects } = looksLikeUuid
    ? await db.from('moshe_projects').select('*').eq('id', query).limit(1)
    : await db.from('moshe_projects').select('*').ilike('name', `%${query}%`).limit(1)

  if (!projects || projects.length === 0) return { found: false, error: 'פרויקט לא נמצא.' }
  const project = projects[0]

  const [
    { data: buyers },
    { data: partners },
    { data: workers },
    { data: loans },
    { data: pendingProjectPayments },
  ] = await Promise.all([
    db.from('moshe_buyers').select('id, name, total_amount').eq('project_id', project.id),
    db.from('moshe_partners').select('id, name').eq('project_id', project.id),
    db.from('moshe_workers').select('id, name').eq('project_id', project.id).eq('is_active', true),
    db.from('moshe_loans').select('id, lender, total_amount, interest_rate').eq('project_id', project.id),
    db.from('moshe_project_payments').select('id, amount, due_date, notes').eq('project_id', project.id).eq('is_paid', false),
  ])

  return {
    ...balanceResult,
    project: {
      id: project.id,
      name: project.name,
      address: project.address,
      status: project.status,
      total_budget: project.total_project_cost,
      start_date: project.start_date,
    },
    buyers: {
      count: (buyers ?? []).length,
      list: (buyers ?? []).map((b: any) => ({ id: b.id, name: b.name, total: b.total_amount })),
    },
    partners: {
      count: (partners ?? []).length,
      list: (partners ?? []).map((p: any) => ({ id: p.id, name: p.name })),
    },
    portal_workers: {
      count: (workers ?? []).length,
      list: (workers ?? []).map((w: any) => ({ id: w.id, name: w.name })),
    },
    loans: {
      count: (loans ?? []).length,
      total: (loans ?? []).reduce((s: number, l: any) => s + Number(l.total_amount), 0),
      list: (loans ?? []).map((l: any) => ({ lender: l.lender, amount: l.total_amount, rate: l.interest_rate })),
    },
    pending_project_payments: {
      count: (pendingProjectPayments ?? []).length,
      total: (pendingProjectPayments ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0),
    },
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
  description: 'מוסיף תשלום הוצאה לפרויקט (הוצאה מתוכננת).',
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
  description: 'מסמן תשלום פרויקט כשולם.',
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
    'השתמש כאשר המשתמש אומר "הוסף עסקה", "רשום הוצאה/הכנסה".',
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
  description: 'מוסיף קונה חדש לפרויקט בפורטל.',
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
