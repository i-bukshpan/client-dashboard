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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
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

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      category: '',
    }
  })

  async function onSubmit(data: FormData) {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('לא נמצא משתמש מחובר. נסה לרענן את העמוד.')
      }

      const payload = {
        amount: Number(data.amount),
        category: data.category,
        date: data.date,
        notes: data.notes || null,
        created_by: user.id,
      }

      const { error } = openType === 'income'
        ? await (supabase.from('income') as any).insert({ ...payload, client_id: data.client_id || null })
        : await (supabase.from('expenses') as any).insert(payload)

      if (error) {
        console.error('Supabase error:', error)
        throw new Error(error.message || 'שגיאה בשמירת הנתונים במסד הנתונים')
      }

      toast.success(openType === 'income' ? 'הכנסה נוספה בהצלחה' : 'הוצאה נוספה בהצלחה')
      reset()
      setOpenType(null)
      window.location.reload()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'אירעה שגיאה בלתי צפויה')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex gap-2">
      <Sheet open={openType === 'income'} onOpenChange={(o) => !o && setOpenType(null)}>
        <SheetTrigger asChild>
          <Button className="bg-emerald-600 hover:bg-emerald-500 gap-2 shadow-lg shadow-emerald-600/20 rounded-lg text-white font-medium" onClick={() => setOpenType('income')}>
            <TrendingUp className="w-4 h-4" />
            הוסף הכנסה
          </Button>
        </SheetTrigger>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0 border-l-slate-200" side="right">
          <div className="p-6 pb-6 border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10 backdrop-blur-sm">
            <SheetHeader>
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center mb-2 shadow-sm border border-emerald-200">
                <TrendingUp className="w-5 h-5 text-emerald-700" />
              </div>
              <SheetTitle className="text-xl font-bold text-slate-900">הוספת הכנסה חדשה</SheetTitle>
            </SheetHeader>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium">סכום (₪)</Label>
                <Input type="number" step="0.01" dir="ltr" className="h-10 border-slate-200 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 rounded-lg bg-white" {...register('amount')} />
                {errors.amount && <p className="text-red-500 text-xs">{errors.amount.message}</p>}
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium">תאריך</Label>
                <Input type="date" dir="ltr" className="h-10 border-slate-200 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 rounded-lg bg-white" {...register('date')} />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">לקוח משויך (אופציונלי)</Label>
              <Select 
                value={watch('client_id')}
                onValueChange={(v: any) => setValue('client_id', v)}
              >
                <SelectTrigger className="h-10 border-slate-200 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 rounded-lg bg-white">
                  <SelectValue placeholder="בחר לקוח" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">קטגוריה</Label>
              <Input placeholder="לדוגמה: ייעוץ עסקי" className="h-10 border-slate-200 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 rounded-lg bg-white" {...register('category')} />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">הערות</Label>
              <Input placeholder="תיאור קצר..." className="h-10 border-slate-200 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 rounded-lg bg-white" {...register('notes')} />
            </div>
            <div className="pt-6 mt-6 border-t border-slate-100 pb-8">
              <Button type="submit" className="w-full h-11 gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm font-medium transition-all active:scale-[0.98]" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {loading ? 'שומר הכנסה...' : 'שמור הכנסה'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      <Sheet open={openType === 'expense'} onOpenChange={(o) => !o && setOpenType(null)}>
        <SheetTrigger asChild>
          <Button variant="outline" className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 gap-2 rounded-lg font-medium" onClick={() => setOpenType('expense')}>
            <TrendingDown className="w-4 h-4" />
            הוסף הוצאה
          </Button>
        </SheetTrigger>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0 border-l-slate-200" side="right">
          <div className="p-6 pb-6 border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10 backdrop-blur-sm">
            <SheetHeader>
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center mb-2 shadow-sm border border-rose-200">
                <TrendingDown className="w-5 h-5 text-rose-700" />
              </div>
              <SheetTitle className="text-xl font-bold text-slate-900">הוספת הוצאה חדשה</SheetTitle>
            </SheetHeader>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium">סכום (₪)</Label>
                <Input type="number" step="0.01" dir="ltr" className="h-10 border-slate-200 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 rounded-lg bg-white" {...register('amount')} />
                {errors.amount && <p className="text-red-500 text-xs">{errors.amount.message}</p>}
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium">תאריך</Label>
                <Input type="date" dir="ltr" className="h-10 border-slate-200 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 rounded-lg bg-white" {...register('date')} />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">קטגוריה</Label>
              <Select 
                value={watch('category')}
                onValueChange={(v: any) => setValue('category', v)}
              >
                <SelectTrigger className="h-10 border-slate-200 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 rounded-lg bg-white">
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
              <Label className="text-slate-700 font-medium">הערות</Label>
              <Input placeholder="תיאור ההוצאה..." className="h-10 border-slate-200 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 rounded-lg bg-white" {...register('notes')} />
            </div>
            <div className="pt-6 mt-6 border-t border-slate-100 pb-8">
              <Button type="submit" className="w-full h-11 gap-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white shadow-sm font-medium transition-all active:scale-[0.98]" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {loading ? 'שומר הוצאה...' : 'שמור הוצאה'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}



