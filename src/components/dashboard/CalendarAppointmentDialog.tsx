'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { createAppointment } from '@/app/admin/calendar/actions'

interface Props {
  clients: any[]
  profiles: any[]
  initialDate?: Date
  onSuccess?: () => void
  trigger?: React.ReactNode
}

export function CalendarAppointmentDialog({ clients, profiles, initialDate, onSuccess, trigger }: Props) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    const formData = new FormData(e.currentTarget)
    
    // Add date component to time
    const dateStr = initialDate ? initialDate.toISOString().split('T')[0] : formData.get('date') as string
    const timeStr = formData.get('time') as string
    
    if (!dateStr || !timeStr) {
      toast({ title: 'שגיאה', description: 'יש לבחור תאריך ושעה', variant: 'destructive' })
      setIsLoading(false)
      return
    }
    
    const start_time = `${dateStr}T${timeStr}:00`
    // Default duration: 1 hour
    const dateObj = new Date(start_time)
    dateObj.setHours(dateObj.getHours() + 1)
    const end_time = dateObj.toISOString().split('.')[0]
    
    formData.append('start_time', start_time)
    formData.append('end_time', end_time)

    const res = await createAppointment(formData)
    if (res.error) {
      toast({ title: 'שגיאה', description: res.error, variant: 'destructive' })
    } else {
      toast({ title: 'הצלחה', description: 'הפגישה נוצרה בהצלחה' })
      setOpen(false)
      onSuccess?.()
    }
    setIsLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            פגישה חדשה
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>הוספת פגישה ליומן</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>כותרת הפגישה *</Label>
            <Input name="title" required placeholder="לדוגמה: פגישת ייעוץ ראשונית" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {!initialDate && (
              <div className="space-y-2">
                <Label>תאריך *</Label>
                <Input name="date" type="date" required />
              </div>
            )}
            <div className="space-y-2">
              <Label>שעה *</Label>
              <Input name="time" type="time" required />
            </div>
          </div>

          <div className="space-y-2">
            <Label>לקוח</Label>
            <Select name="client_id">
              <SelectTrigger>
                <SelectValue placeholder="בחר לקוח..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">ללא לקוח</SelectItem>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>עובד אחראי</Label>
            <Select name="employee_id">
              <SelectTrigger>
                <SelectValue placeholder="בחר עובד..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">ללא עובד</SelectItem>
                {profiles.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>הערות לפגישה</Label>
            <Textarea name="notes" placeholder="פרטים נוספים..." className="resize-none" />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
            שמור פגישה
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
