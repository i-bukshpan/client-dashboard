'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

  revalidatePath('/moshe/projects')
  revalidatePath(`/moshe/projects/${id}`)
  return { success: true }
}

export async function deleteProject(id: string) {
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

// ─── Transactions ──────────────────────────────────────────────────

export async function createTransaction(raw: unknown) {
  const parsed = transactionSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'נתונים לא תקינים' }
  const d = parsed.data

  const { error } = await db.from('moshe_transactions').insert({
    project_id: d.project_id,
    type: d.type,
    amount: parseFloat(d.amount),
    date: d.date,
    category: d.category || null,
    notes: d.notes || null,
  })

  if (error) return { error: `שגיאה בשמירת העסקה: ${error.message}` }
  revalidatePath(`/moshe/projects/${d.project_id}`)
  revalidatePath('/moshe/finance')
  revalidatePath('/moshe')
  return { success: true }
}

export async function deleteTransaction(id: string, projectId: string) {
  const { error } = await db.from('moshe_transactions').delete().eq('id', id)
  if (error) return { error: `שגיאה במחיקת העסקה: ${error.message}` }
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
  }).eq('id', id)

  if (error) return { error: `שגיאה בעדכון: ${error.message}` }
  revalidatePath(`/moshe/projects/${(tx as any)?.project_id}`)
  revalidatePath('/moshe/finance')
  return { success: true }
}

// ─── Activity Log ──────────────────────────────────────────────────

export async function addLog(projectId: string, action: string, details?: string, actor?: string) {
  const { error } = await db.from('moshe_project_logs').insert({
    project_id: projectId,
    actor: actor || 'משה',
    action,
    details: details || null,
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
