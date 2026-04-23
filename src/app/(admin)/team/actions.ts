'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

// This client uses the SERVICE ROLE KEY to bypass RLS and manage auth users
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Required for admin actions
)

export async function createEmployee(formData: {
  name: string
  email: string
  salary: number
}) {
  // 1. Invite the user via Email
  const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    formData.email,
    { data: { full_name: formData.name, role: 'employee' } }
  )

  if (inviteError) {
    console.error('Invite Error:', inviteError)
    return { error: `שגיאה בשליחת הזמנה למייל: ${inviteError.message}` }
  }

  if (!inviteData.user) {
    return { error: 'לא התקבל משתמש ממערכת האימות' }
  }

  const authUser = inviteData.user;

  // 2. Update the profile (Trigger might handle this, but we ensure it)
  // Use upsert to handle cases where the trigger didn't fire or failed
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert({ 
      id: authUser.id,
      full_name: formData.name,
      email: formData.email,
      salary_base: formData.salary,
      role: 'employee'
    })

  if (profileError) {
    console.error('Profile Error:', profileError)
    // Rollback auth user creation if profile creation fails
    await supabaseAdmin.auth.admin.deleteUser(authUser.id)
    return { error: `המשתמש נוצר אך חלה שגיאה בעדכון הפרופיל: ${profileError.message}` }
  }

  revalidatePath('/admin/team')
  return { success: true }
}

export async function inviteExistingEmployee(email: string, name: string) {
  const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    email,
    { data: { full_name: name, role: 'employee' } }
  )

  if (inviteError) {
    console.error('Invite Error:', inviteError)
    return { error: `שגיאה בשליחת הזמנה: ${inviteError.message}` }
  }

  return { success: true }
}

