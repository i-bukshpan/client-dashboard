'use client'

import { useState, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Plus, Trash2, ChevronDown, ChevronUp, Check, Landmark, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import { createLoan, deleteLoan, toggleLoanPayment, addLoanPayment, deleteLoanPayment } from '@/app/moshe/actions'
import { toast } from 'sonner'
import type { MosheLoan, MosheLoanPayment, MoshePartner } from '@/types/moshe'

function fmt(n: number) {
  return '₪' + Number(n).toLocaleString('he-IL', { maximumFractionDigits: 0 })
}

interface Props {
  projectId: string
  loans: (MosheLoan & { payments: MosheLoanPayment[] })[]
  partners: MoshePartner[]
}

export function LoansTab({ projectId, loans, partners }: Props) {
  const [pending, startTransition] = useTransition()
  const [addOpen, setAddOpen] = useState(false)
  const [expandedLoan, setExpandedLoan] = useState<string | null>(null)
  const [form, setForm] = useState({
    lender: '', arranged_by: '', total_amount: '',
    interest_rate: '', num_payments: '12', start_date: '', notes: '',
  })
  const [saving, setSaving] = useState(false)

  const partnerMap: Record<string, string> = {}
  partners.forEach(p => { partnerMap[p.id] = p.name })

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.lender.trim()) return toast.error('שם המלווה נדרש')
    if (!form.total_amount) return toast.error('סכום ההלוואה נדרש')
    setSaving(true)
    try {
      const r = await createLoan({ project_id: projectId, ...form })
      if (r.error) { toast.error(r.error); return }
      toast.success('הלוואה נוספה בהצלחה')
      setAddOpen(false)
      setForm({ lender: '', arranged_by: '', total_amount: '', interest_rate: '', num_payments: '12', start_date: '', notes: '' })
    } finally {
      setSaving(false)
    }
  }

  function removeLoan(id: string) {
    if (!confirm('האם למחוק את ההלוואה וכל התשלומים שלה?')) return
    startTransition(async () => {
      const r = await deleteLoan(id, projectId)
      if (r.error) toast.error(r.error)
      else toast.success('הלוואה נמחקה')
    })
  }

  // KPIs
  const totalLoans = loans.reduce((s, l) => s + Number(l.total_amount), 0)
  const totalPaid = loans.reduce((s, l) =>
    s + l.payments.filter(p => p.is_paid).reduce((ss, p) => ss + Number(p.amount), 0), 0)
  const totalRemaining = loans.reduce((s, l) =>
    s + l.payments.filter(p => !p.is_paid).reduce((ss, p) => ss + Number(p.amount), 0), 0)

  return (
    <div className="space-y-4">
      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 text-center">
          <p className="text-[10px] text-violet-500 font-bold uppercase">סה&quot;כ הלוואות</p>
          <p className="text-lg font-black text-violet-700 mt-0.5">{fmt(totalLoans)}</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
          <p className="text-[10px] text-emerald-500 font-bold uppercase">שולם</p>
          <p className="text-lg font-black text-emerald-700 mt-0.5">{fmt(totalPaid)}</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
          <p className="text-[10px] text-amber-600 font-bold uppercase">נותר לשלם</p>
          <p className="text-lg font-black text-amber-700 mt-0.5">{fmt(totalRemaining)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-slate-700">{loans.length} הלוואות בפרויקט</p>
        <Button size="sm" onClick={() => setAddOpen(true)}
          className="gap-1.5 h-9 bg-violet-500 hover:bg-violet-400 text-white text-xs font-bold">
          <Plus className="w-3.5 h-3.5" /> הוסף הלוואה
        </Button>
      </div>

      {loans.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-slate-200">
          <Landmark className="w-10 h-10 text-slate-200 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">אין הלוואות עדיין</p>
          <button onClick={() => setAddOpen(true)} className="text-violet-500 text-xs mt-1 hover:underline">
            + הוסף הלוואה ראשונה
          </button>
        </div>
      )}

      <div className="space-y-3">
        {loans.map(loan => {
          const paid = loan.payments.filter(p => p.is_paid).reduce((s, p) => s + Number(p.amount), 0)
          const total = loan.payments.reduce((s, p) => s + Number(p.amount), 0)
          const pct = total > 0 ? Math.round((paid / total) * 100) : 0
          const paidCount = loan.payments.filter(p => p.is_paid).length
          const isExpanded = expandedLoan === loan.id
          const arrangerName = loan.arranged_by ? partnerMap[loan.arranged_by] : null

          return (
            <div key={loan.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-400 to-fuchsia-500 flex items-center justify-center text-white shrink-0">
                  <Landmark className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 text-sm truncate">{loan.lender}</p>
                  <div className="flex items-center gap-3 text-[10px] text-slate-400">
                    <span>{fmt(Number(loan.total_amount))}</span>
                    {loan.interest_rate && <span>{loan.interest_rate}% ריבית</span>}
                    <span>{paidCount}/{loan.num_payments} תשלומים</span>
                    {arrangerName && <span className="text-indigo-500">דאג: {arrangerName}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-black text-violet-700">{fmt(paid)}</p>
                  <p className="text-[10px] text-slate-400">שולם מתוך {fmt(total)}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => removeLoan(loan.id)} disabled={pending}
                    className="w-8 h-8 rounded-lg border border-slate-100 flex items-center justify-center text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setExpandedLoan(v => v === loan.id ? null : loan.id)}
                    className="w-8 h-8 rounded-lg border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="px-5 pb-3">
                <div className="h-1.5 bg-slate-100 rounded-full">
                  <div className="h-1.5 bg-violet-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5 text-left">{pct}% הוחזר</p>
              </div>

              {isExpanded && (
                <LoanPaymentsList loan={loan} projectId={projectId} />
              )}
            </div>
          )
        })}
      </div>

      {/* Add loan sheet */}
      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-0">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10">
            <SheetHeader>
              <SheetTitle className="text-lg font-bold">הוספת הלוואה חדשה</SheetTitle>
            </SheetHeader>
          </div>
          <form onSubmit={handleAdd} className="p-6 space-y-4">
            <div className="space-y-2">
              <Label className="font-medium text-slate-700">שם המלווה / בנק <span className="text-red-400">*</span></Label>
              <Input value={form.lender} onChange={e => setForm(f => ({ ...f, lender: e.target.value }))} placeholder="לדוגמה: בנק לאומי" className="h-10" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-medium text-slate-700">סכום הלוואה (₪) <span className="text-red-400">*</span></Label>
                <Input type="number" dir="ltr" value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))} placeholder="0" className="h-10" required />
              </div>
              <div className="space-y-2">
                <Label className="font-medium text-slate-700">ריבית (%)</Label>
                <Input type="number" dir="ltr" step="0.01" value={form.interest_rate} onChange={e => setForm(f => ({ ...f, interest_rate: e.target.value }))} placeholder="3.5" className="h-10" />
              </div>
              <div className="space-y-2">
                <Label className="font-medium text-slate-700">מספר תשלומים</Label>
                <Input type="number" dir="ltr" value={form.num_payments} onChange={e => setForm(f => ({ ...f, num_payments: e.target.value }))} placeholder="12" className="h-10" />
              </div>
              <div className="space-y-2">
                <Label className="font-medium text-slate-700">תאריך התחלה</Label>
                <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="h-10" />
              </div>
            </div>
            {partners.length > 0 && (
              <div className="space-y-2">
                <Label className="font-medium text-slate-700">מי דאג להלוואה (שותף)</Label>
                <Select value={form.arranged_by} onValueChange={v => setForm(f => ({ ...f, arranged_by: v ?? '' }))}>
                  <SelectTrigger className="h-10 text-sm border-slate-200 bg-white">
                    <SelectValue placeholder="בחר שותף (אופציונלי)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">ללא</SelectItem>
                    {partners.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label className="font-medium text-slate-700">הערות</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="h-10" />
            </div>
            <div className="bg-violet-50 rounded-xl p-3 text-xs text-violet-600">
              💡 לוח תשלומים ייווצר אוטומטית לפי מספר התשלומים שנקבע
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)} className="flex-1">ביטול</Button>
              <Button type="submit" disabled={saving || !form.lender.trim() || !form.total_amount}
                className="flex-1 bg-violet-500 hover:bg-violet-400 text-white font-bold">
                {saving ? 'שומר...' : 'הוסף הלוואה'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function LoanPaymentsList({ loan, projectId }: {
  loan: MosheLoan & { payments: MosheLoanPayment[] }
  projectId: string
}) {
  const [pending, startTransition] = useTransition()
  const [showAdd, setShowAdd] = useState(false)
  const [newRow, setNewRow] = useState({ amount: '', due_date: '', notes: '' })
  const today = new Date()

  const sorted = [...loan.payments].sort((a, b) => {
    if (!a.due_date && !b.due_date) return 0
    if (!a.due_date) return 1
    if (!b.due_date) return -1
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  })

  function toggle(p: MosheLoanPayment) {
    startTransition(async () => {
      const r = await toggleLoanPayment(p.id, projectId, !p.is_paid)
      if (r.error) toast.error(r.error)
    })
  }

  function remove(id: string) {
    startTransition(async () => {
      const r = await deleteLoanPayment(id, projectId)
      if (r.error) toast.error(r.error)
      else toast.success('תשלום נמחק')
    })
  }

  async function addRow() {
    if (!newRow.amount) return toast.error('סכום נדרש')
    const r = await addLoanPayment({ loan_id: loan.id, project_id: projectId, ...newRow })
    if (r.error) { toast.error(r.error); return }
    toast.success('תשלום נוסף')
    setNewRow({ amount: '', due_date: '', notes: '' })
    setShowAdd(false)
  }

  return (
    <div className="border-t border-slate-100">
      <div className="px-4 py-2 bg-slate-50/50 flex items-center justify-between">
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">לוח תשלומים</p>
        <button onClick={() => setShowAdd(v => !v)}
          className="text-[11px] text-violet-600 font-bold hover:text-violet-700 flex items-center gap-1">
          <Plus className="w-3 h-3" /> הוסף תשלום
        </button>
      </div>

      {showAdd && (
        <div className="px-4 py-3 bg-violet-50/30 border-b border-slate-100 grid grid-cols-[1fr_1fr_2fr_auto] gap-2 items-end">
          <Input type="number" placeholder="סכום ₪" dir="ltr" value={newRow.amount}
            onChange={e => setNewRow(r => ({ ...r, amount: e.target.value }))}
            className="h-8 text-xs border-slate-200 bg-white" />
          <Input type="date" value={newRow.due_date}
            onChange={e => setNewRow(r => ({ ...r, due_date: e.target.value }))}
            className="h-8 text-xs border-slate-200 bg-white" />
          <Input placeholder="הערות" value={newRow.notes}
            onChange={e => setNewRow(r => ({ ...r, notes: e.target.value }))}
            className="h-8 text-xs border-slate-200 bg-white" />
          <Button size="sm" onClick={addRow} className="h-8 text-xs bg-violet-500 hover:bg-violet-400 text-white px-3">שמור</Button>
        </div>
      )}

      {sorted.map(p => {
        const due = p.due_date ? new Date(p.due_date) : null
        const overdue = due && !p.is_paid && due < today

        return (
          <div key={p.id} className={cn(
            'flex items-center gap-3 px-4 py-2.5 border-b border-slate-50 last:border-0',
            p.is_paid ? 'bg-slate-50/30' : overdue ? 'bg-red-50/20' : ''
          )}>
            <button onClick={() => toggle(p)} disabled={pending}
              className={cn(
                'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
                p.is_paid ? 'bg-violet-500 border-violet-500 text-white' : overdue ? 'border-red-300' : 'border-slate-200 hover:border-violet-400'
              )}>
              {p.is_paid && <Check className="w-2.5 h-2.5" />}
            </button>

            <div className="w-12 shrink-0 text-center">
              {due ? (
                <p className={cn('text-xs font-bold', overdue ? 'text-red-500' : p.is_paid ? 'text-slate-300' : 'text-slate-600')}>
                  {format(due, 'dd/MM')}
                </p>
              ) : (
                <CalendarDays className="w-3.5 h-3.5 text-slate-200 mx-auto" />
              )}
            </div>

            <p className={cn('flex-1 text-xs truncate', p.is_paid ? 'line-through text-slate-300' : 'text-slate-600')}>
              {p.notes || '—'}
            </p>

            <p className={cn('font-bold text-xs shrink-0', p.is_paid ? 'text-slate-300 line-through' : overdue ? 'text-red-600' : 'text-violet-700')}>
              {fmt(Number(p.amount))}
            </p>

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
