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

export function createGlobalAgentTools() {
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
      }),
      execute: async ({ name, email, phone, status, advisoryGoal }) => {
        try {
          const db = getWorkspaceAdminDb()
          const { data, error } = await db
            .from('clients')
            .insert({
              name: name.trim(),
              email: email?.trim() || null,
              phone: phone?.trim() || null,
              status: status || 'פעיל',
              advisory_goal: advisoryGoal || null,
              client_context_json: {},
              dashboard_config_json: {},
            })
            .select()
            .single()

          if (error) throw new Error(error.message)
          return { success: true, message: `✅ הלקוח "${name}" נוסף בהצלחה למערכת!`, client: data }
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
      }),
      execute: async ({ clientIdOrName, name, email, phone, status, advisoryGoal, gmailLabel }) => {
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
      }),
      execute: async (input) => {
        try {
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
          const gate = await requireAgentConfirmation(
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
          const gate = await requireAgentConfirmation(
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
          const gate = await requireAgentConfirmation(
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
          const gate = await requireAgentConfirmation(
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
      }),
      execute: async ({ clientIdOrName, folderName }) => {
        try {
          const clients = await listWorkspaceClients()
          const client = findWorkspaceClientByNameOrId(clients, clientIdOrName)
          if (!client) return { error: `לא נמצא לקוח בשם "${clientIdOrName}"` }

          const nameToUse = folderName || client.name
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
      }),
      execute: async ({ clientIdOrName, title, sheets }) => {
        try {
          const clients = await listWorkspaceClients()
          const client = findWorkspaceClientByNameOrId(clients, clientIdOrName)
          if (!client) return { error: `לא נמצא לקוח בשם "${clientIdOrName}"` }

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

          if (!target) return { error: `לא נמצא לקוח בשם או במזהה "${clientIdOrName}"` }

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

          const gate = await requireAgentConfirmation(
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

          const gate = await requireAgentConfirmation(
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
          return context
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

          const gate = await requireAgentConfirmation(
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
  }
}
