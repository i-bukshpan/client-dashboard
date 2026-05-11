import { createClient as adminDb } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Eye, MapPin, CalendarDays, TrendingUp, TrendingDown, CheckCircle2, Clock, User, Receipt } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import { cn } from '@/lib/utils'

const db = adminDb(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function fmt(n: number) { return '₪' + n.toLocaleString('he-IL', { maximumFractionDigits: 0 }) }
function fmtD(d: string) { return format(new Date(d), 'dd/MM/yyyy', { locale: he }) }

export const dynamic = 'force-dynamic'

export default async function PreviewPartnerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: partner } = await db
    .from('moshe_partners')
    .select('id, name, email, project_id, portal_access, can_view_payments, can_view_buyers, can_view_transactions, can_view_loans')
    .eq('id', id)
    .single()

  if (!partner) notFound()
  const pr = partner as any

  const C = {
    payments:     !!pr.can_view_payments,
    buyers:       !!pr.can_view_buyers,
    transactions: !!pr.can_view_transactions,
    loans:        !!pr.can_view_loans,
  }

  const projectId = pr.project_id

  const [
    { data: project },
    { data: myTx },
    { data: projPayments },
    { data: buyers },
    { data: buyerPayments },
    { data: transactions },
    { data: loans },
    { data: loanPayments },
  ] = await Promise.all([
    db.from('moshe_projects').select('*').eq('id', projectId).single(),
    db.from('moshe_partner_transactions').select('*').eq('partner_id', pr.id).order('date', { ascending: false }),
    C.payments     ? db.from('moshe_project_payments').select('*').eq('project_id', projectId).order('due_date', { ascending: true, nullsFirst: false }) : Promise.resolve({ data: [] }),
    C.buyers       ? db.from('moshe_buyers').select('*').eq('project_id', projectId).order('created_at') : Promise.resolve({ data: [] }),
    C.buyers       ? db.from('moshe_buyer_payments').select('*').eq('project_id', projectId) : Promise.resolve({ data: [] }),
    C.transactions ? db.from('moshe_transactions').select('*').eq('project_id', projectId).order('date', { ascending: false }) : Promise.resolve({ data: [] }),
    C.loans        ? db.from('moshe_loans').select('*').eq('project_id', projectId).order('created_at') : Promise.resolve({ data: [] }),
    C.loans        ? db.from('moshe_loan_payments').select('*').eq('project_id', projectId) : Promise.resolve({ data: [] }),
  ])

  if (!project) notFound()
  const p = project as any

  const txArr  = (myTx as any[]) ?? []
  const pp     = (projPayments as any[]) ?? []
  const buyArr = (buyers as any[]) ?? []
  const bp     = (buyerPayments as any[]) ?? []
  const txAll  = (transactions as any[]) ?? []
  const lArr   = (loans as any[]) ?? []
  const lp     = (loanPayments as any[]) ?? []

  const invested  = txArr.filter(t => t.type === 'investment').reduce((s, t) => s + Number(t.amount), 0)
  const withdrawn = txArr.filter(t => t.type === 'withdrawal').reduce((s, t) => s + Number(t.amount), 0)
  const balance   = invested - withdrawn

  const buyersWithPay = buyArr.map((b: any) => ({ ...b, payments: bp.filter((pay: any) => pay.buyer_id === b.id) }))
  const loansWithPay  = lArr.map((l: any)  => ({ ...l, payments: lp.filter((pay: any) => pay.loan_id  === l.id)  }))

  const hasExtended = C.payments || C.buyers || C.transactions || C.loans

  const tabs = [
    { value: 'mine',         label: 'ההשקעות שלי',   show: true },
    { value: 'payments',     label: 'לוח תשלומים',    show: C.payments },
    { value: 'buyers',       label: `קונים (${buyArr.length})`,  show: C.buyers },
    { value: 'transactions', label: 'הוצאות/הכנסות', show: C.transactions },
    { value: 'loans',        label: `הלוואות (${lArr.length})`,  show: C.loans },
  ].filter(t => t.show)

  const noPermsAtAll = !pr.portal_access

  return (
    <div className="space-y-4">
      {/* Preview banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-amber-600 shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-800">מצב תצוגה מקדימה — {pr.name}</p>
            <p className="text-xs text-amber-600">
              {noPermsAtAll ? 'גישת פורטל מבוטלת — השותף לא יוכל להיכנס' :
               !hasExtended ? 'רואה רק את ההשקעות האישיות שלו' :
               `רואה: ${[C.payments && 'לוח תשלומים', C.buyers && 'קונים', C.transactions && 'הוצאות/הכנסות', C.loans && 'הלוואות'].filter(Boolean).join(' · ')}`}
            </p>
          </div>
        </div>
        <Link href={`/moshe/projects/${projectId}`}
          className="text-xs text-amber-700 hover:text-amber-900 font-medium border border-amber-200 rounded-lg px-3 py-1.5 flex items-center gap-1 transition-colors">
          <ArrowRight className="w-3 h-3 rotate-180" /> חזרה לפרויקט
        </Link>
      </div>

      {noPermsAtAll && (
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
          <Eye className="w-10 h-10 text-slate-200 mx-auto mb-2" />
          <p className="text-slate-500 font-medium">גישת פורטל לשותף זה מבוטלת</p>
          <p className="text-slate-400 text-sm mt-1">הפעל את הגישה בכרטיסיית השותפים כדי לאפשר כניסה</p>
        </div>
      )}

      {!noPermsAtAll && (
        <>
          {/* Project header */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h1 className="text-xl font-black text-slate-900 mb-1">{p.name}</h1>
                <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                  {p.address    && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{p.address}</span>}
                  {p.start_date && <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" />מ-{fmtD(p.start_date)}</span>}
                </div>
              </div>
              <span className={cn('text-[10px] font-bold px-2 py-1 rounded-full shrink-0',
                p.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                p.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500')}>
                {p.status === 'active' ? 'פעיל' : p.status === 'pending' ? 'ממתין' : 'סגור'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-center">
                <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">ההשקעות שלי</p>
                <p className="text-base font-black text-indigo-700">{fmt(invested)}</p>
              </div>
              <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 text-center">
                <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">המשיכות שלי</p>
                <p className="text-base font-black text-orange-600">{fmt(withdrawn)}</p>
              </div>
              <div className={cn('rounded-xl border p-3 text-center', balance >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100')}>
                <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">המאזן שלי</p>
                <p className={cn('text-base font-black', balance >= 0 ? 'text-emerald-700' : 'text-red-600')}>{fmt(balance)}</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          {hasExtended ? (
            <Tabs defaultValue="mine">
              <div className="bg-white border border-border/50 rounded-2xl p-1 mb-4 shadow-sm max-w-fit">
                <TabsList className="bg-transparent gap-1 flex-wrap">
                  {tabs.map(tab => (
                    <TabsTrigger key={tab.value} value={tab.value}
                      className="rounded-xl px-4 text-sm data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 data-[state=active]:shadow-none font-bold transition-all">
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
              <TabsContent value="mine" className="focus-visible:outline-none"><TxSection txArr={txArr} /></TabsContent>
              {C.payments && <TabsContent value="payments" className="focus-visible:outline-none"><PaySection payments={pp} /></TabsContent>}
              {C.buyers && <TabsContent value="buyers" className="focus-visible:outline-none"><BuyersSection buyers={buyersWithPay} /></TabsContent>}
              {C.transactions && <TabsContent value="transactions" className="focus-visible:outline-none"><FinanceSection transactions={txAll} /></TabsContent>}
              {C.loans && <TabsContent value="loans" className="focus-visible:outline-none"><LoansSection loans={loansWithPay} /></TabsContent>}
            </Tabs>
          ) : (
            <TxSection txArr={txArr} />
          )}
        </>
      )}
    </div>
  )
}

function TxSection({ txArr }: { txArr: any[] }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <p className="text-sm font-bold text-slate-700">תנועות כספיות שלי ({txArr.length})</p>
      </div>
      {txArr.length === 0 ? <p className="text-center text-sm text-slate-400 py-10">אין תנועות</p> : (
        <div className="divide-y divide-slate-50">
          {txArr.map((t: any) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3">
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', t.type === 'investment' ? 'bg-indigo-100' : 'bg-orange-100')}>
                {t.type === 'investment' ? <TrendingUp className="w-4 h-4 text-indigo-600" /> : <TrendingDown className="w-4 h-4 text-orange-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700">{t.notes || (t.type === 'investment' ? 'השקעה' : 'משיכה')}</p>
                <p className="text-[10px] text-slate-400">{fmtD(t.date)}</p>
              </div>
              <p className={cn('font-bold text-sm shrink-0', t.type === 'investment' ? 'text-indigo-700' : 'text-orange-600')}>
                {t.type === 'investment' ? '+' : '-'}{fmt(Number(t.amount))}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PaySection({ payments }: { payments: any[] }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100"><p className="text-sm font-bold text-slate-700">לוח תשלומים ({payments.length})</p></div>
      {payments.length === 0 ? <p className="text-center text-sm text-slate-400 py-10">אין תשלומים</p> : (
        <div className="divide-y divide-slate-50">
          {payments.map((pay: any) => (
            <div key={pay.id} className="flex items-center gap-3 px-4 py-3">
              <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', pay.is_paid ? 'bg-emerald-100' : 'bg-amber-100')}>
                {pay.is_paid ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Clock className="w-4 h-4 text-amber-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">{pay.notes || 'תשלום'}</p>
                <p className="text-[10px] text-slate-400">{pay.due_date ? fmtD(pay.due_date) : 'ללא תאריך'}</p>
              </div>
              <p className={cn('font-bold text-sm shrink-0', pay.is_paid ? 'text-emerald-700' : 'text-amber-600')}>{fmt(Number(pay.amount))}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function BuyersSection({ buyers }: { buyers: any[] }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100"><p className="text-sm font-bold text-slate-700">קונים ({buyers.length})</p></div>
      {buyers.length === 0 ? <p className="text-center text-sm text-slate-400 py-10">אין קונים</p> : (
        <div className="divide-y divide-slate-50">
          {buyers.map((b: any) => {
            const received = b.payments.filter((p: any) => p.is_received).reduce((s: number, p: any) => s + Number(p.amount), 0)
            const total    = b.payments.reduce((s: number, p: any) => s + Number(p.amount), 0)
            return (
              <div key={b.id} className="px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2"><User className="w-3.5 h-3.5 text-slate-400" /><p className="text-sm font-medium text-slate-700">{b.name}</p></div>
                  <p className="text-sm font-bold text-slate-700">{fmt(received)} <span className="text-[10px] text-slate-400 font-normal">/ {fmt(total)}</span></p>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                  <div className="bg-emerald-400 h-1.5 rounded-full" style={{ width: total > 0 ? `${Math.min(100, (received / total) * 100)}%` : '0%' }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FinanceSection({ transactions }: { transactions: any[] }) {
  const income  = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center"><p className="text-[9px] font-bold text-slate-400 uppercase">הכנסות</p><p className="text-base font-black text-emerald-700">{fmt(income)}</p></div>
        <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center"><p className="text-[9px] font-bold text-slate-400 uppercase">הוצאות</p><p className="text-base font-black text-red-600">{fmt(expense)}</p></div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100"><p className="text-sm font-bold text-slate-700">תנועות ({transactions.length})</p></div>
        <div className="divide-y divide-slate-50">
          {transactions.map((t: any) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3">
              <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', t.type === 'income' ? 'bg-emerald-100' : 'bg-red-100')}>
                {t.type === 'income' ? <TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> : <Receipt className="w-3.5 h-3.5 text-red-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">{t.description || (t.type === 'income' ? 'הכנסה' : 'הוצאה')}</p>
                <p className="text-[10px] text-slate-400">{fmtD(t.date)}{t.category && ` · ${t.category}`}</p>
              </div>
              <p className={cn('font-bold text-sm shrink-0', t.type === 'income' ? 'text-emerald-700' : 'text-red-600')}>
                {t.type === 'income' ? '+' : '-'}{fmt(Number(t.amount))}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function LoansSection({ loans }: { loans: any[] }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100"><p className="text-sm font-bold text-slate-700">הלוואות ({loans.length})</p></div>
      {loans.length === 0 ? <p className="text-center text-sm text-slate-400 py-10">אין הלוואות</p> : (
        <div className="divide-y divide-slate-50">
          {loans.map((l: any) => {
            const repaid = l.payments.filter((p: any) => p.is_paid).reduce((s: number, p: any) => s + Number(p.amount), 0)
            const rem    = Number(l.total_amount) - repaid
            return (
              <div key={l.id} className="px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <div><p className="text-sm font-medium text-slate-700">{l.lender_name || 'מלווה'}</p>
                    <p className="text-[10px] text-slate-400">{l.interest_rate && `${l.interest_rate}% · `}{l.start_date && fmtD(l.start_date)}</p>
                  </div>
                  <div className="text-right"><p className="text-sm font-bold text-violet-700">{fmt(Number(l.total_amount))}</p><p className="text-[10px] text-slate-400">נותר: {fmt(rem)}</p></div>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                  <div className="bg-violet-400 h-1.5 rounded-full" style={{ width: l.total_amount > 0 ? `${Math.min(100, (repaid / Number(l.total_amount)) * 100)}%` : '0%' }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
