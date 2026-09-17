/**
 * src/ai/tools/global-agent-tools.ts
 *
 * Full Executive Assistant / Secretary Suite (J.A.R.V.I.S) for Nehemiah OS v2.
 * Gives the Global Agent end-to-end execution capabilities:
 * - Email management (send, search, reply, trash, label)
 * - Task management (CRUD for one-off and recurring tasks)
 * - Client management (create, update, 360 overview)
 * - Google Drive & Sheets (create folders, create spreadsheets, read, append & update data)
 * - Calendar & Agency Finances (events & financial reporting)
 */

import { z } from 'zod'
import { tool } from 'ai'
import {
  listWorkspaceClients,
  findWorkspaceClientByNameOrId,
  getWorkspaceAdminDb,
  getWorkspaceClient,
} from '@/lib/v2/workspace-dal'
import {
  getSheetRows,
  getSpreadsheetMeta,
  appendRows,
  updateRange,
  createSpreadsheet,
  formatRange,
} from '@/lib/google-sheets'
import {
  listClientEmails,
  sendNewClientEmail,
  replyToEmailThread,
  trashEmailThread,
  modifyThreadLabels,
  listGmailLabels,
} from '@/lib/google-gmail'
import {
  listWorkspaceTasks,
  createWorkspaceTask,
  updateWorkspaceTask,
  deleteWorkspaceTask,
} from '@/lib/v2/workspace-tasks'
import { getInternalFinanceAgentContext } from '@/lib/v2/internal-finance'
import {
  listWorkspaceCalendarEvents,
  createWorkspaceCalendarEvent,
} from '@/lib/v2/google-calendar'
import { createClientFolder } from '@/lib/google-drive'
import { confirmationIdSchema, requireAgentConfirmation } from '@/lib/v2/agent-confirmation'
import { classifyGoogleSourceError } from '@/lib/v2/google-source-health'
import { getClientNotebookSources, getGlobalNotebookSources } from '@/lib/v2/notebook-sources'
import { dashboardConfigSchema } from '@/lib/v2/dashboard-schema'
import {
  createAgentScheduledTask,
  listAgentScheduledTasks,
  updateAgentScheduledTask,
  deleteAgentScheduledTask,
  executeAgentScheduledTask,
} from '@/lib/v2/agent-scheduler'

export function createGlobalAgentTools(options?: { autonomous?: boolean }) {
  const checkGate = async (
    actionType: string,
    payload: unknown,
    confirmationId: string | undefined,
    confirmationMessage: string
  ) => {
    if (options?.autonomous) {
      return { approved: true as const }
    }
    return requireAgentConfirmation(actionType, payload, confirmationId, confirmationMessage)
  }

  return {
    // ═════════════════════════════════════════════════════════════════════════
    // 1. CLIENT CRM TOOLS
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * Lists all registered workspace clients
     */
    list_all_clients: tool({
      description: 'רשימת כל הלקוחות בסביבת העבודה (Workspace) כולל סטטוס, מייל, טלפון, וחיבורי Drive/Sheets/Gmail.',
      inputSchema: z.object({
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
                return false
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
            _citation: {
              type: 'drive',
              label: `רשימת לקוחות (${filtered.length})`,
              timestamp: new Date().toISOString(),
            },
          }
        } catch (err: any) {
          console.error('[global-agent] list_all_clients error:', err)
          return { error: `שגיאה בשליפת רשימת לקוחות: ${err.message}` }
        }
      },
    }),

    /**
     * 360-degree client summary
     */
    get_client_overview: tool({
      description: 'קבלת תמונת מצב מקיפה (360°) על לקוח לפי שם או מזהה — כולל פרטי לקוח, סטטוס אפיון, תיקיית Drive, גיליון Sheets, משימות פתוחות, מיילים ומטרות.',
      inputSchema: z.object({
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

          const tasksPromise = listWorkspaceTasks(client.id)
          const emailPromise = client.gmail_label || client.email
            ? listClientEmails({
                clientEmail: client.email || undefined,
                labelName: client.gmail_label || undefined,
                unreadOnly: true,
                maxResults: 5,
              })
            : Promise.resolve({ unreadCount: 0, threads: [], totalEstimate: 0 })
          const sheetPromise = client.google_sheet_id
            ? getSpreadsheetMeta(client.google_sheet_id)
            : Promise.resolve([])
          const [tasksResult, emailResult, sheetResult] = await Promise.allSettled([
            tasksPromise,
            emailPromise,
            sheetPromise,
          ])

          const openTasks = tasksResult.status === 'fulfilled'
            ? tasksResult.value.map((t) => ({
              id: t.id,
              title: t.title,
              status: t.status,
              priority: t.priority,
              dueAt: t.dueAt,
              recurrence: t.recurrence,
              recurrenceDay: t.recurrenceDay,
            }))
            : []
          const emailSummary = emailResult.status === 'fulfilled'
            ? {
                unreadCount: emailResult.value.unreadCount,
                threads: emailResult.value.threads.map((t) => ({
                  id: t.id,
                  subject: t.subject,
                  from: t.from,
                  date: t.date,
                })),
              }
            : { unreadCount: 0, threads: [] }
          const sheetInfo = {
            hasSheet: !!client.google_sheet_id,
            sheetId: client.google_sheet_id,
            tabs: sheetResult.status === 'fulfilled' ? sheetResult.value.map((m) => m.title) : [],
          }

          return {
            client: {
              id: client.id,
              name: client.name,
              status: client.status || 'פעיל',
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
            sourceHealth: {
              tasks: tasksResult.status === 'fulfilled' ? { status: 'ok' } : { status: 'unavailable', message: 'מקור המשימות אינו זמין' },
              gmail: emailResult.status === 'fulfilled' ? { status: 'ok' } : classifyGoogleSourceError(emailResult.reason),
              sheets: sheetResult.status === 'fulfilled' ? { status: 'ok' } : classifyGoogleSourceError(sheetResult.reason),
            },
            complete: tasksResult.status === 'fulfilled' && emailResult.status === 'fulfilled' && sheetResult.status === 'fulfilled',
            _citation: {
              type: 'drive',
              label: `תיק לקוח 360° — ${client.name}`,
              timestamp: new Date().toISOString(),
            },
          }
        } catch (err: any) {
          return { error: `שגיאה בשליפת סיכום לקוח: ${err.message}` }
        }
      },
    }),

    /**
     * Creates a new client in the CRM
     */
    create_new_client: tool({
      description: 'הוספת לקוח חדש למערכת ה-CRM (שם, אימייל, טלפון, סטטוס, יעד ייעוץ).',
      inputSchema: z.object({
        name: z.string().describe('שם הלקוח / החברה בעברית'),
        email: z.string().optional().describe('כתובת אימייל'),
        phone: z.string().optional().describe('מספר טלפון'),
        status: z.string().optional().default('פעיל').describe('סטטוס לקוח (פעיל, ליד, מתעניין)'),
        advisoryGoal: z.string().optional().describe('יעד ייעוץ או תחום פעילות'),
        confirmationId: confirmationIdSchema,
      }),
      execute: async ({ name, email, phone, status, advisoryGoal, confirmationId }) => {
        try {
          const cleanName = name.trim()
          const cleanEmail = email?.trim() || null
          const cleanPhone = phone?.trim() || null
          const cleanStatus = status || 'פעיל'

          const gate = await checkGate(
            'create_new_client',
            { name: cleanName, email: cleanEmail, phone: cleanPhone, status: cleanStatus, advisoryGoal },
            confirmationId,
            `לאשר הוספת לקוח חדש "${cleanName}" למערכת ה-CRM?`
          )
          if (!gate.approved) return gate

          const db = getWorkspaceAdminDb()
          const { data, error } = await db
            .from('clients')
            .insert({
              name: cleanName,
              email: cleanEmail,
              phone: cleanPhone,
              status: cleanStatus,
              advisory_goal: advisoryGoal || null,
              client_context_json: {},
              dashboard_config_json: {},
            })
            .select()
            .single()

          if (error) throw new Error(error.message)
          return { success: true, message: `✅ הלקוח "${cleanName}" נוסף בהצלחה למערכת!`, client: data }
        } catch (err: any) {
          return { error: `שגיאה ביצירת לקוח: ${err.message}` }
        }
      },
    }),

    /**
     * Updates an existing client details in CRM
     */
    update_client_details: tool({
      description: 'עדכון פרטי לקוח קיים (שם, אימייל, טלפון, סטטוס, יעד ייעוץ, תווית Gmail וכו\').',
      inputSchema: z.object({
        clientIdOrName: z.string().describe('שם הלקוח או מזהה הלקוח'),
        name: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        status: z.string().optional(),
        advisoryGoal: z.string().optional(),
        gmailLabel: z.string().optional(),
        confirmationId: confirmationIdSchema,
      }),
      execute: async ({ clientIdOrName, name, email, phone, status, advisoryGoal, gmailLabel, confirmationId }) => {
        try {
          const clients = await listWorkspaceClients()
          const client = findWorkspaceClientByNameOrId(clients, clientIdOrName)
          if (!client) return { error: `לא נמצא לקוח בשם "${clientIdOrName}"` }

          const updates: Record<string, any> = {}
          if (name !== undefined) updates.name = name.trim()
          if (email !== undefined) updates.email = email.trim() || null
          if (phone !== undefined) updates.phone = phone.trim() || null
          if (status !== undefined) updates.status = status
          if (advisoryGoal !== undefined) updates.advisory_goal = advisoryGoal
          if (gmailLabel !== undefined) updates.gmail_label = gmailLabel

          const gate = await checkGate(
            'update_client_details',
            { clientId: client.id, updates },
            confirmationId,
            `לאשר עדכון פרטי הלקוח "${client.name}"?`
          )
          if (!gate.approved) return gate

          const db = getWorkspaceAdminDb()
          const { data, error } = await db.from('clients').update(updates).eq('id', client.id).select().single()
          if (error) throw new Error(error.message)

          return { success: true, message: `✅ פרטי הלקוח "${client.name}" עודכנו בהצלחה!`, client: data }
        } catch (err: any) {
          return { error: `שגיאה בעדכון פרטי לקוח: ${err.message}` }
        }
      },
    }),

    // ═════════════════════════════════════════════════════════════════════════
    // 2. TASK SECRETARY TOOLS (ONE-OFF & RECURRING)
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * Fetches tasks across the workspace with full recurring & regular breakdown
     */
    get_workspace_tasks: tool({
      description: 'שליפת כל המשימות הפתוחות במערכת — מחולקות למשימות רגילות שוטפות ולמשימות מחזוריות (יומי, שבועי, חודשי). להצגת כל המשימות של נחמיה או הכלליות, השאר clientIdOrName ריק.',
      inputSchema: z.object({
        clientIdOrName: z.string().optional().describe('סינון לפי לקוח ספציפי (אופציונלי). אם נחמיה שואל על המשימות שלו או בכללי - השאר ריק!'),
        statusFilter: z.enum(['all', 'todo', 'in_progress', 'completed', 'cancelled']).optional().default('all'),
      }),
      execute: async ({ clientIdOrName, statusFilter }) => {
        try {
          let targetClientId: string | undefined
          if (clientIdOrName) {
            const raw = clientIdOrName.trim().toLowerCase()
            const genericTerms = ['נחמיה', 'לי', 'שלי', 'הכל', 'כללי', 'עצמי', 'me', 'my', 'all', 'mine']
            if (!genericTerms.includes(raw)) {
              const clients = await listWorkspaceClients()
              const target = findWorkspaceClientByNameOrId(clients, clientIdOrName)
              if (target) {
                targetClientId = target.id
              }
            }
          }

          const tasks = await listWorkspaceTasks(targetClientId)
          const filtered = (!statusFilter || statusFilter === 'all')
            ? tasks
            : tasks.filter((t) => t.status === statusFilter)

          const regularTasks = filtered.filter((t) => !t.recurrence || t.recurrence === 'none')
          const recurringTasks = filtered.filter((t) => t.recurrence && t.recurrence !== 'none')

          return {
            total: filtered.length,
            regularCount: regularTasks.length,
            recurringCount: recurringTasks.length,
            regularTasks: regularTasks.map((t) => ({
              id: t.id,
              clientName: t.clientName || 'כללי (נחמיה)',
              title: t.title,
              description: t.description,
              status: t.status,
              priority: t.priority,
              dueAt: t.dueAt,
              reminderState: t.reminderState,
            })),
            recurringTasks: recurringTasks.map((t) => ({
              id: t.id,
              clientName: t.clientName || 'כללי (נחמיה)',
              title: t.title,
              description: t.description,
              status: t.status,
              priority: t.priority,
              recurrence: t.recurrence,
              recurrenceDay: t.recurrenceDay,
              dueAt: t.dueAt,
            })),
            summary: `נמצאו ${filtered.length} משימות בסך הכל (${regularTasks.length} שוטפות, ${recurringTasks.length} מחזוריות קבועות).`,
            _citation: {
              type: 'document',
              label: targetClientId ? 'משימות הלקוח' : 'משימות ושגרות הסוכנות',
              timestamp: new Date().toISOString(),
            },
          }
        } catch (err: any) {
          return { error: `שגיאה בשליפת משימות: ${err.message}` }
        }
      },
    }),

    /**
     * Creates or updates a workspace task
     */
    create_or_update_workspace_task: tool({
      description: 'יצירה או עדכון משימה בסביבת התפעול (כללית עבור נחמיה או מקושרת ללקוח ספציפי). תומך במשימות מחזוריות (למשל: כל ראשון, כל 1 בחודש, כל 10 בחודש וכו\').',
      inputSchema: z.object({
        taskId: z.string().optional().describe('מזהה משימה אם מעדכנים משימה קיימת'),
        clientIdOrName: z.string().optional().describe('שם הלקוח או מזהה הלקוח (אם המשימה שייכת ללקוח, אחרת תישאר כללית לנחמיה)'),
        title: z.string().describe('כותרת המשימה בעברית'),
        description: z.string().optional().describe('תיאור המשימה או הערות'),
        status: z.enum(['todo', 'in_progress', 'completed', 'cancelled']).optional().default('todo'),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
        dueAt: z.string().optional().describe('מועד יעד ראשון (פורמט ISO או YYYY-MM-DD)'),
        recurrence: z.enum(['none', 'daily', 'weekly', 'monthly', 'yearly']).optional().default('none').describe('מחזוריות המשימה: none, daily, weekly, monthly, yearly'),
        recurrenceDay: z.number().optional().describe('יום מחזוריות: 0=ראשון..6=שבת לשבועי, או 1..31 לחודשי (למשל 1 עבור 1 בחודש, 10 עבור 10 בחודש)'),
        confirmationId: confirmationIdSchema,
      }),
      execute: async (input) => {
        try {
          let resolvedClientId: string | null = null

          if (input.clientIdOrName) {
            const clients = await listWorkspaceClients()
            const target = findWorkspaceClientByNameOrId(clients, input.clientIdOrName)
            if (target) resolvedClientId = target.id
          }

          const actionDesc = input.taskId
            ? `לאשר עדכון משימה "${input.title}"?`
            : `לאשר יצירת משימה חדשה "${input.title}"?`

          const gate = await checkGate(
            'create_or_update_workspace_task',
            {
              taskId: input.taskId,
              clientIdOrName: input.clientIdOrName,
              title: input.title,
              description: input.description,
              status: input.status,
              priority: input.priority,
              dueAt: input.dueAt,
              recurrence: input.recurrence,
              recurrenceDay: input.recurrenceDay,
            },
            input.confirmationId,
            actionDesc
          )
          if (!gate.approved) return gate

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
     * Deletes a task by ID
     */
    delete_workspace_task: tool({
      description: 'מחיקת משימה מלוח המשימות ומ-Google Sheets לפי מזהה משימה.',
      inputSchema: z.object({
        taskId: z.string().describe('מזהה המשימה למחיקה'),
        confirmationId: confirmationIdSchema,
      }),
      execute: async ({ taskId, confirmationId }) => {
        try {
          const gate = await checkGate(
            'delete_workspace_task', { taskId }, confirmationId,
            `האם למחוק לצמיתות את המשימה ${taskId}?`
          )
          if (!gate.approved) return gate
          const res = await deleteWorkspaceTask(taskId)
          return { success: true, message: `✅ המשימה נמחקה בהצלחה!`, taskId: res.id }
        } catch (err: any) {
          return { error: `שגיאה במחיקת משימה: ${err.message}` }
        }
      },
    }),

    // ═════════════════════════════════════════════════════════════════════════
    // 3. GMAIL SECRETARY TOOLS
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * Scan unread emails
     */
    check_unread_emails: tool({
      description: 'סריקת אימיילים שלא נקראו ב-Gmail — ברמה כללית (כל התיבה) או עבור לקוח ספציפי.',
      inputSchema: z.object({
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
              isUnread: t.isUnread,
            })),
            _citation: {
              type: 'gmail',
              label: `Gmail — ${res.unreadCount} מיילים שלא נקראו`,
              timestamp: new Date().toISOString(),
            },
          }
        } catch (err: any) {
          return { error: `שגיאה בשליפת אימיילים: ${err.message}` }
        }
      },
    }),

    /**
     * Search emails across Gmail
     */
    search_emails: tool({
      description: 'חיפוש אימיילים ב-Gmail לפי מילות מפתח, שאילתה חופשית (query), שם לקוח או כתובת דוא"ל.',
      inputSchema: z.object({
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
              isUnread: t.isUnread,
            })),
            _citation: {
              type: 'gmail',
              label: `Gmail — "${query}"`,
              timestamp: new Date().toISOString(),
            },
          }
        } catch (err: any) {
          return { error: `שגיאה בחיפוש אימיילים: ${err.message}` }
        }
      },
    }),

    /**
     * Sends a new email via Gmail
     */
    send_email: tool({
      description: 'שליחת אימייל חדש מכתובת ה-Gmail של נחמיה אל לקוח או נמען חיצוני.',
      inputSchema: z.object({
        to: z.string().describe('כתובת אימייל הנמען (או שם לקוח, שיאותר אוטומטית)'),
        subject: z.string().describe('נושא ההודעה בעברית'),
        body: z.string().describe('תוכן ההודעה (טקסט עשיר או רגיל בעברית)'),
        cc: z.string().optional().describe('נמעני CC (מופרדים בפסיק)'),
        confirmationId: confirmationIdSchema,
      }),
      execute: async ({ to, subject, body, cc, confirmationId }) => {
        try {
          let recipientEmail = to.trim()
          if (!recipientEmail.includes('@')) {
            const clients = await listWorkspaceClients()
            const client = findWorkspaceClientByNameOrId(clients, to)
            if (client?.email) {
              recipientEmail = client.email
            } else {
              return { error: `לא נמצאה כתובת אימייל עבור "${to}". אנא ציין כתובת אימייל תקינה.` }
            }
          }

          const payload = { to: recipientEmail, subject, body, cc }
          const gate = await checkGate(
            'send_email', payload, confirmationId,
            `לאשר שליחת אימייל אל ${recipientEmail} בנושא "${subject}"?`
          )
          if (!gate.approved) return gate
          const res = await sendNewClientEmail({
            to: recipientEmail,
            subject,
            bodyText: body,
            cc: cc ? cc.split(',').map((c) => c.trim()) : undefined,
          })

          return { success: true, message: `✅ האימייל נשלח בהצלחה אל ${recipientEmail}! (נושא: "${subject}")`, messageId: res.id }
        } catch (err: any) {
          return { error: `שגיאה בשליחת אימייל: ${err.message}` }
        }
      },
    }),

    /**
     * Replies to an existing Gmail thread
     */
    reply_to_email: tool({
      description: 'מענה והשבת אימייל לשרשור קיים ב-Gmail.',
      inputSchema: z.object({
        threadId: z.string().describe('מזהה שרשור האימייל ב-Gmail'),
        to: z.string().describe('כתובת הנמען'),
        subject: z.string().describe('נושא המענה'),
        body: z.string().describe('תוכן המענה בעברית'),
        confirmationId: confirmationIdSchema,
      }),
      execute: async ({ threadId, to, subject, body, confirmationId }) => {
        try {
          const gate = await checkGate(
            'reply_to_email', { threadId, to, subject, body }, confirmationId,
            `לאשר שליחת המענה אל ${to} בנושא "${subject}"?`
          )
          if (!gate.approved) return gate
          const res = await replyToEmailThread({
            threadId,
            to,
            subject,
            bodyText: body,
          })
          return { success: true, message: `✅ התגובה נשלחה בהצלחה בשרשור!`, messageId: res.id }
        } catch (err: any) {
          return { error: `שגיאה במענה לאימייל: ${err.message}` }
        }
      },
    }),

    /**
     * Trashes/Deletes an email thread
     */
    trash_email_thread: tool({
      description: 'העברת שרשור אימייל לאשפה ב-Gmail (מחיקה).',
      inputSchema: z.object({
        threadId: z.string().describe('מזהה השרשור ב-Gmail'),
        confirmationId: confirmationIdSchema,
      }),
      execute: async ({ threadId, confirmationId }) => {
        try {
          const gate = await checkGate(
            'trash_email_thread', { threadId }, confirmationId,
            `לאשר העברת שרשור ${threadId} לאשפה?`
          )
          if (!gate.approved) return gate
          await trashEmailThread(threadId)
          return { success: true, message: `✅ שרשור האימייל הועבר לאשפה בהצלחה!` }
        } catch (err: any) {
          return { error: `שגיאה בהעברה לאשפה: ${err.message}` }
        }
      },
    }),

    /**
     * Adds or removes a Gmail label on an email thread
     */
    label_email_thread: tool({
      description: 'שיוך ומיון שרשור אימייל לתווית לקוח או הסרת תווית ב-Gmail.',
      inputSchema: z.object({
        threadId: z.string().describe('מזהה השרשור ב-Gmail'),
        labelName: z.string().describe('שם התווית ב-Gmail (למשל: "נסמארט", "חשבוניות")'),
        action: z.enum(['add', 'remove']).default('add'),
      }),
      execute: async ({ threadId, labelName, action }) => {
        try {
          const labels = await listGmailLabels()
          const target = labels.find((l) => l.name.toLowerCase() === labelName.toLowerCase())
          if (!target) {
            return { error: `תווית בשם "${labelName}" לא נמצאה ב-Gmail. התוויות הקיימות: ${labels.map((l) => l.name).join(', ')}` }
          }

          if (action === 'add') {
            await modifyThreadLabels(threadId, [target.id], [])
            return { success: true, message: `✅ השרשור סווג בהצלחה תחת התווית "${labelName}"!` }
          } else {
            await modifyThreadLabels(threadId, [], [target.id])
            return { success: true, message: `✅ התווית "${labelName}" הוסרה מהשרשור!` }
          }
        } catch (err: any) {
          return { error: `שגיאה במיון תווית אימייל: ${err.message}` }
        }
      },
    }),

    // ═════════════════════════════════════════════════════════════════════════
    // 4. GOOGLE DRIVE & SHEETS SECRETARY TOOLS
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * Creates a Google Drive folder for a client
     */
    create_client_drive_folder: tool({
      description: 'יצירת תיקיית Google Drive ייעודית עבור לקוח וקישורה ל-CRM.',
      inputSchema: z.object({
        clientIdOrName: z.string().describe('שם הלקוח או מזהה הלקוח'),
        folderName: z.string().optional().describe('שם התיקייה (ברירת מחדל: שם הלקוח)'),
        confirmationId: confirmationIdSchema,
      }),
      execute: async ({ clientIdOrName, folderName, confirmationId }) => {
        try {
          const clients = await listWorkspaceClients()
          const client = findWorkspaceClientByNameOrId(clients, clientIdOrName)
          if (!client) {
            const clientNames = clients.slice(0, 10).map((c) => c.name).join(', ')
            return {
              error: `לא נמצא לקוח בשם או במזהה "${clientIdOrName}". לקוחות קיימים לדוגמה: ${clientNames}`,
            }
          }

          const nameToUse = folderName || client.name
          const gate = await checkGate(
            'create_client_drive_folder',
            { clientId: client.id, folderName: nameToUse },
            confirmationId,
            `לאשר יצירת תיקיית Google Drive בשם "${nameToUse}" עבור לקוח ${client.name}?`
          )
          if (!gate.approved) return gate

          const folderId = await createClientFolder(nameToUse)

          const db = getWorkspaceAdminDb()
          await db.from('clients').update({ drive_folder_id: folderId }).eq('id', client.id)

          return {
            success: true,
            message: `✅ תיקיית Google Drive חדשה ("${nameToUse}") נוצרה וקושרה ללקוח ${client.name}!`,
            folderId,
          }
        } catch (err: any) {
          return { error: `שגיאה ביצירת תיקיית Drive: ${err.message}` }
        }
      },
    }),

    /**
     * Creates a new Google Spreadsheet for a client with custom tabs & headers
     */
    create_client_spreadsheet: tool({
      description: 'יצירת גיליון Google Sheets חדש עבור לקוח (עם לשוניות ועמודות מוגדרות) ושמירתו ב-CRM ובתיקיית ה-Drive של הלקוח.',
      inputSchema: z.object({
        clientIdOrName: z.string().describe('שם הלקוח או מזהה הלקוח'),
        title: z.string().describe('כותרת הגיליון בעברית'),
        sheets: z.array(
          z.object({
            title: z.string().describe('שם הלשונית, למשל: "תזרים", "הכנסות", "הוצאות"'),
            headers: z.array(z.string()).describe('כותרות העמודות בשורה הראשונה'),
          })
        ).describe('מבנה הלשוניות והעמודות'),
        confirmationId: confirmationIdSchema,
      }),
      execute: async ({ clientIdOrName, title, sheets, confirmationId }) => {
        try {
          const clients = await listWorkspaceClients()
          const client = findWorkspaceClientByNameOrId(clients, clientIdOrName)
          if (!client) {
            const clientNames = clients.slice(0, 10).map((c) => c.name).join(', ')
            return {
              error: `לא נמצא לקוח בשם או במזהה "${clientIdOrName}". לקוחות קיימים לדוגמה: ${clientNames}`,
            }
          }

          const gate = await checkGate(
            'create_client_spreadsheet',
            { clientId: client.id, title, sheetsCount: sheets.length },
            confirmationId,
            `לאשר יצירת גיליון Google Sheets חדש בשם "${title}" (${sheets.length} לשוניות) עבור ${client.name}?`
          )
          if (!gate.approved) return gate

          const spreadsheetId = await createSpreadsheet(title, sheets, client.drive_folder_id || undefined)

          const db = getWorkspaceAdminDb()
          await db.from('clients').update({ google_sheet_id: spreadsheetId }).eq('id', client.id)

          return {
            success: true,
            message: `✅ גיליון חדש "${title}" נוצר בהצלחה וקושר ללקוח ${client.name}!`,
            spreadsheetId,
          }
        } catch (err: any) {
          return { error: `שגיאה ביצירת גיליון: ${err.message}` }
        }
      },
    }),

    /**
     * Lookup and read data from a client spreadsheet
     */
    lookup_client_sheet: tool({
      description: 'קריאת נתונים מגיליון Google Sheets של לקוח ספציפי לפי שם או מזהה לקוח.',
      inputSchema: z.object({
        clientIdOrName: z.string().describe('מזהה הלקוח או שם הלקוח'),
        tabName: z.string().optional().describe('שם הלשונית בגיליון. אם לא סופק יוחזרו רשימת הלשוניות והשורות הראשונות'),
        maxRows: z.number().optional().default(30).describe('מספר שורות מקסימלי להחזרה'),
      }),
      execute: async ({ clientIdOrName, tabName, maxRows }) => {
        try {
          const clients = await listWorkspaceClients()
          const target = findWorkspaceClientByNameOrId(clients, clientIdOrName)

          if (!target) {
            const clientNames = clients.slice(0, 10).map((c) => c.name).join(', ')
            return { error: `לא נמצא לקוח בשם או במזהה "${clientIdOrName}". לקוחות קיימים: ${clientNames}` }
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
          const availableTabTitles = tabs.map((t) => t.title)

          if (tabName && !availableTabTitles.includes(tabName)) {
            return {
              clientName: target.name,
              clientId: target.id,
              hasSheet: true,
              availableTabs: availableTabTitles,
              error: `הלשונית "${tabName}" לא נמצאה בגיליון של ${target.name}. הלשוניות הזמינות הן: ${availableTabTitles.join(', ')}`,
            }
          }

          const selectedTab = tabName || availableTabTitles[0] || 'Sheet1'
          const rows = await getSheetRows(target.google_sheet_id, selectedTab)

          return {
            clientName: target.name,
            clientId: target.id,
            hasSheet: true,
            availableTabs: availableTabTitles,
            activeTab: selectedTab,
            rowCount: rows.length,
            rows: rows.slice(0, maxRows),
            _citation: {
              type: 'sheet',
              label: `גיליון ${target.name} — ${selectedTab}`,
              timestamp: new Date().toISOString(),
            },
          }
        } catch (err: any) {
          return { error: `שגיאה בקריאת גיליון הלקוח: ${err.message}` }
        }
      },
    }),

    /**
     * Inspect and analyze any client spreadsheet in depth
     */
    inspect_client_spreadsheet: tool({
      description: 'בדיקה, קריאה וניתוח מעמיק של קובץ ה-Google Sheets הראשי של לקוח כלשהו. מאפשר לסוכן העל לפתוח כל גיליון, לבדוק את כל הלשוניות, לקרוא כותרות ושורות נתונים כדי לענות לנחמיה על שאלות תזרים, הכנסות, הוצאות, פרויקטים ומספרים.',
      inputSchema: z.object({
        clientIdOrName: z.string().describe('שם הלקוח או מזהה הלקוח'),
        tabName: z.string().optional().describe('שם הלשונית בגיליון לניתוח (אם לא סופק, ינותחו הלשוניות המובילות)'),
        maxRows: z.number().optional().default(40).describe('כמות שורות לדגימה וקריאה'),
      }),
      execute: async ({ clientIdOrName, tabName, maxRows }) => {
        try {
          const clients = await listWorkspaceClients()
          const target = findWorkspaceClientByNameOrId(clients, clientIdOrName)
          if (!target) {
            return { error: `לא נמצא לקוח בשם "${clientIdOrName}". לקוחות קיימים: ${clients.slice(0, 10).map((c) => c.name).join(', ')}` }
          }
          if (!target.google_sheet_id) {
            return {
              clientName: target.name,
              hasSheet: false,
              message: `ללקוח ${target.name} טרם חובר גיליון Google Sheets ראשי.`,
            }
          }

          const tabs = await getSpreadsheetMeta(target.google_sheet_id)
          const availableTabTitles = tabs.map((t) => t.title)

          if (tabName && !availableTabTitles.includes(tabName)) {
            return {
              clientName: target.name,
              availableTabs: availableTabTitles,
              error: `הלשונית "${tabName}" לא נמצאה בגיליון של ${target.name}. הלשוניות הקיימות: ${availableTabTitles.join(', ')}`,
            }
          }

          const tabsToRead = tabName ? [tabName] : availableTabTitles.slice(0, 5)
          const results: Record<string, any> = {}

          for (const tTitle of tabsToRead) {
            const rows = await getSheetRows(target.google_sheet_id, tTitle)
            results[tTitle] = {
              rowCount: rows.length,
              headers: rows.length > 0 ? Object.keys(rows[0]) : [],
              sampleRows: rows.slice(0, maxRows),
            }
          }

          return {
            clientName: target.name,
            sheetId: target.google_sheet_id,
            allTabs: availableTabTitles,
            analyzedTabs: results,
            summary: `גיליון הלקוח "${target.name}" כולל ${availableTabTitles.length} לשוניות (${availableTabTitles.join(', ')}). נותחו בהצלחה הנתונים מ-${tabsToRead.length} לשוניות.`,
            _citation: {
              type: 'sheet',
              label: `גיליון ${target.name} — ${tabsToRead.join(', ')}`,
              timestamp: new Date().toISOString(),
            },
          }
        } catch (err: any) {
          return { error: `שגיאה בניתוח גיליון הלקוח: ${err.message}` }
        }
      },
    }),

    /**
     * Appends rows/data into a client spreadsheet tab
     */
    append_data_to_client_sheet: tool({
      description: 'הוספת שורות ונתונים חדשים ללשונית בגיליון Google Sheets של לקוח.',
      inputSchema: z.object({
        clientIdOrName: z.string().describe('שם הלקוח או מזהה הלקוח'),
        tabName: z.string().describe('שם הלשונית בגיליון להוספת הנתונים'),
        rows: z.array(z.array(z.string())).describe('מערך של שורות ערכים להוספה'),
        confirmationId: confirmationIdSchema,
      }),
      execute: async ({ clientIdOrName, tabName, rows, confirmationId }) => {
        try {
          const clients = await listWorkspaceClients()
          const client = findWorkspaceClientByNameOrId(clients, clientIdOrName)
          if (!client) return { error: `לא נמצא לקוח בשם "${clientIdOrName}"` }
          if (!client.google_sheet_id) return { error: `ללקוח "${client.name}" אין גיליון מקושר` }

          const gate = await checkGate(
            'append_data_to_client_sheet', { clientId: client.id, tabName, rows }, confirmationId,
            `לאשר הוספת ${rows.length} שורות ללשונית "${tabName}" של ${client.name}?`
          )
          if (!gate.approved) return gate
          const res = await appendRows(client.google_sheet_id, tabName, rows)
          return {
            success: true,
            message: `✅ נוספו בהצלחה ${res.updatedRows} שורות ללשונית "${tabName}" בגיליון של ${client.name}!`,
          }
        } catch (err: any) {
          return { error: `שגיאה בהוספת נתונים לגיליון: ${err.message}` }
        }
      },
    }),

    /**
     * Updates specific cells/range in client spreadsheet
     */
    update_client_sheet_range: tool({
      description: 'עדכון תאים וטווח נתונים בגיליון Google Sheets של לקוח (למשל: תא בודד או טווח A2:D2).',
      inputSchema: z.object({
        clientIdOrName: z.string().describe('שם הלקוח או מזהה הלקוח'),
        tabName: z.string().describe('שם הלשונית'),
        range: z.string().describe('טווח התאים, למשל: "A2:C2" או "B5"'),
        values: z.array(z.array(z.string())).describe('מערך הערכים החדשים'),
        confirmationId: confirmationIdSchema,
      }),
      execute: async ({ clientIdOrName, tabName, range, values, confirmationId }) => {
        try {
          const clients = await listWorkspaceClients()
          const client = findWorkspaceClientByNameOrId(clients, clientIdOrName)
          if (!client) return { error: `לא נמצא לקוח בשם "${clientIdOrName}"` }
          if (!client.google_sheet_id) return { error: `ללקוח "${client.name}" אין גיליון מקושר` }

          const gate = await checkGate(
            'update_client_sheet_range', { clientId: client.id, tabName, range, values }, confirmationId,
            `לאשר דריסת הטווח ${range} בלשונית "${tabName}" של ${client.name}?`
          )
          if (!gate.approved) return gate
          const fullRange = formatRange(tabName, range)
          await updateRange(client.google_sheet_id, fullRange, values)

          return { success: true, message: `✅ טווח ${range} בלשונית "${tabName}" עודכן בהצלחה בגיליון של ${client.name}!` }
        } catch (err: any) {
          return { error: `שגיאה בעדכון תאים בגיליון: ${err.message}` }
        }
      },
    }),

    // ═════════════════════════════════════════════════════════════════════════
    // 5. CALENDAR & AGENCY FINANCE TOOLS
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * Agency finance summary
     */
    get_agency_finance_summary: tool({
      description: 'תמונת מצב פיננסית פנימית של סוכנות נחמיה (הכנסות, הוצאות, ריטיינרים, חשבוניות).',
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const context = await getInternalFinanceAgentContext()
          return {
            ...context,
            _citation: {
              type: 'sheet',
              label: 'גיליון כספי הסוכנות',
              timestamp: new Date().toISOString(),
            },
          }
        } catch (err: any) {
          return { error: `שגיאה בשליפת נתוני כספי הסוכנות: ${err.message}` }
        }
      },
    }),

    /**
     * Upcoming calendar events
     */
    get_calendar_overview: tool({
      description: 'אירועים ופגישות קרובות ביומן Google Calendar.',
      inputSchema: z.object({
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
            _citation: {
              type: 'calendar',
              label: `יומן Google — ${daysAhead} ימים קדימה`,
              timestamp: new Date().toISOString(),
            },
          }
        } catch (err: any) {
          return { error: `שגיאה בשליפת יומן: ${err.message}` }
        }
      },
    }),

    /**
     * Creates a new calendar meeting or event
     */
    create_calendar_event: tool({
      description: 'קביעת פגישה או אירוע חדש ב-Google Calendar של נחמיה (כולל קישור ללקוח ושליחת תזכורות).',
      inputSchema: z.object({
        title: z.string().describe('כותרת הפגישה או האירוע'),
        startDateTime: z.string().describe('מועד התחלה (פורמט ISO או YYYY-MM-DDTHH:mm:ss)'),
        endDateTime: z.string().optional().describe('מועד סיום (אם לא סופק יוגדר לשעה אחת)'),
        clientIdOrName: z.string().optional().describe('שם הלקוח או מזהה הלקוח (אם הפגישה משויכת ללקוח)'),
        description: z.string().optional().describe('תיאור הפגישה או הערות'),
        attendees: z.array(z.string()).optional().describe('רשימת אימיילים של משתתפים'),
        confirmationId: confirmationIdSchema,
      }),
      execute: async ({ title, startDateTime, endDateTime, clientIdOrName, description, attendees, confirmationId }) => {
        try {
          let resolvedClientId: string | null = null
          if (clientIdOrName) {
            const clients = await listWorkspaceClients()
            const target = findWorkspaceClientByNameOrId(clients, clientIdOrName)
            if (target) resolvedClientId = target.id
          }

          const start = new Date(startDateTime)
          const end = endDateTime ? new Date(endDateTime) : new Date(start.getTime() + 60 * 60 * 1000)

          const gate = await checkGate(
            'create_calendar_event', { title, startDateTime, endDateTime, clientId: resolvedClientId, description, attendees }, confirmationId,
            `לאשר יצירת האירוע "${title}" בתאריך ${start.toLocaleString('he-IL')}?`
          )
          if (!gate.approved) return gate
          const event = await createWorkspaceCalendarEvent({
            title,
            description: description || null,
            start: start.toISOString(),
            end: end.toISOString(),
            clientId: resolvedClientId,
            attendees: attendees || [],
            reminders: [30],
          })

          return {
            success: true,
            message: `✅ הפגישה "${title}" נקבעה בהצלחה ביומן ל-${start.toLocaleString('he-IL')}!`,
            eventId: event.id,
          }
        } catch (err: any) {
          return { error: `שגיאה בקביעת פגישה ביומן: ${err.message}` }
        }
      },
    }),

    // ═════════════════════════════════════════════════════════════════════════
    // 6. CLIENT ECOSYSTEM (MULTI-ASSETS, ROUTINES & GOALS)
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * Daily operational agenda for Nehemiah based on monthly routines & open tasks
     */
    get_daily_operational_agenda: tool({
      description: 'שליפת סדר היום והשגרות התפעוליות של נחמיה להיום (או ליום נבחר בחודש) — מעבר על חשבונות, הפקת חשבוניות, מעקב מזכירות ורואי חשבון בכל הלקוחות.',
      inputSchema: z.object({
        dayOfMonth: z.number().min(1).max(31).optional().describe('יום בחודש (ברירת מחדל: היום הנוכחי)'),
      }),
      execute: async ({ dayOfMonth }) => {
        try {
          const { listTodayRoutinesAcrossWorkspace } = await import('@/lib/v2/client-ecosystem-dal')
          const routines = await listTodayRoutinesAcrossWorkspace(dayOfMonth)
          const targetDay = dayOfMonth ?? new Date().getDate()

          return {
            dayOfMonth: targetDay,
            routinesCount: routines.length,
            routines: routines.map((r) => ({
              id: r.id,
              clientName: r.clientName,
              clientId: r.clientId,
              title: r.title,
              assignedRole: r.assignedRole,
              frequency: r.frequency,
              description: r.description,
            })),
            summary: routines.length > 0
              ? `נמצאו ${routines.length} שגרות קבועות ליום ה-${targetDay} בחודש.`
              : `אין שגרות קבועות שהוגדרו ליום ה-${targetDay} בחודש.`,
            _citation: {
              type: 'calendar',
              label: `סדר יום תפעולי — יום ${targetDay} בחודש`,
              timestamp: new Date().toISOString(),
            },
          }
        } catch (err: any) {
          return { error: `שגיאה בשליפת סדר היום: ${err.message}` }
        }
      },
    }),

    /**
     * 360 overview of client ecosystem (all sheets, drive folders, routines, goals, vault services)
     */
    get_client_ecosystem_overview: tool({
      description: 'תמונת מצב אקולוגית מלאה על לקוח: כל גיליונות העבודה, תיקיות ה-Drive, שגרות חודשיות, יעדי צמיחה ושירותי כספת מחוברים.',
      inputSchema: z.object({
        clientIdOrName: z.string().describe('שם הלקוח או מזהה לקוח'),
      }),
      execute: async ({ clientIdOrName }) => {
        try {
          const clients = await listWorkspaceClients()
          const client = findWorkspaceClientByNameOrId(clients, clientIdOrName)
          if (!client) return { error: `לא נמצא לקוח בשם "${clientIdOrName}"` }

          const {
            listClientAssets,
            listClientRoutines,
            listClientGoals,
            listClientVaultItems,
          } = await import('@/lib/v2/client-ecosystem-dal')

          const [assets, routines, goals, vaultItems] = await Promise.all([
            listClientAssets(client.id),
            listClientRoutines(client.id),
            listClientGoals(client.id),
            listClientVaultItems(client.id),
          ])

          return {
            clientName: client.name,
            clientId: client.id,
            assets: {
              total: assets.length,
              sheets: assets.filter((a) => a.assetType === 'sheet').map((s) => ({ name: s.name, category: s.category, url: s.url })),
              driveFolders: assets.filter((a) => a.assetType === 'drive_folder').map((d) => ({ name: d.name, category: d.category, url: d.url })),
            },
            routines: routines.map((r) => ({
              title: r.title,
              dayOfMonth: r.dayOfMonth,
              role: r.assignedRole,
              frequency: r.frequency,
              isActive: r.isActive,
            })),
            goals: goals.map((g) => ({
              title: g.title,
              progress: `${g.progressPercent}%`,
              current: g.currentValue,
              target: g.targetValue,
              unit: g.unit,
              status: g.status,
            })),
            vaultServices: vaultItems.map((v) => ({
              institution: v.institutionName,
              username: v.username,
              portalUrl: v.portalUrl,
            })),
          }
        } catch (err: any) {
          return { error: `שגיאה בשליפת פרטי האקוסיסטם של הלקוח: ${err.message}` }
        }
      },
    }),

    /**
     * Records or updates a client growth goal
     */
    record_client_goal: tool({
      description: 'הוספה או עדכון יעד צמיחה עסקי/פיננסי עבור לקוח (כולל ערך נוכחי ויעד).',
      inputSchema: z.object({
        clientIdOrName: z.string().describe('שם הלקוח או מזהה הלקוח'),
        title: z.string().describe('כותרת היעד (למשל: "הגדלת מחזור חודשי ל-1.5M", "הפחתת הוצאות ב-10%")'),
        targetValue: z.number().optional().describe('ערך היעד המספרי'),
        currentValue: z.number().optional().describe('ערך נוכחי מספרי'),
        unit: z.string().optional().default('₪').describe('יחידה (₪, %, וכו\')'),
        targetDate: z.string().optional().describe('תאריך יעד YYYY-MM-DD'),
        status: z.enum(['on_track', 'behind', 'achieved', 'paused']).optional().default('on_track'),
        confirmationId: confirmationIdSchema,
      }),
      execute: async ({ clientIdOrName, title, targetValue, currentValue, unit, targetDate, status, confirmationId }) => {
        try {
          const clients = await listWorkspaceClients()
          const client = findWorkspaceClientByNameOrId(clients, clientIdOrName)
          if (!client) return { error: `לא נמצא לקוח בשם "${clientIdOrName}"` }

          const gate = await checkGate(
            'record_client_goal',
            { clientId: client.id, title, targetValue, currentValue, unit, targetDate },
            confirmationId,
            `לאשר הגדרת יעד צמיחה חדש "${title}" עבור ${client.name}?`
          )
          if (!gate.approved) return gate

          const { saveClientGoal } = await import('@/lib/v2/client-ecosystem-dal')
          const goal = await saveClientGoal(client.id, {
            title,
            targetValue,
            currentValue,
            unit,
            targetDate,
            status,
          })

          return {
            success: true,
            message: `✅ היעד "${title}" נשמר בהצלחה עבור ${client.name}!`,
            goalId: goal.id,
          }
        } catch (err: any) {
          return { error: `שגיאה בשמירת יעד: ${err.message}` }
        }
      },
    }),

    /**
     * Get live sync status of all notebook sources
     */
    get_notebook_sources_status: tool({
      description: 'בדיקת סטטוס חיבור וסנכרון חי של כל מקורות המידע (Google Sheets, Drive, Gmail, Calendar, מסמכים וכספת) עבור לקוח ספציפי או עבור הסוכנות כולה.',
      inputSchema: z.object({
        clientIdOrName: z.string().optional().describe('שם או מזהה לקוח (אם לא סופק יוחזרו מקורות גלובליים של הסוכנות)'),
      }),
      execute: async ({ clientIdOrName }) => {
        try {
          if (clientIdOrName) {
            const clients = await listWorkspaceClients()
            const client = findWorkspaceClientByNameOrId(clients, clientIdOrName)
            if (!client) {
              return { error: `לא נמצא לקוח בשם "${clientIdOrName}".` }
            }
            const { sources } = await getClientNotebookSources(client.id)
            return {
              client: { id: client.id, name: client.name },
              totalSources: sources.length,
              sources: sources.map((s) => ({
                id: s.id,
                type: s.type,
                label: s.label,
                status: s.status,
                lastSync: s.lastSync,
              })),
              _citation: {
                type: 'drive',
                label: `סטטוס מקורות — ${client.name}`,
                timestamp: new Date().toISOString(),
              },
            }
          } else {
            const sources = await getGlobalNotebookSources()
            return {
              mode: 'global',
              totalSources: sources.length,
              sources: sources.map((s) => ({
                id: s.id,
                type: s.type,
                label: s.label,
                status: s.status,
                lastSync: s.lastSync,
              })),
              _citation: {
                type: 'drive',
                label: 'סטטוס מקורות גלובלי',
                timestamp: new Date().toISOString(),
              },
            }
          }
        } catch (err: any) {
          return { error: `שגיאה בשליפת סטטוס מקורות: ${err.message}` }
        }
      },
    }),

    /**
     * Save an artifact directly to the Studio (Instant, automatic, zero confirmation gate)
     */
    save_to_studio: tool({
      description: 'שמירת תוצר, סיכום, בריף, כרטיס KPI, תוכנית פעולה או טבלה כארטיפקט שמור בסטודיו (Studio) של הלקוח או של הסוכנות. פעולה זו שמורה פנימית ומתבצעת מיידית ללא שום בקשת אישור.',
      inputSchema: z.object({
        clientIdOrName: z.string().optional().describe('שם הלקוח או מזהה הלקוח (אם זה ארטיפקט עבור לקוח מסוים, אחרת יישמר ברמת הסוכנות)'),
        artifactType: z.enum(['card', 'brief', 'chart', 'action_plan', 'table', 'meeting_prep']).describe('סוג הארטיפקט'),
        title: z.string().describe('כותרת ברורה ותמציתית בעברית עבור הארטיפקט'),
        contentMd: z.string().describe('תוכן הארטיפקט ב-Markdown עשיר ומפורט'),
        contentJson: z.record(z.string(), z.unknown()).optional().describe('נתונים מובנים נוספים במידת הצורך'),
      }),
      execute: async ({ clientIdOrName, artifactType, title, contentMd, contentJson }) => {
        try {
          let resolvedClientId: string | null = null

          if (clientIdOrName) {
            const clients = await listWorkspaceClients()
            const target = findWorkspaceClientByNameOrId(clients, clientIdOrName)
            if (target) {
              resolvedClientId = target.id
            }
          }

          const { saveNotebookArtifact } = await import('@/lib/v2/notebook-artifacts')
          const artifact = await saveNotebookArtifact({
            clientId: resolvedClientId,
            artifactType,
            title,
            contentMd,
            contentJson: contentJson as Record<string, unknown> | undefined,
          })

          return {
            success: true,
            message: `✅ הארטיפקט "${artifact.title}" נשמר בהצלחה בסטודיו!`,
            artifactId: artifact.id,
            _citation: {
              type: 'document',
              label: `סטודיו — ${artifact.title}`,
              timestamp: new Date().toISOString(),
            },
          }
        } catch (err: any) {
          return { error: `שגיאה בשמירת ארטיפקט בסטודיו: ${err.message}` }
        }
      },
    }),

    /**
     * Semantic and keyword search across client documents (RAG)
     */
    search_client_documents: tool({
      description: 'חיפוש סמנטי ומעמיק במסמכים שהועלו עבור לקוח (PDF, דוחות כספיים, חוזים, חשבוניות שעברו OCR). מחזיר קטעים רלוונטיים מתוך המסמכים עם ציטוט מדויק.',
      inputSchema: z.object({
        clientIdOrName: z.string().describe('שם הלקוח או מזהה הלקוח'),
        query: z.string().describe('שאילתת החיפוש בעברית (למשל: "מה הרווח הנקי לשנת 2024", "הסכם שכירות", "תנאי תשלום")'),
        fileType: z.enum(['receipt', 'invoice', 'contract', 'report', 'other']).optional(),
      }),
      execute: async ({ clientIdOrName, query, fileType }) => {
        try {
          const clients = await listWorkspaceClients()
          const target = findWorkspaceClientByNameOrId(clients, clientIdOrName)
          if (!target) return { error: `לא נמצא לקוח בשם "${clientIdOrName}"` }

          const db = getWorkspaceAdminDb()

          // 1. Direct match by file name in v2_client_documents
          const { data: directDocs } = await db
            .from('v2_client_documents')
            .select('id, file_name, file_type, ocr_status, created_at')
            .eq('client_id', target.id)
            .ilike('file_name', `%${query}%`)
            .limit(5)

          // 2. Semantic search via RPC
          let semanticChunks: any[] = []
          try {
            const { embed } = await import('ai')
            const { google } = await import('@ai-sdk/google')
            const { embedding } = await embed({
              model: google.textEmbeddingModel('text-embedding-004'),
              value: query.trim(),
            })
            const { data: chunks } = await db.rpc('search_v2_documents', {
              query_embedding: embedding,
              p_client_id: target.id,
              p_file_type: fileType ?? null,
              match_threshold: 0.55,
              match_count: 5,
            })
            semanticChunks = chunks || []
          } catch (embedErr) {
            console.warn('[search_client_documents] Semantic embedding fallback:', embedErr)
          }

          if ((!directDocs || directDocs.length === 0) && semanticChunks.length === 0) {
            return {
              clientName: target.name,
              message: `לא נמצאו קטעים רלוונטיים במסמכי ${target.name} עבור השאילתה "${query}".`,
              query,
            }
          }

          return {
            clientName: target.name,
            matchedChunksCount: semanticChunks.length,
            chunks: semanticChunks.map((c: any) => ({
              fileName: c.file_name,
              fileType: c.file_type,
              similarity: `${(c.similarity * 100).toFixed(0)}%`,
              content: c.content,
            })),
            matchedFiles: (directDocs || []).map((d: any) => ({
              fileName: d.file_name,
              fileType: d.file_type,
            })),
            _citation: {
              type: 'document',
              label: semanticChunks.length > 0
                ? `מסמך — ${semanticChunks[0].file_name}`
                : `מסמכים — ${target.name}`,
              timestamp: new Date().toISOString(),
            },
          }
        } catch (err: any) {
          return { error: `שגיאה בחיפוש מסמכים: ${err.message}` }
        }
      },
    }),

    /**
     * List client audio meeting recordings & transcripts
     */
    list_client_recordings: tool({
      description: 'שליפת רשימת הקלטות פגישות ותמלולים של לקוח (כולל החלטות ומשימות שחולצו מההקלטה).',
      inputSchema: z.object({
        clientIdOrName: z.string().describe('שם הלקוח או מזהה הלקוח'),
      }),
      execute: async ({ clientIdOrName }) => {
        try {
          const clients = await listWorkspaceClients()
          const target = findWorkspaceClientByNameOrId(clients, clientIdOrName)
          if (!target) return { error: `לא נמצא לקוח בשם "${clientIdOrName}"` }

          const { listClientRecordings } = await import('@/lib/v2/notebook-recordings')
          const recordings = await listClientRecordings(target.id)

          return {
            clientName: target.name,
            totalRecordings: recordings.length,
            recordings: recordings.map((r) => ({
              id: r.id,
              fileName: r.file_name,
              status: r.transcript_status,
              hasTranscript: !!r.transcript_text,
              transcriptSnippet: r.transcript_text ? r.transcript_text.slice(0, 250) + '...' : null,
              extractedItems: r.extracted_items,
              createdAt: r.created_at,
            })),
            _citation: {
              type: 'recording',
              label: `הקלטות פגישות — ${target.name} (${recordings.length})`,
              timestamp: new Date().toISOString(),
            },
          }
        } catch (err: any) {
          return { error: `שגיאה בשליפת הקלטות: ${err.message}` }
        }
      },
    }),

    // ═════════════════════════════════════════════════════════════════════════
    // 7. CLIENT DASHBOARD & KPI OVERVIEW
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * Inspects and summarizes the client's interactive learning dashboard.
     * Evaluates active KPI cards, charts, and data tables with live Google Sheets values.
     */
    get_client_dashboard_overview: tool({
      description: 'שליפה וסיכום מקיף של הדשבורד של הלקוח (KPI Cards, תרשימים, נתוני הכנסות/הוצאות, רווחיות, גבייה וטבלאות). מפעיל חישוב של ערכי האמת מתוך גיליון ה-Google Sheets של הלקוח בהתאם להגדרות הווידג\'טים.',
      inputSchema: z.object({
        clientIdOrName: z.string().optional().describe('מזהה או שם הלקוח. בשיחה בהקשר לקוח מסוים ניתן להשאיר ריק.'),
      }),
      execute: async ({ clientIdOrName }) => {
        try {
          const clients = await listWorkspaceClients()
          let targetClient = clientIdOrName ? findWorkspaceClientByNameOrId(clients, clientIdOrName) : null
          if (!targetClient && !clientIdOrName && clients.length === 1) {
            targetClient = clients[0]
          }
          if (!targetClient && clientIdOrName) {
            return { error: `לא נמצא לקוח בשם "${clientIdOrName}"` }
          }
          if (!targetClient) {
            return { error: 'נא לציין שם לקוח עבור שליפת הדשבורד שלו.' }
          }

          const rawConfig = targetClient.dashboard_config_json
          const configResult = dashboardConfigSchema.safeParse(rawConfig)

          if (!configResult.success || !configResult.data.widgets || configResult.data.widgets.length === 0) {
            return {
              hasDashboard: false,
              clientName: targetClient.name,
              clientId: targetClient.id,
              message: `ללקוח "${targetClient.name}" טרם הוגדר דשבורד מותאם אישית. ניתן ליצור עבורו דשבורד אוטומטי מתוך גיליון ה-Google Sheets.`,
              hasSheet: !!targetClient.google_sheet_id,
            }
          }

          const config = configResult.data
          const widgetsSummary: any[] = []
          const sheetCache: Record<string, any[]> = {}

          for (const w of config.widgets) {
            let evaluatedValue: any = null

            if (targetClient.google_sheet_id && w.sheet) {
              if (!sheetCache[w.sheet]) {
                try {
                  sheetCache[w.sheet] = await getSheetRows(targetClient.google_sheet_id, w.sheet)
                } catch {
                  sheetCache[w.sheet] = []
                }
              }

              const rows = sheetCache[w.sheet] || []

              if (w.type === 'stat_card') {
                if (w.aggregation === 'net_diff' && w.net_formula) {
                  const typeCol = w.net_formula.type_column
                  const valCol = w.net_formula.column
                  const posVal = w.net_formula.positive_value
                  const negVal = w.net_formula.negative_value

                  let positiveSum = 0
                  let negativeSum = 0

                  for (const r of rows) {
                    const rowType = String(r[typeCol] ?? '').trim()
                    const rawVal = String(r[valCol] ?? '').replace(/[^\d.-]/g, '')
                    const num = parseFloat(rawVal) || 0

                    if (rowType === posVal) positiveSum += num
                    else if (rowType === negVal) negativeSum += num
                  }
                  evaluatedValue = {
                    netProfit: positiveSum - negativeSum,
                    positiveSum,
                    negativeSum,
                    formatted: `₪${(positiveSum - negativeSum).toLocaleString('he-IL')}`,
                  }
                } else if (w.aggregation === 'sum' && w.value_column) {
                  let sum = 0
                  for (const r of rows) {
                    const raw = String(r[w.value_column] ?? '').replace(/[^\d.-]/g, '')
                    sum += parseFloat(raw) || 0
                  }
                  evaluatedValue = {
                    sum,
                    formatted: `${w.prefix || ''}₪${sum.toLocaleString('he-IL')}${w.suffix || ''}`,
                  }
                } else if (w.aggregation === 'count') {
                  evaluatedValue = {
                    count: rows.length,
                    formatted: `${rows.length} רשומות`,
                  }
                } else if (w.aggregation === 'avg' && w.value_column) {
                  let sum = 0
                  let count = 0
                  for (const r of rows) {
                    const raw = String(r[w.value_column] ?? '').replace(/[^\d.-]/g, '')
                    const val = parseFloat(raw)
                    if (!isNaN(val)) {
                      sum += val
                      count++
                    }
                  }
                  const avg = count > 0 ? sum / count : 0
                  evaluatedValue = {
                    avg,
                    formatted: `${w.prefix || ''}${avg.toFixed(1)}${w.suffix || ''}`,
                  }
                }
              } else if (w.type === 'data_table') {
                evaluatedValue = {
                  totalRows: rows.length,
                  sample: rows.slice(0, 5),
                }
              } else if (w.type === 'bar_chart' || w.type === 'pie_chart' || w.type === 'line_chart') {
                const categories: Record<string, number> = {}
                const groupCol = w.group_by || w.x_column || w.label_column
                const valCol = w.value_column || w.y_column

                if (groupCol && valCol) {
                  for (const r of rows.slice(0, 200)) {
                    const key = String(r[groupCol] ?? 'אחר').trim()
                    const raw = String(r[valCol] ?? '').replace(/[^\d.-]/g, '')
                    const val = parseFloat(raw) || 0
                    categories[key] = (categories[key] || 0) + val
                  }
                  evaluatedValue = {
                    categories: Object.entries(categories).map(([label, value]) => ({ label, value })),
                  }
                }
              }
            }

            widgetsSummary.push({
              id: w.id,
              title: w.title,
              type: w.type,
              sheetTab: w.sheet,
              dashboardTab: w.tab || 'ראשי',
              aggregation: w.aggregation,
              evaluatedValue,
            })
          }

          return {
            hasDashboard: true,
            clientId: targetClient.id,
            clientName: targetClient.name,
            tabs: config.tabs || ['ראשי'],
            totalWidgets: config.widgets.length,
            widgets: widgetsSummary,
            _citation: {
              type: 'sheet',
              label: `דשבורד וגיליונות — ${targetClient.name}`,
              timestamp: new Date().toISOString(),
            },
          }
        } catch (err: any) {
          return { error: `שגיאה בשליפת דשבורד הלקוח: ${err.message}` }
        }
      },
    }),

    // ═════════════════════════════════════════════════════════════════════════
    // 8. AUTONOMOUS AGENT SCHEDULED TASKS & ROUTINES
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * Schedule a recurring or one-off task for the AI agent
     */
    schedule_agent_task: tool({
      description: 'קביעת משימה מתוזמנת או שגרה קבועה עבור סוכן ה-AI (למשל: סריקת מיילים מלקוח בכל בוקר, סריקת יומן ולו"ז יומי, שליחת מייל תזכורת, או ביקורת תיק לקוח). הסוכן יבצע את המשימה בזמן שנבחר ויסכם את התוצאות.',
      inputSchema: z.object({
        title: z.string().describe('שם קצר וברור למשימה, למשל: "סריקת מיילים מיוסי בכל בוקר"'),
        instruction: z.string().describe('ההוראה המפורטת לסוכן — מה עליו לבצע, אילו מקורות לבדוק ואילו פעולות לנקוט'),
        scheduleType: z.enum(['daily', 'once', 'weekly', 'cron']).describe('מחזוריות המשימה: daily (יומי), once (חד פעמי), weekly (שבועי), cron (לפי ביטוי cron)'),
        scheduledTime: z.string().optional().describe('שעת הביצוע (למשל "08:30" ליומי, או תאריך ושעה בפורמט ISO למשימה חד-פעמית). ברירת מחדל: "08:30"'),
        cronExpression: z.string().optional().describe('ביטוי cron מותאם אישית (אם נבחר cron)'),
        taskType: z.enum(['check_emails', 'scan_calendar', 'send_email', 'audit_client', 'custom_prompt']).optional().default('custom_prompt').describe('סיווג סוג המשימה'),
        clientIdOrName: z.string().optional().describe('שם או מזהה לקוח רלוונטי (אם המשימה מיועדת ללקוח ספציפי)'),
      }),
      execute: async ({ title, instruction, scheduleType, scheduledTime, cronExpression, taskType, clientIdOrName }) => {
        try {
          const task = await createAgentScheduledTask({
            title,
            instruction,
            scheduleType,
            scheduledTime,
            cronExpression,
            taskType,
            clientIdOrName,
          })

          return {
            success: true,
            message: `✅ המשימה האוטונומית "${task.title}" נקבעה בהצלחה לסוכן!`,
            task: {
              id: task.id,
              title: task.title,
              scheduleType: task.schedule_type,
              scheduledTime: task.scheduled_time,
              nextRunAt: task.next_run_at,
              clientName: task.client_name,
            },
            _citation: {
              type: 'tasks',
              label: `שגרת סוכן: ${task.title} (${task.scheduled_time || '08:30'})`,
              timestamp: new Date().toISOString(),
            },
          }
        } catch (err: any) {
          return { error: `שגיאה בקביעת משימת סוכן: ${err.message}` }
        }
      },
    }),

    /**
     * Lists all scheduled tasks assigned to the agent
     */
    list_agent_scheduled_tasks: tool({
      description: 'שליפת רשימת כל המשימות והשגרות המתוזמנות שהוגדרו לסוכן ה-AI, כולל זמני ריצה, סטטוס (פעיל/מושהה), ותוצאות ביצוע אחרונות.',
      inputSchema: z.object({
        statusFilter: z.enum(['all', 'active', 'paused']).optional().default('all'),
      }),
      execute: async ({ statusFilter }) => {
        try {
          const tasks = await listAgentScheduledTasks({ statusFilter })
          return {
            total: tasks.length,
            tasks: tasks.map((t) => ({
              id: t.id,
              title: t.title,
              instruction: t.instruction,
              scheduleType: t.schedule_type,
              scheduledTime: t.scheduled_time,
              isActive: t.is_active,
              nextRunAt: t.next_run_at,
              lastRunAt: t.last_run_at,
              lastRunStatus: t.last_run_status,
              lastSummary: t.last_run_result?.summary || null,
              clientName: t.client_name || 'כללי לסוכנות',
            })),
            _citation: {
              type: 'tasks',
              label: `משימות סוכן אוטונומיות (${tasks.length})`,
              timestamp: new Date().toISOString(),
            },
          }
        } catch (err: any) {
          return { error: `שגיאה בשליפת משימות סוכן: ${err.message}` }
        }
      },
    }),

    /**
     * Manage an agent scheduled task (pause, resume, run now, delete)
     */
    manage_agent_scheduled_task: tool({
      description: 'ניהול משימה מתוזמנת של הסוכן: הפעלה מיידית (run_now), השהיה (pause), חידוש (resume), או מחיקה (delete).',
      inputSchema: z.object({
        taskId: z.string().describe('מזהה המשימה'),
        action: z.enum(['run_now', 'pause', 'resume', 'delete']).describe('הפעולה המבוקשת'),
      }),
      execute: async ({ taskId, action }) => {
        try {
          const all = await listAgentScheduledTasks()
          const task = all.find((t) => t.id === taskId)
          if (!task) return { error: `משימת סוכן עם מזהה ${taskId} לא נמצאה` }

          if (action === 'delete') {
            await deleteAgentScheduledTask(taskId)
            return { success: true, message: `✅ המשימה "${task.title}" נמחקה בהצלחה.` }
          }

          if (action === 'pause') {
            await updateAgentScheduledTask(taskId, { is_active: false })
            return { success: true, message: `⏸️ המשימה "${task.title}" הושהתה.` }
          }

          if (action === 'resume') {
            await updateAgentScheduledTask(taskId, { is_active: true })
            return { success: true, message: `▶️ המשימה "${task.title}" חודשה ותפעל בזמן המתוזמן.` }
          }

          if (action === 'run_now') {
            const outcome = await executeAgentScheduledTask(task)
            return {
              success: outcome.success,
              message: outcome.success
                ? `⚡ המשימה "${task.title}" הופעלה והושלמה בהצלחה!`
                : `❌ שגיאה בהפעלת המשימה: ${outcome.error}`,
              summary: outcome.summary,
            }
          }

          return { error: 'פעולה לא מוכרת' }
        } catch (err: any) {
          return { error: `שגיאה בניהול משימת סוכן: ${err.message}` }
        }
      },
    }),
  }
}
