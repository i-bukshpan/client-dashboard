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
  // 1. Create the user in Supabase Auth
  // We generate a random password or a temporary one (e.g., ChangeMe123!)
  const tempPassword = Math.random().toString(36).slice(-10) + 'Aa1!'
  
  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: formData.email,
    password: tempPassword,
    email_confirm: true, // Auto-confirm email
    user_metadata: { full_name: formData.name, role: 'employee' }
  })

  if (authError) {
    console.error('Auth Error:', authError)
    return { error: 'שגיאה ביצירת משתמש במערכת האימות' }
  }

  // 2. Update the profile (Trigger might handle this, but we ensure it)
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({ 
      full_name: formData.name,
      salary_base: formData.salary,
      role: 'employee'
    })
    .eq('id', authUser.user.id)

  if (profileError) {
    return { error: 'המשתמש נוצר אך חלה שגיאה בעדכון הפרופיל' }
  }

  revalidatePath('/admin/team')
  return { success: true, tempPassword } // In real app, send this via email
}
