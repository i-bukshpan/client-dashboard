'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function loginWithEmail(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: error.message }
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'אימות נכשל' }

  console.log('Login attempt for:', email)

  // Force Admin role determination for specific email early
  let role: string = 'employee'
  
  if (email === process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
    console.log('Admin email detected. Forcing admin role update...')
    // We use update instead of upsert because RLS blocks INSERTS for non-admins,
    // but the user can UPDATE their own profile.
    const { data: updatedProfile, error: updateError } = await (supabase.from('profiles') as any)
      .update({ 
        full_name: 'נחמיה דרוק', 
        role: 'admin' 
      })
      .eq('id', user.id)
      .select('role')
      .single()
    
    if (updateError) {
      console.error('FAILED to update admin profile:', updateError)
      // Even if DB fails, if email is admin, we want to treat as admin
      role = 'admin'
    } else {
      role = updatedProfile?.role || 'admin'
    }
  } else {
    // Normal profile check for others
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    role = (profile as any)?.role || 'employee'
  }

  console.log('Final determined role:', role)

  revalidatePath('/', 'layout')
  
  if (role === 'admin') {
    console.log('Redirecting to ADMIN dashboard')
    redirect('/admin/dashboard')
  } else {
    console.log('Redirecting to EMPLOYEE dashboard')
    redirect('/employee/dashboard')
  }
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

