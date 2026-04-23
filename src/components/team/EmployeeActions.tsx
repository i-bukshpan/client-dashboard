'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Mail, Loader2, Edit3, Trash2 } from 'lucide-react'
import { inviteExistingEmployee } from '@/app/(admin)/team/actions'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal } from 'lucide-react'

interface Props {
  employeeId: string
  email: string
  name: string
}

export function EmployeeActions({ employeeId, email, name }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleInvite() {
    setLoading(true)
    try {
      const res = await inviteExistingEmployee(email, name)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('הזמנה נשלחה מחדש למייל של העובד')
      }
    } catch (err) {
      toast.error('אירעה שגיאה בשליחת ההזמנה')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleInvite} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
          שלח הזמנה למייל
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2 text-slate-600">
          <Edit3 className="w-4 h-4" />
          ערוך פרטי עובד
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2 text-red-600 focus:text-red-600">
          <Trash2 className="w-4 h-4" />
          הסר עובד מהמערכת
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
