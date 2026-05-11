'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus } from 'lucide-react'
import { addWorkerLog } from '@/app/moshe/actions'
import { toast } from 'sonner'

export function WorkerLogAdd({ workerId, projectId }: { workerId: string; projectId: string }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ log_date: new Date().toISOString().split('T')[0], note: '' })
  const [saving, setSaving] = useState(false)

  async function handleAdd() {
    if (!form.note.trim()) return toast.error('הערה נדרשת')
    setSaving(true)
    try {
      const r = await addWorkerLog({ worker_id: workerId, project_id: projectId, ...form })
      if (r.error) { toast.error(r.error); return }
      toast.success('רשומה נוספה')
      setForm(f => ({ ...f, note: '' }))
      setShowForm(false)
    } finally { setSaving(false) }
  }

  if (!showForm) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setShowForm(true)}
        className="text-xs gap-1.5 h-8 text-orange-600 hover:bg-orange-50">
        <Plus className="w-3.5 h-3.5" /> הוסף רשומה
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Input type="date" value={form.log_date} onChange={e => setForm(f => ({ ...f, log_date: e.target.value }))}
        className="h-8 text-xs border-slate-200 w-32" />
      <Input placeholder="תיאור..." value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
        className="h-8 text-xs border-slate-200 w-44" />
      <Button size="sm" onClick={handleAdd} disabled={saving}
        className="h-8 bg-orange-500 hover:bg-orange-400 text-white text-xs px-3">
        {saving ? '...' : 'שמור'}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setShowForm(false)} className="h-8 text-xs">ביטול</Button>
    </div>
  )
}
