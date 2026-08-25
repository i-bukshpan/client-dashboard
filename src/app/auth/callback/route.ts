import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveUserDestination, isAdminEmail, isMosheEmail } from '@/lib/auth-helpers'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')
  const type = searchParams.get('type')

  const forwardedHost = request.headers.get('x-forwarded-host')
  const isLocalEnv = process.env.NODE_ENV === 'development'
  const baseUrl = isLocalEnv ? origin : (forwardedHost ? `https://${forwardedHost}` : origin)

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data?.user) {
      // If a specific next path was requested (e.g. /reset-password)
      if (next && next.startsWith('/')) {
        return NextResponse.redirect(`${baseUrl}${next}`)
      }

      // If recovery type flow, direct user to reset-password
      if (type === 'recovery') {
        return NextResponse.redirect(`${baseUrl}/reset-password`)
      }

      // Otherwise determine destination based on user's authorized email / role
      const user = data.user
      if (isAdminEmail(user.email)) {
        return NextResponse.redirect(`${baseUrl}/admin/dashboard`)
      }
      if (isMosheEmail(user.email)) {
        return NextResponse.redirect(`${baseUrl}/moshe`)
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      const role = (profile as any)?.role
      const destination = resolveUserDestination(user.email, role)
      return NextResponse.redirect(`${baseUrl}${destination}`)
    }
  }

  // If there's an error or no code, redirect to reset-password if type is recovery, else login
  if (type === 'recovery' || next === '/reset-password') {
    return NextResponse.redirect(`${baseUrl}/reset-password?error=invalid_link`)
  }

  return NextResponse.redirect(`${baseUrl}/login?error=auth-code-error`)
}
