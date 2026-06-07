/**
 * src/ai/context.ts
 *
 * פענוח contact_id (מספר טלפון מוואטסאפ) לסוג משתמש והרשאות.
 *
 * סדר בדיקה:
 * 1. env vars — BOT_ADMIN_PHONE → admin, BOT_MOSHE_PHONE → moshe_admin
 * 2. טבלת bot_contacts ב-DB (workers / partners שנרשמו ידנית)
 * 3. moshe_workers.phone — fallback אוטומטי
 * 4. moshe_partners.phone — fallback אוטומטי
 */

import { createClient } from '@supabase/supabase-js'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type UserRole = 'admin' | 'moshe_admin' | 'worker' | 'partner' | 'unknown'

export interface UserContext {
  role: UserRole
  refId?: string          // UUID מהטבלה המתאימה
  name?: string
  phone: string
  /** פרויקטים שהמשתמש מורשה לראות (null = גישה לכולם) */
  allowedProjectIds: string[] | null
  /** שמות הכלים שמותרים לרול זה */
  allowedTools: string[]
}

// ─── מיפוי רול → כלים מותרים ────────────────────────────────────────────────

const TOOL_PERMISSIONS: Record<UserRole, string[]> = {
  admin: [
    // כספים כלליים
    'getFinanceSummary', 'addIncome', 'addExpense',
    // פגישות
    'getUpcomingAppointments', 'createAppointment', 'cancelAppointment', 'updateAppointmentStatus',
    // משימות עובדי משרד
    'getOpenTasks', 'createTask', 'updateTaskStatus', 'getWorkerTasks',
    // לקוחות
    'searchClients', 'getClientDetails', 'createClient',
    // פרויקטי משה (גישת admin מלאה)
    'listProjects', 'getProjectSummary', 'getProjectBalance',
    'addBuyer', 'addProjectPayment', 'markPaymentPaid',
    'addTransaction', 'getPendingPayments',
    // שותפים
    'getPartnerSummary', 'listPartners', 'addPartnerTransaction',
    // עובדי משה
    'listWorkers', 'getWorkerTasksMoshe', 'addWorkerLog', 'completeWorkerTask',
    // הלוואות
    'getLoansSummary', 'getPendingLoanPayments', 'markLoanPaymentPaid',
  ],
  moshe_admin: [
    // פרויקטים
    'listProjects', 'getProjectSummary', 'getProjectBalance',
    'addBuyer', 'addProjectPayment', 'markPaymentPaid',
    'addTransaction', 'getPendingPayments',
    // שותפים
    'getPartnerSummary', 'listPartners', 'addPartnerTransaction',
    // עובדי משה
    'listWorkers', 'getWorkerTasksMoshe', 'addWorkerLog', 'completeWorkerTask',
    // הלוואות
    'getLoansSummary', 'getPendingLoanPayments', 'markLoanPaymentPaid',
  ],
  worker: [
    // עובד — רק על עצמו
    'getWorkerTasksMoshe', 'addWorkerLog', 'completeWorkerTask',
  ],
  partner: [
    // שותף — רק הפרויקטים שלו
    'listProjects', 'getProjectSummary', 'getProjectBalance',
    'getPartnerSummary', 'getPendingPayments',
  ],
  unknown: [],
}

// ─── פענוח המשתמש ─────────────────────────────────────────────────────────────

export async function resolveUserContext(contactId: string): Promise<UserContext> {
  // נרמול: הסר + מוביל, רווחים, מקפים
  const phone = contactId.replace(/^\+/, '').replace(/[\s\-()]/g, '')

  // 1. בדיקת env — מנהל כללי
  const adminPhone = (process.env.BOT_ADMIN_PHONE || '').replace(/^\+/, '').trim()
  if (adminPhone && phone === adminPhone) {
    return {
      role: 'admin',
      phone,
      name: 'מנהל',
      allowedProjectIds: null,
      allowedTools: TOOL_PERMISSIONS.admin,
    }
  }

  // 2. בדיקת env — משה
  const moshePhone = (process.env.BOT_MOSHE_PHONE || '').replace(/^\+/, '').trim()
  if (moshePhone && phone === moshePhone) {
    return {
      role: 'moshe_admin',
      phone,
      name: 'משה',
      allowedProjectIds: null,
      allowedTools: TOOL_PERMISSIONS.moshe_admin,
    }
  }

  // 3. בדיקת טבלת bot_contacts (מאפשר רישום ידני גמיש)
  const { data: botContact } = await db
    .from('bot_contacts')
    .select('user_type, ref_id, name')
    .eq('phone', phone)
    .eq('is_active', true)
    .maybeSingle()

  if (botContact) {
    const role = botContact.user_type as UserRole
    let allowedProjectIds: string[] | null = null

    if (role === 'partner' && botContact.ref_id) {
      allowedProjectIds = await getPartnerProjectIds(botContact.ref_id)
    }

    return {
      role,
      refId: botContact.ref_id ?? undefined,
      name: botContact.name ?? undefined,
      phone,
      allowedProjectIds,
      allowedTools: TOOL_PERMISSIONS[role] ?? [],
    }
  }

  // 4. Fallback — חיפוש אוטומטי ב-moshe_workers לפי phone
  // נסה פורמטים שונים: 972XXXXXXXXX, 0XXXXXXXXX
  const localPhone = phone.startsWith('972') ? '0' + phone.slice(3) : phone
  const intlPhone = phone.startsWith('0') ? '972' + phone.slice(1) : phone

  const { data: worker } = await db
    .from('moshe_workers')
    .select('id, name')
    .or(`phone.eq.${phone},phone.eq.${localPhone},phone.eq.${intlPhone}`)
    .eq('is_active', true)
    .maybeSingle()

  if (worker) {
    return {
      role: 'worker',
      refId: worker.id,
      name: worker.name,
      phone,
      allowedProjectIds: null, // עובד רואה רק משימות שלו (מסוננות לפי worker_id)
      allowedTools: TOOL_PERMISSIONS.worker,
    }
  }

  // 5. Fallback — חיפוש ב-moshe_partners לפי phone
  const { data: partner } = await db
    .from('moshe_partners')
    .select('id, name, project_id')
    .or(`phone.eq.${phone},phone.eq.${localPhone},phone.eq.${intlPhone}`)
    .maybeSingle()

  if (partner) {
    // שותף יכול לראות רק פרויקטים שיש לו בהם חלק
    const allProjectIds = await getPartnerAllProjectIds(partner.id)
    return {
      role: 'partner',
      refId: partner.id,
      name: partner.name,
      phone,
      allowedProjectIds: allProjectIds,
      allowedTools: TOOL_PERMISSIONS.partner,
    }
  }

  // לא זוהה
  return {
    role: 'unknown',
    phone,
    allowedProjectIds: [],
    allowedTools: [],
  }
}

// ── עזרים ─────────────────────────────────────────────────────────────────────

/** שולף את כל ה-project_ids שלשותף יש בהם השקעה */
async function getPartnerProjectIds(partnerId: string): Promise<string[]> {
  const { data } = await db
    .from('moshe_partners')
    .select('project_id')
    .eq('id', partnerId)
  return (data ?? []).map((r: any) => r.project_id).filter(Boolean)
}

/** שולף את כל הפרויקטים שהשותף מופיע בהם (שם זהה — שותף בכמה פרויקטים) */
async function getPartnerAllProjectIds(partnerId: string): Promise<string[]> {
  const { data } = await db
    .from('moshe_partners')
    .select('project_id')
    .eq('id', partnerId)
  return (data ?? []).map((r: any) => r.project_id).filter(Boolean)
}

/** בדיקה שכלי מסוים מותר לרול נתון */
export function isToolAllowed(ctx: UserContext, toolName: string): boolean {
  return ctx.allowedTools.includes(toolName)
}
