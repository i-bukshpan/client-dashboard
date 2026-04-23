import { createClient } from '@/lib/supabase/server'
import { CalendarView } from '@/components/dashboard/CalendarView'
import { Calendar as CalendarIcon } from 'lucide-react'

export const metadata = { title: 'יומן אירועים | Nehemiah OS' }
export const dynamic = 'force-dynamic'

export default async function CalendarPage() {
  const supabase = await createClient()

  // Fetch all relevant data for the calendar
  const [
    { data: income }, 
    { data: expenses }, 
    { data: tasks },
    { data: appointments }
  ] = await Promise.all([
    supabase.from('income').select('*, clients(id, name)'),
    supabase.from('expenses').select('*'),
    supabase.from('tasks').select('*, clients(id, name), assigned_person:profiles!tasks_assigned_to_fkey(id, full_name, avatar_url)'),
    supabase.from('appointments').select('*, clients(id, name), profiles(id, full_name, avatar_url)')
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <CalendarIcon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-bold text-xl">יומן אירועים</h2>
            <p className="text-muted-foreground text-sm">ניהול ומעקב משימות, פגישות ותזרים בלוח שנה</p>
          </div>
        </div>
      </div>

      <div>
        <CalendarView 
          tasks={(tasks as any[]) ?? []} 
          income={(income as any[]) ?? []} 
          expenses={(expenses as any[]) ?? []} 
          appointments={(appointments as any[]) ?? []}
        />
      </div>
    </div>
  )
}
