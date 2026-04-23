'use client'

import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Plus, Trash2, Loader2, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Appointment } from '@/types/database'

const schema = z.object({
  notes: z.string().min(1, 'נדרשות הערות פגישה'),
  income_amount: z.string().optional(),
  income_category: z.string().optional(),
  action_items: z.array(z.object({
    title: z.string().min(1, 'שם משימה נדרש'),
    priority: z.enum(['low', 'medium', 'high', 'urgent']),
    due_date: z.string().optional(),
  })).min(0),
})

type FormData = z.infer<typeof schema>

interface Props {
  appointment: Appointment
  open: boolean
  onClose: () => void
}

const priorityLabels = { low: 'נמוכה', medium: 'בינונית', high: 'גבוהה', urgent: 'דחוף' }

export function MeetingSummaryDialog({ appointment, open, onClose }: Props) {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const { register, control, handleSubmit, formState: { errors }, setValue, watch } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { action_items: [], notes: '', income_amount: '', income_category: 'ייעוץ' },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'action_items' })

  async function onSubmit(data: FormData) {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Insert meeting summary
    await (supabase.from('meeting_summaries') as any).insert({
      appointment_id: appointment.id,
      notes: data.notes,
      action_items: data.action_items,
    })

    // Mark appointment as done
    await (supabase.from('appointments') as any).update({ status: 'done' }).eq('id', appointment.id)

    // Bulk insert tasks
    if (data.action_items.length > 0) {
      await (supabase.from('tasks') as any).insert(
        data.action_items.map((item) => ({
          title: item.title,
          priority: item.priority,
          due_date: item.due_date || null,
          client_id: appointment.client_id,
          status: 'todo' as const,
          created_by: user.id,
        }))
      )
    }

    // Log income if provided
    if (data.income_amount && Number(data.income_amount) > 0) {
      await (supabase.from('income') as any).insert({
        amount: Number(data.income_amount),
        category: data.income_category ?? 'ייעוץ',
        date: new Date().toISOString().split('T')[0],
        client_id: appointment.client_id,
        notes: `סיכום פגישה: ${appointment.title}`,
        created_by: user.id,
      })
    }

    setLoading(false)
    setSuccess(true)
    setTimeout(onClose, 1500)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            סיכום פגישה: {appointment.title}
          </DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="text-center py-8">
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <FileText className="w-7 h-7 text-emerald-600" />
            </div>
            <p className="font-semibold text-emerald-700">סיכום נשמר בהצלחה!</p>
            <p className="text-muted-foreground text-sm mt-1">המשימות נוצרו ונוספו ללוח המשימות</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Notes */}
            <div className="space-y-2">
              <Label>הערות פגישה</Label>
              <Textarea
                placeholder="תאר את עיקרי הפגישה, החלטות שהתקבלו..."
                className="min-h-[100px]"
                {...register('notes')}
              />
              {errors.notes && <p className="text-destructive text-xs">{errors.notes.message}</p>}
            </div>

            {/* Income */}
            <div className="space-y-2">
              <Label>תשלום שהתקבל (אופציונלי)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="סכום ב-₪"
                  className="flex-1"
                  dir="ltr"
                  {...register('income_amount')}
                />
                <Select onValueChange={(v: any) => setValue('income_category', v as any)} defaultValue="ייעוץ">
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="קטגוריה" />
                  </SelectTrigger>
                  <SelectContent>
                    {['ייעוץ', 'תכנון', 'ניהול', 'אחר'].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Action Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>משימות שנוצרו מהפגישה</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={() => append({ title: '', priority: 'medium', due_date: '' })}
                >
                  <Plus className="w-3.5 h-3.5" />
                  הוסף משימה
                </Button>
              </div>

              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div key={field.id} className="bg-muted/50 rounded-xl p-3 space-y-2">
                    <div className="flex gap-2">
                      <Input
                        placeholder="שם המשימה"
                        className="flex-1 bg-background"
                        {...register(`action_items.${index}.title`)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive shrink-0"
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Select
                        onValueChange={(v: any) => setValue(`action_items.${index}.priority`, v as any)}
                        defaultValue="medium"
                      >
                        <SelectTrigger className="flex-1 bg-background">
                          <SelectValue placeholder="עדיפות" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(priorityLabels).map(([v, l]) => (
                            <SelectItem key={v} value={v}>{l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="date"
                        className="flex-1 bg-background"
                        dir="ltr"
                        {...register(`action_items.${index}.due_date`)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>ביטול</Button>
              <Button type="submit" disabled={loading} className="gap-2">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                שמור סיכום
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}



