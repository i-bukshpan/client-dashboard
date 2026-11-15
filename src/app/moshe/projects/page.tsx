import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { Plus, FolderKanban, MapPin, Phone, TrendingUp, TrendingDown, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function fmt(n: number) {
  return '₪' + n.toLocaleString('he-IL', { maximumFractionDigits: 0 })
}

export const dynamic = 'force-dynamic'
export const metadata = { title: 'פרויקטים | משה פרוש' }

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  active:  { label: 'פעיל',    color: 'bg-emerald-100 text-emerald-700' },
  pending: { label: 'ממתין',   color: 'bg-amber-100 text-amber-700' },
  closed:  { label: 'סגור',    color: 'bg-slate-100 text-slate-500' },
}

export default async function ProjectsPage() {
  const [
    { data: projects },
    { data: projPayments },
    { data: buyerPayments },
    { data: buyers },
    { data: transactions },
    { data: partnerTransactions },
    { data: loans },
    { data: loanPayments },
    { data: loanReceipts },
    { data: neighborPayments },
  ] = await Promise.all([
    db.from('moshe_projects').select('*').order('created_at', { ascending: false }),
    db.from('moshe_project_payments').select('project_id, amount, is_paid, payment_type'),
    db.from('moshe_buyer_payments').select('project_id, amount, is_received, payment_type'),
    db.from('moshe_buyers').select('id, project_id, total_amount'),
    db.from('moshe_transactions').select('project_id, amount, type'),
    db.from('moshe_partner_transactions').select('project_id, amount, type'),
    db.from('moshe_loans').select('id, project_id, total_amount'),
    db.from('moshe_loan_payments').select('loan_id, project_id, amount, is_paid, is_interest'),
    db.from('moshe_loan_receipts').select('project_id, amount, is_received'),
    db.from('moshe_neighbor_payments').select('project_id, amount, is_paid'),
  ])

  const pp = (projPayments as any[]) ?? []
  const bp = (buyerPayments as any[]) ?? []
  const proj = (projects as any[]) ?? []
  const buyersArr = (buyers as any[]) ?? []
  const tx = (transactions as any[]) ?? []
  const ptx = (partnerTransactions as any[]) ?? []
  const lp = (loanPayments as any[]) ?? []
  const lr = (loanReceipts as any[]) ?? []
  const np = (neighborPayments as any[]) ?? []

  // Precompute project stats consistent with [id]/page.tsx
  const projectStats = proj.map((p: any) => {
    // 1. Supplier & Neighbor Payments (Paid movements / legacy paid)
    const pPaid = pp.filter((x: any) => x.project_id === p.id && (x.payment_type === 'movement' || (!x.payment_type && x.is_paid))).reduce((s: number, x: any) => s + Number(x.amount), 0)
                + np.filter((x: any) => x.project_id === p.id && x.is_paid).reduce((s: number, x: any) => s + Number(x.amount), 0)
    
    // 2. Buyer Payments (Received movements / legacy received)
    const bRecv = bp.filter((x: any) => x.project_id === p.id && (x.payment_type === 'movement' || (!x.payment_type && x.is_received))).reduce((s: number, x: any) => s + Number(x.amount), 0)
    
    // 3. Buyer Payments (Scheduled / Contract)
    const bTotal = bp.filter((x: any) => x.project_id === p.id && (x.payment_type === 'schedule' || (!x.payment_type && !x.is_received))).reduce((s: number, x: any) => s + Number(x.amount), 0)
    const buyersContractTotal = buyersArr.filter((x: any) => x.project_id === p.id).reduce((s: number, x: any) => s + (Number(x.total_amount) || 0), 0)
    const targetTotal = bTotal > 0 ? bTotal : buyersContractTotal
    const pct = targetTotal > 0 ? Math.min(100, Math.round((bRecv / targetTotal) * 100)) : 0
    const buyCount = buyersArr.filter((x: any) => x.project_id === p.id).length

    // 4. General Transactions
    const txInc = tx.filter((x: any) => x.project_id === p.id && x.type === 'income').reduce((s: number, x: any) => s + Number(x.amount), 0)
    const txExp = tx.filter((x: any) => x.project_id === p.id && x.type === 'expense').reduce((s: number, x: any) => s + Number(x.amount), 0)

    // 5. Partners
    const pInv = ptx.filter((x: any) => x.project_id === p.id && x.type === 'investment').reduce((s: number, x: any) => s + Number(x.amount), 0)
    const pWth = ptx.filter((x: any) => x.project_id === p.id && x.type === 'withdrawal').reduce((s: number, x: any) => s + Number(x.amount), 0)
    const pExp = ptx.filter((x: any) => x.project_id === p.id && x.type === 'expense').reduce((s: number, x: any) => s + Number(x.amount), 0)

    // 6. Loans
    const lRecv = lr.filter((x: any) => x.project_id === p.id && x.is_received).reduce((s: number, x: any) => s + Number(x.amount), 0)
    const lPaid = lp.filter((x: any) => x.project_id === p.id && x.is_paid && !x.is_interest).reduce((s: number, x: any) => s + Number(x.amount), 0)

    // Exactly identical to realBalance in [id]/page.tsx:
    // (totalReceived + txIncome + totalInvested + loanReceivedAmt) - (totalPaid + txExpense + ptxExpense + totalWithdrawn + loanPaidBack)
    const totalReceived = bRecv + txInc + pInv + lRecv
    const totalPaid = pPaid + txExp + pExp + pWth + lPaid
    const balance = totalReceived - totalPaid

    const totalIncome = bRecv + txInc
    const totalExpense = pPaid + txExp

    const st = STATUS_LABEL[p.status] ?? STATUS_LABEL.active

    return {
      p,
      bRecv,
      pPaid,
      totalIncome,
      totalExpense,
      balance,
      pct,
      buyCount,
      st,
    }
  })

  // Global KPIs across all projects
  const globalBalance = projectStats.reduce((s, item) => s + item.balance, 0)
  const globalIncome = projectStats.reduce((s, item) => s + item.totalIncome, 0)
  const globalExpense = projectStats.reduce((s, item) => s + item.totalExpense, 0)
  const activeCount = projectStats.filter(item => item.p.status === 'active').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">פרויקטים</h1>
          <p className="text-sm text-slate-500 mt-0.5">{proj.length} פרויקטים רשומים</p>
        </div>
        <Link
          href="/moshe/projects/new"
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white text-sm font-bold px-4 py-2.5 rounded-xl shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          פרויקט חדש
        </Link>
      </div>

      {/* Global summary stats */}
      {projectStats.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">כסף בקופה (כולל)</p>
            <p className={cn('text-xl font-black', globalBalance >= 0 ? 'text-emerald-700' : 'text-red-600')}>{fmt(globalBalance)}</p>
            <p className="text-[10px] text-slate-400 mt-1">יתרה נזילה בכל הפרויקטים</p>
          </div>
          <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-4 shadow-sm">
            <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider mb-1">סה״כ הכנסות שנגבו</p>
            <p className="text-xl font-black text-emerald-700">{fmt(globalIncome)}</p>
            <p className="text-[10px] text-emerald-600/80 mt-1">קונים + עסקאות כלליות</p>
          </div>
          <div className="bg-red-50/70 border border-red-100 rounded-2xl p-4 shadow-sm">
            <p className="text-[11px] font-bold text-red-600 uppercase tracking-wider mb-1">סה״כ הוצאות ששולמו</p>
            <p className="text-xl font-black text-red-600">{fmt(globalExpense)}</p>
            <p className="text-[10px] text-red-500/80 mt-1">ספקים + שכנים + עסקאות</p>
          </div>
          <div className="bg-amber-50/70 border border-amber-100 rounded-2xl p-4 shadow-sm">
            <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider mb-1">פרויקטים פעילים</p>
            <p className="text-xl font-black text-amber-800">{activeCount} <span className="text-sm font-normal text-slate-500">/ {proj.length}</span></p>
            <p className="text-[10px] text-amber-600/80 mt-1">בביצוע שוטף</p>
          </div>
        </div>
      )}

      {proj.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-2xl border-2 border-dashed border-slate-200">
          <FolderKanban className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">אין פרויקטים עדיין</p>
          <Link href="/moshe/projects/new" className="text-amber-500 text-sm mt-1 inline-block hover:underline">
            + צור פרויקט ראשון
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projectStats.map(({ p, bRecv, totalIncome, totalExpense, balance, pct, buyCount, st }) => {
            return (
              <Link
                key={p.id}
                href={`/moshe/projects/${p.id}`}
                className="bg-white rounded-2xl border border-slate-100 p-5 hover:border-amber-200 hover:shadow-md transition-all group"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-900 text-base truncate group-hover:text-amber-600 transition-colors">
                      {p.name}
                    </p>
                    {p.address && (
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                        <MapPin className="w-3 h-3 shrink-0" />{p.address}
                      </p>
                    )}
                  </div>
                  <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0', st.color)}>
                    {st.label}
                  </span>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="bg-emerald-50 rounded-xl p-2.5 text-center">
                    <p className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider truncate">הכנסות</p>
                    <p className="text-sm font-black text-emerald-700 mt-0.5">{fmt(totalIncome)}</p>
                  </div>
                  <div className="bg-red-50 rounded-xl p-2.5 text-center">
                    <p className="text-[9px] text-red-500 font-bold uppercase tracking-wider truncate">הוצאות</p>
                    <p className="text-sm font-black text-red-600 mt-0.5">{fmt(totalExpense)}</p>
                  </div>
                  <div className={cn('rounded-xl p-2.5 text-center', balance >= 0 ? 'bg-blue-50' : 'bg-orange-50')}>
                    <p className={cn('text-[9px] font-bold uppercase tracking-wider truncate', balance >= 0 ? 'text-blue-600' : 'text-orange-600')}>כסף בקופה</p>
                    <p className={cn('text-sm font-black mt-0.5', balance >= 0 ? 'text-blue-700' : 'text-orange-600')}>{fmt(balance)}</p>
                  </div>
                </div>

                {/* Progress */}
                <div className="space-y-1 mb-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-400">גבייה מקונים</span>
                    <span className="text-[10px] font-bold text-slate-600">{pct}% ({fmt(bRecv)})</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full">
                    <div className="h-1.5 bg-amber-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-50">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />{buyCount} קונים
                  </span>
                  {p.contact_phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" />{p.contact_phone}
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
