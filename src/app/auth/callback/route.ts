import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { resolveUserDestination, isAdminEmail, isMosheEmail } from '@/lib/auth-helpers'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = searchParams.get('next')

  const forwardedHost = request.headers.get('x-forwarded-host')
  const isLocalEnv = process.env.NODE_ENV === 'development'
  const baseUrl = isLocalEnv ? origin : (forwardedHost ? `https://${forwardedHost}` : origin)

  // Target destination
  let targetPath = next && next.startsWith('/') ? next : '/reset-password'
  if (type === 'recovery') {
    targetPath = '/reset-password'
  }

  const response = NextResponse.redirect(`${baseUrl}${targetPath}`)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // 1. Verify token_hash if provided
  if (token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      type: type as any,
      token_hash,
    })
    if (!error && data?.user) {
      if (type === 'recovery' || targetPath === '/reset-password') {
        return response
      }
      const user = data.user
      const destination = resolveUserDestination(user.email)
      return NextResponse.redirect(`${baseUrl}${destination}`, {
        headers: response.headers,
      })
    }
  }

  // 2. Exchange code for session if code is provided
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data?.user) {
      if (type === 'recovery' || targetPath === '/reset-password') {
        return response
      }
      const user = data.user
      if (isAdminEmail(user.email)) {
        const adminRes = NextResponse.redirect(`${baseUrl}/admin/dashboard`)
        response.cookies.getAll().forEach(c => adminRes.cookies.set(c.name, c.value))
        return adminRes
      }
      if (isMosheEmail(user.email)) {
        const mosheRes = NextResponse.redirect(`${baseUrl}/moshe`)
        response.cookies.getAll().forEach(c => mosheRes.cookies.set(c.name, c.value))
        return mosheRes
      }
      const destination = resolveUserDestination(user.email)
      const destRes = NextResponse.redirect(`${baseUrl}${destination}`)
      response.cookies.getAll().forEach(c => destRes.cookies.set(c.name, c.value))
      return destRes
    }
  }

  // If there's an error or no code/token, redirect to forgot-password
  return NextResponse.redirect(`${baseUrl}/forgot-password?error=link_expired`)
}
