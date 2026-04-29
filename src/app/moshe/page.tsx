import { createClient } from '@supabase/supabase-js'
import { format, isBefore, addDays } from 'date-fns'
import { he } from 'date-fns/locale'
import { TrendingUp, TrendingDown, Wallet, AlertTriangle, Calendar, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function fmt(n: number) {
  return '₪' + n.toLocaleString('he-IL', { maximumFractionDigits: 0 })
}

export const dynamic = 'force-dynamic'
export const metadata = { title: 'דשבורד | משה פרוש' }

export default async function MosheDashboard() {
  const [
    { data: projects },
    { data: projPayments },
    { data: buyerPayments },
    { data: transactions },
  ] = await Promise.all([
    db.from('moshe_projects').select('*').neq('status', 'closed'),
    db.from('moshe_project_payments').select('*'),
    db.from('moshe_buyer_payments').select('*'),
    db.from('moshe_transactions').select('*'),
  ])

  const pp = (projPayments as any[]) ?? []
  const bp = (buyerPayments as any[]) ?? []
  const tx = (transactions as any[]) ?? []
  const proj = (projects as any[]) ?? []

  // KPIs
  const totalPaid = pp.filter(p => p.is_paid).reduce((s: number, p: any) => s + Number(p.amount), 0)
    + tx.filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + Number(t.amount), 0)

  const totalReceived = bp.filter(p => p.is_received).reduce((s: number, p: any) => s + Number(p.amount), 0)
    + tx.filter((t: any) => t.type === 'income').reduce((s: number, t: any) => s + Number(t.amount), 0)

  const totalScheduledExpenses = pp.reduce((s: number, p: any) => s + Number(p.amount), 0)
  const totalScheduledIncome = bp.reduce((s: number, p: any) => s + Number(p.amount), 0)

  const realBalance = totalReceived - totalPaid
  const expectedBalance = totalScheduledIncome - totalScheduledExpenses

  // Upcoming 14 days
  const today = new Date()
  const in14 = addDays(today, 14)
  const yesterday = addDays(today, -1)

  const upcomingExpenses = pp
    .filter((p: any) => !p.is_paid && p.due_date && isBefore(new Date(p.due_date), in14))
    .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
    .slice(0, 6)

  const upcomingIncome = bp
    .filter((p: any) => !p.is_received && p.due_date && isBefore(new Date(p.due_date), in14))
    .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
    .slice(0, 6)

  const overdueExpenses = pp.filter((p: any) => !p.is_paid && p.due_date && isBefore(new Date(p.due_date), today))
  const overdueIncome = bp.filter((p: any) => !p.is_received && p.due_date && isBefore(new Date(p.due_date), today))
  const overdueCount = overdueExpenses.length + overdueIncome.length

  // Project map for names
  const projectMap: Record<string, string> = {}
  proj.forEach((p: any) => { projectMap[p.id] = p.name })

  // Buyer map
  const { data: buyers } = await db.from('moshe_buyers').select('id, name, project_id')
  const buyerMap: Record<string, string> = {}
  ;(buyers as any[] ?? []).forEach((b: any) => { buyerMap[b.id] = b.name })

  // Insights: per-project collection stats
  const in30 = addDays(today, 30)
  const projectInsights = proj.map((p: any) => {
    const bRecv    = bp.filter((x: any) => x.project_id === p.id && x.is_received).reduce((s: number, x: any) => s + Number(x.amount), 0)
    const bTotal   = bp.filter((x: any) => x.project_id === p.id).reduce((s: number, x: any) => s + Number(x.amount), 0)
    const pPaid    = pp.filter((x: any) => x.project_id === p.id && x.is_paid).reduce((s: number, x: any) => s + Number(x.amount), 0)
    const overdue  = pp.filter((x: any) => x.project_id === p.id && !x.is_paid && x.due_date && isBefore(new Date(x.due_date), today)).reduce((s: number, x: any) => s + Number(x.amount), 0)
      + bp.filter((x: any) => x.project_id === p.id && !x.is_received && x.due_date && isBefore(new Date(x.due_date), today)).reduce((s: number, x: any) => s + Number(x.amount), 0)
    const next30In = bp.filter((x: any) => x.project_id === p.id && !x.is_received && x.due_date && !isBefore(new Date(x.due_date), today) && isBefore(new Date(x.due_date), in30)).reduce((s: number, x: any) => s + Number(x.amount), 0)
    const next30Ex = pp.filter((x: any) => x.project_id === p.id && !x.is_paid && x.due_date && !isBefore(new Date(x.due_date), today) && isBefore(new Date(x.due_date), in30)).reduce((s: number, x: any) => s + Number(x.amount), 0)
    const pct      = bTotal > 0 ? Math.round((bRecv / bTotal) * 100) : 0
    return { id: p.id, name: p.name, pct, bRecv, bTotal, pPaid, overdue, next30In, next30Ex, realBalance: bRecv - pPaid }
  }).sort((a: any, b: any) => b.overdue - a.overdue)

  const totalNext30In  = projectInsights.reduce((s: number, p: any) => s + p.next30In, 0)
  const totalNext30Ex  = projectInsights.reduce((s: number, p: any) => s + p.next30Ex, 0)
  const totalOverdue   = projectInsights.reduce((s: number, p: any) => s + p.overdue, 0)

  const kpis = [
    {
      label: 'תזרים אמיתי',
      value: fmt(realBalance),
      sub: 'הכנסות בפועל מול הוצאות ששולמו',
      color: realBalance >= 0 ? 'text-emerald-600' : 'text-red-600',
      bg: realBalance >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100',
      icon: realBalance >= 0 ? TrendingUp : TrendingDown,
      iconColor: realBalance >= 0 ? 'text-emerald-500' : 'text-red-500',
    },
    {
      label: 'תזרים צפוי',
      value: fmt(expectedBalance),
      sub: 'לפי לוחות התשלומים',
      color: expectedBalance >= 0 ? 'text-blue-600' : 'text-orange-600',
      bg: 'bg-blue-50 border-blue-100',
      icon: Wallet,
      iconColor: 'text-blue-500',
    },
    {
      label: 'הכנסות שנגבו',
      value: fmt(totalReceived),
      sub: `מתוך ${fmt(totalScheduledIncome)} צפוי`,
      color: 'text-emerald-700',
      bg: 'bg-emerald-50 border-emerald-100',
      icon: TrendingUp,
      iconColor: 'text-emerald-500',
    },
    {
      label: 'הוצאות ששולמו',
      value: fmt(totalPaid),
      sub: `מתוך ${fmt(totalScheduledExpenses)} צפוי`,
      color: 'text-slate-700',
      bg: 'bg-slate-50 border-slate-200',
      icon: TrendingDown,
      iconColor: 'text-slate-500',
    },
  ]

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-black text-slate-900">דשבורד</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {format(today, "EEEE, d בMMMM yyyy", { locale: he })}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(kpi => (
          <div key={kpi.label} className={`rounded-2xl border p-4 ${kpi.bg}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{kpi.label}</p>
              <kpi.icon className={`w-4 h-4 ${kpi.iconColor}`} />
            </div>
            <p className={`text-xl font-black leading-none ${kpi.color}`}>{kpi.value}</p>
            <p className="text-[10px] text-slate-400 mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Overdue alert */}
      {overdueCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-red-800 text-sm">
              {overdueCount} תשלומים באיחור
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              {overdueExpenses.length > 0 && `${overdueExpenses.length} הוצאות שצריך לשלם`}
              {overdueExpenses.length > 0 && overdueIncome.length > 0 && ' · '}
              {overdueIncome.length > 0 && `${overdueIncome.length} תשלומים לגבייה`}
            </p>
          </div>
          <Link href="/moshe/calendar" className="text-xs text-red-600 hover:text-red-800 font-bold flex items-center gap-1 shrink-0">
            לפירוט <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming expenses */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <p className="text-sm font-bold text-slate-800">הוצאות קרובות</p>
            </div>
            <span className="text-[10px] text-slate-400">14 הימים הקרובים</span>
          </div>
          <div className="divide-y divide-slate-50">
            {upcomingExpenses.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">אין הוצאות קרובות</p>
            ) : upcomingExpenses.map((p: any) => {
              const due = new Date(p.due_date)
              const overdue = isBefore(due, today)
              return (
                <div key={p.id} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex flex-col items-center justify-center shrink-0 text-center',
                      overdue ? 'bg-red-100' : 'bg-amber-50'
                    )}>
                      <span className={cn('text-[9px] font-bold leading-none', overdue ? 'text-red-500' : 'text-amber-500')}>
                        {format(due, 'MMM', { locale: he })}
                      </span>
                      <span className={cn('text-sm font-black leading-none', overdue ? 'text-red-700' : 'text-amber-700')}>
                        {format(due, 'd')}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-700">{projectMap[p.project_id] ?? 'פרויקט'}</p>
                      {p.notes && <p className="text-[10px] text-slate-400">{p.notes}</p>}
                    </div>
                  </div>
                  <span className={cn('text-sm font-black', overdue ? 'text-red-600' : 'text-slate-800')}>
                    {fmt(Number(p.amount))}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Upcoming income */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <p className="text-sm font-bold text-slate-800">הכנסות קרובות</p>
            </div>
            <span className="text-[10px] text-slate-400">14 הימים הקרובים</span>
          </div>
          <div className="divide-y divide-slate-50">
            {upcomingIncome.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">אין הכנסות קרובות</p>
            ) : upcomingIncome.map((p: any) => {
              const due = new Date(p.due_date)
              const overdue = isBefore(due, today)
              return (
                <div key={p.id} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex flex-col items-center justify-center shrink-0',
                      overdue ? 'bg-red-100' : 'bg-emerald-50'
                    )}>
                      <span className={cn('text-[9px] font-bold leading-none', overdue ? 'text-red-500' : 'text-emerald-500')}>
                        {format(due, 'MMM', { locale: he })}
                      </span>
                      <span className={cn('text-sm font-black leading-none', overdue ? 'text-red-700' : 'text-emerald-700')}>
                        {format(due, 'd')}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-700">{buyerMap[p.buyer_id] ?? 'קונה'}</p>
                      {p.notes && <p className="text-[10px] text-slate-400">{p.notes}</p>}
                    </div>
                  </div>
                  <span className={cn('text-sm font-black', overdue ? 'text-red-600' : 'text-emerald-700')}>
                    {fmt(Number(p.amount))}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Active projects summary */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-slate-700">פרויקטים פעילים</p>
          <Link href="/moshe/projects" className="text-xs text-amber-600 hover:text-amber-700 font-bold flex items-center gap-1">
            כל הפרויקטים <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {proj.slice(0, 6).map((p: any) => {
            const pPaid = pp.filter((pay: any) => pay.project_id === p.id && pay.is_paid)
              .reduce((s: number, pay: any) => s + Number(pay.amount), 0)
            const pTotal = pp.filter((pay: any) => pay.project_id === p.id)
              .reduce((s: number, pay: any) => s + Number(pay.amount), 0)
            const bReceived = bp.filter((pay: any) => pay.project_id === p.id && pay.is_received)
              .reduce((s: number, pay: any) => s + Number(pay.amount), 0)
            const bTotal = bp.filter((pay: any) => pay.project_id === p.id)
              .reduce((s: number, pay: any) => s + Number(pay.amount), 0)
            const balance = bReceived - pPaid
            const pct = bTotal > 0 ? Math.round((bReceived / bTotal) * 100) : 0

            return (
              <Link key={p.id} href={`/moshe/projects/${p.id}`}
                className="bg-white rounded-2xl border border-slate-100 p-4 hover:border-amber-200 hover:shadow-sm transition-all"
              >
                <p className="font-bold text-sm text-slate-900 mb-0.5 truncate">{p.name}</p>
                <p className="text-[10px] text-slate-400 mb-3 truncate">{p.address ?? 'כתובת לא הוזנה'}</p>
                <div className="w-full h-1.5 bg-slate-100 rounded-full mb-1">
                  <div className="h-1.5 bg-amber-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">גבייה {pct}%</span>
                  <span className={cn('text-xs font-black', balance >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                    {fmt(balance)}
                  </span>
                </div>
              </Link>
            )
          })}
          {proj.length === 0 && (
            <Link href="/moshe/projects/new"
              className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-6 text-center hover:border-amber-300 transition-colors col-span-3"
            >
              <p className="text-sm text-slate-400">אין פרויקטים פעילים</p>
              <p className="text-xs text-amber-500 mt-1 font-medium">+ צור פרויקט ראשון</p>
            </Link>
          )}
        </div>
      </div>

      {/* Insights */}
      {proj.length > 0 && (
        <div>
          <p className="text-sm font-bold text-slate-700 mb-3">תובנות</p>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Collection rates */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">שיעור גבייה לפי פרויקט</p>
              <div className="space-y-3">
                {[...projectInsights].sort((a: any, b: any) => b.pct - a.pct).map((p: any) => (
                  <div key={p.id}>
                    <div className="flex items-center justify-between mb-1">
                      <Link href={`/moshe/projects/${p.id}`} className="text-xs font-medium text-slate-700 hover:text-amber-600 truncate max-w-[140px]">
                        {p.name}
                      </Link>
                      <span className={cn('text-xs font-black', p.pct >= 80 ? 'text-emerald-600' : p.pct >= 50 ? 'text-amber-600' : 'text-red-600')}>
                        {p.pct}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full">
                      <div className={cn('h-1.5 rounded-full transition-all', p.pct >= 80 ? 'bg-emerald-400' : p.pct >= 50 ? 'bg-amber-400' : 'bg-red-400')}
                        style={{ width: `${p.pct}%` }} />
                    </div>
                    <div className="flex justify-between mt-0.5">
                      <span className="text-[10px] text-slate-400">{fmt(p.bRecv)}</span>
                      <span className="text-[10px] text-slate-400">מתוך {fmt(p.bTotal)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Next 30 days cash flow */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">תזרים 30 הימים הקרובים</p>
              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl">
                  <span className="text-xs text-emerald-600 font-medium">הכנסות צפויות</span>
                  <span className="text-sm font-black text-emerald-700">{fmt(totalNext30In)}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl">
                  <span className="text-xs text-red-600 font-medium">הוצאות צפויות</span>
                  <span className="text-sm font-black text-red-700">{fmt(totalNext30Ex)}</span>
                </div>
                <div className={cn('flex items-center justify-between p-3 rounded-xl', (totalNext30In - totalNext30Ex) >= 0 ? 'bg-blue-50' : 'bg-orange-50')}>
                  <span className={cn('text-xs font-bold', (totalNext30In - totalNext30Ex) >= 0 ? 'text-blue-600' : 'text-orange-600')}>נטו</span>
                  <span className={cn('text-sm font-black', (totalNext30In - totalNext30Ex) >= 0 ? 'text-blue-700' : 'text-orange-700')}>
                    {fmt(totalNext30In - totalNext30Ex)}
                  </span>
                </div>
              </div>
              <div className="space-y-1.5">
                {projectInsights.filter((p: any) => p.next30In + p.next30Ex > 0).map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between text-xs">
                    <Link href={`/moshe/projects/${p.id}`} className="text-slate-600 hover:text-amber-600 truncate max-w-[130px]">{p.name}</Link>
                    <span className={cn('font-bold', (p.next30In - p.next30Ex) >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                      {fmt(p.next30In - p.next30Ex)}
                    </span>
                  </div>
                ))}
                {projectInsights.filter((p: any) => p.next30In + p.next30Ex > 0).length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-2">אין תשלומים ב-30 הימים הקרובים</p>
                )}
              </div>
            </div>

            {/* Overdue / at risk */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
                פרויקטים בסיכון
                {totalOverdue > 0 && <span className="text-red-500 mr-1">· {fmt(totalOverdue)} באיחור</span>}
              </p>
              <div className="space-y-3">
                {projectInsights.filter((p: any) => p.overdue > 0 || p.pct < 50).map((p: any) => (
                  <div key={p.id} className="flex items-start gap-3">
                    <div className={cn(
                      'w-2 h-2 rounded-full mt-1.5 shrink-0',
                      p.overdue > 0 ? 'bg-red-400' : 'bg-amber-400'
                    )} />
                    <div className="flex-1 min-w-0">
                      <Link href={`/moshe/projects/${p.id}`} className="text-xs font-bold text-slate-700 hover:text-amber-600 truncate block">
                        {p.name}
                      </Link>
                      <div className="text-[10px] text-slate-400 mt-0.5 space-y-0.5">
                        {p.overdue > 0 && <p className="text-red-500 font-medium">{fmt(p.overdue)} באיחור</p>}
                        {p.pct < 50 && p.bTotal > 0 && <p>גבייה {p.pct}% בלבד</p>}
                      </div>
                    </div>
                    <span className={cn('text-xs font-black shrink-0', p.realBalance >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                      {fmt(p.realBalance)}
                    </span>
                  </div>
                ))}
                {projectInsights.filter((p: any) => p.overdue > 0 || p.pct < 50).length === 0 && (
                  <div className="text-center py-6">
                    <p className="text-2xl mb-1">✓</p>
                    <p className="text-xs text-slate-400">כל הפרויקטים תקינים</p>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
