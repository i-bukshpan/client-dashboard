'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  LayoutDashboard,
  Users,
  DollarSign,
  CheckSquare,
  UserCog,
  MessageSquare,
  Target,
  Calendar as CalendarIcon,
  Search,
  ArrowLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchItem {
  label: string
  description: string
  href: string
  icon: React.ElementType
  keywords: string[]
}

const ADMIN_ITEMS: SearchItem[] = [
  { label: 'לוח בקרה', description: 'סקירה כללית של הנתונים', href: '/admin/dashboard', icon: LayoutDashboard, keywords: ['dashboard', 'home', 'ראשי'] },
  { label: 'יומן אירועים', description: 'ניהול פגישות ואירועים', href: '/admin/calendar', icon: CalendarIcon, keywords: ['calendar', 'meetings', 'פגישות'] },
  { label: 'לקוחות (CRM)', description: 'ניהול פרופילי לקוחות', href: '/admin/crm', icon: Users, keywords: ['clients', 'customers', 'לקוח'] },
  { label: 'פיננסים', description: 'הכנסות, הוצאות ותזרים', href: '/admin/finance', icon: DollarSign, keywords: ['finance', 'money', 'כסף', 'הכנסות', 'הוצאות'] },
  { label: 'יעדים ומדדים', description: 'מעקב יעדים עסקיים', href: '/admin/goals', icon: Target, keywords: ['goals', 'targets', 'metrics', 'יעדים'] },
  { label: 'משימות', description: 'לוח Kanban למשימות', href: '/admin/tasks', icon: CheckSquare, keywords: ['tasks', 'kanban', 'todo', 'משימה'] },
  { label: 'ניהול צוות', description: 'עובדים, שכר ובונוסים', href: '/admin/team', icon: UserCog, keywords: ['team', 'employees', 'salary', 'עובדים', 'שכר'] },
  { label: 'צ׳אט פנימי', description: 'שיחות עם הצוות', href: '/admin/chat', icon: MessageSquare, keywords: ['chat', 'messages', 'הודעות'] },
]

const EMPLOYEE_ITEMS: SearchItem[] = [
  { label: 'לוח בקרה', description: 'הסקירה האישית שלי', href: '/employee/dashboard', icon: LayoutDashboard, keywords: ['dashboard', 'home'] },
  { label: 'משימות שלי', description: 'המשימות המוקצות לי', href: '/employee/tasks', icon: CheckSquare, keywords: ['tasks', 'my tasks', 'משימות'] },
  { label: 'צ׳אט עם מנהל', description: 'שיחה עם המנהל', href: '/employee/chat', icon: MessageSquare, keywords: ['chat', 'manager', 'מנהל'] },
]

interface GlobalSearchProps {
  role?: 'admin' | 'employee' | 'client'
}

export function GlobalSearch({ role = 'admin' }: GlobalSearchProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const items = role === 'admin' ? ADMIN_ITEMS : EMPLOYEE_ITEMS

  const filtered = query.trim()
    ? items.filter(item =>
        item.label.includes(query) ||
        item.description.includes(query) ||
        item.keywords.some(k => k.includes(query.toLowerCase()))
      )
    : items

  const handleSelect = useCallback((href: string) => {
    setOpen(false)
    setQuery('')
    router.push(href)
  }, [router])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      if (filtered[selectedIndex]) handleSelect(filtered[selectedIndex].href)
    }
  }

  return (
    <>
      {/* Trigger button in TopBar */}
      <button
        onClick={() => setOpen(true)}
        className="hidden lg:flex items-center gap-2 h-8 px-3 rounded-lg border border-border/60 bg-slate-50 dark:bg-slate-800 text-muted-foreground text-xs hover:border-primary/40 hover:bg-white transition-all"
      >
        <Search className="w-3.5 h-3.5" />
        <span>חיפוש...</span>
        <kbd className="ms-2 font-mono text-[10px] bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600">⌘K</kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 gap-0 max-w-lg overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <Input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="חפש דף..."
              className="border-none shadow-none p-0 h-auto text-base focus-visible:ring-0 bg-transparent"
              autoFocus
            />
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto py-2">
            {filtered.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                לא נמצאו תוצאות עבור &ldquo;{query}&rdquo;
              </div>
            ) : (
              <div className="px-2 space-y-0.5">
                {filtered.map((item, i) => (
                  <button
                    key={item.href}
                    onClick={() => handleSelect(item.href)}
                    onMouseEnter={() => setSelectedIndex(i)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-right transition-colors',
                      i === selectedIndex ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                    )}
                  >
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                      i === selectedIndex ? 'bg-white/20' : 'bg-muted'
                    )}>
                      <item.icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 text-right">
                      <p className="text-sm font-semibold leading-none">{item.label}</p>
                      <p className={cn('text-xs mt-0.5', i === selectedIndex ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                        {item.description}
                      </p>
                    </div>
                    <ArrowLeft className={cn('w-3.5 h-3.5 opacity-50', i === selectedIndex ? 'opacity-80' : '')} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="px-4 py-2.5 border-t border-border bg-muted/30 flex items-center gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><kbd className="font-mono bg-background px-1 rounded border text-[10px]">↑↓</kbd> ניווט</span>
            <span className="flex items-center gap-1.5"><kbd className="font-mono bg-background px-1 rounded border text-[10px]">↵</kbd> פתח</span>
            <span className="flex items-center gap-1.5"><kbd className="font-mono bg-background px-1 rounded border text-[10px]">Esc</kbd> סגור</span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
