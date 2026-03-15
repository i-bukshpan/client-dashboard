'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Command } from 'cmdk'
import { 
  Search, Users, ListTodo, Calendar, 
  Settings, ArrowRight, Sparkles 
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{
    clients: any[],
    tasks: any[]
  }>({ clients: [], tasks: [] })
  
  const router = useRouter()

  // Toggle on Cmd+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  // Simple search logic
  useEffect(() => {
    if (!query) {
      setResults({ clients: [], tasks: [] })
      return
    }

    const delayDebounceFn = setTimeout(async () => {
      const { data: clients } = await supabase
        .from('clients')
        .select('id, name')
        .ilike('name', `%${query}%`)
        .limit(5)

      const { data: tasks } = await supabase
        .from('reminders')
        .select('id, title, client_id')
        .ilike('title', `%${query}%`)
        .limit(5)

      setResults({ 
        clients: clients || [], 
        tasks: tasks || [] 
      })
    }, 300)

    return () => clearTimeout(delayDebounceFn)
  }, [query])

  const onSelect = (path: string) => {
    setOpen(false)
    router.push(path)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 pointer-events-none">
      <div 
        className="fixed inset-0 bg-navy/20 backdrop-blur-md pointer-events-auto" 
        onClick={() => setOpen(false)} 
      />
      
      <Command 
        className="relative w-full max-w-xl bg-card rounded-2xl border border-border shadow-2xl pointer-events-auto overflow-hidden animate-in fade-in zoom-in duration-200"
        loop
      >
        <div className="flex items-center gap-3 px-4 py-4 border-b border-border">
          <Search className="h-5 w-5 text-muted-foreground" />
          <Command.Input 
            autoFocus 
            placeholder="חפש לקוחות, משימות או פגישות..." 
            value={query}
            onValueChange={setQuery}
            className="flex-1 bg-transparent border-none outline-none text-base text-foreground placeholder-muted-foreground font-medium"
            dir="rtl"
          />
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary text-[10px] font-bold text-muted-foreground border border-border">
            <span>ESC</span>
          </div>
        </div>

        <Command.List className="max-h-[60vh] overflow-y-auto p-2 custom-scrollbar rtl">
          <Command.Empty className="py-12 text-center text-sm text-muted-foreground">
            לא נמצאו תוצאות עבור "{query}"
          </Command.Empty>

          {results.clients.length > 0 && (
            <Command.Group heading="לקוחות" className="px-2 py-3 text-[10px] font-black uppercase tracking-widest text-grey">
              {results.clients.map(client => (
                <Command.Item 
                  key={client.id}
                  onSelect={() => onSelect(`/clients/${client.id}`)}
                  className="flex items-center gap-3 p-3 rounded-xl cursor-pointer aria-selected:bg-primary/5 aria-selected:text-primary transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 group-aria-selected:bg-primary group-aria-selected:text-white transition-colors">
                    <Users className="h-4 w-4" />
                  </div>
                  <span className="flex-1 font-bold text-sm tracking-tight">{client.name}</span>
                  <ArrowRight className="h-3.5 w-3.5 opacity-0 group-aria-selected:opacity-100 transition-opacity" />
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {results.tasks.length > 0 && (
            <Command.Group heading="משימות" className="px-2 py-3 text-[10px] font-black uppercase tracking-widest text-grey border-t border-border mt-2">
              {results.tasks.map(task => (
                <Command.Item 
                  key={task.id}
                  onSelect={() => onSelect(task.client_id ? `/clients/${task.client_id}` : '/tasks')}
                  className="flex items-center gap-3 p-3 rounded-xl cursor-pointer aria-selected:bg-primary/5 aria-selected:text-primary transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 group-aria-selected:bg-emerald-600 group-aria-selected:text-white transition-colors">
                    <ListTodo className="h-3.5 w-3.5" />
                  </div>
                  <span className="flex-1 font-bold text-sm tracking-tight">{task.title}</span>
                  <ArrowRight className="h-3.5 w-3.5 opacity-0 group-aria-selected:opacity-100 transition-opacity" />
                </Command.Item>
              ))}
            </Command.Group>
          )}

          <Command.Separator className="h-px bg-border my-2" />
          
          <Command.Group heading="פעולות מהירות" className="px-2 py-3 text-[10px] font-black uppercase tracking-widest text-grey">
            <Command.Item onSelect={() => onSelect('/tasks')} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer aria-selected:bg-primary/5 transition-colors group">
              <Calendar className="h-4 w-4 text-muted-foreground group-aria-selected:text-primary" />
              <span className="text-sm font-medium">פתח יומן פגישות</span>
            </Command.Item>
            <Command.Item onSelect={() => onSelect('/settings')} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer aria-selected:bg-primary/5 transition-colors group">
              <Settings className="h-4 w-4 text-muted-foreground group-aria-selected:text-primary" />
              <span className="text-sm font-medium">הגדרות מערכת</span>
            </Command.Item>
          </Command.Group>
        </Command.List>

        <div className="p-3 border-t border-border bg-secondary/30 flex items-center gap-4 text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
          <div className="flex items-center gap-1.5"><ArrowRight className="h-3 w-3 rotate-180" /> בחר</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 border border-border rounded flex items-center justify-center text-[8px]">↑↓</div> נווט</div>
          <div className="flex items-center gap-1.5 text-primary"><Sparkles className="h-3 w-3" /> מופעל ע"י Linkנט Search</div>
        </div>
      </Command>
    </div>
  )
}
