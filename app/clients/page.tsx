'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Filter, ArrowUpDown, Users, Tag, CheckSquare, Square,
  Phone, Mail, Clock, Calendar, MessageSquare, ArrowLeft, Trash2, Search, UserPlus, ChevronLeft, ChevronRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AddClientDialog } from '@/components/add-client-dialog'
import { BulkActionsToolbar } from '@/components/bulk-actions-toolbar'
import { supabase } from '@/lib/supabase'
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

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  'פעיל':   { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'פעיל' },
  'ליד':    { bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500',    label: 'ליד' },
  'ארכיון': { bg: 'bg-slate-100',  text: 'text-slate-500',   dot: 'bg-slate-400',   label: 'ארכיון' },
}

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
  '#3b82f6', '#ef4444', '#14b8a6', '#f97316', '#84cc16',
]
function avatarColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

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
  const PAGE_SIZE = 24

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

  const filteredClients = useMemo(() => {
    let list = [...clients]
    if (statusFilter !== 'הכל') list = list.filter(c => c.status === statusFilter)
    if (selectedTagFilter !== 'all') list = list.filter(c => c.tags?.some(tag => tag.id === selectedTagFilter))
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      list = list.filter(c => c.name.toLowerCase().includes(q) || c.phone?.includes(q) || c.email?.toLowerCase().includes(q))
    }
    list.sort((a, b) => {
      let cmp = sortBy === 'name'
        ? a.name.localeCompare(b.name, 'he')
        : new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      return sortOrder === 'asc' ? cmp : -cmp
    })
    return list
  }, [clients, statusFilter, selectedTagFilter, sortBy, sortOrder, searchQuery])

  useEffect(() => setCurrentPage(1), [statusFilter, selectedTagFilter, searchQuery, sortBy, sortOrder])

  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredClients.slice(start, start + PAGE_SIZE)
  }, [filteredClients, currentPage])

  const totalPages = Math.ceil(filteredClients.length / PAGE_SIZE)

  const handleAddClient = async (name: string, email: string | null, phone: string | null, status: string) => {
    const { data, error } = await supabase.from('clients').insert([{ name, email, phone, status }]).select().single()
    if (error) throw error
    if (!data) throw new Error('Failed to create client')
    await logAction('client.created', 'client', data.id, `לקוח חדש נוצר: ${name}`, { email, phone, status })
    setClients(prev => [{ ...data, currentBalance: 0, monthlyIncome: 0, monthlyExpense: 0, tags: [], pendingPaymentsCount: 0, openRemindersCount: 0, unreadMessagesCount: 0, childCount: 0 }, ...prev])
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

  const stats = useMemo(() => ({
    total: clients.length,
    active: clients.filter(c => c.status === 'פעיל').length,
    leads: clients.filter(c => c.status === 'ליד').length,
    archived: clients.filter(c => c.status === 'ארכיון').length,
  }), [clients])

  const hasAlerts = (c: ClientWithData) => c.pendingPaymentsCount + c.openRemindersCount + c.unreadMessagesCount > 0

  return (
    <div className="min-h-screen bg-slate-50/60" dir="rtl">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 py-8 space-y-8 animate-fade-in-up">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-navy tracking-tight">לקוחות</h1>
            <p className="text-grey font-medium mt-1 text-sm">ניהול כל לקוחות ולידים שלך</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => { setBulkMode(!bulkMode); if (bulkMode) setSelectedClientIds([]) }}
              className={cn("rounded-xl gap-2 h-10 px-4 font-bold text-sm transition-all border-border/50", bulkMode && 'bg-navy text-white border-navy')}
            >
              {bulkMode ? <Square className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
              {bulkMode ? 'ביטול' : 'בחירה מרובה'}
            </Button>
            <AddClientDialog onAddClient={handleAddClient} />
          </div>
        </div>

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'סה״כ לקוחות', value: stats.total, color: 'text-navy', bg: 'bg-white', icon: <Users className="h-4 w-4" /> },
            { label: 'פעילים', value: stats.active, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: <div className="w-2 h-2 rounded-full bg-emerald-500" /> },
            { label: 'לידים', value: stats.leads, color: 'text-blue-600', bg: 'bg-blue-50', icon: <div className="w-2 h-2 rounded-full bg-blue-500" /> },
            { label: 'ארכיון', value: stats.archived, color: 'text-slate-500', bg: 'bg-slate-100', icon: <div className="w-2 h-2 rounded-full bg-slate-400" /> },
          ].map(s => (
            <div key={s.label} className={cn("rounded-2xl p-4 border border-white/80 shadow-sm flex items-center gap-3", s.bg)}>
              <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center bg-white/70 shadow-sm", s.color)}>
                {s.icon}
              </div>
              <div>
                <div className={cn("text-2xl font-black leading-none", s.color)}>{s.value}</div>
                <div className="text-xs font-bold text-grey mt-0.5">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Filters ── */}
        <div className="flex flex-wrap items-center gap-3 p-3 bg-white rounded-2xl border border-border/50 shadow-sm">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-grey/60 pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="חפש שם, טלפון, מייל..."
              className="rounded-xl h-9 bg-slate-50 border-border/30 pr-9 text-sm"
            />
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-xl">
            {['הכל', 'פעיל', 'ליד', 'ארכיון'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                  statusFilter === s ? "bg-white text-navy shadow-sm" : "text-grey hover:text-navy"
                )}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Tags */}
          {availableTags.length > 0 && (
            <Select value={selectedTagFilter} onValueChange={setSelectedTagFilter}>
              <SelectTrigger className="w-[130px] rounded-xl h-9 border-border/30 bg-slate-50 text-sm font-bold text-navy shadow-none">
                <Tag className="h-3.5 w-3.5 text-purple-400 ml-1" />
                <SelectValue placeholder="תגית" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">כל התגיות</SelectItem>
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
          )}

          {/* Sort */}
          <div className="flex items-center gap-1.5 text-xs font-bold text-grey">
            <ArrowUpDown className="h-3.5 w-3.5" />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="bg-transparent border-none text-xs font-bold text-navy focus:ring-0 cursor-pointer outline-none"
            >
              <option value="name">שם</option>
              <option value="created">תאריך</option>
            </select>
            <button onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')} className="text-primary font-black w-5">
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>

          {filteredClients.length !== clients.length && (
            <span className="text-xs font-bold text-grey bg-slate-100 px-2.5 py-1 rounded-full">
              {filteredClients.length} תוצאות
            </span>
          )}
        </div>

        {bulkMode && selectedClientIds.length > 0 && (
          <BulkActionsToolbar
            selectedClientIds={selectedClientIds}
            onActionComplete={loadAll}
            onClearSelection={() => { setSelectedClientIds([]); setBulkMode(false) }}
          />
        )}

        {/* ── Client Cards Grid ── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-5 border border-border/30 animate-pulse h-44" />
            ))}
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border border-dashed border-border/50">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-slate-300" />
            </div>
            <p className="text-navy font-black text-lg mb-1">לא נמצאו לקוחות</p>
            <p className="text-grey text-sm">{searchQuery ? 'נסה חיפוש אחר' : 'הוסף לקוח חדש כדי להתחיל'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginatedClients.map(client => {
              const st = STATUS_CONFIG[client.status ?? ''] || STATUS_CONFIG['ארכיון']
              const color = avatarColor(client.name)
              const isSelected = selectedClientIds.includes(client.id)
              const alertCount = client.pendingPaymentsCount + client.openRemindersCount + client.unreadMessagesCount

              return (
                <div
                  key={client.id}
                  className={cn(
                    "group relative bg-white rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col",
                    "hover:shadow-lg hover:shadow-navy/8 hover:-translate-y-0.5",
                    isSelected ? "border-primary/50 ring-2 ring-primary/20 shadow-md" : "border-border/40 shadow-sm"
                  )}
                >
                  {/* Colored top stripe */}
                  <div className="h-1.5 w-full" style={{ backgroundColor: color }} />

                  <div className="p-5 flex-1 flex flex-col gap-4">
                    {/* Top row: avatar + name + status + bulk checkbox */}
                    <div className="flex items-start gap-3">
                      {bulkMode && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={e => {
                            if (e.target.checked) setSelectedClientIds(prev => [...prev, client.id])
                            else setSelectedClientIds(prev => prev.filter(id => id !== client.id))
                          }}
                          className="mt-1.5 w-4 h-4 accent-primary"
                        />
                      )}
                      {/* Avatar */}
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-lg font-black shrink-0 shadow-sm"
                        style={{ backgroundColor: color }}
                      >
                        {client.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <Link href={`/clients/${client.id}`} className="block">
                          <h3 className="font-black text-navy text-base leading-tight truncate group-hover:text-primary transition-colors">
                            {client.name}
                          </h3>
                        </Link>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black", st.bg, st.text)}>
                            <span className={cn("w-1.5 h-1.5 rounded-full", st.dot)} />
                            {client.status}
                          </span>
                          {client.tags?.slice(0, 3).map(tag => (
                            <div key={tag.id} className="w-2 h-2 rounded-full shadow-sm shrink-0" style={{ backgroundColor: tag.color }} title={tag.name} />
                          ))}
                          {(client.childCount || 0) > 0 && (
                            <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full">
                              📂{client.childCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Contact info */}
                    <div className="space-y-1">
                      {client.phone ? (
                        <a href={`tel:${client.phone}`} className="flex items-center gap-2 text-xs text-grey hover:text-navy transition-colors" dir="ltr">
                          <Phone className="h-3 w-3 text-grey/60 shrink-0" />
                          <span className="font-medium truncate">{client.phone}</span>
                        </a>
                      ) : null}
                      {client.email ? (
                        <a href={`mailto:${client.email}`} className="flex items-center gap-2 text-xs text-grey hover:text-navy transition-colors">
                          <Mail className="h-3 w-3 text-grey/60 shrink-0" />
                          <span className="font-medium truncate">{client.email}</span>
                        </a>
                      ) : null}
                      {!client.phone && !client.email && (
                        <span className="text-xs text-grey/40 font-medium">אין פרטי קשר</span>
                      )}
                    </div>

                    {/* Alert badges */}
                    {alertCount > 0 && (
                      <div className="flex gap-1.5 flex-wrap">
                        {client.pendingPaymentsCount > 0 && (
                          <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 text-amber-600 border border-amber-100 text-[10px] font-black">
                            <Clock className="h-3 w-3" />{client.pendingPaymentsCount} תשלומים
                          </span>
                        )}
                        {client.openRemindersCount > 0 && (
                          <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-50 text-purple-600 border border-purple-100 text-[10px] font-black">
                            <Calendar className="h-3 w-3" />{client.openRemindersCount} משימות
                          </span>
                        )}
                        {client.unreadMessagesCount > 0 && (
                          <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 text-rose-600 border border-rose-100 text-[10px] font-black animate-pulse">
                            <MessageSquare className="h-3 w-3" />{client.unreadMessagesCount} הודעות
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="px-4 py-2.5 border-t border-border/30 bg-slate-50/60 flex items-center justify-between gap-2">
                    <Link
                      href={`/clients/${client.id}`}
                      className="flex items-center gap-1.5 text-xs font-bold text-grey hover:text-primary transition-colors"
                    >
                      פתח תיק
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </Link>
                    {!bulkMode && (
                      <button
                        onClick={() => handleDeleteClient(client.id, client.name)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-grey hover:text-rose-500 hover:bg-rose-50 transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="w-9 h-9 rounded-xl border border-border/50 bg-white flex items-center justify-center text-grey hover:text-navy hover:border-navy/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
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
                      'w-9 h-9 rounded-xl text-sm font-bold transition-all',
                      currentPage === page
                        ? 'bg-navy text-white shadow-sm'
                        : 'text-grey hover:text-navy hover:bg-white border border-transparent hover:border-border/50'
                    )}
                  >
                    {page}
                  </button>
                )
              })}
            </div>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="w-9 h-9 rounded-xl border border-border/50 bg-white flex items-center justify-center text-grey hover:text-navy hover:border-navy/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs text-grey font-bold mr-1">
              {filteredClients.length} לקוחות • עמוד {currentPage}/{totalPages}
            </span>
          </div>
        )}

      </div>
    </div>
  )
}
