import { createClient } from '@/lib/supabase/server'
import { KanbanBoard } from '@/components/tasks/KanbanBoard'
import { CheckSquare, Plus } from 'lucide-react'
import { AddTaskDialog } from '@/components/tasks/AddTaskDialog'

export const metadata = { title: 'משימות | Nehemiah OS' }

export default async function TasksPage() {
  const supabase = await createClient()

  const [{ data: tasks }, { data: clients }, { data: employees }] = await Promise.all([
    supabase.from('tasks').select('*, clients(id, name), profiles(id, full_name, avatar_url)').order('created_at', { ascending: false }),
    supabase.from('clients').select('id, name').order('name'),
    supabase.from('profiles').select('id, full_name').order('full_name'),
  ])

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <CheckSquare className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 className="font-bold text-xl">לוח משימות</h2>
            <p className="text-muted-foreground text-sm">מעקב וניהול משימות צוות ולקוחות</p>
          </div>
        </div>
        <AddTaskDialog clients={(clients as any[]) ?? []} employees={(employees as any[]) ?? []} />
      </div>

      <div className="flex-1 min-h-0">
        <KanbanBoard initialTasks={(tasks as any[]) ?? []} />
      </div>
    </div>
  )
}
