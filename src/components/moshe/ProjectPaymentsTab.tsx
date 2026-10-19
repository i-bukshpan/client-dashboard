'use client'

import { useState, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Plus,
  Trash2,
  CalendarDays,
  Pencil,
  X,
  Printer,
  CheckCircle2,
  Clock,
  History,
  AlertCircle,
} from 'lucide-react'
import {
  deleteProjectPayment,
  addProjectPayment,
  updateProjectPayment,
} from '@/app/moshe/actions'
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
  projectName?: string
  totalProjectCost?: number
}

export function ProjectPaymentsTab({
  projectId,
  payments,
  projectName,
}: Props) {
  const [pending, startTransition] = useTransition()

  // Add forms state
  const [showAddScheduled, setShowAddScheduled] = useState(false)
  const [scheduledRow, setScheduledRow] = useState({ amount: '', due_date: '', notes: '' })

  const [showAddExecuted, setShowAddExecuted] = useState(false)
  const [executedRow, setExecutedRow] = useState({
    amount: '',
    paid_at: new Date().toISOString().slice(0, 10),
    notes: '',
  })

  // Edit row state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRow, setEditRow] = useState({ amount: '', due_date: '', paid_at: '', notes: '' })

  // ── 1. לוח תשלומים שנקבע (תשלומים מתוכננים בלבד) ───────────────────────────
  const schedulePayments = payments
    .filter((p) => p.payment_type === 'schedule' || (!p.payment_type && !p.is_paid))
    .sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0
      if (!a.due_date) return 1
      if (!b.due_date) return -1
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    })

  // ── 2. תנועות שבוצעו בפועל (רשימת תנועות כספיות עצמאית) ──────────────────────
  const executedPayments = payments
    .filter((p) => p.payment_type === 'movement' || (!p.payment_type && p.is_paid))
    .sort((a, b) => {
      const dateA = a.paid_at || a.created_at
      const dateB = b.paid_at || b.created_at
      return new Date(dateB).getTime() - new Date(dateA).getTime()
    })

  // ── KPIs: חישוב היתרה אך ורק מלוח התשלומים פחות התנועות שבוצעו בפועל ──────────
  const totalScheduled = schedulePayments.reduce((s, p) => s + Number(p.amount), 0)
  const totalPaid = executedPayments.reduce((s, p) => s + Number(p.amount), 0)
  const remaining = totalScheduled - totalPaid

  const today = new Date()

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleAddScheduled() {
    if (!scheduledRow.amount || parseFloat(scheduledRow.amount) <= 0) {
      return toast.error('יש להזין סכום תקין לתשלום בלוח')
    }
    startTransition(async () => {
      const r = await addProjectPayment({
        project_id: projectId,
        amount: scheduledRow.amount,
        due_date: scheduledRow.due_date || undefined,
        notes: scheduledRow.notes || undefined,
        payment_type: 'schedule',
        is_paid: false,
      })
      if (r.error) {
        toast.error(r.error)
        return
      }
      toast.success('תשלום נוסף בהצלחה ללוח התשלומים')
      setScheduledRow({ amount: '', due_date: '', notes: '' })
      setShowAddScheduled(false)
    })
  }

  async function handleAddExecuted() {
    if (!executedRow.amount || parseFloat(executedRow.amount) <= 0) {
      return toast.error('יש להזין סכום תקין לתנועה שבוצעה')
    }
    startTransition(async () => {
      const r = await addProjectPayment({
        project_id: projectId,
        amount: executedRow.amount,
        paid_at: executedRow.paid_at ? `${executedRow.paid_at}T12:00:00.000Z` : undefined,
        notes: executedRow.notes || undefined,
        payment_type: 'movement',
        is_paid: true,
      })
      if (r.error) {
        toast.error(r.error)
        return
      }
      toast.success('תנועת תשלום שבוצעה בפועל נוספה בהצלחה')
      setExecutedRow({
        amount: '',
        paid_at: new Date().toISOString().slice(0, 10),
        notes: '',
      })
      setShowAddExecuted(false)
    })
  }

  function startEdit(p: MosheProjectPayment) {
    setEditingId(p.id)
    setEditRow({
      amount: String(p.amount),
      due_date: p.due_date ?? '',
      paid_at: p.paid_at ? new Date(p.paid_at).toISOString().slice(0, 10) : '',
      notes: p.notes ?? '',
    })
  }

  function saveEdit(id: string) {
    startTransition(async () => {
      const r = await updateProjectPayment(id, {
        amount: editRow.amount,
        due_date: editRow.due_date || null,
        paid_at: editRow.paid_at ? `${editRow.paid_at}T12:00:00.000Z` : null,
        notes: editRow.notes || null,
      })
      if (r.error) {
        toast.error(r.error)
        return
      }
      toast.success('העדכון נשמר בהצלחה')
      setEditingId(null)
    })
  }

  function remove(id: string, isMovement: boolean) {
    const msg = isMovement
      ? 'האם למחוק תנועה זו מהתשלומים שבוצעו בפועל?'
      : 'האם למחוק תשלום זה מלוח התשלומים?'
    if (!confirm(msg)) return

    startTransition(async () => {
      const r = await deleteProjectPayment(id, projectId)
      if (r.error) toast.error(r.error)
      else toast.success(isMovement ? 'התנועה נמחקה בהצלחה' : 'התשלום נמחק מהלוח')
    })
  }

  function handlePrint() {
    window.print()
  }

  return (
    <div className="space-y-6">
      {/* ── Top Bar & KPIs ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 print:hidden">
          <div>
            <h2 className="text-base font-bold text-slate-800">ניהול לוח תשלומים ותנועות</h2>
            <p className="text-xs text-slate-500">
              לוח תשלומים מתוכנן ורשימת תנועות שבוצעו בפועל — שתי מערכות נפרדות ועצמאיות לחלוטין
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handlePrint}
            className="h-8 text-xs gap-1.5 border-slate-200 text-slate-700 hover:bg-slate-100 shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5 text-amber-600" />
            הדפסה מהירה
          </Button>
        </div>

        {/* Print Only Header */}
        <div className="hidden print:block pb-4 mb-4 border-b border-slate-300">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-xl font-black text-slate-900">
                דו״ח לוח תשלומים ותנועות — {projectName || 'פרויקט'}
              </h1>
              <p className="text-xs text-slate-600 mt-0.5">פורטל משה פרוש · ניהול פרויקטי נדל״ן</p>
            </div>
            <div className="text-left text-xs text-slate-500">
              <p>תאריך הפקה: {format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-emerald-50/90 border border-emerald-200/80 rounded-2xl p-4 text-center shadow-xs">
            <div className="flex items-center justify-center gap-1.5 text-emerald-800 mb-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <p className="text-xs font-bold uppercase tracking-wider">שולם בפועל</p>
            </div>
            <p className="text-2xl font-black text-emerald-800 tracking-tight">{fmt(totalPaid)}</p>
            <p className="text-[11px] text-emerald-700/80 mt-1">{executedPayments.length} תנועות שבוצעו בפועל</p>
          </div>

          <div className="bg-slate-50/90 border border-slate-200/80 rounded-2xl p-4 text-center shadow-xs">
            <div className="flex items-center justify-center gap-1.5 text-slate-600 mb-1">
              <CalendarDays className="w-4 h-4 text-amber-600" />
              <p className="text-xs font-bold uppercase tracking-wider">סך לוח התשלומים</p>
            </div>
            <p className="text-2xl font-black text-slate-800 tracking-tight">{fmt(totalScheduled)}</p>
            <p className="text-[11px] text-slate-500 mt-1">
              {schedulePayments.length} תשלומים שנקבעו בלוח
            </p>
          </div>

          <div className="bg-amber-50/90 border border-amber-200/80 rounded-2xl p-4 text-center shadow-xs">
            <div className="flex items-center justify-center gap-1.5 text-amber-800 mb-1">
              <Clock className="w-4 h-4 text-amber-600" />
              <p className="text-xs font-bold uppercase tracking-wider">יתרה לתשלום</p>
            </div>
            <p
              className={cn(
                'text-2xl font-black tracking-tight',
                remaining <= 0 ? 'text-emerald-700' : 'text-amber-800'
              )}
            >
              {fmt(remaining)}
            </p>
            <p className="text-[11px] text-amber-700/80 mt-1">סך לוח התשלומים פחות שולם בפועל</p>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════
          חלק 1: לוח התשלומים שנקבע (טבלה נפרדת ועצמאית)
          ═══════════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="px-5 py-4 bg-gradient-to-l from-amber-50/60 to-white border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <CalendarDays className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">1. לוח התשלומים שנקבע</p>
              <p className="text-xs text-slate-500">
                טבלת תשלומים מתוכננים לפי יעדים. טבלה עצמאית ללא תלות בתנועות.
              </p>
            </div>
          </div>

          <Button
            size="sm"
            onClick={() => {
              setShowAddScheduled((v) => !v)
              if (showAddExecuted) setShowAddExecuted(false)
            }}
            className="text-xs gap-1.5 h-8 bg-amber-500 hover:bg-amber-600 text-white shadow-xs print:hidden font-bold"
          >
            <Plus className="w-3.5 h-3.5" /> הוסף תשלום ללוח
          </Button>
        </div>

        {/* Add Scheduled Payment Form */}
        {showAddScheduled && (
          <div className="px-5 py-4 bg-amber-50/40 border-b border-amber-100 grid grid-cols-1 sm:grid-cols-[1fr_1fr_2fr_auto] gap-3 items-end print:hidden">
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-1">סכום לתשלום (₪) *</p>
              <Input
                type="number"
                placeholder="0"
                dir="ltr"
                value={scheduledRow.amount}
                onChange={(e) => setScheduledRow((r) => ({ ...r, amount: e.target.value }))}
                className="h-9 text-sm border-amber-200 bg-white"
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-1">תאריך יעד לתשלום</p>
              <Input
                type="date"
                value={scheduledRow.due_date}
                onChange={(e) => setScheduledRow((r) => ({ ...r, due_date: e.target.value }))}
                className="h-9 text-sm border-amber-200 bg-white"
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-1">תיאור התשלום / הערות</p>
              <Input
                placeholder="למשל: תשלום שלד א׳, שכר מתכננים, היתר בניה..."
                value={scheduledRow.notes}
                onChange={(e) => setScheduledRow((r) => ({ ...r, notes: e.target.value }))}
                className="h-9 text-sm border-amber-200 bg-white"
              />
            </div>
            <div className="flex gap-2 mt-2 sm:mt-0">
              <Button
                size="sm"
                onClick={handleAddScheduled}
                disabled={pending}
                className="h-9 bg-amber-600 hover:bg-amber-500 text-white text-xs px-4 font-bold"
              >
                שמור ללוח
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowAddScheduled(false)}
                className="h-9 text-xs text-slate-500"
              >
                ביטול
              </Button>
            </div>
          </div>
        )}

        {/* Schedule List */}
        <div className="divide-y divide-slate-100">
          {schedulePayments.length === 0 && (
            <div className="text-center py-10 px-4">
              <CalendarDays className="w-10 h-10 text-slate-200 mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-medium">אין תשלומים בלוח עדיין.</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                לחץ על "הוסף תשלום ללוח" כדי להגדיר יעדי תשלום לפרויקט.
              </p>
            </div>
          )}

          {schedulePayments.map((p) => {
            const due = p.due_date ? new Date(p.due_date) : null
            const isOverdue = due && due < today

            if (editingId === p.id) {
              return (
                <div
                  key={p.id}
                  className="px-5 py-3.5 bg-amber-50/70 grid grid-cols-1 sm:grid-cols-[1fr_1fr_2fr_auto] gap-2.5 items-end border-b border-amber-100"
                >
                  <div>
                    <p className="text-[11px] font-semibold text-slate-600 mb-1">סכום (₪)</p>
                    <Input
                      type="number"
                      dir="ltr"
                      value={editRow.amount}
                      onChange={(e) => setEditRow((r) => ({ ...r, amount: e.target.value }))}
                      className="h-9 text-sm border-amber-200 bg-white"
                    />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-slate-600 mb-1">תאריך יעד</p>
                    <Input
                      type="date"
                      value={editRow.due_date}
                      onChange={(e) => setEditRow((r) => ({ ...r, due_date: e.target.value }))}
                      className="h-9 text-sm border-amber-200 bg-white"
                    />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-slate-600 mb-1">הערות</p>
                    <Input
                      value={editRow.notes}
                      onChange={(e) => setEditRow((r) => ({ ...r, notes: e.target.value }))}
                      className="h-9 text-sm border-amber-200 bg-white"
                    />
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                    <Button
                      size="sm"
                      onClick={() => saveEdit(p.id)}
                      disabled={pending}
                      className="h-9 bg-amber-600 hover:bg-amber-500 text-white text-xs px-3 font-bold"
                    >
                      שמור
                    </Button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            }

            return (
              <div
                key={p.id}
                className={cn(
                  'flex items-center gap-3.5 px-5 py-3.5 transition-colors group',
                  isOverdue ? 'bg-red-50/20 hover:bg-red-50/40' : 'hover:bg-slate-50/60'
                )}
              >
                {/* Due Date Box */}
                <div className="w-16 shrink-0">
                  {due ? (
                    <div
                      className={cn(
                        'text-center rounded-lg py-1 border',
                        isOverdue
                          ? 'bg-red-50 border-red-200 text-red-700'
                          : 'bg-amber-50/80 border-amber-200/80 text-amber-800'
                      )}
                    >
                      <p className="text-[9px] font-bold leading-none opacity-80">
                        {format(due, 'MMM yy', { locale: he })}
                      </p>
                      <p className="text-base font-black leading-tight mt-0.5">
                        {format(due, 'd')}
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-1">
                      <CalendarDays className="w-4 h-4 text-slate-300 mx-auto" />
                      <p className="text-[9px] text-slate-400 mt-0.5">ללא תאריך</p>
                    </div>
                  )}
                </div>

                {/* Description & Status */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-800 truncate">
                      {p.notes || 'תשלום ללא תיאור'}
                    </p>
                    {isOverdue && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-100/80 border border-red-200 px-2 py-0.5 rounded-full shrink-0">
                        <AlertCircle className="w-3 h-3" />
                        באיחור
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
                    {due && <span>יעד לתשלום: {format(due, 'dd/MM/yyyy')}</span>}
                  </div>
                </div>

                {/* Amount (CLEAR, NO LINE-THROUGH!) */}
                <div className="text-left shrink-0">
                  <p className={cn('font-black text-sm', isOverdue ? 'text-red-700' : 'text-slate-800')}>
                    {fmt(Number(p.amount))}
                  </p>
                </div>

                {/* Action Buttons: Edit and Delete only! */}
                <div className="flex items-center gap-1 print:hidden">
                  <button
                    onClick={() => startEdit(p)}
                    disabled={pending}
                    title="ערוך תשלום בלוח"
                    className="w-8 h-8 rounded-lg border border-slate-200 text-slate-400 hover:text-amber-600 hover:bg-amber-50 hover:border-amber-300 flex items-center justify-center transition-colors shrink-0"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => remove(p.id, false)}
                    disabled={pending}
                    title="מחק תשלום מהלוח"
                    className="w-8 h-8 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════
          חלק 2: תשלומים שבוצעו בפועל (תנועות עצמאיות לחלוטין)
          ═══════════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="px-5 py-4 bg-gradient-to-l from-emerald-50/60 to-white border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <History className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">2. תשלומים שבוצעו בפועל (תנועות)</p>
              <p className="text-xs text-slate-500">
                רשימת התנועות הכספיות שבוצעו בפועל. מקזזת ישירות מהיתרה לתשלום.
              </p>
            </div>
          </div>

          <Button
            size="sm"
            onClick={() => {
              setShowAddExecuted((v) => !v)
              if (showAddScheduled) setShowAddScheduled(false)
            }}
            className="text-xs gap-1.5 h-8 bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs print:hidden font-bold"
          >
            <Plus className="w-3.5 h-3.5" /> הוסף תנועה שבוצעה
          </Button>
        </div>

        {/* Add Executed Payment Form */}
        {showAddExecuted && (
          <div className="px-5 py-4 bg-emerald-50/40 border-b border-emerald-100 grid grid-cols-1 sm:grid-cols-[1fr_1fr_2fr_auto] gap-3 items-end print:hidden">
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-1">סכום ששולם (₪) *</p>
              <Input
                type="number"
                placeholder="0"
                dir="ltr"
                value={executedRow.amount}
                onChange={(e) => setExecutedRow((r) => ({ ...r, amount: e.target.value }))}
                className="h-9 text-sm border-emerald-200 bg-white"
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-1">תאריך ביצוע התשלום</p>
              <Input
                type="date"
                value={executedRow.paid_at}
                onChange={(e) => setExecutedRow((r) => ({ ...r, paid_at: e.target.value }))}
                className="h-9 text-sm border-emerald-200 bg-white"
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-1">הערות / אסמכתא</p>
              <Input
                placeholder="למשל: העברה בנקאית לחשבון..., צ'ק 1052, חשבונית מס..."
                value={executedRow.notes}
                onChange={(e) => setExecutedRow((r) => ({ ...r, notes: e.target.value }))}
                className="h-9 text-sm border-emerald-200 bg-white"
              />
            </div>
            <div className="flex gap-2 mt-2 sm:mt-0">
              <Button
                size="sm"
                onClick={handleAddExecuted}
                disabled={pending}
                className="h-9 bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-4 font-bold"
              >
                רשום תנועה
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowAddExecuted(false)}
                className="h-9 text-xs text-slate-500"
              >
                ביטול
              </Button>
            </div>
          </div>
        )}

        {/* Executed Payments List */}
        <div className="divide-y divide-slate-100">
          {executedPayments.length === 0 && (
            <div className="text-center py-10 px-4">
              <History className="w-10 h-10 text-slate-200 mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-medium">טרם נרשמו תשלומים שבוצעו בפועל.</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                לחץ על "הוסף תנועה שבוצעה" כדי להזין תשלום שבוצע.
              </p>
            </div>
          )}

          {executedPayments.map((p) => {
            const paidDate = p.paid_at ? new Date(p.paid_at) : p.created_at ? new Date(p.created_at) : null

            if (editingId === p.id) {
              return (
                <div
                  key={p.id}
                  className="px-5 py-3.5 bg-emerald-50/70 grid grid-cols-1 sm:grid-cols-[1fr_1fr_2fr_auto] gap-2.5 items-end border-b border-emerald-100"
                >
                  <div>
                    <p className="text-[11px] font-semibold text-slate-600 mb-1">סכום ששולם (₪)</p>
                    <Input
                      type="number"
                      dir="ltr"
                      value={editRow.amount}
                      onChange={(e) => setEditRow((r) => ({ ...r, amount: e.target.value }))}
                      className="h-9 text-sm border-emerald-200 bg-white"
                    />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-slate-600 mb-1">תאריך ביצוע</p>
                    <Input
                      type="date"
                      value={editRow.paid_at}
                      onChange={(e) => setEditRow((r) => ({ ...r, paid_at: e.target.value }))}
                      className="h-9 text-sm border-emerald-200 bg-white"
                    />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-slate-600 mb-1">הערות / אסמכתא</p>
                    <Input
                      value={editRow.notes}
                      onChange={(e) => setEditRow((r) => ({ ...r, notes: e.target.value }))}
                      className="h-9 text-sm border-emerald-200 bg-white"
                    />
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                    <Button
                      size="sm"
                      onClick={() => saveEdit(p.id)}
                      disabled={pending}
                      className="h-9 bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 font-bold"
                    >
                      שמור
                    </Button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            }

            return (
              <div
                key={p.id}
                className="flex items-center gap-3.5 px-5 py-3.5 hover:bg-slate-50/60 transition-colors group"
              >
                {/* Paid Date Box */}
                <div className="w-16 shrink-0">
                  {paidDate ? (
                    <div className="text-center rounded-lg py-1 bg-emerald-50 border border-emerald-200 text-emerald-800">
                      <p className="text-[9px] font-bold leading-none opacity-80">
                        {format(paidDate, 'MMM yy', { locale: he })}
                      </p>
                      <p className="text-base font-black leading-tight mt-0.5">
                        {format(paidDate, 'd')}
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                      <p className="text-[9px] text-emerald-700 mt-0.5 font-bold">שולם</p>
                    </div>
                  )}
                </div>

                {/* Description & Date */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-800 truncate">
                      {p.notes || 'תשלום שבוצע'}
                    </p>
                    <span className="text-[10px] bg-emerald-100/80 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full font-bold shrink-0">
                      שולם
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
                    {paidDate && <span>תאריך תשלום: {format(paidDate, 'dd/MM/yyyy')}</span>}
                  </div>
                </div>

                {/* Amount (CLEAR, NO LINE-THROUGH!) */}
                <div className="text-left shrink-0">
                  <p className="font-black text-sm text-emerald-700">
                    {fmt(Number(p.amount))}
                  </p>
                </div>

                {/* Actions: Edit and Delete only! */}
                <div className="flex items-center gap-1 print:hidden">
                  <button
                    onClick={() => startEdit(p)}
                    disabled={pending}
                    title="ערוך תנועה"
                    className="w-8 h-8 rounded-lg border border-slate-200 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 hover:border-emerald-300 flex items-center justify-center transition-colors shrink-0"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => remove(p.id, true)}
                    disabled={pending}
                    title="מחק תנועה"
                    className="w-8 h-8 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
