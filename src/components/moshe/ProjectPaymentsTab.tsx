'use client'

import { useState, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Check,
  Plus,
  Trash2,
  CalendarDays,
  Pencil,
  X,
  Printer,
  RotateCcw,
  Clock,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  History,
  Link as LinkIcon,
  Layers,
  ArrowRightLeft,
  ChevronDown,
  BookmarkCheck,
} from 'lucide-react'
import {
  toggleProjectPayment,
  deleteProjectPayment,
  addProjectPayment,
  updateProjectPayment,
  linkExecutedPaymentToScheduled,
  setPaymentDueDate,
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
  totalProjectCost,
}: Props) {
  const [pending, startTransition] = useTransition()

  // Filter in Schedule tab ('all' | 'pending' | 'completed')
  const [scheduleFilter, setScheduleFilter] = useState<'all' | 'pending' | 'completed'>('all')

  // Add forms state
  const [showAddScheduled, setShowAddScheduled] = useState(false)
  const [scheduledRow, setScheduledRow] = useState({ amount: '', due_date: '', notes: '' })

  const [showAddExecuted, setShowAddExecuted] = useState(false)
  const [executedRow, setExecutedRow] = useState({
    amount: '',
    paid_at: new Date().toISOString().slice(0, 10),
    due_date: new Date().toISOString().slice(0, 10),
    includeInSchedule: true,
    notes: '',
  })

  // Edit row state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRow, setEditRow] = useState({ amount: '', due_date: '', paid_at: '', notes: '' })

  // Link / Set due date modal state
  const [linkModalPayment, setLinkModalPayment] = useState<MosheProjectPayment | null>(null)
  const [selectedScheduledId, setSelectedScheduledId] = useState<string>('')
  const [customDueDate, setCustomDueDate] = useState<string>('')

  // Explicit Add as Transaction Modal
  const [explicitTxModal, setExplicitTxModal] = useState<{
    payment: MosheProjectPayment
    date: string
  } | null>(null)

  // ── Separation Logic ────────────────────────────────────────────────────────

  // 1. לוח התשלומים שנקבע:
  // כולל את כל הפריטים ששייכים ללוח — פריטים עם due_date, או פריטים שטרם שולמו / סומנו בלוח בלבד ללא תנועה
  const allScheduleItems = payments
    .filter((p) => Boolean(p.due_date) || !p.paid_at)
    .sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0
      if (!a.due_date) return 1
      if (!b.due_date) return -1
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    })

  const pendingScheduleItems = allScheduleItems.filter((p) => !p.is_paid)
  const completedScheduleItems = allScheduleItems.filter((p) => p.is_paid)

  // Visible items in Schedule section according to filter
  const visibleScheduleItems =
    scheduleFilter === 'pending'
      ? pendingScheduleItems
      : scheduleFilter === 'completed'
      ? completedScheduleItems
      : allScheduleItems

  // 2. תשלומים שבוצעו בפועל (רשימת תנועות יבשה):
  // כולל אך ורק תנועות כספיות שבוצעו בפועל (is_paid === true וגם paid_at קיים)
  const executedPayments = payments
    .filter((p) => p.is_paid && Boolean(p.paid_at))
    .sort((a, b) => {
      const dateA = a.paid_at || a.due_date || a.created_at
      const dateB = b.paid_at || b.due_date || b.created_at
      return new Date(dateB).getTime() - new Date(dateA).getTime()
    })

  // KPIs: היתרה לתשלום מחושבת לפי התנועות שבוצעו בפועל (סך החוזה מינוס התשלומים שבוצעו בפועל)
  const hasContractBudget = typeof totalProjectCost === 'number' && totalProjectCost > 0
  const totalPaid = executedPayments.reduce((s, p) => s + Number(p.amount), 0)
  const totalScheduled = allScheduleItems.reduce((s, p) => s + Number(p.amount), 0)
  const contractTotal = hasContractBudget ? totalProjectCost! : totalScheduled
  const remaining = contractTotal - totalPaid

  const today = new Date()

  // ── Actions ────────────────────────────────────────────────────────────────

  // 1. סימון תשלום כבוצע בלוח בלבד — ללא הוספת תנועה כספית ולא מקזז מהיתרה בפועל!
  function handleMarkCompletedScheduleOnly(p: MosheProjectPayment) {
    startTransition(async () => {
      const r = await toggleProjectPayment(p.id, projectId, true, null, false)
      if (r.error) toast.error(r.error)
      else toast.success(`תשלום ₪${Number(p.amount).toLocaleString('he-IL')} סומן כבוצע בלוח בלבד (ללא תנועה)`)
    })
  }

  // 2. סימון מפורש להוספה כתנועה שבוצעה בפועל — מוסיף לרשימת התנועות ומקזז מהיתרה!
  function handleMarkCompletedWithTransaction(p: MosheProjectPayment, executionDate?: string) {
    startTransition(async () => {
      const targetDate = executionDate || new Date().toISOString().slice(0, 10)
      const r = await toggleProjectPayment(p.id, projectId, true, targetDate, true)
      if (r.error) toast.error(r.error)
      else toast.success(`תשלום ₪${Number(p.amount).toLocaleString('he-IL')} סומן כבוצע ונרשמה תנועה שבוצעה בפועל!`)
    })
  }

  // 3. ביטול רישום תנועה (השארת התשלום כבוצע בלוח בלבד ללא תנועה כספית)
  function handleRemoveTransactionOnly(p: MosheProjectPayment) {
    startTransition(async () => {
      const r = await toggleProjectPayment(p.id, projectId, true, null, false)
      if (r.error) toast.error(r.error)
      else toast.success('התנועה הכספית הוסרה — התשלום נשאר מסומן כבוצע בלוח בלבד')
    })
  }

  // 4. החזרת תשלום בלוח לסטטוס טרם שולם:
  function handleReturnToPending(p: MosheProjectPayment) {
    startTransition(async () => {
      const r = await toggleProjectPayment(p.id, projectId, false)
      if (r.error) toast.error(r.error)
      else toast.success('התשלום הוחזר לסטטוס טרם שולם בלוח')
    })
  }

  // 5. סימון תנועה שבוצעה שהיא גם חלק מלוח התשלומים:
  // זה קובע לה due_date — היא נשארת כתנועה שבוצעה ברשימת התנועות, ומופיעה גם בלוח התשלומים מסומנת שבוצעה כבר!
  function handleTogglePartOfSchedule(p: MosheProjectPayment) {
    const isCurrentlyInSchedule = Boolean(p.due_date)

    if (isCurrentlyInSchedule) {
      // הסרה מלוח התשלומים — נשארת רק כתנועה עצמאית
      startTransition(async () => {
        const r = await setPaymentDueDate(p.id, projectId, null)
        if (r.error) toast.error(r.error)
        else toast.success('התנועה הוסרה מלוח התשלומים ונשארה כתנועה עצמאית ברשימה')
      })
    } else {
      // סימון כחלק מלוח התשלומים — מקבלת תאריך יעד בלוח ומופיעה גם בלוח למעלה כמסומנת שבוצעה!
      const targetDueDate = p.paid_at ? p.paid_at.slice(0, 10) : new Date().toISOString().slice(0, 10)
      startTransition(async () => {
        const r = await setPaymentDueDate(p.id, projectId, targetDueDate)
        if (r.error) toast.error(r.error)
        else toast.success('התנועה סומנה כחלק מלוח התשלומים! היא מופיעה כעת גם בלוח כמסומנת שבוצעה כבר.')
      })
    }
  }

  // 4. שיוך מתקדם או עריכת תאריך יעד בלוח
  function handleSaveAdvancedScheduleLink() {
    if (!linkModalPayment) return

    // אם נבחר שיוך לתשלום פתוח קיים בלוח (מיזוג למניעת כפילות)
    if (selectedScheduledId) {
      startTransition(async () => {
        const r = await linkExecutedPaymentToScheduled(linkModalPayment.id, selectedScheduledId, projectId)
        if (r.error) toast.error(r.error)
        else {
          toast.success('התנועה שויכה בהצלחה לתשלום בלוח, והיתרה עודכנה במדויק!')
          setLinkModalPayment(null)
          setSelectedScheduledId('')
        }
      })
      return
    }

    // אם הוגדר תאריך יעד מותאם אישית
    if (customDueDate) {
      startTransition(async () => {
        const r = await setPaymentDueDate(linkModalPayment.id, projectId, customDueDate)
        if (r.error) toast.error(r.error)
        else {
          toast.success('תאריך היעד בלוח עודכן — התנועה מופיעה בלוח התשלומים כמסומנת שבוצעה!')
          setLinkModalPayment(null)
          setCustomDueDate('')
        }
      })
      return
    }

    toast.error('יש לבחור תשלום מהלוח או להזין תאריך יעד')
  }

  function remove(id: string) {
    if (!confirm('האם אתה בטוח שברצונך למחוק תשלום זה?')) return
    startTransition(async () => {
      const r = await deleteProjectPayment(id, projectId)
      if (r.error) toast.error(r.error)
      else toast.success('תשלום נמחק')
    })
  }

  async function handleAddScheduled() {
    if (!scheduledRow.amount || parseFloat(scheduledRow.amount) <= 0) {
      return toast.error('יש להזין סכום תקין לתשלום')
    }
    startTransition(async () => {
      const r = await addProjectPayment({
        project_id: projectId,
        amount: scheduledRow.amount,
        due_date: scheduledRow.due_date || undefined,
        notes: scheduledRow.notes || undefined,
        is_paid: false,
      })
      if (r.error) {
        toast.error(r.error)
        return
      }
      toast.success('תשלום נוסף ללוח התשלומים')
      setScheduledRow({ amount: '', due_date: '', notes: '' })
      setShowAddScheduled(false)
    })
  }

  async function handleAddExecuted() {
    if (!executedRow.amount || parseFloat(executedRow.amount) <= 0) {
      return toast.error('יש להזין סכום תקין לתשלום שבוצע')
    }

    // אם מסומן לכלול בלוח התשלומים, נשמור עם due_date
    const dueDateToSet = executedRow.includeInSchedule
      ? executedRow.due_date || executedRow.paid_at || new Date().toISOString().slice(0, 10)
      : undefined

    startTransition(async () => {
      const r = await addProjectPayment({
        project_id: projectId,
        amount: executedRow.amount,
        paid_at: executedRow.paid_at ? `${executedRow.paid_at}T12:00:00.000Z` : undefined,
        due_date: dueDateToSet,
        notes: executedRow.notes || undefined,
        is_paid: true,
      })
      if (r.error) {
        toast.error(r.error)
        return
      }
      toast.success(
        executedRow.includeInSchedule
          ? 'תשלום שבוצע נרשם בהצלחה — ונוסף גם ללוח התשלומים כמסומן שבוצע!'
          : 'תשלום שבוצע נרשם בהצלחה כתנועה עצמאית'
      )
      setExecutedRow({
        amount: '',
        paid_at: new Date().toISOString().slice(0, 10),
        due_date: new Date().toISOString().slice(0, 10),
        includeInSchedule: true,
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
        due_date: editRow.due_date || undefined,
        paid_at: editRow.paid_at ? `${editRow.paid_at}T12:00:00.000Z` : undefined,
        notes: editRow.notes || undefined,
      })
      if (r.error) {
        toast.error(r.error)
        return
      }
      toast.success('תשלום עודכן')
      setEditingId(null)
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
              לוח תשלומים שנקבע, תנועות שבוצעו בפועל, ושיוך דו-כיווני ביניהם
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handlePrint}
            className="h-8 text-xs gap-1.5 border-slate-200 text-slate-700 hover:bg-slate-100 shadow-sm"
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
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-emerald-50/80 border border-emerald-200/60 rounded-2xl p-3.5 text-center shadow-xs">
            <div className="flex items-center justify-center gap-1.5 text-emerald-700 mb-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <p className="text-[11px] font-bold uppercase tracking-wider">שולם בפועל</p>
            </div>
            <p className="text-xl font-black text-emerald-700 tracking-tight">{fmt(totalPaid)}</p>
            <p className="text-[10px] text-emerald-600/80 mt-0.5">{executedPayments.length} תנועות שבוצעו בפועל</p>
          </div>

          <div className="bg-slate-50/90 border border-slate-200/70 rounded-2xl p-3.5 text-center shadow-xs">
            <div className="flex items-center justify-center gap-1.5 text-slate-500 mb-1">
              <CalendarDays className="w-3.5 h-3.5" />
              <p className="text-[11px] font-bold uppercase tracking-wider">
                {hasContractBudget ? 'סך החוזה' : 'סך הלוח'}
              </p>
            </div>
            <p className="text-xl font-black text-slate-800 tracking-tight">{fmt(contractTotal)}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {hasContractBudget ? 'לפי תקציב/חוזה הפרויקט' : `${allScheduleItems.length} תשלומים בלוח`}
            </p>
          </div>

          <div className="bg-amber-50/80 border border-amber-200/60 rounded-2xl p-3.5 text-center shadow-xs">
            <div className="flex items-center justify-center gap-1.5 text-amber-700 mb-1">
              <Clock className="w-3.5 h-3.5" />
              <p className="text-[11px] font-bold uppercase tracking-wider">יתרה לתשלום</p>
            </div>
            <p
              className={cn(
                'text-xl font-black tracking-tight',
                remaining < 0 ? 'text-emerald-700' : 'text-amber-800'
              )}
            >
              {fmt(remaining)}
            </p>
            <p className="text-[10px] text-amber-600/80 mt-0.5">סך החוזה פחות שולם בפועל</p>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════
          חלק 1: לוח התשלומים שנקבע (כולל עתידיים ומסומנים שבוצעו)
          ═══════════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-slate-200/70 overflow-hidden shadow-xs">
        <div className="px-4 py-3.5 bg-gradient-to-l from-slate-50 to-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <CalendarDays className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">1. לוח התשלומים שנקבע</p>
              <p className="text-[11px] text-slate-400">
                לוח התשלומים המלא — מציג תשלומים עתידיים ותשלומים שכבר בוצעו (מסומנים ב-✓).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            {/* Filter Pills */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-[11px] font-medium text-slate-600">
              <button
                onClick={() => setScheduleFilter('all')}
                className={cn('px-2.5 py-1 rounded-md transition-all', scheduleFilter === 'all' && 'bg-white font-bold text-slate-900 shadow-xs')}
              >
                הכל ({allScheduleItems.length})
              </button>
              <button
                onClick={() => setScheduleFilter('pending')}
                className={cn('px-2.5 py-1 rounded-md transition-all', scheduleFilter === 'pending' && 'bg-white font-bold text-amber-700 shadow-xs')}
              >
                עתידיים ({pendingScheduleItems.length})
              </button>
              <button
                onClick={() => setScheduleFilter('completed')}
                className={cn('px-2.5 py-1 rounded-md transition-all', scheduleFilter === 'completed' && 'bg-white font-bold text-emerald-700 shadow-xs')}
              >
                בוצעו ({completedScheduleItems.length})
              </button>
            </div>

            <Button
              size="sm"
              onClick={() => {
                setShowAddScheduled((v) => !v)
                if (showAddExecuted) setShowAddExecuted(false)
              }}
              className="text-xs gap-1.5 h-8 bg-amber-500 hover:bg-amber-600 text-white shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" /> הוסף ללוח
            </Button>
          </div>
        </div>

        {/* Add Scheduled Payment Form */}
        {showAddScheduled && (
          <div className="px-4 py-3.5 bg-amber-50/50 border-b border-amber-100 grid grid-cols-1 sm:grid-cols-[1fr_1fr_2fr_auto] gap-2.5 items-end print:hidden">
            <div>
              <p className="text-[11px] font-medium text-slate-600 mb-1">סכום לתשלום (₪) *</p>
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
              <p className="text-[11px] font-medium text-slate-600 mb-1">תאריך יעד לתשלום</p>
              <Input
                type="date"
                value={scheduledRow.due_date}
                onChange={(e) => setScheduledRow((r) => ({ ...r, due_date: e.target.value }))}
                className="h-9 text-sm border-amber-200 bg-white"
              />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-600 mb-1">הערות / תיאור התשלום</p>
              <Input
                placeholder="למשל: תשלום שלד א׳, שכר מתכננים..."
                value={scheduledRow.notes}
                onChange={(e) => setScheduledRow((r) => ({ ...r, notes: e.target.value }))}
                className="h-9 text-sm border-amber-200 bg-white"
              />
            </div>
            <div className="flex gap-1.5 mt-2 sm:mt-0">
              <Button
                size="sm"
                onClick={handleAddScheduled}
                disabled={pending}
                className="h-9 bg-amber-600 hover:bg-amber-500 text-white text-xs px-4"
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
          {visibleScheduleItems.length === 0 && (
            <div className="text-center py-8 px-4">
              <CalendarDays className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-xs text-slate-400">אין תשלומים תואמים בלוח.</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                לחץ על "הוסף ללוח" כדי להגדיר יעדי תשלום חדשים.
              </p>
            </div>
          )}

          {visibleScheduleItems.map((p) => {
            const due = p.due_date ? new Date(p.due_date) : null
            const isOverdue = due && !p.is_paid && due < today
            const isPaid = p.is_paid

            if (editingId === p.id) {
              return (
                <div
                  key={p.id}
                  className="px-4 py-3 bg-amber-50/70 grid grid-cols-1 sm:grid-cols-[1fr_1fr_2fr_auto] gap-2 items-end border-b border-amber-100"
                >
                  <div>
                    <p className="text-[10px] text-slate-500 mb-1">סכום (₪)</p>
                    <Input
                      type="number"
                      dir="ltr"
                      value={editRow.amount}
                      onChange={(e) => setEditRow((r) => ({ ...r, amount: e.target.value }))}
                      className="h-9 text-sm border-amber-200 bg-white"
                    />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 mb-1">תאריך יעד</p>
                    <Input
                      type="date"
                      value={editRow.due_date}
                      onChange={(e) => setEditRow((r) => ({ ...r, due_date: e.target.value }))}
                      className="h-9 text-sm border-amber-200 bg-white"
                    />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 mb-1">הערות</p>
                    <Input
                      value={editRow.notes}
                      onChange={(e) => setEditRow((r) => ({ ...r, notes: e.target.value }))}
                      className="h-9 text-sm border-amber-200 bg-white"
                    />
                  </div>
                  <div className="flex gap-1.5 w-full sm:w-auto mt-2 sm:mt-0">
                    <Button
                      size="sm"
                      onClick={() => saveEdit(p.id)}
                      disabled={pending}
                      className="h-9 bg-amber-600 hover:bg-amber-500 text-white text-xs px-3"
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
                  'flex items-center gap-3 px-4 py-3 transition-colors group',
                  isPaid ? 'bg-emerald-50/30 hover:bg-emerald-50/50' : isOverdue ? 'bg-red-50/30' : 'hover:bg-slate-50/50'
                )}
              >
                {/* Due Date Box */}
                <div className="w-16 shrink-0">
                  {due ? (
                    <div
                      className={cn(
                        'text-center rounded-lg py-1 border',
                        isPaid
                          ? 'bg-emerald-50 border-emerald-200/80 text-emerald-800'
                          : isOverdue
                          ? 'bg-red-50 border-red-200/80 text-red-700'
                          : 'bg-amber-50/60 border-amber-200/60 text-amber-800'
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
                    <p className={cn('text-sm font-semibold truncate', isPaid ? 'text-slate-700 font-bold' : 'text-slate-800')}>
                      {p.notes || 'תשלום ללא תיאור'}
                    </p>
                    {isPaid ? (
                      p.paid_at ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/80 border border-emerald-300/80 px-2 py-0.5 rounded-full shrink-0">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          שולם ונרשמה תנועה
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-700 bg-sky-100/80 border border-sky-300/80 px-2 py-0.5 rounded-full shrink-0">
                          <Check className="w-3 h-3 text-sky-600" />
                          בוצע בלוח (ללא תנועה)
                        </span>
                      )
                    ) : isOverdue ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-100/70 px-1.5 py-0.5 rounded-md shrink-0">
                        <AlertCircle className="w-3 h-3" />
                        באיחור
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md shrink-0 font-medium">
                        עתידי
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[10px] text-slate-400">
                    {due && <span>יעד תשלום: {format(due, 'dd/MM/yyyy')}</span>}
                    {isPaid && p.paid_at && (
                      <span className="text-emerald-600 font-medium">
                        שולם בתאריך: {format(new Date(p.paid_at), 'dd/MM/yyyy')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Amount */}
                <div className="text-left shrink-0">
                  <p
                    className={cn(
                      'font-black text-sm',
                      isPaid ? (p.paid_at ? 'text-emerald-700' : 'text-sky-700') : isOverdue ? 'text-red-600' : 'text-slate-800'
                    )}
                  >
                    {fmt(Number(p.amount))}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1.5 print:hidden">
                  {!isPaid ? (
                    <>
                      {/* 1. סמן כבוצע בלוח בלבד (ללא תנועה) */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleMarkCompletedScheduleOnly(p)}
                        disabled={pending}
                        title="סמן כבוצע בלוח בלבד — ללא הוספת תנועה כספית ולא מקזז מהיתרה"
                        className="h-8 border-slate-300 text-slate-700 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-300 font-semibold text-xs gap-1.5 px-2.5"
                      >
                        <Check className="w-3.5 h-3.5 text-sky-600" />
                        <span>סמן כבוצע</span>
                      </Button>

                      {/* 2. סימון מפורש להוספה כתנועה שבוצעה בפועל */}
                      <Button
                        size="sm"
                        onClick={() =>
                          setExplicitTxModal({
                            payment: p,
                            date: new Date().toISOString().slice(0, 10),
                          })
                        }
                        disabled={pending}
                        title="סמן מפורשות כהוספה כתנועה שבוצעה בפועל (מקזז מהיתרה לתשלום)"
                        className="h-8 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5 shadow-xs px-2.5"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>רשום כתנועה</span>
                      </Button>
                    </>
                  ) : (
                    <>
                      {p.paid_at ? (
                        /* נרשמה תנועה: אפשרות להשאיר בלוח בלבד ולבטל את התנועה הכספית */
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveTransactionOnly(p)}
                          disabled={pending}
                          title="בטל רישום כתנועה — השאר בלוח בלבד ללא תנועה כספית"
                          className="h-8 text-[11px] text-slate-600 hover:text-amber-700 hover:bg-amber-50 px-2 gap-1 border border-slate-200"
                        >
                          <span>השאר בלוח בלבד</span>
                        </Button>
                      ) : (
                        /* בוצע בלוח בלבד: אפשרות להוסיף סימון מפורש כתנועה שבוצעה */
                        <Button
                          size="sm"
                          onClick={() =>
                            setExplicitTxModal({
                              payment: p,
                              date: new Date().toISOString().slice(0, 10),
                            })
                          }
                          disabled={pending}
                          title="הוסף סימון מפורש כתנועה שבוצעה בפועל"
                          className="h-8 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1 px-2.5 shadow-xs"
                        >
                          <CreditCard className="w-3 h-3" />
                          <span>+ רשום כתנועה</span>
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleReturnToPending(p)}
                        disabled={pending}
                        title="החזר לסטטוס טרם שולם בלוח"
                        className="h-8 text-[11px] text-slate-500 hover:text-red-700 hover:bg-red-50 px-2 gap-1 border border-slate-200"
                      >
                        <RotateCcw className="w-3 h-3 text-slate-400" />
                        <span>החזר לטרם שולם</span>
                      </Button>
                    </>
                  )}

                  <button
                    onClick={() => startEdit(p)}
                    disabled={pending}
                    title="ערוך תשלום"
                    className="w-7 h-7 rounded-lg border border-slate-200 text-slate-400 hover:text-amber-600 hover:bg-amber-50 hover:border-amber-200 flex items-center justify-center transition-colors shrink-0"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => remove(p.id)}
                    disabled={pending}
                    title="מחק תשלום"
                    className="w-7 h-7 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors shrink-0"
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
          חלק 2: התשלומים שבוצעו בפועל (רשימת תנועות יבשה + סימון ללוח)
          ═══════════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-slate-200/70 overflow-hidden shadow-xs">
        <div className="px-4 py-3.5 bg-gradient-to-l from-emerald-50/50 to-white border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <History className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">2. תשלומים שבוצעו בפועל (תנועות)</p>
              <p className="text-[11px] text-slate-400">
                רשימת תנועות יבשה. ניתן לסמן בקלות האם התנועה היא גם חלק מלוח התשלומים.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setShowAddExecuted((v) => !v)
              if (showAddScheduled) setShowAddScheduled(false)
            }}
            className="text-xs gap-1.5 h-8 bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs print:hidden"
          >
            <Plus className="w-3.5 h-3.5" /> הוסף תשלום שבוצע
          </Button>
        </div>

        {/* Add Executed Payment Form */}
        {showAddExecuted && (
          <div className="px-4 py-3.5 bg-emerald-50/50 border-b border-emerald-100 space-y-3 print:hidden">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <p className="text-[11px] font-medium text-slate-600 mb-1">סכום ששולם (₪) *</p>
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
                <p className="text-[11px] font-medium text-slate-600 mb-1">תאריך ביצוע התשלום</p>
                <Input
                  type="date"
                  value={executedRow.paid_at}
                  onChange={(e) => setExecutedRow((r) => ({ ...r, paid_at: e.target.value }))}
                  className="h-9 text-sm border-emerald-200 bg-white"
                />
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-600 mb-1">הערות / אסמכתא</p>
                <Input
                  placeholder="למשל: העברה בנקאית, חשבונית 1024, צ'ק..."
                  value={executedRow.notes}
                  onChange={(e) => setExecutedRow((r) => ({ ...r, notes: e.target.value }))}
                  className="h-9 text-sm border-emerald-200 bg-white"
                />
              </div>
            </div>

            {/* Checkbox: האם לכלול גם בלוח התשלומים כמסומן שבוצע */}
            <div className="bg-white/90 p-2.5 rounded-xl border border-emerald-200/90 flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={executedRow.includeInSchedule}
                  onChange={(e) => setExecutedRow((r) => ({ ...r, includeInSchedule: e.target.checked }))}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>הוסף תנועה זו גם ללוח התשלומים (כמסומנת שבוצעה כבר)</span>
              </label>

              {executedRow.includeInSchedule && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">תאריך יעד בלוח:</span>
                  <input
                    type="date"
                    value={executedRow.due_date}
                    onChange={(e) => setExecutedRow((r) => ({ ...r, due_date: e.target.value }))}
                    className="h-8 text-xs rounded-lg border border-slate-300 bg-white px-2 text-slate-700"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-1.5 justify-end pt-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowAddExecuted(false)}
                className="h-8 text-xs text-slate-500"
              >
                ביטול
              </Button>
              <Button
                size="sm"
                onClick={handleAddExecuted}
                disabled={pending}
                className="h-8 bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-4"
              >
                רשום תנועה
              </Button>
            </div>
          </div>
        )}

        {/* Executed Payments List */}
        <div className="divide-y divide-slate-100">
          {executedPayments.length === 0 && (
            <div className="text-center py-8 px-4">
              <CreditCard className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-xs text-slate-400">טרם נרשמו תשלומים שבוצעו בפועל.</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                לחץ על "סמן כתנועה שבוצעה" בלוח למעלה או "הוסף תשלום שבוצע" להזנה ישירה.
              </p>
            </div>
          )}

          {executedPayments.map((p) => {
            const paidDate = p.paid_at ? new Date(p.paid_at) : p.due_date ? new Date(p.due_date) : null
            const isPartSchedule = Boolean(p.due_date)

            if (editingId === p.id) {
              return (
                <div
                  key={p.id}
                  className="px-4 py-3 bg-emerald-50/70 grid grid-cols-1 sm:grid-cols-[1fr_1fr_2fr_auto] gap-2 items-end border-b border-emerald-100"
                >
                  <div>
                    <p className="text-[10px] text-slate-500 mb-1">סכום ששולם (₪)</p>
                    <Input
                      type="number"
                      dir="ltr"
                      value={editRow.amount}
                      onChange={(e) => setEditRow((r) => ({ ...r, amount: e.target.value }))}
                      className="h-9 text-sm border-emerald-200 bg-white"
                    />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 mb-1">תאריך ביצוע</p>
                    <Input
                      type="date"
                      value={editRow.paid_at}
                      onChange={(e) => setEditRow((r) => ({ ...r, paid_at: e.target.value }))}
                      className="h-9 text-sm border-emerald-200 bg-white"
                    />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 mb-1">הערות</p>
                    <Input
                      value={editRow.notes}
                      onChange={(e) => setEditRow((r) => ({ ...r, notes: e.target.value }))}
                      className="h-9 text-sm border-emerald-200 bg-white"
                    />
                  </div>
                  <div className="flex gap-1.5 w-full sm:w-auto mt-2 sm:mt-0">
                    <Button
                      size="sm"
                      onClick={() => saveEdit(p.id)}
                      disabled={pending}
                      className="h-9 bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3"
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
                className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/50 transition-colors group"
              >
                {/* Paid Date Box */}
                <div className="w-16 shrink-0">
                  {paidDate ? (
                    <div className="text-center rounded-lg py-1 bg-emerald-50/80 border border-emerald-200/70 text-emerald-800">
                      <p className="text-[9px] font-bold leading-none opacity-80">
                        {format(paidDate, 'MMM yy', { locale: he })}
                      </p>
                      <p className="text-base font-black leading-tight mt-0.5">
                        {format(paidDate, 'd')}
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />
                      <p className="text-[9px] text-emerald-600 mt-0.5">שולם</p>
                    </div>
                  )}
                </div>

                {/* Description & Link Status */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {p.notes || 'תשלום שבוצע'}
                    </p>
                    {isPartSchedule ? (
                      <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200/80 px-2 py-0.5 rounded-full font-bold shrink-0 flex items-center gap-1">
                        <BookmarkCheck className="w-3 h-3 text-amber-600" />
                        חלק מלוח התשלומים (מופיע גם בלוח)
                      </span>
                    ) : (
                      <span className="text-[10px] bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-full font-medium shrink-0">
                        תנועה עצמאית
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[11px] text-slate-500">
                    {paidDate && <span>שולם: {format(paidDate, 'dd/MM/yyyy')}</span>}
                    {p.due_date && <span>יעד בלוח: {format(new Date(p.due_date), 'dd/MM/yyyy')}</span>}
                  </div>
                </div>

                {/* Amount */}
                <div className="text-left shrink-0">
                  <p className="font-black text-sm text-emerald-700">{fmt(Number(p.amount))}</p>
                </div>

                {/* Action: סימון ישיר האם התנועה היא גם חלק מלוח התשלומים */}
                <div className="print:hidden">
                  <Button
                    size="sm"
                    variant={isPartSchedule ? 'secondary' : 'outline'}
                    onClick={() => handleTogglePartOfSchedule(p)}
                    disabled={pending}
                    className={cn(
                      'h-8 font-bold text-xs gap-1.5 shadow-2xs px-2.5',
                      isPartSchedule
                        ? 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300'
                        : 'border-slate-300 text-slate-700 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300'
                    )}
                  >
                    <CalendarDays className="w-3.5 h-3.5 text-amber-600" />
                    <span>{isPartSchedule ? 'הסר מלוח התשלומים' : 'סמן כחלק מלוח התשלומים'}</span>
                  </Button>
                </div>

                {/* Actions (Edit / Delete) */}
                <div className="flex items-center gap-1 print:hidden">
                  <button
                    onClick={() => startEdit(p)}
                    disabled={pending}
                    title="ערוך תנועה"
                    className="w-7 h-7 rounded-lg border border-slate-200 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200 flex items-center justify-center transition-colors shrink-0"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => remove(p.id)}
                    disabled={pending}
                    title="מחק תנועה"
                    className="w-7 h-7 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Explicit Add as Transaction Modal */}
      {explicitTxModal && (
        <Dialog
          open={Boolean(explicitTxModal)}
          onOpenChange={(open) => !open && setExplicitTxModal(null)}
        >
          <DialogContent className="max-w-md p-5 bg-white text-slate-800" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                רישום תנועה שבוצעה בפועל
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <p className="text-xs text-slate-500 leading-relaxed">
                התשלום יסומן כבוצע ויירשם כתנועה כספית שבוצעה בפועל. הסכום יתווסף לרשימת התנועות ויקוזז מהיתרה לתשלום.
              </p>

              <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200/80">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600 font-medium">
                    {explicitTxModal.payment.notes || 'תשלום מהלוח'}
                  </span>
                  <span className="font-black text-emerald-700">
                    {fmt(Number(explicitTxModal.payment.amount))}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  תאריך ביצוע התשלום בפועל
                </label>
                <Input
                  type="date"
                  value={explicitTxModal.date}
                  onChange={(e) =>
                    setExplicitTxModal({ ...explicitTxModal, date: e.target.value })
                  }
                  className="h-9 text-sm border-slate-300"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExplicitTxModal(null)}
                className="text-xs text-slate-500"
              >
                ביטול
              </Button>
              <Button
                size="sm"
                disabled={pending}
                onClick={() => {
                  const p = explicitTxModal.payment
                  const d = explicitTxModal.date || new Date().toISOString().slice(0, 10)
                  handleMarkCompletedWithTransaction(p, d)
                  setExplicitTxModal(null)
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5 shadow-xs px-4"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                אישור ורישום תנועה
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
