'use client'

import { useState, useEffect } from 'react'
import { Moon, Sun, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'

type Theme = 'light' | 'dark' | 'system'

export function ThemeToggle() {
    const [theme, setTheme] = useState<Theme>('system')
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
        const saved = localStorage.getItem('theme') as Theme | null
        if (saved) {
            setTheme(saved)
            applyTheme(saved)
        }
    }, [])

    const applyTheme = (t: Theme) => {
        const root = document.documentElement
        root.classList.remove('dark', 'light')

        if (t === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
            root.classList.add(prefersDark ? 'dark' : 'light')
        } else {
            root.classList.add(t)
        }
    }

    const cycleTheme = () => {
        const next: Theme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'
        setTheme(next)
        localStorage.setItem('theme', next)
        applyTheme(next)
    }

    // Listen for system preference changes when in "system" mode
    useEffect(() => {
        if (theme !== 'system') return
        const media = window.matchMedia('(prefers-color-scheme: dark)')
        const handler = () => applyTheme('system')
        media.addEventListener('change', handler)
        return () => media.removeEventListener('change', handler)
    }, [theme])

    if (!mounted) {
        return (
            <div className="h-10 w-10 rounded-xl bg-slate-100/50 dark:bg-slate-800/50 animate-pulse" />
        )
    }

    const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor
    const label = theme === 'light' ? 'בהיר' : theme === 'dark' ? 'כהה' : 'אוטומטי'

    return (
        <button
            onClick={cycleTheme}
            className={cn(
                "h-10 w-10 rounded-xl flex items-center justify-center",
                "transition-all duration-300 active:scale-90",
                "bg-slate-100/80 hover:bg-slate-200/80 text-slate-600",
                "dark:bg-slate-800/80 dark:hover:bg-slate-700/80 dark:text-slate-300",
                "border border-slate-200/50 dark:border-slate-700/50"
            )}
            title={`מצב תצוגה: ${label}`}
            aria-label={`שנה מצב תצוגה ל${label}`}
        >
            <Icon className="h-4.5 w-4.5" />
        </button>
    )
}
