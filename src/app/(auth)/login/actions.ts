'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as adminDb } from '@supabase/supabase-js'

const db = adminDb(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function loginWithEmail(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: error.message }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'אימות נכשל' }

  revalidatePath('/', 'layout')

  // Moshe portal
  if (email === process.env.MOSHE_EMAIL) redirect('/moshe')

  // Admin
  if (email === process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
    await (supabase.from('profiles') as any)
      .update({ full_name: 'נחמיה דרוק', role: 'admin' })
      .eq('id', user.id)
    redirect('/admin/dashboard')
  }

  // Admin team members (profiles) take priority over moshe_workers
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const role = (profile as any)?.role
  if (role === 'admin') redirect('/admin/dashboard')
  if (role === 'employee') redirect('/employee/dashboard')

  // Worker portal
  const { data: worker } = await db
    .from('moshe_workers').select('id, is_active').eq('email', email).single()
  if (worker?.is_active) redirect('/worker-portal')

  // Partner portal
  const { data: partner } = await db
    .from('moshe_partners').select('id').eq('email', email).eq('portal_access', true).single()
  if (partner) redirect('/partner-portal')

  redirect('/employee/dashboard')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

