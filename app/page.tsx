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
      const { data, error } = await supabase.from('clients').select('*').order('created_at', { ascending: false })

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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-navy mb-2">לוח בקרה</h1>
        <p className="text-grey">ניהול לקוחות - נחמיה דרוק</p>
      </div>

      {/* KPI Summary Cards */}
      {!loading && clients.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-8">
          <div className="bg-white rounded-lg border p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-lg bg-blue-50">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <span className="text-sm text-grey">לקוחות פעילים</span>
            </div>
            <div className="text-2xl font-bold text-navy">{dashboardKPIs.activeCount}</div>
            <div className="text-xs text-grey">מתוך {dashboardKPIs.totalClients} סה"כ</div>
          </div>

          <div className="bg-white rounded-lg border p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-lg bg-green-50">
                <TrendingUp className="h-5 w-5 text-emerald" />
              </div>
              <span className="text-sm text-grey">הכנסות חודשי</span>
            </div>
            <div className="text-2xl font-bold text-emerald">₪{dashboardKPIs.totalMonthlyIncome.toLocaleString()}</div>
            <div className="text-xs text-grey">הוצאות: ₪{dashboardKPIs.totalMonthlyExpense.toLocaleString()}</div>
          </div>

          <div className="bg-white rounded-lg border p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-lg bg-amber-50">
                <CreditCard className="h-5 w-5 text-amber-600" />
              </div>
              <span className="text-sm text-grey">תשלומים ממתינים</span>
            </div>
            <div className="text-2xl font-bold text-amber-600">{dashboardKPIs.totalPendingPayments}</div>
          </div>

          <div className="bg-white rounded-lg border p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-lg bg-purple-50">
                <Bell className="h-5 w-5 text-purple-600" />
              </div>
              <span className="text-sm text-grey">משימות פתוחות</span>
            </div>
            <div className="text-2xl font-bold text-purple-600">{dashboardKPIs.totalOpenReminders}</div>
          </div>

          <div className="bg-white rounded-lg border p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-lg bg-cyan-50">
                <UserPlus className="h-5 w-5 text-cyan-600" />
              </div>
              <span className="text-sm text-grey">חדשים החודש</span>
            </div>
            <div className="text-2xl font-bold text-cyan-600">{dashboardKPIs.newClientsCount}</div>
          </div>
        </div>
      )}

      {/* Alerts Center - Moved to top */}
      <div className="mb-8 bg-white rounded-lg border p-6" dir="rtl">
        <h2 className="text-xl font-semibold mb-4">התראות ומשימות קרובות</h2>

        {alertsLoading ? (
          <div className="text-center py-4 text-grey">טוען התראות...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pending Payments */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="h-5 w-5 text-yellow-600" />
                <h3 className="font-semibold">תשלומים ממתינים</h3>
              </div>
              {pendingPayments.length > 0 ? (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {pendingPayments.map((payment) => (
                    <Link
                      key={payment.id}
                      href={`/clients/${payment.client_id}`}
                      className="block p-3 border rounded-lg hover:bg-yellow-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">
                            {(payment.client as Client)?.name || 'לקוח לא ידוע'}
                          </div>
                          <div className="text-sm text-grey">
                            {new Date(payment.payment_date).toLocaleDateString('he-IL')}
                          </div>
                        </div>
                        <div className="text-lg font-bold text-yellow-600">
                          ₪{payment.amount.toLocaleString('he-IL')}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-50 mb-2">
                    <DollarSign className="h-6 w-6 text-green-600" />
                  </div>
                  <p className="text-sm text-grey">אין תשלומים ממתינים</p>
                  <p className="text-xs text-grey mt-1">כל התשלומים עודכנו</p>
                </div>
              )}
            </div>

            {/* Upcoming Reminders */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold">משימות קרובות (7 ימים הקרובים)</h3>
              </div>
              {upcomingReminders.length > 0 ? (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {upcomingReminders.map((reminder) => (
                    <Link
                      key={reminder.id}
                      href={reminder.client_id ? `/clients/${reminder.client_id}` : '#'}
                      className="block p-3 border rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{reminder.title}</div>
                          <div className="text-sm text-grey">
                            {reminder.client ? (reminder.client as Client).name : 'כללי'}
                          </div>
                          <div className="text-sm text-grey">
                            {new Date(reminder.due_date).toLocaleDateString('he-IL')}
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs ${reminder.priority === 'High' ? 'bg-red-100 text-red-700' :
                          reminder.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                          {reminder.priority === 'High' ? 'גבוהה' :
                            reminder.priority === 'Medium' ? 'בינונית' : 'נמוכה'}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 mb-2">
                    <Calendar className="h-6 w-6 text-blue-600" />
                  </div>
                  <p className="text-sm text-grey">אין משימות קרובות</p>
                  <p className="text-xs text-grey mt-1">הכל מסודר ל-7 הימים הקרובים</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mb-6 space-y-4">
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
          <GlobalSearch />
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-grey" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            >
              <option value="הכל">הכל</option>
              <option value="פעיל">פעיל</option>
              <option value="ליד">ליד</option>
              <option value="ארכיון">ארכיון</option>
            </select>
          </div>
          {availableTags.length > 0 && (
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-grey" />
              <Select value={selectedTagFilter} onValueChange={setSelectedTagFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="תגיות" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל התגיות</SelectItem>
                  {availableTags.map(tag => (
                    <SelectItem key={tag.id} value={tag.id}>
                      {tag.name}
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
            className="gap-2"
          >
            {bulkMode ? <Square className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
            {bulkMode ? 'יציאה ממצב בחירה' : 'בחר מרובים'}
          </Button>
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-grey" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'balance' | 'created')}
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            >
              <option value="created">תאריך יצירה</option>
              <option value="name">שם</option>
              <option value="balance">יתרה</option>
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="gap-1"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </Button>
          </div>
          <AddClientDialog onAddClient={handleAddClient} />
        </div>
        {filteredClients.length !== clients.length && (
          <div className="text-sm text-grey">
            מציג {filteredClients.length} מתוך {clients.length} לקוחות
          </div>
        )}
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
            />
          ))}
        </div>
      )}
    </div>
  )
}

