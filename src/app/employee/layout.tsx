import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import type { Profile } from '@/types/database'
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  MessageSquare,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

// Simplified sidebar items for employees
const employeeNav = [
  { href: '/employee/dashboard', icon: LayoutDashboard, label: 'לוח בקרה' },
  { href: '/employee/tasks', icon: CheckSquare, label: 'משימות שלי' },
  { href: '/employee/chat', icon: MessageSquare, label: 'צ׳אט עם מנהל' },
]

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

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mini Sidebar */}
      <aside className="w-64 bg-[var(--sidebar)] text-white flex flex-col shrink-0">
        <div className="p-6 border-b border-white/10">
          <p className="font-black text-lg">Nehemiah OS</p>
          <p className="text-xs text-blue-400">פורטל עובד</p>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {employeeNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition-colors text-sm"
            >
              <item.icon className="w-5 h-5 text-blue-400" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar title="פורטל עובד" profile={profile as any} />
        <main className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-950">
          {children}
        </main>
      </div>
    </div>
  )
}

