/**
 * src/ai/tools/global-agent-tools.ts
 *
 * Tools for the Nehemiah OS v2 Global Executive Agent.
 * Gives the agent cross-system omniscience across all workspace clients,
 * internal finances, tasks, calendar events, emails, and spreadsheet data.
 */

import { z } from 'zod'
import { tool } from 'ai'
import {
  listWorkspaceClients,
  getWorkspaceClient,
  getWorkspaceAdminDb,
  type WorkspaceClientRecord,
} from '@/lib/v2/workspace-dal'
import { getSheetRows, getSpreadsheetMeta } from '@/lib/google-sheets'
import { listClientEmails } from '@/lib/google-gmail'
import { listWorkspaceTasks } from '@/lib/v2/workspace-tasks'
import { getInternalFinanceAgentContext } from '@/lib/v2/internal-finance'
import { listWorkspaceCalendarEvents } from '@/lib/v2/google-calendar'

export function createGlobalAgentTools() {
  return {
    /**
     * Lists all registered workspace clients with basic connectivity status (drive, sheet, gmail)
     */
    list_all_clients: tool({
      description: 'רשימת כל הלקוחות בסביבת העבודה (Workspace) כולל סטטוס, מייל, טלפון, וחיבורי Drive/Sheets/Gmail.',
      parameters: z.object({
        statusFilter: z.enum(['all', 'active', 'prospect', 'inactive', 'archived']).optional().default('all'),
      }),
      execute: async ({ statusFilter }) => {
        try {
          const clients = await listWorkspaceClients()
          const filtered = statusFilter === 'all' 
            ? clients 
            : clients.filter((c) => (c.status || 'active') === statusFilter)

          return {
            total: filtered.length,
            clients: filtered.map((c) => ({
              id: c.id,
              name: c.name,
              email: c.email,
              phone: c.phone,
              status: c.status || 'active',
              hasDrive: !!c.drive_folder_id,
              hasSheet: !!c.google_sheet_id,
              hasGmail: !!c.gmail_label || !!c.email,
              gmailLabel: c.gmail_label,
              portfolioValue: c.portfolio_value,
              advisoryGoal: c.advisory_goal,
            })),
          }
        } catch (err: any) {
          return { error: `שגיאה בשליפת רשימת לקוחות: ${err.message}` }
        }
      },
    }),

    /**
     * Search and view data from any client's connected Google Sheet
     */
    lookup_client_sheet: tool({
      description: 'קריאת נתונים מגיליון Google Sheets של לקוח ספציפי לפי שם או מזהה לקוח.',
      parameters: z.object({
        clientIdOrName: z.string().describe('מזהה הלקוח (UUID) או שם הלקוח (חיפוש חלקי)'),
        tabName: z.string().optional().describe('שם הלשונית בגיליון. אם לא סופק יוחזרו רשימת הלשוניות והשורות הראשונות'),
        maxRows: z.number().optional().default(30).describe('מספר שורות מקסימלי להחזרה'),
      }),
      execute: async ({ clientIdOrName, tabName, maxRows }) => {
        try {
          const clients = await listWorkspaceClients()
          const target = clients.find(
            (c) => c.id === clientIdOrName || c.name.toLowerCase().includes(clientIdOrName.toLowerCase().trim())
          )

          if (!target) {
            return { error: `לא נמצא לקוח בשם או במזהה "${clientIdOrName}"` }
          }

          if (!target.google_sheet_id) {
            return { error: `ללקוח "${target.name}" לא מוגדר גיליון Google Sheets מחובר.` }
          }

          const tabs = await getSpreadsheetMeta(target.google_sheet_id)
          const selectedTab = tabName || tabs[0]?.title || 'Sheet1'
          const rows = await getSheetRows(target.google_sheet_id, selectedTab)

          return {
            clientName: target.name,
            clientId: target.id,
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
            const target = clients.find(
              (c) => c.id === clientIdOrName || c.name.toLowerCase().includes(clientIdOrName.toLowerCase().trim())
            )
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
     * Aggregated task board across all clients or specific client
     */
    get_workspace_tasks: tool({
      description: 'שליפת משימות פתוחות מכלל הלקוחות או מלקוח ספציפי.',
      parameters: z.object({
        clientIdOrName: z.string().optional().describe('סינון לפי לקוח ספציפי (אופציונלי)'),
        statusFilter: z.enum(['all', 'pending', 'in_progress', 'completed', 'blocked']).optional().default('all'),
      }),
      execute: async ({ clientIdOrName, statusFilter }) => {
        try {
          let targetClientId: string | undefined
          if (clientIdOrName) {
            const clients = await listWorkspaceClients()
            const target = clients.find(
              (c) => c.id === clientIdOrName || c.name.toLowerCase().includes(clientIdOrName.toLowerCase().trim())
            )
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
              clientId: t.client_id,
              title: t.title,
              status: t.status,
              priority: t.priority,
              dueDate: t.due_date,
              assignedTo: t.assigned_to,
            })),
          }
        } catch (err: any) {
          return { error: `שגיאה בשליפת משימות: ${err.message}` }
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
