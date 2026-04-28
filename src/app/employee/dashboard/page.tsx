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
    { data: payments },
    { data: announcements }
  ] = await Promise.all([
    supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('assigned_to', user!.id).neq('status', 'done'),
    supabase.from('tasks').select('*, clients(id, name)').eq('assigned_to', user!.id).neq('status', 'done').order('due_date', { ascending: true }).limit(5),
    supabase.from('chat_messages').select('*', { count: 'exact', head: true }).neq('sender_id', user!.id),
    supabase.from('profiles').select('*').eq('id', user!.id).single(),
    supabase.from('employee_bonuses').select('*').eq('employee_id', user!.id).gte('date', startOfMonth).lte('date', endOfMonth),
    supabase.from('expenses').select('*').eq('category', 'משכורות').ilike('notes', `%[EMP:${user!.id}]%`).gte('date', startOfMonth).lte('date', endOfMonth),
    supabase.from('employee_announcements')
      .select('*')
      .eq('is_active', true)
      .or(`target_employee_id.is.null,target_employee_id.eq.${user!.id}`)
      .order('created_at', { ascending: false })
      .limit(5)
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-xl text-slate-900">לוח בקרה אישי</h2>
        <MonthYearSelector currentMonth={currentMonth} currentYear={currentYear} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border/50 bg-white/50 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-300">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shadow-inner">
              <CheckSquare className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">משימות פתוחות</p>
              <p className="text-3xl font-black text-slate-900 leading-tight">{myTasks ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-white/50 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-300">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shadow-inner">
              <MessageSquare className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">הודעות חדשות</p>
              <p className="text-3xl font-black text-slate-900 leading-tight">{unreadMessages ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-white/50 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-300">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shadow-inner">
              <Clock className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">פגישות היום</p>
              <p className="text-3xl font-black text-slate-900 leading-tight">0</p>
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
            <CardContent className="p-0">
              {!(announcements as any[]) || (announcements as any[]).length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-sm text-muted-foreground italic">אין הודעות מערכת חדשות</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {(announcements as any[]).map(ann => (
                    <div key={ann.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                      <h4 className="font-bold text-sm text-slate-900">{ann.title}</h4>
                      <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">{ann.content}</p>
                      <p className="text-[10px] text-muted-foreground mt-2">
                        {new Date(ann.created_at).toLocaleDateString('he-IL')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
