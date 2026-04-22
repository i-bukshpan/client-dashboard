'use client'

import { useState } from 'react'
import { logout } from '@/app/(auth)/login/actions'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Bell, LogOut, Moon, Settings, Sun, User } from 'lucide-react'
import type { Profile } from '@/types/database'

interface TopBarProps {
  title: string
  profile: Profile | null
}

export function TopBar({ title, profile }: TopBarProps) {
  const [dark, setDark] = useState(false)

  function toggleDark() {
    setDark(!dark)
    document.documentElement.classList.toggle('dark')
  }

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)
    : 'NA'

  return (
    <header className="h-16 border-b border-border bg-card/80 backdrop-blur-sm flex items-center px-6 gap-4 shrink-0">
      {/* Page title */}
      <h1 className="text-lg font-bold text-foreground flex-1">{title}</h1>

      {/* Actions */}
      <div className="flex items-center gap-2">
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

        {/* Notifications */}
        <Button
          variant="ghost"
          size="icon"
          className="rounded-xl text-muted-foreground hover:text-foreground relative"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 start-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div role="button" className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-accent transition-colors cursor-pointer outline-none">
              <Avatar className="w-8 h-8">
                <AvatarImage src={profile?.avatar_url ?? undefined} />
                <AvatarFallback className="bg-blue-600 text-white text-xs font-bold">{initials}</AvatarFallback>
              </Avatar>
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-foreground leading-none">{profile?.full_name ?? 'מנהל'}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {(profile as any)?.role === 'admin' ? 'מנהל ראשי' : 'עובד'}
                </p>
              </div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 mt-1">
            <DropdownMenuLabel className="text-xs text-muted-foreground">חשבון שלי</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2">
              <User className="w-4 h-4" />
              פרופיל
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2">
              <Settings className="w-4 h-4" />
              הגדרות
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 text-destructive focus:text-destructive"
              onClick={() => logout()}
            >
              <LogOut className="w-4 h-4" />
              התנתקות
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

