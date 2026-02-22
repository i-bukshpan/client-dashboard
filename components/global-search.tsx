'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, X, User, DollarSign, Clock, FileText, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { supabase, type Client, type Payment, type Reminder, type Note } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface SearchResult {
  type: 'client' | 'payment' | 'reminder' | 'note'
  id: string
  title: string
  subtitle: string
  data: Client | Payment | Reminder | Note
}

export function GlobalSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const searchRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      setOpen(false)
      return
    }

    const search = async () => {
      setLoading(true)
      try {
        const searchLower = query.toLowerCase()

        // Search clients
        const { data: clients } = await supabase
          .from('clients')
          .select('*')
          .or(`name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
          .limit(5)

        // Search payments
        const { data: payments } = await supabase
          .from('payments')
          .select('*, clients(name)')
          .or(`description.ilike.%${query}%,payment_method.ilike.%${query}%`)
          .limit(5)

        // Search reminders
        const { data: reminders } = await supabase
          .from('reminders')
          .select('*, clients(name)')
          .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
          .limit(5)

        // Search notes
        const { data: notes } = await supabase
          .from('notes')
          .select('*, clients(name)')
          .ilike('content', `%${query}%`)
          .limit(5)

        const allResults: SearchResult[] = []

        // Format client results
        clients?.forEach((client: Client) => {
          allResults.push({
            type: 'client',
            id: client.id,
            title: client.name,
            subtitle: `${client.email || ''} ${client.phone || ''}`.trim() || 'ללא פרטי קשר',
            data: client,
          })
        })

        // Format payment results
        payments?.forEach((payment: any) => {
          const clientName = (payment.clients as any)?.name || 'לקוח לא ידוע'
          allResults.push({
            type: 'payment',
            id: payment.id,
            title: `תשלום: ₪${payment.amount.toLocaleString()}`,
            subtitle: `${clientName} - ${new Date(payment.payment_date).toLocaleDateString('he-IL')}`,
            data: payment,
          })
        })

        // Format reminder results
        reminders?.forEach((reminder: any) => {
          const clientName = (reminder.clients as any)?.name || 'כללי'
          allResults.push({
            type: 'reminder',
            id: reminder.id,
            title: reminder.title || 'ללא כותרת',
            subtitle: `${clientName} - ${reminder.due_date ? new Date(reminder.due_date).toLocaleDateString('he-IL') : ''}`,
            data: reminder,
          })
        })

        // Format note results
        notes?.forEach((note: any) => {
          const clientName = (note.clients as any)?.name || 'כללי'
          const contentPreview = (note.content || '').substring(0, 50)
          allResults.push({
            type: 'note',
            id: note.id,
            title: contentPreview || 'פתק',
            subtitle: clientName,
            data: note,
          })
        })

        setResults(allResults)
        setOpen(allResults.length > 0)
        setFocusedIndex(-1)
      } catch (error) {
        console.error('Search error:', error)
      } finally {
        setLoading(false)
      }
    }

    const timeoutId = setTimeout(search, 300)
    return () => clearTimeout(timeoutId)
  }, [query])

  const handleSelect = (result: SearchResult) => {
    if (result.type === 'client') {
      router.push(`/clients/${result.id}`)
    } else if (result.type === 'payment' || result.type === 'reminder' || result.type === 'note') {
      const payment = result.data as any
      if (payment.client_id) {
        router.push(`/clients/${payment.client_id}`)
      }
    }
    setOpen(false)
    setQuery('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIndex((prev) => (prev > 0 ? prev - 1 : -1))
    } else if (e.key === 'Enter' && focusedIndex >= 0) {
      e.preventDefault()
      handleSelect(results[focusedIndex])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'client':
        return <User className="h-4 w-4" />
      case 'payment':
        return <DollarSign className="h-4 w-4" />
      case 'reminder':
        return <Clock className="h-4 w-4" />
      case 'note':
        return <FileText className="h-4 w-4" />
      default:
        return null
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'client':
        return 'לקוח'
      case 'payment':
        return 'תשלום'
      case 'reminder':
        return 'תזכורת'
      case 'note':
        return 'פתק'
      default:
        return ''
    }
  }

  return (
    <div className="relative flex-1 max-w-md group" ref={searchRef}>
      <div className="relative">
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 bg-primary/10 rounded-md text-primary group-focus-within:bg-primary group-focus-within:text-white transition-colors duration-300">
          <Search className="h-4 w-4" />
        </div>
        <Input
          type="text"
          placeholder="חיפוש גלובלי: לקוחות, תשלומים, משימות..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && results.length > 0 && setOpen(true)}
          className="pr-11 pl-10 h-11 bg-white/50 backdrop-blur-md border border-border/50 focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-2xl transition-all duration-300 placeholder:text-grey/60"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('')
              setResults([])
              setOpen(false)
            }}
            className="absolute left-3 top-1/2 transform -translate-y-1/2 w-6 h-6 flex items-center justify-center bg-grey/10 hover:bg-rose-100 hover:text-rose-600 rounded-full transition-all"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 w-full mt-3 bg-white/90 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl shadow-navy/5 max-h-[450px] overflow-hidden animate-fade-in-up">
          <div className="p-2 overflow-y-auto max-h-[450px]">
            <div className="px-3 py-2 text-[10px] font-extrabold text-grey/60 uppercase tracking-widest border-b border-border/30 mb-1">
              תוצאות חיפוש
            </div>
            {results.map((result, index) => (
              <button
                key={`${result.type}-${result.id}`}
                onClick={() => handleSelect(result)}
                className={`w-full text-right p-3 rounded-xl transition-all duration-200 group/item mb-1 ${index === focusedIndex ? 'bg-primary/5 border border-primary/20 translate-x-1' : 'hover:bg-grey/5 border border-transparent'
                  }`}
                onMouseEnter={() => setFocusedIndex(index)}
              >
                <div className="flex items-start gap-4">
                  <div className={`mt-0.5 p-2 rounded-lg transition-colors ${index === focusedIndex ? 'bg-primary text-white' : 'bg-grey/5 text-grey group-hover/item:bg-primary/10 group-hover/item:text-primary'
                    }`}>
                    {getIcon(result.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter ${result.type === 'client' ? 'bg-blue-100 text-blue-700' :
                          result.type === 'payment' ? 'bg-emerald-100 text-emerald' :
                            result.type === 'reminder' ? 'bg-amber-100 text-amber-700' :
                              'bg-purple-100 text-purple-700'
                        }`}>
                        {getTypeLabel(result.type)}
                      </span>
                      <span className="font-bold text-navy truncate block group-hover/item:text-primary transition-colors">{result.title}</span>
                    </div>
                    <p className="text-xs text-grey font-medium truncate">{result.subtitle}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && query.length >= 2 && (
        <div className="absolute z-50 w-full mt-3 bg-white/90 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl p-6 animate-fade-in-up">
          <div className="flex flex-col items-center justify-center gap-3 text-grey">
            <div className="relative">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <Search className="h-3 w-3 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-primary" />
            </div>
            <span className="text-sm font-bold tracking-tight">מחפש בנתונים...</span>
          </div>
        </div>
      )}
    </div>
  )
}

