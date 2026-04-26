'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
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

export async function updateEmployee(id: string, data: {
  name: string
  email: string
  salary: number
}) {
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ 
      full_name: data.name,
      email: data.email,
      salary_base: data.salary
    })
    .eq('id', id)

  if (error) {
    console.error('Update Error:', error)
    return { error: `שגיאה בעדכון הפרטים: ${error.message}` }
  }

  revalidatePath('/admin/team')
  return { success: true }
}

export async function updateEmployeePassword(id: string, password: string) {
  const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { password })

  if (error) {
    console.error('Password Update Error:', error)
    return { error: `שגיאה בעדכון הסיסמה: ${error.message}` }
  }

  return { success: true }
}

export async function recordEmployeePayment(data: {
  employeeId: string
  employeeName: string
  amount: number
  date: string
}) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabaseAdmin
    .from('expenses')
    .insert({
      amount: data.amount,
      category: 'משכורות',
      date: data.date,
      notes: `תשלום משכורת ל${data.employeeName} [EMP:${data.employeeId}]`,
      created_by: user?.id || null
    })

  if (error) {
    console.error('Payment Record Error:', error)
    return { error: `שגיאה ברישום התשלום: ${error.message}` }
  }

  revalidatePath('/admin/team')
  revalidatePath('/admin/finance')
  return { success: true }
}

export async function addEmployeeBonus(data: {
  employeeId: string
  amount: number
  reason: string
  date: string
}) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabaseAdmin
    .from('employee_bonuses')
    .insert({
      employee_id: data.employeeId,
      amount: data.amount,
      reason: data.reason,
      date: data.date,
      created_by: user?.id || null
    })

  if (error) {
    console.error('Bonus Add Error:', error)
    return { error: `שגיאה בהוספת תוספת: ${error.message}` }
  }

  revalidatePath('/admin/team')
  return { success: true }
}

export async function deleteEmployee(id: string) {
  // Delete the auth user (this will cascade to the profile if RLS/Triggers are set up, 
  // but we'll also delete the profile explicitly to be sure)
  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id)
  
  if (authError) {
    console.error('Delete Auth Error:', authError)
    // If user not found in Auth, still try to delete profile
    if (authError.message.includes('User not found')) {
       await supabaseAdmin.from('profiles').delete().eq('id', id)
       revalidatePath('/admin/team')
       return { success: true }
    }
    return { error: `שגיאה במחיקת המשתמש: ${authError.message}` }
  }

  const { error: profileError } = await supabaseAdmin.from('profiles').delete().eq('id', id)
  
  if (profileError) {
    console.error('Delete Profile Error:', profileError)
    return { error: `המשתמש נמחק מהאימות אך חלה שגיאה במחיקת הפרופיל: ${profileError.message}` }
  }

  revalidatePath('/admin/team')
  return { success: true }
}

export async function updateEmployeeBonus(id: string, data: {
  amount: number
  reason: string
  date: string
}) {
  const { error } = await supabaseAdmin
    .from('employee_bonuses')
    .update({
      amount: data.amount,
      reason: data.reason,
      date: data.date
    })
    .eq('id', id)

  if (error) {
    console.error('Bonus Update Error:', error)
    return { error: `שגיאה בעדכון התוספת: ${error.message}` }
  }

  revalidatePath('/admin/team')
  return { success: true }
}

export async function deleteEmployeeBonus(id: string) {
  const { error } = await supabaseAdmin
    .from('employee_bonuses')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Bonus Delete Error:', error)
    return { error: `שגיאה במחיקת התוספת: ${error.message}` }
  }

  revalidatePath('/admin/team')
  return { success: true }
}
