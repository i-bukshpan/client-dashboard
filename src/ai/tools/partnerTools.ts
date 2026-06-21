/**
 * src/ai/tools/partnerTools.ts
 *
 * כלים לניהול שותפים בפרויקט (moshe_partners, moshe_partner_transactions)
 * גישה: moshe_admin (כל) | partner (רק הפרויקטים שלו)
 */

import { SchemaType, type FunctionDeclaration } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── listPartners ──────────────────────────────────────────────────────────────

export const listPartnersDeclaration: FunctionDeclaration = {
  name: 'listPartners',
  description:
    'מחזיר רשימת שותפים בפרויקט עם סיכום השקעותיהם. ' +
    'השתמש כאשר המשתמש שואל "מי השותפים בפרויקט X", "רשימת השותפים".',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      project: { type: SchemaType.STRING, description: 'שם הפרויקט (חובה)' },
    },
    required: ['project'],
  },
}

export async function listPartners(args: {
  project?: string
}, allowedProjectIds?: string[] | null): Promise<Record<string, unknown>> {
  if (!args.project) return { found: false, error: 'חסר שם פרויקט.' }

  const { data: projects } = await db
    .from('moshe_projects')
    .select('id, name')
    .ilike('name', `%${args.project}%`)
    .limit(1)

  if (!projects || projects.length === 0) return { found: false, error: `לא נמצא פרויקט "${args.project}".` }
  const project = projects[0]

  // בדיקת הרשאה לשותף
  if (allowedProjectIds !== null && allowedProjectIds !== undefined) {
    if (!allowedProjectIds.includes(project.id)) {
      return { found: false, error: 'אין לך הרשאה לצפות בפרויקט זה.' }
    }
  }

  const { data: partners, error } = await db
    .from('moshe_partners')
    .select(`
      id, name, phone, email, notes,
      moshe_partner_transactions(type, amount, date)
    `)
    .eq('project_id', project.id)

  if (error) return { found: false, error: error.message }

  const result = (partners ?? []).map((p: any) => {
    const transactions = p.moshe_partner_transactions ?? []
    const totalIn = transactions
      .filter((t: any) => t.type === 'investment')
      .reduce((s: number, t: any) => s + Number(t.amount), 0)
    const totalOut = transactions
      .filter((t: any) => ['withdrawal', 'expense'].includes(t.type))
      .reduce((s: number, t: any) => s + Number(t.amount), 0)

    return {
      id: p.id,
      name: p.name,
      phone: p.phone || null,
      total_invested: totalIn,
      total_withdrawn: totalOut,
      net: totalIn - totalOut,
      transactions_count: transactions.length,
    }
  })

  return { found: true, project_name: project.name, count: result.length, partners: result }
}

// ─── getPartnerSummary ─────────────────────────────────────────────────────────

export const getPartnerSummaryDeclaration: FunctionDeclaration = {
  name: 'getPartnerSummary',
  description:
    'מחזיר סיכום השקעות של שותף ספציפי בכל הפרויקטים. ' +
    'השתמש כאשר המשתמש שואל "כמה השקעתי", "מה הסטטוס שלי", "כמה יש לי".',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      partner_name: { type: SchemaType.STRING, description: 'שם השותף' },
      partner_id: { type: SchemaType.STRING, description: 'UUID של השותף' },
    },
    required: [],
  },
}

export async function getPartnerSummary(args: {
  partner_name?: string; partner_id?: string
}, contextPartnerId?: string): Promise<Record<string, unknown>> {
  // אם השותף מזוהה מהקשר (JWT/context), נשתמש בו
  const targetId = args.partner_id || contextPartnerId

  let partnersQuery = db.from('moshe_partners').select('id, name, project_id, moshe_projects(name)')

  if (targetId) {
    partnersQuery = partnersQuery.eq('id', targetId)
  } else if (args.partner_name) {
    partnersQuery = partnersQuery.ilike('name', `%${args.partner_name}%`)
  } else {
    return { found: false, error: 'יש לציין שם שותף או UUID.' }
  }

  const { data: partnerRows, error } = await partnersQuery
  if (error || !partnerRows || partnerRows.length === 0) {
    return { found: false, error: 'שותף לא נמצא.' }
  }

  // אוסף את כל ה-IDs
  const partnerIds = partnerRows.map((p: any) => p.id)

  const { data: transactions } = await db
    .from('moshe_partner_transactions')
    .select('partner_id, type, amount, date, notes, project_id, moshe_projects(name)')
    .in('partner_id', partnerIds)
    .order('date', { ascending: false })
    .limit(50)

  const totalIn = (transactions ?? [])
    .filter((t: any) => t.type === 'investment')
    .reduce((s: number, t: any) => s + Number(t.amount), 0)
  const totalOut = (transactions ?? [])
    .filter((t: any) => ['withdrawal', 'expense'].includes(t.type))
    .reduce((s: number, t: any) => s + Number(t.amount), 0)
  const net = totalIn - totalOut

  return {
    found: true,
    name: partnerRows[0].name,
    projects: partnerRows.map((p: any) => (p.moshe_projects as any)?.name || p.project_id),
    total_invested: totalIn,
    total_withdrawn: totalOut,
    net_position: net,
    net_formatted: '₪' + net.toLocaleString('he-IL', { maximumFractionDigits: 0 }),
    recent_transactions: (transactions ?? []).slice(0, 5).map((t: any) => ({
      type: t.type === 'investment' ? 'השקעה' : t.type === 'withdrawal' ? 'משיכה' : 'הוצאה',
      amount: t.amount,
      date: t.date,
      project: (t.moshe_projects as any)?.name || '',
    })),
  }
}

// ─── addPartnerTransaction ─────────────────────────────────────────────────────

export const addPartnerTransactionDeclaration: FunctionDeclaration = {
  name: 'addPartnerTransaction',
  description:
    'מוסיף תנועה כספית לשותף (השקעה, משיכה, הוצאה). ' +
    'השתמש כאשר המשתמש אומר "הכנס השקעה", "רשום משיכה", "השותף X הכניס כסף".',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      partner_name: { type: SchemaType.STRING, description: 'שם השותף (חובה)' },
      project: { type: SchemaType.STRING, description: 'שם הפרויקט (חובה)' },
      type: {
        type: SchemaType.STRING,
        description: 'סוג: investment (השקעה) / withdrawal (משיכה) / expense (הוצאה)',
      },
      amount: { type: SchemaType.NUMBER, description: 'סכום (חובה)' },
      date: { type: SchemaType.STRING, description: 'תאריך YYYY-MM-DD' },
      notes: { type: SchemaType.STRING, description: 'הערות' },
      has_invoice: { type: SchemaType.BOOLEAN, description: 'האם המשיכה מול חשבונית (רלוונטי למשיכות בלבד)' },
      add_vat_expense: { type: SchemaType.BOOLEAN, description: 'האם להוסיף 18% מע"מ כהוצאה אוטומטית (רלוונטי למשיכות מול חשבונית)' },
    },
    required: ['partner_name', 'project', 'type', 'amount'],
  },
}

export async function addPartnerTransaction(args: {
  partner_name?: string; project?: string; type?: string; amount?: number; date?: string; notes?: string; has_invoice?: boolean; add_vat_expense?: boolean
}): Promise<Record<string, unknown>> {
  if (!args.partner_name || !args.project || !args.type || !args.amount) {
    return { pending: false, error: 'חסרים פרמטרים חובה.' }
  }

  const validTypes = ['investment', 'withdrawal', 'expense']
  if (!validTypes.includes(args.type)) {
    return { pending: false, error: 'סוג חייב להיות investment, withdrawal, או expense.' }
  }

  // חיפוש שותף + פרויקט
  const [{ data: projects }, { data: partners }] = await Promise.all([
    db.from('moshe_projects').select('id, name').ilike('name', `%${args.project}%`).limit(1),
    db.from('moshe_partners').select('id, name').ilike('name', `%${args.partner_name}%`).limit(1),
  ])

  if (!projects || projects.length === 0) return { pending: false, error: `לא נמצא פרויקט "${args.project}".` }
  if (!partners || partners.length === 0) return { pending: false, error: `לא נמצא שותף "${args.partner_name}".` }

  const project = projects[0]
  const partner = partners[0]
  const date = args.date || new Date().toISOString().split('T')[0]
  const typeLabel: Record<string, string> = { investment: 'השקעה', withdrawal: 'משיכה', expense: 'הוצאה' }

  let confirmationMessage = `האם לרשום ${typeLabel[args.type]} של ₪${args.amount.toLocaleString('he-IL')} ` +
    `לשותף "${partner.name}" בפרויקט "${project.name}" בתאריך ${date}?`

  if (args.type === 'withdrawal' && args.has_invoice) {
    confirmationMessage += ` (משיכה מול חשבונית)`
    if (args.add_vat_expense) {
      const vat = args.amount * 0.18
      confirmationMessage += ` בנוסף תרשם הוצאת מע"מ בסך ₪${vat.toLocaleString('he-IL')} לשותף.`
    }
  }

  return {
    pending: true,
    action_type: 'addPartnerTransaction',
    action_params: {
      partner_id: partner.id,
      project_id: project.id,
      type: args.type,
      amount: args.amount,
      date,
      notes: args.notes || '',
      has_invoice: args.has_invoice,
      add_vat_expense: args.add_vat_expense,
    },
    confirmation_message: confirmationMessage,
  }
}

export async function executeAddPartnerTransaction(params: {
  partner_id: string; project_id: string; type: string; amount: number; date: string; notes?: string; has_invoice?: boolean; add_vat_expense?: boolean
}): Promise<Record<string, unknown>> {
  const { error } = await db.from('moshe_partner_transactions').insert({
    partner_id: params.partner_id,
    project_id: params.project_id,
    type: params.type,
    amount: params.amount,
    date: params.date,
    notes: params.notes || null,
    has_invoice: params.has_invoice || false,
  })
  if (error) return { success: false, error: error.message }

  if (params.add_vat_expense && params.type === 'withdrawal') {
    const vat = params.amount * 0.18
    const { error: vatError } = await db.from('moshe_transactions').insert({
      partner_id: params.partner_id,
      project_id: params.project_id,
      type: 'expense',
      amount: vat,
      date: params.date,
      category: 'מע"מ משיכות',
      notes: `מע"מ עבור משיכה מול חשבונית (סכום משיכה מקורי: ₪${params.amount.toLocaleString('he-IL')})`,
    })
    if (vatError) console.error('[executeAddPartnerTransaction] Error inserting vat:', vatError.message)
  }

  return { success: true, message: 'התנועה הכספית נרשמה בהצלחה.' }
}
