import { createClient } from '@/lib/supabase/server'
import { KanbanBoard } from '@/components/tasks/KanbanBoard'
import { CheckSquare } from 'lucide-react'

export const metadata = { title: 'המשימות שלי | Nehemiah OS' }

export default async function EmployeeTasksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*, clients(id, name), profiles(id, full_name, avatar_url)')
    .eq('assigned_to', user!.id)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
          <CheckSquare className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h2 className="font-bold text-xl">המשימות שלי</h2>
          <p className="text-muted-foreground text-sm">נהל את המשימות ששויכו אליך</p>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <KanbanBoard initialTasks={(tasks as any[]) ?? []} />
      </div>
    </div>
  )
}
