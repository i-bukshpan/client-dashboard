import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        const dest = (profile as any)?.role === 'admin' ? '/admin/dashboard' : '/employee/dashboard'
        return NextResponse.redirect(new URL(dest, origin))
      }
    }
  }
  return NextResponse.redirect(new URL('/login?error=auth_failed', origin))
}

