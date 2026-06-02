'use client'

import { useState, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Plus, Trash2, ChevronDown, ChevronUp, Check, Landmark, CalendarDays, Pencil, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import { createLoan, deleteLoan, toggleLoanPayment, addLoanPayment, deleteLoanPayment, updateLoan, updateLoanPayment } from '@/app/moshe/actions'
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

const EMPTY_FORM = {
  lender: '', arranged_by: '', total_amount: '',
  interest_rate: '', num_payments: '0', start_date: '', end_date: '', notes: '',
}

function LoanFormFields({ f, setF, partners, partnerMap }: { f: typeof EMPTY_FORM, setF: (fn: (prev: typeof EMPTY_FORM) => typeof EMPTY_FORM) => void, partners: MoshePartner[], partnerMap: Record<string, string> }) {
  return (
    <>
      <div className="space-y-2">
        <Label className="font-medium text-slate-700">שם המלווה / בנק <span className="text-red-400">*</span></Label>
        <Input value={f.lender} onChange={e => setF(prev => ({ ...prev, lender: e.target.value }))} placeholder="לדוגמה: בנק לאומי" className="h-10" required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="font-medium text-slate-700">סכום הלוואה (₪) <span className="text-red-400">*</span></Label>
          <Input type="number" dir="ltr" value={f.total_amount} onChange={e => setF(prev => ({ ...prev, total_amount: e.target.value }))} placeholder="0" className="h-10" required />
        </div>
        <div className="space-y-2">
          <Label className="font-medium text-slate-700">ריבית (%)</Label>
          <Input type="number" dir="ltr" step="0.01" value={f.interest_rate} onChange={e => setF(prev => ({ ...prev, interest_rate: e.target.value }))} placeholder="3.5" className="h-10" />
        </div>
        <div className="space-y-2">
          <Label className="font-medium text-slate-700">מספר תשלומים</Label>
          <Input type="number" dir="ltr" value={f.num_payments} onChange={e => setF(prev => ({ ...prev, num_payments: e.target.value }))} placeholder="0" className="h-10" />
        </div>
        <div className="space-y-2">
          <Label className="font-medium text-slate-700">תאריך התחלה</Label>
          <Input type="date" value={f.start_date} onChange={e => setF(prev => ({ ...prev, start_date: e.target.value }))} className="h-10" />
        </div>
        <div className="space-y-2">
          <Label className="font-medium text-slate-700">תאריך פירעון</Label>
          <Input type="date" value={f.end_date} onChange={e => setF(prev => ({ ...prev, end_date: e.target.value }))} className="h-10" />
        </div>
      </div>
      {partners.length > 0 && (
        <div className="space-y-2">
          <Label className="font-medium text-slate-700">מי דאג להלוואה (שותף)</Label>
          <Select value={f.arranged_by || '__none__'} onValueChange={v => setF(prev => ({ ...prev, arranged_by: v === '__none__' ? '' : (v as string) }))}>
            <SelectTrigger className="h-10 text-sm border-slate-200 bg-white">
              <SelectValue placeholder="בחר שותף (אופציונלי)">
                {f.arranged_by ? (partnerMap[f.arranged_by] ?? 'בחר שותף') : 'ללא'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">ללא</SelectItem>
              {partners.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-2">
        <Label className="font-medium text-slate-700">הערות</Label>
        <Input value={f.notes} onChange={e => setF(prev => ({ ...prev, notes: e.target.value }))} className="h-10" />
      </div>
    </>
  )
}

export function LoansTab({ projectId, loans, partners }: Props) {
  const [pending, startTransition] = useTransition()
  const [addOpen, setAddOpen] = useState(false)
  const [editLoan, setEditLoan] = useState<(MosheLoan & { payments: MosheLoanPayment[] }) | null>(null)
  const [expandedLoan, setExpandedLoan] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
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
      setForm(EMPTY_FORM)
    } finally {
      setSaving(false)
    }
  }

  function openEdit(loan: MosheLoan & { payments: MosheLoanPayment[] }) {
    setEditLoan(loan)
    setEditForm({
      lender: loan.lender,
      arranged_by: loan.arranged_by ?? '',
      total_amount: String(loan.total_amount),
      interest_rate: loan.interest_rate ? String(loan.interest_rate) : '',
      num_payments: String(loan.num_payments),
      start_date: loan.start_date ?? '',
      end_date: loan.end_date ?? '',
      notes: loan.notes ?? '',
    })
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editLoan) return
    if (!editForm.lender.trim()) return toast.error('שם המלווה נדרש')
    if (!editForm.total_amount) return toast.error('סכום ההלוואה נדרש')
    setSaving(true)
    try {
      const r = await updateLoan(editLoan.id, { ...editForm, project_id: projectId })
      if (r.error) { toast.error(r.error); return }
      toast.success('הלוואה עודכנה בהצלחה')
      setEditLoan(null)
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
    s + l.payments.filter(p => p.is_paid && !p.is_interest).reduce((ss, p) => ss + Number(p.amount), 0), 0)
  const totalInterest = loans.reduce((s, l) =>
    s + l.payments.filter(p => p.is_paid && p.is_interest).reduce((ss, p) => ss + Number(p.amount), 0), 0)
  const totalRemaining = loans.reduce((s, l) => {
    const paid = l.payments.filter(p => p.is_paid && !p.is_interest).reduce((ss, p) => ss + Number(p.amount), 0)
    return s + (Number(l.total_amount) - paid)
  }, 0)

  return (
    <div className="space-y-4">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 text-center overflow-hidden">
          <p className="text-[10px] text-violet-500 font-bold uppercase truncate">סה"כ הלוואות</p>
          <p className="text-lg font-black text-violet-700 mt-0.5 truncate">{fmt(totalLoans)}</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center overflow-hidden">
          <p className="text-[10px] text-emerald-500 font-bold uppercase truncate">שולם (קרן)</p>
          <p className="text-lg font-black text-emerald-700 mt-0.5 truncate">{fmt(totalPaid)}</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center overflow-hidden">
          <p className="text-[10px] text-amber-500 font-bold uppercase truncate">שולם (ריבית)</p>
          <p className="text-lg font-black text-amber-700 mt-0.5 truncate">{fmt(totalInterest)}</p>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center overflow-hidden">
          <p className="text-[10px] text-red-500 font-bold uppercase truncate">נותר לשלם (קרן)</p>
          <p className="text-lg font-black text-red-700 mt-0.5 truncate">{fmt(totalRemaining)}</p>
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
          const paid = loan.payments.filter(p => p.is_paid && !p.is_interest).reduce((s, p) => s + Number(p.amount), 0)
          const total = Number(loan.total_amount)
          const pct = total > 0 ? Math.round((paid / total) * 100) : 0
          const paidCount = loan.payments.filter(p => p.is_paid).length
          const isExpanded = expandedLoan === loan.id
          const arrangerName = loan.arranged_by ? partnerMap[loan.arranged_by] : null
          let calculatedInterest = loan.interest_rate ? total * (Number(loan.interest_rate) / 100) : 0
          let interestLabel = 'שנתי'
          if (loan.start_date && loan.end_date && loan.interest_rate) {
            const start = new Date(loan.start_date).getTime()
            const end = new Date(loan.end_date).getTime()
            if (end > start) {
              const years = (end - start) / (1000 * 60 * 60 * 24 * 365.25)
              calculatedInterest = total * (Number(loan.interest_rate) / 100) * years
              interestLabel = 'סך הכל'
            }
          }

          return (
            <div key={loan.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-4 sm:px-5 py-4 flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center">
                <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-400 to-fuchsia-500 flex items-center justify-center text-white shrink-0 mt-0.5">
                    <Landmark className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 text-sm break-words whitespace-normal leading-tight">{loan.lender}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400 mt-1">
                      <span>{fmt(total)}</span>
                      {loan.interest_rate && <span>{loan.interest_rate}% ריבית ({interestLabel}: {fmt(calculatedInterest)})</span>}
                      <span>{paidCount}/{loan.num_payments} תשלומים</span>
                      {arrangerName && <span className="text-indigo-500">דאג: {arrangerName}</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400 mt-0.5">
                      {loan.start_date && (
                        <span className="flex items-center gap-0.5">
                          <CalendarDays className="w-3 h-3" />
                          מ-{format(new Date(loan.start_date + 'T00:00:00'), 'dd/MM/yyyy', { locale: he })}
                        </span>
                      )}
                      {loan.end_date && (
                        <span className="flex items-center gap-0.5">
                          עד {format(new Date(loan.end_date + 'T00:00:00'), 'dd/MM/yyyy', { locale: he })}
                        </span>
                      )}
                      {loan.notes && <span className="truncate max-w-[200px] text-slate-400 italic">{loan.notes}</span>}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between sm:justify-end gap-4 bg-slate-50/50 sm:bg-transparent rounded-lg p-2 sm:p-0">
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-violet-700">{fmt(total - paid)}</p>
                    <p className="text-[10px] text-slate-400">יתרה מתוך {fmt(total)}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => openEdit(loan)} disabled={pending}
                      className="w-8 h-8 rounded-lg border border-slate-100 flex items-center justify-center text-slate-300 hover:text-violet-500 hover:bg-violet-50 transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
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
              </div>

              {/* Progress bar */}
              <div className="px-5 pb-3">
                <div className="h-1.5 bg-slate-100 rounded-full">
                  <div className="h-1.5 bg-violet-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5 text-left">{pct}% הוחזר</p>
              </div>

              {isExpanded && (
                <LoanPaymentsList loan={loan} projectId={projectId} partners={partners} />
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
            <LoanFormFields f={form} setF={setForm} partners={partners} partnerMap={partnerMap} />
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

      {/* Edit loan sheet */}
      <Sheet open={!!editLoan} onOpenChange={open => !open && setEditLoan(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-0">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10">
            <SheetHeader>
              <SheetTitle className="text-lg font-bold">עריכת הלוואה</SheetTitle>
            </SheetHeader>
          </div>
          <form onSubmit={handleEdit} className="p-6 space-y-4">
            <LoanFormFields f={editForm} setF={setEditForm} partners={partners} partnerMap={partnerMap} />
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditLoan(null)} className="flex-1">ביטול</Button>
              <Button type="submit" disabled={saving || !editForm.lender.trim() || !editForm.total_amount}
                className="flex-1 bg-violet-500 hover:bg-violet-400 text-white font-bold">
                {saving ? 'שומר...' : 'שמור שינויים'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function LoanPaymentsList({ loan, projectId, partners }: {
  loan: MosheLoan & { payments: MosheLoanPayment[] }
  projectId: string
  partners: MoshePartner[]
}) {
  const [pending, startTransition] = useTransition()
  const [showAdd, setShowAdd] = useState(false)
  const [newRow, setNewRow] = useState({ amount: '', due_date: '', notes: '', is_interest: false, add_as_expense: false, partner_action_type: 'none', partner_id: '', action_notes: '' })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRow, setEditRow] = useState({ amount: '', due_date: '', notes: '' })
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
    if (!confirm('האם אתה בטוח שברצונך למחוק תשלום זה?')) return
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
    setNewRow({ amount: '', due_date: '', notes: '', is_interest: false, add_as_expense: false, partner_action_type: 'none', partner_id: '', action_notes: '' })
    setShowAdd(false)
  }

  function startEdit(p: MosheLoanPayment) {
    setEditingId(p.id)
    setEditRow({ amount: String(p.amount), due_date: p.due_date ?? '', notes: p.notes ?? '' })
  }

  function saveEdit(id: string) {
    startTransition(async () => {
      const r = await updateLoanPayment(id, editRow)
      if (r.error) { toast.error(r.error); return }
      toast.success('תשלום עודכן')
      setEditingId(null)
    })
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
        <div className="px-4 py-4 bg-violet-50/30 border-b border-slate-100 flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_2fr_auto] gap-3 items-end">
            <Input type="number" placeholder="סכום ₪" dir="ltr" value={newRow.amount}
              onChange={e => setNewRow(r => ({ ...r, amount: e.target.value }))}
              className="h-11 sm:h-9 text-base sm:text-sm border-slate-200 bg-white" />
            <Input type="date" value={newRow.due_date}
              onChange={e => setNewRow(r => ({ ...r, due_date: e.target.value }))}
              className="h-11 sm:h-9 text-base sm:text-sm border-slate-200 bg-white" />
            <Input placeholder="הערות" value={newRow.notes}
              onChange={e => setNewRow(r => ({ ...r, notes: e.target.value }))}
              className="h-11 sm:h-9 text-base sm:text-sm border-slate-200 bg-white" />
            <Button size="sm" onClick={addRow} className="h-11 sm:h-9 text-base sm:text-sm bg-violet-500 hover:bg-violet-400 text-white px-5 w-full sm:w-auto mt-2 sm:mt-0">שמור</Button>
          </div>
          <div className="flex flex-col gap-3 bg-white p-3 sm:p-2 rounded-xl border border-slate-100 shadow-sm mt-3">
            <label className="flex items-center gap-2.5 text-sm sm:text-xs text-slate-700 cursor-pointer py-1">
              <input type="checkbox" className="w-4 h-4 sm:w-3 sm:h-3 rounded border-slate-300 text-violet-500"
                checked={newRow.is_interest} onChange={e => setNewRow(r => ({ ...r, is_interest: e.target.checked }))} />
              תשלום ריבית
            </label>
            {newRow.is_interest && (
              <div className="flex flex-col sm:flex-row gap-4 sm:items-center border-t border-slate-100 pt-3 sm:pt-2">
                <label className="flex items-center gap-2 text-sm sm:text-xs text-slate-700 cursor-pointer shrink-0">
                  <input type="checkbox" className="w-4 h-4 sm:w-3 sm:h-3 rounded border-slate-300 text-amber-500"
                    checked={newRow.add_as_expense} onChange={e => setNewRow(r => ({ ...r, add_as_expense: e.target.checked }))} />
                  רישום כהוצאה לפרויקט
                </label>
                
                {partners.length > 0 && (
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-center flex-1 sm:border-r border-slate-100 sm:pr-4">
                    <Select value={newRow.partner_action_type} onValueChange={(v: string | null) => setNewRow(r => ({ ...r, partner_action_type: v || 'none' }))}>
                      <SelectTrigger className="h-10 sm:h-8 text-sm sm:text-xs border-slate-200 bg-white w-full sm:w-32">
                        <SelectValue placeholder="פעולה לשותף">
                          {newRow.partner_action_type === 'none' ? 'ללא שיוך לשותף' :
                           newRow.partner_action_type === 'withdrawal' ? 'רישום כמשיכה' :
                           newRow.partner_action_type === 'investment' ? 'רישום כהשקעה' : 'פעולה לשותף'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">ללא שיוך לשותף</SelectItem>
                        <SelectItem value="withdrawal">רישום כמשיכה</SelectItem>
                        <SelectItem value="investment">רישום כהשקעה</SelectItem>
                      </SelectContent>
                    </Select>

                    {(newRow.add_as_expense || newRow.partner_action_type !== 'none') && (
                      <Select value={newRow.partner_id || '__none__'} onValueChange={(v: string | null) => setNewRow(prev => ({ ...prev, partner_id: v === '__none__' || !v ? '' : v }))}>
                        <SelectTrigger className="h-10 sm:h-8 text-sm sm:text-xs border-slate-200 bg-white w-full sm:w-32">
                          <SelectValue placeholder="בחר שותף">
                            {newRow.partner_id && newRow.partner_id !== '__none__'
                              ? partners.find(p => p.id === newRow.partner_id)?.name
                              : 'בחר שותף'}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">בחר שותף</SelectItem>
                          {partners.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {newRow.is_interest && (newRow.add_as_expense || newRow.partner_action_type !== 'none') && (
              <Input placeholder="הערות לפעולות נוספות אלו (אופציונלי)" value={newRow.action_notes}
                onChange={e => setNewRow(r => ({ ...r, action_notes: e.target.value }))}
                className="h-10 sm:h-8 text-sm sm:text-xs border-slate-200 bg-white w-full mt-2" />
            )}
          </div>
        </div>
      )}

      {sorted.map(p => {
        const due = p.due_date ? new Date(p.due_date) : null
        const overdue = due && !p.is_paid && due < today

        if (editingId === p.id) {
          return (
            <div key={p.id} className="px-4 py-3 bg-violet-50/60 grid grid-cols-1 sm:grid-cols-[1fr_1fr_2fr_auto_auto] gap-2 items-end border-b border-violet-100">
              <div>
                <p className="text-[10px] text-slate-400 mb-1">סכום (₪)</p>
                <Input type="number" dir="ltr" value={editRow.amount}
                  onChange={e => setEditRow(r => ({ ...r, amount: e.target.value }))}
                  className="h-9 sm:h-8 text-sm sm:text-xs border-violet-200 bg-white" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 mb-1">תאריך</p>
                <Input type="date" value={editRow.due_date}
                  onChange={e => setEditRow(r => ({ ...r, due_date: e.target.value }))}
                  className="h-9 sm:h-8 text-sm sm:text-xs border-violet-200 bg-white" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 mb-1">הערות</p>
                <Input value={editRow.notes}
                  onChange={e => setEditRow(r => ({ ...r, notes: e.target.value }))}
                  className="h-9 sm:h-8 text-sm sm:text-xs border-violet-200 bg-white" />
              </div>
              <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                <Button size="sm" onClick={() => saveEdit(p.id)} disabled={pending}
                  className="flex-1 h-9 sm:h-8 bg-violet-500 hover:bg-violet-400 text-white text-sm sm:text-xs px-3">שמור</Button>
                <button onClick={() => setEditingId(null)}
                  className="w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white bg-slate-50 sm:bg-transparent">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )
        }

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
              {p.is_interest && <span className="bg-amber-100 text-amber-700 text-[9px] px-1.5 py-0.5 rounded font-bold ml-1.5">ריבית</span>}
              {p.notes || '—'}
            </p>

            <p className={cn('font-bold text-xs shrink-0', p.is_paid ? 'text-slate-300 line-through' : overdue ? 'text-red-600' : 'text-violet-700')}>
              {fmt(Number(p.amount))}
            </p>

            <button onClick={() => startEdit(p)} disabled={pending}
              className="w-6 h-6 rounded text-slate-200 hover:text-amber-500 hover:bg-amber-50 flex items-center justify-center shrink-0 ml-1">
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
