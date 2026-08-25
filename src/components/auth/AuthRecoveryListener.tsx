'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Global listener that catches password recovery hash tokens or recovery state
 * and automatically redirects the user to /reset-password regardless of which page they landed on.
 */
export function AuthRecoveryListener() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (typeof window === 'undefined') return

    // If we are already on reset-password, no need to redirect
    if (pathname === '/reset-password') return

    const hash = window.location.hash
    const search = window.location.search

    // Check if URL hash or search params indicate a recovery event
    const hasRecoveryHash = hash.includes('type=recovery') || (hash.includes('access_token=') && hash.includes('type=recovery'))
    const hasRecoveryQuery = search.includes('type=recovery')

    if (hasRecoveryHash) {
      // Redirect to /reset-password preserving hash
      window.location.replace(`/reset-password${hash}`)
      return
    }

    if (hasRecoveryQuery) {
      window.location.replace(`/reset-password${search}`)
      return
    }

    // Subscribe to Supabase auth state change for PASSWORD_RECOVERY
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        router.push('/reset-password')
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [pathname, router])

  return null
}
