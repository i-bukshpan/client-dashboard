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
  ] = await Promise.all([
    db.from('moshe_projects').select('*').order('created_at', { ascending: false }),
    db.from('moshe_project_payments').select('project_id, amount, is_paid'),
    db.from('moshe_buyer_payments').select('project_id, amount, is_received'),
    db.from('moshe_buyers').select('project_id'),
  ])

  const pp = (projPayments as any[]) ?? []
  const bp = (buyerPayments as any[]) ?? []
  const proj = (projects as any[]) ?? []
  const buyersArr = (buyers as any[]) ?? []

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
          {proj.map((p: any) => {
            const pPaid    = pp.filter((x: any) => x.project_id === p.id && x.is_paid).reduce((s: number, x: any) => s + Number(x.amount), 0)
            const pTotal   = pp.filter((x: any) => x.project_id === p.id).reduce((s: number, x: any) => s + Number(x.amount), 0)
            const bRecv    = bp.filter((x: any) => x.project_id === p.id && x.is_received).reduce((s: number, x: any) => s + Number(x.amount), 0)
            const bTotal   = bp.filter((x: any) => x.project_id === p.id).reduce((s: number, x: any) => s + Number(x.amount), 0)
            const buyCount = buyersArr.filter((x: any) => x.project_id === p.id).length
            const balance  = bRecv - pPaid
            const pct      = bTotal > 0 ? Math.round((bRecv / bTotal) * 100) : 0
            const st       = STATUS_LABEL[p.status] ?? STATUS_LABEL.active

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
                    <p className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider">נגבה</p>
                    <p className="text-sm font-black text-emerald-700 mt-0.5">{fmt(bRecv)}</p>
                  </div>
                  <div className="bg-red-50 rounded-xl p-2.5 text-center">
                    <p className="text-[9px] text-red-500 font-bold uppercase tracking-wider">שולם</p>
                    <p className="text-sm font-black text-red-600 mt-0.5">{fmt(pPaid)}</p>
                  </div>
                  <div className={cn('rounded-xl p-2.5 text-center', balance >= 0 ? 'bg-blue-50' : 'bg-orange-50')}>
                    <p className={cn('text-[9px] font-bold uppercase tracking-wider', balance >= 0 ? 'text-blue-600' : 'text-orange-600')}>מאזן</p>
                    <p className={cn('text-sm font-black mt-0.5', balance >= 0 ? 'text-blue-700' : 'text-orange-600')}>{fmt(balance)}</p>
                  </div>
                </div>

                {/* Progress */}
                <div className="space-y-1 mb-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-400">גבייה מקונים</span>
                    <span className="text-[10px] font-bold text-slate-600">{pct}%</span>
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
