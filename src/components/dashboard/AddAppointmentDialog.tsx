'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const schema = z.object({
  title: z.string().min(2, 'נדרש שם פגישה'),
  start_time: z.string().min(1, 'נדרש זמן התחלה'),
  end_time: z.string().min(1, 'נדרש זמן סיום'),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Props { open: boolean; onClose: () => void }

export function AddAppointmentDialog({ open, onClose }: Props) {
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    setLoading(true)
    const supabase = createClient()
    await (supabase.from('appointments') as any).insert({
      title: data.title,
      start_time: data.start_time,
      end_time: data.end_time,
      notes: data.notes,
      status: 'scheduled',
    })
    setLoading(false)
    reset()
    onClose()
    window.location.reload()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>פגישה חדשה</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>נושא הפגישה</Label>
            <Input placeholder="לדוגמה: פגישת ייעוץ ראשונית" {...register('title')} />
            {errors.title && <p className="text-destructive text-xs">{errors.title.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>שעת התחלה</Label>
              <Input type="datetime-local" dir="ltr" {...register('start_time')} />
            </div>
            <div className="space-y-2">
              <Label>שעת סיום</Label>
              <Input type="datetime-local" dir="ltr" {...register('end_time')} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>ביטול</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin me-2" />}
              הוסף פגישה
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

