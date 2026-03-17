'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, CheckCircle2, Circle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Card } from '@/components/ui/card'
import { supabase, type Reminder } from '@/lib/supabase'
import { exportRemindersToCSV } from '@/lib/export-reminders'
import { X } from 'lucide-react'
import { toast } from 'sonner'

interface RemindersProps {
  clientId: string
  clientName?: string
  readOnly?: boolean
}

export function Reminders({ clientId, clientName = 'לקוח', readOnly = false }: RemindersProps) {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [priority, setPriority] = useState('רגיל')
  const [description, setDescription] = useState('')
  const [reminderType, setReminderType] = useState('משימה')
  const [category, setCategory] = useState('task')
  const [recurrenceRule, setRecurrenceRule] = useState('')

  const loadReminders = async () => {
    try {
      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('client_id', clientId)
        .order('due_date', { ascending: true })

      if (error) throw error
      // Filter out templates (those with recurrence_rule) from the general list
      // templates are managed in the Advisor Internal Tab
      setReminders((data || []).filter(r => !r.recurrence_rule))
    } catch (error) {
      console.error('Error loading reminders:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReminders()
  }, [clientId])


  const handleAdd = async () => {
    if (!title || !dueDate) return

    try {
      // Combine date and time into ISO timestamp
      const dueDateTime = dueTime
        ? `${dueDate}T${dueTime}:00`
        : `${dueDate}T12:00:00`

      const { data, error } = await supabase
        .from('reminders')
        .insert([{
          client_id: clientId,
          title,
          due_date: dueDateTime,
          priority,
          description: description || null,
          is_completed: false,
          reminder_type: reminderType || null,
          category: category || 'task',
          recurrence_rule: recurrenceRule || null,
        }])
        .select()
        .single()

      if (error) {
        console.error('Supabase error details:', error)
        throw new Error(error.message || 'שגיאה בהוספת תזכורת')
      }

      setReminders([...reminders, data].sort((a, b) =>
        new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
      ))
      setTitle('')
      setDueDate('')
      setDueTime('')
      setPriority('רגיל')
      setDescription('')
      setReminderType('משימה')
      setCategory('task')
      setRecurrenceRule('')
      setOpen(false)
    } catch (error) {
      console.error('Error adding reminder:', error)
      const errorMessage = error instanceof Error ? error.message : 'שגיאה לא ידועה'
      alert(`שגיאה בהוספת תזכורת: ${errorMessage}`)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק תזכורת זו?')) return

    try {
      const { error } = await supabase
        .from('reminders')
        .delete()
        .eq('id', id)

      if (error) throw error

      setReminders(reminders.filter(r => r.id !== id))
    } catch (error) {
      console.error('Error deleting reminder:', error)
      alert('שגיאה במחיקת תזכורת')
    }
  }

  const handleToggleComplete = async (e: React.MouseEvent, reminder: Reminder) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      const { error } = await supabase
        .from('reminders')
        .update({ is_completed: !reminder.is_completed })
        .eq('id', reminder.id)

      if (error) throw error

      setReminders(reminders.map(r =>
        r.id === reminder.id ? { ...r, is_completed: !r.is_completed } : r
      ))
    } catch (error) {
      console.error('Error updating reminder:', error)
      alert('שגיאה בעדכון תזכורת')
    }
  }

  const isOverdue = (dueDate: string, completed: boolean) => {
    if (completed) return false
    return new Date(dueDate) < new Date()
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'דחוף':
        return 'bg-red-100 text-red-700 border-red-200'
      case 'רגיל':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      case 'נמוך':
        return 'bg-blue-100 text-blue-700 border-blue-200'
      default:
        return 'bg-grey/10 text-grey'
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-grey">טוען תזכורות...</div>
  }

  const overdueCount = reminders.filter(r => isOverdue(r.due_date, r.is_completed)).length

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">משימות</h3>
          {overdueCount > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
              {overdueCount} מאוחר
            </span>
          )}
        </div>
        {!readOnly && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                הוסף תזכורת
              </Button>
            </DialogTrigger>
            <DialogContent dir="rtl">
              <DialogHeader>
                <DialogTitle>הוסף משימה חדשה</DialogTitle>
                <DialogDescription>
                  צור משימה או תזכורת עם תאריך יעד
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">כותרת</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="לדוגמה: בדיקת דוחות חודשיים"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dueDate">תאריך יעד</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dueTime">שעה (אופציונלי)</Label>
                  <Input
                    id="dueTime"
                    type="time"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="priority">עדיפות</Label>
                  <select
                    id="priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    required
                  >
                    <option value="נמוך">נמוך</option>
                    <option value="רגיל">רגיל</option>
                    <option value="דחוף">דחוף</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="reminderType">סוג תזכורת</Label>
                  <select
                    id="reminderType"
                    value={reminderType}
                    onChange={(e) => setReminderType(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="משימה">משימה</option>
                    <option value="פירעון צ'ק">פירעון צ'ק</option>
                    <option value="דוח רבעוני">דוח רבעוני</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="category">קטגוריה (ליועץ)</Label>
                  <select
                    id="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="task">משימה כללית</option>
                    <option value="phone_call">שיחת טלפון</option>
                    <option value="meeting">פגישה / הכנה לפגישה</option>
                    <option value="document_review">בדיקת מסמכים</option>
                    <option value="payment_followup">מעקב תשלומים</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="recurrence">חזרה מחזורית</Label>
                  <select
                    id="recurrence"
                    value={recurrenceRule}
                    onChange={(e) => setRecurrenceRule(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">ללא חזרה</option>
                    <option value="daily">יומי</option>
                    <option value="weekly">שבועי</option>
                    <option value="monthly">חודשי</option>
                    <option value="yearly">שנתי</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">תיאור (אופציונלי)</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="פרטים נוספים..."
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  ביטול
                </Button>
                <Button onClick={handleAdd}>הוסף</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>


      {
        reminders.length === 0 ? (
          <div className="text-center py-8 text-grey">
            אין תזכורות. הוסף תזכורת חדשה להתחיל.
          </div>
        ) : (
          <div className="space-y-3">
            {reminders.map((reminder) => {
              const overdue = isOverdue(reminder.due_date, reminder.is_completed)
              return (
                <div
                  key={reminder.id}
                  className={`border rounded-lg p-4 bg-white hover:shadow-md transition-shadow ${overdue ? 'border-red-300 bg-red-50' : ''
                    } ${reminder.is_completed ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <button
                        onClick={(e) => !readOnly && handleToggleComplete(e, reminder)}
                        className={`mt-1 ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
                        disabled={readOnly}
                      >
                        {reminder.is_completed ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : (
                          <Circle className="h-5 w-5 text-grey" />
                        )}
                      </button>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className={`font-semibold ${reminder.is_completed ? 'line-through' : ''}`}>
                            {reminder.title}
                          </h4>
                          <span className={`px-2 py-0.5 rounded text-xs border ${getPriorityColor(reminder.priority)}`}>
                            {reminder.priority}
                          </span>
                          {reminder.reminder_type && (
                            <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">
                              {reminder.reminder_type}
                            </span>
                          )}
                          {reminder.category && (
                            <span className="px-2 py-0.5 rounded text-xs bg-indigo-100 text-indigo-700 font-bold">
                              {reminder.category === 'phone_call' ? '📞 שיחה' :
                                reminder.category === 'meeting' ? '👥 פגישה' :
                                  reminder.category === 'document_review' ? '📄 מסמכים' :
                                    reminder.category === 'payment_followup' ? '💰 תשלום' : '📌 משימה'}
                            </span>
                          )}
                          {reminder.recurrence_rule && (
                            <span className="px-2 py-0.5 rounded text-xs bg-emerald-100 text-emerald-700 flex items-center gap-1">
                              מחזורית ({reminder.recurrence_rule})
                            </span>
                          )}
                          {overdue && (
                            <span className="flex items-center gap-1 text-red-600 text-xs">
                              <AlertCircle className="h-4 w-4" />
                              מאוחר
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-grey space-y-1">
                          <div>
                            תאריך יעד: {new Date(reminder.due_date).toLocaleDateString('he-IL')}
                          </div>
                          {reminder.description && (
                            <div>{reminder.description}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  {!readOnly && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(reminder.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )
      }
    </div >
  )
}

