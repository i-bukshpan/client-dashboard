/**
 * src/ai/tools/loanTools.ts
 *
 * כלים לניהול הלוואות פרויקט (moshe_loans, moshe_loan_payments)
 * גישה: moshe_admin + admin
 */

import { SchemaType, type FunctionDeclaration } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── getLoansSummary ───────────────────────────────────────────────────────────

export const getLoansSummaryDeclaration: FunctionDeclaration = {
  name: 'getLoansSummary',
  description:
    'מחזיר סיכום הלוואות של פרויקט. ' +
    'השתמש כאשר המשתמש שואל "מה ההלוואות של פרויקט X", "כמה אנחנו חייבים", "סיכום הלוואות".',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      project: { type: SchemaType.STRING, description: 'שם הפרויקט (חובה)' },
    },
    required: ['project'],
  },
}

export async function getLoansSummary(args: { project?: string }): Promise<Record<string, unknown>> {
  if (!args.project) return { found: false, error: 'חסר שם פרויקט.' }

  const { data: projects } = await db
    .from('moshe_projects')
    .select('id, name')
    .ilike('name', `%${args.project}%`)
    .limit(1)

  if (!projects || projects.length === 0) return { found: false, error: `לא נמצא פרויקט "${args.project}".` }
  const project = projects[0]

  const { data: loans, error } = await db
    .from('moshe_loans')
    .select(`
      id, lender, total_amount, interest_rate, num_payments, start_date, notes,
      moshe_loan_payments(id, amount, due_date, is_paid, paid_at)
    `)
    .eq('project_id', project.id)

  if (error) return { found: false, error: error.message }

  let totalLoanAmount = 0
  let totalPaid = 0
  let totalPending = 0

  const loansFormatted = (loans ?? []).map((loan: any) => {
    const payments = loan.moshe_loan_payments ?? []
    const paidPayments = payments.filter((p: any) => p.is_paid)
    const pendingPayments = payments.filter((p: any) => !p.is_paid)
    const loanPaid = paidPayments.reduce((s: number, p: any) => s + Number(p.amount), 0)
    const loanPending = pendingPayments.reduce((s: number, p: any) => s + Number(p.amount), 0)

    totalLoanAmount += Number(loan.total_amount)
    totalPaid += loanPaid
    totalPending += loanPending

    return {
      id: loan.id,
      lender: loan.lender,
      total_amount: loan.total_amount,
      interest_rate: loan.interest_rate,
      num_payments: loan.num_payments,
      paid: loanPaid,
      pending: loanPending,
      next_payment: pendingPayments.sort((a: any, b: any) =>
        (a.due_date || '').localeCompare(b.due_date || '')
      )[0] || null,
    }
  })

  return {
    found: true,
    project_name: project.name,
    loans_count: loansFormatted.length,
    total_loan_amount: totalLoanAmount,
    total_paid: totalPaid,
    total_pending: totalPending,
    total_pending_formatted: '₪' + totalPending.toLocaleString('he-IL', { maximumFractionDigits: 0 }),
    loans: loansFormatted,
  }
}

// ─── getPendingLoanPayments ────────────────────────────────────────────────────

export const getPendingLoanPaymentsDeclaration: FunctionDeclaration = {
  name: 'getPendingLoanPayments',
  description:
    'מחזיר תשלומי הלוואה שטרם שולמו. ' +
    'השתמש כאשר המשתמש שואל "מה הריבית הקרובה", "מה צריך לשלם על הלוואה", "תשלומים ממתינים להלוואה".',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      project: { type: SchemaType.STRING, description: 'שם הפרויקט (חובה)' },
      days_ahead: {
        type: SchemaType.INTEGER,
        description: 'כמה ימים קדימה להציג (ברירת מחדל: 30)',
      },
    },
    required: ['project'],
  },
}

export async function getPendingLoanPayments(args: {
  project?: string; days_ahead?: number
}): Promise<Record<string, unknown>> {
  if (!args.project) return { found: false, error: 'חסר שם פרויקט.' }

  const { data: projects } = await db
    .from('moshe_projects')
    .select('id, name')
    .ilike('name', `%${args.project}%`)
    .limit(1)
  if (!projects || projects.length === 0) return { found: false, error: `לא נמצא פרויקט "${args.project}".` }
  const project = projects[0]

  const daysAhead = args.days_ahead ?? 30
  const future = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { data: payments, error } = await db
    .from('moshe_loan_payments')
    .select(`
      id, amount, due_date, notes,
      moshe_loans(lender)
    `)
    .eq('project_id', project.id)
    .eq('is_paid', false)
    .lte('due_date', future)
    .order('due_date', { ascending: true })

  if (error) return { found: false, error: error.message }

  const total = (payments ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0)

  return {
    found: true,
    project_name: project.name,
    period: `${daysAhead} ימים הקרובים`,
    count: (payments ?? []).length,
    total_pending: total,
    total_formatted: '₪' + total.toLocaleString('he-IL', { maximumFractionDigits: 0 }),
    payments: (payments ?? []).map((p: any) => ({
      id: p.id,
      lender: (p.moshe_loans as any)?.lender || 'לא ידוע',
      amount: p.amount,
      due_date: p.due_date,
      notes: p.notes || '',
    })),
  }
}

// ─── markLoanPaymentPaid ───────────────────────────────────────────────────────

export const markLoanPaymentPaidDeclaration: FunctionDeclaration = {
  name: 'markLoanPaymentPaid',
  description:
    'מסמן תשלום הלוואה כ"שולם". ' +
    'השתמש כאשר המשתמש אומר "שילמנו על ההלוואה", "סמן תשלום הלוואה".',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      payment_id: { type: SchemaType.STRING, description: 'UUID של תשלום ההלוואה (חובה)' },
    },
    required: ['payment_id'],
  },
}

export async function markLoanPaymentPaid(args: { payment_id?: string }): Promise<Record<string, unknown>> {
  if (!args.payment_id) return { pending: false, error: 'חסר מזהה תשלום הלוואה.' }

  const { data: payment } = await db
    .from('moshe_loan_payments')
    .select('amount, moshe_loans(lender)')
    .eq('id', args.payment_id)
    .single()

  const lender = (payment?.moshe_loans as any)?.lender || ''
  const amount = payment?.amount || 0

  return {
    pending: true,
    action_type: 'markLoanPaymentPaid',
    action_params: { payment_id: args.payment_id },
    confirmation_message:
      `האם לסמן תשלום הלוואה של ₪${Number(amount).toLocaleString('he-IL')}` +
      (lender ? ` ל${lender}` : '') + ' כ"שולם"?',
  }
}

export async function executeMarkLoanPaymentPaid(params: { payment_id: string }): Promise<Record<string, unknown>> {
  const { error } = await db
    .from('moshe_loan_payments')
    .update({ is_paid: true, paid_at: new Date().toISOString() })
    .eq('id', params.payment_id)
  if (error) return { success: false, error: error.message }
  return { success: true, message: 'תשלום ההלוואה סומן כשולם.' }
}
