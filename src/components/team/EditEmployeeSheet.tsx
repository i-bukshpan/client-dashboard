'use client'

import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Mail, BadgeDollarSign, Save, KeyRound } from 'lucide-react'
import { updateEmployee, updateEmployeePassword } from '@/app/(admin)/team/actions'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Props {
  employee: {
    id: string
    name: string
    email: string
    salaryBase: number
  }
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditEmployeeSheet({ employee, open, onOpenChange }: Props) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: employee.name,
    email: employee.email,
    salary: employee.salaryBase.toString(),
  })
  const [password, setPassword] = useState('')

  async function onUpdateDetails(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    
    const res = await updateEmployee(employee.id, {
      name: form.name,
      email: form.email,
      salary: Number(form.salary)
    })

    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success('פרטי העובד עודכנו בהצלחה')
      onOpenChange(false)
    }
    setLoading(false)
  }

  async function onUpdatePassword() {
    if (!password || password.length < 6) {
      toast.error('הסיסמה חייבת להכיל לפחות 6 תווים')
      return
    }
    
    setLoading(true)
    const res = await updateEmployeePassword(employee.id, password)

    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success('סיסמת העובד עודכנה בהצלחה')
      setPassword('')
    }
    setLoading(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0 border-l-slate-200" side="right">
        <div className="p-6 pb-6 border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10 backdrop-blur-sm">
          <SheetHeader>
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mb-2 shadow-sm border border-blue-200">
              <KeyRound className="w-5 h-5 text-blue-700" />
            </div>
            <SheetTitle className="text-xl font-bold text-slate-900">עריכת פרטי עובד</SheetTitle>
            <SheetDescription className="text-slate-500 text-sm">
              עדכן את פרטי העובד או את סיסמת הגישה שלו למערכת.
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="p-6 space-y-8">
          {/* Details Form */}
          <form onSubmit={onUpdateDetails} className="space-y-5">
            <h3 className="font-bold text-slate-900 border-r-4 border-blue-500 pr-3">פרטים כלליים</h3>
            
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">שם מלא</Label>
              <Input
                required
                className="h-10 border-slate-200 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 rounded-lg bg-white"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">אימייל גישה</Label>
              <div className="relative">
                <Input
                  type="email"
                  required
                  dir="ltr"
                  className="h-10 border-slate-200 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 rounded-lg bg-white pl-10"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
                <Mail className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">משכורת בסיס (₪)</Label>
              <div className="relative">
                <Input
                  type="number"
                  required
                  dir="ltr"
                  className="h-10 border-slate-200 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 rounded-lg bg-white pl-10"
                  value={form.salary}
                  onChange={(e) => setForm({ ...form, salary: e.target.value })}
                />
                <BadgeDollarSign className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
            </div>

            <Button type="submit" className="w-full h-11 gap-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 shadow-sm font-medium transition-all" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              עדכן פרטים
            </Button>
          </form>

          <div className="h-px bg-slate-100" />

          {/* Password Section */}
          <div className="space-y-5">
            <h3 className="font-bold text-slate-900 border-r-4 border-amber-500 pr-3">אבטחה וסיסמה</h3>
            
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">סיסמה חדשה</Label>
              <Input
                type="password"
                placeholder="לפחות 6 תווים"
                className="h-10 border-slate-200 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 rounded-lg bg-white"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <Button 
              type="button" 
              variant="outline"
              className="w-full h-11 gap-2 rounded-lg border-amber-200 text-amber-700 hover:bg-amber-50 font-medium" 
              disabled={loading || !password}
              onClick={onUpdatePassword}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              עדכן סיסמה בלבד
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
