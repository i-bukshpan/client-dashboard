/**
 * Layout for the Nehemiah OS v2 Workspace.
 * Route group (workspace) keeps this separate from /admin — no sidebar clutter.
 * This layout is admin-only and shares the same dark design language.
 */

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { TrendingUp, Users, ArrowLeft, CalendarDays, WalletCards, ClipboardCheck, Sun, Mail } from 'lucide-react'
import {
  requireWorkspaceAdmin,
  WorkspaceAccessError,
} from '@/lib/v2/workspace-dal'

import { GlobalAgentPanel } from '@/components/workspace/GlobalAgentPanel'

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  try {
    await requireWorkspaceAdmin()
  } catch (error) {
    if (error instanceof WorkspaceAccessError && error.code === 'FORBIDDEN') {
      redirect('/employee/dashboard')
    }
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col relative">
      {/* Top navigation bar */}
      <header className="h-14 border-b border-[var(--border)] bg-[var(--card)] flex items-center px-6 gap-4 shrink-0 shadow-sm">
        {/* Logo */}
        <Link
          href="/workspace/clients"
          className="flex items-center gap-2.5 group"
        >
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30 shrink-0 group-hover:scale-105 transition-transform">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <div className="leading-none">
            <p className="font-black text-foreground text-sm">Nehemiah OS</p>
            <p className="text-[10px] text-muted-foreground font-medium tracking-wide">
              v2 · Workspace
            </p>
          </div>
        </Link>

        <div className="h-6 w-px bg-border mx-1" />

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          <Link
            href="/workspace/brief"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Sun className="w-3.5 h-3.5 text-amber-500" />
            בריף יומי
          </Link>
          <Link
            href="/workspace/clients"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Users className="w-3.5 h-3.5" />
            לקוחות
          </Link>
          <Link
            href="/workspace/emails"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Mail className="w-3.5 h-3.5 text-red-500" />
            דוא״ל Gmail
          </Link>
          <Link
            href="/workspace/calendar"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <CalendarDays className="w-3.5 h-3.5" />
            יומן
          </Link>
          <Link
            href="/workspace/internal-finance"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <WalletCards className="w-3.5 h-3.5" />
            כספי הסוכנות
          </Link>
          <Link
            href="/workspace/tasks"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            משימות
          </Link>
        </nav>

        <div className="flex-1" />

        {/* Back to legacy admin */}
        <Link
          href="/admin/dashboard"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          חזרה לניהול
        </Link>
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>

      {/* Global AI Executive Assistant (J.A.R.V.I.S) */}
      <GlobalAgentPanel />
    </div>
  )
}
