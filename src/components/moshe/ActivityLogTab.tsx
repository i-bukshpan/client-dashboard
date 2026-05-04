'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { addLog, deleteLog } from '@/app/moshe/actions'
import { toast } from 'sonner'
import { format, formatDistanceToNow } from 'date-fns'
import { he } from 'date-fns/locale'
import { Plus, Trash2, ClipboardList, User } from 'lucide-react'

interface LogEntry {
  id: string
  project_id: string
  actor: string
  action: string
  details: string | null
  created_at: string
}

interface Props {
  projectId: string
  logs: LogEntry[]
}

export function ActivityLogTab({ projectId, logs }: Props) {
  const [pending, startTransition] = useTransition()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ action: '', details: '', actor: 'משה' })

  async function handleAdd() {
    if (!form.action.trim()) return toast.error('תיאור הפעולה נדרש')
    const r = await addLog(projectId, form.action.trim(), form.details.trim() || undefined, form.actor.trim() || 'משה')
    if (r.error) { toast.error(r.error); return }
    toast.success('רשומה נוספה ללוג')
    setForm({ action: '', details: '', actor: 'משה' })
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
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

        {/* Log entries */}
        <div className="relative">
          {sorted.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-12">
              אין רשומות בלוג. לחץ "הוסף רשומה" לתיעוד פעילות.
            </p>
          ) : (
            <div className="px-4 py-2">
              {/* Timeline */}
              <div className="relative space-y-0">
                {sorted.map((log, idx) => (
                  <div key={log.id} className="flex gap-4 py-3 group">
                    {/* Timeline dot + line */}
                    <div className="flex flex-col items-center shrink-0">
                      <div className="w-8 h-8 rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center shrink-0 text-amber-600">
                        <span className="text-[10px] font-black">{log.actor.slice(0, 1)}</span>
                      </div>
                      {idx < sorted.length - 1 && (
                        <div className="w-0.5 flex-1 bg-slate-100 mt-1" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800">{log.action}</p>
                          {log.details && (
                            <p className="text-xs text-slate-500 mt-1 whitespace-pre-wrap">{log.details}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-400">
                            <span className="flex items-center gap-0.5">
                              <User className="w-3 h-3" />{log.actor}
                            </span>
                            <span>·</span>
                            <span title={format(new Date(log.created_at), 'dd/MM/yyyy HH:mm', { locale: he })}>
                              {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: he })}
                            </span>
                            <span>·</span>
                            <span>{format(new Date(log.created_at), 'dd/MM/yyyy')}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDelete(log.id)}
                          disabled={pending}
                          className="w-7 h-7 rounded-lg text-slate-200 hover:text-red-400 hover:bg-red-50 flex items-center justify-center transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
