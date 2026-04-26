'use client'

import { useState } from 'react'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Mail, Loader2, Edit3, Trash2 } from 'lucide-react'
import { inviteExistingEmployee, deleteEmployee } from '@/app/(admin)/team/actions'
import { toast } from 'sonner'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { MoreHorizontal, KeyRound } from 'lucide-react'
import { EditEmployeeSheet } from './EditEmployeeSheet'

interface Props {
  employeeId: string
  email: string
  name: string
  salaryBase: number
}

export function EmployeeActions({ employeeId, email, name, salaryBase }: Props) {
  const [loading, setLoading] = useState(false)
  const [showEdit, setShowEdit] = useState(false)

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

  async function handleDelete() {
    if (!confirm(`האם אתה בטוח שברצונך למחוק את העובד ${name}? פעולה זו תסיר את כל נתוני הגישה שלו.`)) return
    
    setLoading(true)
    try {
      const res = await deleteEmployee(employeeId)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('העובד נמחק מהמערכת בהצלחה')
      }
    } catch (err) {
      toast.error('אירעה שגיאה במחיקת העובד')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(buttonVariants({ variant: 'ghost' }), "h-8 w-8 p-0")}>
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleInvite} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
          שלח הזמנה למייל
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setShowEdit(true)} className="gap-2 text-slate-600">
          <Edit3 className="w-4 h-4" />
          ערוך פרטי עובד
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setShowEdit(true)} className="gap-2 text-slate-600">
          <KeyRound className="w-4 h-4" />
          עדכן סיסמה
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDelete} disabled={loading} className="gap-2 text-red-600 focus:text-red-600">
          <Trash2 className="w-4 h-4" />
          הסר עובד מהמערכת
        </DropdownMenuItem>
      </DropdownMenuContent>

      <EditEmployeeSheet 
        open={showEdit} 
        onOpenChange={setShowEdit}
        employee={{ id: employeeId, name, email, salaryBase }}
      />
    </DropdownMenu>
  )
}
