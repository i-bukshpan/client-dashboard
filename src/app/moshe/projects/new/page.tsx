'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Loader2, Save, MapPin, Phone, User, DollarSign, CalendarIcon } from 'lucide-react'
import { PaymentScheduleForm, type PaymentRow } from '@/components/moshe/PaymentScheduleForm'
import { createProject } from '@/app/moshe/actions'
import { toast } from 'sonner'

export default function NewProjectPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [payments, setPayments] = useState<PaymentRow[]>([])

  const [form, setForm] = useState({
    name: '',
    address: '',
    contact_name: '',
    contact_phone: '',
    total_project_cost: '',
    start_date: '',
    status: 'active' as 'active' | 'pending' | 'closed',
    notes: '',
  })

  function set(k: keyof typeof form, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const result = await createProject({ ...form, payments })
      if (result.error) { toast.error(result.error); return }
      toast.success('הפרויקט נוצר בהצלחה!')
      router.push(`/moshe/projects/${result.id}`)
    } catch {
      toast.error('אירעה שגיאה בלתי צפויה')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">פרויקט חדש</h1>
        <p className="text-sm text-slate-500 mt-0.5">מלא את פרטי הפרויקט ולוח התשלומים שלו</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* פרטי הפרויקט */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">פרטי הפרויקט</p>

          <div className="space-y-2">
            <Label className="text-slate-700 font-medium">שם הפרויקט <span className="text-red-400">*</span></Label>
            <Input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder='לדוגמה: "בית משותף רחוב הרצל 12"'
              className="h-10 border-slate-200 bg-white"
              required
            />
          </div>

          <div className="space-y-2">
            <Label className="text-slate-700 font-medium">כתובת הפרויקט</Label>
            <div className="relative">
              <Input
                value={form.address}
                onChange={e => set('address', e.target.value)}
                placeholder="רחוב, עיר"
                className="h-10 border-slate-200 bg-white pr-10"
              />
              <MapPin className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">איש קשר</Label>
              <div className="relative">
                <Input
                  value={form.contact_name}
                  onChange={e => set('contact_name', e.target.value)}
                  placeholder="שם איש קשר"
                  className="h-10 border-slate-200 bg-white pr-10"
                />
                <User className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">טלפון</Label>
              <div className="relative">
                <Input
                  dir="ltr"
                  value={form.contact_phone}
                  onChange={e => set('contact_phone', e.target.value)}
                  placeholder="050-0000000"
                  className="h-10 border-slate-200 bg-white pl-10"
                />
                <Phone className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">עלות כוללת צפויה (₪)</Label>
              <div className="relative">
                <Input
                  type="number"
                  dir="ltr"
                  value={form.total_project_cost}
                  onChange={e => set('total_project_cost', e.target.value)}
                  placeholder="0"
                  className="h-10 border-slate-200 bg-white pl-10"
                />
                <DollarSign className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">תאריך תחילה</Label>
              <div className="relative">
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={e => set('start_date', e.target.value)}
                  className="h-10 border-slate-200 bg-white pl-10"
                />
                <CalendarIcon className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-700 font-medium">סטטוס</Label>
            <Select value={form.status} onValueChange={v => set('status', v ?? 'active')}>
              <SelectTrigger className="h-10 border-slate-200 bg-white">
                <SelectValue>
                  {form.status === 'active' ? 'פעיל' : form.status === 'pending' ? 'ממתין' : 'סגור'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">פעיל</SelectItem>
                <SelectItem value="pending">ממתין</SelectItem>
                <SelectItem value="closed">סגור</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-700 font-medium">הערות</Label>
            <Textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="מידע נוסף על הפרויקט..."
              className="min-h-[80px] border-slate-200 bg-white resize-y"
            />
          </div>
        </div>

        {/* לוח תשלומים הפרויקט */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
            לוח תשלומים — הוצאות הפרויקט
          </p>
          <p className="text-xs text-slate-400 mb-4">
            הוצאות שהפרויקט צריך לשלם (לקבלנים, רישומים וכד׳). תאריך אופציונלי — ניתן להוסיף לאחר מכן.
          </p>
          <PaymentScheduleForm
            rows={payments}
            onChange={setPayments}
            label="תשלומי הפרויקט"
            colorClass="border-red-100 bg-red-50/20"
          />
        </div>

        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()} className="flex-1">
            ביטול
          </Button>
          <Button
            type="submit"
            disabled={loading || !form.name.trim()}
            className="flex-1 bg-amber-500 hover:bg-amber-400 text-white font-bold gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {loading ? 'שומר...' : 'צור פרויקט'}
          </Button>
        </div>
      </form>
    </div>
  )
}
