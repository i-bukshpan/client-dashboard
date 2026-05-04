'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Save, MapPin, Phone, User, DollarSign, CalendarIcon, ArrowRight, Trash2 } from 'lucide-react'
import { updateProject, deleteProject } from '@/app/moshe/actions'
import { toast } from 'sonner'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function EditProjectPage() {
  const router = useRouter()
  const { id } = useParams() as { id: string }
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [fetching, setFetching] = useState(true)

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

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('moshe_projects' as any)
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }: { data: any }) => {
        if (data) {
          setForm({
            name: data.name ?? '',
            address: data.address ?? '',
            contact_name: data.contact_name ?? '',
            contact_phone: data.contact_phone ?? '',
            total_project_cost: data.total_project_cost ? String(data.total_project_cost) : '',
            start_date: data.start_date ?? '',
            status: data.status ?? 'active',
            notes: data.notes ?? '',
          })
        }
        setFetching(false)
      })
  }, [id])

  function set(k: keyof typeof form, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const result = await updateProject(id, form)
      if (result.error) { toast.error(result.error); return }
      toast.success('הפרויקט עודכן בהצלחה!')
      router.push(`/moshe/projects/${id}`)
    } catch {
      toast.error('אירעה שגיאה בלתי צפויה')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`למחוק את הפרויקט "${form.name}"? פעולה זו לא ניתנת לביטול.`)) return
    setDeleting(true)
    try {
      const result = await deleteProject(id)
      if (result.error) { toast.error(result.error); return }
      toast.success('הפרויקט נמחק')
      router.push('/moshe/projects')
    } catch {
      toast.error('שגיאה במחיקה')
    } finally {
      setDeleting(false)
    }
  }

  if (fetching) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-400 mb-6">
        <Link href="/moshe/projects" className="hover:text-slate-600 transition-colors">פרויקטים</Link>
        <ArrowRight className="w-4 h-4 rotate-180" />
        <Link href={`/moshe/projects/${id}`} className="hover:text-slate-600 transition-colors">{form.name}</Link>
        <ArrowRight className="w-4 h-4 rotate-180" />
        <span className="text-slate-700 font-medium">עריכה</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900">עריכת פרויקט</h1>
          <p className="text-sm text-slate-500 mt-0.5">עדכן את פרטי הפרויקט</p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleDelete}
          disabled={deleting}
          className="border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 gap-2"
        >
          {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          מחק פרויקט
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
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
            {loading ? 'שומר...' : 'שמור שינויים'}
          </Button>
        </div>
      </form>
    </div>
  )
}
