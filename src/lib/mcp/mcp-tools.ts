import 'server-only'

import { z } from 'zod'
import { getWorkspaceAdminDb } from '@/lib/v2/workspace-dal'
import { searchDriveFiles, getClientFiles, getDriveFileText } from '@/lib/google-drive'
import { getSheetRows, getSpreadsheetMeta, getSheetData } from '@/lib/google-sheets'
import { listClientEmails } from '@/lib/google-gmail'
import { listWorkspaceCalendarEvents } from '@/lib/v2/google-calendar'
import { getInternalFinanceAgentContext } from '@/lib/v2/internal-finance'
import type { DashboardConfig } from '@/types/dashboard'

// ── Helpers ──────────────────────────────────────────────────────────────────

function findClient(clients: any[], query: string): any | undefined {
  if (!query) return undefined
  const raw = query.trim()
  const clean = raw.toLowerCase().replace(/["'״׳`]/g, '').trim()
  if (!clean) return undefined

  return (
    clients.find((c) => c.id === raw) ||
    clients.find((c) => c.name.trim().toLowerCase().replace(/["'״׳`]/g, '') === clean) ||
    clients.find((c) => {
      const n = c.name.trim().toLowerCase().replace(/["'״׳`]/g, '')
      return n.includes(clean) || clean.includes(n)
    })
  )
}

async function getAllClients() {
  const db = getWorkspaceAdminDb()
  const { data, error } = await db
    .from('clients')
    .select('id, name, email, phone, status, drive_folder_id, google_sheet_id, gmail_label, dashboard_config_json, portfolio_value, advisory_goal, created_at')
    .order('name')

  if (error) {
    throw new Error(`Failed to load clients: ${error.message}`)
  }
  return data || []
}

// ── MCP Tool Definitions ─────────────────────────────────────────────────────

export interface McpToolSpec {
  name: string
  titleHebrew: string
  category: 'drive' | 'dashboard' | 'clients' | 'operations' | 'moshe'
  description: string
  schema: z.ZodObject<any>
  execute: (args: any) => Promise<any>
}

export const MCP_TOOLS: McpToolSpec[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // 1. GOOGLE DRIVE & FILE SEARCH (קבצי גוגל וחיפוש)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'search_google_drive_files',
    titleHebrew: 'חיפוש קבצים ב-Google Drive',
    category: 'drive',
    description: 'חיפוש קבצים ומסמכים ב-Google Drive לפי מילת מפתח, שם קובץ, או בתוך תיקיית לקוח ספציפי.',
    schema: z.object({
      query: z.string().describe('מילת חיפוש או שם קובץ (למשל: "חוזה", "תזרים", "2026")'),
      clientIdOrName: z.string().optional().describe('אופציונלי: שם או מזהה לקוח להגבלת החיפוש לתיקייה שלו'),
      pageSize: z.number().optional().default(15).describe('מספר תוצאות מרבי (עד 30)'),
    }),
    execute: async ({ query, clientIdOrName, pageSize }) => {
      let folderId: string | undefined
      let clientName: string | undefined

      if (clientIdOrName) {
        const clients = await getAllClients()
        const client = findClient(clients, clientIdOrName)
        if (client?.drive_folder_id) {
          folderId = client.drive_folder_id
          clientName = client.name
        }
      }

      const files = await searchDriveFiles(query, { folderId, pageSize: Math.min(pageSize || 15, 30) })
      return {
        query,
        searchedInClient: clientName || 'כל הכונן (Global)',
        totalFound: files.length,
        files: files.map((f) => ({
          name: f.name,
          type: f.mimeType,
          modified: f.modifiedTime,
          size: f.size,
          isFolder: f.isFolder,
          link: f.webViewLink,
        })),
      }
    },
  },

  {
    name: 'get_client_drive_files',
    titleHebrew: 'קבצי תיקיית לקוח ב-Drive',
    category: 'drive',
    description: 'שליפת רשימת הקבצים והתיקיות הנמצאים בתיקיית ה-Google Drive של לקוח מסוים.',
    schema: z.object({
      clientIdOrName: z.string().describe('שם או מזהה הלקוח (למשל: "ניסוי", "נסמארט")'),
    }),
    execute: async ({ clientIdOrName }) => {
      const clients = await getAllClients()
      const client = findClient(clients, clientIdOrName)
      if (!client) {
        return { error: `לקוח לא נמצא: "${clientIdOrName}"` }
      }
      if (!client.drive_folder_id) {
        return { error: `ללקוח ${client.name} אין תיקיית Drive מוגדרת במערכת` }
      }

      const files = await getClientFiles(client.drive_folder_id)
      return {
        clientName: client.name,
        clientId: client.id,
        folderLink: `https://drive.google.com/drive/folders/${client.drive_folder_id}`,
        totalFiles: files.length,
        files: files.map((f) => ({
          name: f.name,
          type: f.mimeType,
          modified: f.modifiedTime,
          size: f.size,
          isFolder: f.isFolder,
          link: f.webViewLink,
        })),
      }
    },
  },

  {
    name: 'read_drive_file_content',
    titleHebrew: 'קריאת תוכן קובץ מ-Drive',
    category: 'drive',
    description: 'קריאת תוכן טקסטואלי מקובץ ב-Google Drive (Google Docs, קובץ טקסט, CSV או סיכום גיליון).',
    schema: z.object({
      fileId: z.string().describe('מזהה הקובץ ב-Google Drive (fileId)'),
      maxCharacters: z.number().optional().default(15000).describe('אורך טקסט מרבי לקריאה'),
    }),
    execute: async ({ fileId, maxCharacters }) => {
      const fileData = await getDriveFileText(fileId, maxCharacters || 15000)
      return {
        name: fileData.name,
        type: fileData.mimeType,
        text: fileData.text,
      }
    },
  },

  {
    name: 'search_client_documents',
    titleHebrew: 'חיפוש מסמכים ו-OCR של לקוח',
    category: 'drive',
    description: 'חיפוש במסמכים שהועלו למערכת עבור לקוח ובטקסט שחולץ באמצעות OCR (סריקות, קבלות, מסמכים סרוקים).',
    schema: z.object({
      clientIdOrName: z.string().describe('שם או מזהה הלקוח'),
      query: z.string().describe('מילת חיפוש בתוכן המסמך או בשם הקובץ'),
    }),
    execute: async ({ clientIdOrName, query }) => {
      const clients = await getAllClients()
      const client = findClient(clients, clientIdOrName)
      if (!client) {
        return { error: `לקוח לא נמצא: "${clientIdOrName}"` }
      }

      const db = getWorkspaceAdminDb()
      const { data: docs, error } = await db
        .from('v2_client_documents')
        .select('id, file_name, file_type, ocr_status, ocr_text, summary, created_at')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) {
        return { error: `שגיאה בשליפת מסמכים: ${error.message}` }
      }

      const cleanQ = query.trim().toLowerCase()
      const matched = (docs || []).filter((d) => {
        const nameMatch = d.file_name?.toLowerCase().includes(cleanQ)
        const ocrMatch = d.ocr_text?.toLowerCase().includes(cleanQ)
        const summaryMatch = d.summary?.toLowerCase().includes(cleanQ)
        return nameMatch || ocrMatch || summaryMatch
      })

      return {
        clientName: client.name,
        totalFound: matched.length,
        documents: matched.map((d) => ({
          fileName: d.file_name,
          fileType: d.file_type,
          ocrStatus: d.ocr_status,
          summary: d.summary || null,
          textExcerpt: d.ocr_text ? d.ocr_text.slice(0, 500) + '...' : null,
          createdAt: d.created_at,
        })),
      }
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. CLIENT DASHBOARD & SPREADSHEETS (דשבורד וגיליונות)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'get_client_dashboard_overview',
    titleHebrew: 'דשבורד לקוח ומדדי מפתח (KPI)',
    category: 'dashboard',
    description: 'שליפת נתוני הדשבורד המחושבים של לקוח מתוך גיליון ה-Google Sheets: הכנסות, הוצאות, רווח נקי, שיעורי גבייה ומדדים.',
    schema: z.object({
      clientIdOrName: z.string().describe('שם או מזהה הלקוח'),
    }),
    execute: async ({ clientIdOrName }) => {
      const clients = await getAllClients()
      const client = findClient(clients, clientIdOrName)
      if (!client) {
        return { error: `לקוח לא נמצא: "${clientIdOrName}"` }
      }
      if (!client.google_sheet_id) {
        return {
          clientName: client.name,
          hasSheet: false,
          message: `ללקוח ${client.name} אין גיליון Google Sheets מחובר.`,
        }
      }

      const sheetId = client.google_sheet_id
      const sheetMetaList = await getSpreadsheetMeta(sheetId)
      const tabs = sheetMetaList.map((t) => t.title)
      const config = (client.dashboard_config_json as DashboardConfig) || null
      const widgets = config?.widgets || []

      const sheetCache: Record<string, Record<string, unknown>[]> = {}
      const widgetResults: any[] = []

      for (const w of widgets) {
        let evaluatedValue: any = null
        if (w.sheet) {
          if (!sheetCache[w.sheet]) {
            try {
              sheetCache[w.sheet] = await getSheetRows(sheetId, w.sheet)
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
              let pos = 0
              let neg = 0
              for (const r of rows) {
                const rowType = String(r[typeCol] ?? '').trim()
                const num = parseFloat(String(r[valCol] ?? '').replace(/[^\d.-]/g, '')) || 0
                if (rowType === posVal) pos += num
                else if (rowType === negVal) neg += num
              }
              evaluatedValue = { netProfit: pos - neg, positiveSum: pos, negativeSum: neg, formatted: `₪${(pos - neg).toLocaleString('he-IL')}` }
            } else if (w.aggregation === 'sum' && w.value_column) {
              let sum = 0
              for (const r of rows) {
                sum += parseFloat(String(r[w.value_column] ?? '').replace(/[^\d.-]/g, '')) || 0
              }
              evaluatedValue = { sum, formatted: `₪${sum.toLocaleString('he-IL')}` }
            } else if (w.aggregation === 'count') {
              evaluatedValue = { count: rows.length, formatted: `${rows.length} רשומות` }
            }
          }
        }

        widgetResults.push({
          title: w.title,
          type: w.type,
          sheet: w.sheet,
          value: evaluatedValue,
        })
      }

      // Also grab first tab sample to give immediate summary if no widgets configured
      let primaryTabSummary: any = null
      if (tabs.length > 0) {
        const firstTab = tabs[0]
        try {
          const firstRows = await getSheetRows(sheetId, firstTab)
          primaryTabSummary = {
            tabName: firstTab,
            rowCount: firstRows.length,
            columns: firstRows.length > 0 ? Object.keys(firstRows[0]) : [],
            sample: firstRows.slice(0, 3),
          }
        } catch {
          // Ignore
        }
      }

      return {
        clientName: client.name,
        clientId: client.id,
        googleSheetId: sheetId,
        sheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}`,
        availableTabs: tabs,
        widgets: widgetResults,
        primaryTabSummary,
      }
    },
  },

  {
    name: 'inspect_client_spreadsheet',
    titleHebrew: 'עיון בגיליון Google Sheets של לקוח',
    category: 'dashboard',
    description: 'עיון בלשוניות, שורות נתונים ורישומים מתוך גיליון ה-Google Sheets של הלקוח.',
    schema: z.object({
      clientIdOrName: z.string().describe('שם או מזהה הלקוח'),
      tabName: z.string().optional().describe('שם הלשונית בגיליון (אם לא צוין ייקרא הגיליון הראשון)'),
      maxRows: z.number().optional().default(15).describe('מספר שורות להחזרה (עד 50)'),
    }),
    execute: async ({ clientIdOrName, tabName, maxRows }) => {
      const clients = await getAllClients()
      const client = findClient(clients, clientIdOrName)
      if (!client) return { error: `לקוח לא נמצא: "${clientIdOrName}"` }
      if (!client.google_sheet_id) return { error: `ללקוח ${client.name} אין גיליון Google Sheets מחובר` }

      const sheetId = client.google_sheet_id
      const sheetMetaList = await getSpreadsheetMeta(sheetId)
      const tabs = sheetMetaList.map((t) => t.title)
      if (tabs.length === 0) return { error: 'הגיליון ריק או לא נמצאו לשוניות' }

      const targetTab = tabName || tabs[0]
      const rows = await getSheetRows(sheetId, targetTab)
      const limit = Math.min(maxRows || 15, 50)

      return {
        clientName: client.name,
        sheetId,
        tabName: targetTab,
        allTabs: tabs,
        totalRowsInTab: rows.length,
        rows: rows.slice(0, limit),
      }
    },
  },

  {
    name: 'lookup_client_sheet',
    titleHebrew: 'קריאת טווח תאים (Range) מגיליון',
    category: 'dashboard',
    description: 'קריאת נתונים מטווח מדויק בגיליון Google Sheets (למשל "A1:E20" או "תזרים!B2:D10").',
    schema: z.object({
      clientIdOrName: z.string().describe('שם או מזהה הלקוח'),
      range: z.string().describe('טווח התאים לקריאה (למשל: "A1:G15" או "Sheet1!A1:D10")'),
    }),
    execute: async ({ clientIdOrName, range }) => {
      const clients = await getAllClients()
      const client = findClient(clients, clientIdOrName)
      if (!client) return { error: `לקוח לא נמצא: "${clientIdOrName}"` }
      if (!client.google_sheet_id) return { error: `ללקוח ${client.name} אין גיליון Google Sheets מחובר` }

      const data = await getSheetData(client.google_sheet_id, range)
      return {
        clientName: client.name,
        range,
        values: data,
      }
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. CLIENTS CRM & 360 PROFILE (לקוחות ופרופיל)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'list_all_clients',
    titleHebrew: 'רשימת כל הלקוחות',
    category: 'clients',
    description: 'שליפת רשימת כל הלקוחות במערכת עם פרטי יצירת קשר, סטטוס, שווי תיק, קישורי Drive ו-Sheets.',
    schema: z.object({
      statusFilter: z.enum(['all', 'active', 'prospect', 'inactive']).optional().default('all'),
    }),
    execute: async ({ statusFilter }) => {
      const clients = await getAllClients()
      const filtered = (!statusFilter || statusFilter === 'all')
        ? clients
        : clients.filter((c) => {
            const s = (c.status || 'active').toLowerCase()
            if (statusFilter === 'active') return s === 'active' || s === 'פעיל'
            if (statusFilter === 'prospect') return s === 'prospect' || s === 'ליד'
            if (statusFilter === 'inactive') return s === 'inactive' || s === 'לא פעיל'
            return true
          })

      return {
        total: filtered.length,
        clients: filtered.map((c) => ({
          id: c.id,
          name: c.name,
          email: c.email,
          phone: c.phone,
          status: c.status || 'פעיל',
          portfolioValue: c.portfolio_value ? `₪${Number(c.portfolio_value).toLocaleString('he-IL')}` : null,
          hasDrive: !!c.drive_folder_id,
          hasSheet: !!c.google_sheet_id,
          advisoryGoal: c.advisory_goal,
        })),
      }
    },
  },

  {
    name: 'get_client_360_overview',
    titleHebrew: 'תמונת מצב 360° על לקוח',
    category: 'clients',
    description: 'פרופיל מקיף על לקוח: פרטים, משימות פתוחות, מיילים אחרונים, חיבורי כונן וגיליון ויעדים פיננסיים.',
    schema: z.object({
      clientIdOrName: z.string().describe('שם או מזהה הלקוח'),
    }),
    execute: async ({ clientIdOrName }) => {
      const clients = await getAllClients()
      const client = findClient(clients, clientIdOrName)
      if (!client) return { error: `לקוח לא נמצא: "${clientIdOrName}"` }

      const db = getWorkspaceAdminDb()

      // Fetch open tasks for client
      const { data: tasks } = await db
        .from('tasks')
        .select('id, title, status, priority, due_date, is_recurring')
        .eq('client_id', client.id)
        .neq('status', 'done')
        .order('due_date', { ascending: true })
        .limit(10)

      // Fetch upcoming appointments
      const { data: appointments } = await db
        .from('appointments')
        .select('id, title, start_time, end_time, status, location')
        .eq('client_id', client.id)
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })
        .limit(5)

      // Check unread emails preview if email configured
      let emailPreview = null
      if (client.email || client.gmail_label) {
        try {
          const emails = await listClientEmails({
            clientEmail: client.email || undefined,
            labelName: client.gmail_label || undefined,
            unreadOnly: true,
            maxResults: 3,
          })
          emailPreview = {
            unreadCount: emails.unreadCount,
            recentThreads: emails.threads.map((t) => ({
              subject: t.subject,
              date: t.date,
              snippet: t.snippet,
            })),
          }
        } catch {
          // Gmail API optional
        }
      }

      return {
        client: {
          id: client.id,
          name: client.name,
          email: client.email,
          phone: client.phone,
          status: client.status || 'פעיל',
          portfolioValue: client.portfolio_value,
          advisoryGoal: client.advisory_goal,
          hasDriveFolder: !!client.drive_folder_id,
          hasGoogleSheet: !!client.google_sheet_id,
        },
        openTasks: tasks || [],
        upcomingAppointments: appointments || [],
        emailPreview,
      }
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. TASKS, CALENDAR & AGENCY OPERATIONS (משימות, יומן ושגרה)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'get_workspace_tasks',
    titleHebrew: 'משימות ושגרות עבודה',
    category: 'operations',
    description: 'שליפת משימות פתוחות, משימות מחזוריות (שגרות יומיות/חודשיות) ומשימות דחופות בסביבת העבודה.',
    schema: z.object({
      clientIdOrName: z.string().optional().describe('אופציונלי: סינון לפי לקוח ספציפי'),
      status: z.enum(['all', 'open', 'completed']).optional().default('open'),
      priority: z.enum(['all', 'urgent', 'high', 'medium', 'low']).optional().default('all'),
    }),
    execute: async ({ clientIdOrName, status, priority }) => {
      const db = getWorkspaceAdminDb()
      let query = db.from('tasks').select('id, title, status, priority, due_date, is_recurring, recurring_pattern, client_id, clients(name)')

      if (clientIdOrName) {
        const clients = await getAllClients()
        const client = findClient(clients, clientIdOrName)
        if (client) query = query.eq('client_id', client.id)
      }

      if (status === 'open') {
        query = query.neq('status', 'done')
      } else if (status === 'completed') {
        query = query.eq('status', 'done')
      }

      if (priority && priority !== 'all') {
        query = query.eq('priority', priority)
      }

      const { data, error } = await query.order('due_date', { ascending: true }).limit(40)
      if (error) return { error: `שגיאה בשליפת משימות: ${error.message}` }

      return {
        total: (data || []).length,
        tasks: (data || []).map((t: any) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          dueDate: t.due_date,
          isRecurring: !!t.is_recurring,
          recurringPattern: t.recurring_pattern,
          clientName: t.clients?.name || 'כללי (ללא לקוח)',
        })),
      }
    },
  },

  {
    name: 'get_daily_operational_agenda',
    titleHebrew: 'סדר יום מבצעי (Agenda)',
    category: 'operations',
    description: 'סדר יום מלא לתאריך מסוים: פגישות מתוכננות ביומן, משימות לביצוע באותו יום ושגרות מחזוריות.',
    schema: z.object({
      date: z.string().optional().describe('תאריך מבוקש בפורמט YYYY-MM-DD (ברירת מחדל: היום)'),
    }),
    execute: async ({ date }) => {
      const targetDate = date || new Date().toISOString().split('T')[0]
      const db = getWorkspaceAdminDb()

      // Appointments for the day
      const startIso = `${targetDate}T00:00:00Z`
      const endIso = `${targetDate}T23:59:59Z`

      const { data: appointments } = await db
        .from('appointments')
        .select('id, title, start_time, end_time, status, location, clients(name)')
        .gte('start_time', startIso)
        .lte('start_time', endIso)
        .order('start_time', { ascending: true })

      // Tasks due on that day or overdue
      const { data: tasks } = await db
        .from('tasks')
        .select('id, title, status, priority, due_date, is_recurring, clients(name)')
        .lte('due_date', targetDate)
        .neq('status', 'done')
        .order('priority', { ascending: false })

      return {
        date: targetDate,
        totalAppointments: (appointments || []).length,
        appointments: (appointments || []).map((a: any) => ({
          title: a.title,
          start: a.start_time,
          end: a.end_time,
          status: a.status,
          clientName: a.clients?.name,
          location: a.location,
        })),
        pendingTasksDue: (tasks || []).map((t: any) => ({
          title: t.title,
          priority: t.priority,
          dueDate: t.due_date,
          clientName: t.clients?.name,
          isRecurring: t.is_recurring,
        })),
      }
    },
  },

  {
    name: 'get_calendar_overview',
    titleHebrew: 'יומן פגישות ואירועים',
    category: 'operations',
    description: 'שליפת הפגישות והאירועים הקרובים מיומן הפגישות ו-Google Calendar.',
    schema: z.object({
      daysAhead: z.number().optional().default(7).describe('כמה ימים קדימה לבדוק (ברירת מחדל: 7)'),
    }),
    execute: async ({ daysAhead }) => {
      const now = new Date()
      const future = new Date()
      future.setDate(future.getDate() + (daysAhead || 7))

      const db = getWorkspaceAdminDb()
      const { data: appts } = await db
        .from('appointments')
        .select('id, title, start_time, end_time, status, location, clients(name)')
        .gte('start_time', now.toISOString())
        .lte('start_time', future.toISOString())
        .order('start_time', { ascending: true })

      let googleEvents: any[] = []
      try {
        const calResult = await listWorkspaceCalendarEvents({
          timeMin: now.toISOString(),
          timeMax: future.toISOString(),
        })
        googleEvents = calResult.events || []
      } catch {
        // Calendar API optional
      }

      return {
        daysAhead: daysAhead || 7,
        totalAppointments: (appts || []).length,
        appointments: (appts || []).map((a: any) => ({
          title: a.title,
          start: a.start_time,
          end: a.end_time,
          status: a.status,
          clientName: a.clients?.name,
        })),
        googleCalendarEvents: googleEvents.map((g) => ({
          title: g.title,
          start: g.start,
          end: g.end,
          location: g.location,
        })),
      }
    },
  },

  {
    name: 'get_agency_finance_summary',
    titleHebrew: 'סיכום כספי הסוכנות',
    category: 'operations',
    description: 'סיכום תמונת המצב הכספית של הסוכנות: הכנסות חודשיות, הוצאות, תזרים מזומנים וריטיינרים פעילים.',
    schema: z.object({}),
    execute: async () => {
      const finance = (await getInternalFinanceAgentContext()) as any
      if (!finance.configured) {
        return {
          configured: false,
          message: 'גיליון כספי הסוכנות עדיין לא הוגדר במערכת',
        }
      }
      return {
        configured: true,
        totals: finance.totals,
        recentIncome: (finance.recentIncome || []).slice(0, 8),
        recentExpenses: (finance.recentExpenses || []).slice(0, 8),
        retainersCount: (finance.retainers || []).length,
        invoicesCount: (finance.invoices || []).length,
      }
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. MOSHE REAL-ESTATE PORTAL (פורטל הנדל"ן משה)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'get_moshe_portal_summary',
    titleHebrew: 'דשבורד פרויקטים נדל"ן (משה)',
    category: 'moshe',
    description: 'סיכום מקיף של פרויקטי הנדל"ן של משה: יתרת תזרים אמיתי, תשלומים צפויים, גבייה מקונים והתראות איחורים.',
    schema: z.object({
      projectId: z.string().optional().describe('אופציונלי: מזהה פרויקט ספציפי'),
    }),
    execute: async ({ projectId }) => {
      const db = getWorkspaceAdminDb()

      let projectsQuery = db.from('moshe_projects').select('id, name, status, budget').neq('status', 'closed')
      if (projectId) projectsQuery = projectsQuery.eq('id', projectId)

      const { data: projects, error } = await projectsQuery
      if (error) return { error: `שגיאה בשליפת פרויקטים: ${error.message}` }

      // Get overdue buyer payments
      const today = new Date().toISOString().split('T')[0]
      const { data: overdueBuyerPayments } = await db
        .from('moshe_buyer_payments')
        .select('id, amount, due_date, project_id, buyer_name')
        .eq('is_received', false)
        .lt('due_date', today)
        .order('due_date', { ascending: true })
        .limit(10)

      // Get pending project supplier payments
      const { data: pendingSupplierPayments } = await db
        .from('moshe_project_payments')
        .select('id, amount, due_date, project_id, supplier_name')
        .eq('is_paid', false)
        .order('due_date', { ascending: true })
        .limit(10)

      return {
        activeProjectsCount: (projects || []).length,
        projects: (projects || []).map((p) => ({
          id: p.id,
          name: p.name,
          status: p.status,
          budget: p.budget ? `₪${Number(p.budget).toLocaleString('he-IL')}` : null,
        })),
        overdueBuyerPaymentsCount: (overdueBuyerPayments || []).length,
        overdueBuyerPayments: (overdueBuyerPayments || []).map((b) => ({
          buyer: b.buyer_name,
          amount: `₪${Number(b.amount).toLocaleString('he-IL')}`,
          dueDate: b.due_date,
        })),
        pendingSupplierPayments: (pendingSupplierPayments || []).map((s) => ({
          supplier: s.supplier_name,
          amount: `₪${Number(s.amount).toLocaleString('he-IL')}`,
          dueDate: s.due_date,
        })),
      }
    },
  },
]

/**
 * Returns metadata about all tools for UI and documentation.
 */
export function getMcpToolsCatalog() {
  return MCP_TOOLS.map((t) => ({
    name: t.name,
    titleHebrew: t.titleHebrew,
    category: t.category,
    description: t.description,
  }))
}
