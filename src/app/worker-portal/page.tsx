import { createClient } from '@/lib/supabase/server'
import { createClient as adminDb } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { MapPin, CalendarDays, FolderKanban } from 'lucide-react'
import { WorkerTaskToggle } from '@/components/moshe/WorkerTaskToggle'
import { WorkerBotView } from '@/components/moshe/WorkerBotView'
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

  const [{ data: perms }, { data: tasks }, { data: botMessages }] = await Promise.all([
    db.from('moshe_worker_project_permissions').select('project_id, can_log').eq('worker_id', worker.id).eq('can_view', true),
    db.from('moshe_worker_tasks').select('*').eq('worker_id', worker.id).order('created_at', { ascending: false }),
    db.from('worker_messages')
      .select('*, replies:worker_message_replies(*)')
      .eq('worker_id', worker.id)
      .order('created_at', { ascending: false }),
  ])

  const projectIds   = (perms ?? []).map((p: any) => p.project_id)
  const tasksArr     = (tasks as any[]) ?? []
  const botMsgsArr   = (botMessages as any[]) ?? []
  const pendingTasks = tasksArr.filter((t: any) => !t.is_done)

  const { data: projects } = projectIds.length > 0
    ? await db.from('moshe_projects').select('*').in('id', projectIds).order('name')
    : { data: [] }

  const projectMap = Object.fromEntries(((projects as any[]) ?? []).map((p: any) => [p.id, p.name]))

  // Active bot messages count for badge
  const activeBotCount = botMsgsArr.filter((m: any) => m.status !== 'done' && m.status !== 'cancelled').length

  return (
    <div className="space-y-5">
      {/* ── Bot section ── */}
      <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-indigo-50 flex items-center gap-2 bg-gradient-to-l from-indigo-50 to-white">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm">
            <span className="text-white text-xs">🤖</span>
          </div>
          <p className="text-sm font-bold text-indigo-800">נחמיה בוט</p>
          {activeBotCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-black flex items-center justify-center ms-auto">
              {activeBotCount}
            </span>
          )}
        </div>
        <div className="px-4 py-4">
          <WorkerBotView
            messages={botMsgsArr as any}
            workerName={worker.name}
            workerId={worker.id}
          />
        </div>
      </div>

      {/* ── Tasks section (existing) ── */}
      {tasksArr.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            {pendingTasks.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-black flex items-center justify-center">
                {pendingTasks.length}
              </span>
            )}
            <p className="text-sm font-bold text-slate-700">המשימות שלי</p>
          </div>
          <div className="divide-y divide-slate-50">
            {tasksArr.map((task: any) => (
              <div key={task.id} className={cn('flex items-center gap-3 px-4 py-3', task.is_done && 'opacity-50')}>
                <WorkerTaskToggle id={task.id} isDone={task.is_done} />
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium text-slate-700', task.is_done && 'line-through')}>{task.title}</p>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                    {task.due_date && (
                      <span className={cn('flex items-center gap-0.5',
                        !task.is_done && new Date(task.due_date) < new Date() ? 'text-red-500' : 'text-amber-600')}>
                        <CalendarDays className="w-3 h-3" />
                        {format(new Date(task.due_date + 'T00:00:00'), 'dd/MM/yyyy', { locale: he })}
                      </span>
                    )}
                    {task.project_id && projectMap[task.project_id] && (
                      <span className="text-indigo-500">{projectMap[task.project_id]}</span>
                    )}
                    {task.notes && <span>{task.notes}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Projects section (existing) ── */}
      {projectIds.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-bold text-slate-700">הפרויקטים שלך ({projectIds.length})</p>
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
                      {p.address    && <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{p.address}</span>}
                      {p.start_date && <span className="flex items-center gap-0.5"><CalendarDays className="w-3 h-3" />מ-{format(new Date(p.start_date), 'dd/MM/yyyy', { locale: he })}</span>}
                    </div>
                  </div>
                  <FolderKanban className="w-5 h-5 text-slate-200 shrink-0 mt-0.5" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
