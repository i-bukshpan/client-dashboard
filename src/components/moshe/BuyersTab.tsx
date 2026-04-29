'use client'

import { useState, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Check, Plus, Trash2, ChevronDown, ChevronUp, User, CalendarDays, Pencil, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import { createBuyer, deleteBuyer, toggleBuyerPayment, addBuyerPayment, deleteBuyerPayment, updateBuyerPayment, updateBuyer } from '@/app/moshe/actions'
import { PaymentScheduleForm, type PaymentRow } from './PaymentScheduleForm'
import { toast } from 'sonner'
import type { MosheBuyer, MosheBuyerPayment } from '@/types/moshe'

function fmt(n: number) {
  return '₪' + Number(n).toLocaleString('he-IL', { maximumFractionDigits: 0 })
}

interface Props {
  projectId: string
  buyers: (MosheBuyer & { payments: MosheBuyerPayment[] })[]
}

export function BuyersTab({ projectId, buyers }: Props) {
  const [pending, startTransition] = useTransition()
  const [addOpen, setAddOpen] = useState(false)
  const [expandedBuyer, setExpandedBuyer] = useState<string | null>(null)
  const [editBuyer, setEditBuyer] = useState<MosheBuyer | null>(null)
  const [editForm, setEditForm] = useState({
    name: '', phone: '', email: '', id_number: '',
    unit_description: '', contract_date: '', total_amount: '', notes: '',
  })
  const [editSaving, setEditSaving] = useState(false)

  const [form, setForm] = useState({
    name: '', phone: '', email: '', id_number: '',
    unit_description: '', contract_date: '', total_amount: '', notes: '',
  })
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [saving, setSaving] = useState(false)

  function setF(k: string, v: string) {
    setForm((f: any) => ({ ...f, [k]: v }))
  }

  function openEditBuyer(buyer: MosheBuyer) {
    setEditBuyer(buyer)
    setEditForm({
      name: buyer.name,
      phone: buyer.phone ?? '',
      email: buyer.email ?? '',
      id_number: buyer.id_number ?? '',
      unit_description: buyer.unit_description ?? '',
      contract_date: buyer.contract_date ?? '',
      total_amount: buyer.total_amount ? String(buyer.total_amount) : '',
      notes: buyer.notes ?? '',
    })
  }

  async function handleEditBuyer(e: React.FormEvent) {
    e.preventDefault()
    if (!editBuyer) return
    setEditSaving(true)
    try {
      const r = await updateBuyer(editBuyer.id, editForm)
      if (r.error) { toast.error(r.error); return }
      toast.success('פרטי קונה עודכנו')
      setEditBuyer(null)
    } finally {
      setEditSaving(false)
    }
  }

  async function handleAddBuyer(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const r = await createBuyer({ project_id: projectId, ...form, payments })
      if (r.error) { toast.error(r.error); return }
      toast.success('קונה נוסף בהצלחה')
      setAddOpen(false)
      setForm({ name: '', phone: '', email: '', id_number: '', unit_description: '', contract_date: '', total_amount: '', notes: '' })
      setPayments([])
    } finally {
      setSaving(false)
    }
  }

  function toggleExpand(id: string) {
    setExpandedBuyer(v => v === id ? null : id)
  }

  function removeBuyer(id: string) {
    startTransition(async () => {
      const r = await deleteBuyer(id, projectId)
      if (r.error) toast.error(r.error)
      else toast.success('קונה נמחק')
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-slate-700">{buyers.length} קונים בפרויקט</p>
        <Button size="sm" onClick={() => setAddOpen(true)}
          className="gap-1.5 h-9 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold">
          <Plus className="w-3.5 h-3.5" /> הוסף קונה
        </Button>
      </div>

      {buyers.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-slate-200">
          <User className="w-10 h-10 text-slate-200 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">אין קונים עדיין</p>
          <button onClick={() => setAddOpen(true)} className="text-emerald-500 text-xs mt-1 hover:underline">
            + הוסף קונה ראשון
          </button>
        </div>
      )}

      <div className="space-y-3">
        {buyers.map(buyer => {
          const received = buyer.payments.filter(p => p.is_received).reduce((s, p) => s + Number(p.amount), 0)
          const total = buyer.payments.reduce((s, p) => s + Number(p.amount), 0)
          const pct = total > 0 ? Math.round((received / total) * 100) : 0
          const isExpanded = expandedBuyer === buyer.id
          const today = new Date()
          const overdue = buyer.payments.filter(p => !p.is_received && p.due_date && new Date(p.due_date) < today)

          return (
            <div key={buyer.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-black text-sm shrink-0">
                  {buyer.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-bold text-slate-900 text-sm truncate">{buyer.name}</p>
                    {overdue.length > 0 && (
                      <span className="text-[9px] bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded-full">
                        {overdue.length} באיחור
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-slate-400">
                    {buyer.unit_description && <span>{buyer.unit_description}</span>}
                    {buyer.phone && <span dir="ltr">{buyer.phone}</span>}
                    {buyer.contract_date && <span>חתם {format(new Date(buyer.contract_date), 'dd/MM/yyyy')}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-black text-emerald-700">{fmt(received)}</p>
                  <p className="text-[10px] text-slate-400">מתוך {fmt(total)}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => openEditBuyer(buyer)}
                    className="w-8 h-8 rounded-lg border border-slate-100 flex items-center justify-center text-slate-300 hover:text-amber-500 hover:bg-amber-50 transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => toggleExpand(buyer.id)}
                    className="w-8 h-8 rounded-lg border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="px-5 pb-3">
                <div className="h-1.5 bg-slate-100 rounded-full">
                  <div className="h-1.5 bg-emerald-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5 text-left">{pct}% שולם</p>
              </div>

              {isExpanded && (
                <BuyerPaymentsList
                  buyer={buyer}
                  projectId={projectId}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Add buyer sheet */}
      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-0">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10">
            <SheetHeader>
              <SheetTitle className="text-lg font-bold">הוספת קונה חדש</SheetTitle>
            </SheetHeader>
          </div>
          <form onSubmit={handleAddBuyer} className="p-6 space-y-5">
            <BuyerFields form={form} setF={setF} />
            <PaymentScheduleForm
              rows={payments}
              onChange={setPayments}
              label="לוח תשלומים של הקונה (הכנסות)"
              colorClass="border-emerald-100 bg-emerald-50/20"
            />
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)} className="flex-1">ביטול</Button>
              <Button type="submit" disabled={saving || !form.name.trim()}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white font-bold gap-2">
                {saving ? 'שומר...' : 'הוסף קונה'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Edit buyer sheet */}
      <Sheet open={!!editBuyer} onOpenChange={open => !open && setEditBuyer(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-0">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10">
            <SheetHeader>
              <SheetTitle className="text-lg font-bold">עריכת קונה: {editBuyer?.name}</SheetTitle>
            </SheetHeader>
          </div>
          <form onSubmit={handleEditBuyer} className="p-6 space-y-5">
            <BuyerFields
              form={editForm}
              setF={(k, v) => setEditForm(f => ({ ...f, [k]: v }))}
            />
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditBuyer(null)} className="flex-1">ביטול</Button>
              <Button type="submit" disabled={editSaving || !editForm.name.trim()}
                className="flex-1 bg-amber-500 hover:bg-amber-400 text-white font-bold">
                {editSaving ? 'שומר...' : 'שמור שינויים'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function BuyerFields({ form, setF }: {
  form: { name: string; phone: string; email: string; id_number: string; unit_description: string; contract_date: string; total_amount: string; notes: string }
  setF: (k: string, v: string) => void
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2 col-span-2">
          <Label className="font-medium text-slate-700">שם הקונה <span className="text-red-400">*</span></Label>
          <Input value={form.name} onChange={e => setF('name', e.target.value)} placeholder="שם מלא" className="h-10" required />
        </div>
        <div className="space-y-2">
          <Label className="font-medium text-slate-700">טלפון</Label>
          <Input dir="ltr" value={form.phone} onChange={e => setF('phone', e.target.value)} placeholder="050-0000000" className="h-10" />
        </div>
        <div className="space-y-2">
          <Label className="font-medium text-slate-700">אימייל</Label>
          <Input type="email" dir="ltr" value={form.email} onChange={e => setF('email', e.target.value)} placeholder="mail@example.com" className="h-10" />
        </div>
        <div className="space-y-2">
          <Label className="font-medium text-slate-700">ת.ז.</Label>
          <Input dir="ltr" value={form.id_number} onChange={e => setF('id_number', e.target.value)} placeholder="000000000" className="h-10" />
        </div>
        <div className="space-y-2">
          <Label className="font-medium text-slate-700">יחידה / דירה</Label>
          <Input value={form.unit_description} onChange={e => setF('unit_description', e.target.value)} placeholder="דירה 3, קומה 2" className="h-10" />
        </div>
        <div className="space-y-2">
          <Label className="font-medium text-slate-700">תאריך חתימה</Label>
          <Input type="date" value={form.contract_date} onChange={e => setF('contract_date', e.target.value)} className="h-10" />
        </div>
        <div className="space-y-2">
          <Label className="font-medium text-slate-700">סכום כולל (₪)</Label>
          <Input type="number" dir="ltr" value={form.total_amount} onChange={e => setF('total_amount', e.target.value)} placeholder="0" className="h-10" />
        </div>
      </div>
      <div className="space-y-2">
        <Label className="font-medium text-slate-700">הערות</Label>
        <Textarea value={form.notes} onChange={e => setF('notes', e.target.value)} className="min-h-[60px] resize-y" />
      </div>
    </div>
  )
}

function BuyerPaymentsList({ buyer, projectId }: {
  buyer: MosheBuyer & { payments: MosheBuyerPayment[] }
  projectId: string
}) {
  const [pending, startTransition] = useTransition()
  const [showAdd, setShowAdd] = useState(false)
  const [newRow, setNewRow] = useState({ amount: '', due_date: '', notes: '' })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRow, setEditRow] = useState({ amount: '', due_date: '', notes: '' })
  const today = new Date()

  const sorted = [...buyer.payments].sort((a, b) => {
    if (!a.due_date && !b.due_date) return 0
    if (!a.due_date) return 1
    if (!b.due_date) return -1
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  })

  function toggle(p: MosheBuyerPayment) {
    startTransition(async () => {
      const r = await toggleBuyerPayment(p.id, projectId, !p.is_received)
      if (r.error) toast.error(r.error)
    })
  }

  function remove(id: string) {
    startTransition(async () => {
      const r = await deleteBuyerPayment(id, projectId)
      if (r.error) toast.error(r.error)
      else toast.success('תשלום נמחק')
    })
  }

  async function addRow() {
    if (!newRow.amount) return toast.error('סכום נדרש')
    const r = await addBuyerPayment({ buyer_id: buyer.id, project_id: projectId, ...newRow })
    if (r.error) { toast.error(r.error); return }
    toast.success('תשלום נוסף')
    setNewRow({ amount: '', due_date: '', notes: '' })
    setShowAdd(false)
  }

  function startEdit(p: MosheBuyerPayment) {
    setEditingId(p.id)
    setEditRow({ amount: String(p.amount), due_date: p.due_date ?? '', notes: p.notes ?? '' })
  }

  function saveEdit(id: string) {
    startTransition(async () => {
      const r = await updateBuyerPayment(id, editRow)
      if (r.error) { toast.error(r.error); return }
      toast.success('תשלום עודכן')
      setEditingId(null)
    })
  }

  return (
    <div className="border-t border-slate-100">
      <div className="px-4 py-2 bg-slate-50/50 flex items-center justify-between">
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">תשלומים</p>
        <button onClick={() => setShowAdd(v => !v)}
          className="text-[11px] text-emerald-600 font-bold hover:text-emerald-700 flex items-center gap-1">
          <Plus className="w-3 h-3" /> הוסף
        </button>
      </div>

      {showAdd && (
        <div className="px-4 py-3 bg-emerald-50/30 border-b border-slate-100 grid grid-cols-[1fr_1fr_2fr_auto] gap-2 items-end">
          <Input type="number" placeholder="סכום ₪" dir="ltr" value={newRow.amount}
            onChange={e => setNewRow(r => ({ ...r, amount: e.target.value }))}
            className="h-8 text-xs border-slate-200 bg-white" />
          <Input type="date" value={newRow.due_date}
            onChange={e => setNewRow(r => ({ ...r, due_date: e.target.value }))}
            className="h-8 text-xs border-slate-200 bg-white" />
          <Input placeholder="הערות" value={newRow.notes}
            onChange={e => setNewRow(r => ({ ...r, notes: e.target.value }))}
            className="h-8 text-xs border-slate-200 bg-white" />
          <Button size="sm" onClick={addRow} className="h-8 text-xs bg-emerald-500 hover:bg-emerald-400 text-white px-3">שמור</Button>
        </div>
      )}

      {sorted.map(p => {
        const due = p.due_date ? new Date(p.due_date) : null
        const overdue = due && !p.is_received && due < today

        if (editingId === p.id) {
          return (
            <div key={p.id} className="px-4 py-2.5 bg-amber-50/40 border-b border-amber-100 grid grid-cols-[1fr_1fr_2fr_auto_auto] gap-2 items-center">
              <Input type="number" dir="ltr" value={editRow.amount}
                onChange={e => setEditRow(r => ({ ...r, amount: e.target.value }))}
                className="h-9 text-sm border-amber-200 bg-white" />
              <Input type="date" value={editRow.due_date}
                onChange={e => setEditRow(r => ({ ...r, due_date: e.target.value }))}
                className="h-9 text-sm border-amber-200 bg-white" />
              <Input value={editRow.notes}
                onChange={e => setEditRow(r => ({ ...r, notes: e.target.value }))}
                placeholder="הערות" className="h-9 text-sm border-amber-200 bg-white" />
              <Button size="sm" onClick={() => saveEdit(p.id)} disabled={pending}
                className="h-9 text-xs bg-amber-500 hover:bg-amber-400 text-white px-3">שמור</Button>
              <button onClick={() => setEditingId(null)}
                className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )
        }

        return (
          <div key={p.id} className={cn(
            'flex items-center gap-3 px-4 py-2.5 border-b border-slate-50 last:border-0 group',
            p.is_received ? 'bg-slate-50/30' : overdue ? 'bg-red-50/20' : ''
          )}>
            <button onClick={() => toggle(p)} disabled={pending}
              className={cn(
                'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
                p.is_received ? 'bg-emerald-500 border-emerald-500 text-white' : overdue ? 'border-red-300' : 'border-slate-200 hover:border-emerald-400'
              )}>
              {p.is_received && <Check className="w-2.5 h-2.5" />}
            </button>

            <div className="w-12 shrink-0 text-center">
              {due ? (
                <p className={cn('text-xs font-bold', overdue ? 'text-red-500' : p.is_received ? 'text-slate-300' : 'text-slate-600')}>
                  {format(due, 'dd/MM')}
                </p>
              ) : (
                <CalendarDays className="w-3.5 h-3.5 text-slate-200 mx-auto" />
              )}
            </div>

            <p className={cn('flex-1 text-xs truncate', p.is_received ? 'line-through text-slate-300' : 'text-slate-600')}>
              {p.notes || '—'}
            </p>

            <p className={cn('font-bold text-xs shrink-0', p.is_received ? 'text-slate-300 line-through' : overdue ? 'text-red-600' : 'text-emerald-700')}>
              {fmt(Number(p.amount))}
            </p>

            <button onClick={() => startEdit(p)} disabled={pending}
              className="w-6 h-6 rounded text-slate-200 hover:text-amber-500 hover:bg-amber-50 flex items-center justify-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <Pencil className="w-3 h-3" />
            </button>

            <button onClick={() => remove(p.id)} disabled={pending}
              className="w-6 h-6 rounded text-slate-200 hover:text-red-400 hover:bg-red-50 flex items-center justify-center shrink-0">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
