'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, Trash2, CheckCircle2 } from 'lucide-react'

const schema = z.object({
  title: z.string().min(1, 'כותרת נדרשת'),
  description: z.string().optional(),
  status: z.enum(['todo', 'in_progress', 'done']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  due_date: z.string().optional(),
  assigned_to: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Props {
  task: any
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated: () => void
  employees: { id: string; full_name: string }[]
}

export function TaskDetailSheet({ task, open, onOpenChange, onUpdated, employees }: Props) {
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      due_date: task.due_date || '',
      assigned_to: task.assigned_to || '',
    }
  })

  async function onSubmit(data: FormData) {
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await (supabase.from('tasks') as any).update({
        title: data.title,
        description: data.description || null,
        status: data.status,
        priority: data.priority,
        due_date: data.due_date || null,
        assigned_to: data.assigned_to || null,
      }).eq('id', task.id)

      if (error) throw error
      toast.success('משימה עודכנה בהצלחה')
      onUpdated()
      onOpenChange(false)
    } catch (err: any) {
      toast.error('שגיאה בעדכון המשימה: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function onDelete() {
    if (!confirm('האם אתה בטוח שברצונך למחוק משימה זו?')) return
    setDeleting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('tasks').delete().eq('id', task.id)
      if (error) throw error
      toast.success('משימה נמחקה')
      onUpdated()
      onOpenChange(false)
    } catch (err: any) {
      toast.error('שגיאה במחיקת המשימה')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0 border-l-slate-200" side="right">
        <div className="p-6 pb-6 border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10 backdrop-blur-sm">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <SheetTitle className="text-xl font-bold text-slate-900">עריכת משימה</SheetTitle>
              <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={onDelete} disabled={deleting}>
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </Button>
            </div>
          </SheetHeader>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          <div className="space-y-2">
            <Label className="text-slate-700 font-medium">כותרת המשימה</Label>
            <Input className="h-11 border-slate-200 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 rounded-xl" {...register('title')} />
            {errors.title && <p className="text-red-500 text-xs">{errors.title.message}</p>}
          </div>

          <div className="space-y-2">
            <Label className="text-slate-700 font-medium">תיאור</Label>
            <Textarea 
              className="min-h-[120px] border-slate-200 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 rounded-xl resize-none" 
              placeholder="פרטים נוספים על המשימה..."
              {...register('description')} 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">סטטוס</Label>
              <Select value={watch('status')} onValueChange={(v: any) => setValue('status', v)}>
                <SelectTrigger className="h-11 border-slate-200 focus:border-slate-400 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">לביצוע</SelectItem>
                  <SelectItem value="in_progress">בביצוע</SelectItem>
                  <SelectItem value="done">הושלם</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">עדיפות</Label>
              <Select value={watch('priority')} onValueChange={(v: any) => setValue('priority', v)}>
                <SelectTrigger className="h-11 border-slate-200 focus:border-slate-400 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">נמוכה</SelectItem>
                  <SelectItem value="medium">בינונית</SelectItem>
                  <SelectItem value="high">גבוהה</SelectItem>
                  <SelectItem value="urgent">דחוף</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">אחראי</Label>
              <Select value={watch('assigned_to')} onValueChange={(v: any) => setValue('assigned_to', v)}>
                <SelectTrigger className="h-11 border-slate-200 focus:border-slate-400 rounded-xl">
                  <SelectValue placeholder="בחר עובד" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">תאריך יעד</Label>
              <Input type="date" className="h-11 border-slate-200 focus:border-slate-400 rounded-xl" {...register('due_date')} />
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 flex gap-3">
            <Button type="button" variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => onOpenChange(false)}>ביטול</Button>
            <Button type="submit" className="flex-[2] h-12 gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/20" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              שמור שינויים
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
