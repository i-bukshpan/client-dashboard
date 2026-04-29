'use server'

import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const updateClientSchema = z.object({
  name: z.string().min(2, 'שם מלא נדרש'),
  email: z.string().email('אימייל לא תקין').optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable(),
  id_number: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  birth_date: z.string().optional().nullable(),
  portfolio_value: z.number().optional().nullable(),
  client_since: z.string().optional().nullable(),
  meeting_frequency: z.string().optional().nullable(),
  risk_level: z.string().optional().nullable(),
  advisory_goal: z.string().optional().nullable(),
  advisory_track: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
})

export async function updateClient(id: string, raw: unknown) {
  const parsed = updateClientSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'נתונים לא תקינים' }
  }

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'משתמש לא מחובר' }

  const data = parsed.data
  const { error } = await supabaseAdmin
    .from('clients')
    .update({
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      id_number: data.id_number || null,
      address: data.address || null,
      notes: data.notes || null,
      birth_date: data.birth_date || null,
      portfolio_value: data.portfolio_value ?? null,
      client_since: data.client_since || null,
      meeting_frequency: data.meeting_frequency || null,
      risk_level: data.risk_level || null,
      advisory_goal: data.advisory_goal || null,
      advisory_track: data.advisory_track || null,
      status: data.status || null,
    })
    .eq('id', id)

  if (error) {
    console.error('Update Client Error:', error)
    return { error: `שגיאה בעדכון הלקוח: ${error.message}` }
  }

  revalidatePath('/admin/crm')
  revalidatePath(`/admin/crm/${id}`)
  return { success: true }
}

export async function deleteClient(id: string) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'משתמש לא מחובר' }

  const { error } = await supabaseAdmin
    .from('clients')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Delete Client Error:', error)
    return { error: `שגיאה במחיקת הלקוח: ${error.message}` }
  }

  revalidatePath('/admin/crm')
  return { success: true }
}

export async function inviteClientToPortal(clientId: string, email: string, name: string) {
  if (!email) return { error: 'ללקוח אין כתובת אימייל רשומה' }

  const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    email,
    { data: { full_name: name, role: 'client' } }
  )

  if (inviteError) {
    console.error('Invite Error:', inviteError)
    return { error: `שגיאה בשליחת הזמנה: ${inviteError.message}` }
  }

  const authUser = inviteData.user

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert({
      id: authUser.id,
      full_name: name,
      email: email,
      role: 'client'
    })

  if (profileError) {
    console.error('Profile Error:', profileError)
    return { error: 'ההזמנה נשלחה אך חלה שגיאה בסנכרון הפרופיל' }
  }

  const { error: linkError } = await supabaseAdmin
    .from('clients')
    .update({ user_id: authUser.id })
    .eq('id', clientId)

  if (linkError) {
    console.error('Link Error:', linkError)
    return { error: 'ההזמנה נשלחה אך חלה שגיאה בקישור הלקוח' }
  }

  revalidatePath('/admin/crm')
  return { success: true }
}
