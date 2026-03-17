'use client'

import { useState, useEffect, useMemo } from 'react'
import { 
  Filter, ArrowUpDown, Users, Tag, CheckSquare, Square, 
  Phone, Clock, Calendar, MessageSquare, ArrowLeft, Trash2, UserPlus
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AddClientDialog } from '@/components/add-client-dialog'
import { BulkActionsToolbar } from '@/components/bulk-actions-toolbar'
import { supabase, type Client, type Payment, type Reminder } from '@/lib/supabase'
import { getAllTags } from '@/lib/actions/tags'
import type { ClientTag } from '@/lib/actions/tags'
import Link from 'next/link'
import { logAction } from '@/lib/audit-log'
import { deleteClient } from '@/lib/actions/clients'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { loadDashboardData, refreshClientCounts, type ClientWithData } from '@/lib/actions/dashboard'
import { processRecurringTasks } from '@/lib/actions/recurring-tasks'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientWithData[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('הכל')
  const [sortBy, setSortBy] = useState<'name' | 'created'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([])
  const [bulkMode, setBulkMode] = useState(false)
  const [availableTags, setAvailableTags] = useState<ClientTag[]>([])
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 20

  useEffect(() => {
    loadAll()
    processRecurringTasks()

    const channel = supabase
      .channel('clients-page-counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, async () => {
        const result = await refreshClientCounts()
        if (result.success && result.counts) {
          setClients(prev => prev.map(client => ({
            ...client,
            unreadMessagesCount: result.counts![client.id]?.unread ?? client.unreadMessagesCount,
            pendingPaymentsCount: result.counts![client.id]?.pending ?? client.pendingPaymentsCount,
            openRemindersCount: result.counts![client.id]?.reminders ?? client.openRemindersCount,
          })))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const result = await loadDashboardData()
      if (result.success && result.data) {
        setClients(result.data.clients)
        setAvailableTags(result.data.availableTags)
      }
    } catch (error) {
      console.error('Error loading clients:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filtered + sorted clients
  const filteredClients = useMemo(() => {
    let list = [...clients]

    // Status filter
    if (statusFilter !== 'הכל') {
      list = list.filter(c => c.status === statusFilter)
    }

    // Tag filter
    if (selectedTagFilter !== 'all') {
      list = list.filter(c => c.tags?.some(tag => tag.id === selectedTagFilter))
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.email?.toLowerCase().includes(q)
      )
    }

    // Sort
    list.sort((a, b) => {
      let cmp = 0
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name, 'he')
      else cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      return sortOrder === 'asc' ? cmp : -cmp
    })

    return list
  }, [clients, statusFilter, selectedTagFilter, sortBy, sortOrder, searchQuery])

  // Reset page when filters change
  useEffect(() => setCurrentPage(1), [statusFilter, selectedTagFilter, searchQuery, sortBy, sortOrder])

  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredClients.slice(start, start + PAGE_SIZE)
  }, [filteredClients, currentPage, PAGE_SIZE])

  const totalPages = Math.ceil(filteredClients.length / PAGE_SIZE)

  const handleAddClient = async (name: string, email: string | null, phone: string | null, status: string) => {
    const { data, error } = await supabase
      .from('clients')
      .insert([{ name, email, phone, status }])
      .select()
      .single()

    if (error) throw error
    if (!data) throw new Error('Failed to create client')

    await logAction('client.created', 'client', data.id, `לקוח חדש נוצר: ${name}`, { email, phone, status })

    const clientWithData: ClientWithData = {
      ...data, currentBalance: 0, monthlyIncome: 0, monthlyExpense: 0,
      tags: [], pendingPaymentsCount: 0, openRemindersCount: 0, unreadMessagesCount: 0, childCount: 0,
    }
    setClients(prev => [clientWithData, ...prev])
  }

  const handleDeleteClient = async (clientId: string, clientName: string) => {
    if (!confirm(`האם אתה בטוח שברצונך למחוק את "${clientName}"? כל הנתונים יימחקו לצמיתות.`)) return
    const result = await deleteClient(clientId)
    if (result.success) {
      setClients(prev => prev.filter(c => c.id !== clientId))
      setSelectedClientIds(prev => prev.filter(id => id !== clientId))
    } else {
      alert(`שגיאה: ${result.error}`)
    }
  }

  // Stats
  const stats = useMemo(() => ({
    total: clients.length,
    active: clients.filter(c => c.status === 'פעיל').length,
    leads: clients.filter(c => c.status === 'ליד').length,
  }), [clients])

  return (
    <div className="p-6 md:p-10 space-y-8 animate-fade-in-up" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-navy tracking-tight mb-2">לקוחות</h1>
          <p className="text-grey font-bold flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            {stats.total} לקוחות • {stats.active} פעילים • {stats.leads} לידים
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => { setBulkMode(!bulkMode); if (bulkMode) setSelectedClientIds([]) }}
            className={cn("rounded-xl gap-2 h-11 px-5 font-bold transition-all", bulkMode && 'bg-primary text-white')}
          >
            {bulkMode ? <Square className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
            {bulkMode ? 'ביטול' : 'בחירה מרובה'}
          </Button>
          <AddClientDialog onAddClient={handleAddClient} />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-white/60 backdrop-blur-md rounded-2xl border border-border/50 shadow-sm">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Input 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
            placeholder="חפש לפי שם, טלפון, או מייל..." 
            className="rounded-xl h-10 bg-white/80 border-border/50 pr-4"
          />
        </div>

        {/* Status */}
        <div className="flex items-center gap-2 bg-slate-100/50 rounded-xl px-3 py-1.5 border border-border/20">
          <Filter className="h-3.5 w-3.5 text-primary" />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-transparent border-none text-sm font-bold text-navy focus:ring-0 cursor-pointer outline-none"
          >
            <option value="הכל">כל הסטטוסים</option>
            <option value="פעיל">פעילים</option>
            <option value="ליד">לידים</option>
            <option value="ארכיון">ארכיון</option>
          </select>
        </div>

        {/* Tags */}
        {availableTags.length > 0 && (
          <div className="flex items-center gap-2 bg-slate-100/50 rounded-xl px-3 py-1.5 border border-border/20">
            <Tag className="h-3.5 w-3.5 text-purple-500" />
            <Select value={selectedTagFilter} onValueChange={setSelectedTagFilter}>
              <SelectTrigger className="w-[120px] border-none bg-transparent h-auto p-0 focus:ring-0 font-bold text-navy shadow-none text-sm">
                <SelectValue placeholder="תגיות" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">הכל</SelectItem>
                {availableTags.map(tag => (
                  <SelectItem key={tag.id} value={tag.id}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                      {tag.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Sort */}
        <div className="flex items-center gap-2 bg-slate-100/50 rounded-xl px-3 py-1.5 border border-border/20">
          <ArrowUpDown className="h-3.5 w-3.5 text-grey" />
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="bg-transparent border-none text-sm font-bold text-navy focus:ring-0 cursor-pointer outline-none"
          >
            <option value="name">שם</option>
            <option value="created">תאריך</option>
          </select>
          <button onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')} className="text-primary font-bold text-sm">
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {bulkMode && selectedClientIds.length > 0 && (
        <BulkActionsToolbar
          selectedClientIds={selectedClientIds}
          onActionComplete={loadAll}
          onClearSelection={() => { setSelectedClientIds([]); setBulkMode(false) }}
        />
      )}

      {/* Client Table */}
      <Card className="rounded-[2.5rem] border-border/50 bg-white/70 backdrop-blur-xl shadow-xl shadow-navy/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="text-[10px] font-black text-grey uppercase tracking-widest border-b border-border/40 bg-slate-50/50">
                {bulkMode && (
                  <th className="py-5 pr-8 w-12">
                    <input
                      type="checkbox"
                      onChange={e => setSelectedClientIds(e.target.checked ? filteredClients.map(c => c.id) : [])}
                      checked={selectedClientIds.length === filteredClients.length && filteredClients.length > 0}
                    />
                  </th>
                )}
                <th className={cn("py-5 text-right", bulkMode ? 'pr-2' : 'pr-10')}>לקוח</th>
                <th className="py-5 text-right">פרטי קשר</th>
                <th className="py-5 text-right">פעילות</th>
                <th className="py-5 text-left pl-10">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                      <p className="text-grey font-bold">טוען לקוחות...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <Users className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-navy font-bold text-lg mb-1">לא נמצאו לקוחות</p>
                    <p className="text-grey text-sm">{searchQuery ? 'נסה חיפוש אחר' : 'הוסף לקוח חדש כדי להתחיל'}</p>
                  </td>
                </tr>
              ) : (
                paginatedClients.map(client => (
                  <tr key={client.id} className="group hover:bg-slate-50/50 transition-colors">
                    {bulkMode && (
                      <td className="py-5 pr-8">
                        <input
                          type="checkbox"
                          checked={selectedClientIds.includes(client.id)}
                          onChange={e => {
                            if (e.target.checked) setSelectedClientIds(prev => [...prev, client.id])
                            else setSelectedClientIds(prev => prev.filter(id => id !== client.id))
                          }}
                        />
                      </td>
                    )}
                    <td className={cn("py-5", bulkMode ? 'pr-2' : 'pr-10')}>
                      <Link href={`/clients/${client.id}`} className="block">
                        <span className="text-base font-black text-navy group-hover:text-primary transition-colors">{client.name}</span>
                        <div className="flex items-center gap-2 mt-1">
                          {client.status && (
                            <span className={cn("text-[10px] font-black px-2 py-0.5 rounded-full",
                              client.status === 'פעיל' ? 'bg-emerald/10 text-emerald' :
                              client.status === 'ליד' ? 'bg-primary/10 text-primary' : 'bg-grey/10 text-grey'
                            )}>
                              {client.status}
                            </span>
                          )}
                          {client.tags?.map(tag => (
                            <div key={tag.id} className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: tag.color }} title={tag.name} />
                          ))}
                        </div>
                      </Link>
                    </td>
                    <td className="py-5">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-navy/70 flex items-center gap-1.5" dir="ltr">
                          <Phone className="h-3 w-3 text-grey" />
                          {client.phone || '-'}
                        </span>
                        <span className="text-[11px] font-medium text-grey truncate max-w-[150px]">
                          {client.email || '-'}
                        </span>
                      </div>
                    </td>
                    <td className="py-5">
                      <div className="flex gap-2">
                        <AlertBadge icon={Clock} count={client.pendingPaymentsCount} color="amber" title="תשלומים" />
                        <AlertBadge icon={Calendar} count={client.openRemindersCount} color="purple" title="משימות" />
                        <AlertBadge icon={MessageSquare} count={client.unreadMessagesCount} color="rose" title="הודעות" />
                      </div>
                    </td>
                    <td className="py-5 text-left pl-10">
                      <div className="flex items-center justify-end gap-2">
                        <Button asChild variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-slate-100 text-grey hover:text-navy">
                          <Link href={`/clients/${client.id}`}><ArrowLeft className="h-5 w-5" /></Link>
                        </Button>
                        {!bulkMode && (
                          <Button
                            variant="ghost" size="icon"
                            onClick={() => handleDeleteClient(client.id, client.name)}
                            className="h-9 w-9 rounded-xl hover:bg-rose-50 text-grey hover:text-rose-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="rounded-xl h-9 px-4 font-bold"
          >
            הקודם
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let page: number
              if (totalPages <= 7) page = i + 1
              else if (currentPage <= 4) page = i + 1
              else if (currentPage >= totalPages - 3) page = totalPages - 6 + i
              else page = currentPage - 3 + i
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={cn(
                    'h-9 w-9 rounded-xl text-sm font-bold transition-all',
                    currentPage === page
                      ? 'bg-primary text-white shadow-md'
                      : 'text-grey hover:text-navy hover:bg-slate-100'
                  )}
                >
                  {page}
                </button>
              )
            })}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="rounded-xl h-9 px-4 font-bold"
          >
            הבא
          </Button>
          <span className="text-sm text-grey font-medium mr-2">
            {filteredClients.length} לקוחות • עמוד {currentPage} מתוך {totalPages}
          </span>
        </div>
      )}
    </div>
  )
}

function AlertBadge({ icon: Icon, count, color, title }: any) {
  if (count === 0) return null
  const colors: any = {
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100 animate-pulse'
  }
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border shadow-sm ${colors[color]}`} title={title}>
      <Icon className="h-3 w-3" />
      <span className="text-[10px] font-black">{count}</span>
    </div>
  )
}
