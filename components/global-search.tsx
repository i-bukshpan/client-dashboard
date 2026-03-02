'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, Users, DollarSign, Bell, Calendar, X, ArrowLeft, FileText, LayoutDashboard, BarChart3, Settings } from 'lucide-react'
import { supabase, type Client } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface SearchResult {
  id: string
  type: 'client' | 'payment' | 'reminder' | 'note'
  title: string
  subtitle: string
  href: string
}

const typeConfig = {
  client: { icon: Users, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10', label: 'לקוחות' },
  payment: { icon: DollarSign, color: 'text-emerald', bg: 'bg-emerald-50 dark:bg-emerald-500/10', label: 'תשלומים' },
  reminder: { icon: Bell, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10', label: 'תזכורות' },
  note: { icon: FileText, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-500/10', label: 'הערות' },
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // ── Ctrl+K keyboard shortcut ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
      if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setQuery('')
      setResults([])
      setSelectedIndex(0)
    }
  }, [open])

  // ── Debounced search ──
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const q = query.trim()
        const [clientsRes, paymentsRes, remindersRes, notesRes] = await Promise.all([
          supabase.from('clients').select('id, name, email, phone, status')
            .or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`).limit(5),
          supabase.from('payments').select('id, client_id, amount, payment_date, payment_status, description')
            .or(`description.ilike.%${q}%,payment_method.ilike.%${q}%`).limit(4),
          supabase.from('reminders').select('id, client_id, title, due_date, priority')
            .ilike('title', `%${q}%`).limit(4),
          supabase.from('notes').select('id, client_id, content')
            .ilike('content', `%${q}%`).limit(3),
        ])

        const all: SearchResult[] = []
        for (const c of clientsRes.data || []) {
          all.push({ id: c.id, type: 'client', title: c.name, subtitle: `${c.status || ''} • ${c.email || c.phone || ''}`, href: `/clients/${c.id}` })
        }
        for (const p of paymentsRes.data || []) {
          all.push({ id: p.id, type: 'payment', title: `₪${p.amount.toLocaleString()} — ${p.payment_status}`, subtitle: p.description || new Date(p.payment_date).toLocaleDateString('he-IL'), href: `/clients/${p.client_id}` })
        }
        for (const r of remindersRes.data || []) {
          all.push({ id: r.id, type: 'reminder', title: r.title, subtitle: `${r.priority} • ${new Date(r.due_date).toLocaleDateString('he-IL')}`, href: r.client_id ? `/clients/${r.client_id}` : '/calendar' })
        }
        for (const n of notesRes.data || []) {
          all.push({ id: n.id, type: 'note', title: (n.content || '').substring(0, 60), subtitle: 'הערה', href: n.client_id ? `/clients/${n.client_id}` : '#' })
        }
        setResults(all)
        setSelectedIndex(0)
      } catch (e) { console.error('Search error:', e) }
      finally { setLoading(false) }
    }, 200)
    return () => clearTimeout(timer)
  }, [query])

  const goTo = useCallback((href: string) => {
    setOpen(false)
    router.push(href)
  }, [router])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && results[selectedIndex]) { goTo(results[selectedIndex].href) }
  }

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />

      <div className="fixed inset-x-4 top-[12vh] sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-lg z-[70]" dir="rtl">
        <div className="glass-card rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-2xl overflow-hidden animate-fade-in-up" style={{ animationDuration: '150ms' }}>
          {/* Input */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200/50 dark:border-slate-700/30">
            <Search className="h-5 w-5 text-grey shrink-0" />
            <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="חפש לקוחות, תשלומים, תזכורות..."
              className="flex-1 bg-transparent outline-none text-navy dark:text-white placeholder:text-grey text-sm font-medium" autoComplete="off" />
            <kbd className="hidden sm:flex px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-grey border border-slate-200 dark:border-slate-700">ESC</kbd>
          </div>

          {/* Results */}
          <div className="max-h-[55vh] overflow-y-auto custom-scrollbar">
            {loading && <div className="p-6 text-center"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>}

            {!loading && query.length >= 2 && results.length === 0 && (
              <div className="p-8 text-center">
                <Search className="h-8 w-8 text-grey/20 mx-auto mb-2" />
                <p className="text-sm text-grey">לא נמצאו תוצאות</p>
              </div>
            )}

            {!loading && results.length > 0 && (
              <div className="p-2">
                {(Object.keys(typeConfig) as Array<keyof typeof typeConfig>).map(type => {
                  const items = results.filter(r => r.type === type)
                  if (!items.length) return null
                  const cfg = typeConfig[type]
                  return (
                    <div key={type} className="mb-1">
                      <div className="px-3 py-1.5 text-[10px] font-bold text-grey uppercase tracking-wider">{cfg.label}</div>
                      {items.map(r => {
                        const idx = results.indexOf(r)
                        const Icon = cfg.icon
                        return (
                          <button key={r.id} onClick={() => goTo(r.href)}
                            className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-right transition-all",
                              idx === selectedIndex ? "bg-primary/10 dark:bg-primary/15" : "hover:bg-slate-100/80 dark:hover:bg-slate-800/50")}>
                            <div className={cn("p-2 rounded-lg shrink-0", cfg.bg, cfg.color)}><Icon className="h-4 w-4" /></div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-navy truncate">{r.title}</p>
                              <p className="text-xs text-grey truncate">{r.subtitle}</p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Quick nav when empty */}
            {!query && (
              <div className="p-2">
                <div className="px-3 py-1.5 text-[10px] font-bold text-grey uppercase tracking-wider">ניווט מהיר</div>
                {[
                  { label: 'לוח בקרה', href: '/', icon: LayoutDashboard },
                  { label: 'ניהול מרכזי', href: '/admin/manage', icon: Settings },
                  { label: 'לוח זמנים', href: '/calendar', icon: Calendar },
                  { label: 'סטטיסטיקות', href: '/statistics', icon: BarChart3 },
                  { label: 'דוחות', href: '/reports/financial', icon: FileText },
                  { label: 'פעילות', href: '/activity', icon: Bell },
                ].map(item => (
                  <button key={item.href} onClick={() => goTo(item.href)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-right hover:bg-slate-100/80 dark:hover:bg-slate-800/50 transition-all">
                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-grey"><item.icon className="h-4 w-4" /></div>
                    <span className="text-sm font-medium text-navy">{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-4 px-5 py-2.5 border-t border-slate-200/50 dark:border-slate-700/30 bg-slate-50/50 dark:bg-slate-900/50 text-[10px] text-grey font-medium">
            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-bold">↑↓</kbd> ניווט</span>
            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-bold">↵</kbd> בחר</span>
          </div>
        </div>
      </div>
    </>
  )
}
