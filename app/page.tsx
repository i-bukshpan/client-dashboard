'use client'

import { useState, useEffect, useMemo } from 'react'
import { DollarSign, Calendar, AlertCircle, Filter, ArrowUpDown, TrendingUp, TrendingDown, Users, Tag, CheckSquare, Square, CreditCard, Bell, UserPlus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ClientCard } from '@/components/client-card'
import { AddClientDialog } from '@/components/add-client-dialog'
import { GlobalSearch } from '@/components/global-search'
import { BulkActionsToolbar } from '@/components/bulk-actions-toolbar'
import { EmptyState } from '@/components/empty-state'
import { supabase, type Client, type Payment, type Reminder } from '@/lib/supabase'
import { getClientTags, getAllTags } from '@/lib/actions/tags'
import type { ClientTag } from '@/lib/actions/tags'
import Link from 'next/link'
import { logAction } from '@/lib/audit-log'
import { deleteClient } from '@/lib/actions/clients'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'


interface ClientWithData extends Client {
  currentBalance: number
  monthlyIncome: number
  monthlyExpense: number
  tags?: ClientTag[]
  pendingPaymentsCount: number
  openRemindersCount: number
  unreadMessagesCount: number
  childCount: number
  monthlyTrends?: {
    income: Array<{ month: string; value: number }>
    expense: Array<{ month: string; value: number }>
  }
}

export default function Dashboard() {
  const [clients, setClients] = useState<ClientWithData[]>([])
  const [filteredClients, setFilteredClients] = useState<ClientWithData[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('הכל')
  const [sortBy, setSortBy] = useState<'name' | 'balance' | 'created'>('created')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [pendingPayments, setPendingPayments] = useState<Array<Payment & { client: Client }>>([])
  const [upcomingReminders, setUpcomingReminders] = useState<Array<Reminder & { client: Client | null }>>([])
  const [alertsLoading, setAlertsLoading] = useState(true)
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([])
  const [bulkMode, setBulkMode] = useState(false)
  const [availableTags, setAvailableTags] = useState<ClientTag[]>([])
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('all')

  const loadClients = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase.from('clients').select('*').is('parent_id', null).order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      if (!data || data.length === 0) {
        setClients([])
        setFilteredClients([])
        return
      }

      // Load all payments in a single query
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

      const { data: allPayments } = await supabase
        .from('payments')
        .select('client_id, amount, payment_status, payment_date, payment_type')

      // Load all pending reminders count
      const { data: allReminders } = await supabase
        .from('reminders')
        .select('client_id')
        .eq('is_completed', false)

      // Load all unread messages count
      const { data: allUnread } = await supabase
        .from('messages')
        .select('client_id')
        .eq('is_read', false)
        .eq('sender_role', 'client')

      // Compute per-client stats
      const paymentsByClient: Record<string, {
        balance: number
        monthlyIncome: number
        monthlyExpense: number
        pendingCount: number
        trends: { income: Array<{ month: string; value: number }>; expense: Array<{ month: string; value: number }> }
      }> = {}

      // Calculate last 3 months for trends
      const last3Months: Array<{ start: Date; end: Date; label: string }> = []
      for (let i = 2; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
        const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59)
        last3Months.push({
          start: monthStart,
          end: monthEnd,
          label: `${monthDate.getMonth() + 1}/${monthDate.getFullYear()}`
        })
      }

      if (allPayments) {
        for (const p of allPayments) {
          if (!paymentsByClient[p.client_id]) {
            paymentsByClient[p.client_id] = {
              balance: 0,
              monthlyIncome: 0,
              monthlyExpense: 0,
              pendingCount: 0,
              trends: {
                income: last3Months.map(m => ({ month: m.label, value: 0 })),
                expense: last3Months.map(m => ({ month: m.label, value: 0 }))
              }
            }
          }
          const stats = paymentsByClient[p.client_id]
          if (p.payment_status === 'שולם') {
            const isIncome = !p.payment_type || p.payment_type === 'income'
            const isExpense = p.payment_type === 'expense' || p.payment_type === 'rent' || p.payment_type === 'utility' || p.payment_type === 'salary'
            if (isIncome) stats.balance += p.amount
            if (isExpense) stats.balance -= p.amount

            // Monthly stats (current month)
            if (p.payment_date >= startOfMonth && p.payment_date <= endOfMonth) {
              if (isIncome) stats.monthlyIncome += p.amount
              if (isExpense) stats.monthlyExpense += p.amount
            }

            // Trends calculation (last 3 months)
            const paymentDate = new Date(p.payment_date)
            last3Months.forEach((month, idx) => {
              if (paymentDate >= month.start && paymentDate <= month.end) {
                if (isIncome) stats.trends.income[idx].value += p.amount
                if (isExpense) stats.trends.expense[idx].value += p.amount
              }
            })
          }
          if (p.payment_status === 'ממתין') {
            stats.pendingCount++
          }
        }
      }

      // Also aggregate from financial tables (schemas with financial_type set)
      try {
        const { data: financialSchemas } = await supabase
          .from('client_schemas')
          .select('*')
          .not('financial_type', 'is', null)
          .not('amount_column', 'is', null)

        if (financialSchemas && financialSchemas.length > 0) {
          // Group schemas by client_id
          const schemasByClient: Record<string, typeof financialSchemas> = {}
          for (const schema of financialSchemas) {
            if (!schemasByClient[schema.client_id]) schemasByClient[schema.client_id] = []
            schemasByClient[schema.client_id].push(schema)
          }

          // Load records for each client's financial tables
          for (const [cId, schemas] of Object.entries(schemasByClient)) {
            if (!paymentsByClient[cId]) {
              paymentsByClient[cId] = {
                balance: 0, monthlyIncome: 0, monthlyExpense: 0, pendingCount: 0,
                trends: { income: last3Months.map(m => ({ month: m.label, value: 0 })), expense: last3Months.map(m => ({ month: m.label, value: 0 })) }
              }
            }
            const stats = paymentsByClient[cId]

            for (const schema of schemas) {
              const { data: records } = await supabase
                .from('client_data_records')
                .select('data, entry_date')
                .eq('client_id', cId)
                .eq('module_type', schema.module_name)

              if (!records) continue
              for (const record of records) {
                const amount = parseFloat(record.data?.[schema.amount_column]) || 0
                if (amount === 0) continue
                const dateStr = record.data?.[schema.date_column] || record.entry_date || ''
                const isIncome = schema.financial_type === 'income'

                if (isIncome) stats.balance += amount
                else stats.balance -= amount

                // Monthly stats (current month)
                if (dateStr >= startOfMonth && dateStr <= endOfMonth) {
                  if (isIncome) stats.monthlyIncome += amount
                  else stats.monthlyExpense += amount
                }

                // Trends
                const recordDate = new Date(dateStr)
                if (!isNaN(recordDate.getTime())) {
                  last3Months.forEach((month, idx) => {
                    if (recordDate >= month.start && recordDate <= month.end) {
                      if (isIncome) stats.trends.income[idx].value += amount
                      else stats.trends.expense[idx].value += amount
                    }
                  })
                }
              }
            }
          }
        }
      } catch (financialError) {
        console.error('Error loading financial table data:', financialError)
      }

      const remindersByClient: Record<string, number> = {}
      if (allReminders) {
        for (const r of allReminders) {
          if (r.client_id) {
            remindersByClient[r.client_id] = (remindersByClient[r.client_id] || 0) + 1
          }
        }
      }

      const unreadByClient: Record<string, number> = {}
      if (allUnread) {
        for (const m of allUnread) {
          if (m.client_id) {
            unreadByClient[m.client_id] = (unreadByClient[m.client_id] || 0) + 1
          }
        }
      }

      // Count children for each client
      const { data: childCounts } = await supabase
        .from('clients')
        .select('parent_id')
        .not('parent_id', 'is', null)

      const childCountMap: Record<string, number> = {}
      if (childCounts) {
        for (const c of childCounts) {
          if (c.parent_id) {
            childCountMap[c.parent_id] = (childCountMap[c.parent_id] || 0) + 1
          }
        }
      }

      const clientsWithData: ClientWithData[] = data.map((client) => {
        const stats = paymentsByClient[client.id]
        return {
          ...client,
          currentBalance: stats?.balance || 0,
          monthlyIncome: stats?.monthlyIncome || 0,
          monthlyExpense: stats?.monthlyExpense || 0,
          pendingPaymentsCount: stats?.pendingCount || 0,
          openRemindersCount: remindersByClient[client.id] || 0,
          unreadMessagesCount: unreadByClient[client.id] || 0,
          childCount: childCountMap[client.id] || 0,
          monthlyTrends: stats?.trends,
          tags: [],
        }
      })

      setClients(clientsWithData)
      setFilteredClients(clientsWithData)

      // Load tags for all clients in parallel
      const tagPromises = clientsWithData.map(client => getClientTags(client.id))
      const tagResults = await Promise.all(tagPromises)
      const tagsMap: Record<string, ClientTag[]> = {}
      clientsWithData.forEach((client, i) => {
        if (tagResults[i].success && tagResults[i].tags) {
          tagsMap[client.id] = tagResults[i].tags!
        }
      })

      // Update clients with tags
      const finalClients = clientsWithData.map(client => ({
        ...client,
        tags: tagsMap[client.id] || []
      }))
      setClients(finalClients)
    } catch (error) {
      console.error('Error loading clients:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAlerts = async () => {
    try {
      setAlertsLoading(true)

      // Load pending payments
      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('*, clients(*)')
        .eq('payment_status', 'ממתין')
        .order('payment_date', { ascending: true })
        .limit(10)

      if (paymentsError) throw paymentsError

      // Load reminders due in next 7 days
      const nextWeek = new Date()
      nextWeek.setDate(nextWeek.getDate() + 7)
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const { data: reminders, error: remindersError } = await supabase
        .from('reminders')
        .select('*, clients(*)')
        .eq('is_completed', false)
        .lte('due_date', nextWeek.toISOString())
        .gte('due_date', today.toISOString())
        .order('due_date', { ascending: true })
        .limit(10)

      if (remindersError) throw remindersError

      setPendingPayments((payments || []) as Array<Payment & { client: Client }>)
      setUpcomingReminders((reminders || []) as Array<Reminder & { client: Client | null }>)
    } catch (error) {
      console.error('Error loading alerts:', error)
    } finally {
      setAlertsLoading(false)
    }
  }

  const loadAvailableTags = async () => {
    const result = await getAllTags()
    if (result.success && result.tags) {
      setAvailableTags(result.tags)
    }
  }

  useEffect(() => {
    loadClients()
    loadAlerts()
    loadAvailableTags()

    // Realtime subscription for unread message counts
    const channel = supabase
      .channel('dashboard-unread-counts')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages'
      }, () => {
        // If a new client message arrives, or an existing one is updated/deleted, refresh counts
        loadClients()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const loadClientTags = async (clientIds: string[]) => {
    const tagsMap: Record<string, ClientTag[]> = {}
    for (const clientId of clientIds) {
      const result = await getClientTags(clientId)
      if (result.success && result.tags) {
        tagsMap[clientId] = result.tags
      }
    }
    setClients(prev => prev.map(client => ({
      ...client,
      tags: tagsMap[client.id] || []
    })))
  }

  useEffect(() => {
    let filtered = [...clients]

    // Filter by status
    if (statusFilter !== 'הכל') {
      filtered = filtered.filter((client) => client.status === statusFilter)
    }

    // Filter by tag
    if (selectedTagFilter !== 'all') {
      filtered = filtered.filter((client) =>
        client.tags?.some(tag => tag.id === selectedTagFilter)
      )
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name, 'he')
          break
        case 'balance':
          comparison = a.currentBalance - b.currentBalance
          break
        case 'created':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })

    setFilteredClients(filtered)
  }, [clients, statusFilter, selectedTagFilter, sortBy, sortOrder])

  const handleAddClient = async (
    name: string,
    email: string | null,
    phone: string | null,
    status: string
  ) => {
    try {
      // Insert new client into Supabase
      const { data, error } = await supabase
        .from('clients')
        .insert([{
          name,
          email,
          phone,
          status,
        }])
        .select()
        .single()

      if (error) {
        throw error
      }

      if (!data) {
        throw new Error('Failed to create client')
      }

      // Log action
      await logAction(
        'client.created',
        'client',
        data.id,
        `לקוח חדש נוצר: ${name}`,
        { email, phone, status }
      )

      // Add client with zero values (no Google Sheets data)
      const clientWithData: ClientWithData = {
        ...data,
        currentBalance: 0,
        monthlyIncome: 0,
        monthlyExpense: 0,
      }

      setClients([clientWithData, ...clients])
      setFilteredClients([clientWithData, ...filteredClients])
    } catch (error) {
      console.error('Error adding client:', error)
      throw error // Re-throw to allow error handling in the dialog if needed
    }
  }

  const handleDeleteClient = async (clientId: string, clientName: string) => {
    if (!confirm(`האם אתה בטוח שברצונך למחוק את הלקוח "${clientName}"? פעולה זו תמחק את כל הנתונים הקשורים (טבלאות, רשומות, תשלומים, תזכורות וכו') ולא ניתן לבטל אותה.`)) {
      return
    }

    try {
      const result = await deleteClient(clientId)
      if (result.success) {
        // Remove client from state
        setClients(clients.filter(c => c.id !== clientId))
        setFilteredClients(filteredClients.filter(c => c.id !== clientId))
        setSelectedClientIds(selectedClientIds.filter(id => id !== clientId))
        // Reload alerts in case this client had pending items
        loadAlerts()
      } else {
        alert(`שגיאה במחיקת הלקוח: ${result.error}`)
      }
    } catch (error) {
      console.error('Error deleting client:', error)
      alert('שגיאה בלתי צפויה במחיקת הלקוח')
    }
  }

  const handleClientSelect = (clientId: string, selected: boolean) => {
    if (selected) {
      setSelectedClientIds([...selectedClientIds, clientId])
    } else {
      setSelectedClientIds(selectedClientIds.filter(id => id !== clientId))
    }
  }

  const handleSelectAll = () => {
    if (selectedClientIds.length === filteredClients.length) {
      setSelectedClientIds([])
    } else {
      setSelectedClientIds(filteredClients.map(c => c.id))
    }
  }

  const handleBulkActionComplete = () => {
    loadClients()
    loadAlerts()
  }

  const handleClearSelection = () => {
    setSelectedClientIds([])
    setBulkMode(false)
  }

  // KPI summary computed from clients data
  const dashboardKPIs = useMemo(() => {
    const activeClients = clients.filter(c => c.status === 'פעיל' || !c.status)
    const totalMonthlyIncome = clients.reduce((sum, c) => sum + c.monthlyIncome, 0)
    const totalMonthlyExpense = clients.reduce((sum, c) => sum + c.monthlyExpense, 0)
    const totalPendingPayments = clients.reduce((sum, c) => sum + c.pendingPaymentsCount, 0)
    const totalOpenReminders = clients.reduce((sum, c) => sum + c.openRemindersCount, 0)
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const newClientsThisMonth = clients.filter(c => {
      if (!c.created_at) return false
      return new Date(c.created_at) >= startOfMonth
    })
    return {
      activeCount: activeClients.length,
      totalClients: clients.length,
      totalMonthlyIncome,
      totalMonthlyExpense,
      totalPendingPayments,
      totalOpenReminders,
      newClientsCount: newClientsThisMonth.length,
    }
  }, [clients])

  return (
    <div className="p-8">
      <div className="mb-10 animate-fade-in-up">
        <h1 className="text-4xl font-extrabold text-navy mb-2 tracking-tight">לוח בקרה</h1>
        <div className="flex items-center gap-2">
          <div className="h-1 w-12 bg-primary rounded-full" />
          <p className="text-grey font-medium">ניהול לקוחות - נחמיה דרוק</p>
        </div>
      </div>

      {/* KPI Summary Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 mb-10 overflow-hidden">
        {loading ? (
          <>
            {/* Skeleton Main Balance Card */}
            <div className="lg:col-span-4 bg-white rounded-2xl border border-border/50 p-6 shadow-sm overflow-hidden animate-pulse">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-slate-200/60" />
                <div className="w-24 h-6 bg-slate-200/60 rounded-full" />
              </div>
              <div className="w-16 h-10 bg-slate-200/60 rounded-lg mb-2" />
              <div className="w-32 h-4 bg-slate-200/60 rounded" />
            </div>

            {/* Skeleton Income Card */}
            <div className="lg:col-span-4 bg-white rounded-2xl border border-border/50 p-6 shadow-sm overflow-hidden animate-pulse">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-slate-200/60" />
                <div className="w-24 h-6 bg-slate-200/60 rounded-full" />
              </div>
              <div className="w-32 h-10 bg-slate-200/60 rounded-lg mb-2" />
              <div className="w-40 h-4 bg-slate-200/60 rounded" />
            </div>

            {/* Skeleton Smaller Cards Stack */}
            <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-amber-50/20 rounded-2xl border border-amber-100/50 p-5 shadow-sm animate-pulse">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-200/60" />
                  <div className="w-16 h-4 bg-amber-200/60 rounded" />
                </div>
                <div className="w-12 h-8 bg-amber-200/60 rounded mb-2" />
                <div className="w-20 h-3 bg-amber-200/60 rounded" />
              </div>
              <div className="bg-purple-50/20 rounded-2xl border border-purple-100/50 p-5 shadow-sm animate-pulse">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-purple-200/60" />
                  <div className="w-16 h-4 bg-purple-200/60 rounded" />
                </div>
                <div className="w-12 h-8 bg-purple-200/60 rounded mb-2" />
                <div className="w-20 h-3 bg-purple-200/60 rounded" />
              </div>
            </div>
          </>
        ) : clients.length > 0 ? (
          <>
            {/* Main Balance Card - Spans 4 columns */}
            <div className="lg:col-span-4 bg-white rounded-2xl border border-border/50 p-6 shadow-sm glass-card hover-lift animate-fade-in-up delay-100 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-xl bg-blue-50 text-primary">
                    <Users className="h-6 w-6" />
                  </div>
                  <div className="text-xs font-semibold px-2 py-1 bg-blue-50 text-blue-700 rounded-full">סה"כ לקוחות</div>
                </div>
                <div className="text-4xl font-bold text-navy mb-1">{dashboardKPIs.activeCount}</div>
                <div className="text-sm text-grey font-medium">מתוך {dashboardKPIs.totalClients} סה"כ במערכת</div>
              </div>
            </div>

            {/* Income Card - Spans 4 columns */}
            <div className="lg:col-span-4 bg-white rounded-2xl border border-border/50 p-6 shadow-sm glass-card hover-lift animate-fade-in-up delay-200 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-xl bg-green-50 text-emerald">
                    <TrendingUp className="h-6 w-6" />
                  </div>
                  <div className="text-xs font-semibold px-2 py-1 bg-green-50 text-emerald rounded-full">הכנסות החודש</div>
                </div>
                <div className="text-4xl font-bold text-emerald mb-1">₪{dashboardKPIs.totalMonthlyIncome.toLocaleString()}</div>
                <div className="flex items-center gap-2 text-sm text-grey font-medium">
                  <span>הוצאות:</span>
                  <span className="text-rose-500">₪{dashboardKPIs.totalMonthlyExpense.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Smaller Cards Stack - Spans 4 columns */}
            <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-amber-50/50 rounded-2xl border border-amber-100 p-5 shadow-sm glass-card hover-lift animate-fade-in-up delay-300">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-amber-100 text-amber-600">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-semibold text-amber-800">ממתינים</span>
                </div>
                <div className="text-2xl font-bold text-amber-600">{dashboardKPIs.totalPendingPayments}</div>
                <div className="text-xs text-amber-700/70 mt-1">תשלומים לטיפול</div>
              </div>

              <div className="bg-purple-50/50 rounded-2xl border border-purple-100 p-5 shadow-sm glass-card hover-lift animate-fade-in-up delay-400">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-purple-100 text-purple-600">
                    <Bell className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-semibold text-purple-800">משימות</span>
                </div>
                <div className="text-2xl font-bold text-purple-600">{dashboardKPIs.totalOpenReminders}</div>
                <div className="text-xs text-purple-700/70 mt-1">פתוחות היום</div>
              </div>
            </div>
          </>
        ) : null}
      </div>

      {/* Alerts Center - Enhanced Bento Layout */}
      <div className="mb-10 animate-fade-in-up delay-500" dir="rtl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-navy flex items-center gap-2">
            <div className="h-8 w-1 bg-amber-500 rounded-full" />
            התראות ומשימות קרובות
          </h2>
          <div className="text-xs font-semibold px-3 py-1 bg-amber-50 text-amber-700 rounded-full border border-amber-100 italic">
            עדכון אחרון: {new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

        {alertsLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-[200px] bg-grey/5 animate-pulse rounded-2xl border border-border/50" />
            <div className="h-[200px] bg-grey/5 animate-pulse rounded-2xl border border-border/50" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pending Payments */}
            <div className="bg-white/50 backdrop-blur-sm rounded-2xl border border-border/50 p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-yellow-500/20" />
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-yellow-50 text-yellow-600">
                    <DollarSign className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-lg">תשלומים ממתינים</h3>
                </div>
                <span className="text-xs font-bold text-yellow-700 bg-yellow-100/50 px-2 py-0.5 rounded-full">
                  {pendingPayments.length} פריטים
                </span>
              </div>

              {pendingPayments.length > 0 ? (
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  {pendingPayments.map((payment) => (
                    <Link
                      key={payment.id}
                      href={`/clients/${payment.client_id}`}
                      className="group block p-4 bg-white/40 border border-transparent rounded-xl hover:border-yellow-200 hover:bg-yellow-50/50 transition-all duration-200"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-700 font-bold text-sm">
                            {(payment.client as Client)?.name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <div className="font-bold text-navy group-hover:text-yellow-800 transition-colors">
                              {(payment.client as Client)?.name || 'לקוח לא ידוע'}
                            </div>
                            <div className="text-xs text-grey flex items-center gap-1.5 mt-0.5">
                              <Calendar className="h-3 w-3" />
                              {new Date(payment.payment_date).toLocaleDateString('he-IL')}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-extrabold text-navy">
                            ₪{payment.amount.toLocaleString('he-IL')}
                          </div>
                          <div className="text-[10px] font-bold text-yellow-600 uppercase tracking-wider">ממתין</div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-50 mb-4 transform rotate-12 transition-transform hover:rotate-0">
                    <DollarSign className="h-8 w-8 text-green-600" />
                  </div>
                  <p className="text-base font-bold text-navy">אין תשלומים ממתינים</p>
                  <p className="text-sm text-grey mt-1">כל התשלומים עודכנו בהצלחה!</p>
                </div>
              )}
            </div>

            {/* Upcoming Reminders */}
            <div className="bg-white/50 backdrop-blur-sm rounded-2xl border border-border/50 p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-blue-500/20" />
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-lg">משימות קרובות</h3>
                </div>
                <span className="text-xs font-bold text-blue-700 bg-blue-100/50 px-2 py-0.5 rounded-full">
                  7 ימים
                </span>
              </div>

              {upcomingReminders.length > 0 ? (
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  {upcomingReminders.map((reminder) => (
                    <Link
                      key={reminder.id}
                      href={reminder.client_id ? `/clients/${reminder.client_id}` : '#'}
                      className="group block p-4 bg-white/40 border border-transparent rounded-xl hover:border-blue-200 hover:bg-blue-50/50 transition-all duration-200"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-bold text-navy group-hover:text-blue-800 transition-colors">{reminder.title}</div>
                          <div className="flex items-center gap-3 mt-1.5">
                            <div className="text-xs text-grey font-medium flex items-center gap-1.5">
                              <Users className="h-3 w-3" />
                              {reminder.client ? (reminder.client as Client).name : 'כללי'}
                            </div>
                            <div className="text-xs text-grey font-medium flex items-center gap-1.5">
                              <Calendar className="h-3 w-3" />
                              {new Date(reminder.due_date).toLocaleDateString('he-IL')}
                            </div>
                          </div>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${reminder.priority === 'High' ? 'bg-rose-100 text-rose-700' :
                          reminder.priority === 'Medium' ? 'bg-amber-100 text-amber-700' :
                            'bg-sky-100 text-sky-700'
                          }`}>
                          {reminder.priority === 'High' ? 'גבוהה' :
                            reminder.priority === 'Medium' ? 'בינונית' : 'נמוכה'}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-50 mb-4 transform -rotate-12 transition-transform hover:rotate-0">
                    <Calendar className="h-8 w-8 text-blue-600" />
                  </div>
                  <p className="text-base font-bold text-navy">אין משימות קרובות</p>
                  <p className="text-sm text-grey mt-1">היומן שלך פנוי ל-7 הימים הקרובים</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mb-10 space-y-6 animate-fade-in-up delay-500">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4 flex-wrap flex-1">
            <GlobalSearch />

            <div className="flex items-center gap-2 bg-white/50 backdrop-blur-sm border border-border/50 rounded-2xl px-3 py-1.5 shadow-sm">
              <Filter className="h-4 w-4 text-primary" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent border-none text-sm font-bold text-navy focus:ring-0 cursor-pointer"
              >
                <option value="הכל">כל הסטטוסים</option>
                <option value="פעיל">פעילים</option>
                <option value="ליד">לידים</option>
                <option value="ארכיון">ארכיון</option>
              </select>
            </div>

            {availableTags.length > 0 && (
              <div className="flex items-center gap-2 bg-white/50 backdrop-blur-sm border border-border/50 rounded-2xl px-3 py-1.5 shadow-sm">
                <Tag className="h-4 w-4 text-purple-500" />
                <Select value={selectedTagFilter} onValueChange={setSelectedTagFilter}>
                  <SelectTrigger className="w-[140px] border-none bg-transparent h-auto p-0 focus:ring-0 font-bold text-navy">
                    <SelectValue placeholder="תגיות" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border/50 shadow-xl">
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
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setBulkMode(!bulkMode)
                if (bulkMode) {
                  setSelectedClientIds([])
                }
              }}
              className={`gap-2 rounded-2xl border-border/50 h-10 px-4 font-bold transition-all ${bulkMode ? 'bg-primary text-white border-primary shadow-md shadow-primary/20' : 'bg-white/50 backdrop-blur-sm hover:bg-white'}`}
            >
              {bulkMode ? <Square className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
              {bulkMode ? 'ביטול בחירה' : 'בחירה מרובה'}
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white/50 backdrop-blur-sm border border-border/50 rounded-2xl px-3 py-1.5 shadow-sm">
              <ArrowUpDown className="h-4 w-4 text-grey" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'name' | 'balance' | 'created')}
                className="bg-transparent border-none text-sm font-bold text-navy focus:ring-0 cursor-pointer"
              >
                <option value="created">תאריך</option>
                <option value="name">שם</option>
                <option value="balance">יתרה</option>
              </select>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="h-7 w-7 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </Button>
            </div>

            <AddClientDialog onAddClient={handleAddClient} />
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-2 bg-primary/5 rounded-2xl border border-primary/10">
          <div className="text-xs font-bold text-primary flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            מציג {filteredClients.length} מתוך {clients.length} לקוחות
          </div>
          {selectedClientIds.length > 0 && (
            <div className="text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-100 animate-fade-in-up">
              {selectedClientIds.length} לקוחות נבחרו
            </div>
          )}
        </div>
      </div>

      {/* Bulk Actions Toolbar */}
      {bulkMode && selectedClientIds.length > 0 && (
        <BulkActionsToolbar
          selectedClientIds={selectedClientIds}
          onActionComplete={handleBulkActionComplete}
          onClearSelection={handleClearSelection}
        />
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-grey/20 rounded w-32 mx-auto"></div>
            <div className="h-2 bg-grey/20 rounded w-24 mx-auto"></div>
          </div>
        </div>
      ) : filteredClients.length === 0 ? (
        clients.length === 0 ? (
          <EmptyState
            icon={Users}
            title="אין לקוחות במערכת"
            description="התחל לנהל את הלקוחות שלך על ידי הוספת הלקוח הראשון. תוכל לעקוב אחר תשלומים, משימות ועוד."
            actionLabel="הוסף לקוח ראשון"
            onAction={() => {
              const addButton = document.querySelector('[data-add-client-trigger]') as HTMLElement
              addButton?.click()
            }}
          />
        ) : (
          <EmptyState
            icon={Filter}
            title="לא נמצאו לקוחות"
            description="נסה לשנות את הפילטרים או את מילות החיפוש כדי למצוא לקוחות."
          />
        )
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {filteredClients.map((client) => (
            <ClientCard
              key={client.id}
              id={client.id}
              name={client.name}
              currentBalance={client.currentBalance}
              monthlyIncome={client.monthlyIncome}
              monthlyExpense={client.monthlyExpense}
              tags={client.tags}
              status={client.status}
              selected={selectedClientIds.includes(client.id)}
              onSelect={handleClientSelect}
              bulkMode={bulkMode}
              pendingPaymentsCount={client.pendingPaymentsCount}
              openRemindersCount={client.openRemindersCount}
              unreadMessagesCount={client.unreadMessagesCount}
              phone={client.phone}
              email={client.email}
              monthlyTrends={client.monthlyTrends}
              childCount={client.childCount}
            />
          ))}
        </div>
      )}
    </div>
  )
}

