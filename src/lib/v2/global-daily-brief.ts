import 'server-only'

import { google } from '@ai-sdk/google'
import { generateText } from 'ai'
import { getWorkspaceAdminDb } from '@/lib/v2/workspace-dal'
import { getSheetRows } from '@/lib/google-sheets'
import { listWorkspaceCalendarEvents } from '@/lib/v2/google-calendar'
import { listMonthlyBriefs } from '@/lib/v2/monthly-brief'
import { clientContextSchema } from '@/lib/v2/client-context-schema'

export interface GlobalDailyBrief {
  generatedAt: string
  formattedDate: string
  headline: string
  stats: {
    totalClients: number
    onboardedClients: number
    pendingOnboarding: number
    dueTodayTasksCount: number
    overdueTasksCount: number
    upcomingEventsCount: number
    actionRequiredCount: number
  }
  tasks: {
    overdue: Array<{ id: string; title: string; clientName: string | null; dueAt: string | null; priority: string }>
    dueToday: Array<{ id: string; title: string; clientName: string | null; dueAt: string | null; priority: string }>
    upcoming: Array<{ id: string; title: string; clientName: string | null; dueAt: string | null; priority: string }>
  }
  calendar: Array<{
    id: string
    title: string
    start: string
    end: string
    allDay: boolean
    clientId: string | null
    clientName: string | null
  }>
  clientsSummary: Array<{
    id: string
    name: string
    businessType: string
    status: string
    hasSheet: boolean
    hasContext: boolean
    pendingBrief: boolean
  }>
  financialAlerts: Array<{
    clientId: string
    clientName: string
    title: string
    amount?: number | string
    type: 'debt' | 'expense' | 'deposit' | 'alert'
  }>
  aiSummaryMarkdown: string
  whatsappFormattedText: string
}

export async function generateGlobalDailyBrief(): Promise<GlobalDailyBrief> {
  const now = new Date()
  const formattedDate = now.toLocaleDateString('he-IL', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Jerusalem',
  })

  // 1. Fetch Clients directly via admin DB
  const db = getWorkspaceAdminDb()
  const { data: rawClients, error: clientsError } = await db
    .from('clients')
    .select('id, name, email, phone, address, id_number, status, drive_folder_id, google_sheet_id, dashboard_config_json, client_context_json, portfolio_value, advisory_goal, risk_level, created_at')
    .order('name')

  if (clientsError) throw new Error(`[global-daily-brief] Failed to load clients: ${clientsError.message}`)
  const clients = rawClients ?? []

  // 2. Fetch Tasks across all workspace clients
  let allTasks: Array<{ id: string; title: string; clientName: string | null; dueAt: string | null; priority: string; reminderState: string }> = []
  try {
    const { data: opSettings } = await db
      .from('v2_operations_workspace')
      .select('workbook_id')
      .eq('singleton_key', true)
      .maybeSingle()

    if (opSettings?.workbook_id) {
      const rows = await getSheetRows(opSettings.workbook_id as string, 'משימות')
      const { classifyTaskReminder } = await import('@/lib/v2/workspace-tasks')
      allTasks = rows.map((row) => {
        const base = {
          id: row['מזהה'],
          title: row['כותרת'],
          clientName: row['שם לקוח']?.trim() || null,
          dueAt: row['מועד יעד']?.trim() || null,
          priority: row['עדיפות']?.trim() || 'medium',
          status: row['סטטוס']?.trim() || 'todo',
          snoozedUntil: row['נדחה עד']?.trim() || null,
        }
        return {
          ...base,
          reminderState: classifyTaskReminder(base),
        }
      })
    }
  } catch (error) {
    console.warn('[global-daily-brief] Failed to load workspace tasks:', error)
  }

  // 3. Fetch Calendar Events for Today & Upcoming 7 Days
  const startOfDay = new Date(now)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfWindow = new Date(now)
  endOfWindow.setDate(endOfWindow.getDate() + 7)
  endOfWindow.setHours(23, 59, 59, 999)

  let calendarEvents: Array<{
    id: string
    title: string
    start: string
    end: string
    allDay: boolean
    clientId: string | null
    clientName: string | null
  }> = []

  try {
    const calendarResult = await listWorkspaceCalendarEvents({
      timeMin: startOfDay.toISOString(),
      timeMax: endOfWindow.toISOString(),
    })

    const clientMap = new Map(clients.map((c) => [c.id, c.name]))
    calendarEvents = calendarResult.events.map((e) => ({
      id: e.id,
      title: e.title,
      start: e.start,
      end: e.end,
      allDay: e.allDay,
      clientId: e.clientId,
      clientName: e.clientId ? (clientMap.get(e.clientId) ?? null) : null,
    }))
  } catch (error) {
    console.warn('[global-daily-brief] Failed to load calendar events:', error)
  }

  // 4. Client Summaries & Context / Monthly Brief flags
  const clientsSummary: GlobalDailyBrief['clientsSummary'] = []
  const financialAlerts: GlobalDailyBrief['financialAlerts'] = []

  for (const client of clients) {
    const ctxParsed = clientContextSchema.safeParse(client.client_context_json)
    const hasContext = ctxParsed.success
    const businessType = hasContext ? ctxParsed.data.businessType : 'טרם אופיין'

    let pendingBrief = false
    try {
      const briefs = await listMonthlyBriefs(client.id)
      pendingBrief = briefs.some((b) => b.state === 'needs_input')
    } catch {
      // ignore
    }

    clientsSummary.push({
      id: client.id,
      name: client.name,
      businessType,
      status: client.status || 'active',
      hasSheet: !!client.google_sheet_id,
      hasContext,
      pendingBrief,
    })

    if (pendingBrief) {
      financialAlerts.push({
        clientId: client.id,
        clientName: client.name,
        title: 'בריף חודשי ממתין למענה לשאלות נחמיה',
        type: 'alert',
      })
    }

    if (!hasContext && client.google_sheet_id) {
      financialAlerts.push({
        clientId: client.id,
        clientName: client.name,
        title: 'ממתין לאפיון ראשוני ומיפוי לשוניות',
        type: 'alert',
      })
    }
  }

  // Filter tasks
  const overdueTasks = allTasks.filter((t) => t.reminderState === 'overdue')
  const dueTodayTasks = allTasks.filter((t) => t.reminderState === 'due_today')
  const upcomingTasks = allTasks.filter((t) => t.reminderState === 'upcoming')

  const onboardedCount = clientsSummary.filter((c) => c.hasContext).length
  const pendingOnboardingCount = clientsSummary.length - onboardedCount

  // 5. Generate AI Executive Summary & Action Highlights
  const briefContextPrompt = `
תאריך היום: ${formattedDate}
סה"כ לקוחות: ${clients.length} (מאופיינים: ${onboardedCount}, ממתינים לאפיון: ${pendingOnboardingCount})
משימות באיחור (${overdueTasks.length}):
${overdueTasks.map((t) => `- [דחוף] ${t.title} (${t.clientName || 'כללי'}) מועד: ${t.dueAt || 'ללא'}`).join('\n') || 'אין'}

משימות להיום (${dueTodayTasks.length}):
${dueTodayTasks.map((t) => `- ${t.title} (${t.clientName || 'כללי'})`).join('\n') || 'אין'}

פגישות ואירועים להיום והשבוע (${calendarEvents.length}):
${calendarEvents.slice(0, 8).map((e) => `- ${e.title} (${e.clientName || 'כללי'}) ב-${new Date(e.start).toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' })}`).join('\n') || 'אין'}

התראות לקוחות ובריפים:
${financialAlerts.map((a) => `- ${a.clientName}: ${a.title}`).join('\n') || 'הכל מעודכן'}
`.trim()

  let aiSummaryMarkdown = ''
  let headline = `בוקר טוב נחמיה — תמונת מצב יומית (${formattedDate})`

  try {
    const aiResponse = await generateText({
      model: google('gemini-2.5-flash'),
      system: `אתה "נחמיה AI" - העוזר העסקי והפיננסי האישי של נחמיה (מנהל המשרד).
תפקידך לנסח בריף בוקר מנהלים (Executive Morning Brief) ממוקד, חד, מקצועי ופרקטי בעברית.
הבריף צריך לכלול:
1. פסקת פתיחה קצרה וחדה על תמונת המצב להיום.
2. 3-4 נקודות מיקוד לפעולה (Action Items) ממוינות לפי עדיפות (קודם משימות דחופות, לקוחות שממתינים למענה, או פגישות).
3. טון נמרץ, עסקי וישיר. השתמש באימוג'ים מתאימים בצורה אלגנטית.`,
      prompt: `צור בריף מנהלים יומי על בסיס הנתונים הבאים:\n${briefContextPrompt}`,
    })
    aiSummaryMarkdown = aiResponse.text.trim()
  } catch (error) {
    console.warn('[global-daily-brief] AI text generation failed, using fallback:', error)
    aiSummaryMarkdown = `### 📋 תמונת מצב יומית
היום יש **${dueTodayTasks.length}** משימות לביצוע, **${overdueTasks.length}** משימות באיחור, ו-**${calendarEvents.length}** אירועים ביומן.
${overdueTasks.length > 0 ? `⚠️ **יש לטפל במשימות באיחור בדחיפות.**` : '✅ אין משימות באיחור.'}`
  }

  // 6. Build WhatsApp Formatted String
  const whatsappLines: string[] = [
    `☀️ *בריף יומי — Nehemiah OS*`,
    `📅 ${formattedDate}`,
    ``,
    `📊 *מבט על:*`,
    `• לקוחות פעילים: ${clients.length}`,
    `• משימות להיום: ${dueTodayTasks.length}`,
    `• משימות באיחור: ${overdueTasks.length}`,
    `• אירועים/פגישות השבוע: ${calendarEvents.length}`,
    ``,
  ]

  if (overdueTasks.length > 0) {
    whatsappLines.push(`🚨 *משימות דחופות באיחור:*`)
    overdueTasks.slice(0, 5).forEach((t) => {
      whatsappLines.push(`• ${t.title} (${t.clientName || 'כללי'})`)
    })
    whatsappLines.push(``)
  }

  if (dueTodayTasks.length > 0) {
    whatsappLines.push(`📌 *משימות להיום:*`)
    dueTodayTasks.slice(0, 5).forEach((t) => {
      whatsappLines.push(`• ${t.title} (${t.clientName || 'כללי'})`)
    })
    whatsappLines.push(``)
  }

  if (calendarEvents.length > 0) {
    whatsappLines.push(`📅 *פגישות ואירועים קרובים:*`)
    calendarEvents.slice(0, 4).forEach((e) => {
      const timeStr = new Date(e.start).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' })
      whatsappLines.push(`• ${timeStr} — ${e.title} ${e.clientName ? `(${e.clientName})` : ''}`)
    })
    whatsappLines.push(``)
  }

  if (financialAlerts.length > 0) {
    whatsappLines.push(`🔔 *דגשים והתראות לקוחות:*`)
    financialAlerts.slice(0, 5).forEach((a) => {
      whatsappLines.push(`• ${a.clientName}: ${a.title}`)
    })
    whatsappLines.push(``)
  }

  whatsappLines.push(`🔗 לכניסה למערכת: https://ndfm.ibsites.co.il/workspace/brief`)
  const whatsappFormattedText = whatsappLines.join('\n')

  return {
    generatedAt: now.toISOString(),
    formattedDate,
    headline,
    stats: {
      totalClients: clients.length,
      onboardedClients: onboardedCount,
      pendingOnboarding: pendingOnboardingCount,
      dueTodayTasksCount: dueTodayTasks.length,
      overdueTasksCount: overdueTasks.length,
      upcomingEventsCount: calendarEvents.length,
      actionRequiredCount: overdueTasks.length + financialAlerts.length,
    },
    tasks: {
      overdue: overdueTasks.map((t) => ({ id: t.id, title: t.title, clientName: t.clientName, dueAt: t.dueAt, priority: t.priority })),
      dueToday: dueTodayTasks.map((t) => ({ id: t.id, title: t.title, clientName: t.clientName, dueAt: t.dueAt, priority: t.priority })),
      upcoming: upcomingTasks.map((t) => ({ id: t.id, title: t.title, clientName: t.clientName, dueAt: t.dueAt, priority: t.priority })),
    },
    calendar: calendarEvents,
    clientsSummary,
    financialAlerts,
    aiSummaryMarkdown,
    whatsappFormattedText,
  }
}
