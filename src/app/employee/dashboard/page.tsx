import { createClient } from '@/lib/supabase/server'
import { UpcomingTasks } from '@/components/dashboard/UpcomingTasks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckSquare, Clock, MessageSquare } from 'lucide-react'
import { EmployeeSalaryView } from '@/components/employee/EmployeeSalaryView'
import { MonthYearSelector } from '@/components/team/MonthYearSelector'

export const metadata = { title: 'לוח בקרה עובד | Nehemiah OS' }

export default async function EmployeeDashboard({ searchParams }: { searchParams: Promise<{ month?: string, year?: string }> }) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Month/Year filtering
  const today = new Date()
  const currentMonth = params.month ? parseInt(params.month) : today.getMonth() + 1
  const currentYear = params.year ? parseInt(params.year) : today.getFullYear()
  
  const startOfMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`
  const lastDay = new Date(currentYear, currentMonth, 0).getDate()
  const endOfMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  // Fetch employee stats and salary data
  const [
    { count: myTasks }, 
    { data: recentTasks }, 
    { count: unreadMessages },
    { data: profile },
    { data: bonuses },
    { data: payments }
  ] = await Promise.all([
    supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('assigned_to', user!.id).neq('status', 'done'),
    supabase.from('tasks').select('*, clients(id, name)').eq('assigned_to', user!.id).neq('status', 'done').order('due_date', { ascending: true }).limit(5),
    supabase.from('chat_messages').select('*', { count: 'exact', head: true }).neq('sender_id', user!.id),
    supabase.from('profiles').select('*').eq('id', user!.id).single(),
    supabase.from('employee_bonuses').select('*').eq('employee_id', user!.id).gte('date', startOfMonth).lte('date', endOfMonth),
    supabase.from('expenses').select('*').eq('category', 'משכורות').ilike('notes', `%[EMP:${user!.id}]%`).gte('date', startOfMonth).lte('date', endOfMonth)
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-xl text-slate-900">לוח בקרה אישי</h2>
        <MonthYearSelector currentMonth={currentMonth} currentYear={currentYear} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border/50">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center">
              <CheckSquare className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">משימות פתוחות</p>
              <p className="text-2xl font-black">{myTasks ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">הודעות חדשות</p>
              <p className="text-2xl font-black">{unreadMessages ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center">
              <Clock className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">פגישות היום</p>
              <p className="text-2xl font-black">0</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <UpcomingTasks tasks={(recentTasks as any[]) ?? []} />
          <EmployeeSalaryView 
            salaryBase={Number(profile?.salary_base || 0)} 
            bonuses={(bonuses as any[]) ?? []} 
            payments={(payments as any[]) ?? []} 
          />
        </div>
        <div className="space-y-6">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base">הודעות מהנהלה</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground italic">אין הודעות מערכת חדשות</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
