'use client'

import { useState } from 'react'
import { ClipboardCheck, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { setupOperationsWorkspaceAction } from '@/app/workspace/actions/tasks'
import { Button } from '@/components/ui/button'

export function OperationsSetup() {
  const [pending, setPending] = useState(false)
  async function setup() { setPending(true); const result = await setupOperationsWorkspaceAction(); setPending(false); if ('error' in result) return toast.error(result.error); toast.success('Nehemiah Operations הוקם בהצלחה') }
  return <div className="mx-auto flex max-w-xl flex-col items-center rounded-2xl border border-dashed border-border bg-card p-12 text-center"><ClipboardCheck className="mb-4 size-12 text-indigo-400" /><h2 className="text-xl font-black">הקמת Nehemiah Operations</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">יצירת תיקיית Drive וגיליון תפעול מרכזי שיהיה מקור האמת לכל המשימות והתזכורות.</p><Button className="mt-6" onClick={setup} disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : <ClipboardCheck />} יצירת סביבת המשימות</Button></div>
}
