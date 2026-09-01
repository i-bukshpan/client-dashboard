/**
 * src/ai/tools/global-agent-tools.ts
 *
 * Tools for the Nehemiah OS v2 Global Executive Agent (J.A.R.V.I.S).
 * Gives the agent cross-system omniscience across all workspace clients,
 * internal finances, tasks, calendar events, emails, and spreadsheet data.
 */

import { z } from 'zod'
import { tool } from 'ai'
import {
  listWorkspaceClients,
  findWorkspaceClientByNameOrId,
} from '@/lib/v2/workspace-dal'
import { getSheetRows, getSpreadsheetMeta } from '@/lib/google-sheets'
import { listClientEmails } from '@/lib/google-gmail'
import { listWorkspaceTasks } from '@/lib/v2/workspace-tasks'
import { getInternalFinanceAgentContext } from '@/lib/v2/internal-finance'
import { listWorkspaceCalendarEvents } from '@/lib/v2/google-calendar'

export function createGlobalAgentTools() {
  return {
    /**
     * Lists all registered workspace clients with basic connectivity status
     */
    list_all_clients: tool({
      description: 'רשימת כל הלקוחות בסביבת העבודה (Workspace) כולל סטטוס, מייל, טלפון, וחיבורי Drive/Sheets/Gmail.',
      parameters: z.object({
        statusFilter: z.enum(['all', 'active', 'prospect', 'inactive', 'archived']).optional().default('all'),
      }),
      execute: async ({ statusFilter }) => {
        try {
          const clients = await listWorkspaceClients()
          const filtered = (!statusFilter || statusFilter === 'all')
            ? clients 
            : clients.filter((c) => {
                const s = (c.status || 'active').toLowerCase()
                if (statusFilter === 'active') return s === 'active' || s === 'פעיל' || !c.status
                if (statusFilter === 'prospect') return s === 'prospect' || s === 'ליד' || s === 'מתעניין'
                if (statusFilter === 'inactive') return s === 'inactive' || s === 'לא פעיל'
                if (statusFilter === 'archived') return s === 'archived' || s === 'בארכיון'
                return s === statusFilter.toLowerCase()
              })

          return {
            total: filtered.length,
            clients: filtered.map((c) => ({
              id: c.id,
              name: c.name,
              email: c.email,
              phone: c.phone,
              status: c.status || 'פעיל',
              hasDrive: !!c.drive_folder_id,
              hasSheet: !!c.google_sheet_id,
              hasGmail: !!c.gmail_label || !!c.email,
              gmailLabel: c.gmail_label,
              portfolioValue: c.portfolio_value,
              advisoryGoal: c.advisory_goal,
            })),
          }
        } catch (err: any) {
          console.error('[global-agent] list_all_clients error:', err)
          return { error: `שגיאה בשליפת רשימת לקוחות: ${err.message}` }
        }
      },
    }),

    /**
     * 360-degree client summary (Profile, Drive, Sheets, Open Tasks, Unread Emails, Living Context)
     */
    get_client_overview: tool({
      description: 'קבלת תמונת מצב מקיפה (360°) על לקוח לפי שם או מזהה — כולל פרטי לקוח, סטטוס אפיון, תיקיית Drive, גיליון Sheets, משימות פתוחות, מיילים ומטרות.',
      parameters: z.object({
        clientIdOrName: z.string().describe('שם הלקוח (למשל "ניסוי", "נסמארט") או מזהה לקוח'),
      }),
      execute: async ({ clientIdOrName }) => {
        try {
          const clients = await listWorkspaceClients()
          const client = findWorkspaceClientByNameOrId(clients, clientIdOrName)
          if (!client) {
            return {
              error: `לא נמצא לקוח בשם או במזהה "${clientIdOrName}". הלקוחות הקיימים: ${clients.map((c) => c.name).join(', ')}`,
            }
          }

          // Fetch tasks
          let openTasks: any[] = []
          try {
            const allTasks = await listWorkspaceTasks(client.id)
            openTasks = allTasks.map((t) => ({
              id: t.id,
              title: t.title,
              status: t.status,
              priority: t.priority,
              dueAt: t.dueAt,
              recurrence: t.recurrence,
              recurrenceDay: t.recurrenceDay,
            }))
          } catch { /* ignore */ }

          // Fetch unread emails
          let emailSummary = { unreadCount: 0, threads: [] as any[] }
          if (client.gmail_label || client.email) {
            try {
              const emailRes = await listClientEmails({
                clientEmail: client.email || undefined,
                labelName: client.gmail_label || undefined,
                unreadOnly: true,
                maxResults: 5,
              })
              emailSummary = {
                unreadCount: emailRes.unreadCount,
                threads: emailRes.threads.map((t) => ({
                  id: t.id,
                  subject: t.subject,
                  from: t.from,
                  date: t.date,
                })),
              }
            } catch { /* ignore */ }
          }

          // Check connected Sheet
          let sheetInfo = {
            hasSheet: !!client.google_sheet_id,
            sheetId: client.google_sheet_id,
            tabs: [] as string[],
          }
          if (client.google_sheet_id) {
            try {
              const meta = await getSpreadsheetMeta(client.google_sheet_id)
              sheetInfo.tabs = meta.map((m) => m.title)
            } catch { /* ignore */ }
          }

          return {
            client: {
              id: client.id,
              name: client.name,
              status: client.status || 'active',
              email: client.email,
              phone: client.phone,
              address: client.address,
              portfolioValue: client.portfolio_value,
              advisoryGoal: client.advisory_goal,
              riskLevel: client.risk_level,
              hasDrive: !!client.drive_folder_id,
              driveFolderId: client.drive_folder_id,
              hasSheet: !!client.google_sheet_id,
              hasGmail: !!client.gmail_label || !!client.email,
              isOnboarded: !!client.client_context_json && Object.keys(client.client_context_json).length > 0,
            },
            sheet: sheetInfo,
            openTasks,
            unreadEmails: emailSummary,
          }
        } catch (err: any) {
          return { error: `שגיאה בשליפת סיכום לקוח: ${err.message}` }
        }
      },
    }),

    /**
     * Search and view data from any client's connected Google Sheet
     */
    lookup_client_sheet: tool({
      description: 'קריאת נתונים מגיליון Google Sheets של לקוח ספציפי לפי שם או מזהה לקוח.',
      parameters: z.object({
        clientIdOrName: z.string().describe('מזהה הלקוח או שם הלקוח'),
        tabName: z.string().optional().describe('שם הלשונית בגיליון. אם לא סופק יוחזרו רשימת הלשוניות והשורות הראשונות'),
        maxRows: z.number().optional().default(30).describe('מספר שורות מקסימלי להחזרה'),
      }),
      execute: async ({ clientIdOrName, tabName, maxRows }) => {
        try {
          const clients = await listWorkspaceClients()
          const target = findWorkspaceClientByNameOrId(clients, clientIdOrName)

          if (!target) {
            return { error: `לא נמצא לקוח בשם או במזהה "${clientIdOrName}"` }
          }

          if (!target.google_sheet_id) {
            return {
              clientName: target.name,
              clientId: target.id,
              hasSheet: false,
              message: `ללקוח "${target.name}" עדיין לא הוגדר גיליון Google Sheets מחובר.`,
            }
          }

          const tabs = await getSpreadsheetMeta(target.google_sheet_id)
          const selectedTab = tabName || tabs[0]?.title || 'Sheet1'
          const rows = await getSheetRows(target.google_sheet_id, selectedTab)

          return {
            clientName: target.name,
            clientId: target.id,
            hasSheet: true,
            availableTabs: tabs.map((t) => t.title),
            activeTab: selectedTab,
            rowCount: rows.length,
            rows: rows.slice(0, maxRows),
          }
        } catch (err: any) {
          return { error: `שגיאה בקריאת גיליון הלקוח: ${err.message}` }
        }
      },
    }),

    /**
     * Scan unread emails across the entire inbox or per client
     */
    check_unread_emails: tool({
      description: 'סריקת אימיילים שלא נקראו ב-Gmail — ברמה כללית (כל התיבה) או עבור לקוח ספציפי.',
      parameters: z.object({
        clientIdOrName: z.string().optional().describe('אם סופק, יסנן לפי אימייל או תווית הלקוח'),
        maxResults: z.number().optional().default(10),
      }),
      execute: async ({ clientIdOrName, maxResults }) => {
        try {
          let clientEmail: string | undefined
          let labelName: string | undefined

          if (clientIdOrName) {
            const clients = await listWorkspaceClients()
            const target = findWorkspaceClientByNameOrId(clients, clientIdOrName)
            if (target) {
              clientEmail = target.email || undefined
              labelName = target.gmail_label || undefined
            }
          }

          const res = await listClientEmails({
            unreadOnly: true,
            clientEmail,
            labelName,
            maxResults,
          })

          return {
            unreadCount: res.unreadCount,
            totalEstimate: res.totalEstimate,
            threads: res.threads.map((t) => ({
              id: t.id,
              subject: t.subject,
              from: t.from,
              date: t.date,
              snippet: t.snippet,
              unread: t.unread,
            })),
          }
        } catch (err: any) {
          return { error: `שגיאה בשליפת אימיילים: ${err.message}` }
        }
      },
    }),

    /**
     * Search emails across Gmail with arbitrary query or client search
     */
    search_emails: tool({
      description: 'חיפוש אימיילים ב-Gmail לפי מילות מפתח, שאילתה חופשית (query), שם לקוח או כתובת דוא"ל.',
      parameters: z.object({
        query: z.string().describe('מחרוזת חיפוש ב-Gmail, למשל: "נסמארט" או "חשבונית" או "from:..."'),
        maxResults: z.number().optional().default(15),
      }),
      execute: async ({ query, maxResults }) => {
        try {
          const res = await listClientEmails({
            query,
            maxResults,
          })

          return {
            totalFound: res.threads.length,
            totalEstimate: res.totalEstimate,
            threads: res.threads.map((t) => ({
              id: t.id,
              subject: t.subject,
              from: t.from,
              date: t.date,
              snippet: t.snippet,
              unread: t.unread,
            })),
          }
        } catch (err: any) {
          return { error: `שגיאה בחיפוש אימיילים: ${err.message}` }
        }
      },
    }),

    /**
     * Aggregated task board across all clients or specific client
     */
    get_workspace_tasks: tool({
      description: 'שליפת משימות מכלל הלקוחות או מלקוח ספציפי, כולל משימות מחזוריות (יומיות, שבועיות, חודשיות).',
      parameters: z.object({
        clientIdOrName: z.string().optional().describe('סינון לפי לקוח ספציפי (אופציונלי)'),
        statusFilter: z.enum(['all', 'todo', 'in_progress', 'completed', 'cancelled']).optional().default('all'),
      }),
      execute: async ({ clientIdOrName, statusFilter }) => {
        try {
          let targetClientId: string | undefined
          if (clientIdOrName) {
            const clients = await listWorkspaceClients()
            const target = findWorkspaceClientByNameOrId(clients, clientIdOrName)
            if (target) targetClientId = target.id
          }

          const tasks = await listWorkspaceTasks(targetClientId)
          const filtered = statusFilter === 'all'
            ? tasks
            : tasks.filter((t) => t.status === statusFilter)

          return {
            total: filtered.length,
            tasks: filtered.map((t) => ({
              id: t.id,
              clientId: t.clientId,
              clientName: t.clientName,
              title: t.title,
              status: t.status,
              priority: t.priority,
              dueAt: t.dueAt,
              recurrence: t.recurrence,
              recurrenceDay: t.recurrenceDay,
              reminderState: t.reminderState,
            })),
          }
        } catch (err: any) {
          return { error: `שגיאה בשליפת משימות: ${err.message}` }
        }
      },
    }),

    /**
     * Creates or updates a workspace task (one-off or recurring, client-specific or general)
     */
    create_or_update_workspace_task: tool({
      description: 'יצירה או עדכון משימה בסביבת התפעול (כללית עבור נחמיה או מקושרת ללקוח ספציפי). תומך במשימות מחזוריות (למשל: כל ראשון, כל 1 בחודש, כל 10 בחודש וכו\').',
      parameters: z.object({
        taskId: z.string().optional().describe('מזהה משימה אם מעדכנים משימה קיימת'),
        clientIdOrName: z.string().optional().describe('שם הלקוח או מזהה הלקוח (אם המשימה שייכת ללקוח, אחרת תישאר כללית לנחמיה)'),
        title: z.string().describe('כותרת המשימה בעברית'),
        description: z.string().optional().describe('תיאור המשימה או הערות'),
        status: z.enum(['todo', 'in_progress', 'completed', 'cancelled']).optional().default('todo'),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
        dueAt: z.string().optional().describe('מועד יעד ראשון (פורמט ISO או YYYY-MM-DD)'),
        recurrence: z.enum(['none', 'daily', 'weekly', 'monthly', 'yearly']).optional().default('none').describe('מחזוריות המשימה: none, daily, weekly, monthly, yearly'),
        recurrenceDay: z.number().optional().describe('יום מחזוריות: 0=ראשון..6=שבת לשבועי, או 1..31 לחודשי (למשל 1 עבור 1 בחודש, 10 עבור 10 בחודש)'),
      }),
      execute: async (input) => {
        try {
          const { createWorkspaceTask, updateWorkspaceTask } = await import('@/lib/v2/workspace-tasks')
          let resolvedClientId: string | null = null

          if (input.clientIdOrName) {
            const clients = await listWorkspaceClients()
            const target = findWorkspaceClientByNameOrId(clients, input.clientIdOrName)
            if (target) resolvedClientId = target.id
          }

          if (input.taskId) {
            const updated = await updateWorkspaceTask(input.taskId, {
              title: input.title,
              description: input.description,
              status: input.status,
              priority: input.priority,
              dueAt: input.dueAt,
              recurrence: input.recurrence,
              recurrenceDay: input.recurrenceDay,
              clientId: resolvedClientId ?? undefined,
            })
            return { success: true, message: `✅ משימה "${updated.title}" עודכנה בהצלחה!`, task: updated }
          }

          const created = await createWorkspaceTask({
            clientId: resolvedClientId,
            title: input.title,
            description: input.description,
            status: input.status,
            priority: input.priority,
            dueAt: input.dueAt,
            recurrence: input.recurrence,
            recurrenceDay: input.recurrenceDay,
          })

          const recText = created.recurrence && created.recurrence !== 'none'
            ? ` [מחזוריות: ${created.recurrence}${created.recurrenceDay !== undefined && created.recurrenceDay !== null ? ` יום ${created.recurrenceDay}` : ''}]`
            : ''

          return { success: true, message: `✅ משימה "${created.title}" נוצרה בהצלחה!${recText}`, task: created }
        } catch (err: any) {
          return { error: `שגיאה ביצירת/עדכון משימה: ${err.message}` }
        }
      },
    }),

    /**
     * Cross-system agency finance overview
     */
    get_agency_finance_summary: tool({
      description: 'תמונת מצב פיננסית פנימית של סוכנות נחמיה (הכנסות, הוצאות, ריטיינרים, חשבוניות).',
      parameters: z.object({}),
      execute: async () => {
        try {
          const context = await getInternalFinanceAgentContext()
          return context
        } catch (err: any) {
          return { error: `שגיאה בשליפת נתוני כספי הסוכנות: ${err.message}` }
        }
      },
    }),

    /**
     * Upcoming calendar events across agency
     */
    get_calendar_overview: tool({
      description: 'אירועים ופגישות קרובות ביומן Google Calendar.',
      parameters: z.object({
        daysAhead: z.number().optional().default(7).describe('מספר הימים קדימה לסריקה'),
      }),
      execute: async ({ daysAhead }) => {
        try {
          const timeMin = new Date().toISOString()
          const timeMax = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString()
          const res = await listWorkspaceCalendarEvents({ timeMin, timeMax })

          return {
            total: res.events.length,
            events: res.events.map((e) => ({
              id: e.id,
              title: e.title,
              description: e.description,
              start: e.start,
              end: e.end,
              location: e.location,
              status: e.status,
            })),
          }
        } catch (err: any) {
          return { error: `שגיאה בשליפת יומן: ${err.message}` }
        }
      },
    }),
  }
}
