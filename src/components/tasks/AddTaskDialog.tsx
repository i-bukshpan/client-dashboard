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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Loader2, ClipboardList } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface Props {
  clients: { id: string; name: string }[]
  employees: { id: string; full_name: string }[]
}

export function AddTaskDialog({ clients, employees }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title: '',
    priority: 'medium',
    client_id: '',
    assigned_to: '',
    due_date: '',
  })

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('לא נמצא משתמש מחובר. נסה לרענן את העמוד.')
      }

      const { error } = await (supabase.from('tasks') as any).insert({
        title: form.title,
        priority: form.priority as any,
        client_id: form.client_id || null,
        assigned_to: form.assigned_to || null,
        due_date: form.due_date || null,
        created_by: user.id,
        status: 'todo',
      })

      if (error) {
        console.error('Supabase error:', error)
        throw new Error(error.message || 'שגיאה ביצירת משימה במסד הנתונים')
      }

      toast.success('משימה נוצרה בהצלחה')
      setOpen(false)
      window.location.reload()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'אירעה שגיאה בלתי צפויה')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="gap-2 bg-slate-900 text-white hover:bg-slate-800 shadow-sm rounded-lg">
          <Plus className="w-4 h-4" />
          משימה חדשה
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0 border-l-slate-200" side="right">
        <div className="p-6 pb-6 border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10 backdrop-blur-sm">
          <SheetHeader>
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center mb-2 shadow-sm border border-purple-200">
              <ClipboardList className="w-5 h-5 text-purple-700" />
            </div>
            <SheetTitle className="text-xl font-bold text-slate-900">יצירת משימה חדשה</SheetTitle>
            <SheetDescription className="text-slate-500 text-sm">
              הוסף משימה לצוות שלך. ניתן לשייך ללקוח ולעובד ספציפי.
            </SheetDescription>
          </SheetHeader>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-5">
          <div className="space-y-2">
            <Label className="text-slate-700 font-medium">שם המשימה <span className="text-red-500">*</span></Label>
            <Input 
              required 
              className="h-10 border-slate-200 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 rounded-lg bg-white"
              value={form.title} 
              onChange={(e) => setForm({ ...form, title: e.target.value })} 
              placeholder="לדוגמה: הכנת דוח שנתי"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">עדיפות</Label>
              <Select 
                value={form.priority} 
                onValueChange={(v: any) => setForm({ ...form, priority: v })}
              >
                <SelectTrigger className="h-10 border-slate-200 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 rounded-lg bg-white">
                  <SelectValue placeholder="בחר עדיפות" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">נמוכה</SelectItem>
                  <SelectItem value="medium">בינונית</SelectItem>
                  <SelectItem value="high">גבוהה</SelectItem>
                  <SelectItem value="urgent">דחופה</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">תאריך יעד</Label>
              <Input 
                type="date" 
                dir="ltr" 
                className="h-10 border-slate-200 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 rounded-lg bg-white"
                value={form.due_date} 
                onChange={(e) => setForm({ ...form, due_date: e.target.value })} 
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-700 font-medium">שיוך ללקוח (אופציונלי)</Label>
            <Select 
              value={form.client_id} 
              onValueChange={(v: any) => setForm({ ...form, client_id: v })}
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
            <Label className="text-slate-700 font-medium">אחראי לביצוע</Label>
            <Select 
              value={form.assigned_to} 
              onValueChange={(v: any) => setForm({ ...form, assigned_to: v })}
            >
              <SelectTrigger className="h-10 border-slate-200 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 rounded-lg bg-white">
                <SelectValue placeholder="בחר עובד" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="pt-6 mt-6 border-t border-slate-100 pb-8">
            <Button type="submit" disabled={loading} className="w-full h-11 gap-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 shadow-sm font-medium transition-all active:scale-[0.98]">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {loading ? 'יוצר משימה...' : 'צור משימה חדשה'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}




