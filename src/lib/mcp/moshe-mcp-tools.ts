import 'server-only'

import { z } from 'zod'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const db = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface MosheMcpToolSpec {
  name: string
  titleHebrew: string
  category: 'projects' | 'payments' | 'buyers' | 'partners' | 'loans' | 'workers' | 'calendar' | 'finance'
  description: string
  schema: z.ZodObject<any>
  execute: (args: any) => Promise<any>
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function resolveProject(query?: string) {
  if (!query || !query.trim()) return null
  const clean = query.trim()
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean)

  if (isUuid) {
    const { data } = await db.from('moshe_projects').select('*').eq('id', clean).maybeSingle()
    return data
  }

  const { data } = await db.from('moshe_projects').select('*').ilike('name', `%${clean}%`).limit(1)
  return data && data.length > 0 ? data[0] : null
}

// ── Tool Definitions ─────────────────────────────────────────────────────────

export const MOSHE_MCP_TOOLS: MosheMcpToolSpec[] = [
  // 1. רשימת פרויקטים
  {
    name: 'moshe_list_projects',
    titleHebrew: 'רשימת פרויקטי נדל״ן',
    category: 'projects',
    description: 'מחזיר רשימת פרויקטים של משה פרוש בפורטל, כולל סטטוס (פעיל/בהמתנה/סגור), כתובת, עלות פרויקט כוללת ותאריך התחלה.',
    schema: z.object({
      status: z.enum(['active', 'pending', 'closed', 'all']).optional().default('active').describe('סינון לפי סטטוס: active (פעילים), pending (בהמתנה), closed (סגורים), all (הכל)'),
    }),
    execute: async ({ status }) => {
      let q = db.from('moshe_projects').select('id, name, address, contact_name, contact_phone, total_project_cost, status, start_date, created_at').order('created_at', { ascending: false })
      if (status && status !== 'all') {
        q = q.eq('status', status)
      }
      const { data, error } = await q
      if (error) return { error: `שגיאה בשליפת פרויקטים: ${error.message}` }

      return {
        count: (data || []).length,
        filter: status || 'active',
        projects: (data || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          address: p.address || '',
          contact_name: p.contact_name || '',
          contact_phone: p.contact_phone || '',
          total_project_cost: p.total_project_cost || 0,
          status: p.status,
          start_date: p.start_date || '',
        })),
      }
    },
  },

  // 2. מאזן פיננסי ו-KPIs של פרויקט
  {
    name: 'moshe_get_project_balance',
    titleHebrew: 'מאזן כספי ו-KPIs של פרויקט',
    category: 'projects',
    description: 'מחזיר תמונת מצב כספית מלאה לפרויקט: מאזן אמיתי, מאזן צפוי, כסף בקופה, סה"כ שולם בפועל, לוח תשלומים, הכנסות מקונים, הלוואות ושותפים.',
    schema: z.object({
      project: z.string().describe('שם הפרויקט או מזהה UUID שלו'),
    }),
    execute: async ({ project }) => {
      const proj = await resolveProject(project)
      if (!proj) return { error: `פרויקט "${project}" לא נמצא במערכת` }

      const [
        { data: projPayments },
        { data: buyerPayments },
        { data: transactions },
        { data: partnerTransactions },
        { data: loans },
        { data: loanPayments },
        { data: neighborPayments },
        { data: loanReceipts },
      ] = await Promise.all([
        db.from('moshe_project_payments').select('amount, is_paid').eq('project_id', proj.id),
        db.from('moshe_buyer_payments').select('amount, is_received').eq('project_id', proj.id),
        db.from('moshe_transactions').select('amount, type').eq('project_id', proj.id),
        db.from('moshe_partner_transactions').select('amount, type').eq('project_id', proj.id),
        db.from('moshe_loans').select('id, total_amount').eq('project_id', proj.id),
        db.from('moshe_loan_payments').select('loan_id, amount, is_paid, is_interest').eq('project_id', proj.id),
        db.from('moshe_neighbor_payments').select('amount, is_paid').eq('project_id', proj.id),
        db.from('moshe_loan_receipts').select('amount, is_received').eq('project_id', proj.id),
      ])

      const pp = projPayments || []
      const bp = buyerPayments || []
      const tx = transactions || []
      const ptx = partnerTransactions || []
      const lo = loans || []
      const lp = loanPayments || []
      const np = neighborPayments || []
      const lr = loanReceipts || []

      const neighborPaid = np.filter((x: any) => x.is_paid).reduce((s: number, x: any) => s + Number(x.amount), 0)
      const neighborScheduled = np.reduce((s: number, x: any) => s + Number(x.amount), 0)

      const totalPaid = pp.filter((x: any) => x.is_paid).reduce((s: number, x: any) => s + Number(x.amount), 0) + neighborPaid
      const totalScheduled = pp.reduce((s: number, x: any) => s + Number(x.amount), 0) + neighborScheduled

      const totalReceived = bp.filter((x: any) => x.is_received).reduce((s: number, x: any) => s + Number(x.amount), 0)
      const totalExpected = bp.reduce((s: number, x: any) => s + Number(x.amount), 0)

      const txIncome = tx.filter((x: any) => x.type === 'income').reduce((s: number, x: any) => s + Number(x.amount), 0)
      const txExpense = tx.filter((x: any) => x.type === 'expense').reduce((s: number, x: any) => s + Number(x.amount), 0)

      const totalLoans = lo.reduce((s: number, l: any) => s + Number(l.total_amount), 0)
      const loanPaidBack = lp.filter((p: any) => p.is_paid && !p.is_interest).reduce((s: number, p: any) => s + Number(p.amount), 0)
      const loanInterestPaid = lp.filter((p: any) => p.is_paid && p.is_interest).reduce((s: number, p: any) => s + Number(p.amount), 0)
      const loanReceivedAmt = lr.filter((r: any) => r.is_received).reduce((s: number, r: any) => s + Number(r.amount), 0)

      const totalInvested = ptx.filter((x: any) => x.type === 'investment').reduce((s: number, x: any) => s + Number(x.amount), 0)
      const totalWithdrawn = ptx.filter((x: any) => x.type === 'withdrawal').reduce((s: number, x: any) => s + Number(x.amount), 0)
      const ptxExpense = ptx.filter((x: any) => x.type === 'expense').reduce((s: number, x: any) => s + Number(x.amount), 0)

      const realBalance = (totalReceived + txIncome + totalInvested + loanReceivedAmt) - (totalPaid + txExpense + ptxExpense + totalWithdrawn + loanPaidBack)
      const expectedBalance = (totalExpected + txIncome + totalInvested + loanReceivedAmt) - (totalScheduled + txExpense + ptxExpense + totalWithdrawn + loanPaidBack)

      return {
        project: { id: proj.id, name: proj.name, status: proj.status },
        kpis: {
          realBalance,
          expectedBalance,
          cashInFund: realBalance,
          totalPaid,
          totalScheduled,
          remainingPayments: totalScheduled - totalPaid,
          totalReceived,
          totalExpected,
          remainingIncome: totalExpected - totalReceived,
          totalLoans,
          loanReceivedAmt,
          loanPaidBack,
          loanInterestPaid,
          totalInvested,
          totalWithdrawn,
        },
      }
    },
  },

  // 3. פירוט לוח תשלומים ותנועות שבוצעו
  {
    name: 'moshe_get_project_payments',
    titleHebrew: 'פירוט לוח תשלומים ותנועות בפועל',
    category: 'payments',
    description: 'מחזיר פירוט מפוצל של: 1) לוח התשלומים שנקבע (עתידיים), 2) התשלומים שבוצעו בפועל כרשימת תנועות, וסיכומי סכומים.',
    schema: z.object({
      project: z.string().describe('שם הפרויקט או מזהה UUID שלו'),
    }),
    execute: async ({ project }) => {
      const proj = await resolveProject(project)
      if (!proj) return { error: `פרויקט "${project}" לא נמצא במערכת` }

      const { data, error } = await db
        .from('moshe_project_payments')
        .select('*')
        .eq('project_id', proj.id)
        .order('due_date', { ascending: true })

      if (error) return { error: `שגיאה בשליפת תשלומים: ${error.message}` }
      const all = data || []

      const scheduled = all
        .filter((p: any) => !p.is_paid)
        .map((p: any) => ({
          id: p.id,
          amount: p.amount,
          due_date: p.due_date,
          notes: p.notes || '',
        }))

      const executed = all
        .filter((p: any) => p.is_paid)
        .sort((a: any, b: any) => new Date(b.paid_at || b.created_at).getTime() - new Date(a.paid_at || a.created_at).getTime())
        .map((p: any) => ({
          id: p.id,
          amount: p.amount,
          paid_at: p.paid_at,
          due_date: p.due_date,
          notes: p.notes || '',
        }))

      const totalPaid = executed.reduce((s, p) => s + Number(p.amount), 0)
      const totalScheduled = all.reduce((s, p) => s + Number(p.amount), 0)

      return {
        project: { id: proj.id, name: proj.name },
        summary: {
          totalPaid,
          totalScheduled,
          remaining: totalScheduled - totalPaid,
          scheduledCount: scheduled.length,
          executedCount: executed.length,
        },
        scheduled_payments: scheduled,
        executed_payments: executed,
      }
    },
  },

  // 4. הוספת תשלום (ללוח תשלומים או תשלום שבוצע)
  {
    name: 'moshe_add_project_payment',
    titleHebrew: 'הוספת תשלום לפרויקט (ללוח או שבוצע)',
    category: 'payments',
    description: 'מוסיף תשלום חדש לפרויקט. ניתן לבחור האם להוסיף ללוח התשלומים המתוכנן (is_paid=false) או לרשום כתשלום שבוצע בפועל (is_paid=true).',
    schema: z.object({
      project: z.string().describe('שם הפרויקט או מזהה UUID שלו'),
      amount: z.number().positive().describe('סכום התשלום בש"ח'),
      is_paid: z.boolean().default(false).describe('האם התשלום בוצע בפועל (true) או מתוכנן ללוח (false)'),
      due_date: z.string().optional().describe('תאריך יעד לתשלום בפורמט YYYY-MM-DD'),
      paid_at: z.string().optional().describe('תאריך ביצוע התשלום בפורמט YYYY-MM-DD (אם בוצע בפועל)'),
      notes: z.string().optional().describe('הערות / תיאור התשלום / אסמכתא'),
    }),
    execute: async ({ project, amount, is_paid, due_date, paid_at, notes }) => {
      const proj = await resolveProject(project)
      if (!proj) return { error: `פרויקט "${project}" לא נמצא במערכת` }

      const actualPaid = !!is_paid
      const actualPaidAt = actualPaid ? (paid_at ? new Date(paid_at).toISOString() : new Date().toISOString()) : null

      const { data, error } = await db
        .from('moshe_project_payments')
        .insert({
          project_id: proj.id,
          amount,
          due_date: due_date || null,
          paid_at: actualPaidAt,
          is_paid: actualPaid,
          notes: notes || null,
        })
        .select('id, amount, is_paid, due_date, paid_at, notes')
        .single()

      if (error) return { error: `שגיאה בהוספת תשלום: ${error.message}` }
      return {
        success: true,
        message: actualPaid ? 'תשלום שבוצע בפועל נרשם בהצלחה' : 'תשלום נוסף ללוח התשלומים',
        payment: data,
      }
    },
  },

  // 5. רשימת קונים ותשלומים
  {
    name: 'moshe_list_buyers',
    titleHebrew: 'רשימת קונים ותשלומי קונים',
    category: 'buyers',
    description: 'מחזיר את רשימת הקונים בפרויקט, תיאור הדירה/יחידה, סך העסקה, ותשלומים שהתקבלו / צפויים.',
    schema: z.object({
      project: z.string().describe('שם הפרויקט או מזהה UUID שלו'),
    }),
    execute: async ({ project }) => {
      const proj = await resolveProject(project)
      if (!proj) return { error: `פרויקט "${project}" לא נמצא במערכת` }

      const [{ data: buyers }, { data: buyerPayments }] = await Promise.all([
        db.from('moshe_buyers').select('*').eq('project_id', proj.id).order('name'),
        db.from('moshe_buyer_payments').select('*').eq('project_id', proj.id),
      ])

      const bp = buyerPayments || []
      const list = (buyers || []).map((b: any) => {
        const p = bp.filter((x: any) => x.buyer_id === b.id)
        const received = p.filter((x: any) => x.is_received).reduce((s: number, x: any) => s + Number(x.amount), 0)
        const total = Number(b.total_amount) || p.reduce((s: number, x: any) => s + Number(x.amount), 0)
        return {
          id: b.id,
          name: b.name,
          phone: b.phone || '',
          email: b.email || '',
          unit_description: b.unit_description || '',
          contract_date: b.contract_date || '',
          total_amount: total,
          received_amount: received,
          balance_remaining: total - received,
          payments_count: p.length,
        }
      })

      return {
        project: { id: proj.id, name: proj.name },
        total_buyers: list.length,
        buyers: list,
      }
    },
  },

  // 6. רשימת שותפים והשקעות
  {
    name: 'moshe_list_partners',
    titleHebrew: 'שותפים, השקעות ומשיכות',
    category: 'partners',
    description: 'מחזיר רשימת שותפים בפרויקט, סך השקעות, משיכות כספים, הוצאות ויתרה נטו לכל שותף.',
    schema: z.object({
      project: z.string().describe('שם הפרויקט או מזהה UUID שלו'),
    }),
    execute: async ({ project }) => {
      const proj = await resolveProject(project)
      if (!proj) return { error: `פרויקט "${project}" לא נמצא במערכת` }

      const [{ data: partners }, { data: transactions }] = await Promise.all([
        db.from('moshe_partners').select('*').eq('project_id', proj.id).order('name'),
        db.from('moshe_partner_transactions').select('*').eq('project_id', proj.id),
      ])

      const tx = transactions || []
      const list = (partners || []).map((part: any) => {
        const ptx = tx.filter((t: any) => t.partner_id === part.id)
        const invested = ptx.filter((t: any) => t.type === 'investment').reduce((s: number, t: any) => s + Number(t.amount), 0)
        const withdrawn = ptx.filter((t: any) => t.type === 'withdrawal').reduce((s: number, t: any) => s + Number(t.amount), 0)
        const expense = ptx.filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + Number(t.amount), 0)
        return {
          id: part.id,
          name: part.name,
          phone: part.phone || '',
          total_invested: invested,
          total_withdrawn: withdrawn,
          total_expense: expense,
          net_balance: invested - withdrawn - expense,
        }
      })

      return {
        project: { id: proj.id, name: proj.name },
        partners_count: list.length,
        partners: list,
      }
    },
  },

  // 7. הלוואות ופירעונות
  {
    name: 'moshe_list_loans',
    titleHebrew: 'הלוואות, תקבולים ופירעונות',
    category: 'loans',
    description: 'מחזיר את רשימת ההלוואות בפרויקט, שמות המלווים, סך ההלוואה, סכום שנמשך, סכום שנפרע (קרן וריבית) ויתרת חוב.',
    schema: z.object({
      project: z.string().describe('שם הפרויקט או מזהה UUID שלו'),
    }),
    execute: async ({ project }) => {
      const proj = await resolveProject(project)
      if (!proj) return { error: `פרויקט "${project}" לא נמצא במערכת` }

      const [{ data: loans }, { data: payments }, { data: receipts }] = await Promise.all([
        db.from('moshe_loans').select('*').eq('project_id', proj.id),
        db.from('moshe_loan_payments').select('*').eq('project_id', proj.id),
        db.from('moshe_loan_receipts').select('*').eq('project_id', proj.id),
      ])

      const lp = payments || []
      const lr = receipts || []

      const list = (loans || []).map((l: any) => {
        const thisPayments = lp.filter((p: any) => p.loan_id === l.id && p.is_paid)
        const principalPaid = thisPayments.filter((p: any) => !p.is_interest).reduce((s: number, p: any) => s + Number(p.amount), 0)
        const interestPaid = thisPayments.filter((p: any) => p.is_interest).reduce((s: number, p: any) => s + Number(p.amount), 0)
        const received = lr.filter((r: any) => r.loan_id === l.id && r.is_received).reduce((s: number, r: any) => s + Number(r.amount), 0)

        return {
          id: l.id,
          lender_name: l.lender_name,
          total_credit_facility: Number(l.total_amount),
          received_amount: received,
          principal_paid_back: principalPaid,
          interest_paid: interestPaid,
          current_debt_balance: received - principalPaid,
        }
      })

      return {
        project: { id: proj.id, name: proj.name },
        loans_count: list.length,
        loans: list,
      }
    },
  },

  // 8. שכנים ופיצויים
  {
    name: 'moshe_list_neighbors',
    titleHebrew: 'שכנים, הסכמים ותשלומים',
    category: 'projects',
    description: 'מחזיר את רשימת השכנים בפרויקט, סכומי ההסכמים, תשלומים ששולמו ויתרה לתשלום.',
    schema: z.object({
      project: z.string().describe('שם הפרויקט או מזהה UUID שלו'),
    }),
    execute: async ({ project }) => {
      const proj = await resolveProject(project)
      if (!proj) return { error: `פרויקט "${project}" לא נמצא במערכת` }

      const [{ data: neighbors }, { data: payments }] = await Promise.all([
        db.from('moshe_neighbors').select('*').eq('project_id', proj.id),
        db.from('moshe_neighbor_payments').select('*').eq('project_id', proj.id),
      ])

      const np = payments || []
      const list = (neighbors || []).map((n: any) => {
        const myPayments = np.filter((p: any) => p.neighbor_id === n.id)
        const paid = myPayments.filter((p: any) => p.is_paid).reduce((s: number, p: any) => s + Number(p.amount), 0)
        const total = Number(n.total_amount) || myPayments.reduce((s: number, p: any) => s + Number(p.amount), 0)
        return {
          id: n.id,
          name: n.name,
          phone: n.phone || '',
          total_agreed: total,
          paid_amount: paid,
          remaining: total - paid,
          notes: n.notes || '',
        }
      })

      return {
        project: { id: proj.id, name: proj.name },
        neighbors_count: list.length,
        neighbors: list,
      }
    },
  },

  // 9. יומן אירועים ותשלומים קרובים
  {
    name: 'moshe_get_calendar_events',
    titleHebrew: 'יומן אירועים ותשלומים קרובים',
    category: 'calendar',
    description: 'מחזיר פגישות, אירועים ויעדי תשלום קרובים או באיחור בכל הפרויקטים של משה.',
    schema: z.object({
      daysAhead: z.number().optional().default(30).describe('כמה ימים קדימה לבדוק (ברירת מחדל: 30)'),
    }),
    execute: async ({ daysAhead }) => {
      const now = new Date()
      const future = new Date(now.getTime() + (daysAhead || 30) * 86400000)

      const [{ data: events }, { data: overduePayments }, { data: upcomingPayments }, { data: projects }] =
        await Promise.all([
          db.from('moshe_calendar_events').select('*').order('start_time', { ascending: true }).limit(50),
          db.from('moshe_project_payments').select('id, project_id, amount, due_date, notes').eq('is_paid', false).lt('due_date', now.toISOString().slice(0, 10)),
          db.from('moshe_project_payments').select('id, project_id, amount, due_date, notes').eq('is_paid', false).gte('due_date', now.toISOString().slice(0, 10)).lte('due_date', future.toISOString().slice(0, 10)),
          db.from('moshe_projects').select('id, name'),
        ])

      const projMap = new Map((projects || []).map((p: any) => [p.id, p.name]))

      return {
        checked_window_days: daysAhead || 30,
        calendar_events: (events || []).map((e: any) => ({
          id: e.id,
          title: e.title,
          start: e.start_time,
          end: e.end_time,
          type: e.type,
          notes: e.notes || '',
        })),
        overdue_payments: (overduePayments || []).map((p: any) => ({
          id: p.id,
          project_name: projMap.get(p.project_id) || 'פרויקט',
          amount: p.amount,
          due_date: p.due_date,
          notes: p.notes || '',
        })),
        upcoming_payments: (upcomingPayments || []).map((p: any) => ({
          id: p.id,
          project_name: projMap.get(p.project_id) || 'פרויקט',
          amount: p.amount,
          due_date: p.due_date,
          notes: p.notes || '',
        })),
      }
    },
  },

  // 10. עובדים ומשימות
  {
    name: 'moshe_list_workers',
    titleHebrew: 'עובדי אתר ומשימות פתוחות',
    category: 'workers',
    description: 'מחזיר את רשימת העובדים בפורטל, תפקידיהם, תעריף יומי, ומשימות שהוקצו להם.',
    schema: z.object({
      onlyActive: z.boolean().optional().default(true).describe('האם להציג רק עובדים פעילים'),
    }),
    execute: async ({ onlyActive }) => {
      let q = db.from('moshe_workers').select('*').order('name')
      if (onlyActive) q = q.eq('is_active', true)

      const [{ data: workers }, { data: tasks }] = await Promise.all([
        q,
        db.from('moshe_worker_tasks').select('*').eq('status', 'pending'),
      ])

      const workerTasks = tasks || []
      const list = (workers || []).map((w: any) => {
        const myTasks = workerTasks.filter((t: any) => t.worker_id === w.id)
        return {
          id: w.id,
          name: w.name,
          role: w.role || '',
          phone: w.phone || '',
          daily_rate: w.daily_rate || 0,
          is_active: w.is_active,
          pending_tasks_count: myTasks.length,
          pending_tasks: myTasks.map((t: any) => ({
            id: t.id,
            description: t.description,
            due_date: t.due_date || '',
          })),
        }
      })

      return {
        workers_count: list.length,
        workers: list,
      }
    },
  },

  // 11. מאזן כספי כללי של כל הפורטל
  {
    name: 'moshe_get_finance_summary',
    titleHebrew: 'מאזן כספי כללי (כל הפרויקטים)',
    category: 'finance',
    description: 'מחזיר סקירה פיננסית כוללת של כל הפרויקטים הפעילים של משה: סה"כ כסף בקופה, סה"כ שולם, סה"כ לוח תשלומים, וסה"כ הכנסות.',
    schema: z.object({}),
    execute: async () => {
      const { data: projects } = await db.from('moshe_projects').select('id, name, status').neq('status', 'closed')
      const projs = projects || []

      const [
        { data: projPayments },
        { data: buyerPayments },
        { data: transactions },
        { data: partnerTransactions },
        { data: loanReceipts },
        { data: loanPayments },
      ] = await Promise.all([
        db.from('moshe_project_payments').select('project_id, amount, is_paid'),
        db.from('moshe_buyer_payments').select('project_id, amount, is_received'),
        db.from('moshe_transactions').select('project_id, amount, type'),
        db.from('moshe_partner_transactions').select('project_id, amount, type'),
        db.from('moshe_loan_receipts').select('project_id, amount, is_received'),
        db.from('moshe_loan_payments').select('project_id, amount, is_paid, is_interest'),
      ])

      const pp = projPayments || []
      const bp = buyerPayments || []
      const tx = transactions || []
      const ptx = partnerTransactions || []
      const lr = loanReceipts || []
      const lp = loanPayments || []

      const totalPaidAll = pp.filter((x: any) => x.is_paid).reduce((s: number, x: any) => s + Number(x.amount), 0)
      const totalScheduledAll = pp.reduce((s: number, x: any) => s + Number(x.amount), 0)
      const totalReceivedAll = bp.filter((x: any) => x.is_received).reduce((s: number, x: any) => s + Number(x.amount), 0)
      const totalExpectedAll = bp.reduce((s: number, x: any) => s + Number(x.amount), 0)

      const txIncome = tx.filter((x: any) => x.type === 'income').reduce((s: number, x: any) => s + Number(x.amount), 0)
      const txExpense = tx.filter((x: any) => x.type === 'expense').reduce((s: number, x: any) => s + Number(x.amount), 0)

      const totalInvested = ptx.filter((x: any) => x.type === 'investment').reduce((s: number, x: any) => s + Number(x.amount), 0)
      const totalWithdrawn = ptx.filter((x: any) => x.type === 'withdrawal').reduce((s: number, x: any) => s + Number(x.amount), 0)

      const loanReceived = lr.filter((r: any) => r.is_received).reduce((s: number, r: any) => s + Number(r.amount), 0)
      const loanPaid = lp.filter((p: any) => p.is_paid && !p.is_interest).reduce((s: number, p: any) => s + Number(p.amount), 0)

      const totalCashInFund = (totalReceivedAll + txIncome + totalInvested + loanReceived) - (totalPaidAll + txExpense + totalWithdrawn + loanPaid)

      return {
        active_projects_count: projs.length,
        macro_totals: {
          totalCashInFund,
          totalPaidAll,
          totalScheduledAll,
          remainingPaymentsToMake: totalScheduledAll - totalPaidAll,
          totalReceivedFromBuyers: totalReceivedAll,
          totalExpectedFromBuyers: totalExpectedAll,
          remainingIncomeToCollect: totalExpectedAll - totalReceivedAll,
        },
      }
    },
  },
]

export function getMosheMcpToolsCatalog() {
  return MOSHE_MCP_TOOLS.map((t) => ({
    name: t.name,
    titleHebrew: t.titleHebrew,
    category: t.category,
    description: t.description,
  }))
}
