'use client'

import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'
import { useEffect } from 'react'

export default function CRMError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('CRM Error:', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center">
        <AlertTriangle className="w-7 h-7 text-red-500" />
      </div>
      <div className="text-center">
        <h2 className="text-lg font-bold text-slate-800">שגיאה בטעינת הלקוחות</h2>
        <p className="text-sm text-muted-foreground mt-1">{error.message || 'אירעה שגיאה בלתי צפויה'}</p>
      </div>
      <Button onClick={reset} variant="outline" className="gap-2">נסה שנית</Button>
    </div>
  )
}
