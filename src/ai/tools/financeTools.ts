/**
 * src/ai/tools/financeTools.ts
 *
 * כלים פיננסיים כלליים (טבלאות: income, expenses)
 * גישה: admin בלבד
 */

import {
  SchemaType,
  type FunctionDeclaration,
  type Part,
} from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── getFinanceSummary ─────────────────────────────────────────────────────────

export const getFinanceSummaryDeclaration: FunctionDeclaration = {
  name: 'getFinanceSummary',
  description:
    'מחזיר סיכום הכנסות והוצאות כלליות של המשרד לטווח תאריכים נתון. ' +
    'השתמש כאשר המשתמש שואל כמה הרווחנו, מה ההכנסות, מה ההוצאות, מה הרווח.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      from_date: {
        type: SchemaType.STRING,
        description: 'תאריך התחלה בפורמט YYYY-MM-DD (ברירת מחדל: תחילת החודש הנוכחי)',
      },
      to_date: {
        type: SchemaType.STRING,
        description: 'תאריך סיום בפורמט YYYY-MM-DD (ברירת מחדל: היום)',
      },
    },
    required: [],
  },
}

export async function getFinanceSummary(args: {
  from_date?: string
  to_date?: string
}): Promise<Record<string, unknown>> {
  const today = new Date()
  const fromDate = args.from_date || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
  const toDate = args.to_date || today.toISOString().split('T')[0]

  const [{ data: incomeRows, error: incErr }, { data: expenseRows, error: expErr }] =
    await Promise.all([
      db.from('income').select('amount, category, date').gte('date', fromDate).lte('date', toDate),
      db.from('expenses').select('amount, category, date').gte('date', fromDate).lte('date', toDate),
    ])

  if (incErr || expErr) {
    return { found: false, error: (incErr || expErr)?.message }
  }

  const totalIncome = (incomeRows ?? []).reduce((s, r) => s + Number(r.amount), 0)
  const totalExpenses = (expenseRows ?? []).reduce((s, r) => s + Number(r.amount), 0)
  const profit = totalIncome - totalExpenses

  // קיבוץ לפי קטגוריה
  const incomeByCategory: Record<string, number> = {}
  for (const r of incomeRows ?? []) {
    incomeByCategory[r.category] = (incomeByCategory[r.category] || 0) + Number(r.amount)
  }
  const expenseByCategory: Record<string, number> = {}
  for (const r of expenseRows ?? []) {
    expenseByCategory[r.category] = (expenseByCategory[r.category] || 0) + Number(r.amount)
  }

  return {
    found: true,
    period: { from: fromDate, to: toDate },
    total_income: totalIncome,
    total_expenses: totalExpenses,
    profit,
    income_by_category: incomeByCategory,
    expense_by_category: expenseByCategory,
    formatted: {
      income: '₪' + totalIncome.toLocaleString('he-IL', { maximumFractionDigits: 0 }),
      expenses: '₪' + totalExpenses.toLocaleString('he-IL', { maximumFractionDigits: 0 }),
      profit: '₪' + profit.toLocaleString('he-IL', { maximumFractionDigits: 0 }),
    },
  }
}

// ─── addIncome ─────────────────────────────────────────────────────────────────

export const addIncomeDeclaration: FunctionDeclaration = {
  name: 'addIncome',
  description:
    'מוסיף רשומת הכנסה חדשה. השתמש כאשר המשתמש אומר "קיבלנו תשלום", "נכנסו כספים", "הוסף הכנסה".',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      amount: { type: SchemaType.NUMBER, description: 'סכום ההכנסה בש"ח (חובה)' },
      category: { type: SchemaType.STRING, description: 'קטגוריה (למשל: ייעוץ, שכ"ט, עמלה)' },
      date: { type: SchemaType.STRING, description: 'תאריך בפורמט YYYY-MM-DD (ברירת מחדל: היום)' },
      notes: { type: SchemaType.STRING, description: 'הערות נוספות' },
    },
    required: ['amount'],
  },
}

export async function addIncome(
  args: { amount?: number; category?: string; date?: string; notes?: string },
  createdBy?: string
): Promise<Record<string, unknown>> {
  if (!args.amount || args.amount <= 0) {
    return { pending: false, error: 'סכום לא תקין.' }
  }
  const date = args.date || new Date().toISOString().split('T')[0]
  const category = args.category || 'כללי'

  // החזרת פעולה ממתינה לאישור
  return {
    pending: true,
    action_type: 'addIncome',
    action_params: { amount: args.amount, category, date, notes: args.notes || '', created_by: createdBy },
    confirmation_message:
      `האם להוסיף הכנסה של ₪${args.amount.toLocaleString('he-IL')} בקטגוריה "${category}" לתאריך ${date}?`,
  }
}

export async function executeAddIncome(params: {
  amount: number; category: string; date: string; notes?: string; created_by?: string
}): Promise<Record<string, unknown>> {
  const { error } = await db.from('income').insert({
    amount: params.amount,
    category: params.category,
    date: params.date,
    notes: params.notes || null,
    created_by: params.created_by || null,
  })
  if (error) return { success: false, error: error.message }
  return { success: true, message: `הכנסה של ₪${params.amount.toLocaleString('he-IL')} נוספה בהצלחה.` }
}

// ─── addExpense ────────────────────────────────────────────────────────────────

export const addExpenseDeclaration: FunctionDeclaration = {
  name: 'addExpense',
  description:
    'מוסיף רשומת הוצאה חדשה. השתמש כאשר המשתמש אומר "שילמנו", "הוסף הוצאה", "יצאו כספים".',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      amount: { type: SchemaType.NUMBER, description: 'סכום ההוצאה בש"ח (חובה)' },
      category: { type: SchemaType.STRING, description: 'קטגוריה (למשל: שכירות, ציוד, שיווק)' },
      date: { type: SchemaType.STRING, description: 'תאריך בפורמט YYYY-MM-DD (ברירת מחדל: היום)' },
      notes: { type: SchemaType.STRING, description: 'הערות נוספות' },
    },
    required: ['amount'],
  },
}

export async function addExpense(
  args: { amount?: number; category?: string; date?: string; notes?: string },
  createdBy?: string
): Promise<Record<string, unknown>> {
  if (!args.amount || args.amount <= 0) {
    return { pending: false, error: 'סכום לא תקין.' }
  }
  const date = args.date || new Date().toISOString().split('T')[0]
  const category = args.category || 'כללי'

  return {
    pending: true,
    action_type: 'addExpense',
    action_params: { amount: args.amount, category, date, notes: args.notes || '', created_by: createdBy },
    confirmation_message:
      `האם להוסיף הוצאה של ₪${args.amount.toLocaleString('he-IL')} בקטגוריה "${category}" לתאריך ${date}?`,
  }
}

export async function executeAddExpense(params: {
  amount: number; category: string; date: string; notes?: string; created_by?: string
}): Promise<Record<string, unknown>> {
  const { error } = await db.from('expenses').insert({
    amount: params.amount,
    category: params.category,
    date: params.date,
    notes: params.notes || null,
    created_by: params.created_by || null,
  })
  if (error) return { success: false, error: error.message }
  return { success: true, message: `הוצאה של ₪${params.amount.toLocaleString('he-IL')} נוספה בהצלחה.` }
}
