import { createClient } from '@/lib/supabase/server'
import { createClient as adminDb } from '@supabase/supabase-js'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, MapPin, CalendarDays, User, Phone, TrendingUp, TrendingDown } from 'lucide-react'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { WorkerLogAdd } from '@/components/moshe/WorkerLogAdd'

const db = adminDb(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function fmt(n: number) { return '₪' + n.toLocaleString('he-IL', { maximumFractionDigits: 0 }) }

export const dynamic = 'force-dynamic'

export default async function WorkerProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: worker } = await db
    .from('moshe_workers')
    .select('id, name')
    .eq('email', user.email)
    .single()
  if (!worker) redirect('/login')

  const { data: perm } = await db
    .from('moshe_worker_project_permissions')
    .select('can_view, can_log, can_view_payments, can_view_buyers')
    .eq('worker_id', worker.id)
    .eq('project_id', id)
    .single()

  if (!perm?.can_view) notFound()

  const none = Promise.resolve({ data: [] as any[] })

  const [
    { data: project },
    { data: myLogs },
    { data: rawPayments },
    { data: rawBuyers },
    { data: rawBuyerPayments },
  ] = await Promise.all([
    db.from('moshe_projects').select('*').eq('id', id).single(),
    db.from('moshe_worker_logs').select('*').eq('worker_id', worker.id).eq('project_id', id).order('log_date', { ascending: false }),
    perm.can_view_payments ? db.from('moshe_project_payments').select('*').eq('project_id', id).order('due_date') : none,
    perm.can_view_buyers   ? db.from('moshe_buyers').select('id, name, unit, price').eq('project_id', id).order('name') : none,
    perm.can_view_buyers   ? db.from('moshe_buyer_payments').select('*').eq('project_id', id).order('due_date') : none,
  ])

  if (!project) notFound()

  const projPayments  = (rawPayments as any[]) ?? []
  const buyers        = (rawBuyers as any[]) ?? []
  const buyerPayments = (rawBuyerPayments as any[]) ?? []

  const p    = project as any
  const logs = (myLogs as any[]) ?? []

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Link href="/worker-portal" className="hover:text-slate-600">הפרויקטים שלי</Link>
        <ArrowRight className="w-4 h-4 rotate-180" />
        <span className="text-slate-700 font-medium">{p.name}</span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h1 className="text-xl font-black text-slate-900 mb-1">{p.name}</h1>
        <div className="flex flex-wrap gap-4 text-xs text-slate-400">
          {p.address && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{p.address}</span>}
          {p.contact_name && <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />{p.contact_name}</span>}
          {p.contact_phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{p.contact_phone}</span>}
          {p.start_date && <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" />מ-{format(new Date(p.start_date), 'dd/MM/yyyy', { locale: he })}</span>}
        </div>
        {p.notes && <p className="mt-3 text-sm text-slate-600 bg-slate-50 rounded-xl p-3">{p.notes}</p>}
      </div>

      {/* Project payments */}
      {perm.can_view_payments && projPayments.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-red-400" />
            <p className="text-sm font-bold text-slate-700">תשלומי הפרויקט ({projPayments.length})</p>
          </div>
          <div className="divide-y divide-slate-50">
            {projPayments.map((pay: any) => (
              <div key={pay.id} className="flex items-center gap-3 px-4 py-3">
                <div className={cn('w-2 h-2 rounded-full shrink-0', pay.is_paid ? 'bg-emerald-400' : 'bg-red-400')} />
                <div className="flex-1 min-w-0">
                  {pay.notes && <p className="text-xs text-slate-600">{pay.notes}</p>}
                  {pay.due_date && (
                    <p className="text-[10px] text-slate-400">
                      {format(new Date(pay.due_date), 'dd/MM/yyyy', { locale: he })}
                    </p>
                  )}
                </div>
                <span className={cn('text-sm font-black shrink-0', pay.is_paid ? 'text-slate-400 line-through' : 'text-red-600')}>
                  {fmt(Number(pay.amount))}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Buyers */}
      {perm.can_view_buyers && buyers.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <p className="text-sm font-bold text-slate-700">קונים ({buyers.length})</p>
          </div>
          <div className="divide-y divide-slate-50">
            {buyers.map((b: any) => {
              const bPayments = buyerPayments.filter((pay: any) => pay.buyer_id === b.id)
              const received  = bPayments.filter((pay: any) => pay.is_received).reduce((s: number, pay: any) => s + Number(pay.amount), 0)
              const total     = bPayments.reduce((s: number, pay: any) => s + Number(pay.amount), 0)
              return (
                <div key={b.id} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-slate-700">{b.name}</p>
                    {b.unit && <span className="text-[10px] text-slate-400">{b.unit}</span>}
                  </div>
                  {total > 0 && (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="text-emerald-600 font-bold">{fmt(received)}</span>
                      <span>/</span>
                      <span>{fmt(total)}</span>
                      <span className="text-[10px]">({total > 0 ? Math.round(received / total * 100) : 0}%)</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Worker log */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <p className="text-sm font-bold text-slate-700">היומן שלי ({logs.length})</p>
          {perm.can_log && (
            <WorkerLogAdd workerId={worker.id} projectId={id} />
          )}
        </div>

        {logs.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-10">
            {perm.can_log ? 'אין רשומות. לחץ "הוסף רשומה" לתיעוד פעילות.' : 'אין הרשאה לכתיבה.'}
          </p>
        ) : (
          <div className="divide-y divide-slate-50">
            {logs.map((log: any) => (
              <div key={log.id} className="flex items-center gap-3 px-4 py-3">
                <CalendarDays className="w-4 h-4 text-orange-300 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-slate-700">{log.note}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {format(new Date(log.log_date + 'T00:00:00'), 'EEEE, dd/MM/yyyy', { locale: he })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
