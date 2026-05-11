'use client'

import { useState, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { HardHat, Plus, Trash2, ChevronDown, ChevronUp, Phone, Mail, ClipboardList, Shield, CalendarDays, Pencil, Send, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { createWorker, updateWorker, deleteWorker, setWorkerPermissions, addWorkerLog, deleteWorkerLog, invitePortalUser } from '@/app/moshe/actions'
import { toast } from 'sonner'

function fmt(s: string) { return s }

const ROLE_LABELS: Record<string, string> = { worker: 'עובד', foreman: 'ממונה' }

interface Worker {
  id: string
  name: string
  phone: string | null
  email: string | null
  role: string
  notes: string | null
  is_active: boolean
  permissions: { project_id: string; can_view: boolean; can_log: boolean }[]
  logs: { id: string; log_date: string; note: string; project_id: string | null }[]
}

interface Project { id: string; name: string; status: string }

interface Props {
  workers: Worker[]
  projects: Project[]
}

const EMPTY_FORM = { name: '', phone: '', email: '', role: 'worker' as 'worker' | 'foreman', notes: '' }

export function WorkersManager({ workers, projects }: Props) {
  const [, startTransition] = useTransition()
  const [addOpen, setAddOpen] = useState(false)
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Record<string, 'logs' | 'perms'>>({})
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('שם נדרש')
    setSaving(true)
    try {
      const r = await createWorker(form)
      if (r.error) { toast.error(r.error); return }
      toast.success('עובד נוסף')
      setAddOpen(false)
      setForm(EMPTY_FORM)
    } finally { setSaving(false) }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingWorker) return
    setSaving(true)
    try {
      const r = await updateWorker(editingWorker.id, { ...form, is_active: editingWorker.is_active })
      if (r.error) { toast.error(r.error); return }
      toast.success('עובד עודכן')
      setEditingWorker(null)
    } finally { setSaving(false) }
  }

  function openEdit(w: Worker) {
    setForm({ name: w.name, phone: w.phone ?? '', email: w.email ?? '', role: w.role as any, notes: w.notes ?? '' })
    setEditingWorker(w)
  }

  function handleDelete(id: string) {
    if (!confirm('למחוק את העובד?')) return
    startTransition(async () => {
      const r = await deleteWorker(id)
      if (r.error) toast.error(r.error)
      else toast.success('עובד נמחק')
    })
  }

  const activeWorkers   = workers.filter(w => w.is_active)
  const inactiveWorkers = workers.filter(w => !w.is_active)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center">
            <HardHat className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900">ניהול עובדים</h1>
            <p className="text-xs text-slate-400">{activeWorkers.length} עובדים פעילים</p>
          </div>
        </div>
        <Button onClick={() => { setForm(EMPTY_FORM); setAddOpen(true) }}
          className="gap-1.5 bg-orange-500 hover:bg-orange-400 text-white text-sm font-bold">
          <Plus className="w-4 h-4" /> הוסף עובד
        </Button>
      </div>

      {workers.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-200">
          <HardHat className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400">אין עובדים עדיין</p>
          <button onClick={() => setAddOpen(true)} className="text-orange-500 text-sm mt-1 hover:underline">+ הוסף עובד ראשון</button>
        </div>
      ) : (
        <div className="space-y-3">
          {[...activeWorkers, ...inactiveWorkers].map(worker => (
            <WorkerCard key={worker.id} worker={worker} projects={projects}
              expanded={expandedId === worker.id}
              tab={activeTab[worker.id] ?? 'logs'}
              onToggle={() => setExpandedId(v => v === worker.id ? null : worker.id)}
              onTabChange={t => setActiveTab(prev => ({ ...prev, [worker.id]: t }))}
              onEdit={() => openEdit(worker)}
              onDelete={() => handleDelete(worker.id)}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Sheet */}
      <Sheet open={addOpen || !!editingWorker} onOpenChange={open => { if (!open) { setAddOpen(false); setEditingWorker(null) } }}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto p-0">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10">
            <SheetHeader><SheetTitle className="text-lg font-bold">{editingWorker ? 'עריכת עובד' : 'הוספת עובד חדש'}</SheetTitle></SheetHeader>
          </div>
          <form onSubmit={editingWorker ? handleEdit : handleAdd} className="p-6 space-y-4">
            <div className="space-y-2">
              <Label>שם מלא <span className="text-red-400">*</span></Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="שם העובד" className="h-10" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>טלפון</Label>
                <Input dir="ltr" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="050-0000000" className="h-10" />
              </div>
              <div className="space-y-2">
                <Label>אימייל</Label>
                <Input type="email" dir="ltr" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="mail@example.com" className="h-10" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>תפקיד</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v as any }))}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="worker">עובד</SelectItem>
                  <SelectItem value="foreman">ממונה</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>הערות</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="h-10" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => { setAddOpen(false); setEditingWorker(null) }} className="flex-1">ביטול</Button>
              <Button type="submit" disabled={saving} className="flex-1 bg-orange-500 hover:bg-orange-400 text-white font-bold">
                {saving ? 'שומר...' : editingWorker ? 'עדכן' : 'הוסף'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function WorkerCard({ worker, projects, expanded, tab, onToggle, onTabChange, onEdit, onDelete }: {
  worker: Worker; projects: Project[]
  expanded: boolean; tab: 'logs' | 'perms'
  onToggle: () => void; onTabChange: (t: 'logs' | 'perms') => void
  onEdit: () => void; onDelete: () => void
}) {
  const [inviting, setInviting] = useState(false)

  async function handleInvite() {
    if (!worker.email) return
    if (!confirm(`לשלוח הזמנה ל-${worker.email}?`)) return
    setInviting(true)
    const r = await invitePortalUser(worker.email)
    setInviting(false)
    if (r.error) toast.error(r.error)
    else toast.success('הזמנה נשלחה בהצלחה!')
  }

  return (
    <div className={cn('bg-white rounded-2xl border shadow-sm overflow-hidden', worker.is_active ? 'border-slate-100' : 'border-slate-100 opacity-60')}>
      <div className="px-5 py-4 flex items-center gap-4">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0',
          worker.role === 'foreman' ? 'bg-gradient-to-br from-amber-400 to-orange-500' : 'bg-gradient-to-br from-slate-400 to-slate-500')}>
          {worker.name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-slate-900 text-sm">{worker.name}</p>
            <span className={cn('text-[9px] font-bold px-2 py-0.5 rounded-full',
              worker.role === 'foreman' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500')}>
              {ROLE_LABELS[worker.role] ?? worker.role}
            </span>
            {!worker.is_active && <span className="text-[9px] bg-red-100 text-red-500 px-2 py-0.5 rounded-full font-bold">לא פעיל</span>}
          </div>
          <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-0.5">
            {worker.phone && <span className="flex items-center gap-0.5"><Phone className="w-2.5 h-2.5" />{worker.phone}</span>}
            {worker.email && <span className="flex items-center gap-0.5"><Mail className="w-2.5 h-2.5" />{worker.email}</span>}
            <span>{worker.permissions.length} פרויקטים · {worker.logs.length} רשומות</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={onEdit} className="w-8 h-8 rounded-lg border border-slate-100 flex items-center justify-center text-slate-300 hover:text-amber-500 hover:bg-amber-50">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          {worker.email && (
            <button
              onClick={handleInvite}
              disabled={inviting}
              title="שלח הזמנה לפורטל"
              className="w-8 h-8 rounded-lg border border-slate-100 flex items-center justify-center text-slate-300 hover:text-blue-500 hover:bg-blue-50 hover:border-blue-200 transition-colors disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
          <a
            href={`/moshe/preview/worker/${worker.id}`}
            target="_blank"
            rel="noopener noreferrer"
            title="תצוגה מקדימה של פורטל עובד"
            className="w-8 h-8 rounded-lg border border-slate-100 flex items-center justify-center text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 hover:border-emerald-200 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button onClick={onDelete} className="w-8 h-8 rounded-lg border border-slate-100 flex items-center justify-center text-slate-300 hover:text-red-400 hover:bg-red-50">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={onToggle} className="w-8 h-8 rounded-lg border border-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-50">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100">
          {/* Tab bar */}
          <div className="flex border-b border-slate-100">
            {([['logs', 'יומן עובד', ClipboardList], ['perms', 'הרשאות פרויקטים', Shield]] as const).map(([t, label, Icon]) => (
              <button key={t} onClick={() => onTabChange(t)}
                className={cn('flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold transition-colors',
                  tab === t ? 'text-orange-600 border-b-2 border-orange-500 -mb-px bg-orange-50/40' : 'text-slate-400 hover:text-slate-600')}>
                <Icon className="w-3.5 h-3.5" />{label}
              </button>
            ))}
          </div>

          {tab === 'logs' && <WorkerLogPanel worker={worker} projects={projects} />}
          {tab === 'perms' && <WorkerPermPanel worker={worker} projects={projects} />}
        </div>
      )}
    </div>
  )
}

function WorkerLogPanel({ worker, projects }: { worker: Worker; projects: Project[] }) {
  const [, startTransition] = useTransition()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ log_date: new Date().toISOString().split('T')[0], note: '', project_id: '' })
  const projectMap = Object.fromEntries(projects.map(p => [p.id, p.name]))

  async function handleAdd() {
    if (!form.note.trim()) return toast.error('הערה נדרשת')
    const r = await addWorkerLog({ worker_id: worker.id, ...form })
    if (r.error) { toast.error(r.error); return }
    toast.success('רשומה נוספה')
    setForm(f => ({ ...f, note: '', project_id: '' }))
    setShowAdd(false)
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const r = await deleteWorkerLog(id)
      if (r.error) toast.error(r.error)
    })
  }

  const sorted = [...worker.logs].sort((a, b) => b.log_date.localeCompare(a.log_date))

  return (
    <div>
      <div className="px-4 py-2 flex items-center justify-between bg-slate-50/50">
        <p className="text-[11px] font-bold text-slate-500 uppercase">יומן פעילות</p>
        <button onClick={() => setShowAdd(v => !v)} className="text-[11px] text-orange-600 font-bold hover:text-orange-700 flex items-center gap-1">
          <Plus className="w-3 h-3" /> הוסף רשומה
        </button>
      </div>

      {showAdd && (
        <div className="px-4 py-3 bg-orange-50/30 border-b border-slate-100 space-y-2">
          <div className="grid grid-cols-[auto_1fr_1fr] gap-2 items-end">
            <div>
              <p className="text-[10px] text-slate-400 mb-1">תאריך</p>
              <Input type="date" value={form.log_date} onChange={e => setForm(f => ({ ...f, log_date: e.target.value }))}
                className="h-8 text-xs border-slate-200 bg-white w-32" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 mb-1">פרויקט (אופציונלי)</p>
              <Select value={form.project_id} onValueChange={v => setForm(f => ({ ...f, project_id: v === '_none' ? '' : v }) as typeof f)}>
                <SelectTrigger className="h-8 text-xs border-slate-200 bg-white"><SelectValue placeholder="— בלי פרויקט —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— בלי פרויקט —</SelectItem>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 mb-1">הערה</p>
              <Input placeholder="תיאור פעילות..." value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                className="h-8 text-xs border-slate-200 bg-white" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)} className="h-7 text-xs">ביטול</Button>
            <Button size="sm" onClick={handleAdd} className="h-7 text-xs bg-orange-500 hover:bg-orange-400 text-white px-3">שמור</Button>
          </div>
        </div>
      )}

      {sorted.length === 0 && !showAdd && (
        <p className="text-center text-xs text-slate-400 py-6">אין רשומות עדיין</p>
      )}
      {sorted.map(log => (
        <div key={log.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-50 last:border-0 group">
          <CalendarDays className="w-3.5 h-3.5 text-slate-300 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-700">{log.note}</p>
            <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
              <span>{format(new Date(log.log_date + 'T00:00:00'), 'dd/MM/yyyy')}</span>
              {log.project_id && projectMap[log.project_id] && (
                <><span>·</span><span className="text-amber-600">{projectMap[log.project_id]}</span></>
              )}
            </div>
          </div>
          <button onClick={() => handleDelete(log.id)}
            className="w-6 h-6 rounded text-slate-200 hover:text-red-400 hover:bg-red-50 flex items-center justify-center shrink-0 opacity-0 group-hover:opacity-100">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  )
}

function WorkerPermPanel({ worker, projects }: { worker: Worker; projects: Project[] }) {
  const currentProjectIds = worker.permissions.map(p => p.project_id)
  const currentCanLog = worker.permissions.some(p => p.can_log)
  const [selected, setSelected] = useState<string[]>(currentProjectIds)
  const [canLog, setCanLog] = useState(currentCanLog)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const r = await setWorkerPermissions(worker.id, selected, canLog)
      if (r.error) { toast.error(r.error); return }
      toast.success('הרשאות עודכנו')
    } finally { setSaving(false) }
  }

  function toggle(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  return (
    <div className="px-4 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-slate-600">פרויקטים נגישים לעובד</p>
        <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
          <input type="checkbox" checked={canLog} onChange={e => setCanLog(e.target.checked)}
            className="w-3.5 h-3.5 accent-orange-500" />
          יכול להוסיף ללוג
        </label>
      </div>

      <div className="space-y-1 max-h-48 overflow-y-auto">
        {projects.map(p => (
          <label key={p.id} className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-slate-50 cursor-pointer">
            <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)}
              className="w-3.5 h-3.5 accent-orange-500" />
            <span className="text-xs text-slate-700">{p.name}</span>
            <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full ms-auto',
              p.status === 'active' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400')}>
              {p.status === 'active' ? 'פעיל' : p.status === 'pending' ? 'ממתין' : 'סגור'}
            </span>
          </label>
        ))}
      </div>

      <Button size="sm" onClick={handleSave} disabled={saving}
        className="h-8 bg-orange-500 hover:bg-orange-400 text-white text-xs w-full">
        {saving ? 'שומר...' : 'שמור הרשאות'}
      </Button>
    </div>
  )
}
