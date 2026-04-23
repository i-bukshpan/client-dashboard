import { createClient } from '@/lib/supabase/server'
import { DashboardKPIs } from '@/components/dashboard/DashboardKPIs'
import { DashboardTimeline } from '@/components/dashboard/DashboardTimeline'
import { UpcomingTasks } from '@/components/dashboard/UpcomingTasks'

export const metadata = { title: 'לוח בקרה | Nehemiah OS' }
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const today = new Date()
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]
  const todayStr = today.toISOString().split('T')[0]
  const tomorrowStr = new Date(today.getTime() + 86400000).toISOString().split('T')[0]

  // KPI data
  const [{ data: incomeRows }, { data: expenseRows }, { data: allTasks }, { data: allAppts }] = await Promise.all([
    supabase.from('income').select('amount').gte('date', startOfMonth).lte('date', endOfMonth),
    supabase.from('expenses').select('amount').gte('date', startOfMonth).lte('date', endOfMonth),
    supabase.from('tasks').select('*, clients(id, name), assigned_person:profiles!tasks_assigned_to_fkey(id, full_name, avatar_url)'),
    supabase.from('appointments').select('*, clients(id, name), profiles(id, full_name, avatar_url)')
  ])

  const monthlyIncome = (incomeRows as any[])?.reduce((s, r) => s + Number(r.amount), 0) ?? 0
  const monthlyExpenses = (expenseRows as any[])?.reduce((s, r) => s + Number(r.amount), 0) ?? 0
  const pendingTasksCount = (allTasks as any[])?.filter(t => t.status !== 'done').length ?? 0

  // Today's appointments for Timeline
  const todayAppts = (allAppts as any[])?.filter(a => 
    a.start_time >= `${todayStr}T00:00:00` && a.start_time < `${tomorrowStr}T00:00:00`
  ).sort((a, b) => a.start_time.localeCompare(b.start_time))

  // Upcoming/overdue tasks
  const upcomingTasks = (allTasks as any[])?.filter(t => t.status !== 'done')
    .sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'))
    .slice(0, 5)

  return (
    <div className="space-y-6">
      <DashboardKPIs
        monthlyIncome={monthlyIncome}
        monthlyExpenses={monthlyExpenses}
        pendingTasks={pendingTasksCount}
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <DashboardTimeline appointments={todayAppts ?? []} />
        </div>
        <div>
          <UpcomingTasks tasks={upcomingTasks ?? []} />
        </div>
      </div>
    </div>
  )
}

