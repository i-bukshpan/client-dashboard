'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, CheckSquare, Calendar,
  Wallet, BarChart3, Settings, HelpCircle, Shield, MessageSquare
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'היום שלי', href: '/', icon: LayoutDashboard },
  { name: 'לקוחות', href: '/clients', icon: Users },
  { name: 'משימות', href: '/tasks', icon: CheckSquare },
  { name: 'יומן', href: '/calendar', icon: Calendar },
  { name: 'הודעות', href: '/messages', icon: MessageSquare },
  { name: 'כספים', href: '/cashflow', icon: Wallet },
  { name: 'דוחות', href: '/reports', icon: BarChart3 },
  { name: 'תקינות מערכת', href: '/admin/system-health', icon: Shield },
  { name: 'הגדרות', href: '/admin/manage', icon: Settings },
  { name: 'עזרה', href: '/help', icon: HelpCircle },
]

export function Sidebar({ onClose, isCollapsed = false }: { onClose?: () => void, isCollapsed?: boolean }) {
  const pathname = usePathname()

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
          const isActive = item.href === '/' 
            ? pathname === '/' 
            : pathname?.startsWith(item.href)

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
