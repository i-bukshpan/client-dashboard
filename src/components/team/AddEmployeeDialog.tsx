'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UserPlus, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createEmployee } from '@/app/(admin)/team/actions'
import { toast } from 'sonner'

export function AddEmployeeDialog() {
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
      toast.success(`העובד נוצר בהצלחה! סיסמה זמנית: ${res.tempPassword}`)
      setOpen(false)
      window.location.reload()
    }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <UserPlus className="w-4 h-4" />
          הוסף עובד
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>הוספת עובד חדש</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>שם מלא</Label>
            <Input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>אימייל</Label>
            <Input
              type="email"
              required
              dir="ltr"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>משכורת בסיס (₪)</Label>
            <Input
              type="number"
              required
              dir="ltr"
              value={form.salary}
              onChange={(e) => setForm({ ...form, salary: e.target.value })}
            />
          </div>
          <DialogFooter>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin me-2" />}
              צור עובד
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}



