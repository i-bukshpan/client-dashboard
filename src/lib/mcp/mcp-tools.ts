import 'server-only'

import { z } from 'zod'
import { getWorkspaceAdminDb } from '@/lib/v2/workspace-dal'
import { searchDriveFiles, getClientFiles, getDriveFileText } from '@/lib/google-drive'
import { getSheetRows, getSpreadsheetMeta, getSheetData } from '@/lib/google-sheets'
import { listClientEmails } from '@/lib/google-gmail'
import { listWorkspaceCalendarEvents } from '@/lib/v2/google-calendar'
import { getInternalFinanceAgentContext } from '@/lib/v2/internal-finance'
import { classifyTaskReminder } from '@/lib/v2/workspace-tasks'
import { buildMosheOrganizedBackup } from '@/lib/moshe/backup-builder'
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
    .select('*')
    .order('name')

  if (error) {
    throw new Error(`Failed to load clients: ${error.message}`)
  }
  return data || []
}

async function loadUnifiedWorkspaceTasks(options?: {
  clientId?: string
  clientName?: string
  status?: 'all' | 'open' | 'completed'
  priority?: 'all' | 'urgent' | 'high' | 'medium' | 'low'
  dueOnOrBefore?: string
}) {
  const db = getWorkspaceAdminDb()
  const clients = await getAllClients()
  const clientMap = new Map(clients.map((c: any) => [c.id, c.name]))
  const unified: Array<{
    id: string
    title: string
    status: string
    priority: string
    dueDate: string | null
    isRecurring: boolean
    recurringPattern: string | null
    clientName: string
    source: string
  }> = []

  // 1. Operations Workspace Sheet ('משימות' tab)
  try {
    const { data: ws } = await db
      .from('v2_operations_workspace')
      .select('workbook_id')
      .eq('id', 'primary')
      .maybeSingle()

    if (ws?.workbook_id) {
      const rows = await getSheetRows(ws.workbook_id, 'משימות')
      rows.forEach((row, idx) => {
        const title = String(row['כותרת'] ?? row['משימה'] ?? row['תיאור'] ?? '').trim()
        if (!title) return
        const rawStatus = String(row['סטטוס'] ?? 'פתוח').trim()
        const isDone =
          rawStatus === 'הושלם' ||
          rawStatus === 'בוצע' ||
          rawStatus.toLowerCase() === 'done' ||
          rawStatus.toLowerCase() === 'completed'
        const rawPriority = String(row['עדיפות'] ?? row['דחיפות'] ?? 'רגיל').trim()
        const dueDate = String(row['מועד יעד'] ?? row['תאריך יעד'] ?? '').trim() || null
        const rowClient = String(row['שם לקוח'] ?? row['לקוח'] ?? 'כללי').trim() || 'כללי'
        const recurrenceRaw = String(row['מחזוריות'] ?? '').trim()
        const reminderState = classifyTaskReminder({
          status: isDone ? 'completed' : 'todo',
          dueAt: dueDate,
          snoozedUntil: null,
        })

        let normPriority = 'medium'
        if (rawPriority.includes('דחוף') || rawPriority.toLowerCase() === 'urgent' || reminderState === 'overdue') {
          normPriority = 'urgent'
        } else if (rawPriority.includes('גבוה') || rawPriority.toLowerCase() === 'high') {
          normPriority = 'high'
        } else if (rawPriority.includes('נמוכ') || rawPriority.toLowerCase() === 'low') {
          normPriority = 'low'
        }

        unified.push({
          id: String(row['מזהה'] || `sheet-task-${idx + 2}`),
          title,
          status: isDone ? 'done' : rawStatus || 'open',
          priority: normPriority,
          dueDate,
          isRecurring: Boolean(recurrenceRaw && recurrenceRaw !== 'none'),
          recurringPattern: recurrenceRaw && recurrenceRaw !== 'none' ? recurrenceRaw : null,
          clientName: rowClient,
          source: 'גיליון משימות תפעול',
        })
      })
    }
  } catch {
    // Sheet optional
  }

  // 2. Recurring Client Routines (v2_client_routines)
  try {
    let rQuery = db.from('v2_client_routines').select('*').eq('is_active', true)
    if (options?.clientId) rQuery = rQuery.eq('client_id', options.clientId)
    const { data: routines } = await rQuery
    for (const r of routines || []) {
      const cName = clientMap.get(r.client_id) || 'כללי'
      unified.push({
        id: r.id,
        title: r.title,
        status: 'open',
        priority: 'medium',
        dueDate: r.day_of_month ? `יום ${r.day_of_month} בחודש` : null,
        isRecurring: true,
        recurringPattern: r.frequency || 'monthly',
        clientName: cName,
        source: 'שגרות מחזוריות',
      })
    }
  } catch {
    // Table optional
  }

  // 3. Legacy / Direct DB tasks table (select('*') avoids missing column errors)
  try {
    let tQuery = db.from('tasks').select('*')
    if (options?.clientId) tQuery = tQuery.eq('client_id', options.clientId)
    const { data: dbTasks } = await tQuery.limit(50)
    for (const t of dbTasks || []) {
      const isDone = t.status === 'done' || t.status === 'completed' || t.is_completed === true
      unified.push({
        id: String(t.id),
        title: t.title || t.description || 'משימה',
        status: isDone ? 'done' : t.status || 'open',
        priority: t.priority || 'medium',
        dueDate: t.due_date || null,
        isRecurring: Boolean(t.is_recurring),
        recurringPattern: t.recurring_pattern || null,
        clientName: (t.client_id && clientMap.get(t.client_id)) || 'כללי',
        source: 'משימות מערכת',
      })
    }
  } catch {
    // Table optional
  }

  // Filter results
  return unified.filter((item) => {
    if (options?.clientName) {
      const cleanFilter = options.clientName.toLowerCase().trim()
      const cleanItemClient = item.clientName.toLowerCase().trim()
      if (!cleanItemClient.includes(cleanFilter) && !cleanFilter.includes(cleanItemClient)) {
        return false
      }
    }
    if (options?.status === 'open' && item.status === 'done') return false
    if (options?.status === 'completed' && item.status !== 'done') return false
    if (options?.priority && options.priority !== 'all' && item.priority !== options.priority) return false
    if (options?.dueOnOrBefore && item.dueDate && /^\d{4}-\d{2}-\d{2}/.test(item.dueDate)) {
      if (item.dueDate.slice(0, 10) > options.dueOnOrBefore) return false
    }
    return true
  })
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
        .select('*')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false })
        .limit(30)

      if (error) {
        return { error: `שגיאה בשליפת מסמכים: ${error.message}` }
      }

      const cleanQ = query.trim().toLowerCase()
      const matched = (docs || []).filter((d: any) => {
        if (!cleanQ) return true
        const nameMatch = d.file_name?.toLowerCase().includes(cleanQ)
        const ocrMatch = d.ocr_text?.toLowerCase().includes(cleanQ)
        const typeMatch = d.file_type?.toLowerCase().includes(cleanQ)
        const summaryMatch = d.summary?.toLowerCase().includes(cleanQ)
        return nameMatch || ocrMatch || typeMatch || summaryMatch
      })

      return {
        clientName: client.name,
        totalFound: matched.length,
        documents: matched.map((d: any) => ({
          id: d.id,
          fileName: d.file_name,
          fileType: d.file_type || d.mime_type || null,
          ocrStatus: d.ocr_status,
          amount: d.amount ?? null,
          fileDate: d.file_date ?? null,
          driveUrl: d.drive_url ?? null,
          textExcerpt: d.ocr_text ? d.ocr_text.slice(0, 500) + (d.ocr_text.length > 500 ? '...' : '') : null,
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

      // Fetch open tasks & routines for client via unified loader
      const openTasks = await loadUnifiedWorkspaceTasks({
        clientId: client.id,
        clientName: client.name,
        status: 'open',
      })

      // Fetch recent client documents safely
      let recentDocuments: any[] = []
      try {
        const { data: docs } = await db
          .from('v2_client_documents')
          .select('*')
          .eq('client_id', client.id)
          .order('created_at', { ascending: false })
          .limit(5)
        recentDocuments = (docs || []).map((d: any) => ({
          id: d.id,
          fileName: d.file_name,
          fileType: d.file_type,
          ocrStatus: d.ocr_status,
          amount: d.amount ?? null,
          createdAt: d.created_at,
        }))
      } catch {
        // Optional
      }

      // Fetch upcoming calendar events matching client
      let upcomingAppointments: any[] = []
      try {
        const now = new Date()
        const future = new Date(now.getTime() + 14 * 86400000)
        const calResult = await listWorkspaceCalendarEvents({
          timeMin: now.toISOString(),
          timeMax: future.toISOString(),
        })
        const cleanName = client.name.toLowerCase()
        upcomingAppointments = (calResult.events || [])
          .filter(
            (ev: any) =>
              ev.title?.toLowerCase().includes(cleanName) ||
              ev.description?.toLowerCase().includes(cleanName)
          )
          .slice(0, 5)
      } catch {
        // Optional
      }

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
        openTasks: openTasks.slice(0, 15),
        recentDocuments,
        upcomingAppointments,
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
      let clientId: string | undefined
      let clientName: string | undefined

      if (clientIdOrName) {
        const clients = await getAllClients()
        const client = findClient(clients, clientIdOrName)
        if (client) {
          clientId = client.id
          clientName = client.name
        } else {
          clientName = clientIdOrName
        }
      }

      const tasks = await loadUnifiedWorkspaceTasks({
        clientId,
        clientName,
        status: status || 'open',
        priority: priority || 'all',
      })

      return {
        total: tasks.length,
        tasks: tasks.slice(0, 50),
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
      const startIso = `${targetDate}T00:00:00Z`
      const endIso = `${targetDate}T23:59:59Z`

      let appointments: any[] = []
      try {
        const calResult = await listWorkspaceCalendarEvents({
          timeMin: startIso,
          timeMax: endIso,
        })
        appointments = (calResult.events || []).map((ev: any) => ({
          title: ev.title,
          start: ev.start,
          end: ev.end,
          location: ev.location || null,
          source: 'Google Calendar',
        }))
      } catch {
        // Calendar optional
      }

      // Also check Moshe calendar events for that date
      try {
        const db = getWorkspaceAdminDb()
        const { data: mosheEvents } = await db
          .from('moshe_calendar_events')
          .select('*')
          .gte('start_time', startIso)
          .lte('start_time', endIso)
        for (const me of mosheEvents || []) {
          appointments.push({
            title: me.title,
            start: me.start_time,
            end: me.end_time,
            location: me.notes || null,
            source: 'יומן פורטל משה',
          })
        }
      } catch {
        // Optional
      }

      const pendingTasksDue = await loadUnifiedWorkspaceTasks({
        status: 'open',
        dueOnOrBefore: targetDate,
      })

      return {
        date: targetDate,
        totalAppointments: appointments.length,
        appointments,
        pendingTasksDue: pendingTasksDue.slice(0, 30),
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

      let mosheEvents: any[] = []
      try {
        const db = getWorkspaceAdminDb()
        const { data } = await db
          .from('moshe_calendar_events')
          .select('*')
          .gte('start_time', now.toISOString())
          .lte('start_time', future.toISOString())
          .order('start_time', { ascending: true })
        mosheEvents = data || []
      } catch {
        // Optional
      }

      return {
        daysAhead: daysAhead || 7,
        totalAppointments: googleEvents.length + mosheEvents.length,
        googleCalendarEvents: googleEvents.map((g) => ({
          title: g.title,
          start: g.start,
          end: g.end,
          location: g.location,
        })),
        mosheCalendarEvents: mosheEvents.map((m: any) => ({
          id: m.id,
          title: m.title,
          start: m.start_time,
          end: m.end_time,
          type: m.type,
          notes: m.notes,
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
    description: 'סיכום מקיף של פרויקטי הנדל"ן של משה: פרויקטים, קונים ויתרות, לוחות תשלומים ותנועות בפועל, הלוואות, שותפים והתראות איחורים.',
    schema: z.object({
      projectId: z.string().optional().describe('אופציונלי: מזהה פרויקט ספציפי או שם פרויקט'),
    }),
    execute: async ({ projectId }) => {
      const backup = await buildMosheOrganizedBackup('mcp-crm')
      const today = new Date().toISOString().split('T')[0]

      let filteredProjects = backup.organized_projects
      if (projectId && projectId.trim()) {
        const q = projectId.trim().toLowerCase()
        filteredProjects = filteredProjects.filter(
          (p) => p.id === q || p.name.toLowerCase().includes(q)
        )
      }

      const overdueBuyerPayments: Array<{
        projectId: string
        projectName: string
        buyerId: string
        buyerName: string
        unit: string
        amount: number
        formattedAmount: string
        dueDate: string
        notes: string
      }> = []

      const pendingSupplierPayments: Array<{
        projectId: string
        projectName: string
        amount: number
        formattedAmount: string
        dueDate: string | null
        notes: string
      }> = []

      for (const proj of filteredProjects) {
        for (const buyer of proj.buyers) {
          if (buyer.remaining_balance > 0) {
            for (const sp of buyer.schedule_payments) {
              if (sp.due_date && sp.due_date < today) {
                overdueBuyerPayments.push({
                  projectId: proj.id,
                  projectName: proj.name,
                  buyerId: buyer.id,
                  buyerName: buyer.name,
                  unit: buyer.unit_description,
                  amount: sp.amount,
                  formattedAmount: `₪${Number(sp.amount).toLocaleString('he-IL')}`,
                  dueDate: sp.due_date,
                  notes: sp.notes,
                })
              }
            }
          }
        }

        if (proj.kpis.remainingSupplierPayments > 0) {
          for (const sp of proj.supplier_schedule_payments) {
            pendingSupplierPayments.push({
              projectId: proj.id,
              projectName: proj.name,
              amount: sp.amount,
              formattedAmount: `₪${Number(sp.amount).toLocaleString('he-IL')}`,
              dueDate: sp.due_date || null,
              notes: sp.notes || 'תשלום בלוח פרויקט',
            })
          }
        }
      }

      return {
        activeProjectsCount: backup.macro_summary.activeProjectsCount,
        totalProjectsCount: filteredProjects.length,
        macroSummary: backup.macro_summary,
        projects: filteredProjects.map((p) => ({
          id: p.id,
          name: p.name,
          status: p.status,
          statusHebrew: p.status_hebrew,
          address: p.address,
          contactName: p.contact_name,
          contactPhone: p.contact_phone,
          totalProjectCost: p.total_project_cost,
          formattedBudget: p.total_project_cost ? `₪${Number(p.total_project_cost).toLocaleString('he-IL')}` : null,
          kpis: p.kpis,
          buyersCount: p.buyers.length,
          buyers: p.buyers.map((b) => ({
            id: b.id,
            name: b.name,
            phone: b.phone,
            unit: b.unit_description,
            contractTotal: b.contract_total,
            scheduledTotal: b.scheduled_total,
            receivedActual: b.received_actual,
            remainingBalance: b.remaining_balance,
            schedulePayments: b.schedule_payments,
            actualMovements: b.actual_movements,
          })),
          supplierSchedulePayments: p.supplier_schedule_payments,
          supplierActualMovements: p.supplier_actual_movements,
          loans: p.loans,
          partners: p.partners,
          neighbors: p.neighbors,
        })),
        overdueBuyerPaymentsCount: overdueBuyerPayments.length,
        overdueBuyerPayments: overdueBuyerPayments.slice(0, 25),
        pendingSupplierPaymentsCount: pendingSupplierPayments.length,
        pendingSupplierPayments: pendingSupplierPayments.slice(0, 25),
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
