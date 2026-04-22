import { createClient } from '@/lib/supabase/server'
import { DashboardKPIs } from '@/components/dashboard/DashboardKPIs'
import { DashboardTimeline } from '@/components/dashboard/DashboardTimeline'
import { UpcomingTasks } from '@/components/dashboard/UpcomingTasks'

export const metadata = { title: 'לוח בקרה | Nehemiah OS' }

export default async function DashboardPage() {
  const supabase = await createClient()
  const today = new Date()
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]
  const todayStr = today.toISOString().split('T')[0]
  const tomorrowStr = new Date(today.getTime() + 86400000).toISOString().split('T')[0]

  // KPI data
  const [{ data: incomeRows }, { data: expenseRows }, { count: pendingTasks }] = await Promise.all([
    supabase.from('income').select('amount').gte('date', startOfMonth).lte('date', endOfMonth),
    supabase.from('expenses').select('amount').gte('date', startOfMonth).lte('date', endOfMonth),
    supabase.from('tasks').select('*', { count: 'exact', head: true }).neq('status', 'done'),
  ])

  const monthlyIncome = incomeRows?.reduce((s, r) => s + Number(r.amount), 0) ?? 0
  const monthlyExpenses = expenseRows?.reduce((s, r) => s + Number(r.amount), 0) ?? 0

  // Today's appointments
  const { data: appointments } = await supabase
    .from('appointments')
    .select('*, clients(id, name), profiles(id, full_name, avatar_url)')
    .gte('start_time', `${todayStr}T00:00:00`)
    .lt('start_time', `${tomorrowStr}T00:00:00`)
    .order('start_time', { ascending: true })

  // Upcoming/overdue tasks
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*, clients(id, name), profiles(id, full_name, avatar_url)')
    .neq('status', 'done')
    .order('due_date', { ascending: true })
    .limit(5)

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <DashboardKPIs
        monthlyIncome={monthlyIncome}
        monthlyExpenses={monthlyExpenses}
        pendingTasks={pendingTasks ?? 0}
      />

      {/* Main content */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Timeline takes 2/3 */}
        <div className="xl:col-span-2">
          <DashboardTimeline appointments={appointments ?? []} />
        </div>
        {/* Upcoming tasks takes 1/3 */}
        <div>
          <UpcomingTasks tasks={tasks ?? []} />
        </div>
      </div>
    </div>
  )
}
