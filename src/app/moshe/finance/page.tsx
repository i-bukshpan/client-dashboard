import { createClient } from '@supabase/supabase-js'
import { TrendingUp, TrendingDown, Wallet, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FinanceFilters } from '@/components/moshe/FinanceFilters'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function fmt(n: number) {
  return '₪' + n.toLocaleString('he-IL', { maximumFractionDigits: 0 })
}

export const dynamic = 'force-dynamic'
export const metadata = { title: 'מאזן כספי | משה פרוש' }

export default async function FinancePage() {
  const [
    { data: projects },
    { data: projPayments },
    { data: buyerPayments },
    { data: transactions },
  ] = await Promise.all([
    db.from('moshe_projects').select('id, name, status').order('created_at'),
    db.from('moshe_project_payments').select('project_id, amount, is_paid'),
    db.from('moshe_buyer_payments').select('project_id, amount, is_received'),
    db.from('moshe_transactions').select('id, project_id, type, amount, date, category, notes'),
  ])

  const proj = (projects as any[]) ?? []
  const pp   = (projPayments as any[]) ?? []
  const bp   = (buyerPayments as any[]) ?? []
  const tx   = (transactions as any[]) ?? []

  // Company-wide totals
  const totalPaid     = pp.filter((x: any) => x.is_paid).reduce((s: number, x: any) => s + Number(x.amount), 0)
  const totalScheduled = pp.reduce((s: number, x: any) => s + Number(x.amount), 0)
  const totalReceived  = bp.filter((x: any) => x.is_received).reduce((s: number, x: any) => s + Number(x.amount), 0)
  const totalExpected  = bp.reduce((s: number, x: any) => s + Number(x.amount), 0)
  const txIncome       = tx.filter((x: any) => x.type === 'income').reduce((s: number, x: any) => s + Number(x.amount), 0)
  const txExpense      = tx.filter((x: any) => x.type === 'expense').reduce((s: number, x: any) => s + Number(x.amount), 0)

  const realBalance    = (totalReceived + txIncome) - (totalPaid + txExpense)
  const expectedBalance = (totalExpected + txIncome) - (totalScheduled + txExpense)

  // Per-project stats
  const projectStats = proj.map((p: any) => {
    const pPaid     = pp.filter((x: any) => x.project_id === p.id && x.is_paid).reduce((s: number, x: any) => s + Number(x.amount), 0)
    const pSched    = pp.filter((x: any) => x.project_id === p.id).reduce((s: number, x: any) => s + Number(x.amount), 0)
    const bRecv     = bp.filter((x: any) => x.project_id === p.id && x.is_received).reduce((s: number, x: any) => s + Number(x.amount), 0)
    const bExpected = bp.filter((x: any) => x.project_id === p.id).reduce((s: number, x: any) => s + Number(x.amount), 0)
    const tInc      = tx.filter((x: any) => x.project_id === p.id && x.type === 'income').reduce((s: number, x: any) => s + Number(x.amount), 0)
    const tExp      = tx.filter((x: any) => x.project_id === p.id && x.type === 'expense').reduce((s: number, x: any) => s + Number(x.amount), 0)
    const realBal   = (bRecv + tInc) - (pPaid + tExp)
    const expBal    = (bExpected + tInc) - (pSched + tExp)
    const pct       = bExpected > 0 ? Math.round((bRecv / bExpected) * 100) : 0

    return { ...p, pPaid, pSched, bRecv, bExpected, realBal, expBal, pct }
  })

  const kpis = [
    { label: 'מאזן אמיתי',      value: fmt(realBalance),    icon: Wallet,       color: realBalance >= 0 ? 'text-emerald-700' : 'text-red-600',     bg: realBalance >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100' },
    { label: 'מאזן צפוי',       value: fmt(expectedBalance), icon: Target,       color: expectedBalance >= 0 ? 'text-blue-700' : 'text-orange-600', bg: 'bg-blue-50 border-blue-100' },
    { label: 'סה"כ נגבה',       value: fmt(totalReceived + txIncome),  icon: TrendingUp,  color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-100' },
    { label: 'סה"כ שולם',       value: fmt(totalPaid + txExpense),     icon: TrendingDown, color: 'text-red-600',    bg: 'bg-red-50 border-red-100' },
    { label: 'הכנסות צפויות',   value: fmt(totalExpected + txIncome),  icon: TrendingUp,  color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-100' },
    { label: 'הוצאות צפויות',   value: fmt(totalScheduled + txExpense), icon: TrendingDown, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-100' },
  ]

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-black text-slate-900">מאזן כספי</h1>
        <p className="text-sm text-slate-500 mt-0.5">סיכום הוצאות, הכנסות ורווח לפי פרויקט ולחברה כולה</p>
      </div>

      {/* Company KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {kpis.map(kpi => (
          <div key={kpi.label} className={cn('rounded-2xl border p-4', kpi.bg)}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{kpi.label}</p>
              <kpi.icon className={cn('w-4 h-4', kpi.color)} />
            </div>
            <p className={cn('text-xl font-black', kpi.color)}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Per-project table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <p className="font-bold text-slate-800">פירוט לפי פרויקט</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                {['פרויקט', 'הכנסות בפועל', 'הוצאות בפועל', 'מאזן אמיתי', 'הכנסות צפויות', 'מאזן צפוי', 'גבייה %'].map(h => (
                  <th key={h} className="text-right text-[11px] font-bold uppercase tracking-wider text-slate-400 px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {projectStats.map((p: any) => (
                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <a href={`/moshe/projects/${p.id}`} className="font-bold text-slate-900 hover:text-amber-600 transition-colors">
                      {p.name}
                    </a>
                    <p className="text-[10px] text-slate-400 capitalize">{p.status}</p>
                  </td>
                  <td className="px-4 py-3 font-bold text-emerald-700">{fmt(p.bRecv)}</td>
                  <td className="px-4 py-3 font-bold text-red-600">{fmt(p.pPaid)}</td>
                  <td className={cn('px-4 py-3 font-black', p.realBal >= 0 ? 'text-emerald-700' : 'text-red-600')}>{fmt(p.realBal)}</td>
                  <td className="px-4 py-3 text-blue-600 font-medium">{fmt(p.bExpected)}</td>
                  <td className={cn('px-4 py-3 font-black', p.expBal >= 0 ? 'text-blue-700' : 'text-orange-600')}>{fmt(p.expBal)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 bg-slate-100 rounded-full">
                        <div className="h-1.5 bg-amber-400 rounded-full" style={{ width: `${p.pct}%` }} />
                      </div>
                      <span className="text-xs font-bold text-slate-600">{p.pct}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Totals row */}
            <tfoot className="bg-slate-50 border-t-2 border-slate-200">
              <tr>
                <td className="px-4 py-3 font-black text-slate-700 text-sm">סה"כ</td>
                <td className="px-4 py-3 font-black text-emerald-700">{fmt(totalReceived + txIncome)}</td>
                <td className="px-4 py-3 font-black text-red-600">{fmt(totalPaid + txExpense)}</td>
                <td className={cn('px-4 py-3 font-black text-base', realBalance >= 0 ? 'text-emerald-700' : 'text-red-600')}>{fmt(realBalance)}</td>
                <td className="px-4 py-3 font-black text-blue-600">{fmt(totalExpected + txIncome)}</td>
                <td className={cn('px-4 py-3 font-black text-base', expectedBalance >= 0 ? 'text-blue-700' : 'text-orange-600')}>{fmt(expectedBalance)}</td>
                <td className="px-4 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Transactions with filtering */}
      <FinanceFilters transactions={tx as any[]} projects={proj as any[]} />
    </div>
  )
}
