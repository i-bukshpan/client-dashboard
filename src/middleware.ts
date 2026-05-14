import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

const adminDb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  const isAdminEmail = (email?: string | null) => email === process.env.NEXT_PUBLIC_ADMIN_EMAIL
  const isMosheEmail = (email?: string | null) => email === process.env.MOSHE_EMAIL

  // Public routes
  if (
    pathname === '/' ||
    pathname.startsWith('/privacy') ||
    pathname.startsWith('/terms') ||
    pathname.startsWith('/support') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/worker-manifest.json' ||
    pathname === '/moshe-manifest.json' ||
    pathname === '/sw.js'
  ) {
    // Redirect logged-in users away from login to their correct portal
    if (user && pathname === '/login') {
      if (isAdminEmail(user.email)) {
        return NextResponse.redirect(new URL('/admin/dashboard', request.url))
      }
      if (isMosheEmail(user.email)) {
        return NextResponse.redirect(new URL('/moshe', request.url))
      }
      // Admin team members (profiles) take priority over moshe_workers
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()
      const role = (profile as any)?.role
      if (role === 'admin') {
        return NextResponse.redirect(new URL('/admin/dashboard', request.url))
      }
      if (role === 'employee') {
        return NextResponse.redirect(new URL('/employee/dashboard', request.url))
      }
      // Check worker
      const { data: worker } = await adminDb
        .from('moshe_workers').select('id, is_active').eq('email', user.email).single()
      if (worker?.is_active) {
        return NextResponse.redirect(new URL('/worker-portal', request.url))
      }
      // Check partner
      const { data: partner } = await adminDb
        .from('moshe_partners').select('id').eq('email', user.email).eq('portal_access', true).single()
      if (partner) {
        return NextResponse.redirect(new URL('/partner-portal', request.url))
      }
      return NextResponse.redirect(new URL('/employee/dashboard', request.url))
    }
    return supabaseResponse
  }

  // Not logged in → login
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // /worker-portal/* — only active workers
  if (pathname.startsWith('/worker-portal')) {
    const { data: worker } = await adminDb
      .from('moshe_workers').select('id, is_active').eq('email', user.email).single()
    if (!worker?.is_active) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return supabaseResponse
  }

  // /partner-portal/* — only partners with portal access
  if (pathname.startsWith('/partner-portal')) {
    const { data: partner } = await adminDb
      .from('moshe_partners').select('id').eq('email', user.email).eq('portal_access', true).single()
    if (!partner) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return supabaseResponse
  }

  // /moshe/* — only admin or Moshe
  if (pathname.startsWith('/moshe')) {
    if (!isAdminEmail(user.email) && !isMosheEmail(user.email)) {
      // Check DB role for admin
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()
      if ((profile as any)?.role !== 'admin') {
        return NextResponse.redirect(new URL('/employee/dashboard', request.url))
      }
    }
    return supabaseResponse
  }

  // /admin/* — only admin
  if (pathname.startsWith('/admin')) {
    if (!isAdminEmail(user.email)) {
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()
      const role = (profile as any)?.role
      if (role !== 'admin') {
        // Moshe trying to access admin → redirect to his portal
        if (isMosheEmail(user.email)) {
          return NextResponse.redirect(new URL('/moshe', request.url))
        }
        return NextResponse.redirect(new URL('/employee/dashboard', request.url))
      }
    }
    return supabaseResponse
  }

  // /employee/* — block Moshe from employee area
  if (pathname.startsWith('/employee')) {
    if (isMosheEmail(user.email)) {
      return NextResponse.redirect(new URL('/moshe', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|worker-manifest.json|moshe-manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
