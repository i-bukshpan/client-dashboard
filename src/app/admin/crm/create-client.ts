'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const createClientSchema = z.object({
  name: z.string().min(2, 'שם מלא נדרש (לפחות 2 תווים)'),
  email: z.string().email('אימייל לא תקין').optional().or(z.literal('')),
  phone: z.string().optional(),
  id_number: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  drive_folder_id: z.string().optional().nullable(),
})

export async function createClientAction(raw: unknown) {
  const parsed = createClientSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'נתונים לא תקינים' }
  }

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'משתמש לא מחובר' }

  const data = parsed.data
  const { error } = await supabaseAdmin
    .from('clients')
    .insert({
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      id_number: data.id_number || null,
      address: data.address || null,
      notes: data.notes || null,
      drive_folder_id: data.drive_folder_id || null,
      created_by: user.id,
    })

  if (error) {
    console.error('Create Client Error:', error)
    return { error: `שגיאה בשמירת הלקוח: ${error.message}` }
  }

  revalidatePath('/admin/crm')
  return { success: true }
}
