'use server'

import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getCurrentUserEmail(): Promise<string> {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user?.email ?? 'משה'
  } catch {
    return 'משה'
  }
}

async function writeAudit(
  projectId: string | null,
  actionType: 'create' | 'update' | 'delete',
  entityType: string,
  description: string,
  entityId?: string,
  snapshot?: Record<string, unknown> | null
) {
  const userEmail = await getCurrentUserEmail()
  await db.from('moshe_audit_log').insert({
    project_id: projectId,
    user_email: userEmail,
    user_name: userEmail,
    action_type: actionType,
    entity_type: entityType,
    entity_id: entityId ?? null,
    description,
    undo_snapshot: snapshot ?? null,
  })
}

// ─── Schemas ──────────────────────────────────────────────────────

const paymentRowSchema = z.object({
  amount: z.string().min(1),
  due_date: z.string().optional(),
  notes: z.string().optional(),
})

const projectSchema = z.object({
  name: z.string().min(1, 'שם הפרויקט נדרש'),
  address: z.string().optional(),
  contact_name: z.string().optional(),
  contact_phone: z.string().optional(),
  total_project_cost: z.string().optional(),
  notes: z.string().optional(),
  start_date: z.string().optional(),
  status: z.enum(['active', 'pending', 'closed']).default('active'),
  payments: z.array(paymentRowSchema).optional().default([]),
})

const buyerSchema = z.object({
  project_id: z.string().uuid(),
  name: z.string().min(1, 'שם הקונה נדרש'),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  id_number: z.string().optional(),
  unit_description: z.string().optional(),
  contract_date: z.string().optional(),
  total_amount: z.string().optional(),
  notes: z.string().optional(),
  payments: z.array(paymentRowSchema).optional().default([]),
})

const transactionSchema = z.object({
  project_id: z.string().uuid(),
  type: z.enum(['income', 'expense']),
  amount: z.string().min(1, 'סכום נדרש'),
  date: z.string().min(1, 'תאריך נדרש'),
  category: z.string().optional(),
  notes: z.string().optional(),
  partner_id: z.string().uuid().optional().or(z.literal('')),
  partner_tx_type: z.enum(['investment', 'withdrawal']).or(z.literal('')).optional(),
})

const eventSchema = z.object({
  title: z.string().min(1, 'כותרת נדרשת'),
  start_time: z.string().min(1, 'תאריך התחלה נדרש'),
  end_time: z.string().optional(),
  notes: z.string().optional(),
  type: z.enum(['meeting', 'reminder', 'other']).default('meeting'),
})

// ─── Projects ─────────────────────────────────────────────────────

export async function createProject(raw: unknown) {
  const parsed = projectSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'נתונים לא תקינים' }
  const { payments, ...data } = parsed.data

  const { data: project, error } = await db
    .from('moshe_projects')
    .insert({
      name: data.name,
      address: data.address || null,
      contact_name: data.contact_name || null,
      contact_phone: data.contact_phone || null,
      total_project_cost: data.total_project_cost ? parseFloat(data.total_project_cost) : null,
      notes: data.notes || null,
      start_date: data.start_date || null,
      status: data.status,
    })
    .select('id')
    .single()

  if (error) return { error: `שגיאה ביצירת הפרויקט: ${error.message}` }

  await writeAudit(project.id, 'create', 'project', `פרויקט חדש נוצר: ${data.name}`, project.id)

  if (payments.length > 0) {
    const rows = payments
      .filter(p => p.amount)
      .map(p => ({
        project_id: project.id,
        amount: parseFloat(p.amount),
        due_date: p.due_date || null,
        notes: p.notes || null,
      }))
    if (rows.length > 0) {
      const { error: pErr } = await db.from('moshe_project_payments').insert(rows)
      if (pErr) return { error: `הפרויקט נוצר אך חלה שגיאה בשמירת לוח התשלומים: ${pErr.message}` }
    }
  }

  revalidatePath('/moshe')
  revalidatePath('/moshe/projects')
  return { success: true, id: project.id }
}

export async function updateProject(id: string, raw: unknown) {
  const parsed = projectSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'נתונים לא תקינים' }
  const { payments: _, ...data } = parsed.data

  const { error } = await db
    .from('moshe_projects')
    .update({
      name: data.name,
      address: data.address || null,
      contact_name: data.contact_name || null,
      contact_phone: data.contact_phone || null,
      total_project_cost: data.total_project_cost ? parseFloat(data.total_project_cost) : null,
      notes: data.notes || null,
      start_date: data.start_date || null,
      status: data.status,
    })
    .eq('id', id)

  if (error) return { error: `שגיאה בעדכון הפרויקט: ${error.message}` }

  await writeAudit(id, 'update', 'project', `פרויקט עודכן: ${data.name}`, id)
  revalidatePath('/moshe/projects')
  revalidatePath(`/moshe/projects/${id}`)
  return { success: true }
}

export async function deleteProject(id: string) {
  await writeAudit(id, 'delete', 'project', `פרויקט נמחק`, id)
  const { error } = await db.from('moshe_projects').delete().eq('id', id)
  if (error) return { error: `שגיאה במחיקת הפרויקט: ${error.message}` }
  revalidatePath('/moshe/projects')
  return { success: true }
}

// ─── Project Payments ──────────────────────────────────────────────

export async function addProjectPayment(raw: unknown) {
  const schema = z.object({
    project_id: z.string().uuid(),
    amount: z.string().min(1, 'סכום נדרש'),
    due_date: z.string().optional(),
    notes: z.string().optional(),
  })
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'נתונים לא תקינים' }
  const d = parsed.data

  const { error } = await db.from('moshe_project_payments').insert({
    project_id: d.project_id,
    amount: parseFloat(d.amount),
    due_date: d.due_date || null,
    notes: d.notes || null,
  })

  if (error) return { error: `שגיאה בהוספת תשלום: ${error.message}` }
  revalidatePath(`/moshe/projects/${d.project_id}`)
  revalidatePath('/moshe/calendar')
  return { success: true }
}

export async function toggleProjectPayment(id: string, projectId: string, isPaid: boolean) {
  const { error } = await db
    .from('moshe_project_payments')
    .update({ is_paid: isPaid, paid_at: isPaid ? new Date().toISOString() : null })
    .eq('id', id)

  if (error) return { error: `שגיאה בעדכון התשלום: ${error.message}` }
  await writeAudit(projectId, 'update', 'payment', isPaid ? 'תשלום פרויקט סומן כשולם' : 'תשלום פרויקט בוטל כשולם')
  revalidatePath(`/moshe/projects/${projectId}`)
  revalidatePath('/moshe')
  revalidatePath('/moshe/calendar')
  return { success: true }
}

export async function deleteProjectPayment(id: string, projectId: string) {
  const { error } = await db.from('moshe_project_payments').delete().eq('id', id)
  if (error) return { error: `שגיאה במחיקת תשלום: ${error.message}` }
  revalidatePath(`/moshe/projects/${projectId}`)
  revalidatePath('/moshe/calendar')
  return { success: true }
}

// ─── Buyers ───────────────────────────────────────────────────────

export async function createBuyer(raw: unknown) {
  const parsed = buyerSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'נתונים לא תקינים' }
  const { payments, ...data } = parsed.data

  const { data: buyer, error } = await db
    .from('moshe_buyers')
    .insert({
      project_id: data.project_id,
      name: data.name,
      phone: data.phone || null,
      email: data.email || null,
      id_number: data.id_number || null,
      unit_description: data.unit_description || null,
      contract_date: data.contract_date || null,
      total_amount: data.total_amount ? parseFloat(data.total_amount) : null,
      notes: data.notes || null,
    })
    .select('id')
    .single()

  if (error) return { error: `שגיאה בהוספת קונה: ${error.message}` }

  await writeAudit(data.project_id, 'create', 'buyer', `קונה חדש נוסף: ${data.name}`, buyer.id)

  if (payments.length > 0) {
    const rows = payments
      .filter(p => p.amount)
      .map(p => ({
        buyer_id: buyer.id,
        project_id: data.project_id,
        amount: parseFloat(p.amount),
        due_date: p.due_date || null,
        notes: p.notes || null,
      }))
    if (rows.length > 0) {
      const { error: pErr } = await db.from('moshe_buyer_payments').insert(rows)
      if (pErr) return { error: `הקונה נוסף אך חלה שגיאה בשמירת לוח תשלומים: ${pErr.message}` }
    }
  }

  revalidatePath(`/moshe/projects/${data.project_id}`)
  revalidatePath('/moshe/calendar')
  return { success: true }
}

export async function deleteBuyer(id: string, projectId: string) {
  await writeAudit(projectId, 'delete', 'buyer', `קונה נמחק`, id)
  const { error } = await db.from('moshe_buyers').delete().eq('id', id)
  if (error) return { error: `שגיאה במחיקת קונה: ${error.message}` }
  revalidatePath(`/moshe/projects/${projectId}`)
  return { success: true }
}

export async function toggleBuyerPayment(id: string, projectId: string, isReceived: boolean) {
  const { error } = await db
    .from('moshe_buyer_payments')
    .update({ is_received: isReceived, received_at: isReceived ? new Date().toISOString() : null })
    .eq('id', id)

  if (error) return { error: `שגיאה בעדכון התשלום: ${error.message}` }
  await writeAudit(projectId, 'update', 'buyer_payment', isReceived ? 'תשלום קונה סומן כהתקבל' : 'תשלום קונה בוטל כהתקבל')
  revalidatePath(`/moshe/projects/${projectId}`)
  revalidatePath('/moshe')
  revalidatePath('/moshe/calendar')
  return { success: true }
}

export async function addBuyerPayment(raw: unknown) {
  const schema = z.object({
    buyer_id: z.string().uuid(),
    project_id: z.string().uuid(),
    amount: z.string().min(1, 'סכום נדרש'),
    due_date: z.string().optional(),
    notes: z.string().optional(),
  })
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'נתונים לא תקינים' }
  const d = parsed.data

  const { error } = await db.from('moshe_buyer_payments').insert({
    buyer_id: d.buyer_id,
    project_id: d.project_id,
    amount: parseFloat(d.amount),
    due_date: d.due_date || null,
    notes: d.notes || null,
  })

  if (error) return { error: `שגיאה בהוספת תשלום: ${error.message}` }
  revalidatePath(`/moshe/projects/${d.project_id}`)
  revalidatePath('/moshe/calendar')
  return { success: true }
}

export async function deleteBuyerPayment(id: string, projectId: string) {
  const { error } = await db.from('moshe_buyer_payments').delete().eq('id', id)
  if (error) return { error: `שגיאה במחיקת תשלום: ${error.message}` }
  revalidatePath(`/moshe/projects/${projectId}`)
  revalidatePath('/moshe/calendar')
  return { success: true }
}

// ─── Partial Payments ──────────────────────────────────────────────

export async function makePartialProjectPayment(
  id: string, projectId: string, partialAmount: number,
  partialDate?: string, partialNotes?: string
) {
  // Get current payment
  const { data: payment, error: fetchErr } = await db
    .from('moshe_project_payments')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchErr || !payment) return { error: 'תשלום לא נמצא' }

  const originalAmount = Number(payment.amount)
  if (partialAmount <= 0 || partialAmount >= originalAmount) {
    return { error: 'סכום חלקי חייב להיות בין 0 לסכום המקורי' }
  }

  const remaining = originalAmount - partialAmount

  // Update original payment with remaining amount
  const { error: updateErr } = await db
    .from('moshe_project_payments')
    .update({ amount: remaining })
    .eq('id', id)

  if (updateErr) return { error: `שגיאה בעדכון: ${updateErr.message}` }

  // Build notes for partial payment
  const originalLabel = payment.notes || 'תשלום'
  const noteText = partialNotes
    ? `${partialNotes} (חלקי מ: ${originalLabel})`
    : `תשלום חלקי מ: ${originalLabel}`

  // Create new payment record for the paid partial amount
  const { error: insertErr } = await db.from('moshe_project_payments').insert({
    project_id: projectId,
    amount: partialAmount,
    due_date: partialDate || payment.due_date,
    notes: noteText,
    is_paid: true,
    paid_at: new Date().toISOString(),
  })

  if (insertErr) return { error: `שגיאה ביצירת תשלום חלקי: ${insertErr.message}` }

  revalidatePath(`/moshe/projects/${projectId}`)
  revalidatePath('/moshe')
  revalidatePath('/moshe/calendar')
  return { success: true }
}

export async function makePartialBuyerPayment(
  id: string, projectId: string, buyerId: string, partialAmount: number,
  partialDate?: string, partialNotes?: string
) {
  // Get current payment
  const { data: payment, error: fetchErr } = await db
    .from('moshe_buyer_payments')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchErr || !payment) return { error: 'תשלום לא נמצא' }

  const originalAmount = Number(payment.amount)
  if (partialAmount <= 0 || partialAmount >= originalAmount) {
    return { error: 'סכום חלקי חייב להיות בין 0 לסכום המקורי' }
  }

  const remaining = originalAmount - partialAmount

  // Update original payment with remaining amount
  const { error: updateErr } = await db
    .from('moshe_buyer_payments')
    .update({ amount: remaining })
    .eq('id', id)

  if (updateErr) return { error: `שגיאה בעדכון: ${updateErr.message}` }

  // Build notes for partial payment
  const originalLabel = payment.notes || 'תשלום'
  const noteText = partialNotes
    ? `${partialNotes} (חלקי מ: ${originalLabel})`
    : `תשלום חלקי מ: ${originalLabel}`

  // Create new payment record for the received partial amount
  const { error: insertErr } = await db.from('moshe_buyer_payments').insert({
    buyer_id: buyerId,
    project_id: projectId,
    amount: partialAmount,
    due_date: partialDate || payment.due_date,
    notes: noteText,
    is_received: true,
    received_at: new Date().toISOString(),
  })

  if (insertErr) return { error: `שגיאה ביצירת תשלום חלקי: ${insertErr.message}` }

  revalidatePath(`/moshe/projects/${projectId}`)
  revalidatePath('/moshe')
  revalidatePath('/moshe/calendar')
  return { success: true }
}

// ─── Transactions ──────────────────────────────────────────────────

export async function createTransaction(raw: unknown) {
  const parsed = transactionSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'נתונים לא תקינים' }
  const d = parsed.data

  const { data: tx, error } = await db.from('moshe_transactions').insert({
    project_id: d.project_id,
    type: d.type,
    amount: parseFloat(d.amount),
    date: d.date,
    category: d.category || null,
    notes: d.notes || null,
    partner_id: d.partner_id || null,
  }).select('id').single()

  if (error) return { error: `שגיאה בשמירת העסקה: ${error.message}` }

  // Also create a partner transaction if flagged
  if (d.partner_tx_type && d.partner_id) {
    await db.from('moshe_partner_transactions').insert({
      partner_id: d.partner_id,
      project_id: d.project_id,
      type: d.partner_tx_type,
      amount: parseFloat(d.amount),
      date: d.date,
      notes: d.notes || null,
      source_transaction_id: tx.id,
    })
  }

  await writeAudit(d.project_id, 'create', 'transaction',
    `${d.type === 'income' ? 'הכנסה' : 'הוצאה'} נרשמה: ₪${Number(d.amount).toLocaleString('he-IL')}${d.notes ? ` - ${d.notes}` : ''}`)
  revalidatePath(`/moshe/projects/${d.project_id}`)
  revalidatePath('/moshe/finance')
  revalidatePath('/moshe')
  return { success: true }
}

export async function deleteTransaction(id: string, projectId: string) {
  const { data: old } = await db.from('moshe_transactions').select('*').eq('id', id).single()
  const { error } = await db.from('moshe_transactions').delete().eq('id', id)
  if (error) return { error: `שגיאה במחיקת העסקה: ${error.message}` }
  await writeAudit(projectId, 'delete', 'transaction', `עסקה נמחקה`, id, old as Record<string, unknown> ?? null)
  revalidatePath(`/moshe/projects/${projectId}`)
  revalidatePath('/moshe/finance')
  return { success: true }
}

// ─── Calendar Events ───────────────────────────────────────────────

export async function createCalendarEvent(raw: unknown) {
  const parsed = eventSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'נתונים לא תקינים' }
  const d = parsed.data

  const { error } = await db.from('moshe_calendar_events').insert({
    title: d.title,
    start_time: d.start_time,
    end_time: d.end_time || null,
    notes: d.notes || null,
    type: d.type,
  })

  if (error) return { error: `שגיאה ביצירת האירוע: ${error.message}` }
  revalidatePath('/moshe/calendar')
  return { success: true }
}

export async function deleteCalendarEvent(id: string) {
  const { error } = await db.from('moshe_calendar_events').delete().eq('id', id)
  if (error) return { error: `שגיאה במחיקת האירוע: ${error.message}` }
  revalidatePath('/moshe/calendar')
  return { success: true }
}

// ─── Update actions ────────────────────────────────────────────────

export async function updateProjectPayment(id: string, raw: unknown) {
  const schema = z.object({
    amount: z.string().min(1, 'סכום נדרש'),
    due_date: z.string().optional(),
    notes: z.string().optional(),
  })
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'נתונים לא תקינים' }
  const d = parsed.data

  const { data: payment } = await db.from('moshe_project_payments').select('project_id').eq('id', id).single()
  const { error } = await db.from('moshe_project_payments').update({
    amount: parseFloat(d.amount),
    due_date: d.due_date || null,
    notes: d.notes || null,
  }).eq('id', id)

  if (error) return { error: `שגיאה בעדכון: ${error.message}` }
  await writeAudit((payment as any)?.project_id, 'update', 'payment', `תשלום פרויקט עודכן: ₪${Number(d.amount).toLocaleString('he-IL')}`)
  revalidatePath(`/moshe/projects/${(payment as any)?.project_id}`)
  revalidatePath('/moshe/calendar')
  revalidatePath('/moshe/finance')
  return { success: true }
}

export async function updateBuyerPayment(id: string, raw: unknown) {
  const schema = z.object({
    amount: z.string().min(1, 'סכום נדרש'),
    due_date: z.string().optional(),
    notes: z.string().optional(),
  })
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'נתונים לא תקינים' }
  const d = parsed.data

  const { data: payment } = await db.from('moshe_buyer_payments').select('project_id').eq('id', id).single()
  const { error } = await db.from('moshe_buyer_payments').update({
    amount: parseFloat(d.amount),
    due_date: d.due_date || null,
    notes: d.notes || null,
  }).eq('id', id)

  if (error) return { error: `שגיאה בעדכון: ${error.message}` }
  await writeAudit((payment as any)?.project_id, 'update', 'buyer_payment', `תשלום קונה עודכן: ₪${Number(d.amount).toLocaleString('he-IL')}`)
  revalidatePath(`/moshe/projects/${(payment as any)?.project_id}`)
  revalidatePath('/moshe/calendar')
  revalidatePath('/moshe/finance')
  return { success: true }
}

export async function updateTransaction(id: string, raw: unknown) {
  const schema = z.object({
    type: z.enum(['income', 'expense']),
    amount: z.string().min(1, 'סכום נדרש'),
    date: z.string().min(1, 'תאריך נדרש'),
    category: z.string().optional(),
    notes: z.string().optional(),
    partner_id: z.string().uuid().optional().or(z.literal('')),
  })
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'נתונים לא תקינים' }
  const d = parsed.data

  const { data: tx } = await db.from('moshe_transactions').select('project_id').eq('id', id).single()
  const { error } = await db.from('moshe_transactions').update({
    type: d.type,
    amount: parseFloat(d.amount),
    date: d.date,
    category: d.category || null,
    notes: d.notes || null,
    partner_id: d.partner_id || null,
  }).eq('id', id)

  if (error) return { error: `שגיאה בעדכון: ${error.message}` }
  await writeAudit((tx as any)?.project_id, 'update', 'transaction', `${d.type === 'income' ? 'הכנסה' : 'הוצאה'} עודכנה: ₪${Number(d.amount).toLocaleString('he-IL')}${d.notes ? ` - ${d.notes}` : ''}`)
  revalidatePath(`/moshe/projects/${(tx as any)?.project_id}`)
  revalidatePath('/moshe/finance')
  return { success: true }
}

// ─── Activity Log ──────────────────────────────────────────────────

export async function addLog(projectId: string, action: string, details?: string, actor?: string, logDate?: string) {
  const { error } = await db.from('moshe_project_logs').insert({
    project_id: projectId,
    actor: actor || 'משה',
    action,
    details: details || null,
    log_date: logDate || null,
  })
  if (error) return { error: `שגיאה בכתיבת לוג: ${error.message}` }
  revalidatePath(`/moshe/projects/${projectId}`)
  return { success: true }
}

export async function deleteLog(id: string, projectId: string) {
  const { error } = await db.from('moshe_project_logs').delete().eq('id', id)
  if (error) return { error: `שגיאה במחיקת רשומה: ${error.message}` }
  revalidatePath(`/moshe/projects/${projectId}`)
  return { success: true }
}

// ─── Drive link ────────────────────────────────────────────────────

export async function updateDriveLink(projectId: string, url: string) {
  const { error } = await db
    .from('moshe_projects')
    .update({ drive_folder_url: url || null })
    .eq('id', projectId)

  if (error) return { error: `שגיאה בעדכון קישור דרייב: ${error.message}` }
  revalidatePath(`/moshe/projects/${projectId}`)
  return { success: true }
}

// ─── Documents ─────────────────────────────────────────────────────

export async function addDocument(raw: unknown) {
  const schema = z.object({
    project_id: z.string().uuid(),
    name: z.string().min(1, 'שם הקובץ נדרש'),
    url: z.string().url('כתובת URL לא תקינה'),
  })
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'נתונים לא תקינים' }
  const d = parsed.data

  const { error } = await db.from('moshe_project_documents').insert({
    project_id: d.project_id,
    name: d.name,
    url: d.url,
  })

  if (error) return { error: `שגיאה בהוספת מסמך: ${error.message}` }
  revalidatePath(`/moshe/projects/${d.project_id}`)
  return { success: true }
}

export async function deleteDocument(id: string, projectId: string) {
  const { error } = await db.from('moshe_project_documents').delete().eq('id', id)
  if (error) return { error: `שגיאה במחיקת מסמך: ${error.message}` }
  revalidatePath(`/moshe/projects/${projectId}`)
  return { success: true }
}

export async function updateDocument(id: string, raw: unknown) {
  const schema = z.object({
    name: z.string().min(1, 'שם נדרש'),
    url: z.string().url('כתובת URL לא תקינה'),
  })
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'נתונים לא תקינים' }
  const d = parsed.data

  const { data: doc } = await db.from('moshe_project_documents').select('project_id').eq('id', id).single()
  const { error } = await db.from('moshe_project_documents').update({ name: d.name, url: d.url }).eq('id', id)

  if (error) return { error: `שגיאה בעדכון מסמך: ${error.message}` }
  revalidatePath(`/moshe/projects/${(doc as any)?.project_id}`)
  return { success: true }
}

export async function updateCalendarEvent(id: string, raw: unknown) {
  const schema = z.object({
    title: z.string().min(1, 'כותרת נדרשת'),
    start_time: z.string().min(1, 'תאריך נדרש'),
    end_time: z.string().optional(),
    notes: z.string().optional(),
    type: z.enum(['meeting', 'reminder', 'other']).default('meeting'),
  })
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'נתונים לא תקינים' }
  const d = parsed.data

  const { error } = await db.from('moshe_calendar_events').update({
    title: d.title,
    start_time: d.start_time,
    end_time: d.end_time || null,
    notes: d.notes || null,
    type: d.type,
  }).eq('id', id)

  if (error) return { error: `שגיאה בעדכון: ${error.message}` }
  revalidatePath('/moshe/calendar')
  return { success: true }
}

export async function updateBuyer(id: string, raw: unknown) {
  const schema = z.object({
    name: z.string().min(1, 'שם נדרש'),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    id_number: z.string().optional(),
    unit_description: z.string().optional(),
    contract_date: z.string().optional(),
    total_amount: z.string().optional(),
    notes: z.string().optional(),
  })
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'נתונים לא תקינים' }
  const d = parsed.data

  const { data: buyer } = await db.from('moshe_buyers').select('project_id').eq('id', id).single()
  const { error } = await db.from('moshe_buyers').update({
    name: d.name,
    phone: d.phone || null,
    email: d.email || null,
    id_number: d.id_number || null,
    unit_description: d.unit_description || null,
    contract_date: d.contract_date || null,
    total_amount: d.total_amount ? parseFloat(d.total_amount) : null,
    notes: d.notes || null,
  }).eq('id', id)

  if (error) return { error: `שגיאה בעדכון: ${error.message}` }
  revalidatePath(`/moshe/projects/${(buyer as any)?.project_id}`)
  return { success: true }
}

// ─── Partners ──────────────────────────────────────────────────────

export async function createPartner(raw: unknown) {
  const schema = z.object({
    project_id: z.string().uuid(),
    name: z.string().min(1, 'שם השותף נדרש'),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    notes: z.string().optional(),
  })
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'נתונים לא תקינים' }
  const d = parsed.data

  const { error } = await db.from('moshe_partners').insert({
    project_id: d.project_id,
    name: d.name,
    phone: d.phone || null,
    email: d.email || null,
    notes: d.notes || null,
  })

  if (error) return { error: `שגיאה בהוספת שותף: ${error.message}` }
  await writeAudit(d.project_id, 'create', 'partner', `שותף חדש נוסף: ${d.name}`)
  revalidatePath(`/moshe/projects/${d.project_id}`)
  return { success: true }
}

export async function updatePartner(id: string, raw: unknown) {
  const schema = z.object({
    name: z.string().min(1, 'שם נדרש'),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    notes: z.string().optional(),
  })
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'נתונים לא תקינים' }
  const d = parsed.data

  const { data: partner } = await db.from('moshe_partners').select('project_id').eq('id', id).single()
  const { error } = await db.from('moshe_partners').update({
    name: d.name,
    phone: d.phone || null,
    email: d.email || null,
    notes: d.notes || null,
  }).eq('id', id)

  if (error) return { error: `שגיאה בעדכון שותף: ${error.message}` }
  revalidatePath(`/moshe/projects/${(partner as any)?.project_id}`)
  return { success: true }
}

export async function deletePartner(id: string, projectId: string) {
  await writeAudit(projectId, 'delete', 'partner', `שותף נמחק`, id)
  const { error } = await db.from('moshe_partners').delete().eq('id', id)
  if (error) return { error: `שגיאה במחיקת שותף: ${error.message}` }
  revalidatePath(`/moshe/projects/${projectId}`)
  return { success: true }
}

export async function createPartnerTransaction(raw: unknown) {
  const schema = z.object({
    partner_id: z.string().uuid(),
    project_id: z.string().uuid(),
    type: z.enum(['investment', 'withdrawal']),
    amount: z.string().min(1, 'סכום נדרש'),
    date: z.string().min(1, 'תאריך נדרש'),
    notes: z.string().optional(),
  })
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'נתונים לא תקינים' }
  const d = parsed.data

  const { error } = await db.from('moshe_partner_transactions').insert({
    partner_id: d.partner_id,
    project_id: d.project_id,
    type: d.type,
    amount: parseFloat(d.amount),
    date: d.date,
    notes: d.notes || null,
  })

  if (error) return { error: `שגיאה בהוספת תנועה: ${error.message}` }
  await writeAudit(d.project_id, 'create', 'partner_transaction',
    `${d.type === 'investment' ? 'השקעה' : 'משיכה'} של שותף: ₪${Number(d.amount).toLocaleString('he-IL')}`)
  revalidatePath(`/moshe/projects/${d.project_id}`)
  return { success: true }
}

export async function deletePartnerTransaction(id: string, projectId: string) {
  const { error } = await db.from('moshe_partner_transactions').delete().eq('id', id)
  if (error) return { error: `שגיאה במחיקת תנועה: ${error.message}` }
  revalidatePath(`/moshe/projects/${projectId}`)
  return { success: true }
}

// ─── Loans ─────────────────────────────────────────────────────────

export async function createLoan(raw: unknown) {
  const schema = z.object({
    project_id: z.string().uuid(),
    lender: z.string().min(1, 'שם המלווה נדרש'),
    arranged_by: z.string().uuid().optional().or(z.literal('')),
    total_amount: z.string().min(1, 'סכום נדרש'),
    interest_rate: z.string().optional(),
    num_payments: z.string().optional(),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
    notes: z.string().optional(),
  })
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'נתונים לא תקינים' }
  const d = parsed.data

  const totalAmount = parseFloat(d.total_amount)
  const numPayments = d.num_payments ? parseInt(d.num_payments) : 1

  const { data: loan, error } = await db.from('moshe_loans').insert({
    project_id: d.project_id,
    lender: d.lender,
    arranged_by: d.arranged_by || null,
    total_amount: totalAmount,
    interest_rate: d.interest_rate ? parseFloat(d.interest_rate) : null,
    num_payments: numPayments,
    start_date: d.start_date || null,
    end_date: d.end_date || null,
    notes: d.notes || null,
  }).select('id').single()

  if (error) return { error: `שגיאה ביצירת הלוואה: ${error.message}` }

  await writeAudit(d.project_id, 'create', 'loan', `הלוואה חדשה נרשמה מ-${d.lender}: ₪${totalAmount.toLocaleString('he-IL')}`, loan.id)

  // Auto-generate loan payment schedule
  if (numPayments > 0) {
    const paymentAmount = Math.round((totalAmount / numPayments) * 100) / 100
    const startDate = d.start_date ? new Date(d.start_date) : new Date()
    const rows = Array.from({ length: numPayments }, (_, i) => {
      const due = new Date(startDate)
      due.setMonth(due.getMonth() + i + 1)
      return {
        loan_id: loan.id,
        project_id: d.project_id,
        amount: i === numPayments - 1 ? Math.round((totalAmount - paymentAmount * (numPayments - 1)) * 100) / 100 : paymentAmount,
        due_date: due.toISOString().split('T')[0],
        notes: `תשלום ${i + 1} מתוך ${numPayments}`,
      }
    })
    const { error: pErr } = await db.from('moshe_loan_payments').insert(rows)
    if (pErr) return { error: `ההלוואה נוצרה אך חלה שגיאה ביצירת לוח תשלומים: ${pErr.message}` }
  }

  revalidatePath(`/moshe/projects/${d.project_id}`)
  return { success: true }
}

export async function deleteLoan(id: string, projectId: string) {
  const { data: old } = await db.from('moshe_loans').select('*').eq('id', id).single()
  const { error } = await db.from('moshe_loans').delete().eq('id', id)
  if (error) return { error: `שגיאה במחיקת הלוואה: ${error.message}` }
  await writeAudit(projectId, 'delete', 'loan', `הלוואה נמחקה`, id, old as Record<string, unknown> ?? null)
  revalidatePath(`/moshe/projects/${projectId}`)
  return { success: true }
}

export async function toggleLoanPayment(id: string, projectId: string, isPaid: boolean) {
  const { error } = await db
    .from('moshe_loan_payments')
    .update({ is_paid: isPaid, paid_at: isPaid ? new Date().toISOString() : null })
    .eq('id', id)

  if (error) return { error: `שגיאה בעדכון תשלום: ${error.message}` }
  revalidatePath(`/moshe/projects/${projectId}`)
  return { success: true }
}

export async function addLoanPayment(raw: unknown) {
  const schema = z.object({
    loan_id: z.string().uuid(),
    project_id: z.string().uuid(),
    amount: z.string().min(1, 'סכום נדרש'),
    due_date: z.string().optional(),
    notes: z.string().optional(),
  })
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'נתונים לא תקינים' }
  const d = parsed.data

  const { error } = await db.from('moshe_loan_payments').insert({
    loan_id: d.loan_id,
    project_id: d.project_id,
    amount: parseFloat(d.amount),
    due_date: d.due_date || null,
    notes: d.notes || null,
  })

  if (error) return { error: `שגיאה בהוספת תשלום: ${error.message}` }
  revalidatePath(`/moshe/projects/${d.project_id}`)
  return { success: true }
}

export async function deleteLoanPayment(id: string, projectId: string) {
  const { error } = await db.from('moshe_loan_payments').delete().eq('id', id)
  if (error) return { error: `שגיאה במחיקת תשלום: ${error.message}` }
  revalidatePath(`/moshe/projects/${projectId}`)
  return { success: true }
}

export async function updateLoan(id: string, raw: unknown) {
  const schema = z.object({
    project_id: z.string().uuid(),
    lender: z.string().min(1, 'שם המלווה נדרש'),
    arranged_by: z.string().uuid().optional().or(z.literal('')),
    total_amount: z.string().min(1, 'סכום נדרש'),
    interest_rate: z.string().optional(),
    num_payments: z.string().optional(),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
    notes: z.string().optional(),
  })
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'נתונים לא תקינים' }
  const d = parsed.data

  const { error } = await db.from('moshe_loans').update({
    lender: d.lender,
    arranged_by: d.arranged_by || null,
    total_amount: parseFloat(d.total_amount),
    interest_rate: d.interest_rate ? parseFloat(d.interest_rate) : null,
    num_payments: d.num_payments ? parseInt(d.num_payments) : 1,
    start_date: d.start_date || null,
    end_date: d.end_date || null,
    notes: d.notes || null,
  }).eq('id', id)

  if (error) return { error: `שגיאה בעדכון הלוואה: ${error.message}` }
  await writeAudit(d.project_id, 'update', 'loan', `הלוואה עודכנה — ${d.lender}: ₪${Number(d.total_amount).toLocaleString('he-IL')}`)
  revalidatePath(`/moshe/projects/${d.project_id}`)
  return { success: true }
}

export async function ensureDefaultPartner(projectId: string) {
  // Check if Moshe Parush partner already exists for this project
  const { data: existing } = await db
    .from('moshe_partners')
    .select('id')
    .eq('project_id', projectId)
    .eq('name', 'משה פרוש')
    .single()

  if (existing) return { success: true, id: existing.id }

  const { data: partner, error } = await db.from('moshe_partners').insert({
    project_id: projectId,
    name: 'משה פרוש',
    notes: 'בעל האתר - שותף ברירת מחדל',
  }).select('id').single()

  if (error) return { error: `שגיאה ביצירת שותף ברירת מחדל: ${error.message}` }
  revalidatePath(`/moshe/projects/${projectId}`)
  return { success: true, id: partner.id }
}

// ─── Workers ───────────────────────────────────────────────────────

export async function createWorker(raw: unknown) {
  const schema = z.object({
    name: z.string().min(1, 'שם העובד נדרש'),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    role: z.enum(['worker', 'foreman']).default('worker'),
    notes: z.string().optional(),
  })
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'נתונים לא תקינים' }
  const d = parsed.data

  const { data: worker, error } = await db.from('moshe_workers').insert({
    name: d.name,
    phone: d.phone || null,
    email: d.email || null,
    role: d.role,
    notes: d.notes || null,
  }).select('id').single()

  if (error) return { error: `שגיאה בהוספת עובד: ${error.message}` }
  await writeAudit(null, 'create', 'worker', `עובד חדש נוסף: ${d.name}`, worker.id)
  revalidatePath('/moshe/workers')
  return { success: true, id: worker.id }
}

export async function updateWorker(id: string, raw: unknown) {
  const schema = z.object({
    name: z.string().min(1, 'שם נדרש'),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    role: z.enum(['worker', 'foreman']).default('worker'),
    notes: z.string().optional(),
    is_active: z.boolean().default(true),
  })
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'נתונים לא תקינים' }
  const d = parsed.data

  const { error } = await db.from('moshe_workers').update({
    name: d.name, phone: d.phone || null, email: d.email || null,
    role: d.role, notes: d.notes || null, is_active: d.is_active,
  }).eq('id', id)

  if (error) return { error: `שגיאה בעדכון עובד: ${error.message}` }
  revalidatePath('/moshe/workers')
  return { success: true }
}

export async function deleteWorker(id: string) {
  const { error } = await db.from('moshe_workers').delete().eq('id', id)
  if (error) return { error: `שגיאה במחיקת עובד: ${error.message}` }
  revalidatePath('/moshe/workers')
  return { success: true }
}

export async function setWorkerPermissions(
  workerId: string,
  projectIds: string[],
  canLog: boolean,
  canViewPayments: boolean = false,
  canViewBuyers: boolean = false,
) {
  await db.from('moshe_worker_project_permissions').delete().eq('worker_id', workerId)
  if (projectIds.length > 0) {
    const rows = projectIds.map(pid => ({
      worker_id: workerId,
      project_id: pid,
      can_view: true,
      can_log: canLog,
      can_view_payments: canViewPayments,
      can_view_buyers: canViewBuyers,
    }))
    const { error } = await db.from('moshe_worker_project_permissions').insert(rows)
    if (error) return { error: `שגיאה בשמירת הרשאות: ${error.message}` }
  }
  revalidatePath('/moshe/workers')
  return { success: true }
}

export async function addWorkerLog(raw: unknown) {
  const schema = z.object({
    worker_id: z.string().uuid(),
    project_id: z.string().uuid().optional().or(z.literal('')),
    log_date: z.string().min(1, 'תאריך נדרש'),
    note: z.string().min(1, 'הערה נדרשת'),
  })
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'נתונים לא תקינים' }
  const d = parsed.data

  const { error } = await db.from('moshe_worker_logs').insert({
    worker_id: d.worker_id,
    project_id: d.project_id || null,
    log_date: d.log_date,
    note: d.note,
  })

  if (error) return { error: `שגיאה בהוספת רשומה: ${error.message}` }
  revalidatePath('/moshe/workers')
  return { success: true }
}

export async function deleteWorkerLog(id: string) {
  const { error } = await db.from('moshe_worker_logs').delete().eq('id', id)
  if (error) return { error: `שגיאה במחיקת רשומה: ${error.message}` }
  revalidatePath('/moshe/workers')
  return { success: true }
}

// ─── Partner portal access ─────────────────────────────────────────

export async function togglePartnerPortalAccess(partnerId: string, enable: boolean) {
  const { data: partner } = await db.from('moshe_partners').select('project_id').eq('id', partnerId).single()
  const { error } = await db.from('moshe_partners').update({ portal_access: enable }).eq('id', partnerId)
  if (error) return { error: `שגיאה בעדכון הרשאה: ${error.message}` }
  revalidatePath(`/moshe/projects/${(partner as any)?.project_id}`)
  return { success: true }
}

// ─── Partner portal permissions ───────────────────────────────────

export async function updatePartnerPermissions(partnerId: string, perms: {
  can_view_payments: boolean
  can_view_buyers: boolean
  can_view_transactions: boolean
  can_view_loans: boolean
}) {
  const { error } = await db.from('moshe_partners').update(perms).eq('id', partnerId)
  if (error) return { error: `שגיאה: ${error.message}` }
  const { data: p } = await db.from('moshe_partners').select('project_id').eq('id', partnerId).single()
  revalidatePath(`/moshe/projects/${(p as any)?.project_id}`)
  return { success: true }
}

// ─── Portal user invite ────────────────────────────────────────────

// ─── Worker tasks ─────────────────────────────────────────────────

export async function createWorkerTask(data: {
  worker_id: string
  project_id?: string | null
  title: string
  notes?: string
  due_date?: string
}) {
  const { error } = await db.from('moshe_worker_tasks').insert({
    worker_id:  data.worker_id,
    project_id: data.project_id || null,
    title:      data.title,
    notes:      data.notes || null,
    due_date:   data.due_date || null,
  })
  if (error) return { error: `שגיאה: ${error.message}` }
  revalidatePath('/moshe/workers')
  revalidatePath('/worker-portal')
  return { success: true }
}

export async function deleteWorkerTask(id: string) {
  const { error } = await db.from('moshe_worker_tasks').delete().eq('id', id)
  if (error) return { error: `שגיאה: ${error.message}` }
  revalidatePath('/moshe/workers')
  revalidatePath('/worker-portal')
  return { success: true }
}

export async function toggleWorkerTask(id: string, isDone: boolean) {
  const { error } = await db.from('moshe_worker_tasks').update({
    is_done: isDone,
    done_at: isDone ? new Date().toISOString() : null,
  }).eq('id', id)
  if (error) return { error: `שגיאה: ${error.message}` }
  revalidatePath('/moshe/workers')
  revalidatePath('/worker-portal')
  return { success: true }
}

// ─── Portal user invite ────────────────────────────────────────────

export async function invitePortalUser(email: string) {
  const h = await headers()
  const host = h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? 'http'
  const redirectTo = `${proto}://${host}/reset-password`

  const { error } = await db.auth.admin.inviteUserByEmail(email, { redirectTo })
  if (error) return { error: `שגיאה בשליחת הזמנה: ${error.message}` }
  return { success: true }
}

// ─── Undo audit action ─────────────────────────────────────────────

export async function undoAuditAction(auditId: string) {
  const { data: audit } = await db
    .from('moshe_audit_log')
    .select('*')
    .eq('id', auditId)
    .single()

  if (!audit) return { error: 'רשומה לא נמצאה' }
  if ((audit as any).is_undone) return { error: 'פעולה זו כבר בוטלה' }

  const createdAt = new Date((audit as any).created_at)
  const diffMinutes = (Date.now() - createdAt.getTime()) / 60000
  if (diffMinutes > 10) return { error: 'פג תוקף הביטול (10 דקות)' }

  const snapshot = (audit as any).undo_snapshot
  if (!snapshot) return { error: 'לא ניתן לבטל — אין נתוני שחזור' }

  const tableMap: Record<string, string> = {
    transaction: 'moshe_transactions',
    loan: 'moshe_loans',
  }
  const table = tableMap[(audit as any).entity_type]
  if (!table) return { error: 'סוג ישות לא נתמך לשחזור' }

  if ((audit as any).action_type === 'delete') {
    const { error } = await db.from(table).insert(snapshot)
    if (error) return { error: `שגיאה בשחזור: ${error.message}` }
  }

  await db.from('moshe_audit_log').update({ is_undone: true }).eq('id', auditId)

  const pid = (audit as any).project_id
  if (pid) {
    revalidatePath(`/moshe/projects/${pid}`)
    revalidatePath('/moshe')
  }
  revalidatePath('/moshe/activity')
  return { success: true }
}
