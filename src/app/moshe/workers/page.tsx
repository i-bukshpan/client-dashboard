import { createClient } from '@supabase/supabase-js'
import { WorkersManager } from '@/components/moshe/WorkersManager'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

export default async function WorkersPage() {
  const [{ data: workers }, { data: permissions }, { data: logs }, { data: tasks }, { data: projects }] = await Promise.all([
    db.from('moshe_workers').select('*').order('name'),
    db.from('moshe_worker_project_permissions').select('*'),
    db.from('moshe_worker_logs').select('*').order('log_date', { ascending: false }).limit(200),
    db.from('moshe_worker_tasks').select('*').order('created_at', { ascending: false }),
    db.from('moshe_projects').select('id, name, status').order('name'),
  ])

  const workersArr  = (workers as any[]) ?? []
  const permsArr    = (permissions as any[]) ?? []
  const logsArr     = (logs as any[]) ?? []
  const tasksArr    = (tasks as any[]) ?? []
  const projectsArr = (projects as any[]) ?? []

  const workersWithData = workersArr.map((w: any) => ({
    ...w,
    permissions: permsArr.filter((p: any) => p.worker_id === w.id),
    logs:        logsArr.filter((l: any) => l.worker_id === w.id),
    tasks:       tasksArr.filter((t: any) => t.worker_id === w.id),
  }))

  return <WorkersManager workers={workersWithData} projects={projectsArr} />
}
