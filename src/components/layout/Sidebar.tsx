'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  DollarSign,
  CheckSquare,
  UserCog,
  MessageSquare,
  TrendingUp,
  AlertTriangle,
  Calendar as CalendarIcon,
  Target,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react'
import { SidebarUnreadBadge } from './SidebarUnreadBadge'

const navItems = [
  { href: '/admin/dashboard', icon: LayoutDashboard, label: 'לוח בקרה' },
  { href: '/admin/calendar', icon: CalendarIcon, label: 'יומן אירועים' },
  { href: '/admin/crm', icon: Users, label: 'לקוחות (CRM)' },
  { href: '/admin/finance', icon: DollarSign, label: 'פיננסים' },
  { href: '/admin/goals', icon: Target, label: 'יעדים ומדדים' },
  { href: '/admin/tasks', icon: CheckSquare, label: 'משימות' },
  { href: '/admin/team', icon: UserCog, label: 'ניהול צוות' },
  { href: '/admin/chat', icon: MessageSquare, label: 'צ׳אט פנימי' },
  // Employee routes
  { href: '/employee/dashboard', icon: LayoutDashboard, label: 'לוח בקרה' },
  { href: '/employee/tasks', icon: CheckSquare, label: 'משימות שלי' },
  { href: '/employee/chat', icon: MessageSquare, label: 'צ׳אט עם מנהל' },
]

interface SidebarProps {
  urgentCount?: number
  unreadMessages?: number
  currentUserId?: string
  role?: 'admin' | 'employee' | 'client'
  onClose?: () => void
}

export function SidebarContent({
  urgentCount = 0,
  unreadMessages = 0,
  currentUserId = '',
  role = 'admin',
  collapsed = false,
  onClose,
}: SidebarProps & { collapsed?: boolean }) {
  const pathname = usePathname()

  const filteredItems = navItems.filter(item => {
    if (role === 'admin') return item.href.startsWith('/admin')
    if (role === 'employee') return item.href.startsWith('/employee')
    return false
  })

  return (
    <>
      {/* Logo */}
      <div className={cn('border-b border-[var(--sidebar-border)]', collapsed ? 'p-3' : 'p-5')}>
        <div className={cn('flex items-center', collapsed ? 'justify-center' : 'gap-3')}>
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/40 shrink-0">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div>
              <p className="font-black text-white text-sm leading-none">Nehemiah OS</p>
              <p className="text-blue-400 text-xs mt-0.5">ניהול עסקי</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className={cn('flex-1 overflow-y-auto space-y-1', collapsed ? 'p-2' : 'p-3')}>
        {filteredItems.map((item) => {
          const active = pathname.startsWith(item.href)
          const isChat = item.href.includes('chat')
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              title={collapsed ? item.label : undefined}
              className={cn(
                'flex items-center rounded-xl text-sm font-medium transition-all duration-150 group',
                collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5',
                active
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] hover:text-white'
              )}
            >
              <item.icon className={cn('w-5 h-5 shrink-0', active ? 'text-white' : 'text-blue-400 group-hover:text-white')} />
              {!collapsed && <span className="flex-1">{item.label}</span>}
              {!collapsed && isChat && (
                <SidebarUnreadBadge currentUserId={currentUserId} initialCount={unreadMessages} />
              )}
              {collapsed && isChat && unreadMessages > 0 && (
                <span className="absolute top-0 end-0 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Urgent Alerts Widget */}
      {urgentCount > 0 && (
        <div className={cn('border-t border-[var(--sidebar-border)]', collapsed ? 'p-2' : 'p-3')}>
          {collapsed ? (
            <Link
              href="/admin/tasks"
              title={`${urgentCount} משימות באיחור`}
              className="flex justify-center p-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 transition-colors"
            >
              <AlertTriangle className="w-4 h-4 text-red-400 pulse-soft" />
            </Link>
          ) : (
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
          )}
        </div>
      )}

      {/* Version */}
      {!collapsed && (
        <div className="p-4 border-t border-[var(--sidebar-border)]">
          <p className="text-[var(--sidebar-foreground)] text-xs opacity-30 text-center">v1.0.0</p>
        </div>
      )}
    </>
  )
}

export function Sidebar({ urgentCount = 0, unreadMessages = 0, currentUserId = '', role = 'admin' }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved === 'true') setCollapsed(true)
  }, [])

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebar-collapsed', String(next))
  }

  return (
    <aside
      className={cn(
        'hidden lg:flex flex-col h-full bg-[var(--sidebar)] text-[var(--sidebar-foreground)] shrink-0 transition-all duration-300 relative',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <SidebarContent
        urgentCount={urgentCount}
        unreadMessages={unreadMessages}
        currentUserId={currentUserId}
        role={role}
        collapsed={collapsed}
      />

      {/* Collapse toggle */}
      <button
        onClick={toggleCollapsed}
        title={collapsed ? 'הרחב תפריט' : 'כווץ תפריט'}
        className={cn(
          'absolute -end-3 top-20 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md hover:bg-blue-500 transition-colors z-10',
        )}
      >
        {collapsed ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>
    </aside>
  )
}
