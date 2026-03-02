'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, Shield, BarChart3, Settings, Target, Calendar, MessageSquare, HelpCircle, Activity, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'לוח בקרה', href: '/', icon: LayoutDashboard },
  { name: 'ניהול מרכזי', href: '/admin/manage', icon: Settings },
  { name: 'יעדים', href: '/goals', icon: Target },
  { name: 'לוח זמנים', href: '/calendar', icon: Calendar },
  { name: 'תקשורת', href: '/communication', icon: MessageSquare },
  { name: 'סטטיסטיקות', href: '/statistics', icon: BarChart3 },
  { name: 'דוחות', href: '/reports/financial', icon: FileText },
  { name: 'פעילות', href: '/activity', icon: Activity },
  { name: 'עזרה', href: '/help', icon: HelpCircle },
]

export function Sidebar({ onClose, isCollapsed = false }: { onClose?: () => void, isCollapsed?: boolean }) {
  const pathname = usePathname()
  const [unreadChatCount, setUnreadChatCount] = useState(0)

  useEffect(() => {
    const handleUnreadCount = (e: any) => {
      setUnreadChatCount(e.detail || 0)
    }
    // @ts-ignore
    window.addEventListener('chat-unread-count', handleUnreadCount)
    // @ts-ignore
    return () => window.removeEventListener('chat-unread-count', handleUnreadCount)
  }, [])

  return (
    <div className="flex h-screen w-full flex-col bg-slate-900 dark:bg-[#0a0f1a] relative overflow-hidden transition-colors duration-300">
      {/* Decorative background accents */}
      <div className="absolute top-0 left-0 w-full h-64 bg-primary/8 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-48 h-48 bg-purple-500/5 blur-[80px] pointer-events-none" />

      <div className={cn("flex h-24 items-center px-4 relative z-10 transition-all duration-500", isCollapsed ? "justify-center" : "justify-center px-8")}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-500/30 transition-transform hover:scale-105">
            N
          </div>
          <h1 className={cn("text-xl font-black text-white tracking-tight transition-all duration-500 overflow-hidden whitespace-nowrap", isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100")}>ניהול לקוחות</h1>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-4 relative z-10 overflow-y-auto no-scrollbar">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          const showBadge = item.name === 'תקשורת' && unreadChatCount > 0

          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onClose}
              className={cn(
                'flex items-center rounded-2xl py-3 text-sm font-bold transition-all duration-300 group overflow-hidden whitespace-nowrap relative',
                isCollapsed ? 'justify-center px-0' : 'justify-between px-5',
                isActive
                  ? 'bg-gradient-to-l from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/20'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              )}
              title={isCollapsed ? item.name : undefined}
            >
              <div className={cn("flex items-center", isCollapsed ? "" : "gap-3.5")}>
                <item.icon className={cn(
                  "h-[18px] w-[18px] shrink-0 transition-all duration-300",
                  isActive
                    ? "text-white"
                    : "text-slate-500 group-hover:text-blue-400"
                )} />
                <span className={cn("transition-all duration-500", isCollapsed ? "w-0 opacity-0 hidden" : "opacity-100 block")}>
                  {item.name}
                </span>
              </div>

              {/* Active indicator dot */}
              {isActive && !isCollapsed && (
                <div className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse" />
              )}

              {showBadge && (
                <span className={cn("flex items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white shrink-0",
                  isCollapsed ? "absolute top-2 right-2 h-3 w-3" : "h-5 min-w-[20px] px-1.5"
                )}>
                  {!isCollapsed && unreadChatCount}
                </span>
              )}
            </Link>
          )
        })}
      </div>

      {/* User profile card */}
      <div className="mt-auto p-4 relative z-10">
        <div className={cn(
          "bg-white/[0.04] backdrop-blur-md rounded-2xl border border-white/[0.06] flex items-center group hover:bg-white/[0.08] transition-all duration-500 cursor-pointer overflow-hidden whitespace-nowrap",
          isCollapsed ? "p-2 justify-center" : "p-4 gap-3.5"
        )}
          title={isCollapsed ? "נחמיה דרוק" : undefined}>
          <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white font-bold text-xs border border-white/10 transition-transform group-hover:scale-105">
            ND
          </div>
          <div className={cn("flex-1 overflow-hidden transition-all duration-500", isCollapsed ? "w-0 opacity-0 hidden" : "opacity-100 block")}>
            <p className="text-sm font-bold text-white truncate">נחמיה דרוק</p>
            <p className="text-[10px] font-medium text-slate-500 mt-0.5">יועץ פיננסי</p>
          </div>
        </div>
      </div>
    </div>
  )
}
