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
import { archiveTask, updateTask, deleteTask, addTaskComment, getTaskComments } from '@/app/(admin)/tasks/actions'
import { toast } from 'sonner'
import { Loader2, Trash2, CheckCircle2, MessageSquare, Send, Archive } from 'lucide-react'
import { useEffect } from 'react'
import { format } from 'date-fns'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

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
  const [comments, setComments] = useState<any[]>([])
  const [newComment, setNewComment] = useState('')
  const [isCommentsLoading, setIsCommentsLoading] = useState(false)

  useEffect(() => {
    if (open && task.id) {
      fetchComments()
    }
  }, [open, task.id])

  async function fetchComments() {
    setIsCommentsLoading(true)
    const res = await getTaskComments(task.id)
    if (res.data) setComments(res.data)
    setIsCommentsLoading(false)
  }

  async function handleAddComment() {
    if (!newComment.trim()) return
    setLoading(true)
    const res = await addTaskComment(task.id, newComment)
    if (res.error) {
      toast.error(res.error)
    } else {
      setNewComment('')
      fetchComments()
    }
    setLoading(false)
  }

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
    const res = await updateTask(task.id, {
      title: data.title,
      description: data.description || null,
      status: data.status,
      priority: data.priority,
      due_date: data.due_date || null,
      assigned_to: data.assigned_to || null,
    })

    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success('משימה עודכנה בהצלחה')
      onUpdated()
      onOpenChange(false)
    }
    setLoading(false)
  }

  async function onDelete() {
    if (!confirm('האם אתה בטוח שברצונך למחוק משימה זו?')) return
    setDeleting(true)
    const res = await deleteTask(task.id)
    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success('משימה נמחקה')
      onUpdated()
      onOpenChange(false)
    }
    setDeleting(false)
  }

  async function onArchive() {
    setLoading(true)
    const res = await archiveTask(task.id, !task.archived)
    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success(task.archived ? 'משימה הוחזרה מהארכיון' : 'משימה הועברה לארכיון')
      onUpdated()
      onOpenChange(false)
    }
    setLoading(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0 border-l-slate-200" side="right">
        <div className="p-6 pb-6 border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10 backdrop-blur-sm">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <SheetTitle className="text-xl font-bold text-slate-900">עריכת משימה</SheetTitle>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="text-amber-600 hover:text-amber-700 hover:bg-amber-50" onClick={onArchive} disabled={loading}>
                  <Archive className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={onDelete} disabled={deleting}>
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </Button>
              </div>
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
                  <SelectValue placeholder="סטטוס">
                    {{ todo: 'לביצוע', in_progress: 'בביצוע', done: 'הושלם' }[watch('status')] || 'סטטוס'}
                  </SelectValue>
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
                  <SelectValue placeholder="עדיפות">
                    {{ low: 'נמוכה', medium: 'בינונית', high: 'גבוהה', urgent: 'דחוף' }[watch('priority')] || 'עדיפות'}
                  </SelectValue>
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
              <Select value={watch('assigned_to') || ''} onValueChange={(v: any) => setValue('assigned_to', v || '')}>
                <SelectTrigger className="h-11 border-slate-200 focus:border-slate-400 rounded-xl">
                  <SelectValue placeholder="בחר עובד">
                    {watch('assigned_to') ? (employees.find(e => e.id === watch('assigned_to'))?.full_name || 'עובד') : 'ללא אחראי'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">ללא אחראי</SelectItem>
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

        <div className="p-6 pt-0 space-y-6">
          <div className="pt-6 border-t border-slate-100">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-4 h-4 text-slate-400" />
              <h4 className="font-bold text-slate-900">עדכונים ותגובות</h4>
            </div>

            <div className="space-y-4 mb-4">
              {isCommentsLoading ? (
                <div className="flex justify-center p-4">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
                </div>
              ) : comments.length === 0 ? (
                <p className="text-xs text-muted-foreground italic text-center py-4 bg-slate-50 rounded-lg">אין עדכונים עדיין</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="flex gap-3">
                    <Avatar className="w-8 h-8 shrink-0">
                      <AvatarImage src={c.profiles?.avatar_url} />
                      <AvatarFallback className="text-[10px] bg-slate-100 text-slate-600 font-bold">
                        {c.profiles?.full_name?.split(' ').map((n: any) => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">{c.profiles?.full_name}</span>
                        <span className="text-[10px] text-muted-foreground">{format(new Date(c.created_at), 'dd/MM/yyyy HH:mm')}</span>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-2xl rounded-tr-none text-xs text-slate-700 leading-relaxed border border-slate-100/50">
                        {c.content}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-2">
              <Input 
                placeholder="הוסף עדכון..." 
                className="flex-1 h-11 border-slate-200 rounded-xl"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
              />
              <Button size="icon" className="h-11 w-11 rounded-xl shrink-0" onClick={handleAddComment} disabled={loading || !newComment.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
