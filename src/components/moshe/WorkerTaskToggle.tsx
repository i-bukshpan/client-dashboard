'use client'

import { useTransition } from 'react'
import { toggleWorkerTask } from '@/app/moshe/actions'
import { CheckSquare, Square } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function WorkerTaskToggle({ id, isDone }: { id: string; isDone: boolean }) {
  const [pending, startTransition] = useTransition()

  function handleToggle() {
    startTransition(async () => {
      const r = await toggleWorkerTask(id, !isDone)
      if (r.error) toast.error(r.error)
    })
  }

  return (
    <button
      onClick={handleToggle}
      disabled={pending}
      className={cn(
        'shrink-0 transition-colors disabled:opacity-50',
        isDone ? 'text-emerald-500 hover:text-slate-300' : 'text-slate-300 hover:text-emerald-500'
      )}
    >
      {isDone ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
    </button>
  )
}
