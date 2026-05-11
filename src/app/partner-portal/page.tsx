import { createClient } from '@/lib/supabase/server'
import { createClient as adminDb } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { MapPin, CalendarDays, FolderKanban, TrendingUp } from 'lucide-react'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import { cn } from '@/lib/utils'

const db = adminDb(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function fmt(n: number) { return '₪' + n.toLocaleString('he-IL', { maximumFractionDigits: 0 }) }

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  active:  { label: 'פעיל',  color: 'bg-emerald-100 text-emerald-700' },
  pending: { label: 'ממתין', color: 'bg-amber-100 text-amber-700' },
  closed:  { label: 'סגור',  color: 'bg-slate-100 text-slate-500' },
}

export const dynamic = 'force-dynamic'

export default async function PartnerPortalHome() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get all partner records for this email (across all projects)
  const { data: partnerRows } = await db
    .from('moshe_partners')
    .select('id, project_id, name')
    .eq('email', user.email)
    .eq('portal_access', true)

  const rows = (partnerRows as any[]) ?? []
  if (rows.length === 0) {
    return (
      <div className="text-center py-20">
        <FolderKanban className="w-12 h-12 text-slate-200 mx-auto mb-3" />
        <p className="text-slate-500 font-medium">אין פרויקטים משויכים אליך</p>
      </div>
    )
  }

  const projectIds = [...new Set(rows.map((r: any) => r.project_id))]

  const [{ data: projects }, { data: partnerTx }] = await Promise.all([
    db.from('moshe_projects').select('*').in('id', projectIds).order('name'),
    db.from('moshe_partner_transactions')
      .select('*')
      .in('partner_id', rows.map((r: any) => r.id)),
  ])

  const txByPartner = Object.fromEntries(
    rows.map((r: any) => [r.project_id, (partnerTx as any[])?.filter((t: any) => t.partner_id === r.id) ?? []])
  )

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-black text-slate-900">הפרויקטים שלי</h1>
        <p className="text-xs text-slate-400">צפייה בנתונים הפיננסיים שלך</p>
      </div>

      <div className="space-y-4">
        {((projects as any[]) ?? []).map((p: any) => {
          const myTx = txByPartner[p.id] ?? []
          const invested  = myTx.filter((t: any) => t.type === 'investment').reduce((s: number, t: any) => s + Number(t.amount), 0)
          const withdrawn = myTx.filter((t: any) => t.type === 'withdrawal').reduce((s: number, t: any) => s + Number(t.amount), 0)
          const balance   = invested - withdrawn
          const st = STATUS_LABEL[p.status] ?? STATUS_LABEL.active

          return (
            <Link key={p.id} href={`/partner-portal/project/${p.id}`}
              className="block bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="font-bold text-slate-900">{p.name}</h2>
                    <span className={cn('text-[9px] font-bold px-2 py-0.5 rounded-full', st.color)}>{st.label}</span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-[10px] text-slate-400">
                    {p.address && <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{p.address}</span>}
                    {p.start_date && <span className="flex items-center gap-0.5"><CalendarDays className="w-3 h-3" />מ-{format(new Date(p.start_date), 'dd/MM/yyyy', { locale: he })}</span>}
                  </div>
                </div>
                <FolderKanban className="w-5 h-5 text-slate-200 shrink-0" />
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'השקעות שלי', value: fmt(invested), color: 'text-indigo-700', bg: 'bg-indigo-50' },
                  { label: 'משיכות שלי', value: fmt(withdrawn), color: 'text-orange-600', bg: 'bg-orange-50' },
                  { label: 'מאזן אישי', value: fmt(balance), color: balance >= 0 ? 'text-emerald-700' : 'text-red-600', bg: balance >= 0 ? 'bg-emerald-50' : 'bg-red-50' },
                ].map(kpi => (
                  <div key={kpi.label} className={cn('rounded-xl p-2.5 text-center', kpi.bg)}>
                    <p className="text-[9px] text-slate-400 font-bold">{kpi.label}</p>
                    <p className={cn('text-sm font-black mt-0.5', kpi.color)}>{kpi.value}</p>
                  </div>
                ))}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
