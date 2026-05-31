'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { addLog, deleteLog } from '@/app/moshe/actions'
import { toast } from 'sonner'
import { format, formatDistanceToNow } from 'date-fns'
import { he } from 'date-fns/locale'
import { Plus, Trash2, ClipboardList, User, CalendarDays } from 'lucide-react'
import { ActivityLogClient } from '@/components/moshe/ActivityLogClient'

interface LogEntry {
  id: string
  project_id: string
  actor: string
  action: string
  details: string | null
  created_at: string
  log_date: string | null
}

interface Props {
  projectId: string
  logs: LogEntry[]
}

export function ActivityLogTab({ projectId, logs }: Props) {
  const [pending, startTransition] = useTransition()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ action: '', details: '', actor: 'משה', log_date: '' })

  async function handleAdd() {
    if (!form.action.trim()) return toast.error('תיאור הפעולה נדרש')
    const r = await addLog(projectId, form.action.trim(), form.details.trim() || undefined, form.actor.trim() || 'משה', form.log_date || undefined)
    if (r.error) { toast.error(r.error); return }
    toast.success('רשומה נוספה ללוג')
    setForm({ action: '', details: '', actor: 'משה', log_date: '' })
    setShowAdd(false)
  }

  function handleDelete(id: string) {
    if (!confirm('למחוק רשומה זו מהלוג?')) return
    startTransition(async () => {
      const r = await deleteLog(id, projectId)
      if (r.error) toast.error(r.error)
      else toast.success('רשומה נמחקה')
    })
  }

  const sorted = [...logs].sort((a, b) => b.created_at.localeCompare(a.created_at))

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-amber-500" />
            <p className="text-sm font-bold text-slate-700">לוג פעילות ({logs.length})</p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setShowAdd(v => !v)}
            className="text-xs gap-1.5 h-8 text-amber-600 hover:bg-amber-50">
            <Plus className="w-3.5 h-3.5" /> הוסף רשומה
          </Button>
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="px-4 py-4 bg-amber-50/40 border-b border-amber-100 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <p className="text-[10px] text-slate-400 mb-1">תיאור הפעולה <span className="text-red-400">*</span></p>
                <Input
                  placeholder='לדוגמה: "חתמנו על חוזה עם קבלן"'
                  value={form.action}
                  onChange={e => setForm(f => ({ ...f, action: e.target.value }))}
                  className="h-9 text-sm border-slate-200 bg-white"
                />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 mb-1">מבוצע ע"י</p>
                <div className="relative">
                  <Input
                    placeholder="שם המבצע"
                    value={form.actor}
                    onChange={e => setForm(f => ({ ...f, actor: e.target.value }))}
                    className="h-9 text-sm border-slate-200 bg-white pr-8"
                  />
                  <User className="absolute end-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <p className="text-[10px] text-slate-400 mb-1">תאריך האירוע (אופציונלי)</p>
                <div className="relative">
                  <Input
                    type="date"
                    value={form.log_date}
                    onChange={e => setForm(f => ({ ...f, log_date: e.target.value }))}
                    className="h-9 text-sm border-slate-200 bg-white pr-8"
                  />
                  <CalendarDays className="absolute end-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300 pointer-events-none" />
                </div>
              </div>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 mb-1">פרטים נוספים (אופציונלי)</p>
              <Textarea
                placeholder="מידע נוסף, הערות, קישורים..."
                value={form.details}
                onChange={e => setForm(f => ({ ...f, details: e.target.value }))}
                className="min-h-[64px] text-sm border-slate-200 bg-white resize-none"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)} className="h-8 text-xs">ביטול</Button>
              <Button size="sm" onClick={handleAdd}
                className="h-8 bg-amber-500 hover:bg-amber-400 text-white text-xs gap-1">
                <Plus className="w-3.5 h-3.5" />הוסף
              </Button>
            </div>
          </div>
        )}

        {/* Log entries via ActivityLogClient */}
        <div className="p-4 bg-slate-50/50">
          <ActivityLogClient entries={logs as any[]} projectMap={{}} />
        </div>
      </div>
    </div>
  )
}

