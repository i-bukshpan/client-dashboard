'use client'

import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UserPlus, Loader2, Mail, BadgeDollarSign, Plus } from 'lucide-react'
import { createEmployee } from '@/app/(admin)/team/actions'
import { toast } from 'sonner'

export function AddEmployeeSheet() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', salary: '' })

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    
    const res = await createEmployee({
      name: form.name,
      email: form.email,
      salary: Number(form.salary)
    })

    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success('הזמנה נשלחה למייל של העובד בהצלחה!')
      setOpen(false)
      window.location.reload()
    }
    setLoading(false)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="gap-2 bg-slate-900 text-white hover:bg-slate-800 shadow-sm rounded-lg">
          <UserPlus className="w-4 h-4" />
          הוסף עובד
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0 border-l-slate-200" side="right">
        <div className="p-6 pb-6 border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10 backdrop-blur-sm">
          <SheetHeader>
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center mb-2 shadow-sm border border-emerald-200">
              <UserPlus className="w-5 h-5 text-emerald-700" />
            </div>
            <SheetTitle className="text-xl font-bold text-slate-900">הוספת עובד חדש</SheetTitle>
            <SheetDescription className="text-slate-500 text-sm">
              הזן את פרטי העובד. המערכת תיצור עבורו משתמש באופן אוטומטי.
            </SheetDescription>
          </SheetHeader>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-5">
          <div className="space-y-2">
            <Label className="text-slate-700 font-medium">שם מלא <span className="text-red-500">*</span></Label>
            <Input
              required
              className="h-10 border-slate-200 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 rounded-lg bg-white"
              placeholder="לדוגמה: ישראל ישראלי"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-slate-700 font-medium">אימייל גישה <span className="text-red-500">*</span></Label>
            <div className="relative">
              <Input
                type="email"
                required
                dir="ltr"
                className="h-10 border-slate-200 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 rounded-lg bg-white pl-10"
                placeholder="employee@company.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <Mail className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-700 font-medium">משכורת בסיס (₪) <span className="text-red-500">*</span></Label>
            <div className="relative">
              <Input
                type="number"
                required
                dir="ltr"
                className="h-10 border-slate-200 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 rounded-lg bg-white pl-10"
                placeholder="0"
                value={form.salary}
                onChange={(e) => setForm({ ...form, salary: e.target.value })}
              />
              <BadgeDollarSign className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
          </div>

          <div className="pt-6 mt-6 border-t border-slate-100 pb-8">
            <Button type="submit" className="w-full h-11 gap-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 shadow-sm font-medium transition-all active:scale-[0.98]" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {loading ? 'יוצר עובד...' : 'צור עובד חדש'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}





