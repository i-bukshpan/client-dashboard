'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, Shield, BarChart3, Settings, Target, Calendar, MessageSquare, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'לוח בקרה', href: '/', icon: LayoutDashboard },
  { name: 'ניהול מרכזי', href: '/admin/manage', icon: Settings },
  { name: 'יעדים', href: '/goals', icon: Target },
  { name: 'לוח זמנים', href: '/calendar', icon: Calendar },
  { name: 'תקשורת', href: '/communication', icon: MessageSquare },
  { name: 'סטטיסטיקות', href: '/statistics', icon: BarChart3 },
  { name: 'עזרה', href: '/help', icon: HelpCircle },
]

export function Sidebar() {
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
    <div className="flex h-screen w-64 flex-col bg-navy text-white">
      <div className="flex h-16 items-center justify-center border-b border-navy/50 px-6">
        <h1 className="text-xl font-bold">ניהול לקוחות</h1>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          const showBadge = item.name === 'תקשורת' && unreadChatCount > 0

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center justify-between rounded-lg px-4 py-3 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-emerald text-white'
                  : 'text-grey hover:bg-navy/80 hover:text-white'
              )}
            >
              <div className="flex items-center gap-3">
                <item.icon className="h-5 w-5" />
                {item.name}
              </div>
              {showBadge && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white animate-pulse">
                  {unreadChatCount}
                </span>
              )}
            </Link>
          )
        })}
      </div>
      <div className="border-t border-navy/50 p-4">
        <p className="text-sm text-grey">נחמיה דרוק</p>
        <p className="text-xs text-grey/70">יועץ פיננסי</p>
      </div>
    </div>
  )
}

