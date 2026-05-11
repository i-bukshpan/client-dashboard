import { createClient } from '@/lib/supabase/server'
import { createClient as adminDb } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { MapPin, CalendarDays, FolderKanban } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'

const db = adminDb(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  active:  { label: 'פעיל',  color: 'bg-emerald-100 text-emerald-700' },
  pending: { label: 'ממתין', color: 'bg-amber-100 text-amber-700' },
  closed:  { label: 'סגור',  color: 'bg-slate-100 text-slate-500' },
}

export const dynamic = 'force-dynamic'

export default async function WorkerPortalHome() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: worker } = await db
    .from('moshe_workers')
    .select('id, name')
    .eq('email', user.email)
    .single()

  if (!worker) redirect('/login')

  const { data: perms } = await db
    .from('moshe_worker_project_permissions')
    .select('project_id, can_log')
    .eq('worker_id', worker.id)
    .eq('can_view', true)

  const projectIds = (perms ?? []).map((p: any) => p.project_id)

  if (projectIds.length === 0) {
    return (
      <div className="text-center py-20">
        <FolderKanban className="w-12 h-12 text-slate-200 mx-auto mb-3" />
        <p className="text-slate-500 font-medium">אין פרויקטים משויכים אליך עדיין</p>
        <p className="text-slate-400 text-sm mt-1">פנה למנהל לקבלת הרשאות</p>
      </div>
    )
  }

  const { data: projects } = await db
    .from('moshe_projects')
    .select('*')
    .in('id', projectIds)
    .order('name')

  return (
    <div className="space-y-4">
      <p className="text-sm font-bold text-slate-700">הפרויקטים שלך ({projectIds.length})</p>

      <div className="space-y-3">
        {((projects as any[]) ?? []).map((p: any) => {
          const st = STATUS_LABEL[p.status] ?? STATUS_LABEL.active
          return (
            <Link key={p.id} href={`/worker-portal/project/${p.id}`}
              className="block bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-orange-200 hover:shadow-md transition-all p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="font-bold text-slate-900 text-sm">{p.name}</h2>
                    <span className={cn('text-[9px] font-bold px-2 py-0.5 rounded-full', st.color)}>{st.label}</span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-[10px] text-slate-400">
                    {p.address && <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{p.address}</span>}
                    {p.start_date && <span className="flex items-center gap-0.5"><CalendarDays className="w-3 h-3" />מ-{format(new Date(p.start_date), 'dd/MM/yyyy', { locale: he })}</span>}
                  </div>
                </div>
                <FolderKanban className="w-5 h-5 text-slate-200 shrink-0 mt-0.5" />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
