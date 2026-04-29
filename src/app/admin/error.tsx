'use client'

import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { useEffect } from 'react'
import Link from 'next/link'

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Admin Error:', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6 p-6">
      <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center">
        <AlertTriangle className="w-8 h-8 text-red-500" />
      </div>
      <div className="text-center max-w-md">
        <h2 className="text-xl font-bold text-slate-800">אירעה שגיאה</h2>
        <p className="text-sm text-muted-foreground mt-2">
          {error.message || 'שגיאה בלתי צפויה. נסה לרענן את הדף.'}
        </p>
        {error.digest && (
          <p className="text-[10px] text-muted-foreground/50 mt-1 font-mono">קוד שגיאה: {error.digest}</p>
        )}
      </div>
      <div className="flex gap-3">
        <Button onClick={reset} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          נסה שנית
        </Button>
        <Button variant="outline" asChild>
          <Link href="/admin/dashboard" className="gap-2">
            <Home className="w-4 h-4" />
            לדשבורד
          </Link>
        </Button>
      </div>
    </div>
  )
}
