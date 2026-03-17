'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { 
  Calendar, CheckCircle2, Clock, Users, 
  ArrowRight, AlertCircle, Wallet,
  CalendarPlus, ListTodo, UserPlus, Plus
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { loadDashboardData, type DashboardData } from '@/lib/actions/dashboard'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { format, isBefore, startOfDay } from 'date-fns'
import { he } from 'date-fns/locale'
import { RecentlyViewed } from '@/components/recently-viewed'
import { CreateMeetingDialog } from '@/components/create-meeting-dialog'
import { CreateTaskDialog } from '@/components/create-task-dialog'
import { CreatePaymentDialog } from '@/components/create-payment-dialog'
import { AddClientDialog } from '@/components/add-client-dialog'
import { supabase } from '@/lib/supabase'
import { logAction } from '@/lib/audit-log'
import { PublicLanding } from '@/components/public-landing'
import { type User } from '@supabase/supabase-js'

export default function TodayDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [authChecked, setAuthChecked] = useState(false)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const result = await loadDashboardData()
      if (result.success && result.data) setData(result.data)
    } catch (error) {
      console.error('Error loading dashboard:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setAuthChecked(true)
      if (user) loadData()
    }
    checkUser()
  }, [loadData])

  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')

  const todaysMeetings = useMemo(() => {
    if (!data?.alerts.recentMeetings) return []
    return data.alerts.recentMeetings.filter(m => 
      format(new Date(m.meeting_date), 'yyyy-MM-dd') === todayStr
    ).sort((a, b) => new Date(a.meeting_date).getTime() - new Date(b.meeting_date).getTime())
  }, [data, todayStr])

  const todaysTasks = useMemo(() => {
    if (!data?.alerts.upcomingReminders) return []
    return data.alerts.upcomingReminders.filter(r => 
      format(new Date(r.due_date), 'yyyy-MM-dd') === todayStr && !r.is_completed
    )
  }, [data, todayStr])

  const overdueTasks = useMemo(() => {
    if (!data?.alerts.upcomingReminders) return []
    return data.alerts.upcomingReminders.filter(r => {
      const dueDate = startOfDay(new Date(r.due_date))
      return isBefore(dueDate, startOfDay(new Date())) && !r.is_completed
    })
  }, [data])

  const upcomingThisWeek = useMemo(() => {
    if (!data?.alerts.upcomingReminders) return []
    const todayDate = startOfDay(new Date())
    const weekFromNow = new Date(todayDate)
    weekFromNow.setDate(weekFromNow.getDate() + 7)
    return data.alerts.upcomingReminders.filter(r => {
      const dueDate = startOfDay(new Date(r.due_date))
      return dueDate > todayDate && dueDate <= weekFromNow && !r.is_completed
    }).slice(0, 5)
  }, [data])

  const activeClientsCount = data?.clients.filter(c => c.status === 'פעיל').length || 0

  const clientsNeedingAttention = useMemo(() => {
    if (!data?.clients) return []
    return data.clients
      .filter(c => c.status === 'פעיל' && (
        (c.pendingPaymentsCount ?? 0) > 0 ||
        (c.openRemindersCount ?? 0) > 0 ||
        (c.unreadMessagesCount ?? 0) > 0
      ))
      .sort((a, b) => {
        const scoreA = ((a.pendingPaymentsCount ?? 0) * 3) + ((a.openRemindersCount ?? 0) * 2) + (a.unreadMessagesCount ?? 0)
        const scoreB = ((b.pendingPaymentsCount ?? 0) * 3) + ((b.openRemindersCount ?? 0) * 2) + (b.unreadMessagesCount ?? 0)
        return scoreB - scoreA
      })
      .slice(0, 4)
  }, [data])
  const pendingPaymentsCount = data?.alerts.pendingPayments.length || 0
  const pendingPaymentsTotal = data?.alerts.pendingPayments.reduce((sum, p) => sum + Math.abs(p.amount), 0) || 0

  const handleAddClient = async (name: string, email: string | null, phone: string | null, status: string) => {
    const { data: newClient, error } = await supabase
      .from('clients').insert([{ name, email, phone, status }]).select().single()
    if (error) throw error
    if (newClient) await logAction('client.created', 'client', newClient.id, `לקוח חדש נוצר: ${name}`, { email, phone, status })
    loadData()
  }

  if (!authChecked || (loading && user)) {
    return (
      <div className="p-8 space-y-8 animate-pulse" dir="rtl">
        <div className="h-20 bg-grey/10 rounded-3xl w-1/3" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-grey/10 rounded-2xl" />)}</div>
        <div className="h-64 bg-grey/10 rounded-3xl" />
      </div>
    )
  }

  if (!user) {
    return <PublicLanding />
  }

  const hour = today.getHours()
  const greeting = hour < 12 ? 'בוקר טוב' : hour < 17 ? 'צהריים טובים' : 'ערב טוב'

  return (
    <div className="p-6 md:p-8 space-y-8 bg-background min-h-screen" dir="rtl">
      {/* Header + Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 animate-fade-in-up">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight mb-2">{greeting}, נחמיה</h1>
          <p className="text-muted-foreground font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            {format(today, 'EEEE, d בMMMM yyyy', { locale: he })}
          </p>
        </div>

        {/* All 4 Quick Actions – open dialogs right here */}
        <div className="flex items-center gap-2 flex-wrap">
          <CreateMeetingDialog onCreated={loadData} trigger={
            <Button className="rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-2 h-10 px-4 shadow-sm text-xs">
              <CalendarPlus className="h-3.5 w-3.5" />פגישה
            </Button>
          } />
          <CreateTaskDialog onCreated={loadData} trigger={
            <Button variant="outline" className="rounded-lg border-border bg-card font-medium gap-2 h-10 px-4 text-xs shadow-sm text-foreground hover:bg-secondary">
              <ListTodo className="h-3.5 w-3.5" />משימה
            </Button>
          } />
          <CreatePaymentDialog onCreated={loadData} trigger={
            <Button variant="outline" className="rounded-lg border-border bg-card font-medium gap-2 h-10 px-4 text-xs shadow-sm text-foreground hover:bg-secondary">
              <Wallet className="h-3.5 w-3.5" />תשלום
            </Button>
          } />
          <AddClientDialog onAddClient={handleAddClient} />
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-fade-in-up delay-100">
        <MetricCard icon={Clock} label="פגישות היום" value={todaysMeetings.length.toString()} color="primary" />
        <MetricCard icon={CheckCircle2} label="משימות היום" value={todaysTasks.length.toString()} color="emerald" />
        <MetricCard icon={AlertCircle} label="באיחור" value={overdueTasks.length.toString()} color="rose" />
        <MetricCard icon={Users} label="לקוחות פעילים" value={activeClientsCount.toString()} color="indigo" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Column */}
        <div className="lg:col-span-8 space-y-6 animate-fade-in-up delay-200">
          
          {/* Today's Agenda */}
          <Card className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-3">
                <div className="w-1.5 h-6 bg-primary rounded-full" />
                סדר יום להיום
              </h2>
              <span className="px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground text-[10px] font-bold uppercase tracking-wider">
                {todaysMeetings.length + todaysTasks.length} אירועים
              </span>
            </div>
            <div className="p-4 sm:p-6">
              {todaysMeetings.length === 0 && todaysTasks.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <Calendar className="h-12 w-12 text-muted-foreground/30 mx-auto" />
                  <p className="text-foreground font-medium">יום פנוי</p>
                  <p className="text-muted-foreground text-sm">אין אירועים מתוכננים להיום</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {todaysMeetings.map(meeting => (
                    <AgendaItem key={`m-${meeting.id}`} type="meeting" time={format(new Date(meeting.meeting_date), 'HH:mm')} title={meeting.subject} subtitle={meeting.client?.name} link={`/clients/${meeting.client_id}`} />
                  ))}
                  {todaysTasks.map(task => (
                    <AgendaItem key={`t-${task.id}`} type="task" time="היום" title={task.title} subtitle={task.client?.name || '🔒 אישי'} priority={task.priority} link={task.client_id ? `/clients/${task.client_id}` : '/tasks'} />
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Overdue */}
          {overdueTasks.length > 0 && (
            <Card className="rounded-xl border border-destructive/20 bg-destructive/5 shadow-sm overflow-hidden">
              <div className="p-5 sm:p-6 border-b border-destructive/10 flex items-center justify-between">
                <h2 className="text-lg font-bold text-destructive flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-destructive rounded-full" />
                  משימות באיחור
                </h2>
                <span className="px-2.5 py-1 rounded-md bg-destructive/10 text-destructive text-[10px] font-bold">
                  {overdueTasks.length}
                </span>
              </div>
              <div className="p-4 sm:p-6 space-y-2">
                {overdueTasks.slice(0, 5).map(task => (
                  <Link key={task.id} href={task.client_id ? `/clients/${task.client_id}` : '/tasks'} className="flex items-center gap-3 p-3 rounded-lg bg-background border border-border hover:border-destructive/30 transition-all group">
                    <div className="w-8 h-8 rounded-md bg-destructive/10 flex items-center justify-center text-destructive shrink-0">
                      <AlertCircle className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm text-foreground truncate">{task.title}</h4>
                      <p className="text-[11px] font-medium text-muted-foreground">{task.client?.name || 'אישי'} • מ-{format(new Date(task.due_date), 'd/M')}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                ))}
                {overdueTasks.length > 5 && (
                  <Button asChild variant="ghost" className="w-full text-destructive-foreground font-medium text-sm mt-2">
                    <Link href="/tasks">עוד {overdueTasks.length - 5} →</Link>
                  </Button>
                )}
              </div>
            </Card>
          )}

          {/* Upcoming This Week */}
          {upcomingThisWeek.length > 0 && (
            <Card className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="p-5 sm:p-6 border-b border-border flex items-center justify-between">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                  השבוע הקרוב
                </h2>
                <Button asChild variant="ghost" className="text-primary font-medium gap-1 text-xs px-2 h-8">
                  <Link href="/calendar">ליומן <ArrowRight className="h-3.5 w-3.5" /></Link>
                </Button>
              </div>
              <div className="p-4 sm:p-6 space-y-2">
                {upcomingThisWeek.map(task => (
                  <Link key={task.id} href={task.client_id ? `/clients/${task.client_id}` : '/tasks'} className="flex items-center gap-4 p-3 rounded-lg border border-transparent hover:border-border hover:bg-secondary/50 transition-all group">
                    <div className="w-10 text-center shrink-0">
                      <div className="text-[10px] font-bold text-muted-foreground uppercase">{format(new Date(task.due_date), 'EEE', { locale: he })}</div>
                      <div className="text-lg font-bold text-foreground">{format(new Date(task.due_date), 'd')}</div>
                    </div>
                    <div className="w-px h-8 bg-border shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors">{task.title}</h4>
                      <p className="text-xs text-muted-foreground">{task.client?.name || '🔒 אישי'}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar Column */}
        <div className="lg:col-span-4 space-y-6 animate-fade-in-up delay-300">
          {/* Quick Status */}
          <Card className="p-5 sm:p-6 rounded-xl border border-border bg-card shadow-sm">
            <h3 className="text-base font-bold text-foreground mb-4">סיכום מהיר</h3>
            <div className="space-y-4">
              <QuickStatRow label="תשלומים ממתינים" value={`₪${pendingPaymentsTotal.toLocaleString()}`} href="/cashflow" icon={<Wallet className="h-4 w-4 text-muted-foreground" />} />
              <div className="h-px bg-border" />
              <QuickStatRow label="משימות פתוחות" value={String(todaysTasks.length + overdueTasks.length)} href="/tasks" icon={<ListTodo className="h-4 w-4 text-muted-foreground" />} />
              <div className="h-px bg-border" />
              <QuickStatRow label="לקוחות פעילים" value={String(activeClientsCount)} href="/clients" icon={<Users className="h-4 w-4 text-muted-foreground" />} />
            </div>
          </Card>

          <RecentlyViewed />

          {/* Clients Needing Attention */}
          {clientsNeedingAttention.length > 0 && (
            <Card className="p-5 sm:p-6 rounded-xl border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  דורשים תשומת לב
                </h3>
                <Button asChild variant="ghost" className="text-primary font-medium text-xs px-2 h-7">
                  <Link href="/clients">כל הלקוחות</Link>
                </Button>
              </div>
              <div className="space-y-2">
                {clientsNeedingAttention.map(client => (
                  <Link
                    key={client.id}
                    href={`/clients/${client.id}`}
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-secondary/50 border border-transparent hover:border-border transition-all group"
                  >
                    <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                      {client.name}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {(client.pendingPaymentsCount ?? 0) > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-600 border border-amber-100">
                          ₪{client.pendingPaymentsCount}
                        </span>
                      )}
                      {(client.openRemindersCount ?? 0) > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-600 border border-purple-100">
                          {client.openRemindersCount} משימות
                        </span>
                      )}
                      {(client.unreadMessagesCount ?? 0) > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-600 border border-rose-100 animate-pulse">
                          {client.unreadMessagesCount} הודעות
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, color }: any) {
  const colors: any = {
    primary: 'bg-primary/10 text-primary border-primary/20',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100'
  }
  return (
    <Card className={cn(
      "p-5 rounded-2xl border bg-card shadow-sm hover:shadow-md transition-all duration-300 group",
      colors[color].split(' ').pop() // Use the last class as marker if needed
    )}>
      <div className="flex flex-col gap-3">
        <div className={cn("p-2.5 rounded-xl w-fit border transition-transform group-hover:scale-110 duration-300", colors[color])}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-3xl font-black text-navy tracking-tight">{value}</div>
          <div className="text-[11px] font-bold text-grey uppercase tracking-widest">{label}</div>
        </div>
      </div>
    </Card>
  )
}

function AgendaItem({ type, time, title, subtitle, link, priority }: any) {
  return (
    <Link href={link} className="flex items-center gap-4 p-3 rounded-lg hover:bg-secondary/50 border border-transparent hover:border-border transition-all group">
      <div className="w-12 text-center shrink-0"><div className="text-xs font-bold text-muted-foreground group-hover:text-primary transition-colors">{time}</div></div>
      <div className="w-px h-8 bg-border shrink-0" />
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${type === 'meeting' ? 'bg-primary' : 'bg-emerald-500'}`} />
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors">{title}</h4>
        <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
          {type === 'meeting' ? <Users className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
          {subtitle}
        </div>
      </div>
      {priority === 'דחוף' && <span className="px-2 py-0.5 rounded-md bg-destructive/10 text-destructive text-[10px] font-bold">דחוף</span>}
    </Link>
  )
}

function QuickStatRow({ label, value, href, icon }: any) {
  return (
    <Link href={href} className="flex items-center justify-between hover:opacity-80 transition-opacity group">
      <span className="text-muted-foreground text-sm font-medium flex items-center gap-2">{icon}{label}</span>
      <span className="text-foreground font-bold text-base group-hover:text-primary transition-colors">{value}</span>
    </Link>
  )
}
