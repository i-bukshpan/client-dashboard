'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  DollarSign,
  CheckSquare,
  UserCog,
  MessageSquare,
  TrendingUp,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'

const navItems = [
  { href: '/admin/dashboard', icon: LayoutDashboard, label: 'לוח בקרה' },
  { href: '/admin/crm', icon: Users, label: 'לקוחות (CRM)' },
  { href: '/admin/finance', icon: DollarSign, label: 'פיננסים' },
  { href: '/admin/tasks', icon: CheckSquare, label: 'משימות' },
  { href: '/admin/team', icon: UserCog, label: 'ניהול צוות' },
  { href: '/admin/chat', icon: MessageSquare, label: 'צ׳אט פנימי' },
]

interface SidebarProps {
  urgentCount?: number
  unreadMessages?: number
}

export function Sidebar({ urgentCount = 0, unreadMessages = 0 }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="flex flex-col h-full bg-[var(--sidebar)] text-[var(--sidebar-foreground)] w-64 shrink-0">
      {/* Logo */}
      <div className="p-5 border-b border-[var(--sidebar-border)]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/40">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-black text-white text-sm leading-none">Nehemiah OS</p>
            <p className="text-blue-400 text-xs mt-0.5">ניהול עסקי</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href)
          const isChat = item.href === '/admin/chat'
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group',
                active
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] hover:text-white'
              )}
            >
              <item.icon className={cn('w-5 h-5 shrink-0', active ? 'text-white' : 'text-blue-400 group-hover:text-white')} />
              <span className="flex-1">{item.label}</span>
              {isChat && unreadMessages > 0 && (
                <Badge className="bg-red-500 text-white text-xs px-1.5 py-0 min-w-[1.25rem] h-5 rounded-full flex items-center justify-center">
                  {unreadMessages}
                </Badge>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Urgent Alerts Widget */}
      {urgentCount > 0 && (
        <div className="p-3 border-t border-[var(--sidebar-border)]">
          <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-red-400 pulse-soft" />
              <span className="text-red-300 text-xs font-semibold">התראות דחופות</span>
            </div>
            <p className="text-red-200 text-xs">{urgentCount} משימות באיחור</p>
            <Link href="/admin/tasks" className="text-red-400 text-xs underline mt-1 block">
              צפה בכולן
            </Link>
          </div>
        </div>
      )}

      {/* Version */}
      <div className="p-4 border-t border-[var(--sidebar-border)]">
        <p className="text-[var(--sidebar-foreground)] text-xs opacity-30 text-center">v1.0.0</p>
      </div>
    </aside>
  )
}

