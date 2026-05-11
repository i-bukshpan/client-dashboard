import { createClient as adminDb } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Eye, MapPin, CalendarDays, FolderKanban, CalendarCheck, ArrowRight } from 'lucide-react'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import { cn } from '@/lib/utils'

const db = adminDb(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function fmtD(d: string) { return format(new Date(d), 'dd/MM/yyyy', { locale: he }) }

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  active:  { label: 'פעיל',  color: 'bg-emerald-100 text-emerald-700' },
  pending: { label: 'ממתין', color: 'bg-amber-100 text-amber-700' },
  closed:  { label: 'סגור',  color: 'bg-slate-100 text-slate-500' },
}

export const dynamic = 'force-dynamic'

export default async function PreviewWorkerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: worker } = await db
    .from('moshe_workers')
    .select('id, name, email, role, is_active')
    .eq('id', id)
    .single()

  if (!worker) notFound()
  const w = worker as any

  const { data: perms } = await db
    .from('moshe_worker_project_permissions')
    .select('project_id, can_view, can_log')
    .eq('worker_id', id)
    .eq('can_view', true)

  const permArr = (perms as any[]) ?? []
  const projectIds = permArr.map(p => p.project_id)

  const { data: projects } = projectIds.length > 0
    ? await db.from('moshe_projects').select('*').in('id', projectIds).order('name')
    : { data: [] }

  const { data: logs } = await db
    .from('moshe_worker_logs')
    .select('*')
    .eq('worker_id', id)
    .order('log_date', { ascending: false })
    .limit(20)

  const projectsArr = (projects as any[]) ?? []
  const logsArr     = (logs as any[]) ?? []

  const canLogMap = Object.fromEntries(permArr.map(p => [p.project_id, p.can_log]))
  const projectMap = Object.fromEntries(projectsArr.map(p => [p.id, p.name]))

  return (
    <div className="space-y-4">
      {/* Preview banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-amber-600 shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-800">מצב תצוגה מקדימה — {w.name}</p>
            <p className="text-xs text-amber-600">
              {!w.is_active ? 'עובד לא פעיל — לא יוכל להיכנס לפורטל' :
               projectIds.length === 0 ? 'אין פרויקטים מוקצים — הפורטל יהיה ריק' :
               `${projectIds.length} פרויקטים · ${permArr.filter(p => p.can_log).length} עם הרשאת כתיבה`}
            </p>
          </div>
        </div>
        <Link href="/moshe/workers"
          className="text-xs text-amber-700 hover:text-amber-900 font-medium border border-amber-200 rounded-lg px-3 py-1.5 flex items-center gap-1 transition-colors">
          <ArrowRight className="w-3 h-3 rotate-180" /> חזרה לעובדים
        </Link>
      </div>

      {!w.is_active && (
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
          <Eye className="w-10 h-10 text-slate-200 mx-auto mb-2" />
          <p className="text-slate-500 font-medium">עובד לא פעיל</p>
          <p className="text-slate-400 text-sm mt-1">הפעל את העובד כדי לאפשר כניסה לפורטל</p>
        </div>
      )}

      {w.is_active && (
        <>
          {/* What the worker sees: their project list */}
          <div>
            <p className="text-sm font-bold text-slate-700 mb-3">הפרויקטים שלך ({projectIds.length})</p>

            {projectIds.length === 0 ? (
              <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 py-12 text-center">
                <FolderKanban className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                <p className="text-slate-400">אין פרויקטים משויכים עדיין</p>
                <p className="text-slate-400 text-xs mt-1">שנה הרשאות בכרטיס העובד</p>
              </div>
            ) : (
              <div className="space-y-3">
                {projectsArr.map((p: any) => {
                  const st = STATUS_LABEL[p.status] ?? STATUS_LABEL.active
                  return (
                    <div key={p.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h2 className="font-bold text-slate-900 text-sm">{p.name}</h2>
                            <span className={cn('text-[9px] font-bold px-2 py-0.5 rounded-full', st.color)}>{st.label}</span>
                            {canLogMap[p.id] && (
                              <span className="text-[9px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-bold">יכול לכתוב</span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-3 text-[10px] text-slate-400">
                            {p.address    && <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{p.address}</span>}
                            {p.start_date && <span className="flex items-center gap-0.5"><CalendarDays className="w-3 h-3" />מ-{fmtD(p.start_date)}</span>}
                          </div>
                        </div>
                        <FolderKanban className="w-5 h-5 text-slate-200 shrink-0 mt-0.5" />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Recent logs by this worker */}
          {logsArr.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-sm font-bold text-slate-700">הרשומות האחרונות של {w.name} ({logsArr.length})</p>
              </div>
              <div className="divide-y divide-slate-50">
                {logsArr.map((log: any) => (
                  <div key={log.id} className="flex items-start gap-3 px-4 py-3">
                    <CalendarCheck className="w-4 h-4 text-orange-300 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700">{log.note}</p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                        <span>{format(new Date(log.log_date + 'T00:00:00'), 'EEEE, dd/MM/yyyy', { locale: he })}</span>
                        {log.project_id && projectMap[log.project_id] && (
                          <><span>·</span><span className="text-amber-600">{projectMap[log.project_id]}</span></>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
