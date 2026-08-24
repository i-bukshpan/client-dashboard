'use client'

import { useState } from 'react'
import { Loader2, Sheet } from 'lucide-react'
import { toast } from 'sonner'
import { setupInternalAgencyAction } from '@/app/workspace/actions/internal-finance'
import { Button } from '@/components/ui/button'

export function InternalFinanceSetup() {
  const [pending, setPending] = useState(false)
  async function setup() {
    setPending(true)
    const result = await setupInternalAgencyAction()
    setPending(false)
    if ('error' in result) return toast.error(result.error)
    toast.success('גיליון הסוכנות הפנימי נוצר בהצלחה')
  }
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center rounded-2xl border border-dashed border-border bg-card p-12 text-center">
      <Sheet className="mb-4 size-12 text-indigo-400" />
      <h2 className="text-xl font-black">הקמת Internal Agency</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">הפעולה תיצור תיקיית Drive וגיליון RTL מרכזי עם לשוניות להכנסות, הוצאות, ריטיינרים, חשבוניות וסיכום חודשי.</p>
      <Button className="mt-6" onClick={setup} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Sheet />}
        יצירת סביבת הכספים
      </Button>
    </div>
  )
}
