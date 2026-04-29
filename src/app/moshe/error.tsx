'use client'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'
import { useEffect } from 'react'
export default function MosheError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error('Moshe portal error:', error) }, [error])
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center">
        <AlertTriangle className="w-7 h-7 text-red-500" />
      </div>
      <div className="text-center">
        <h2 className="text-lg font-bold text-slate-800">אירעה שגיאה</h2>
        <p className="text-sm text-slate-500 mt-1">{error.message || 'שגיאה בלתי צפויה'}</p>
      </div>
      <Button onClick={reset} className="bg-amber-500 hover:bg-amber-400 text-white">נסה שנית</Button>
    </div>
  )
}
