'use client'

import { useState, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  User,
  CalendarDays,
  Pencil,
  X,
  CreditCard,
  AlertCircle,
  FileCheck2,
  ArrowDownLeft,
  Calendar
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import {
  createBuyer,
  deleteBuyer,
  addBuyerPayment,
  deleteBuyerPayment,
  updateBuyerPayment,
  updateBuyer
} from '@/app/moshe/actions'
import { PaymentScheduleForm, type PaymentRow } from './PaymentScheduleForm'
import { toast } from 'sonner'
import type { MosheBuyer, MosheBuyerPayment } from '@/types/moshe'
import { BuyerPrintButton } from './ProjectPrintView'

function fmt(n: number) {
  return '₪' + Number(n).toLocaleString('he-IL', { maximumFractionDigits: 0 })
}

interface Props {
  projectId: string
  buyers: (MosheBuyer & { payments: MosheBuyerPayment[] })[]
  project?: any
}

export function BuyersTab({ projectId, buyers, project }: Props) {
  const [, startTransition] = useTransition()
  const [addOpen, setAddOpen] = useState(false)
  const [expandedBuyer, setExpandedBuyer] = useState<string | null>(null)
  const [editBuyer, setEditBuyer] = useState<MosheBuyer | null>(null)
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    email: '',
    id_number: '',
    unit_description: '',
    contract_date: '',
    total_amount: '',
    notes: '',
  })
  const [editSaving, setEditSaving] = useState(false)

  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    id_number: '',
    unit_description: '',
    contract_date: '',
    total_amount: '',
    notes: '',
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
      if (r.error) {
        toast.error(r.error)
        return
      }
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
      if (r.error) {
        toast.error(r.error)
        return
      }
      toast.success('קונה נוסף בהצלחה')
      setAddOpen(false)
      setForm({
        name: '',
        phone: '',
        email: '',
        id_number: '',
        unit_description: '',
        contract_date: '',
        total_amount: '',
        notes: '',
      })
      setPayments([])
    } finally {
      setSaving(false)
    }
  }

  function toggleExpand(id: string) {
    setExpandedBuyer((v) => (v === id ? null : id))
  }

  function removeBuyer(id: string) {
    if (!confirm('האם אתה בטוח שברצונך למחוק קונה זה?')) return
    startTransition(async () => {
      const r = await deleteBuyer(id, projectId)
      if (r.error) toast.error(r.error)
      else toast.success('קונה נמחק')
    })
  }

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-slate-800">{buyers.length} קונים בפרויקט</p>
          <p className="text-xs text-slate-400">ניהול לוח תשלומים שנקבע ותנועות שבוצעו בפועל לכל קונה בנפרד</p>
        </div>
        <Button
          size="sm"
          onClick={() => setAddOpen(true)}
          className="gap-1.5 h-9 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" /> הוסף קונה
        </Button>
      </div>

      {buyers.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-slate-200">
          <User className="w-10 h-10 text-slate-200 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">אין קונים עדיין בפרויקט</p>
          <button
            onClick={() => setAddOpen(true)}
            className="text-emerald-600 text-xs mt-1 hover:underline font-bold"
          >
            + הוסף קונה ראשון
          </button>
        </div>
      )}

      {/* Buyer Cards */}
      <div className="space-y-4">
        {buyers.map((buyer) => {
          // Strictly decoupled: schedule payments vs actual movement payments
          const schedulePayments = buyer.payments.filter(
            (p) => p.payment_type === 'schedule' || (!p.payment_type && !p.is_received)
          )
          const movementPayments = buyer.payments.filter(
            (p) => p.payment_type === 'movement' || (!p.payment_type && p.is_received)
          )

          const scheduledTotal = schedulePayments.reduce((s, p) => s + Number(p.amount), 0)
          const receivedTotal = movementPayments.reduce((s, p) => s + Number(p.amount), 0)
          const remaining = scheduledTotal - receivedTotal
          const pct = scheduledTotal > 0 ? Math.min(100, Math.round((receivedTotal / scheduledTotal) * 100)) : 0
          const isExpanded = expandedBuyer === buyer.id
          const today = new Date()
          const overdue = schedulePayments.filter(
            (p) => p.due_date && new Date(p.due_date) < today
          )

          return (
            <div
              key={buyer.id}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden transition-all duration-200 hover:border-slate-300"
            >
              <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {/* Left: Buyer info */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-black text-sm shrink-0 shadow-sm">
                    {buyer.name[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <p className="font-bold text-slate-900 text-base truncate">{buyer.name}</p>
                      {overdue.length > 0 && (
                        <span className="text-[10px] bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {overdue.length} תשלומים בלוח באיחור
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                      {buyer.unit_description && (
                        <span className="font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                          {buyer.unit_description}
                        </span>
                      )}
                      {buyer.phone && <span dir="ltr">{buyer.phone}</span>}
                      {buyer.contract_date && (
                        <span>חוזה: {format(new Date(buyer.contract_date), 'dd/MM/yyyy')}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Balance KPIs and actions */}
                <div className="flex items-center gap-4 justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                  <div className="flex items-center gap-3 text-right">
                    <div>
                      <p className="text-[10px] text-slate-400 font-medium">שולם בפועל</p>
                      <p className="text-sm font-black text-emerald-600">{fmt(receivedTotal)}</p>
                    </div>
                    <div className="border-r border-slate-200 pr-3">
                      <p className="text-[10px] text-slate-400 font-medium">בלוח תשלומים</p>
                      <p className="text-sm font-bold text-slate-700">{fmt(scheduledTotal)}</p>
                    </div>
                    <div className="border-r border-slate-200 pr-3">
                      <p className="text-[10px] text-slate-400 font-medium">יתרה לתשלום</p>
                      <p
                        className={cn(
                          'text-sm font-black',
                          remaining <= 0 && scheduledTotal > 0 ? 'text-emerald-600' : 'text-amber-600'
                        )}
                      >
                        {fmt(remaining)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => openEditBuyer(buyer)}
                      title="ערוך פרטי קונה"
                      className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-amber-600 hover:bg-amber-50 hover:border-amber-200 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {project && <BuyerPrintButton project={project} buyer={buyer as any} />}
                    <button
                      onClick={() => removeBuyer(buyer.id)}
                      title="מחק קונה"
                      className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 hover:border-red-200 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => toggleExpand(buyer.id)}
                      title={isExpanded ? 'סגור פירוט' : 'פתח פירוט'}
                      className={cn(
                        'w-8 h-8 rounded-lg border flex items-center justify-center transition-colors',
                        isExpanded
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                      )}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="px-5 pb-3">
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-300',
                      remaining <= 0 && scheduledTotal > 0 ? 'bg-emerald-500' : 'bg-emerald-400'
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                  <span>{pct}% מסך לוח התשלומים שולם</span>
                  {remaining <= 0 && scheduledTotal > 0 && (
                    <span className="text-emerald-600 font-bold">שולם במלואו</span>
                  )}
                </div>
              </div>

              {/* Expanded detail tables */}
              {isExpanded && <BuyerPaymentsDetail buyer={buyer} projectId={projectId} />}
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
              label="לוח תשלומים ראשוני שנקבע לקונה (לוח יעד)"
              colorClass="border-emerald-100 bg-emerald-50/20"
            />
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)} className="flex-1">
                ביטול
              </Button>
              <Button
                type="submit"
                disabled={saving || !form.name.trim()}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2"
              >
                {saving ? 'שומר...' : 'הוסף קונה'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Edit buyer sheet */}
      <Sheet open={!!editBuyer} onOpenChange={(open) => !open && setEditBuyer(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-0">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10">
            <SheetHeader>
              <SheetTitle className="text-lg font-bold">עריכת קונה: {editBuyer?.name}</SheetTitle>
            </SheetHeader>
          </div>
          <form onSubmit={handleEditBuyer} className="p-6 space-y-5">
            <BuyerFields form={editForm} setF={(k, v) => setEditForm((f) => ({ ...f, [k]: v }))} />
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditBuyer(null)} className="flex-1">
                ביטול
              </Button>
              <Button
                type="submit"
                disabled={editSaving || !editForm.name.trim()}
                className="flex-1 bg-amber-500 hover:bg-amber-400 text-white font-bold"
              >
                {editSaving ? 'שומר...' : 'שמור שינויים'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function BuyerFields({
  form,
  setF,
}: {
  form: {
    name: string
    phone: string
    email: string
    id_number: string
    unit_description: string
    contract_date: string
    total_amount: string
    notes: string
  }
  setF: (k: string, v: string) => void
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2 col-span-2">
          <Label className="font-medium text-slate-700">
            שם הקונה <span className="text-red-400">*</span>
          </Label>
          <Input
            value={form.name}
            onChange={(e) => setF('name', e.target.value)}
            placeholder="שם מלא"
            className="h-10"
            required
          />
        </div>
        <div className="space-y-2">
          <Label className="font-medium text-slate-700">טלפון</Label>
          <Input
            dir="ltr"
            value={form.phone}
            onChange={(e) => setF('phone', e.target.value)}
            placeholder="050-0000000"
            className="h-10"
          />
        </div>
        <div className="space-y-2">
          <Label className="font-medium text-slate-700">אימייל</Label>
          <Input
            type="email"
            dir="ltr"
            value={form.email}
            onChange={(e) => setF('email', e.target.value)}
            placeholder="mail@example.com"
            className="h-10"
          />
        </div>
        <div className="space-y-2">
          <Label className="font-medium text-slate-700">ת.ז.</Label>
          <Input
            dir="ltr"
            value={form.id_number}
            onChange={(e) => setF('id_number', e.target.value)}
            placeholder="000000000"
            className="h-10"
          />
        </div>
        <div className="space-y-2">
          <Label className="font-medium text-slate-700">יחידה / דירה</Label>
          <Input
            value={form.unit_description}
            onChange={(e) => setF('unit_description', e.target.value)}
            placeholder="דירה 3, קומה 2"
            className="h-10"
          />
        </div>
        <div className="space-y-2">
          <Label className="font-medium text-slate-700">תאריך חתימת חוזה</Label>
          <Input
            type="date"
            value={form.contract_date}
            onChange={(e) => setF('contract_date', e.target.value)}
            className="h-10"
          />
        </div>
        <div className="space-y-2 col-span-2 sm:col-span-1">
          <Label className="font-medium text-slate-700">סכום חוזה כולל (₪)</Label>
          <Input
            type="number"
            dir="ltr"
            value={form.total_amount}
            onChange={(e) => setF('total_amount', e.target.value)}
            placeholder="0"
            className="h-10"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label className="font-medium text-slate-700">הערות נוספות</Label>
        <Textarea
          value={form.notes}
          onChange={(e) => setF('notes', e.target.value)}
          className="min-h-[60px] resize-y"
          placeholder="הערות או תנאים מיוחדים..."
        />
      </div>
    </div>
  )
}

/**
 * Completely decoupled detail view for a buyer:
 * 1. Schedule Table (לוח תשלומים שנקבע) with its own Add Form, Edit, and Delete.
 * 2. Movements Table (תנועות שהתקבלו בפועל) with its own Add Form, Edit, and Delete.
 * 3. Bottom KPI Bar: Schedule Total - Actual Received = Remaining.
 */
function BuyerPaymentsDetail({
  buyer,
  projectId,
}: {
  buyer: MosheBuyer & { payments: MosheBuyerPayment[] }
  projectId: string
}) {
  const [pending, startTransition] = useTransition()

  // Schedule states
  const [showAddSchedule, setShowAddSchedule] = useState(false)
  const [newSchedule, setNewSchedule] = useState({ amount: '', due_date: '', notes: '' })
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null)
  const [editScheduleRow, setEditScheduleRow] = useState({ amount: '', due_date: '', notes: '' })

  // Movement states
  const [showAddMovement, setShowAddMovement] = useState(false)
  const [newMovement, setNewMovement] = useState({
    amount: '',
    received_at: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
  })
  const [editingMovementId, setEditingMovementId] = useState<string | null>(null)
  const [editMovementRow, setEditMovementRow] = useState({ amount: '', received_at: '', notes: '' })

  const today = new Date()

  // Sorted Schedule Items
  const schedulePayments = buyer.payments
    .filter((p) => p.payment_type === 'schedule' || (!p.payment_type && !p.is_received))
    .sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0
      if (!a.due_date) return 1
      if (!b.due_date) return -1
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    })

  // Sorted Movements
  const movementPayments = buyer.payments
    .filter((p) => p.payment_type === 'movement' || (!p.payment_type && p.is_received))
    .sort((a, b) => {
      const dateA = a.received_at ? new Date(a.received_at).getTime() : 0
      const dateB = b.received_at ? new Date(b.received_at).getTime() : 0
      return dateB - dateA
    })

  const totalScheduled = schedulePayments.reduce((s, p) => s + Number(p.amount), 0)
  const totalReceived = movementPayments.reduce((s, p) => s + Number(p.amount), 0)
  const remaining = totalScheduled - totalReceived

  // Handlers for Schedule
  async function handleAddSchedule() {
    if (!newSchedule.amount || Number(newSchedule.amount) <= 0) {
      toast.error('נא להזין סכום תקין לתשלום בלוח')
      return
    }
    startTransition(async () => {
      const r = await addBuyerPayment({
        buyer_id: buyer.id,
        project_id: projectId,
        amount: newSchedule.amount,
        due_date: newSchedule.due_date || undefined,
        notes: newSchedule.notes || undefined,
        payment_type: 'schedule',
        is_received: false,
      })
      if (r?.error) {
        toast.error(r.error)
        return
      }
      toast.success('תשלום נוסף ללוח בהצלחה')
      setNewSchedule({ amount: '', due_date: '', notes: '' })
      setShowAddSchedule(false)
    })
  }

  function startEditSchedule(p: MosheBuyerPayment) {
    setEditingScheduleId(p.id)
    setEditScheduleRow({
      amount: String(p.amount),
      due_date: p.due_date ?? '',
      notes: p.notes ?? '',
    })
  }

  function handleSaveEditSchedule(id: string) {
    if (!editScheduleRow.amount || Number(editScheduleRow.amount) <= 0) {
      toast.error('נא להזין סכום תקין')
      return
    }
    startTransition(async () => {
      const r = await updateBuyerPayment(id, {
        amount: editScheduleRow.amount,
        due_date: editScheduleRow.due_date || null,
        notes: editScheduleRow.notes || null,
      })
      if (r?.error) {
        toast.error(r.error)
        return
      }
      toast.success('תשלום בלוח עודכן בהצלחה')
      setEditingScheduleId(null)
    })
  }

  // Handlers for Movement
  async function handleAddMovement() {
    if (!newMovement.amount || Number(newMovement.amount) <= 0) {
      toast.error('נא להזין סכום תקין לתנועה שהתקבלה')
      return
    }
    startTransition(async () => {
      const r = await addBuyerPayment({
        buyer_id: buyer.id,
        project_id: projectId,
        amount: newMovement.amount,
        received_at: newMovement.received_at || undefined,
        notes: newMovement.notes || undefined,
        payment_type: 'movement',
        is_received: true,
      })
      if (r?.error) {
        toast.error(r.error)
        return
      }
      toast.success('תנועת תשלום שהתקבל נרשמה בהצלחה')
      setNewMovement({
        amount: '',
        received_at: format(new Date(), 'yyyy-MM-dd'),
        notes: '',
      })
      setShowAddMovement(false)
    })
  }

  function startEditMovement(p: MosheBuyerPayment) {
    setEditingMovementId(p.id)
    setEditMovementRow({
      amount: String(p.amount),
      received_at: p.received_at ? p.received_at.split('T')[0] : '',
      notes: p.notes ?? '',
    })
  }

  function handleSaveEditMovement(id: string) {
    if (!editMovementRow.amount || Number(editMovementRow.amount) <= 0) {
      toast.error('נא להזין סכום תקין')
      return
    }
    startTransition(async () => {
      const r = await updateBuyerPayment(id, {
        amount: editMovementRow.amount,
        received_at: editMovementRow.received_at || null,
        notes: editMovementRow.notes || null,
      })
      if (r?.error) {
        toast.error(r.error)
        return
      }
      toast.success('תנועת תשלום עודכנה בהצלחה')
      setEditingMovementId(null)
    })
  }

  function handleDelete(id: string, isMovement: boolean) {
    if (
      !confirm(
        isMovement
          ? 'האם אתה בטוח שברצונך למחוק תנועת תשלום זו?'
          : 'האם אתה בטוח שברצונך למחוק תשלום זה מלוח התשלומים?'
      )
    )
      return

    startTransition(async () => {
      const r = await deleteBuyerPayment(id, projectId)
      if (r?.error) toast.error(r.error)
      else toast.success(isMovement ? 'תנועה נמחקה בהצלחה' : 'תשלום הוסר מלוח התשלומים')
    })
  }

  return (
    <div className="border-t border-slate-100 bg-slate-50/50 p-4 sm:p-5 space-y-5">
      {/* 2 Decoupled Columns / Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ========================================================= */}
        {/* SECTION 1: SCHEDULE TABLE (לוח תשלומים שנקבע)             */}
        {/* ========================================================= */}
        <div className="bg-white rounded-xl border border-blue-200/80 shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 bg-gradient-to-r from-blue-50/80 to-indigo-50/50 border-b border-blue-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-700 flex items-center justify-center font-bold">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">לוח תשלומים שנקבע לקונה</p>
                <p className="text-[10px] text-slate-400">
                  {schedulePayments.length} מועדים | סה&quot;כ {fmt(totalScheduled)}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowAddSchedule((v) => !v)}
              className="text-xs font-bold text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors"
            >
              {showAddSchedule ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {showAddSchedule ? 'סגור' : 'הוסף ללוח'}
            </button>
          </div>

          {/* Add Schedule Form */}
          {showAddSchedule && (
            <div className="p-3 bg-blue-50/40 border-b border-blue-100 space-y-2.5">
              <p className="text-[11px] font-bold text-blue-800">הוספת תשלום ללוח התשלומים</p>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1.5fr_auto] gap-2 items-end">
                <div>
                  <Label className="text-[10px] text-slate-500 mb-1 block">סכום (₪) *</Label>
                  <Input
                    type="number"
                    dir="ltr"
                    placeholder="0"
                    value={newSchedule.amount}
                    onChange={(e) => setNewSchedule((r) => ({ ...r, amount: e.target.value }))}
                    className="h-8 text-xs bg-white border-blue-200"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-slate-500 mb-1 block">תאריך יעד</Label>
                  <Input
                    type="date"
                    value={newSchedule.due_date}
                    onChange={(e) => setNewSchedule((r) => ({ ...r, due_date: e.target.value }))}
                    className="h-8 text-xs bg-white border-blue-200"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-slate-500 mb-1 block">שלב / תיאור</Label>
                  <Input
                    placeholder="לדוגמה: גמר שלד / תשלום שני"
                    value={newSchedule.notes}
                    onChange={(e) => setNewSchedule((r) => ({ ...r, notes: e.target.value }))}
                    className="h-8 text-xs bg-white border-blue-200"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handleAddSchedule}
                  disabled={pending}
                  className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white font-bold px-3"
                >
                  שמור
                </Button>
              </div>
            </div>
          )}

          {/* Schedule Rows */}
          <div className="divide-y divide-slate-100 flex-1">
            {schedulePayments.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                טרם נקבעו תשלומים בלוח עבור קונה זה
              </div>
            ) : (
              schedulePayments.map((p) => {
                const due = p.due_date ? new Date(p.due_date) : null
                const isOverdue = due ? due < today : false

                if (editingScheduleId === p.id) {
                  return (
                    <div key={p.id} className="p-3 bg-amber-50/60 border-b border-amber-200 space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1.5fr_auto] gap-2 items-end">
                        <div>
                          <Label className="text-[10px] text-amber-800 mb-1 block">סכום (₪)</Label>
                          <Input
                            type="number"
                            dir="ltr"
                            value={editScheduleRow.amount}
                            onChange={(e) =>
                              setEditScheduleRow((r) => ({ ...r, amount: e.target.value }))
                            }
                            className="h-8 text-xs bg-white border-amber-300"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] text-amber-800 mb-1 block">תאריך יעד</Label>
                          <Input
                            type="date"
                            value={editScheduleRow.due_date}
                            onChange={(e) =>
                              setEditScheduleRow((r) => ({ ...r, due_date: e.target.value }))
                            }
                            className="h-8 text-xs bg-white border-amber-300"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] text-amber-800 mb-1 block">שלב / תיאור</Label>
                          <Input
                            value={editScheduleRow.notes}
                            onChange={(e) =>
                              setEditScheduleRow((r) => ({ ...r, notes: e.target.value }))
                            }
                            className="h-8 text-xs bg-white border-amber-300"
                          />
                        </div>
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            onClick={() => handleSaveEditSchedule(p.id)}
                            disabled={pending}
                            className="h-8 text-xs bg-amber-600 hover:bg-amber-500 text-white px-3"
                          >
                            שמור
                          </Button>
                          <button
                            onClick={() => setEditingScheduleId(null)}
                            className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-white"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                }

                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-14 shrink-0 text-center">
                        {due ? (
                          <div>
                            <p
                              className={cn(
                                'text-[11px] font-bold',
                                isOverdue ? 'text-red-600' : 'text-slate-600'
                              )}
                            >
                              {format(due, 'dd/MM/yy')}
                            </p>
                            {isOverdue && (
                              <span className="text-[9px] text-red-500 font-medium block">
                                עבר המועד
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400">ללא תאריך</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-700 truncate min-w-0">
                        {p.notes || <span className="text-slate-300">ללא תיאור</span>}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* Amount: ALWAYS crystal clear, NO line-through */}
                      <p className="font-bold text-xs text-slate-900">{fmt(Number(p.amount))}</p>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => startEditSchedule(p)}
                          disabled={pending}
                          title="ערוך תשלום זה בלוח"
                          className="w-7 h-7 rounded border border-slate-200 text-slate-400 hover:text-amber-600 hover:bg-amber-50 hover:border-amber-200 flex items-center justify-center transition-colors"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id, false)}
                          disabled={pending}
                          title="מחק תשלום מלוח התשלומים"
                          className="w-7 h-7 rounded border border-slate-200 text-slate-400 hover:text-red-500 hover:bg-red-50 hover:border-red-200 flex items-center justify-center transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* SECTION 2: MOVEMENTS TABLE (תנועות שהתקבלו בפועל)          */}
        {/* ========================================================= */}
        <div className="bg-white rounded-xl border border-emerald-200/80 shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 bg-gradient-to-r from-emerald-50/80 to-teal-50/50 border-b border-emerald-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-700 flex items-center justify-center font-bold">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">תנועות שהתקבלו בפועל מהקונה</p>
                <p className="text-[10px] text-slate-400">
                  {movementPayments.length} תנועות שבוצעו | סה&quot;כ {fmt(totalReceived)}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowAddMovement((v) => !v)}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors"
            >
              {showAddMovement ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {showAddMovement ? 'סגור' : 'הוסף תנועה'}
            </button>
          </div>

          {/* Add Movement Form */}
          {showAddMovement && (
            <div className="p-3 bg-emerald-50/40 border-b border-emerald-100 space-y-2.5">
              <p className="text-[11px] font-bold text-emerald-800">רישום תנועת תשלום שהתקבל בפועל</p>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1.5fr_auto] gap-2 items-end">
                <div>
                  <Label className="text-[10px] text-slate-500 mb-1 block">סכום (₪) *</Label>
                  <Input
                    type="number"
                    dir="ltr"
                    placeholder="0"
                    value={newMovement.amount}
                    onChange={(e) => setNewMovement((r) => ({ ...r, amount: e.target.value }))}
                    className="h-8 text-xs bg-white border-emerald-200"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-slate-500 mb-1 block">תאריך קבלה</Label>
                  <Input
                    type="date"
                    value={newMovement.received_at}
                    onChange={(e) =>
                      setNewMovement((r) => ({ ...r, received_at: e.target.value }))
                    }
                    className="h-8 text-xs bg-white border-emerald-200"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-slate-500 mb-1 block">אסמכתא / אופן תשלום</Label>
                  <Input
                    placeholder="העברה בנקאית / צ'ק / מזומן..."
                    value={newMovement.notes}
                    onChange={(e) => setNewMovement((r) => ({ ...r, notes: e.target.value }))}
                    className="h-8 text-xs bg-white border-emerald-200"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handleAddMovement}
                  disabled={pending}
                  className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3"
                >
                  שמור
                </Button>
              </div>
            </div>
          )}

          {/* Movement Rows */}
          <div className="divide-y divide-slate-100 flex-1">
            {movementPayments.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                טרם נרשמו תנועות תשלום שבוצעו עבור קונה זה
              </div>
            ) : (
              movementPayments.map((p) => {
                const receivedDate = p.received_at ? new Date(p.received_at) : null

                if (editingMovementId === p.id) {
                  return (
                    <div key={p.id} className="p-3 bg-amber-50/60 border-b border-amber-200 space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1.5fr_auto] gap-2 items-end">
                        <div>
                          <Label className="text-[10px] text-amber-800 mb-1 block">סכום (₪)</Label>
                          <Input
                            type="number"
                            dir="ltr"
                            value={editMovementRow.amount}
                            onChange={(e) =>
                              setEditMovementRow((r) => ({ ...r, amount: e.target.value }))
                            }
                            className="h-8 text-xs bg-white border-amber-300"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] text-amber-800 mb-1 block">תאריך קבלה</Label>
                          <Input
                            type="date"
                            value={editMovementRow.received_at}
                            onChange={(e) =>
                              setEditMovementRow((r) => ({ ...r, received_at: e.target.value }))
                            }
                            className="h-8 text-xs bg-white border-amber-300"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] text-amber-800 mb-1 block">אסמכתא / הערות</Label>
                          <Input
                            value={editMovementRow.notes}
                            onChange={(e) =>
                              setEditMovementRow((r) => ({ ...r, notes: e.target.value }))
                            }
                            className="h-8 text-xs bg-white border-amber-300"
                          />
                        </div>
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            onClick={() => handleSaveEditMovement(p.id)}
                            disabled={pending}
                            className="h-8 text-xs bg-amber-600 hover:bg-amber-500 text-white px-3"
                          >
                            שמור
                          </Button>
                          <button
                            onClick={() => setEditingMovementId(null)}
                            className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-white"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                }

                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-14 shrink-0 text-center">
                        {receivedDate ? (
                          <p className="text-[11px] font-bold text-slate-600">
                            {format(receivedDate, 'dd/MM/yy')}
                          </p>
                        ) : (
                          <span className="text-[10px] text-slate-400">ללא תאריך</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-700 truncate min-w-0">
                        {p.notes || <span className="text-slate-300">ללא אסמכתא</span>}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* Amount: ALWAYS crystal clear, NO line-through */}
                      <p className="font-black text-xs text-emerald-700">{fmt(Number(p.amount))}</p>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => startEditMovement(p)}
                          disabled={pending}
                          title="ערוך תנועה זו"
                          className="w-7 h-7 rounded border border-slate-200 text-slate-400 hover:text-amber-600 hover:bg-amber-50 hover:border-amber-200 flex items-center justify-center transition-colors"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id, true)}
                          disabled={pending}
                          title="מחק תנועה זו"
                          className="w-7 h-7 rounded border border-slate-200 text-slate-400 hover:text-red-500 hover:bg-red-50 hover:border-red-200 flex items-center justify-center transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Bottom KPI Bar: Balance Calculation */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileCheck2 className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-700">סיכום כספי לקונה: {buyer.name}</span>
        </div>
        <div className="flex items-center gap-6 text-xs">
          <div>
            <span className="text-slate-400">נקבע בלוח: </span>
            <span className="font-bold text-slate-800">{fmt(totalScheduled)}</span>
          </div>
          <div className="text-slate-300">|</div>
          <div>
            <span className="text-slate-400">שולם בפועל: </span>
            <span className="font-bold text-emerald-600">{fmt(totalReceived)}</span>
          </div>
          <div className="text-slate-300">|</div>
          <div>
            <span className="text-slate-400">יתרה לתשלום: </span>
            <span
              className={cn(
                'font-black',
                remaining <= 0 && totalScheduled > 0 ? 'text-emerald-600' : 'text-amber-600'
              )}
            >
              {fmt(remaining)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
