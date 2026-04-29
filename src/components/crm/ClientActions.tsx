'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Pencil, Trash2, Loader2 } from 'lucide-react'
import { deleteClient } from '@/app/admin/crm/actions'
import { EditClientSheet } from './EditClientSheet'
import { toast } from 'sonner'
import type { Client } from '@/types/database'

interface Props {
  client: Client
}

export function ClientActions({ client }: Props) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    setDeleting(true)
    try {
      const result = await deleteClient(client.id)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('הלקוח נמחק בהצלחה')
      router.push('/admin/crm')
    } catch {
      toast.error('אירעה שגיאה במחיקה')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-2 h-9 border-slate-200 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors"
          onClick={() => setEditOpen(true)}
        >
          <Pencil className="w-3.5 h-3.5" />
          עריכה
        </Button>

        <AlertDialog>
          <AlertDialogTrigger
            className="inline-flex items-center gap-2 h-9 px-3 text-sm font-medium rounded-md border border-red-100 text-red-500 bg-background hover:bg-red-50 hover:text-red-700 hover:border-red-300 transition-colors"
          >
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            מחיקה
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>מחיקת לקוח</AlertDialogTitle>
              <AlertDialogDescription>
                האם למחוק את הלקוח <strong>{client.name}</strong>? פעולה זו בלתי הפיכה ותמחק את כל הנתונים הקשורים אליו.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>ביטול</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                כן, מחק לקוח
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <EditClientSheet client={client} open={editOpen} onOpenChange={setEditOpen} />
    </>
  )
}
