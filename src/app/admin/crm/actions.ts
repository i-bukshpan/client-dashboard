'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function inviteClientToPortal(clientId: string, email: string, name: string) {
  if (!email) return { error: 'ללקוח אין כתובת אימייל רשומה' }

  // 1. Invite via Supabase Auth
  const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    email,
    { data: { full_name: name, role: 'client' } }
  )

  if (inviteError) {
    console.error('Invite Error:', inviteError)
    return { error: `שגיאה בשליחת הזמנה: ${inviteError.message}` }
  }

  const authUser = inviteData.user

  // 2. Ensure profile exists and role is client
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

  // 3. Link client record to auth user
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
