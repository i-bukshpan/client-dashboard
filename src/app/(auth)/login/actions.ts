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

  let { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // Fallback: If no profile exists and it's the admin email, create it
  if (!profile && email === 'yb8511@gmail.com') {
    const { data: newProfile } = await supabase
      .from('profiles')
      .insert({ id: user.id, email, full_name: 'מנהל ראשי', role: 'admin' })
      .select('role')
      .single()
    profile = newProfile
  }

  revalidatePath('/', 'layout')
  const role = (profile as any)?.role
  redirect(role === 'admin' ? '/admin/dashboard' : '/employee/dashboard')
}

export async function loginWithGoogle() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/google/callback`,
    },
  })
  if (error || !data.url) return { error: error?.message ?? 'שגיאה' }
  redirect(data.url)
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
