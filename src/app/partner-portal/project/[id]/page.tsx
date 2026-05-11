import { createClient } from '@/lib/supabase/server'
import { createClient as adminDb } from '@supabase/supabase-js'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, MapPin, CalendarDays, TrendingUp, TrendingDown, DollarSign, CheckCircle2, Clock, User, CreditCard, Receipt, Banknote } from 'lucide-react'
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

export default async function PartnerProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: partnerRow } = await db
    .from('moshe_partners')
    .select('id, name, portal_access, can_view_payments, can_view_buyers, can_view_transactions, can_view_loans')
    .eq('email', user.email)
    .eq('project_id', id)
    .eq('portal_access', true)
    .single()

  if (!partnerRow) notFound()

  const pr = partnerRow as any
  const C = {
    payments:     !!pr.can_view_payments,
    buyers:       !!pr.can_view_buyers,
    transactions: !!pr.can_view_transactions,
    loans:        !!pr.can_view_loans,
  }

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
    db.from('moshe_projects').select('*').eq('id', id).single(),
    db.from('moshe_partner_transactions').select('*').eq('partner_id', pr.id).order('date', { ascending: false }),
    C.payments     ? db.from('moshe_project_payments').select('*').eq('project_id', id).order('due_date', { ascending: true, nullsFirst: false }) : Promise.resolve({ data: [] }),
    C.buyers       ? db.from('moshe_buyers').select('*').eq('project_id', id).order('created_at') : Promise.resolve({ data: [] }),
    C.buyers       ? db.from('moshe_buyer_payments').select('*').eq('project_id', id) : Promise.resolve({ data: [] }),
    C.transactions ? db.from('moshe_transactions').select('*').eq('project_id', id).order('date', { ascending: false }) : Promise.resolve({ data: [] }),
    C.loans        ? db.from('moshe_loans').select('*').eq('project_id', id).order('created_at') : Promise.resolve({ data: [] }),
    C.loans        ? db.from('moshe_loan_payments').select('*').eq('project_id', id) : Promise.resolve({ data: [] }),
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

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Link href="/partner-portal" className="hover:text-slate-600 transition-colors">הפרויקטים שלי</Link>
        <ArrowRight className="w-4 h-4 rotate-180" />
        <span className="text-slate-700 font-medium">{p.name}</span>
      </div>

      {/* Project header */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl font-black text-slate-900 mb-1">{p.name}</h1>
            <div className="flex flex-wrap gap-4 text-xs text-slate-400">
              {p.address   && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{p.address}</span>}
              {p.start_date && <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" />מ-{fmtD(p.start_date)}</span>}
            </div>
          </div>
          <span className={cn('text-[10px] font-bold px-2 py-1 rounded-full shrink-0',
            p.status === 'active'  ? 'bg-emerald-100 text-emerald-700' :
            p.status === 'pending' ? 'bg-amber-100 text-amber-700' :
            'bg-slate-100 text-slate-500')}>
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

          <TabsContent value="mine" className="focus-visible:outline-none">
            <MyTransactionsSection txArr={txArr} />
          </TabsContent>
          {C.payments && (
            <TabsContent value="payments" className="focus-visible:outline-none">
              <PaymentsSection payments={pp} />
            </TabsContent>
          )}
          {C.buyers && (
            <TabsContent value="buyers" className="focus-visible:outline-none">
              <BuyersSection buyers={buyersWithPay} />
            </TabsContent>
          )}
          {C.transactions && (
            <TabsContent value="transactions" className="focus-visible:outline-none">
              <TransactionsSection transactions={txAll} />
            </TabsContent>
          )}
          {C.loans && (
            <TabsContent value="loans" className="focus-visible:outline-none">
              <LoansSection loans={loansWithPay} />
            </TabsContent>
          )}
        </Tabs>
      ) : (
        <MyTransactionsSection txArr={txArr} />
      )}
    </div>
  )
}

// ─── Section components ────────────────────────────────────────────

function MyTransactionsSection({ txArr }: { txArr: any[] }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <p className="text-sm font-bold text-slate-700">תנועות כספיות שלי ({txArr.length})</p>
      </div>
      {txArr.length === 0 ? (
        <p className="text-center text-sm text-slate-400 py-10">אין תנועות עדיין</p>
      ) : (
        <div className="divide-y divide-slate-50">
          {txArr.map((t: any) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3">
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                t.type === 'investment' ? 'bg-indigo-100' : 'bg-orange-100')}>
                {t.type === 'investment'
                  ? <TrendingUp className="w-4 h-4 text-indigo-600" />
                  : <TrendingDown className="w-4 h-4 text-orange-500" />}
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

function PaymentsSection({ payments }: { payments: any[] }) {
  const paid   = payments.filter(p => p.is_paid)
  const unpaid = payments.filter(p => !p.is_paid)
  const totalPaid   = paid.reduce((s, p) => s + Number(p.amount), 0)
  const totalUnpaid = unpaid.reduce((s, p) => s + Number(p.amount), 0)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
          <p className="text-[9px] font-bold text-slate-400 uppercase">שולם</p>
          <p className="text-base font-black text-emerald-700">{fmt(totalPaid)}</p>
          <p className="text-[10px] text-slate-400">{paid.length} תשלומים</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
          <p className="text-[9px] font-bold text-slate-400 uppercase">ממתין לתשלום</p>
          <p className="text-base font-black text-amber-600">{fmt(totalUnpaid)}</p>
          <p className="text-[10px] text-slate-400">{unpaid.length} תשלומים</p>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <p className="text-sm font-bold text-slate-700">לוח תשלומים ({payments.length})</p>
        </div>
        {payments.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-10">אין תשלומים מתוכננים</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {payments.map((pay: any) => (
              <div key={pay.id} className="flex items-center gap-3 px-4 py-3">
                <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                  pay.is_paid ? 'bg-emerald-100' : 'bg-amber-100')}>
                  {pay.is_paid
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    : <Clock className="w-4 h-4 text-amber-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{pay.notes || 'תשלום'}</p>
                  <p className="text-[10px] text-slate-400">{pay.due_date ? fmtD(pay.due_date) : 'ללא תאריך יעד'}</p>
                </div>
                <p className={cn('font-bold text-sm shrink-0', pay.is_paid ? 'text-emerald-700' : 'text-amber-600')}>
                  {fmt(Number(pay.amount))}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function BuyersSection({ buyers }: { buyers: any[] }) {
  const totalExpected = buyers.reduce((s, b) => s + b.payments.reduce((ss: number, p: any) => ss + Number(p.amount), 0), 0)
  const totalReceived = buyers.reduce((s, b) => s + b.payments.filter((p: any) => p.is_received).reduce((ss: number, p: any) => ss + Number(p.amount), 0), 0)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
          <p className="text-[9px] font-bold text-slate-400 uppercase">התקבל מקונים</p>
          <p className="text-base font-black text-emerald-700">{fmt(totalReceived)}</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
          <p className="text-[9px] font-bold text-slate-400 uppercase">סה"כ צפוי</p>
          <p className="text-base font-black text-blue-700">{fmt(totalExpected)}</p>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <p className="text-sm font-bold text-slate-700">קונים ({buyers.length})</p>
        </div>
        {buyers.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-10">אין קונים רשומים</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {buyers.map((b: any) => {
              const received = b.payments.filter((p: any) => p.is_received).reduce((s: number, p: any) => s + Number(p.amount), 0)
              const total    = b.payments.reduce((s: number, p: any) => s + Number(p.amount), 0)
              return (
                <div key={b.id} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <p className="text-sm font-medium text-slate-700">{b.name}</p>
                    </div>
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
    </div>
  )
}

function TransactionsSection({ transactions }: { transactions: any[] }) {
  const income  = transactions.filter(t => t.type === 'income')
  const expense = transactions.filter(t => t.type === 'expense')
  const totalIn  = income.reduce((s, t) => s + Number(t.amount), 0)
  const totalOut = expense.reduce((s, t) => s + Number(t.amount), 0)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
          <p className="text-[9px] font-bold text-slate-400 uppercase">הכנסות</p>
          <p className="text-base font-black text-emerald-700">{fmt(totalIn)}</p>
          <p className="text-[10px] text-slate-400">{income.length} רשומות</p>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
          <p className="text-[9px] font-bold text-slate-400 uppercase">הוצאות</p>
          <p className="text-base font-black text-red-600">{fmt(totalOut)}</p>
          <p className="text-[10px] text-slate-400">{expense.length} רשומות</p>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <p className="text-sm font-bold text-slate-700">כל התנועות ({transactions.length})</p>
        </div>
        {transactions.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-10">אין תנועות</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {transactions.map((t: any) => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                  t.type === 'income' ? 'bg-emerald-100' : 'bg-red-100')}>
                  {t.type === 'income'
                    ? <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                    : <Receipt className="w-3.5 h-3.5 text-red-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{t.description || (t.type === 'income' ? 'הכנסה' : 'הוצאה')}</p>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <span>{fmtD(t.date)}</span>
                    {t.category && <><span>·</span><span>{t.category}</span></>}
                  </div>
                </div>
                <p className={cn('font-bold text-sm shrink-0', t.type === 'income' ? 'text-emerald-700' : 'text-red-600')}>
                  {t.type === 'income' ? '+' : '-'}{fmt(Number(t.amount))}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function LoansSection({ loans }: { loans: any[] }) {
  const totalLoans   = loans.reduce((s, l) => s + Number(l.total_amount), 0)
  const totalRepaid  = loans.reduce((s, l) => s + l.payments.filter((p: any) => p.is_paid).reduce((ss: number, p: any) => ss + Number(p.amount), 0), 0)
  const remaining    = totalLoans - totalRepaid

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 text-center">
          <p className="text-[9px] font-bold text-slate-400 uppercase">סה"כ הלוואות</p>
          <p className="text-base font-black text-violet-700">{fmt(totalLoans)}</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
          <p className="text-[9px] font-bold text-slate-400 uppercase">הוחזר</p>
          <p className="text-base font-black text-emerald-700">{fmt(totalRepaid)}</p>
        </div>
        <div className={cn('rounded-xl border p-3 text-center', remaining > 0 ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100')}>
          <p className="text-[9px] font-bold text-slate-400 uppercase">יתרה לתשלום</p>
          <p className={cn('text-base font-black', remaining > 0 ? 'text-amber-600' : 'text-slate-500')}>{fmt(remaining)}</p>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <p className="text-sm font-bold text-slate-700">הלוואות ({loans.length})</p>
        </div>
        {loans.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-10">אין הלוואות</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {loans.map((l: any) => {
              const repaid = l.payments.filter((p: any) => p.is_paid).reduce((s: number, p: any) => s + Number(p.amount), 0)
              const rem    = Number(l.total_amount) - repaid
              return (
                <div key={l.id} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <p className="text-sm font-medium text-slate-700">{l.lender_name || 'מלווה'}</p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                        {l.interest_rate && <span>{l.interest_rate}% ריבית</span>}
                        {l.start_date && <span>מ-{fmtD(l.start_date)}</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-violet-700">{fmt(Number(l.total_amount))}</p>
                      <p className="text-[10px] text-slate-400">נותר: {fmt(rem)}</p>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div className="bg-violet-400 h-1.5 rounded-full"
                      style={{ width: l.total_amount > 0 ? `${Math.min(100, (repaid / Number(l.total_amount)) * 100)}%` : '0%' }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
