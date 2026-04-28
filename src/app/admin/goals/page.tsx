import { createClient } from '@/lib/supabase/server'
import { GoalsManager } from '@/components/goals/GoalsManager'
import { Target } from 'lucide-react'

export const metadata = { title: 'ניהול יעדים | Nehemiah OS' }
export const dynamic = 'force-dynamic'

export default async function GoalsPage() {
  const supabase = await createClient()

  const [
    { data: goals },
    { data: employees },
    { data: clients }
  ] = await Promise.all([
    supabase.from('goals').select('*, assigned_employee:profiles!goals_assigned_employee_fkey(id, full_name), assigned_client:clients!goals_assigned_client_fkey(id, name)').order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name').eq('role', 'employee'),
    supabase.from('clients').select('id, name')
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center shadow-inner">
          <Target className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h2 className="font-bold text-xl">יעדים ומדדים</h2>
          <p className="text-muted-foreground text-sm">מעקב אחרי התקדמות ויעדים כלליים/אישיים</p>
        </div>
      </div>

      <GoalsManager 
        initialGoals={(goals as any[]) ?? []} 
        employees={(employees as any[]) ?? []} 
        clients={(clients as any[]) ?? []} 
      />
    </div>
  )
}
