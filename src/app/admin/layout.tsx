import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import type { Profile } from '@/types/database'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if ((profile as any)?.role !== 'admin') redirect('/employee/dashboard')

  // Fetch urgent alerts count (overdue tasks)
  const today = new Date().toISOString().split('T')[0]
  const { count: urgentCount } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .neq('status', 'done')
    .lt('due_date', today)

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <Sidebar urgentCount={urgentCount ?? 0} />

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar title="Nehemiah OS" profile={profile as any} />
        <main className="flex-1 overflow-y-auto p-6 page-enter">
          {children}
        </main>
      </div>
    </div>
  )
}
