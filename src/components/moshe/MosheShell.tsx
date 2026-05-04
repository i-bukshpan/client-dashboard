'use client'

import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { MosheSidebar } from './MosheSidebar'

interface Props {
  isAdmin: boolean
  children: React.ReactNode
}

export function MosheShell({ isAdmin, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-[#0f172a]" dir="rtl">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 right-0 z-30 w-56 transform transition-transform duration-200
        lg:relative lg:translate-x-0 lg:z-auto
        ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <MosheSidebar isAdmin={isAdmin} onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden bg-slate-50 min-w-0">
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-slate-100 flex items-center px-4 gap-3 shrink-0 shadow-sm">
          {/* Hamburger — mobile only */}
          <button
            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
            onClick={() => setSidebarOpen(true)}
            aria-label="פתח תפריט"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-widest hidden sm:block">פורטל ניהול</p>
            <p className="text-sm font-bold text-slate-800 leading-tight truncate">משה פרוש — פרויקטי נדל״ן</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isAdmin && (
              <a
                href="/admin/dashboard"
                className="text-xs text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg px-3 py-1.5 transition-colors hidden sm:inline-flex"
              >
                ← חזרה לניהול
              </a>
            )}
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
              מפ
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
