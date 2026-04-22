'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { Plus, Loader2, TrendingUp, TrendingDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const schema = z.object({
  amount: z.string().min(1, 'סכום נדרש'),
  category: z.string().min(1, 'קטגוריה נדרשת'),
  date: z.string().min(1, 'תאריך נדרש'),
  client_id: z.string().optional(),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Props {
  clients: { id: string; name: string }[]
}

export function FinanceActions({ clients }: Props) {
  const [openType, setOpenType] = useState<'income' | 'expense' | null>(null)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      category: '',
    }
  })

  async function onSubmit(data: FormData) {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const payload = {
      amount: Number(data.amount),
      category: data.category,
      date: data.date,
      notes: data.notes || null,
      created_by: user!.id,
    }

    const { error } = openType === 'income'
      ? await supabase.from('income').insert({ ...payload, client_id: data.client_id || null })
      : await supabase.from('expenses').insert(payload)

    if (error) {
      toast.error('שגיאה בשמירת הנתונים')
    } else {
      toast.success(openType === 'income' ? 'הכנסה נוספה בהצלחה' : 'הוצאה נוספה בהצלחה')
      reset()
      setOpenType(null)
      window.location.reload()
    }
    setLoading(false)
  }

  return (
    <div className="flex gap-2">
      <Dialog open={openType === 'income'} onOpenChange={(o) => !o && setOpenType(null)}>
        <DialogTrigger asChild>
          <Button className="bg-emerald-600 hover:bg-emerald-500 gap-2 shadow-lg shadow-emerald-600/20" onClick={() => setOpenType('income')}>
            <TrendingUp className="w-4 h-4" />
            הוסף הכנסה
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>הוספת הכנסה חדשה</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>סכום (₪)</Label>
                <Input type="number" step="0.01" dir="ltr" {...register('amount')} />
                {errors.amount && <p className="text-red-500 text-xs">{errors.amount.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>תאריך</Label>
                <Input type="date" dir="ltr" {...register('date')} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>לקוח משויך</Label>
              <Select onValueChange={(v) => setValue('client_id', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר לקוח (אופציונלי)" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>קטגוריה</Label>
              <Input placeholder="לדוגמה: ייעוץ עסקי" {...register('category')} />
            </div>
            <div className="space-y-2">
              <Label>הערות</Label>
              <Input placeholder="תיאור קצר..." {...register('notes')} />
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 animate-spin me-2" />}
                שמור הכנסה
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={openType === 'expense'} onOpenChange={(o) => !o && setOpenType(null)}>
        <DialogTrigger asChild>
          <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 gap-2" onClick={() => setOpenType('expense')}>
            <TrendingDown className="w-4 h-4" />
            הוסף הוצאה
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>הוספת הוצאה חדשה</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>סכום (₪)</Label>
                <Input type="number" step="0.01" dir="ltr" {...register('amount')} />
                {errors.amount && <p className="text-red-500 text-xs">{errors.amount.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>תאריך</Label>
                <Input type="date" dir="ltr" {...register('date')} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>קטגוריה</Label>
              <Select onValueChange={(v) => setValue('category', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר קטגוריה" />
                </SelectTrigger>
                <SelectContent>
                  {['שכירויות', 'חשמל', 'שיווק', 'מיסים', 'משכורות', 'כללי'].map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && <p className="text-red-500 text-xs">{errors.category.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>הערות</Label>
              <Input placeholder="תיאור ההוצאה..." {...register('notes')} />
            </div>
            <DialogFooter>
              <Button type="submit" variant="destructive" className="w-full" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 animate-spin me-2" />}
                שמור הוצאה
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
