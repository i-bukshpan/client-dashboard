'use client'

import { useState } from 'react'
import Link from 'next/link'
import { logout } from '@/app/(auth)/login/actions'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Bell, LogOut, Menu, Moon, Settings, Sun, AlertTriangle, MessageSquare, CheckSquare } from 'lucide-react'
import type { Profile } from '@/types/database'
import { SidebarContent } from './Sidebar'
import { GlobalSearch } from './GlobalSearch'
import { TopBarBell } from './TopBarBell'

interface TopBarProps {
  title: string
  profile: Profile | null
  urgentCount?: number
  unreadMessages?: number
  currentUserId?: string
  role?: 'admin' | 'employee' | 'client'
}

export function TopBar({ title, profile, urgentCount = 0, unreadMessages = 0, currentUserId = '', role = 'admin' }: TopBarProps) {
  const [dark, setDark] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)

  function toggleDark() {
    setDark(!dark)
    document.documentElement.classList.toggle('dark')
  }

  const isVIPAdmin = !profile
  const displayName = profile?.full_name || 'מנהל ראשי'
  const roleDisplay = isVIPAdmin || (profile as any)?.role === 'admin' ? 'מנהל ראשי' : 'עובד'
  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)
    : 'מ'

  const totalNotifications = urgentCount + unreadMessages

  return (
    <header className="h-16 border-b border-border bg-card/80 backdrop-blur-sm flex items-center px-4 gap-3 shrink-0">
      {/* Mobile menu button — visible only on mobile, opens sidebar sheet */}
      <Button
        variant="outline"
        size="icon"
        className="lg:hidden rounded-xl border-border/60 bg-muted/40 hover:bg-muted text-foreground shrink-0"
        onClick={() => setMobileMenuOpen(true)}
        aria-label="פתח תפריט"
      >
        <Menu className="w-5 h-5" />
      </Button>

      {/* Page title */}
      <h1 className="text-lg font-bold text-foreground flex-1 truncate">{title}</h1>

      {/* Global Search */}
      <GlobalSearch role={role} />

      {/* Actions */}
      <div className="flex items-center gap-1">
        {/* Dark mode toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="rounded-xl text-muted-foreground hover:text-foreground"
          onClick={toggleDark}
          title={dark ? 'מצב בהיר' : 'מצב כהה'}
        >
          {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>

        {/* Notifications — realtime badge */}
        <TopBarBell
          currentUserId={currentUserId}
          initialUnread={unreadMessages}
          urgentCount={urgentCount}
          onClick={() => setNotifOpen(true)}
        />

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-accent transition-colors cursor-pointer outline-none border-none bg-transparent">
            <Avatar className="w-8 h-8">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-slate-900 text-white text-xs font-bold">{initials}</AvatarFallback>
            </Avatar>
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-foreground leading-none">{displayName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{roleDisplay}</p>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 mt-1">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground">חשבון שלי</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 text-slate-400 cursor-not-allowed">
                <Settings className="w-4 h-4" />
                הגדרות (בקרוב)
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 text-destructive focus:text-destructive cursor-pointer"
              onClick={() => logout()}
            >
              <LogOut className="w-4 h-4" />
              התנתקות
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Mobile Sidebar Sheet */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="right" showCloseButton={true} className="p-0 w-72 bg-[var(--sidebar)] text-[var(--sidebar-foreground)] flex flex-col [&_button[data-slot=sheet-close]]:text-white [&_button[data-slot=sheet-close]]:hover:bg-white/10">
          <SidebarContent
            urgentCount={urgentCount}
            unreadMessages={unreadMessages}
            currentUserId={currentUserId}
            role={role}
            collapsed={false}
            onClose={() => setMobileMenuOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Notification Center Sheet */}
      <Sheet open={notifOpen} onOpenChange={setNotifOpen}>
        <SheetContent side="left" className="w-80 flex flex-col gap-0">
          <SheetHeader className="pb-4 border-b border-border">
            <SheetTitle className="text-base font-bold">התראות</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto py-2">
            {totalNotifications === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground">
                <Bell className="w-10 h-10 opacity-20" />
                <p className="text-sm">אין התראות חדשות</p>
              </div>
            ) : (
              <div className="space-y-1 px-2">
                {urgentCount > 0 && (
                  <Link
                    href={role === 'admin' ? '/admin/tasks' : '/employee/tasks'}
                    onClick={() => setNotifOpen(false)}
                    className="flex items-start gap-3 p-3 rounded-xl hover:bg-accent transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">משימות באיחור</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {urgentCount} משימות שחלף מועד הגשתן
                      </p>
                    </div>
                  </Link>
                )}
                {unreadMessages > 0 && (
                  <Link
                    href={role === 'admin' ? '/admin/chat' : '/employee/chat'}
                    onClick={() => setNotifOpen(false)}
                    className="flex items-start gap-3 p-3 rounded-xl hover:bg-accent transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                      <MessageSquare className="w-4 h-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">הודעות חדשות</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {unreadMessages} הודעות שלא נקראו
                      </p>
                    </div>
                  </Link>
                )}
              </div>
            )}
          </div>

          <div className="p-4 border-t border-border">
            <Link
              href={role === 'admin' ? '/admin/tasks' : '/employee/tasks'}
              onClick={() => setNotifOpen(false)}
              className="flex items-center gap-2 text-xs text-primary hover:underline"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              צפה בכל המשימות
            </Link>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  )
}
