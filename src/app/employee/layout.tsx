import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import type { Profile } from '@/types/database'
// Removed hardcoded employeeNav, now using standard Sidebar

export default async function EmployeeLayout({
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

  if ((profile as any)?.role === 'admin') redirect('/admin/dashboard')

  const { count: unreadCount } = await supabase
    .from('chat_messages')
    .select('*, chat_read_receipts!left(id)', { count: 'exact', head: true })
    .neq('sender_id', user.id)
    .is('chat_read_receipts.id', null)

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <Sidebar currentUserId={user.id} unreadMessages={unreadCount ?? 0} role="employee" />

      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar title="פורטל עובד" profile={profile as any} unreadMessages={unreadCount ?? 0} currentUserId={user.id} role="employee" />
        <main className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-950">
          {children}
        </main>
      </div>
    </div>
  )
}

