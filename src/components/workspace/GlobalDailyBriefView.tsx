'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Sun,
  Sparkles,
  Share2,
  Copy,
  Check,
  RefreshCw,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Users,
  Building2,
  ArrowUpRight,
  ChevronLeft,
  CalendarDays,
  FileSpreadsheet,
  Brain,
  MessageSquare,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { fetchGlobalDailyBriefAction } from '@/app/workspace/actions/brief'
import type { GlobalDailyBrief } from '@/lib/v2/global-daily-brief'

interface Props {
  initialBrief?: GlobalDailyBrief | null
}

export function GlobalDailyBriefView({ initialBrief = null }: Props) {
  const router = useRouter()
  const [brief, setBrief] = useState<GlobalDailyBrief | null>(initialBrief)
  const [loading, setLoading] = useState<boolean>(!initialBrief)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const loadBrief = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true)
    else setRefreshing(true)
    setError(null)

    const res = await fetchGlobalDailyBriefAction()
    setLoading(false)
    setRefreshing(false)

    if (res.success && res.data) {
      setBrief(res.data)
    } else {
      setError(res.error || 'שגיאה בטעינת הבריף היומי')
    }
  }, [])

  useEffect(() => {
    if (!brief) {
      loadBrief(false)
    }
  }, [brief, loadBrief])

  async function handleCopyWhatsApp() {
    if (!brief) return
    try {
      await navigator.clipboard.writeText(brief.whatsappFormattedText)
      setCopied(true)
      toast.success('📋 הבריף היומי הועתק בהצלחה בפורמט מותאם ל-WhatsApp!', {
        description: 'תוכל להדביק אותו ישירות בקבוצה או בצ\'אט',
      })
      setTimeout(() => setCopied(false), 3000)
    } catch {
      toast.error('שגיאה בהעתקת הטקסט ללוח')
    }
  }

  function handleRefresh() {
    loadBrief(true)
  }

  if (loading || !brief) {
    return (
      <div dir="rtl" className="max-w-6xl mx-auto px-6 py-8 space-y-6 animate-in fade-in duration-300">
        {/* Immediate Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border/70 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md shadow-orange-500/20 text-white shrink-0">
              <Sun className="w-6 h-6 animate-spin" style={{ animationDuration: '8s' }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-foreground">בריף יומי מנהלים</h1>
                <Badge className="bg-amber-50 text-amber-700 border-amber-300 font-semibold text-[10px] gap-1 animate-pulse">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  סוכן AI מפיק בריף...
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                {new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · טוען ומסכם נתונים רוחביים...
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button disabled variant="outline" size="sm" className="h-9 px-3 gap-1.5 text-xs font-semibold">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              מפיק בריף...
            </Button>
          </div>
        </div>

        {/* AI Synthesis Loading Banner */}
        <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-indigo-500/10 p-5 flex items-center gap-4 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Brain className="w-5 h-5 animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground flex items-center gap-2">
              סוכן ה-AI סורק את מרחב העבודה של נחמיה
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              מנתח סטטוסי לקוחות, משימות דחופות, אירועי יומן והתראות פיננסיות להיום...
            </p>
          </div>
        </div>

        {/* Metric Cards Skeletons */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border-border/60 bg-card/60 animate-pulse">
              <CardContent className="p-4 space-y-3">
                <div className="h-3 w-20 bg-muted rounded-md" />
                <div className="h-7 w-12 bg-muted rounded-md" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Content Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            <div className="h-44 rounded-2xl bg-muted/40 border border-border/50 animate-pulse" />
            <div className="h-64 rounded-2xl bg-muted/40 border border-border/50 animate-pulse" />
          </div>
          <div className="space-y-4">
            <div className="h-56 rounded-2xl bg-muted/40 border border-border/50 animate-pulse" />
            <div className="h-56 rounded-2xl bg-muted/40 border border-border/50 animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  const { stats, tasks, calendar, clientsSummary, financialAlerts } = brief

  return (
    <div dir="rtl" className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border/70 p-5 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md shadow-orange-500/20 text-white shrink-0">
            <Sun className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-foreground">בריף יומי מנהלים</h1>
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold text-[10px]">
                ● עדכני להיום
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">
              {brief.formattedDate} · ריכוז פעילות, משימות, יומן ופיננסים רוחבי
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            onClick={handleCopyWhatsApp}
            className="h-9 px-4 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs text-xs"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'הועתק ללוח!' : 'העתק ל-WhatsApp'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="h-9 px-3 gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            רענן
          </Button>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <Card className="border-border/60 shadow-xs bg-card/80">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground">לקוחות רשומים</span>
              <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-foreground">{stats.totalClients}</span>
              <span className="text-[11px] text-muted-foreground font-medium">
                ({stats.onboardedClients} מאופיינים)
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs bg-card/80">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground">משימות להיום</span>
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-foreground">{stats.dueTodayTasksCount}</span>
              <span className="text-[11px] text-blue-600 font-semibold">לביצוע היום</span>
            </div>
          </CardContent>
        </Card>

        <Card className={`border-border/60 shadow-xs bg-card/80 ${stats.overdueTasksCount > 0 ? 'border-red-300 bg-red-50/30' : ''}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground">משימות באיחור</span>
              <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center text-red-600">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className={`text-2xl font-black ${stats.overdueTasksCount > 0 ? 'text-red-600' : 'text-foreground'}`}>
                {stats.overdueTasksCount}
              </span>
              <span className="text-[11px] text-muted-foreground font-medium">דורש טיפול</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs bg-card/80">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground">אירועים השבוע</span>
              <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
                <CalendarDays className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-foreground">{stats.upcomingEventsCount}</span>
              <span className="text-[11px] text-purple-600 font-semibold">פגישות ותזכורות</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Morning Brief Highlights Card */}
      <div className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/80 via-indigo-50/50 to-white p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-violet-800 font-bold text-sm">
            <div className="w-6 h-6 rounded-lg bg-violet-600 flex items-center justify-center text-white shadow-xs">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <span>הנחיות בוקר ודגשי AI לנחמיה</span>
          </div>
          <Badge variant="outline" className="text-[10px] text-violet-700 border-violet-300 bg-violet-100/60 font-semibold">
            ניתוח אוטונומי
          </Badge>
        </div>

        <div className="text-xs text-foreground/90 leading-relaxed whitespace-pre-line bg-white/70 p-4 rounded-xl border border-violet-100 font-normal">
          {brief.aiSummaryMarkdown}
        </div>
      </div>

      {/* Main Tabs Container */}
      <Tabs defaultValue="tasks" className="space-y-4">
        <TabsList className="bg-card border border-border p-1 rounded-xl h-10 w-full justify-start gap-1 flex-wrap">
          <TabsTrigger value="tasks" className="rounded-lg text-xs font-bold gap-1.5 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            <Clock className="w-3.5 h-3.5" />
            משימות ({tasks.dueToday.length + tasks.overdue.length})
          </TabsTrigger>
          <TabsTrigger value="emails" className="rounded-lg text-xs font-bold gap-1.5 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            <MessageSquare className="w-3.5 h-3.5" />
            מיילים לא נקראו ({stats.unreadEmailsCount || 0})
          </TabsTrigger>
          <TabsTrigger value="calendar" className="rounded-lg text-xs font-bold gap-1.5 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            <Calendar className="w-3.5 h-3.5" />
            יומן ופגישות ({calendar.length})
          </TabsTrigger>
          <TabsTrigger value="clients" className="rounded-lg text-xs font-bold gap-1.5 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            <Users className="w-3.5 h-3.5" />
            סטטוס לקוחות ({clientsSummary.length})
          </TabsTrigger>
          <TabsTrigger value="alerts" className="rounded-lg text-xs font-bold gap-1.5 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            <AlertTriangle className="w-3.5 h-3.5" />
            התראות ובריפים ({financialAlerts.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Tasks */}
        <TabsContent value="tasks" className="space-y-4 mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Overdue */}
            <Card className="border-border/70 shadow-xs">
              <CardHeader className="p-4 pb-2 border-b border-border/50 bg-red-50/40">
                <CardTitle className="text-xs font-bold text-red-700 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  משימות באיחור ({tasks.overdue.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-2 max-h-80 overflow-y-auto">
                {tasks.overdue.length === 0 ? (
                  <div className="text-center py-6 text-xs text-muted-foreground">
                    🎉 אין משימות באיחור!
                  </div>
                ) : (
                  tasks.overdue.map((t) => (
                    <div key={t.id} className="p-2.5 rounded-xl border border-red-200/80 bg-red-50/30 flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-foreground">{t.title}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          לקוח: <span className="font-semibold text-foreground/80">{t.clientName || 'כללי'}</span> · מועד: {t.dueAt || 'לא צוין'}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[9px] text-red-700 border-red-300 bg-red-100/60 font-bold shrink-0">
                        {t.priority === 'urgent' ? 'דחוף' : 'באיחור'}
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Due Today */}
            <Card className="border-border/70 shadow-xs">
              <CardHeader className="p-4 pb-2 border-b border-border/50 bg-blue-50/40">
                <CardTitle className="text-xs font-bold text-blue-700 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  משימות להיום ({tasks.dueToday.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-2 max-h-80 overflow-y-auto">
                {tasks.dueToday.length === 0 ? (
                  <div className="text-center py-6 text-xs text-muted-foreground">
                    אין משימות מתוזמנות להיום
                  </div>
                ) : (
                  tasks.dueToday.map((t) => (
                    <div key={t.id} className="p-2.5 rounded-xl border border-blue-200/80 bg-blue-50/30 flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-foreground">{t.title}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          לקוח: <span className="font-semibold text-foreground/80">{t.clientName || 'כללי'}</span>
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[9px] text-blue-700 border-blue-300 bg-blue-100/60 font-bold shrink-0">
                        היום
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 1.5: Unread Emails */}
        <TabsContent value="emails" className="mt-0">
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="p-4 pb-2 border-b border-border/50 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
                מיילים שלא נקראו בתיבת Gmail ({brief.unreadEmails?.length || 0})
              </CardTitle>
              <Link
                href="/workspace/emails"
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                פתח תיבת דואר מלאה
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </CardHeader>
            <CardContent className="p-3 space-y-2">
              {!brief.unreadEmails || brief.unreadEmails.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  🎉 כל המיילים נקראו! אין הודעות ממתינות למענה.
                </div>
              ) : (
                brief.unreadEmails.map((m) => (
                  <div
                    key={m.threadId}
                    className="p-3 rounded-xl border border-indigo-100 bg-indigo-50/20 hover:bg-indigo-50/50 flex items-start justify-between gap-3 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-foreground truncate">{m.from}</span>
                        {m.clientName && (
                          <Badge className="bg-indigo-100 text-indigo-800 border-indigo-300 text-[9px] px-1.5 py-0 h-4">
                            לקוח: {m.clientName}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-foreground/90 mt-0.5 truncate">
                        {m.subject || '(ללא נושא)'}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{m.date}</p>
                    </div>
                    <Link
                      href="/workspace/emails"
                      className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold shrink-0 shadow-xs"
                    >
                      השב במייל
                    </Link>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Calendar */}
        <TabsContent value="calendar" className="mt-0">
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="p-4 pb-2 border-b border-border/50">
              <CardTitle className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-indigo-600" />
                פגישות ואירועי יומן לשבוע הקרוב
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-2">
              {calendar.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  אין אירועים קרובים ביומן ל-7 הימים הקרובים
                </div>
              ) : (
                calendar.map((e) => {
                  const startDate = new Date(e.start)
                  const dateFormatted = startDate.toLocaleDateString('he-IL', { weekday: 'short', month: 'numeric', day: 'numeric', timeZone: 'Asia/Jerusalem' })
                  const timeFormatted = e.allDay ? 'כל היום' : startDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' })

                  return (
                    <div key={e.id} className="p-3 rounded-xl border border-border/60 bg-card/60 flex items-center justify-between gap-3 hover:border-indigo-300 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="text-center px-2 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 shrink-0">
                          <p className="text-[10px] font-bold leading-none">{dateFormatted}</p>
                          <p className="text-[11px] font-black mt-0.5">{timeFormatted}</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-foreground">{e.title}</p>
                          {e.clientName && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              משויך ללקוח: <span className="font-semibold text-indigo-600">{e.clientName}</span>
                            </p>
                          )}
                        </div>
                      </div>
                      {e.clientId && (
                        <Link href={`/workspace/clients/${e.clientId}`} className="text-indigo-600 hover:text-indigo-800">
                          <ArrowUpRight className="w-4 h-4" />
                        </Link>
                      )}
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Clients */}
        <TabsContent value="clients" className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {clientsSummary.map((c) => (
              <div key={c.id} className="p-3.5 rounded-2xl border border-border/70 bg-card hover:border-indigo-300 transition-all flex flex-col justify-between gap-2.5">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/workspace/clients/${c.id}`} className="font-bold text-xs text-foreground hover:text-indigo-600 truncate">
                      {c.name}
                    </Link>
                    <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 ${c.hasContext ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-amber-50 text-amber-700 border-amber-300 animate-pulse'}`}>
                      {c.hasContext ? 'מאופיין' : 'ממתין לאפיון'}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                    {c.businessType}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/40 text-[10px]">
                  <div className="flex items-center gap-1.5">
                    {c.hasSheet ? (
                      <span className="text-emerald-600 font-semibold flex items-center gap-0.5">
                        <FileSpreadsheet className="w-3 h-3" /> Sheets
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">ללא גיליון</span>
                    )}
                  </div>
                  <Link href={`/workspace/clients/${c.id}?tab=ai`} className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-0.5">
                    צ&apos;אט AI <ChevronLeft className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Tab 4: Alerts */}
        <TabsContent value="alerts" className="mt-0">
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="p-4 pb-2 border-b border-border/50">
              <CardTitle className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                התראות לקוחות, בריפים ואפיון
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-2">
              {financialAlerts.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  ✅ כל הלקוחות והבריפים מעודכנים, אין התראות דחופות
                </div>
              ) : (
                financialAlerts.map((a, i) => (
                  <div key={i} className="p-3 rounded-xl border border-amber-200/80 bg-amber-50/40 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                        <Brain className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground">{a.clientName}</p>
                        <p className="text-[11px] text-amber-800/90 mt-0.5">{a.title}</p>
                      </div>
                    </div>
                    <Link
                      href={`/workspace/clients/${a.clientId}?tab=ai`}
                      className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] shrink-0 transition-colors shadow-xs"
                    >
                      פתח סוכן AI
                    </Link>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
