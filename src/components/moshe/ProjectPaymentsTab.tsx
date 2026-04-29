'use client'

import { useState, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Check, Plus, Trash2, CalendarDays, Pencil, X } from 'lucide-react'
import { toggleProjectPayment, deleteProjectPayment, addProjectPayment, updateProjectPayment } from '@/app/moshe/actions'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { MosheProjectPayment } from '@/types/moshe'

function fmt(n: number) {
  return '₪' + Number(n).toLocaleString('he-IL', { maximumFractionDigits: 0 })
}

interface Props {
  projectId: string
  payments: MosheProjectPayment[]
}

export function ProjectPaymentsTab({ projectId, payments }: Props) {
  const [pending, startTransition] = useTransition()
  const [showAdd, setShowAdd] = useState(false)
  const [newRow, setNewRow] = useState({ amount: '', due_date: '', notes: '' })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRow, setEditRow] = useState({ amount: '', due_date: '', notes: '' })

  const totalPaid = payments.filter(p => p.is_paid).reduce((s, p) => s + Number(p.amount), 0)
  const totalScheduled = payments.reduce((s, p) => s + Number(p.amount), 0)
  const today = new Date()

  function toggle(p: MosheProjectPayment) {
    startTransition(async () => {
      const r = await toggleProjectPayment(p.id, projectId, !p.is_paid)
      if (r.error) toast.error(r.error)
    })
  }

  function remove(id: string) {
    startTransition(async () => {
      const r = await deleteProjectPayment(id, projectId)
      if (r.error) toast.error(r.error)
      else toast.success('תשלום נמחק')
    })
  }

  async function addRow() {
    if (!newRow.amount) return toast.error('סכום נדרש')
    const r = await addProjectPayment({ project_id: projectId, ...newRow })
    if (r.error) { toast.error(r.error); return }
    toast.success('תשלום נוסף')
    setNewRow({ amount: '', due_date: '', notes: '' })
    setShowAdd(false)
  }

  function startEdit(p: MosheProjectPayment) {
    setEditingId(p.id)
    setEditRow({ amount: String(p.amount), due_date: p.due_date ?? '', notes: p.notes ?? '' })
  }

  function saveEdit(id: string) {
    startTransition(async () => {
      const r = await updateProjectPayment(id, editRow)
      if (r.error) { toast.error(r.error); return }
      toast.success('תשלום עודכן')
      setEditingId(null)
    })
  }

  const sorted = [...payments].sort((a, b) => {
    if (!a.due_date && !b.due_date) return 0
    if (!a.due_date) return 1
    if (!b.due_date) return -1
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
          <p className="text-[10px] text-red-500 font-bold uppercase tracking-wider">שולם בפועל</p>
          <p className="text-lg font-black text-red-700 mt-0.5">{fmt(totalPaid)}</p>
        </div>
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">לפי לוח</p>
          <p className="text-lg font-black text-slate-700 mt-0.5">{fmt(totalScheduled)}</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
          <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">נותר לשלם</p>
          <p className="text-lg font-black text-amber-700 mt-0.5">{fmt(totalScheduled - totalPaid)}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <p className="text-sm font-bold text-slate-700">לוח תשלומים</p>
          <Button size="sm" variant="ghost" onClick={() => setShowAdd(v => !v)}
            className="text-xs gap-1.5 h-8 text-amber-600 hover:bg-amber-50">
            <Plus className="w-3.5 h-3.5" /> הוסף תשלום
          </Button>
        </div>

        {showAdd && (
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 grid grid-cols-[1fr_1fr_2fr_auto] gap-2 items-end">
            <div>
              <p className="text-[10px] text-slate-400 mb-1">סכום (₪)</p>
              <Input type="number" placeholder="0" dir="ltr" value={newRow.amount}
                onChange={e => setNewRow(r => ({ ...r, amount: e.target.value }))}
                className="h-9 text-sm border-slate-200 bg-white" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 mb-1">תאריך</p>
              <Input type="date" value={newRow.due_date}
                onChange={e => setNewRow(r => ({ ...r, due_date: e.target.value }))}
                className="h-9 text-sm border-slate-200 bg-white" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 mb-1">הערות</p>
              <Input placeholder="תיאור..." value={newRow.notes}
                onChange={e => setNewRow(r => ({ ...r, notes: e.target.value }))}
                className="h-9 text-sm border-slate-200 bg-white" />
            </div>
            <Button size="sm" onClick={addRow}
              className="h-9 bg-amber-500 hover:bg-amber-400 text-white text-xs">שמור</Button>
          </div>
        )}

        <div className="divide-y divide-slate-50">
          {sorted.length === 0 && (
            <p className="text-center text-sm text-slate-400 py-10">אין תשלומים. לחץ "הוסף תשלום" להוספה.</p>
          )}
          {sorted.map(p => {
            const due = p.due_date ? new Date(p.due_date) : null
            const overdue = due && !p.is_paid && due < today

            if (editingId === p.id) {
              return (
                <div key={p.id} className="px-4 py-3 bg-amber-50/60 grid grid-cols-[1fr_1fr_2fr_auto_auto] gap-2 items-end border-b border-amber-100">
                  <div>
                    <p className="text-[10px] text-slate-400 mb-1">סכום (₪)</p>
                    <Input type="number" dir="ltr" value={editRow.amount}
                      onChange={e => setEditRow(r => ({ ...r, amount: e.target.value }))}
                      className="h-9 text-sm border-amber-200 bg-white" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 mb-1">תאריך</p>
                    <Input type="date" value={editRow.due_date}
                      onChange={e => setEditRow(r => ({ ...r, due_date: e.target.value }))}
                      className="h-9 text-sm border-amber-200 bg-white" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 mb-1">הערות</p>
                    <Input value={editRow.notes}
                      onChange={e => setEditRow(r => ({ ...r, notes: e.target.value }))}
                      className="h-9 text-sm border-amber-200 bg-white" />
                  </div>
                  <Button size="sm" onClick={() => saveEdit(p.id)} disabled={pending}
                    className="h-9 bg-amber-500 hover:bg-amber-400 text-white text-xs px-3">שמור</Button>
                  <button onClick={() => setEditingId(null)}
                    className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )
            }

            return (
              <div key={p.id} className={cn(
                'flex items-center gap-4 px-4 py-3 transition-colors group',
                p.is_paid ? 'bg-slate-50/50' : overdue ? 'bg-red-50/30' : 'hover:bg-slate-50/50'
              )}>
                <button
                  onClick={() => toggle(p)}
                  disabled={pending}
                  className={cn(
                    'w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
                    p.is_paid
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : overdue
                        ? 'border-red-300 hover:border-red-400'
                        : 'border-slate-200 hover:border-amber-400'
                  )}
                >
                  {p.is_paid && <Check className="w-3.5 h-3.5" />}
                </button>

                <div className="w-16 shrink-0">
                  {due ? (
                    <div className={cn(
                      'text-center rounded-lg py-1',
                      overdue ? 'bg-red-100' : p.is_paid ? 'bg-slate-100' : 'bg-amber-50'
                    )}>
                      <p className={cn('text-[9px] font-bold leading-none', overdue ? 'text-red-400' : 'text-slate-400')}>
                        {format(due, 'MMM', { locale: he })}
                      </p>
                      <p className={cn('text-base font-black leading-tight', overdue ? 'text-red-600' : p.is_paid ? 'text-slate-400' : 'text-amber-700')}>
                        {format(due, 'd')}
                      </p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <CalendarDays className="w-4 h-4 text-slate-200 mx-auto" />
                      <p className="text-[9px] text-slate-300 mt-0.5">לא נקבע</p>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  {p.notes && <p className={cn('text-sm truncate', p.is_paid ? 'line-through text-slate-400' : 'text-slate-700')}>{p.notes}</p>}
                  {p.is_paid && p.paid_at && (
                    <p className="text-[10px] text-emerald-500">
                      שולם {format(new Date(p.paid_at), 'dd/MM/yyyy')}
                    </p>
                  )}
                </div>

                <p className={cn('font-black text-sm shrink-0', p.is_paid ? 'text-slate-400 line-through' : overdue ? 'text-red-600' : 'text-slate-800')}>
                  {fmt(Number(p.amount))}
                </p>

                <button onClick={() => startEdit(p)} disabled={pending}
                  className="w-7 h-7 rounded-lg text-slate-200 hover:text-amber-500 hover:bg-amber-50 flex items-center justify-center transition-colors shrink-0 opacity-0 group-hover:opacity-100">
                  <Pencil className="w-3.5 h-3.5" />
                </button>

                <button onClick={() => remove(p.id)} disabled={pending}
                  className="w-7 h-7 rounded-lg text-slate-200 hover:text-red-400 hover:bg-red-50 flex items-center justify-center transition-colors shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
