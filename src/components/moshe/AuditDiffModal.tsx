'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  History,
  RotateCcw,
  Check,
  AlertCircle,
  Clock,
  ArrowRight,
  Layers,
  Sparkles,
  User,
  Calendar,
  X,
} from 'lucide-react'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import { getAuditDiff, undoAuditAction } from '@/app/moshe/actions'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const FIELD_LABELS: Record<string, string> = {
  amount: 'סכום (₪)',
  due_date: 'תאריך יעד',
  paid_at: 'תאריך תשלום בפועל',
  received_at: 'תאריך קבלה בפועל',
  payment_type: 'סוג רשומה',
  notes: 'הערות / אסמכתא',
  name: 'שם',
  phone: 'טלפון',
  email: 'אימייל',
  id_number: 'תעודת זהות',
  unit_description: 'דירה / יחידה',
  contract_date: 'תאריך חוזה',
  total_amount: 'סכום כולל (₪)',
  total_project_cost: 'תקציב פרויקט (₪)',
  category: 'קטגוריה',
  type: 'סוג',
  status: 'סטטוס',
  date: 'תאריך',
  lender: 'מלווה',
  interest_rate: 'ריבית (%)',
  num_payments: 'מספר תשלומים',
  start_date: 'תאריך התחלה',
  end_date: 'תאריך סיום',
  address: 'כתובת',
  contact_name: 'איש קשר',
  contact_phone: 'טלפון איש קשר',
  is_paid: 'סטטוס שולם',
  is_received: 'סטטוס התקבל',
  action: 'פעולה',
  actor: 'מבצע',
  details: 'פרטים',
  title: 'כותרת',
}

const ENTITY_LABELS: Record<string, string> = {
  project: 'פרויקט',
  buyer: 'קונה',
  transaction: 'עסקה (הוצאה/הכנסה)',
  partner: 'שותף',
  partner_transaction: 'תנועת שותף',
  loan: 'הלוואה',
  loan_payment: 'תשלום הלוואה',
  loan_receipt: 'קבלה על הלוואה',
  payment: 'תשלום / תנועת פרויקט',
  buyer_payment: 'תשלום / תנועת קונה',
  neighbor: 'שכן',
  neighbor_payment: 'תשלום שכן',
  document: 'מסמך',
  log: 'רשומת יומן',
  worker: 'עובד',
  worker_log: 'יומן עובד',
}

const ACTION_LABELS: Record<string, { label: string; color: string; badge: string }> = {
  create: { label: 'יצירה', color: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  update: { label: 'עדכון / עריכה', color: 'text-blue-700', badge: 'bg-blue-100 text-blue-800 border-blue-200' },
  delete: { label: 'מחיקה', color: 'text-red-700', badge: 'bg-red-100 text-red-800 border-red-200' },
  restore: { label: 'שחזור', color: 'text-purple-700', badge: 'bg-purple-100 text-purple-800 border-purple-200' },
}

function formatValue(key: string, val: unknown): string {
  if (val === null || val === undefined || val === '') return '—'
  if (typeof val === 'boolean') return val ? 'כן' : 'לא'

  if (key === 'amount' || key === 'total_amount' || key === 'total_project_cost') {
    return '₪' + Number(val).toLocaleString('he-IL', { maximumFractionDigits: 0 })
  }

  if (key === 'payment_type') {
    if (val === 'schedule') return 'לוח תשלומים (מתוכנן)'
    if (val === 'movement') return 'תנועה שבוצעה בפועל'
  }

  if (
    key === 'due_date' ||
    key === 'paid_at' ||
    key === 'received_at' ||
    key === 'date' ||
    key === 'contract_date' ||
    key === 'start_date' ||
    key === 'end_date'
  ) {
    try {
      const d = new Date(String(val))
      if (!isNaN(d.getTime())) {
        return format(d, 'dd/MM/yyyy')
      }
    } catch {
      // fallback
    }
  }

  return String(val)
}

interface Props {
  auditId: string | null
  onClose: () => void
  onRestored?: () => void
}

export function AuditDiffModal({ auditId, onClose, onRestored }: Props) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!auditId) {
      setData(null)
      return
    }

    setLoading(true)
    getAuditDiff(auditId)
      .then((res) => {
        if (res.error) toast.error(res.error)
        else setData(res)
      })
      .catch(() => toast.error('שגיאה בטעינת נתוני ההשוואה'))
      .finally(() => setLoading(false))
  }, [auditId])

  function handleRestore() {
    if (!auditId) return
    if (!confirm('האם אתה בטוח שברצונך לשחזר את הנתונים למצב שהיה לפני פעולה זו?')) return

    startTransition(async () => {
      const r = await undoAuditAction(auditId)
      if (r.error) {
        toast.error(r.error)
      } else {
        toast.success('הנתונים שוחזרו בהצלחה למצב הקודם!')
        onRestored?.()
        onClose()
      }
    })
  }

  if (!auditId) return null

  const audit = data?.audit
  const prev = data?.previousSnapshot
  const next = data?.newSnapshot
  const curr = data?.currentRecord

  const action = audit ? ACTION_LABELS[audit.action_type] ?? { label: audit.action_type, color: 'text-slate-700', badge: 'bg-slate-100 text-slate-700 border-slate-200' } : null
  const entityName = audit ? ENTITY_LABELS[audit.entity_type] ?? audit.entity_type : ''

  // Collect all relevant keys to compare
  const ignoredKeys = new Set(['id', 'created_at', 'project_id', 'buyer_id', 'partner_id', 'neighbor_id', 'loan_id'])
  const allKeys = Array.from(
    new Set([
      ...Object.keys(prev || {}),
      ...Object.keys(next || {}),
      ...Object.keys(curr || {}),
    ])
  ).filter((k) => !ignoredKeys.has(k))

  return (
    <Dialog open={Boolean(auditId)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 bg-white text-slate-800" dir="rtl">
        <DialogHeader className="p-5 border-b border-slate-100 sticky top-0 bg-white/95 backdrop-blur-xs z-10">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-black text-slate-900 flex items-center gap-2">
              <History className="w-5 h-5 text-violet-600" />
              השוואת גרסאות ושחזור נתונים
            </DialogTitle>
          </div>
          {audit && (
            <div className="flex items-center gap-2.5 mt-2 flex-wrap text-xs">
              <span className={cn('px-2.5 py-0.5 rounded-full font-bold border text-[11px]', action?.badge)}>
                {action?.label}
              </span>
              <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full font-bold text-[11px]">
                {entityName}
              </span>
              <span className="text-slate-400 flex items-center gap-1">
                <User className="w-3 h-3" />
                {audit.user_email || 'משה'}
              </span>
              <span className="text-slate-400 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {format(new Date(audit.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: he })}
              </span>
            </div>
          )}
        </DialogHeader>

        <div className="p-5 space-y-5">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-sm space-y-2">
              <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p>טוען נתוני השוואה והיסטוריה...</p>
            </div>
          ) : !audit ? (
            <div className="py-8 text-center text-slate-400 text-sm">לא נמצאו פרטים על פעולה זו.</div>
          ) : (
            <>
              {/* Description banner */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs text-slate-700 leading-relaxed">
                <p className="font-bold text-slate-900 mb-0.5">תיאור הפעולה שנרשמה:</p>
                <p>{audit.description}</p>
              </div>

              {/* Status indicator */}
              {audit.is_undone && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 flex items-center gap-2 text-xs text-purple-800 font-semibold">
                  <Check className="w-4 h-4 text-purple-600 shrink-0" />
                  <span>
                    פעולה זו שוחזרה כבר בעבר
                    {audit.undone_at && ` בתאריך ${format(new Date(audit.undone_at), 'dd/MM/yyyy HH:mm')}`}.
                  </span>
                </div>
              )}

              {/* Diff Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="px-4 py-2.5 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>השוואת שדות (לפני השינוי ➔ אחרי השינוי ➔ המצב כעת)</span>
                  <span className="text-[10px] text-slate-400 font-normal">שדות ששונו מודגשים ברקע</span>
                </div>

                <div className="divide-y divide-slate-100 overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-slate-50/50 text-[11px] text-slate-500 border-b border-slate-100">
                        <th className="py-2 px-3 font-bold w-1/4">שדה</th>
                        <th className="py-2 px-3 font-bold w-1/4">מה שהיה (לפני השינוי)</th>
                        <th className="py-2 px-3 font-bold w-1/4">מה ששונה (בפעולה זו)</th>
                        <th className="py-2 px-3 font-bold w-1/4">המצב במערכת כעת</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {allKeys.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-slate-400">
                            אין שדות להשוואה ישירה (רשומת יצירה ללא שדות מורכבים או נתונים פשוטים).
                          </td>
                        </tr>
                      ) : (
                        allKeys.map((k) => {
                          const oldV = prev ? prev[k] : undefined
                          const newV = next ? next[k] : undefined
                          const curV = curr ? curr[k] : undefined

                          const isChanged = oldV !== newV && prev !== null && next !== null
                          const isDifferentFromCurrent = curV !== undefined && (audit.action_type === 'delete' || curV !== oldV)

                          return (
                            <tr
                              key={k}
                              className={cn(
                                'transition-colors',
                                isChanged ? 'bg-amber-50/40 hover:bg-amber-50/60 font-medium' : 'hover:bg-slate-50/50'
                              )}
                            >
                              <td className="py-2.5 px-3 font-bold text-slate-800">
                                {FIELD_LABELS[k] ?? k}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600">
                                {prev ? (
                                  formatValue(k, oldV)
                                ) : (
                                  <span className="text-slate-300 italic">לא היה קיים</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3">
                                {next ? (
                                  <span className={cn(isChanged ? 'text-amber-800 font-bold' : 'text-slate-600')}>
                                    {formatValue(k, newV)}
                                  </span>
                                ) : (
                                  <span className="text-red-500 font-bold">נמחק</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3">
                                {curr ? (
                                  <span className="text-emerald-700 font-semibold">{formatValue(k, curV)}</span>
                                ) : (
                                  <span className="text-slate-400 italic">אינו קיים במערכת (נמחק)</span>
                                )}
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between gap-3 sticky bottom-0">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs h-9">
            סגור / השאר מצב נוכחי
          </Button>

          {audit && !audit.is_undone && (
            <Button
              size="sm"
              onClick={handleRestore}
              disabled={pending || loading}
              className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs gap-1.5 h-9 shadow-xs px-4"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {pending ? 'משחזר נתונים...' : 'שחזר למצב הקודם'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
