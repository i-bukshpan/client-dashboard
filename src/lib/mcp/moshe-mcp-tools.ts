import 'server-only'

import { z } from 'zod'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { buildMosheOrganizedBackup } from '@/lib/moshe/backup-builder'

const db = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type MosheMcpCategory =
  | 'projects'
  | 'payments'
  | 'buyers'
  | 'partners'
  | 'loans'
  | 'neighbors'
  | 'workers'
  | 'calendar'
  | 'finance'
  | 'audit'
  | 'search'

export interface MosheMcpToolSpec {
  name: string
  titleHebrew: string
  category: MosheMcpCategory
  description: string
  schema: z.ZodObject<any>
  execute: (args: any) => Promise<any>
}

// ── Helpers & Resolvers (Auto-resolve by Name or UUID for WhatsApp Bots) ────────

function isUuid(str?: string): boolean {
  if (!str) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim())
}

async function resolveProject(query?: string) {
  if (!query || !query.trim()) return null
  const clean = query.trim()

  if (isUuid(clean)) {
    const { data } = await db.from('moshe_projects').select('*').eq('id', clean).maybeSingle()
    return data
  }

  const { data } = await db.from('moshe_projects').select('*').ilike('name', `%${clean}%`).limit(1)
  return data && data.length > 0 ? data[0] : null
}

async function resolveBuyer(projectId: string, query?: string) {
  if (!query || !query.trim()) return null
  const clean = query.trim()

  if (isUuid(clean)) {
    const { data } = await db
      .from('moshe_buyers')
      .select('*')
      .eq('id', clean)
      .eq('project_id', projectId)
      .maybeSingle()
    return data
  }

  const { data } = await db
    .from('moshe_buyers')
    .select('*')
    .eq('project_id', projectId)
    .ilike('name', `%${clean}%`)
    .limit(1)
  return data && data.length > 0 ? data[0] : null
}

async function resolvePartner(projectId: string, query?: string) {
  if (!query || !query.trim()) return null
  const clean = query.trim()

  if (isUuid(clean)) {
    const { data } = await db
      .from('moshe_partners')
      .select('*')
      .eq('id', clean)
      .eq('project_id', projectId)
      .maybeSingle()
    return data
  }

  const { data } = await db
    .from('moshe_partners')
    .select('*')
    .eq('project_id', projectId)
    .ilike('name', `%${clean}%`)
    .limit(1)
  return data && data.length > 0 ? data[0] : null
}

async function resolveLoan(projectId: string, query?: string) {
  if (!query || !query.trim()) return null
  const clean = query.trim()

  if (isUuid(clean)) {
    const { data } = await db
      .from('moshe_loans')
      .select('*')
      .eq('id', clean)
      .eq('project_id', projectId)
      .maybeSingle()
    return data
  }

  const { data } = await db
    .from('moshe_loans')
    .select('*')
    .eq('project_id', projectId)
    .ilike('lender', `%${clean}%`)
    .limit(1)
  return data && data.length > 0 ? data[0] : null
}

async function resolveNeighbor(projectId: string, query?: string) {
  if (!query || !query.trim()) return null
  const clean = query.trim()

  if (isUuid(clean)) {
    const { data } = await db
      .from('moshe_neighbors')
      .select('*')
      .eq('id', clean)
      .eq('project_id', projectId)
      .maybeSingle()
    return data
  }

  const { data } = await db
    .from('moshe_neighbors')
    .select('*')
    .eq('project_id', projectId)
    .ilike('name', `%${clean}%`)
    .limit(1)
  return data && data.length > 0 ? data[0] : null
}

async function resolveWorker(query?: string) {
  if (!query || !query.trim()) return null
  const clean = query.trim()

  if (isUuid(clean)) {
    const { data } = await db.from('moshe_workers').select('*').eq('id', clean).maybeSingle()
    return data
  }

  const { data } = await db.from('moshe_workers').select('*').ilike('name', `%${clean}%`).limit(1)
  return data && data.length > 0 ? data[0] : null
}

async function writeMosheAudit(
  projectId: string | null,
  actionType: 'create' | 'update' | 'delete' | 'restore',
  entityType: string,
  description: string,
  entityId?: string,
  previousSnapshot?: Record<string, unknown> | null,
  newSnapshot?: Record<string, unknown> | null
) {
  try {
    const row: Record<string, unknown> = {
      project_id: projectId,
      user_email: 'whatsapp-bot@mcp',
      user_name: 'בוט וואטסאפ (MCP)',
      action_type: actionType,
      entity_type: entityType,
      entity_id: entityId ?? null,
      description: `[בוט וואטסאפ] ${description}`,
      previous_snapshot: previousSnapshot ?? null,
      new_snapshot: newSnapshot ?? null,
      undo_snapshot: previousSnapshot ?? null,
    }
    await db.from('moshe_audit_log').insert(row)
  } catch (e) {
    console.error('[writeMosheAudit error]', e)
  }
}

function safeRevalidate(projectId?: string) {
  try {
    if (projectId) revalidatePath(`/moshe/projects/${projectId}`)
    revalidatePath('/moshe')
    revalidatePath('/moshe/projects')
    revalidatePath('/moshe/finance')
    revalidatePath('/moshe/calendar')
    revalidatePath('/moshe/workers')
    revalidatePath('/moshe/activity')
  } catch {
    // Ignore in non-rendering context
  }
}

// ── Complete Moshe Portal MCP Tools Suite ──────────────────────────────────

export const MOSHE_MCP_TOOLS: MosheMcpToolSpec[] = [
  // =========================================================================
  // 1. PROJECTS (פרויקטים)
  // =========================================================================

  {
    name: 'moshe_list_projects',
    titleHebrew: 'רשימת פרויקטי נדל״ן',
    category: 'projects',
    description:
      'מחזיר רשימת פרויקטים של משה פרוש בפורטל, כולל סטטוס (פעיל/בהמתנה/סגור), כתובת, עלות פרויקט כוללת, איש קשר ותאריך התחלה.',
    schema: z.object({
      status: z
        .enum(['active', 'pending', 'closed', 'all'])
        .optional()
        .default('active')
        .describe('סינון לפי סטטוס: active (פעילים), pending (בהמתנה), closed (סגורים), all (הכל)'),
    }),
    execute: async ({ status }) => {
      let q = db
        .from('moshe_projects')
        .select(
          'id, name, address, contact_name, contact_phone, total_project_cost, status, start_date, notes, created_at'
        )
        .order('created_at', { ascending: false })
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
          notes: p.notes || '',
        })),
      }
    },
  },

  {
    name: 'moshe_get_project_details',
    titleHebrew: 'פרטים מלאים על פרויקט',
    category: 'projects',
    description:
      'מחזיר את כל המידע על פרויקט נדל״ן: כתובת, אנשי קשר, עלות פרויקט כוללת, קישור לתיקיית דרייב, וכמויות קונים, שותפים, הלוואות ומסמכים.',
    schema: z.object({
      project: z.string().describe('שם הפרויקט (למשל: "הרצל", "רמת אשכול") או מזהה UUID שלו'),
    }),
    execute: async ({ project }) => {
      const proj = await resolveProject(project)
      if (!proj) return { error: `פרויקט "${project}" לא נמצא במערכת` }

      const [
        { count: buyersCount },
        { count: partnersCount },
        { count: loansCount },
        { count: neighborsCount },
        { count: documentsCount },
      ] = await Promise.all([
        db.from('moshe_buyers').select('*', { count: 'exact', head: true }).eq('project_id', proj.id),
        db.from('moshe_partners').select('*', { count: 'exact', head: true }).eq('project_id', proj.id),
        db.from('moshe_loans').select('*', { count: 'exact', head: true }).eq('project_id', proj.id),
        db.from('moshe_neighbors').select('*', { count: 'exact', head: true }).eq('project_id', proj.id),
        db.from('moshe_project_documents').select('*', { count: 'exact', head: true }).eq('project_id', proj.id),
      ])

      return {
        id: proj.id,
        name: proj.name,
        address: proj.address || '',
        status: proj.status,
        contact_name: proj.contact_name || '',
        contact_phone: proj.contact_phone || '',
        total_project_cost: proj.total_project_cost || 0,
        start_date: proj.start_date || '',
        notes: proj.notes || '',
        drive_folder_url: proj.drive_folder_url || '',
        counts: {
          buyers: buyersCount || 0,
          partners: partnersCount || 0,
          loans: loansCount || 0,
          neighbors: neighborsCount || 0,
          documents: documentsCount || 0,
        },
      }
    },
  },

  {
    name: 'moshe_create_project',
    titleHebrew: 'יצירת פרויקט נדל״ן חדש',
    category: 'projects',
    description:
      'יוצר פרויקט חדש בפורטל של משה. מתאים ליצירה ישירה מתוך שיחת וואטסאפ.',
    schema: z.object({
      name: z.string().min(1, 'שם הפרויקט נדרש').describe('שם הפרויקט (למשל: "רחוב יפו 45 ירושלים")'),
      address: z.string().optional().describe('כתובת הפרויקט'),
      contact_name: z.string().optional().describe('שם איש קשר ראשי'),
      contact_phone: z.string().optional().describe('טלפון איש קשר'),
      total_project_cost: z.number().optional().describe('עלות פרויקט כוללת משוערת בש"ח'),
      start_date: z.string().optional().describe('תאריך התחלה YYYY-MM-DD'),
      notes: z.string().optional().describe('הערות כלליות על הפרויקט'),
    }),
    execute: async ({ name, address, contact_name, contact_phone, total_project_cost, start_date, notes }) => {
      const { data, error } = await db
        .from('moshe_projects')
        .insert({
          name: name.trim(),
          address: address?.trim() || null,
          contact_name: contact_name?.trim() || null,
          contact_phone: contact_phone?.trim() || null,
          total_project_cost: total_project_cost || null,
          start_date: start_date || null,
          notes: notes?.trim() || null,
          status: 'active',
        })
        .select('*')
        .single()

      if (error) return { error: `שגיאה ביצירת פרויקט: ${error.message}` }

      await writeMosheAudit(
        data.id,
        'create',
        'project',
        `פרויקט חדש נוצר: ${name}`,
        data.id,
        null,
        data
      )
      safeRevalidate(data.id)

      return {
        success: true,
        message: `פרויקט "${name}" נוצר בהצלחה`,
        project: data,
      }
    },
  },

  {
    name: 'moshe_update_project',
    titleHebrew: 'עדכון פרטי פרויקט',
    category: 'projects',
    description:
      'מעדכן פרטי פרויקט קיים: שם, כתובת, סטטוס (active/pending/closed), איש קשר, טלפון, הערות ועלות.',
    schema: z.object({
      project: z.string().describe('שם הפרויקט או מזהה UUID שלו'),
      name: z.string().optional().describe('שם מעודכן לפרויקט'),
      address: z.string().optional().describe('כתובת מעודכנת'),
      status: z.enum(['active', 'pending', 'closed']).optional().describe('סטטוס הפרויקט'),
      contact_name: z.string().optional().describe('שם איש קשר'),
      contact_phone: z.string().optional().describe('טלפון איש קשר'),
      total_project_cost: z.number().optional().describe('עלות פרויקט כוללת בש"ח'),
      notes: z.string().optional().describe('הערות'),
    }),
    execute: async ({ project, name, address, status, contact_name, contact_phone, total_project_cost, notes }) => {
      const proj = await resolveProject(project)
      if (!proj) return { error: `פרויקט "${project}" לא נמצא במערכת` }

      const updates: Record<string, any> = {}
      if (name !== undefined) updates.name = name.trim()
      if (address !== undefined) updates.address = address.trim() || null
      if (status !== undefined) updates.status = status
      if (contact_name !== undefined) updates.contact_name = contact_name.trim() || null
      if (contact_phone !== undefined) updates.contact_phone = contact_phone.trim() || null
      if (total_project_cost !== undefined) updates.total_project_cost = total_project_cost
      if (notes !== undefined) updates.notes = notes.trim() || null

      const { data, error } = await db
        .from('moshe_projects')
        .update(updates)
        .eq('id', proj.id)
        .select('*')
        .single()

      if (error) return { error: `שגיאה בעדכון פרויקט: ${error.message}` }

      await writeMosheAudit(
        proj.id,
        'update',
        'project',
        `פרויקט "${proj.name}" עודכן`,
        proj.id,
        proj,
        data
      )
      safeRevalidate(proj.id)

      return {
        success: true,
        message: `פרויקט "${data.name}" עודכן בהצלחה`,
        project: data,
      }
    },
  },

  {
    name: 'moshe_get_project_balance',
    titleHebrew: 'מאזן כספי ו-KPIs של פרויקט',
    category: 'projects',
    description:
      'מחזיר תמונת מצב כספית מלאה ומדויקת לפרויקט: מאזן אמיתי, מאזן צפוי, כסף בקופה, סה"כ שולם בפועל, סה"כ לוח תשלומים שנקבע, יתרה מדויקת (לוח פחות שולם), הכנסות מקונים, הלוואות ושותפים.',
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
        db.from('moshe_project_payments').select('amount, is_paid, payment_type').eq('project_id', proj.id),
        db.from('moshe_buyer_payments').select('amount, is_received, payment_type').eq('project_id', proj.id),
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

      // Neighbors
      const neighborPaid = np.filter((x: any) => x.is_paid).reduce((s: number, x: any) => s + Number(x.amount), 0)
      const neighborScheduled = np.reduce((s: number, x: any) => s + Number(x.amount), 0)

      // Project Payments decoupled: schedule payments vs actual movement payments
      const totalPaid =
        pp
          .filter((x: any) => x.payment_type === 'movement' || (!x.payment_type && x.is_paid))
          .reduce((s: number, x: any) => s + Number(x.amount), 0) + neighborPaid
      const totalScheduled =
        pp
          .filter((x: any) => x.payment_type === 'schedule' || (!x.payment_type && !x.is_paid))
          .reduce((s: number, x: any) => s + Number(x.amount), 0) + neighborScheduled

      // Buyers decoupled
      const totalReceived = bp
        .filter((x: any) => x.payment_type === 'movement' || (!x.payment_type && x.is_received))
        .reduce((s: number, x: any) => s + Number(x.amount), 0)
      const totalExpected = bp
        .filter((x: any) => x.payment_type === 'schedule' || (!x.payment_type && !x.is_received))
        .reduce((s: number, x: any) => s + Number(x.amount), 0)

      // General Transactions
      const txIncome = tx.filter((x: any) => x.type === 'income').reduce((s: number, x: any) => s + Number(x.amount), 0)
      const txExpense = tx.filter((x: any) => x.type === 'expense').reduce((s: number, x: any) => s + Number(x.amount), 0)

      // Loans
      const totalLoans = lo.reduce((s: number, l: any) => s + Number(l.total_amount), 0)
      const loanPaidBack = lp
        .filter((p: any) => p.is_paid && !p.is_interest)
        .reduce((s: number, p: any) => s + Number(p.amount), 0)
      const loanInterestPaid = lp
        .filter((p: any) => p.is_paid && p.is_interest)
        .reduce((s: number, p: any) => s + Number(p.amount), 0)
      const loanReceivedAmt = lr
        .filter((r: any) => r.is_received)
        .reduce((s: number, r: any) => s + Number(r.amount), 0)

      // Partners
      const totalInvested = ptx
        .filter((x: any) => x.type === 'investment')
        .reduce((s: number, x: any) => s + Number(x.amount), 0)
      const totalWithdrawn = ptx
        .filter((x: any) => x.type === 'withdrawal')
        .reduce((s: number, x: any) => s + Number(x.amount), 0)
      const ptxExpense = ptx
        .filter((x: any) => x.type === 'expense')
        .reduce((s: number, x: any) => s + Number(x.amount), 0)

      const realBalance =
        totalReceived + txIncome + totalInvested + loanReceivedAmt -
        (totalPaid + txExpense + ptxExpense + totalWithdrawn + loanPaidBack)
      const expectedBalance =
        totalExpected + txIncome + totalInvested + loanReceivedAmt -
        (totalScheduled + txExpense + ptxExpense + totalWithdrawn + loanPaidBack)

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

  // =========================================================================
  // 2. PROJECT PAYMENTS & MOVEMENTS (לוח תשלומים ותנועות שבוצעו)
  // =========================================================================

  {
    name: 'moshe_get_project_payments',
    titleHebrew: 'פירוט לוח תשלומים ותנועות בפועל',
    category: 'payments',
    description:
      'מחזיר פירוט מפוצל של הפרויקט לפי הארכיטקטורה המופרדת: 1) לוח התשלומים שנקבע (מועדים מתוכננים), 2) התשלומים שבוצעו בפועל כתנועות, וסיכומי סכומים עם היתרה המדויקת.',
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
        .filter((p: any) => p.payment_type === 'schedule' || (!p.payment_type && !p.is_paid))
        .map((p: any) => ({
          id: p.id,
          amount: Number(p.amount),
          due_date: p.due_date,
          notes: p.notes || '',
        }))

      const executed = all
        .filter((p: any) => p.payment_type === 'movement' || (!p.payment_type && p.is_paid))
        .sort(
          (a: any, b: any) =>
            new Date(b.paid_at || b.created_at).getTime() - new Date(a.paid_at || a.created_at).getTime()
        )
        .map((p: any) => ({
          id: p.id,
          amount: Number(p.amount),
          paid_at: p.paid_at,
          due_date: p.due_date,
          notes: p.notes || '',
        }))

      const totalPaid = executed.reduce((s, p) => s + p.amount, 0)
      const totalScheduled = scheduled.reduce((s, p) => s + p.amount, 0)

      return {
        project: { id: proj.id, name: proj.name },
        summary: {
          totalScheduledInScheduleTable: totalScheduled,
          totalPaidInActualMovements: totalPaid,
          remainingToPay: totalScheduled - totalPaid,
          scheduledCount: scheduled.length,
          executedMovementsCount: executed.length,
        },
        scheduled_payments: scheduled,
        executed_payments: executed,
      }
    },
  },

  {
    name: 'moshe_add_project_schedule_payment',
    titleHebrew: 'הוספת תשלום מתוכנן ללוח התשלומים',
    category: 'payments',
    description:
      'מוסיף יעד תשלום חדש ללוח התשלומים שנקבע בפרויקט (עצמאי לחלוטין ללא תנועה בפועל). מתאים לבוט שמקבל הוראה כמו: "תוסיף ללוח תשלום גמר שלד 200,000 בתאריך..."',
    schema: z.object({
      project: z.string().describe('שם הפרויקט או מזהה UUID שלו'),
      amount: z.number().positive().describe('סכום התשלום בש"ח'),
      due_date: z.string().optional().describe('תאריך יעד לתשלום בפורמט YYYY-MM-DD'),
      notes: z.string().optional().describe('שלב / תיאור התשלום בלוח (למשל: "גמר שלד", "אינסטלציה")'),
    }),
    execute: async ({ project, amount, due_date, notes }) => {
      const proj = await resolveProject(project)
      if (!proj) return { error: `פרויקט "${project}" לא נמצא במערכת` }

      const { data, error } = await db
        .from('moshe_project_payments')
        .insert({
          project_id: proj.id,
          amount,
          due_date: due_date || null,
          paid_at: null,
          is_paid: false,
          payment_type: 'schedule',
          notes: notes?.trim() || null,
        })
        .select('*')
        .single()

      if (error) return { error: `שגיאה בהוספת תשלום ללוח: ${error.message}` }

      await writeMosheAudit(
        proj.id,
        'create',
        'payment',
        `תשלום חדש נוסף ללוח התשלומים: ₪${amount.toLocaleString('he-IL')}${notes ? ` - ${notes}` : ''}`,
        data.id,
        null,
        data
      )
      safeRevalidate(proj.id)

      return {
        success: true,
        message: `תשלום בסך ₪${amount.toLocaleString('he-IL')} נוסף ללוח התשלומים של פרויקט "${proj.name}"`,
        payment: data,
      }
    },
  },

  {
    name: 'moshe_add_project_movement',
    titleHebrew: 'רישום תנועת תשלום שבוצעה בפועל',
    category: 'payments',
    description:
      'רושם תנועת תשלום ששולמה בפועל בפרויקט (עצמאית לחלוטין ומפחיתה מידית מהיתרה לתשלום). מתאים לבוט שמקבל הוראה כמו: "שילמתי היום 40,000 לקבלן באישור העברה 402".',
    schema: z.object({
      project: z.string().describe('שם הפרויקט או מזהה UUID שלו'),
      amount: z.number().positive().describe('סכום התשלום שבוצע בפועל בש"ח'),
      paid_at: z.string().optional().describe('תאריך ביצוע התשלום YYYY-MM-DD (ברירת מחדל: היום)'),
      notes: z.string().optional().describe('אסמכתא, שם מקבל התשלום או תיאור ההעברה'),
    }),
    execute: async ({ project, amount, paid_at, notes }) => {
      const proj = await resolveProject(project)
      if (!proj) return { error: `פרויקט "${project}" לא נמצא במערכת` }

      const actualDate = paid_at ? new Date(paid_at).toISOString() : new Date().toISOString()

      const { data, error } = await db
        .from('moshe_project_payments')
        .insert({
          project_id: proj.id,
          amount,
          due_date: null,
          paid_at: actualDate,
          is_paid: true,
          payment_type: 'movement',
          notes: notes?.trim() || null,
        })
        .select('*')
        .single()

      if (error) return { error: `שגיאה ברישום תנועת תשלום: ${error.message}` }

      await writeMosheAudit(
        proj.id,
        'create',
        'payment',
        `תנועת תשלום שבוצעה נרשמה: ₪${amount.toLocaleString('he-IL')}${notes ? ` - ${notes}` : ''}`,
        data.id,
        null,
        data
      )
      safeRevalidate(proj.id)

      return {
        success: true,
        message: `תנועת תשלום שבוצעה בפועל בסך ₪${amount.toLocaleString('he-IL')} נרשמה בהצלחה`,
        payment: data,
      }
    },
  },

  {
    name: 'moshe_update_project_payment',
    titleHebrew: 'עריכת תשלום או תנועה בפרויקט',
    category: 'payments',
    description:
      'מעדכן תשלום קיים בלוח התשלומים או תנועת תשלום שבוצעה (סכום, תאריך, והערות).',
    schema: z.object({
      id: z.string().uuid().describe('מזהה UUID של התשלום/תנועה'),
      amount: z.number().positive().optional().describe('סכום מעודכן'),
      due_date: z.string().optional().describe('תאריך יעד מעודכן (לתשלום בלוח)'),
      paid_at: z.string().optional().describe('תאריך ביצוע מעודכן (לתנועה שבוצעה)'),
      notes: z.string().optional().describe('הערות או אסמכתא מעודכנת'),
    }),
    execute: async ({ id, amount, due_date, paid_at, notes }) => {
      const { data: old } = await db.from('moshe_project_payments').select('*').eq('id', id).maybeSingle()
      if (!old) return { error: 'תשלום לא נמצא במערכת' }

      const updates: Record<string, any> = {}
      if (amount !== undefined) updates.amount = amount
      if (due_date !== undefined) updates.due_date = due_date || null
      if (paid_at !== undefined) updates.paid_at = paid_at ? new Date(paid_at).toISOString() : null
      if (notes !== undefined) updates.notes = notes.trim() || null

      const { data, error } = await db
        .from('moshe_project_payments')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single()

      if (error) return { error: `שגיאה בעדכון תשלום: ${error.message}` }

      await writeMosheAudit(
        old.project_id,
        'update',
        'payment',
        `תשלום עודכן (מזהה: ${id})`,
        id,
        old,
        data
      )
      safeRevalidate(old.project_id)

      return {
        success: true,
        message: 'תשלום עודכן בהצלחה',
        payment: data,
      }
    },
  },

  {
    name: 'moshe_delete_project_payment',
    titleHebrew: 'מחיקת תשלום או תנועה מפרויקט',
    category: 'payments',
    description:
      'מוחק תשלום מלוח התשלומים או תנועת תשלום שבוצעה בפועל. הפעולה נשמרת ביומן הפעילויות וניתנת לשחזור.',
    schema: z.object({
      id: z.string().uuid().describe('מזהה UUID של התשלום/תנועה למחיקה'),
    }),
    execute: async ({ id }) => {
      const { data: old } = await db.from('moshe_project_payments').select('*').eq('id', id).maybeSingle()
      if (!old) return { error: 'תשלום לא נמצא' }

      const { error } = await db.from('moshe_project_payments').delete().eq('id', id)
      if (error) return { error: `שגיאה במחיקת תשלום: ${error.message}` }

      await writeMosheAudit(
        old.project_id,
        'delete',
        'payment',
        `תשלום בסך ₪${Number(old.amount).toLocaleString('he-IL')} נמחק`,
        id,
        old,
        null
      )
      safeRevalidate(old.project_id)

      return {
        success: true,
        message: 'התשלום נמחק בהצלחה ונשמר ביומן לשחזור',
      }
    },
  },

  // =========================================================================
  // 3. BUYERS & BUYER PAYMENTS (קונים ותשלומי קונים)
  // =========================================================================

  {
    name: 'moshe_list_buyers',
    titleHebrew: 'רשימת קונים ויתרות',
    category: 'buyers',
    description:
      'מחזיר את רשימת הקונים בפרויקט (או בכל הפרויקטים אם לא צוין פרויקט), פרטי דירה, סך החוזה, נקבע בלוח, שולם בפועל ויתרה לתשלום.',
    schema: z.object({
      project: z.string().optional().describe('שם הפרויקט או מזהה שלו (אופציונלי - אם לא מצוין מחזיר מכל הפרויקטים)'),
    }),
    execute: async ({ project }) => {
      let projectId: string | null = null
      let projName = 'כל הפרויקטים'

      if (project) {
        const proj = await resolveProject(project)
        if (!proj) return { error: `פרויקט "${project}" לא נמצא במערכת` }
        projectId = proj.id
        projName = proj.name
      }

      let qBuyers = db.from('moshe_buyers').select('*').order('name')
      let qPayments = db.from('moshe_buyer_payments').select('*')

      if (projectId) {
        qBuyers = qBuyers.eq('project_id', projectId)
        qPayments = qPayments.eq('project_id', projectId)
      }

      const [{ data: buyers }, { data: buyerPayments }, { data: projects }] = await Promise.all([
        qBuyers,
        qPayments,
        db.from('moshe_projects').select('id, name'),
      ])

      const projMap = new Map((projects || []).map((p: any) => [p.id, p.name]))
      const bp = buyerPayments || []

      const list = (buyers || []).map((b: any) => {
        const myPayments = bp.filter((x: any) => x.buyer_id === b.id)
        const scheduled = myPayments
          .filter((p: any) => p.payment_type === 'schedule' || (!p.payment_type && !p.is_received))
          .reduce((s: number, p: any) => s + Number(p.amount), 0)
        const received = myPayments
          .filter((p: any) => p.payment_type === 'movement' || (!p.payment_type && p.is_received))
          .reduce((s: number, p: any) => s + Number(p.amount), 0)

        const contractTotal = Number(b.total_amount) || scheduled

        return {
          id: b.id,
          project_id: b.project_id,
          project_name: projMap.get(b.project_id) || 'פרויקט',
          name: b.name,
          phone: b.phone || '',
          email: b.email || '',
          id_number: b.id_number || '',
          unit_description: b.unit_description || '',
          contract_date: b.contract_date || '',
          contract_total: contractTotal,
          scheduled_total: scheduled,
          received_actual: received,
          balance_remaining: scheduled - received,
          payments_count: myPayments.length,
        }
      })

      return {
        scope: projName,
        total_buyers: list.length,
        buyers: list,
      }
    },
  },

  {
    name: 'moshe_get_buyer_details',
    titleHebrew: 'כרטיס קונה מלא (לוח תשלומים ותנועות)',
    category: 'buyers',
    description:
      'מחזיר כרטיס מלא של קונה ספציפי: פרטי התקשרות, יחידה, לוח תשלומים שנקבע לקונה, ורשימת כל התנועות שהתקבלו בפועל מהקונה עם יתרה מדויקת.',
    schema: z.object({
      project: z.string().describe('שם הפרויקט או מזהה שלו'),
      buyer: z.string().describe('שם הקונה (למשל: "ישראל ישראלי") או מזהה UUID שלו'),
    }),
    execute: async ({ project, buyer }) => {
      const proj = await resolveProject(project)
      if (!proj) return { error: `פרויקט "${project}" לא נמצא במערכת` }

      const b = await resolveBuyer(proj.id, buyer)
      if (!b) return { error: `קונה "${buyer}" לא נמצא בפרויקט "${proj.name}"` }

      const { data: payments, error } = await db
        .from('moshe_buyer_payments')
        .select('*')
        .eq('buyer_id', b.id)
        .order('due_date', { ascending: true })

      if (error) return { error: `שגיאה בשליפת תשלומי קונה: ${error.message}` }
      const all = payments || []

      const scheduled = all
        .filter((p: any) => p.payment_type === 'schedule' || (!p.payment_type && !p.is_received))
        .map((p: any) => ({
          id: p.id,
          amount: Number(p.amount),
          due_date: p.due_date,
          notes: p.notes || '',
        }))

      const received = all
        .filter((p: any) => p.payment_type === 'movement' || (!p.payment_type && p.is_received))
        .sort(
          (a: any, b: any) =>
            new Date(b.received_at || b.created_at).getTime() - new Date(a.received_at || a.created_at).getTime()
        )
        .map((p: any) => ({
          id: p.id,
          amount: Number(p.amount),
          received_at: p.received_at,
          notes: p.notes || '',
        }))

      const totalScheduled = scheduled.reduce((s, p) => s + p.amount, 0)
      const totalReceived = received.reduce((s, p) => s + p.amount, 0)

      return {
        buyer: {
          id: b.id,
          name: b.name,
          phone: b.phone || '',
          email: b.email || '',
          id_number: b.id_number || '',
          unit_description: b.unit_description || '',
          contract_date: b.contract_date || '',
          total_amount: Number(b.total_amount) || totalScheduled,
          notes: b.notes || '',
        },
        project: { id: proj.id, name: proj.name },
        summary: {
          totalScheduledInScheduleTable: totalScheduled,
          totalReceivedInActualMovements: totalReceived,
          remainingToPay: totalScheduled - totalReceived,
        },
        scheduled_payments: scheduled,
        received_movements: received,
      }
    },
  },

  {
    name: 'moshe_create_buyer',
    titleHebrew: 'הוספת קונה חדש לפרויקט',
    category: 'buyers',
    description:
      'רושם קונה חדש בפרויקט: שם מלא, טלפון, אימייל, ת.ז., תיאור דירה/יחידה, תאריך חוזה, סכום חוזה כולל והערות.',
    schema: z.object({
      project: z.string().describe('שם הפרויקט או מזהה UUID שלו'),
      name: z.string().min(1, 'שם הקונה נדרש').describe('שם מלא של הקונה'),
      phone: z.string().optional().describe('מספר טלפון'),
      email: z.string().optional().describe('כתובת אימייל'),
      id_number: z.string().optional().describe('מספר תעודת זהות'),
      unit_description: z.string().optional().describe('תיאור יחידה/דירה (למשל: "דירה 4, קומה 2")'),
      contract_date: z.string().optional().describe('תאריך חתימת חוזה YYYY-MM-DD'),
      total_amount: z.number().optional().describe('סכום חוזה כולל בש"ח'),
      notes: z.string().optional().describe('הערות'),
    }),
    execute: async ({ project, name, phone, email, id_number, unit_description, contract_date, total_amount, notes }) => {
      const proj = await resolveProject(project)
      if (!proj) return { error: `פרויקט "${project}" לא נמצא במערכת` }

      const { data, error } = await db
        .from('moshe_buyers')
        .insert({
          project_id: proj.id,
          name: name.trim(),
          phone: phone?.trim() || null,
          email: email?.trim() || null,
          id_number: id_number?.trim() || null,
          unit_description: unit_description?.trim() || null,
          contract_date: contract_date || null,
          total_amount: total_amount || null,
          notes: notes?.trim() || null,
        })
        .select('*')
        .single()

      if (error) return { error: `שגיאה בהוספת קונה: ${error.message}` }

      await writeMosheAudit(
        proj.id,
        'create',
        'buyer',
        `קונה חדש נוסף: ${name}`,
        data.id,
        null,
        data
      )
      safeRevalidate(proj.id)

      return {
        success: true,
        message: `הקונה "${name}" נוסף בהצלחה לפרויקט "${proj.name}"`,
        buyer: data,
      }
    },
  },

  {
    name: 'moshe_update_buyer',
    titleHebrew: 'עדכון פרטי קונה',
    category: 'buyers',
    description: 'מעדכן פרטי קונה קיים: טלפון, אימייל, דירה, סכום חוזה, הערות.',
    schema: z.object({
      project: z.string().describe('שם הפרויקט או מזהה UUID שלו'),
      buyer: z.string().describe('שם הקונה או מזהה UUID שלו'),
      phone: z.string().optional().describe('טלפון מעודכן'),
      email: z.string().optional().describe('אימייל מעודכן'),
      unit_description: z.string().optional().describe('תיאור דירה מעודכן'),
      contract_date: z.string().optional().describe('תאריך חוזה מעודכן'),
      total_amount: z.number().optional().describe('סכום חוזה כולל מעודכן בש"ח'),
      notes: z.string().optional().describe('הערות מעודכנות'),
    }),
    execute: async ({ project, buyer, phone, email, unit_description, contract_date, total_amount, notes }) => {
      const proj = await resolveProject(project)
      if (!proj) return { error: `פרויקט "${project}" לא נמצא במערכת` }

      const b = await resolveBuyer(proj.id, buyer)
      if (!b) return { error: `קונה "${buyer}" לא נמצא` }

      const updates: Record<string, any> = {}
      if (phone !== undefined) updates.phone = phone.trim() || null
      if (email !== undefined) updates.email = email.trim() || null
      if (unit_description !== undefined) updates.unit_description = unit_description.trim() || null
      if (contract_date !== undefined) updates.contract_date = contract_date || null
      if (total_amount !== undefined) updates.total_amount = total_amount
      if (notes !== undefined) updates.notes = notes.trim() || null

      const { data, error } = await db.from('moshe_buyers').update(updates).eq('id', b.id).select('*').single()
      if (error) return { error: `שגיאה בעדכון קונה: ${error.message}` }

      await writeMosheAudit(proj.id, 'update', 'buyer', `פרטי קונה "${b.name}" עודכנו`, b.id, b, data)
      safeRevalidate(proj.id)

      return {
        success: true,
        message: `פרטי הקונה "${b.name}" עודכנו בהצלחה`,
        buyer: data,
      }
    },
  },

  {
    name: 'moshe_delete_buyer',
    titleHebrew: 'מחיקת קונה וכל התשלומים שלו',
    category: 'buyers',
    description:
      'מוחק קונה וכל התשלומים שלו מהפרויקט. הנתונים המלאים נשמרים ביומן הפעילויות וניתנים לשחזור.',
    schema: z.object({
      project: z.string().describe('שם הפרויקט או מזהה UUID שלו'),
      buyer: z.string().describe('שם הקונה או מזהה UUID שלו'),
    }),
    execute: async ({ project, buyer }) => {
      const proj = await resolveProject(project)
      if (!proj) return { error: `פרויקט "${project}" לא נמצא במערכת` }

      const b = await resolveBuyer(proj.id, buyer)
      if (!b) return { error: `קונה "${buyer}" לא נמצא` }

      const { data: payments } = await db.from('moshe_buyer_payments').select('*').eq('buyer_id', b.id)
      const fullSnap = { ...b, payments: payments || [] }

      const { error } = await db.from('moshe_buyers').delete().eq('id', b.id)
      if (error) return { error: `שגיאה במחיקת קונה: ${error.message}` }

      await writeMosheAudit(
        proj.id,
        'delete',
        'buyer',
        `קונה "${b.name}" נמחק עם ${payments?.length || 0} תשלומים`,
        b.id,
        fullSnap,
        null
      )
      safeRevalidate(proj.id)

      return {
        success: true,
        message: `הקונה "${b.name}" נמחק בהצלחה ונשמר ביומן לשחזור`,
      }
    },
  },

  {
    name: 'moshe_add_buyer_schedule_payment',
    titleHebrew: 'הוספת תשלום מתוכנן ללוח הקונה',
    category: 'buyers',
    description:
      'מוסיף יעד תשלום חדש ללוח התשלומים שנקבע של קונה ספציפי (למשל: תשלום מסירה, גמר טיח).',
    schema: z.object({
      project: z.string().describe('שם הפרויקט או מזהה UUID שלו'),
      buyer: z.string().describe('שם הקונה או מזהה UUID שלו'),
      amount: z.number().positive().describe('סכום התשלום בש"ח'),
      due_date: z.string().optional().describe('תאריך יעד לתשלום בפורמט YYYY-MM-DD'),
      notes: z.string().optional().describe('שלב / הערות לתשלום בלוח (למשל: "תשלום גמר שלד")'),
    }),
    execute: async ({ project, buyer, amount, due_date, notes }) => {
      const proj = await resolveProject(project)
      if (!proj) return { error: `פרויקט "${project}" לא נמצא במערכת` }

      const b = await resolveBuyer(proj.id, buyer)
      if (!b) return { error: `קונה "${buyer}" לא נמצא בפרויקט "${proj.name}"` }

      const { data, error } = await db
        .from('moshe_buyer_payments')
        .insert({
          buyer_id: b.id,
          project_id: proj.id,
          amount,
          due_date: due_date || null,
          received_at: null,
          is_received: false,
          payment_type: 'schedule',
          notes: notes?.trim() || null,
        })
        .select('*')
        .single()

      if (error) return { error: `שגיאה בהוספת תשלום ללוח הקונה: ${error.message}` }

      await writeMosheAudit(
        proj.id,
        'create',
        'buyer_payment',
        `תשלום בסך ₪${amount.toLocaleString('he-IL')} נוסף ללוח של הקונה ${b.name}`,
        data.id,
        null,
        data
      )
      safeRevalidate(proj.id)

      return {
        success: true,
        message: `תשלום בסך ₪${amount.toLocaleString('he-IL')} נוסף ללוח של ${b.name}`,
        payment: data,
      }
    },
  },

  {
    name: 'moshe_add_buyer_movement',
    titleHebrew: 'רישום תשלום שהתקבל בפועל מהקונה',
    category: 'buyers',
    description:
      'רושם תנועת תשלום שהתקבל בפועל מהקונה (עצמאית ומפחיתה מידית מיתרת החוב של הקונה). מתאים לבוט: "הקונה לוי העביר 100,000 ש"ח היום".',
    schema: z.object({
      project: z.string().describe('שם הפרויקט או מזהה UUID שלו'),
      buyer: z.string().describe('שם הקונה או מזהה UUID שלו'),
      amount: z.number().positive().describe('סכום התשלום שהתקבל בפועל בש"ח'),
      received_at: z.string().optional().describe('תאריך קבלה בפועל YYYY-MM-DD (ברירת מחדל: היום)'),
      notes: z.string().optional().describe('אסמכתא / אופן תשלום (העברה בנקאית, צ\'ק, מזומן)'),
    }),
    execute: async ({ project, buyer, amount, received_at, notes }) => {
      const proj = await resolveProject(project)
      if (!proj) return { error: `פרויקט "${project}" לא נמצא במערכת` }

      const b = await resolveBuyer(proj.id, buyer)
      if (!b) return { error: `קונה "${buyer}" לא נמצא בפרויקט "${proj.name}"` }

      const actualDate = received_at ? new Date(received_at).toISOString() : new Date().toISOString()

      const { data, error } = await db
        .from('moshe_buyer_payments')
        .insert({
          buyer_id: b.id,
          project_id: proj.id,
          amount,
          due_date: null,
          received_at: actualDate,
          is_received: true,
          payment_type: 'movement',
          notes: notes?.trim() || null,
        })
        .select('*')
        .single()

      if (error) return { error: `שגיאה ברישום תשלום קונה: ${error.message}` }

      await writeMosheAudit(
        proj.id,
        'create',
        'buyer_payment',
        `תנועת תשלום שהתקבל מהקונה ${b.name} נרשמה: ₪${amount.toLocaleString('he-IL')}${notes ? ` - ${notes}` : ''}`,
        data.id,
        null,
        data
      )
      safeRevalidate(proj.id)

      return {
        success: true,
        message: `תשלום בסך ₪${amount.toLocaleString('he-IL')} שהתקבל מהקונה ${b.name} נרשם בהצלחה`,
        payment: data,
      }
    },
  },

  {
    name: 'moshe_update_buyer_payment',
    titleHebrew: 'עריכת תשלום בלוח או תנועה של קונה',
    category: 'buyers',
    description: 'מעדכן תשלום בלוח של קונה או תנועה שהתקבלה מהקונה (סכום, תאריך, הערות).',
    schema: z.object({
      id: z.string().uuid().describe('מזהה UUID של התשלום של הקונה'),
      amount: z.number().positive().optional().describe('סכום מעודכן'),
      due_date: z.string().optional().describe('תאריך יעד מעודכן (לתשלום בלוח)'),
      received_at: z.string().optional().describe('תאריך קבלה מעודכן (לתנועה שהתקבלה)'),
      notes: z.string().optional().describe('הערות או אסמכתא מעודכנת'),
    }),
    execute: async ({ id, amount, due_date, received_at, notes }) => {
      const { data: old } = await db.from('moshe_buyer_payments').select('*').eq('id', id).maybeSingle()
      if (!old) return { error: 'תשלום קונה לא נמצא' }

      const updates: Record<string, any> = {}
      if (amount !== undefined) updates.amount = amount
      if (due_date !== undefined) updates.due_date = due_date || null
      if (received_at !== undefined) updates.received_at = received_at ? new Date(received_at).toISOString() : null
      if (notes !== undefined) updates.notes = notes.trim() || null

      const { data, error } = await db.from('moshe_buyer_payments').update(updates).eq('id', id).select('*').single()
      if (error) return { error: `שגיאה בעדכון תשלום: ${error.message}` }

      await writeMosheAudit(old.project_id, 'update', 'buyer_payment', `תשלום קונה עודכן`, id, old, data)
      safeRevalidate(old.project_id)

      return {
        success: true,
        message: 'תשלום קונה עודכן בהצלחה',
        payment: data,
      }
    },
  },

  {
    name: 'moshe_delete_buyer_payment',
    titleHebrew: 'מחיקת תשלום בלוח או תנועה של קונה',
    category: 'buyers',
    description:
      'מוחק תשלום מלוח התשלומים של הקונה או תנועה שהתקבלה ממנו. נשמר ביומן וניתן לשחזור.',
    schema: z.object({
      id: z.string().uuid().describe('מזהה UUID של תשלום הקונה למחיקה'),
    }),
    execute: async ({ id }) => {
      const { data: old } = await db.from('moshe_buyer_payments').select('*').eq('id', id).maybeSingle()
      if (!old) return { error: 'תשלום קונה לא נמצא' }

      const { error } = await db.from('moshe_buyer_payments').delete().eq('id', id)
      if (error) return { error: `שגיאה במחיקת תשלום: ${error.message}` }

      await writeMosheAudit(
        old.project_id,
        'delete',
        'buyer_payment',
        `תשלום קונה בסך ₪${Number(old.amount).toLocaleString('he-IL')} נמחק`,
        id,
        old,
        null
      )
      safeRevalidate(old.project_id)

      return {
        success: true,
        message: 'תשלום הקונה נמחק בהצלחה',
      }
    },
  },

  // =========================================================================
  // 4. GENERAL TRANSACTIONS: INCOMES & EXPENSES (הכנסות והוצאות כלליות)
  // =========================================================================

  {
    name: 'moshe_list_transactions',
    titleHebrew: 'רשימת הוצאות והכנסות כלליות',
    category: 'finance',
    description:
      'מחזיר תנועות כספיות כלליות בפרויקט: הוצאות והכנסות, קטגוריות (חומרי בניין, אגרות, עו"ד וכד\'), תאריכים והערות.',
    schema: z.object({
      project: z.string().describe('שם הפרויקט או מזהה UUID שלו'),
      type: z.enum(['income', 'expense', 'all']).optional().default('all').describe('סינון לפי סוג: income / expense / all'),
      category: z.string().optional().describe('סינון לפי שם קטגוריה ספציפית'),
    }),
    execute: async ({ project, type, category }) => {
      const proj = await resolveProject(project)
      if (!proj) return { error: `פרויקט "${project}" לא נמצא במערכת` }

      let q = db.from('moshe_transactions').select('*').eq('project_id', proj.id).order('date', { ascending: false })

      if (type && type !== 'all') {
        q = q.eq('type', type)
      }
      if (category) {
        q = q.ilike('category', `%${category.trim()}%`)
      }

      const { data, error } = await q
      if (error) return { error: `שגיאה בשליפת עסקאות: ${error.message}` }

      const all = data || []
      const totalIncome = all.filter((t: any) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
      const totalExpense = all.filter((t: any) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)

      return {
        project: { id: proj.id, name: proj.name },
        summary: {
          totalIncome,
          totalExpense,
          netDifference: totalIncome - totalExpense,
          count: all.length,
        },
        transactions: all.map((t: any) => ({
          id: t.id,
          type: t.type,
          amount: Number(t.amount),
          date: t.date,
          category: t.category || '',
          notes: t.notes || '',
          partner_id: t.partner_id || null,
        })),
      }
    },
  },

  {
    name: 'moshe_add_transaction',
    titleHebrew: 'רישום הוצאה או הכנסה כללית',
    category: 'finance',
    description:
      'רושם הוצאה או הכנסה כללית בפרויקט. מתאים לבוט: "תרשום הוצאה של 1,500 ש"ח על קטגוריית עירייה".',
    schema: z.object({
      project: z.string().describe('שם הפרויקט או מזהה UUID שלו'),
      type: z.enum(['income', 'expense']).describe('סוג התנועה: income (הכנסה) או expense (הוצאה)'),
      amount: z.number().positive().describe('סכום בש"ח'),
      date: z.string().optional().describe('תאריך התנועה YYYY-MM-DD (ברירת מחדל: היום)'),
      category: z.string().optional().describe('קטגוריה (אגרות, חומרים, יועצים, עורכי דין וכו\')'),
      notes: z.string().optional().describe('תיאור או אסמכתא'),
      partner: z.string().optional().describe('שם או מזהה שותף מקושר אם רלוונטי'),
    }),
    execute: async ({ project, type, amount, date, category, notes, partner }) => {
      const proj = await resolveProject(project)
      if (!proj) return { error: `פרויקט "${project}" לא נמצא במערכת` }

      let partnerId: string | null = null
      if (partner) {
        const p = await resolvePartner(proj.id, partner)
        if (p) partnerId = p.id
      }

      const txDate = date || new Date().toISOString().slice(0, 10)

      const { data, error } = await db
        .from('moshe_transactions')
        .insert({
          project_id: proj.id,
          type,
          amount,
          date: txDate,
          category: category?.trim() || null,
          notes: notes?.trim() || null,
          partner_id: partnerId,
        })
        .select('*')
        .single()

      if (error) return { error: `שגיאה ברישום עסקה: ${error.message}` }

      await writeMosheAudit(
        proj.id,
        'create',
        'transaction',
        `${type === 'income' ? 'הכנסה' : 'הוצאה'} נרשמה: ₪${amount.toLocaleString('he-IL')}${notes ? ` - ${notes}` : ''}`,
        data.id,
        null,
        data
      )
      safeRevalidate(proj.id)

      return {
        success: true,
        message: `${type === 'income' ? 'הכנסה' : 'הוצאה'} בסך ₪${amount.toLocaleString('he-IL')} נרשמה בהצלחה`,
        transaction: data,
      }
    },
  },

  {
    name: 'moshe_delete_transaction',
    titleHebrew: 'מחיקת עסקה כללית',
    category: 'finance',
    description: 'מוחק עסקה כללית (הוצאה/הכנסה) מפרויקט. נשמר ביומן וניתן לשחזור.',
    schema: z.object({
      id: z.string().uuid().describe('מזהה UUID של העסקה'),
    }),
    execute: async ({ id }) => {
      const { data: old } = await db.from('moshe_transactions').select('*').eq('id', id).maybeSingle()
      if (!old) return { error: 'עסקה לא נמצאה' }

      const { error } = await db.from('moshe_transactions').delete().eq('id', id)
      if (error) return { error: `שגיאה במחיקת עסקה: ${error.message}` }

      await writeMosheAudit(
        old.project_id,
        'delete',
        'transaction',
        `עסקה (${old.type}) בסך ₪${Number(old.amount).toLocaleString('he-IL')} נמחקה`,
        id,
        old,
        null
      )
      safeRevalidate(old.project_id)

      return {
        success: true,
        message: 'העסקה נמחקה בהצלחה',
      }
    },
  },

  // =========================================================================
  // 5. PARTNERS & INVESTMENTS (שותפים, השקעות ומשיכות)
  // =========================================================================

  {
    name: 'moshe_list_partners',
    titleHebrew: 'שותפים, השקעות ומשיכות',
    category: 'partners',
    description:
      'מחזיר רשימת שותפים בפרויקט, סך השקעות, משיכות כספים, הוצאות ויתרה נטו לכל שותף.',
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
        const invested = ptx
          .filter((t: any) => t.type === 'investment')
          .reduce((s: number, t: any) => s + Number(t.amount), 0)
        const withdrawn = ptx
          .filter((t: any) => t.type === 'withdrawal')
          .reduce((s: number, t: any) => s + Number(t.amount), 0)
        const expense = ptx
          .filter((t: any) => t.type === 'expense')
          .reduce((s: number, t: any) => s + Number(t.amount), 0)
        return {
          id: part.id,
          name: part.name,
          phone: part.phone || '',
          email: part.email || '',
          total_invested: invested,
          total_withdrawn: withdrawn,
          total_expense: expense,
          net_balance: invested - withdrawn - expense,
          transactions_count: ptx.length,
        }
      })

      return {
        project: { id: proj.id, name: proj.name },
        partners_count: list.length,
        partners: list,
      }
    },
  },

  {
    name: 'moshe_add_partner',
    titleHebrew: 'הוספת שותף לפרויקט',
    category: 'partners',
    description: 'מוסיף שותף חדש לפרויקט: שם, טלפון, אימייל והערות.',
    schema: z.object({
      project: z.string().describe('שם הפרויקט או מזהה UUID שלו'),
      name: z.string().min(1, 'שם השותף נדרש').describe('שם השותף'),
      phone: z.string().optional().describe('טלפון'),
      email: z.string().optional().describe('אימייל'),
      notes: z.string().optional().describe('הערות'),
    }),
    execute: async ({ project, name, phone, email, notes }) => {
      const proj = await resolveProject(project)
      if (!proj) return { error: `פרויקט "${project}" לא נמצא במערכת` }

      const { data, error } = await db
        .from('moshe_partners')
        .insert({
          project_id: proj.id,
          name: name.trim(),
          phone: phone?.trim() || null,
          email: email?.trim() || null,
          notes: notes?.trim() || null,
        })
        .select('*')
        .single()

      if (error) return { error: `שגיאה בהוספת שותף: ${error.message}` }

      await writeMosheAudit(proj.id, 'create', 'partner', `שותף חדש נוסף: ${name}`, data.id, null, data)
      safeRevalidate(proj.id)

      return {
        success: true,
        message: `שותף "${name}" נוסף בהצלחה לפרויקט "${proj.name}"`,
        partner: data,
      }
    },
  },

  {
    name: 'moshe_add_partner_transaction',
    titleHebrew: 'רישום השקעה / משיכה של שותף',
    category: 'partners',
    description:
      'רושם תנועת שותף: השקעה (investment), משיכה (withdrawal), או הוצאה (expense). מתאים לבוט: "השותף יוסי השקיע היום 150,000 ש"ח".',
    schema: z.object({
      project: z.string().describe('שם הפרויקט או מזהה UUID שלו'),
      partner: z.string().describe('שם השותף או מזהה UUID שלו'),
      type: z
        .enum(['investment', 'withdrawal', 'expense'])
        .describe('סוג התנועה: investment (השקעה), withdrawal (משיכה), expense (הוצאה)'),
      amount: z.number().positive().describe('סכום בש"ח'),
      date: z.string().optional().describe('תאריך YYYY-MM-DD (ברירת מחדל: היום)'),
      notes: z.string().optional().describe('הערות או אסמכתא'),
    }),
    execute: async ({ project, partner, type, amount, date, notes }) => {
      const proj = await resolveProject(project)
      if (!proj) return { error: `פרויקט "${project}" לא נמצא במערכת` }

      const p = await resolvePartner(proj.id, partner)
      if (!p) return { error: `שותף "${partner}" לא נמצא בפרויקט "${proj.name}"` }

      const txDate = date || new Date().toISOString().slice(0, 10)

      const { data, error } = await db
        .from('moshe_partner_transactions')
        .insert({
          project_id: proj.id,
          partner_id: p.id,
          type,
          amount,
          date: txDate,
          notes: notes?.trim() || null,
        })
        .select('*')
        .single()

      if (error) return { error: `שגיאה ברישום תנועת שותף: ${error.message}` }

      const typeHebrew = type === 'investment' ? 'השקעה' : type === 'withdrawal' ? 'משיכה' : 'הוצאה'
      await writeMosheAudit(
        proj.id,
        'create',
        'partner_transaction',
        `${typeHebrew} של השותף ${p.name} נרשמה: ₪${amount.toLocaleString('he-IL')}`,
        data.id,
        null,
        data
      )
      safeRevalidate(proj.id)

      return {
        success: true,
        message: `${typeHebrew} של ${p.name} בסך ₪${amount.toLocaleString('he-IL')} נרשמה בהצלחה`,
        transaction: data,
      }
    },
  },

  {
    name: 'moshe_delete_partner_transaction',
    titleHebrew: 'מחיקת תנועת שותף',
    category: 'partners',
    description: 'מוחק תנועת השקעה או משיכה של שותף. נשמר ביומן וניתן לשחזור.',
    schema: z.object({
      id: z.string().uuid().describe('מזהה UUID של תנועת השותף למחיקה'),
    }),
    execute: async ({ id }) => {
      const { data: old } = await db.from('moshe_partner_transactions').select('*').eq('id', id).maybeSingle()
      if (!old) return { error: 'תנועת שותף לא נמצאה' }

      const { error } = await db.from('moshe_partner_transactions').delete().eq('id', id)
      if (error) return { error: `שגיאה במחיקת תנועה: ${error.message}` }

      await writeMosheAudit(
        old.project_id,
        'delete',
        'partner_transaction',
        `תנועת שותף בסך ₪${Number(old.amount).toLocaleString('he-IL')} נמחקה`,
        id,
        old,
        null
      )
      safeRevalidate(old.project_id)

      return {
        success: true,
        message: 'תנועת השותף נמחקה בהצלחה',
      }
    },
  },

  // =========================================================================
  // 6. LOANS & GEMACHS (הלוואות וגמ"חים)
  // =========================================================================

  {
    name: 'moshe_list_loans',
    titleHebrew: 'הלוואות, תקבולים ופירעונות',
    category: 'loans',
    description:
      'מחזיר את רשימת ההלוואות בפרויקט, שמות המלווים, מסגרת אשראי, סכום שנמשך לקופת הפרויקט, סכום שנפרע (קרן וריבית) ויתרת חוב נוכחית.',
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
        const principalPaid = thisPayments
          .filter((p: any) => !p.is_interest)
          .reduce((s: number, p: any) => s + Number(p.amount), 0)
        const interestPaid = thisPayments
          .filter((p: any) => p.is_interest)
          .reduce((s: number, p: any) => s + Number(p.amount), 0)
        const received = lr
          .filter((r: any) => r.loan_id === l.id && r.is_received)
          .reduce((s: number, r: any) => s + Number(r.amount), 0)

        return {
          id: l.id,
          lender_name: l.lender,
          arranged_by: l.arranged_by || '',
          total_credit_facility: Number(l.total_amount),
          received_amount: received,
          principal_paid_back: principalPaid,
          interest_paid: interestPaid,
          current_debt_balance: received - principalPaid,
          notes: l.notes || '',
        }
      })

      return {
        project: { id: proj.id, name: proj.name },
        loans_count: list.length,
        loans: list,
      }
    },
  },

  {
    name: 'moshe_add_loan',
    titleHebrew: 'הוספת הלוואה / גמ״ח לפרויקט',
    category: 'loans',
    description:
      'פותח מסגרת הלוואה או גמ"ח חדשה בפרויקט: שם המלווה, סכום המסגרת, ריבית שנתית, ומספר תשלומים.',
    schema: z.object({
      project: z.string().describe('שם הפרויקט או מזהה UUID שלו'),
      lender: z.string().min(1, 'שם המלווה נדרש').describe('שם המלווה או הגמ"ח (למשל: "גמ״ח בית ישראל")'),
      total_amount: z.number().positive().describe('סכום ההלוואה הכולל בש"ח'),
      interest_rate: z.number().optional().describe('אחוז ריבית / עמלה שנתית אם יש'),
      num_payments: z.number().optional().default(1).describe('מספר תשלומים'),
      start_date: z.string().optional().describe('תאריך התחלה YYYY-MM-DD'),
      arranged_by: z.string().optional().describe('איש קשר או מתווך להלוואה'),
      notes: z.string().optional().describe('הערות ותנאי הלוואה'),
    }),
    execute: async ({ project, lender, total_amount, interest_rate, num_payments, start_date, arranged_by, notes }) => {
      const proj = await resolveProject(project)
      if (!proj) return { error: `פרויקט "${project}" לא נמצא במערכת` }

      const { data, error } = await db
        .from('moshe_loans')
        .insert({
          project_id: proj.id,
          lender: lender.trim(),
          total_amount,
          interest_rate: interest_rate || null,
          num_payments: num_payments || 1,
          start_date: start_date || null,
          arranged_by: arranged_by?.trim() || null,
          notes: notes?.trim() || null,
        })
        .select('*')
        .single()

      if (error) return { error: `שגיאה ביצירת הלוואה: ${error.message}` }

      await writeMosheAudit(
        proj.id,
        'create',
        'loan',
        `הלוואה חדשה נוספה מ-${lender}: ₪${total_amount.toLocaleString('he-IL')}`,
        data.id,
        null,
        data
      )
      safeRevalidate(proj.id)

      return {
        success: true,
        message: `הלוואה מ"${lender}" בסך ₪${total_amount.toLocaleString('he-IL')} נוספה בהצלחה`,
        loan: data,
      }
    },
  },

  {
    name: 'moshe_add_loan_receipt',
    titleHebrew: 'משיכת כספים מהלוואה (קבלת כסף לקופה)',
    category: 'loans',
    description:
      'רושם קבלת כספים מההלוואה לקופת הפרויקט (מגדיל את הכסף בקופה ואת יתרת החוב של ההלוואה).',
    schema: z.object({
      project: z.string().describe('שם הפרויקט או מזהה UUID שלו'),
      loan: z.string().describe('שם המלווה או מזהה UUID של ההלוואה'),
      amount: z.number().positive().describe('סכום הכסף שנמשך בפועל בש"ח'),
      date: z.string().optional().describe('תאריך משיכה YYYY-MM-DD (ברירת מחדל: היום)'),
      notes: z.string().optional().describe('הערות או אסמכתא'),
    }),
    execute: async ({ project, loan, amount, date, notes }) => {
      const proj = await resolveProject(project)
      if (!proj) return { error: `פרויקט "${project}" לא נמצא במערכת` }

      const l = await resolveLoan(proj.id, loan)
      if (!l) return { error: `הלוואה "${loan}" לא נמצאה בפרויקט "${proj.name}"` }

      const { data, error } = await db
        .from('moshe_loan_receipts')
        .insert({
          project_id: proj.id,
          loan_id: l.id,
          amount,
          due_date: date || new Date().toISOString().slice(0, 10),
          is_received: true,
          received_at: new Date().toISOString(),
          notes: notes?.trim() || null,
        })
        .select('*')
        .single()

      if (error) return { error: `שגיאה ברישום משיכת הלוואה: ${error.message}` }

      await writeMosheAudit(
        proj.id,
        'create',
        'loan_receipt',
        `משיכת הלוואה מ-${l.lender} נרשמה: ₪${amount.toLocaleString('he-IL')}`,
        data.id,
        null,
        data
      )
      safeRevalidate(proj.id)

      return {
        success: true,
        message: `משיכת כספים בסך ₪${amount.toLocaleString('he-IL')} מ"${l.lender}" נרשמה בהצלחה`,
        receipt: data,
      }
    },
  },

  {
    name: 'moshe_add_loan_payment',
    titleHebrew: 'רישום פירעון הלוואה (קרן או ריבית)',
    category: 'loans',
    description:
      'רושם החזר/פירעון תשלום למלווה. ניתן לציין האם התשלום הוא פירעון קרן (principal) או תשלום ריבית (interest).',
    schema: z.object({
      project: z.string().describe('שם הפרויקט או מזהה UUID שלו'),
      loan: z.string().describe('שם המלווה או מזהה UUID של ההלוואה'),
      amount: z.number().positive().describe('סכום הפירעון בש"ח'),
      is_interest: z.boolean().optional().default(false).describe('האם זה תשלום ריבית (true) או קרן (false)'),
      paid_at: z.string().optional().describe('תאריך ביצוע התשלום YYYY-MM-DD (ברירת מחדל: היום)'),
      notes: z.string().optional().describe('אסמכתא / הערות'),
    }),
    execute: async ({ project, loan, amount, is_interest, paid_at, notes }) => {
      const proj = await resolveProject(project)
      if (!proj) return { error: `פרויקט "${project}" לא נמצא במערכת` }

      const l = await resolveLoan(proj.id, loan)
      if (!l) return { error: `הלוואה "${loan}" לא נמצאה בפרויקט "${proj.name}"` }

      const actualDate = paid_at ? new Date(paid_at).toISOString() : new Date().toISOString()

      const { data, error } = await db
        .from('moshe_loan_payments')
        .insert({
          project_id: proj.id,
          loan_id: l.id,
          amount,
          is_paid: true,
          paid_at: actualDate,
          is_interest: !!is_interest,
          notes: notes?.trim() || null,
        })
        .select('*')
        .single()

      if (error) return { error: `שגיאה ברישום פירעון: ${error.message}` }

      const typeHebrew = is_interest ? 'ריבית' : 'קרן'
      await writeMosheAudit(
        proj.id,
        'create',
        'loan_payment',
        `פירעון הלוואה (${typeHebrew}) למלווה ${l.lender} נרשם: ₪${amount.toLocaleString('he-IL')}`,
        data.id,
        null,
        data
      )
      safeRevalidate(proj.id)

      return {
        success: true,
        message: `פירעון ${typeHebrew} בסך ₪${amount.toLocaleString('he-IL')} ל"${l.lender}" נרשם בהצלחה`,
        payment: data,
      }
    },
  },

  // =========================================================================
  // 7. NEIGHBORS & AGREEMENTS (שכנים, הסכמי פיצוי ותשלומים)
  // =========================================================================

  {
    name: 'moshe_list_neighbors',
    titleHebrew: 'שכנים, הסכמים ותשלומים',
    category: 'neighbors',
    description:
      'מחזיר את רשימת השכנים בפרויקט, סכומי ההסכמים, תשלומים ששולמו בפועל ויתרה לתשלום.',
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
        const paid = myPayments
          .filter((p: any) => p.is_paid)
          .reduce((s: number, p: any) => s + Number(p.amount), 0)
        const total = Number(n.total_amount) || myPayments.reduce((s: number, p: any) => s + Number(p.amount), 0)
        return {
          id: n.id,
          name: n.name,
          phone: n.phone || '',
          email: n.email || '',
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

  {
    name: 'moshe_add_neighbor',
    titleHebrew: 'הוספת שכן והסכם פיצוי',
    category: 'neighbors',
    description:
      'מוסיף שכן חדש והסכם פיצוי בפרויקט: שם, טלפון, סכום פיצוי כולל והערות.',
    schema: z.object({
      project: z.string().describe('שם הפרויקט או מזהה UUID שלו'),
      name: z.string().min(1, 'שם השכן נדרש').describe('שם השכן'),
      phone: z.string().optional().describe('טלפון'),
      email: z.string().optional().describe('אימייל'),
      total_amount: z.number().optional().describe('סכום הסכם הפיצוי בש"ח'),
      notes: z.string().optional().describe('הערות / תנאי הסכם'),
    }),
    execute: async ({ project, name, phone, email, total_amount, notes }) => {
      const proj = await resolveProject(project)
      if (!proj) return { error: `פרויקט "${project}" לא נמצא במערכת` }

      const { data, error } = await db
        .from('moshe_neighbors')
        .insert({
          project_id: proj.id,
          name: name.trim(),
          phone: phone?.trim() || null,
          email: email?.trim() || null,
          total_amount: total_amount || null,
          notes: notes?.trim() || null,
        })
        .select('*')
        .single()

      if (error) return { error: `שגיאה בהוספת שכן: ${error.message}` }

      await writeMosheAudit(
        proj.id,
        'create',
        'neighbor',
        `שכן חדש נוסף: ${name}${total_amount ? ` (הסכם ₪${total_amount.toLocaleString('he-IL')})` : ''}`,
        data.id,
        null,
        data
      )
      safeRevalidate(proj.id)

      return {
        success: true,
        message: `שכן "${name}" נוסף בהצלחה לפרויקט "${proj.name}"`,
        neighbor: data,
      }
    },
  },

  {
    name: 'moshe_add_neighbor_payment',
    titleHebrew: 'רישום תשלום שבוצע לשכן',
    category: 'neighbors',
    description:
      'רושם תשלום פיצוי ששולם לשכן בפועל ומעדכן את יתרת התשלום לשכן.',
    schema: z.object({
      project: z.string().describe('שם הפרויקט או מזהה UUID שלו'),
      neighbor: z.string().describe('שם השכן או מזהה UUID שלו'),
      amount: z.number().positive().describe('סכום התשלום בש"ח'),
      date: z.string().optional().describe('תאריך התשלום YYYY-MM-DD (ברירת מחדל: היום)'),
      notes: z.string().optional().describe('אסמכתא / הערות'),
    }),
    execute: async ({ project, neighbor, amount, date, notes }) => {
      const proj = await resolveProject(project)
      if (!proj) return { error: `פרויקט "${project}" לא נמצא במערכת` }

      const n = await resolveNeighbor(proj.id, neighbor)
      if (!n) return { error: `שכן "${neighbor}" לא נמצא בפרויקט "${proj.name}"` }

      const { data, error } = await db
        .from('moshe_neighbor_payments')
        .insert({
          project_id: proj.id,
          neighbor_id: n.id,
          amount,
          due_date: date || new Date().toISOString().slice(0, 10),
          paid_at: new Date().toISOString(),
          is_paid: true,
          notes: notes?.trim() || null,
        })
        .select('*')
        .single()

      if (error) return { error: `שגיאה ברישום תשלום לשכן: ${error.message}` }

      await writeMosheAudit(
        proj.id,
        'create',
        'neighbor_payment',
        `תשלום לשכן ${n.name} נרשם: ₪${amount.toLocaleString('he-IL')}`,
        data.id,
        null,
        data
      )
      safeRevalidate(proj.id)

      return {
        success: true,
        message: `תשלום בסך ₪${amount.toLocaleString('he-IL')} לשכן "${n.name}" נרשם בהצלחה`,
        payment: data,
      }
    },
  },

  // =========================================================================
  // 8. CALENDAR & REMINDERS (יומן אירועים ותזכורות)
  // =========================================================================

  {
    name: 'moshe_get_calendar_events',
    titleHebrew: 'יומן אירועים ותשלומים קרובים',
    category: 'calendar',
    description:
      'מחזיר פגישות, אירועים ויעדי תשלום קרובים או באיחור בכל הפרויקטים של משה.',
    schema: z.object({
      daysAhead: z.number().optional().default(30).describe('כמה ימים קדימה לבדוק (ברירת מחדל: 30)'),
    }),
    execute: async ({ daysAhead }) => {
      const now = new Date()
      const future = new Date(now.getTime() + (daysAhead || 30) * 86400000)

      const [{ data: events }, { data: overduePayments }, { data: upcomingPayments }, { data: projects }] =
        await Promise.all([
          db.from('moshe_calendar_events').select('*').order('start_time', { ascending: true }).limit(50),
          db
            .from('moshe_project_payments')
            .select('id, project_id, amount, due_date, notes')
            .eq('is_paid', false)
            .lt('due_date', now.toISOString().slice(0, 10)),
          db
            .from('moshe_project_payments')
            .select('id, project_id, amount, due_date, notes')
            .eq('is_paid', false)
            .gte('due_date', now.toISOString().slice(0, 10))
            .lte('due_date', future.toISOString().slice(0, 10)),
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
          amount: Number(p.amount),
          due_date: p.due_date,
          notes: p.notes || '',
        })),
        upcoming_payments: (upcomingPayments || []).map((p: any) => ({
          id: p.id,
          project_name: projMap.get(p.project_id) || 'פרויקט',
          amount: Number(p.amount),
          due_date: p.due_date,
          notes: p.notes || '',
        })),
      }
    },
  },

  {
    name: 'moshe_add_calendar_event',
    titleHebrew: 'הוספת פגישה או אירוע ליומן',
    category: 'calendar',
    description:
      'מוסיף פגישה, סיור באתר או תזכורת ליומן האירועים של משה. מתאים לבוט: "תקבע לי סיור באתר מחר ב-10:00".',
    schema: z.object({
      title: z.string().min(1, 'כותרת נדרשת').describe('כותרת הפגישה או האירוע'),
      start_time: z.string().describe('תאריך ושעה התחלה ISO או YYYY-MM-DDTHH:mm'),
      end_time: z.string().optional().describe('תאריך ושעה סיום ISO או YYYY-MM-DDTHH:mm'),
      type: z
        .enum(['meeting', 'reminder', 'other'])
        .optional()
        .default('meeting')
        .describe('סוג האירוע: meeting (פגישה), reminder (תזכורת), other (אחר)'),
      notes: z.string().optional().describe('מיקום, תוכן פגישה או הערות'),
    }),
    execute: async ({ title, start_time, end_time, type, notes }) => {
      const { data, error } = await db
        .from('moshe_calendar_events')
        .insert({
          title: title.trim(),
          start_time,
          end_time: end_time || null,
          type: type || 'meeting',
          notes: notes?.trim() || null,
        })
        .select('*')
        .single()

      if (error) return { error: `שגיאה בהוספת אירוע ליומן: ${error.message}` }

      await writeMosheAudit(null, 'create', 'calendar_event', `אירוע חדש נוסף ליומן: ${title}`, data.id, null, data)
      safeRevalidate()

      return {
        success: true,
        message: `אירוע "${title}" נוסף בהצלחה ליומן`,
        event: data,
      }
    },
  },

  {
    name: 'moshe_delete_calendar_event',
    titleHebrew: 'מחיקת אירוע מהיומן',
    category: 'calendar',
    description: 'מוחק פגישה או אירוע מהיומן של משה.',
    schema: z.object({
      id: z.string().uuid().describe('מזהה UUID של האירוע ביומן'),
    }),
    execute: async ({ id }) => {
      const { error } = await db.from('moshe_calendar_events').delete().eq('id', id)
      if (error) return { error: `שגיאה במחיקת אירוע: ${error.message}` }
      safeRevalidate()
      return { success: true, message: 'האירוע נמחק מהיומן' }
    },
  },

  // =========================================================================
  // 9. WORKERS & TASKS (עובדי אתר ומשימות)
  // =========================================================================

  {
    name: 'moshe_list_workers',
    titleHebrew: 'עובדי אתר ומשימות פתוחות',
    category: 'workers',
    description:
      'מחזיר את רשימת העובדים בפורטל, תפקידיהם, טלפון, ומשימות פתוחות שהוקצו להם.',
    schema: z.object({
      onlyActive: z.boolean().optional().default(true).describe('האם להציג רק עובדים פעילים'),
    }),
    execute: async ({ onlyActive }) => {
      let q = db.from('moshe_workers').select('*').order('name')
      if (onlyActive) q = q.eq('is_active', true)

      const [{ data: workers }, { data: tasks }, { data: projects }] = await Promise.all([
        q,
        db.from('moshe_worker_tasks').select('*').eq('is_done', false),
        db.from('moshe_projects').select('id, name'),
      ])

      const projMap = new Map((projects || []).map((p: any) => [p.id, p.name]))
      const workerTasks = tasks || []

      const list = (workers || []).map((w: any) => {
        const myTasks = workerTasks.filter((t: any) => t.worker_id === w.id)
        return {
          id: w.id,
          name: w.name,
          role: w.role || '',
          phone: w.phone || '',
          email: w.email || '',
          is_active: w.is_active,
          pending_tasks_count: myTasks.length,
          pending_tasks: myTasks.map((t: any) => ({
            id: t.id,
            title: t.title,
            project_name: t.project_id ? projMap.get(t.project_id) || 'פרויקט' : '',
            notes: t.notes || '',
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

  {
    name: 'moshe_add_worker',
    titleHebrew: 'הוספת עובד אתר חדש',
    category: 'workers',
    description: 'מוסיף עובד אתר חדש: שם, טלפון, אימייל, תפקיד והערות.',
    schema: z.object({
      name: z.string().min(1, 'שם העובד נדרש').describe('שם העובד'),
      phone: z.string().optional().describe('מספר טלפון'),
      email: z.string().optional().describe('אימייל'),
      role: z.string().describe('תפקיד העובד (מנהל עבודה, קבלן שלד, חשמלאי וכד\')'),
      notes: z.string().optional().describe('הערות'),
    }),
    execute: async ({ name, phone, email, role, notes }) => {
      const { data, error } = await db
        .from('moshe_workers')
        .insert({
          name: name.trim(),
          phone: phone?.trim() || null,
          email: email?.trim() || null,
          role: role.trim(),
          notes: notes?.trim() || null,
        })
        .select('*')
        .single()

      if (error) return { error: `שגיאה בהוספת עובד: ${error.message}` }

      await writeMosheAudit(null, 'create', 'worker', `עובד חדש נוסף: ${name} (${role})`, data.id, null, data)
      safeRevalidate()

      return {
        success: true,
        message: `עובד "${name}" (${role}) נוסף בהצלחה`,
        worker: data,
      }
    },
  },

  {
    name: 'moshe_add_worker_task',
    titleHebrew: 'הקצאת משימה לעובד',
    category: 'workers',
    description:
      'מקצה משימה חדשה לעובד אתר עם תאריך יעד ופרויקט. מתאים לבוט: "תוסיף משימה למשה החשמלאי לבדוק לוח חשמל עד יום שלישי".',
    schema: z.object({
      worker: z.string().describe('שם העובד או מזהה UUID שלו'),
      title: z.string().min(1, 'כותרת המשימה נדרשת').describe('תיאור המשימה לביצוע'),
      project: z.string().optional().describe('שם הפרויקט או מזהה UUID שלו (אופציונלי)'),
      due_date: z.string().optional().describe('תאריך יעד לביצוע YYYY-MM-DD'),
      notes: z.string().optional().describe('הערות ודגשים למשימה'),
    }),
    execute: async ({ worker, title, project, due_date, notes }) => {
      const w = await resolveWorker(worker)
      if (!w) return { error: `עובד "${worker}" לא נמצא במערכת` }

      let projectId: string | null = null
      if (project) {
        const p = await resolveProject(project)
        if (p) projectId = p.id
      }

      const { data, error } = await db
        .from('moshe_worker_tasks')
        .insert({
          worker_id: w.id,
          project_id: projectId,
          title: title.trim(),
          notes: notes?.trim() || null,
          due_date: due_date || null,
          is_done: false,
        })
        .select('*')
        .single()

      if (error) return { error: `שגיאה בהקצאת משימה: ${error.message}` }

      await writeMosheAudit(
        projectId,
        'create',
        'worker_task',
        `משימה חדשה הוקצתה ל-${w.name}: ${title}`,
        data.id,
        null,
        data
      )
      safeRevalidate(projectId || undefined)

      return {
        success: true,
        message: `משימה "${title}" הוקצתה בהצלחה ל-${w.name}`,
        task: data,
      }
    },
  },

  {
    name: 'moshe_toggle_worker_task',
    titleHebrew: 'סימון משימת עובד כהושלמה / פתוחה',
    category: 'workers',
    description: 'מסמן משימה של עובד אתר כהושלמה או מחזיר אותה לסטטוס פתוח.',
    schema: z.object({
      task_id: z.string().uuid().describe('מזהה UUID של המשימה'),
      is_done: z.boolean().default(true).describe('האם המשימה הושלמה (true) או פתוחה (false)'),
    }),
    execute: async ({ task_id, is_done }) => {
      const { data, error } = await db
        .from('moshe_worker_tasks')
        .update({
          is_done,
          done_at: is_done ? new Date().toISOString() : null,
        })
        .eq('id', task_id)
        .select('*')
        .single()

      if (error) return { error: `שגיאה בעדכון משימה: ${error.message}` }
      safeRevalidate()

      return {
        success: true,
        message: is_done ? 'המשימה סומנה כהושלמה' : 'המשימה הוחזרה לסטטוס פתוח',
        task: data,
      }
    },
  },

  // =========================================================================
  // 10. AUDIT & RESTORE (יומן פעילויות ושחזור פעולות)
  // =========================================================================

  {
    name: 'moshe_get_audit_log',
    titleHebrew: 'יומן פעילויות והיסטוריית שינויים',
    category: 'audit',
    description:
      'מחזיר רשימת פעולות אחרונות שבוצעו במערכת (יצירה, עריכה, מחיקה ושחזור), כולל שמות משתמשים ותאריכים. ניתן לסנן לפי פרויקט או לחפש טקסט.',
    schema: z.object({
      project: z.string().optional().describe('שם הפרויקט או מזהה UUID שלו לסינון (אופציונלי)'),
      limit: z.number().optional().default(25).describe('מספר רשומות להחזיר (ברירת מחדל: 25)'),
      query: z.string().optional().describe('חיפוש טקסט חופשי בתיאור הפעולה'),
    }),
    execute: async ({ project, limit, query }) => {
      let q = db
        .from('moshe_audit_log')
        .select('id, project_id, user_name, user_email, action_type, entity_type, entity_id, description, is_undone, created_at')
        .order('created_at', { ascending: false })
        .limit(limit || 25)

      if (project) {
        const proj = await resolveProject(project)
        if (proj) q = q.eq('project_id', proj.id)
      }
      if (query && query.trim()) {
        q = q.ilike('description', `%${query.trim()}%`)
      }

      const { data, error } = await q
      if (error) return { error: `שגיאה בשליפת יומן פעילויות: ${error.message}` }

      return {
        count: (data || []).length,
        logs: (data || []).map((l: any) => ({
          id: l.id,
          time: l.created_at,
          user: l.user_name || l.user_email || 'משה',
          action: l.action_type,
          entity: l.entity_type,
          description: l.description,
          is_undone: !!l.is_undone,
        })),
      }
    },
  },

  {
    name: 'moshe_restore_audit_action',
    titleHebrew: 'שחזור וביטול פעולה מהיומן (Undo / Restore)',
    category: 'audit',
    description:
      'משחזר באופן מידי רשומה שנמחקה או מחזיר ערכים שנערכו בעבר ישירות לפי מזהה יומן הפעילות (audit_id). מתאים לבוט שמקבל הוראה: "תבטל את המחיקה האחרונה של התשלום".',
    schema: z.object({
      audit_id: z.string().uuid().describe('מזהה ה-UUID של הפעולה ביומן לשחזור (ניתן לקבל מ-moshe_get_audit_log)'),
    }),
    execute: async ({ audit_id }) => {
      const { data: audit } = await db.from('moshe_audit_log').select('*').eq('id', audit_id).maybeSingle()
      if (!audit) return { error: 'רשומת יומן לא נמצאה' }
      if (audit.is_undone) return { error: 'פעולה זו כבר בוטלה או שוחזרה בעבר' }

      const snapshot = audit.previous_snapshot || audit.undo_snapshot
      if (audit.action_type !== 'create' && !snapshot) {
        return { error: 'לא ניתן לשחזר — אין נתוני היסטוריה (snapshot) שמורים לרשומה זו' }
      }

      const tableMap: Record<string, string> = {
        payment: 'moshe_project_payments',
        buyer_payment: 'moshe_buyer_payments',
        buyer: 'moshe_buyers',
        transaction: 'moshe_transactions',
        loan: 'moshe_loans',
        loan_payment: 'moshe_loan_payments',
        loan_receipt: 'moshe_loan_receipts',
        partner: 'moshe_partners',
        partner_transaction: 'moshe_partner_transactions',
        neighbor: 'moshe_neighbors',
        neighbor_payment: 'moshe_neighbor_payments',
        document: 'moshe_project_documents',
        project: 'moshe_projects',
      }
      const table = tableMap[audit.entity_type]
      if (!table) return { error: `סוג ישות "${audit.entity_type}" אינו נתמך לשחזור אוטומטי` }

      if (audit.action_type === 'delete') {
        const { payments: nestedPayments, ...recordToInsert } = snapshot as Record<string, unknown>
        const { error } = await db.from(table).insert(recordToInsert)
        if (error) return { error: `שגיאה בשחזור רשומה: ${error.message}` }

        if (Array.isArray(nestedPayments) && nestedPayments.length > 0) {
          await db.from('moshe_buyer_payments').insert(nestedPayments)
        }
      } else if (audit.action_type === 'create') {
        if (!audit.entity_id) return { error: 'לא ניתן לבטל יצירה — מזהה ישות חסר' }
        const { error } = await db.from(table).delete().eq('id', audit.entity_id)
        if (error) return { error: `שגיאה בביטול יצירה: ${error.message}` }
      } else if (audit.action_type === 'update') {
        if (!audit.entity_id) return { error: 'לא ניתן לבטל עדכון — מזהה ישות חסר' }
        const { error } = await db.from(table).update(snapshot).eq('id', audit.entity_id)
        if (error) return { error: `שגיאה בביטול עדכון: ${error.message}` }
      }

      await db
        .from('moshe_audit_log')
        .update({
          is_undone: true,
          undone_at: new Date().toISOString(),
        })
        .eq('id', audit_id)

      await writeMosheAudit(
        audit.project_id,
        'restore',
        audit.entity_type,
        `שוחזרה הפעולה: "${audit.description}"`,
        audit.entity_id
      )
      safeRevalidate(audit.project_id)

      return {
        success: true,
        message: `הפעולה "${audit.description}" שוחזרה בהצלחה`,
      }
    },
  },

  // =========================================================================
  // 11. MACRO FINANCE & GLOBAL SEARCH (מאקרו פיננסי וחיפוש גלובלי)
  // =========================================================================

  {
    name: 'moshe_get_finance_summary',
    titleHebrew: 'מאזן כספי כולל (כל הפרויקטים)',
    category: 'finance',
    description:
      'מחזיר סקירה פיננסית כוללת של כל הפרויקטים הפעילים של משה: סה"כ כסף בקופה, סה"כ שולם, סה"כ לוח תשלומים שנקבע, סה"כ הכנסות שהתקבלו מקונים, והלוואות.',
    schema: z.object({}),
    execute: async () => {
      const { data: projects } = await db
        .from('moshe_projects')
        .select('id, name, address, status, total_project_cost')
        .neq('status', 'closed')
      const projs = projects || []

      const [
        { data: projPayments },
        { data: buyerPayments },
        { data: transactions },
        { data: partnerTransactions },
        { data: loanReceipts },
        { data: loanPayments },
        { data: neighborPayments },
        { data: buyers },
      ] = await Promise.all([
        db.from('moshe_project_payments').select('project_id, amount, is_paid, payment_type'),
        db.from('moshe_buyer_payments').select('project_id, amount, is_received, payment_type'),
        db.from('moshe_transactions').select('project_id, amount, type'),
        db.from('moshe_partner_transactions').select('project_id, amount, type'),
        db.from('moshe_loan_receipts').select('project_id, amount, is_received'),
        db.from('moshe_loan_payments').select('project_id, amount, is_paid, is_interest'),
        db.from('moshe_neighbor_payments').select('project_id, amount, is_paid'),
        db.from('moshe_buyers').select('id, project_id, name, total_amount'),
      ])

      const pp = projPayments || []
      const bp = buyerPayments || []
      const tx = transactions || []
      const ptx = partnerTransactions || []
      const lr = loanReceipts || []
      const lp = loanPayments || []
      const np = neighborPayments || []
      const bu = buyers || []

      const neighborPaidAll = np
        .filter((x: any) => x.is_paid)
        .reduce((s: number, x: any) => s + Number(x.amount), 0)
      const neighborScheduledAll = np.reduce((s: number, x: any) => s + Number(x.amount), 0)

      const totalPaidAll =
        pp
          .filter((x: any) => x.payment_type === 'movement' || (!x.payment_type && x.is_paid))
          .reduce((s: number, x: any) => s + Number(x.amount), 0) + neighborPaidAll
      const totalScheduledAll =
        pp
          .filter((x: any) => x.payment_type === 'schedule' || (!x.payment_type && !x.is_paid))
          .reduce((s: number, x: any) => s + Number(x.amount), 0) + neighborScheduledAll

      const totalReceivedAll = bp
        .filter((x: any) => x.payment_type === 'movement' || (!x.payment_type && x.is_received))
        .reduce((s: number, x: any) => s + Number(x.amount), 0)
      const totalExpectedAll = bp
        .filter((x: any) => x.payment_type === 'schedule' || (!x.payment_type && !x.is_received))
        .reduce((s: number, x: any) => s + Number(x.amount), 0)

      const txIncome = tx.filter((x: any) => x.type === 'income').reduce((s: number, x: any) => s + Number(x.amount), 0)
      const txExpense = tx.filter((x: any) => x.type === 'expense').reduce((s: number, x: any) => s + Number(x.amount), 0)

      const totalInvested = ptx
        .filter((x: any) => x.type === 'investment')
        .reduce((s: number, x: any) => s + Number(x.amount), 0)
      const totalWithdrawn = ptx
        .filter((x: any) => x.type === 'withdrawal')
        .reduce((s: number, x: any) => s + Number(x.amount), 0)
      const ptxExpense = ptx
        .filter((x: any) => x.type === 'expense')
        .reduce((s: number, x: any) => s + Number(x.amount), 0)

      const loanReceived = lr.filter((r: any) => r.is_received).reduce((s: number, r: any) => s + Number(r.amount), 0)
      const loanPaid = lp
        .filter((p: any) => p.is_paid && !p.is_interest)
        .reduce((s: number, p: any) => s + Number(p.amount), 0)

      const totalCashInFund =
        totalReceivedAll + txIncome + totalInvested + loanReceived -
        (totalPaidAll + txExpense + ptxExpense + totalWithdrawn + loanPaid)

      const projectsBreakdown = projs.map((proj: any) => {
        const pId = proj.id
        const pNeighborPaid = np
          .filter((x: any) => x.project_id === pId && x.is_paid)
          .reduce((s: number, x: any) => s + Number(x.amount), 0)
        const pNeighborSched = np
          .filter((x: any) => x.project_id === pId)
          .reduce((s: number, x: any) => s + Number(x.amount), 0)
        const pPaid =
          pp
            .filter((x: any) => x.project_id === pId && (x.payment_type === 'movement' || (!x.payment_type && x.is_paid)))
            .reduce((s: number, x: any) => s + Number(x.amount), 0) + pNeighborPaid
        const pScheduled =
          pp
            .filter((x: any) => x.project_id === pId && (x.payment_type === 'schedule' || (!x.payment_type && !x.is_paid)))
            .reduce((s: number, x: any) => s + Number(x.amount), 0) + pNeighborSched
        const pReceived = bp
          .filter((x: any) => x.project_id === pId && (x.payment_type === 'movement' || (!x.payment_type && x.is_received)))
          .reduce((s: number, x: any) => s + Number(x.amount), 0)
        const pExpected = bp
          .filter((x: any) => x.project_id === pId && (x.payment_type === 'schedule' || (!x.payment_type && !x.is_received)))
          .reduce((s: number, x: any) => s + Number(x.amount), 0)
        const pBuyersCount = bu.filter((b: any) => b.project_id === pId).length

        return {
          id: pId,
          name: proj.name,
          status: proj.status,
          total_project_cost: proj.total_project_cost ? Number(proj.total_project_cost) : null,
          buyers_count: pBuyersCount,
          paid_actual: pPaid,
          scheduled_total: pScheduled,
          remaining_to_pay: pScheduled - pPaid,
          received_from_buyers: pReceived,
          expected_from_buyers: pExpected,
          remaining_from_buyers: pExpected - pReceived,
        }
      })

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
          loanReceived,
          loanPaid,
          netLoans: loanReceived - loanPaid,
          totalInvested,
          totalWithdrawn,
          partnerExpenses: ptxExpense,
        },
        projects_breakdown: projectsBreakdown,
      }
    },
  },

  {
    name: 'moshe_search',
    titleHebrew: 'חיפוש גלובלי מהיר',
    category: 'search',
    description:
      'חיפוש גלובלי מהיר בפורטל משה לפי כל מילת חיפוש: מוצא פרויקטים, קונים, שותפים, עובדים, שכנים ומלווים לפי שם, טלפון, דירה או תיאור.',
    schema: z.object({
      query: z.string().min(2, 'נדרשות לפחות 2 אותיות לחיפוש').describe('מילת חיפוש (שם אדם, רחוב, מספר טלפון וכו\')'),
    }),
    execute: async ({ query }) => {
      const q = `%${query.trim()}%`

      const [
        { data: projects },
        { data: buyers },
        { data: partners },
        { data: workers },
        { data: neighbors },
        { data: loans },
      ] = await Promise.all([
        db.from('moshe_projects').select('id, name, address, status, total_project_cost').or(`name.ilike.${q},address.ilike.${q}`),
        db.from('moshe_buyers').select('id, project_id, name, phone, unit_description, total_amount').or(`name.ilike.${q},phone.ilike.${q},unit_description.ilike.${q}`),
        db.from('moshe_partners').select('id, project_id, name, phone, email').or(`name.ilike.${q},phone.ilike.${q}`),
        db.from('moshe_workers').select('id, name, phone, role').or(`name.ilike.${q},phone.ilike.${q},role.ilike.${q}`),
        db.from('moshe_neighbors').select('id, project_id, name, phone, email, notes, total_amount').or(`name.ilike.${q},phone.ilike.${q},notes.ilike.${q}`),
        db.from('moshe_loans').select('id, project_id, lender, total_amount').ilike('lender', q),
      ])

      const totalMatches =
        (projects?.length || 0) +
        (buyers?.length || 0) +
        (partners?.length || 0) +
        (workers?.length || 0) +
        (neighbors?.length || 0) +
        (loans?.length || 0)

      return {
        query: query.trim(),
        total_matches: totalMatches,
        results: {
          projects: projects || [],
          buyers: buyers || [],
          partners: partners || [],
          workers: workers || [],
          neighbors: neighbors || [],
          loans: loans || [],
        },
      }
    },
  },

  {
    name: 'moshe_get_full_backup_report',
    titleHebrew: 'דוח גיבוי מלא ומאורגן של כל הפורטל',
    category: 'finance',
    description:
      'שולף גיבוי ודוח מלא ומסודר של כל נתוני פורטל משה (כל הפרויקטים, הקונים, לוחות התשלומים, התנועות בפועל, ההלוואות, השותפים, השכנים והעובדים) במבנה היררכי ברור.',
    schema: z.object({
      includeRawTables: z
        .boolean()
        .optional()
        .default(false)
        .describe('האם לכלול גם את הטבלאות הגולמיות המלאות (ברירת מחדל: false כדי לשמור על פלט קריא ומסודר)'),
    }),
    execute: async ({ includeRawTables }) => {
      const backup = await buildMosheOrganizedBackup('mcp-bot')
      if (includeRawTables) {
        return backup
      }
      return {
        created_at: backup.created_at,
        macro_summary: backup.macro_summary,
        organized_projects: backup.organized_projects,
        workers: backup.workers,
        calendar_events: backup.calendar_events,
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
