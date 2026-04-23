import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Routes that employees cannot access
const ADMIN_ONLY_ROUTES = ['/admin/finance', '/admin/team']

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Allow public routes
  if (
    pathname === '/' ||
    pathname.startsWith('/privacy') ||
    pathname.startsWith('/terms') ||
    pathname.startsWith('/support') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api')
  ) {
    // Redirect logged-in users away from login
    if (user && pathname === '/login') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      const dest = (profile as any)?.role === 'admin' ? '/admin/dashboard' : '/employee/dashboard'
      return NextResponse.redirect(new URL(dest, request.url))
    }
    return supabaseResponse
  }

  // Not logged in → redirect to login
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Role-based guard
  if (ADMIN_ONLY_ROUTES.some((r) => pathname.startsWith(r))) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if ((profile as any)?.role !== 'admin') {
      return NextResponse.redirect(new URL('/employee/dashboard', request.url))
    }
  }

  // Employee trying to access admin area
  if (pathname.startsWith('/admin')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if ((profile as any)?.role !== 'admin') {
      return NextResponse.redirect(new URL('/employee/dashboard', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

