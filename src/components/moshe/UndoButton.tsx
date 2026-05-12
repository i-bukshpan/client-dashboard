'use client'

import { useTransition } from 'react'
import { Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { undoAuditAction } from '@/app/moshe/actions'

export function UndoButton({ auditId }: { auditId: string }) {
  const [pending, startTransition] = useTransition()

  function handleUndo() {
    startTransition(async () => {
      const r = await undoAuditAction(auditId)
      if (r.error) toast.error(r.error)
      else toast.success('הפעולה בוטלה והנתונים שוחזרו')
    })
  }

  return (
    <button
      onClick={handleUndo}
      disabled={pending}
      className="flex items-center gap-1 text-[11px] font-bold text-amber-600 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1.5 rounded-lg shrink-0 transition-colors disabled:opacity-50"
    >
      <Undo2 className="w-3.5 h-3.5" />
      בטל
    </button>
  )
}
