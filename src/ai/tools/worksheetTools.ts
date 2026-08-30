/**
 * src/ai/tools/worksheetTools.ts
 *
 * AI SDK v6 tool definitions for the Nehemiah OS v2 Workspace Agent.
 * These tools use the `tool()` helper from `ai` with Zod schemas.
 *
 * Tools defined here:
 *   - get_spreadsheet_info       → lists all available sheet tabs in the connected spreadsheet
 *   - read_sheet_data            → reads all rows from a sheet tab
 *   - append_row                 → adds a new row to a sheet tab
 *   - create_new_sheet_structure → creates a brand-new Google Spreadsheet
 *   - update_dashboard_layout    → writes a new DashboardConfig to Supabase
 *   - get_drive_files            → lists files in the client's Drive folder
 */

import { tool } from 'ai'
import { z } from 'zod'
import {
  getSheetData,
  getSheetRows,
  getSpreadsheetMeta,
  appendRows,
  createSpreadsheet,
  formatRange,
} from '@/lib/google-sheets'
import { getClientFiles } from '@/lib/google-drive'
import type { DashboardConfig, DashboardWidget } from '@/types/dashboard'
import { getWorkspaceAdminDb, getWorkspaceClient } from '@/lib/v2/workspace-dal'
import {
  listClientEmails,
  getEmailThread,
  sendNewClientEmail,
  replyToEmailThread,
} from '@/lib/google-gmail'
import {
  listWorkspaceTasks,
  createWorkspaceTask,
  updateWorkspaceTask,
} from '@/lib/v2/workspace-tasks'
import {
  listWorkspaceCalendarEvents,
  createWorkspaceCalendarEvent,
} from '@/lib/v2/google-calendar'
import {
  addClientLivingMemory,
  getClientLivingMemory,
  formatLivingMemoryForPrompt,
} from '@/lib/v2/agent-memory'
import { saveClientContext } from '@/lib/v2/client-context'
import { clientContextSchema } from '@/lib/v2/client-context-schema'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

// ── Internal admin DB client ───────────────────────────────────────────────────

// ── Zod sub-schemas ────────────────────────────────────────────────────────────

const WidgetPositionSchema = z
  .object({
    col: z.number().min(0).max(3).optional().describe('Zero-based column index (0–3)'),
    row: z.number().min(0).optional().describe('Zero-based row index'),
    w: z.number().min(1).max(4).optional().describe('Column span (1–4)'),
    h: z.number().min(1).max(4).optional().describe('Row span (1–4)'),
  })
  .optional()

const WidgetFilterSchema = z.object({
  column: z.string().describe('Column name to filter on, e.g. "סוג" or "קטגוריה"'),
  operator: z.enum(['equals', 'not_equals', 'contains', 'greater_than', 'less_than']).describe('Filter operator'),
  value: z.union([z.string(), z.number()]).describe('Value to match against, e.g. "הכנסה" or "הוצאה"'),
})

const NetFormulaSchema = z.object({
  column: z.string().describe('Numeric column to calculate on, e.g. "סכום"'),
  type_column: z.string().describe('Column distinguishing types, e.g. "סוג" or "קטגוריה"'),
  positive_value: z.string().describe('Value for positive addition, e.g. "הכנסה"'),
  negative_value: z.string().describe('Value for subtraction, e.g. "הוצאה"'),
})

const WidgetSchema = z.object({
  id: z.string().optional().describe('Unique widget ID, e.g. "widget-income-bar"'),
  type: z
    .enum(['bar_chart', 'line_chart', 'pie_chart', 'stat_card', 'data_table'])
    .describe('Widget visualization type'),
  title: z.string().describe('Widget title displayed to the user (in Hebrew, e.g. "סה״כ הכנסות" or "רווח נקי")'),
  sheet: z.string().describe('Name of the Google Sheet tab to read data from, e.g. "תנועות" or "הכנסות"'),
  tab: z.string().optional().describe('Internal dashboard tab name, e.g. "ראשי", "ספקים", "סוכנים", "משכורות", "הזמנות"'),
  position: WidgetPositionSchema,
  color: z.string().optional().describe('Hex color or Tailwind token for the widget accent'),

  // Calculations & Filters
  aggregation: z.enum(['sum', 'count', 'avg', 'min', 'max', 'net_diff']).optional().describe('Calculation type for stat cards'),
  net_formula: NetFormulaSchema.optional().describe('Formula for Net Profit (רווח נקי) = positive sum minus negative sum'),
  filters: z.array(WidgetFilterSchema).optional().describe('List of filters to apply to this widget data (e.g. only where סוג = "הכנסה")'),
  sort_by: z.string().optional().describe('Column name to sort data by, e.g. "תאריך" or "סכום"'),
  sort_order: z.enum(['asc', 'desc']).optional().describe('Sort direction: "asc" or "desc"'),
  date_column: z.string().optional().describe('Column containing dates for date-filtering and timeline grouping'),

  // Chart configuration
  x_column: z.string().optional().describe('Column name for the X axis (bar/line charts, e.g. "תאריך" or "חודש")'),
  y_column: z.string().optional().describe('Column name for the Y axis / numeric value, e.g. "סכום"'),
  label_column: z.string().optional().describe('Column name for pie chart labels, e.g. "קטגוריה" or "ספק"'),
  value_column: z.string().optional().describe('Column name for pie chart values, e.g. "סכום"'),

  // Stat card configuration
  icon: z.string().optional().describe('Lucide icon name (e.g. "trending-up", "wallet", "dollar-sign", "credit-card")'),
  card_color: z
    .enum(['green', 'red', 'blue', 'amber', 'purple'])
    .optional()
    .describe('Color theme for stat cards'),
  prefix: z.string().optional().describe('Prefix for numbers, e.g. "₪"'),
  suffix: z.string().optional().describe('Suffix for numbers, e.g. "%"'),

  // Data table configuration
  columns: z.array(z.string()).optional().describe('Ordered columns to display in data_table'),
  max_rows: z.number().optional().describe('Max rows to show in data_table (e.g. 10)'),
})

const SheetTemplateSchema = z.object({
  title: z.string().describe('Sheet tab name (can be Hebrew, e.g. "הכנסות")'),
  headers: z
    .array(z.string())
    .min(1)
    .describe('Column header names for row 1 (e.g. ["תאריך", "קטגוריה", "סכום", "הערות"])'),
})

// ── Helper: get client record ──────────────────────────────────────────────────

async function getClientRecord(clientId: string) {
  return getWorkspaceClient(clientId)
}

// ── Tool: get_spreadsheet_info ────────────────────────────────────────────────

export function makeGetSpreadsheetInfoTool(clientId: string) {
  return tool({
    description:
      'Fetches the list of all sheet tabs and structure info in the client\'s connected Google Spreadsheet. ' +
      'ALWAYS call this tool first before reading or analyzing sheet data to automatically discover the existing tabs without asking the user.',
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const client = await getClientRecord(clientId)
        if (!client.google_sheet_id) {
          return {
            success: false,
            error: 'This client has no linked Google Sheet yet.',
            has_sheet: false,
          }
        }

        const tabs = await getSpreadsheetMeta(client.google_sheet_id)
        return {
          success: true,
          has_sheet: true,
          spreadsheet_id: client.google_sheet_id,
          tabs: tabs.map((t) => ({
            title: t.title,
            sheetId: t.sheetId,
            rowCount: t.rowCount,
            columnCount: t.columnCount,
          })),
          tab_names: tabs.map((t) => t.title),
        }
      } catch (error: unknown) {
        return { success: false, error: errorMessage(error) }
      }
    },
  })
}

// ── Tool: read_sheet_data ──────────────────────────────────────────────────────

export function makeReadSheetDataTool(clientId: string) {
  return tool({
    description:
      'Reads all rows from a specific sheet tab in the client\'s Google Spreadsheet. ' +
      'Returns the data as a list of objects keyed by the header row. ' +
      'Use this to answer any question about the client\'s stored data.',
    inputSchema: z.object({
      sheet_name: z
        .string()
        .describe(
          'The exact name of the sheet tab to read (e.g. "הכנסות"). ' +
          'Use get_spreadsheet_info to see all available tab names first.'
        ),
    }),
    execute: async ({ sheet_name }: { sheet_name: string }) => {
      try {
        const client = await getClientRecord(clientId)
        if (!client.google_sheet_id) {
          return {
            success: false,
            error: 'This client has no linked Google Sheet yet. You must first call create_new_sheet_structure.',
          }
        }

        const [rawGrid, rows, tabs] = await Promise.all([
          getSheetData(client.google_sheet_id, formatRange(sheet_name, 'A1:Z50')),
          getSheetRows(client.google_sheet_id, sheet_name),
          getSpreadsheetMeta(client.google_sheet_id),
        ])

        // Format spatial 2D grid for non-standard dashboard sheets (e.g. multi-table / summary matrices)
        const gridPreview = rawGrid
          .filter((r) => r.some((c) => c && c.trim() !== ''))
          .slice(0, 35)
          .map((row, rIdx) => {
            const cells = row.map((c) => (c ? c.trim() : '-')).join(' | ')
            return `Row ${rIdx + 1}: ${cells}`
          })
          .join('\n')

        return {
          success: true,
          sheet: sheet_name,
          row_count: rows.length,
          available_tabs: tabs.map((t) => t.title),
          spatial_grid_preview: gridPreview,
          data: rows.slice(0, 60), // optimal sample payload for fast multi-step batching
        }
      } catch (error: unknown) {
        return { success: false, error: errorMessage(error) }
      }
    },
  })
}

// ── Tool: append_row ───────────────────────────────────────────────────────────

export function makeAppendRowTool(clientId: string) {
  return tool({
    description:
      'Appends a single new row to a specific sheet tab in the client\'s Google Spreadsheet. ' +
      'The values array must be in the same column order as the sheet\'s header row. ' +
      'Always confirm the data with the user before calling this tool.',
    inputSchema: z.object({
      sheet_name: z.string().describe('The exact name of the sheet tab to write to'),
      values: z
        .array(z.string())
        .min(1)
        .describe(
          'An ordered array of cell values matching the header columns. ' +
          'Use empty string "" for blank cells.'
        ),
    }),
    execute: async ({ sheet_name, values }: { sheet_name: string; values: string[] }) => {
      try {
        const client = await getClientRecord(clientId)
        if (!client.google_sheet_id) {
          return { success: false, error: 'No sheet linked to this client.' }
        }

        await appendRows(client.google_sheet_id, sheet_name, [values])
        return {
          success: true,
          message: `שורה נוספה בהצלחה לגיליון "${sheet_name}"`,
          appended_values: values,
        }
      } catch (error: unknown) {
        return { success: false, error: errorMessage(error) }
      }
    },
  })
}

// ── Tool: create_new_sheet_structure ──────────────────────────────────────────

export function makeCreateNewSheetStructureTool(clientId: string) {
  return tool({
    description:
      'Creates a brand-new Google Spreadsheet for this client with the agreed tab/column structure. ' +
      'IMPORTANT: Only call this tool AFTER you have had a full Q&A conversation with Nehemiah ' +
      'to understand the client\'s business, and after Nehemiah has explicitly approved the structure. ' +
      'The spreadsheet will be styled with bold headers and shared with the Service Account. ' +
      'After creation, the spreadsheet ID is automatically saved to this client\'s record in Supabase.',
    inputSchema: z.object({
      spreadsheet_title: z
        .string()
        .describe('The name for the new spreadsheet, e.g. "דוד כהן — ניהול עסקי"'),
      sheets: z
        .array(SheetTemplateSchema)
        .min(1)
        .describe(
          'The list of sheet tabs to create. Each tab has a title and an ordered list of column headers.'
        ),
    }),
    execute: async ({
      spreadsheet_title,
      sheets,
    }: {
      spreadsheet_title: string
      sheets: Array<{ title: string; headers: string[] }>
    }) => {
      try {
        await getClientRecord(clientId)

        // Create the spreadsheet
        const spreadsheetId = await createSpreadsheet(spreadsheet_title, sheets)

        // Save the ID to Supabase
        const { error } = await getWorkspaceAdminDb()
          .from('clients')
          .update({ google_sheet_id: spreadsheetId })
          .eq('id', clientId)

        if (error) {
          return {
            success: false,
            error: `Spreadsheet created (ID: ${spreadsheetId}) but failed to save to DB: ${error.message}`,
            spreadsheet_id: spreadsheetId,
          }
        }

        const sheetsUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`

        return {
          success: true,
          spreadsheet_id: spreadsheetId,
          spreadsheet_url: sheetsUrl,
          sheets_created: sheets.map((s) => ({ title: s.title, columns: s.headers.length })),
          message: `✅ הגיליון נוצר בהצלחה! "${spreadsheet_title}" עם ${sheets.length} לשוניות. הקישור: ${sheetsUrl}`,
        }
      } catch (error: unknown) {
        return { success: false, error: errorMessage(error) }
      }
    },
  })
}

// ── Tool: update_dashboard_layout ─────────────────────────────────────────────

export function makeUpdateDashboardLayoutTool(clientId: string) {
  return tool({
    description:
      'Updates the dynamic dashboard layout for this client. ' +
      'Call this when Nehemiah asks to visualize data, e.g. "show me a bar chart of income by month". ' +
      'You can add, remove, or rearrange widgets. The React UI re-renders automatically. ' +
      'When adding a chart widget, make sure the referenced sheet_name and column names actually exist in the sheet.',
    inputSchema: z.object({
      widgets: z
        .array(WidgetSchema)
        .describe(
          'The complete, ordered list of dashboard widgets. ' +
          'This REPLACES the entire existing dashboard — include all widgets you want to keep.'
        ),
    }),
    execute: async ({ widgets }: { widgets: Array<z.infer<typeof WidgetSchema>> }) => {
      try {
        const formattedWidgets: DashboardWidget[] = widgets.map((w, index) => ({
          ...w,
          id: w.id || `widget-${w.type}-${index + 1}`,
          position: {
            col: w.position?.col ?? (index % 2) * 2,
            row: w.position?.row ?? Math.floor(index / 2) * 2,
            w: w.position?.w ?? (w.type === 'stat_card' ? 1 : 2),
            h: w.position?.h ?? (w.type === 'stat_card' ? 1 : 2),
          },
        }))

        const config: DashboardConfig = { version: 1, widgets: formattedWidgets }

        const { error } = await getWorkspaceAdminDb()
          .from('clients')
          .update({ dashboard_config_json: config })
          .eq('id', clientId)

        if (error) return { success: false, error: error.message }

        try {
          const { revalidatePath } = await import('next/cache')
          revalidatePath(`/workspace/clients/${clientId}`)
        } catch {
          // ignore outside request context
        }

        return {
          success: true,
          widget_count: formattedWidgets.length,
          message: `✅ הדשבורד עודכן בהצלחה עם ${formattedWidgets.length} ווידג'טים! עבור ללשונית Dashboard לצפייה.`,
        }
      } catch (error: unknown) {
        return { success: false, error: errorMessage(error) }
      }
    },
  })
}

// ── Tool: get_drive_files ──────────────────────────────────────────────────────

export function makeGetDriveFilesTool(clientId: string) {
  return tool({
    description:
      "Lists files in the client's Google Drive folder. " +
      'Use this to see what documents exist for this client, or to confirm a file was uploaded.',
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const client = await getWorkspaceClient(clientId)
        if (!client.drive_folder_id) {
          return { success: false, error: 'No Drive folder linked to this client.' }
        }

        const files = await getClientFiles(client.drive_folder_id)
        return {
          success: true,
          file_count: files.length,
          folder_url: `https://drive.google.com/drive/folders/${client.drive_folder_id}`,
          files: files.map((f) => ({
            name: f.name,
            type: f.mimeType,
            modified: f.modifiedTime,
            url: f.webViewLink,
          })),
        }
      } catch (error: unknown) {
        return { success: false, error: errorMessage(error) }
      }
    },
  })
}

// ── Tool: remember_client_fact (Living Memory) ─────────────────────────────────

export function makeRememberClientFactTool(clientId: string) {
  return tool({
    description:
      'Permanently memorizes an important fact, decision, client preference, financial figure, or operational note into the living memory database. ' +
      'Call this whenever Nehemiah states an important instruction, when you discover a key milestone, or when an agreement/preference is established.',
    inputSchema: z.object({
      category: z
        .enum(['insight', 'decision', 'preference', 'financial_fact', 'contact', 'note'])
        .describe('Category of the memory item'),
      content: z.string().describe('Clear, concise description of the fact/decision to remember in Hebrew'),
      importance: z
        .enum(['low', 'medium', 'high'])
        .default('medium')
        .describe('Importance level (high for critical decisions, bank details, tax rates)'),
    }),
    execute: async ({ category, content, importance }: { category: any; content: string; importance?: any }) => {
      try {
        const res = await addClientLivingMemory(clientId, {
          category,
          content,
          importance: importance || 'medium',
          source: 'chat',
        })
        if (!res.success) return { success: false, error: res.error }
        return {
          success: true,
          message: `🧠 נשמר בזיכרון החי של הסוכן (${category}): "${content}"`,
        }
      } catch (error: unknown) {
        return { success: false, error: errorMessage(error) }
      }
    },
  })
}

// ── Tool: get_client_living_memory ─────────────────────────────────────────────

export function makeGetClientLivingMemoryTool(clientId: string) {
  return tool({
    description:
      'Retrieves the accumulated long-term living memory for this client (decisions, preferences, financial facts, key notes).',
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const memories = await getClientLivingMemory(clientId, 40)
        return {
          success: true,
          count: memories.length,
          formatted: formatLivingMemoryForPrompt(memories),
          raw: memories,
        }
      } catch (error: unknown) {
        return { success: false, error: errorMessage(error) }
      }
    },
  })
}

// ── Tool: update_client_profile (Refine Context) ───────────────────────────────

export function makeUpdateClientProfileTool(clientId: string) {
  return tool({
    description:
      'Updates or refines the core client context profile (business description, stakeholders, active goals, key metrics). ' +
      'Use this to keep the client profile accurate as new information comes in.',
    inputSchema: clientContextSchema,
    execute: async (input) => {
      try {
        await saveClientContext(clientId, input)
        return {
          success: true,
          message: '✅ הפרופיל העסקי עודכן בהצלחה במסד הנתונים.',
        }
      } catch (error: unknown) {
        return { success: false, error: errorMessage(error) }
      }
    },
  })
}

// ── Tool: search_client_emails ─────────────────────────────────────────────────

export function makeSearchClientEmailsTool(clientId: string) {
  return tool({
    description:
      "Searches and inspects the client's linked Gmail correspondence. " +
      'Use this when Nehemiah asks about email status, recent messages, unread inquiries, or specific email topics.',
    inputSchema: z.object({
      query: z.string().optional().describe('Free text search query (e.g. "חשבונית", "הסכם", "אישור", "דוח")'),
      unreadOnly: z.boolean().optional().describe('Set to true to only find unread messages waiting for reply'),
      maxResults: z.number().optional().default(15).describe('Max email threads to return'),
    }),
    execute: async ({ query, unreadOnly, maxResults }: { query?: string; unreadOnly?: boolean; maxResults?: number }) => {
      try {
        const client = await getWorkspaceClient(clientId)
        const result = await listClientEmails({
          labelName: client.gmail_label,
          clientEmail: client.email,
          query: query || '',
          unreadOnly: unreadOnly || false,
          maxResults: maxResults || 15,
        })

        return {
          success: true,
          label_used: client.gmail_label || `email: ${client.email}`,
          total_estimate: result.totalEstimate,
          unread_count: result.unreadCount,
          threads: result.threads.map((t) => ({
            threadId: t.threadId,
            subject: t.subject,
            from: `${t.from.name} <${t.from.email}>`,
            date: t.date,
            isUnread: t.isUnread,
            messageCount: t.messageCount,
            snippet: t.snippet,
            hasAttachments: t.hasAttachments,
          })),
        }
      } catch (error: unknown) {
        return { success: false, error: errorMessage(error) }
      }
    },
  })
}

// ── Tool: get_email_thread_details ────────────────────────────────────────────

export function makeGetEmailThreadDetailsTool(clientId: string) {
  return tool({
    description:
      'Retrieves the full messages and exact text content of a specific email thread by its threadId.',
    inputSchema: z.object({
      threadId: z.string().describe('The threadId from search_client_emails'),
    }),
    execute: async ({ threadId }: { threadId: string }) => {
      try {
        const thread = await getEmailThread(threadId)
        return {
          success: true,
          subject: thread.subject,
          isUnread: thread.isUnread,
          messages: thread.messages.map((m) => ({
            id: m.id,
            from: `${m.from.name} <${m.from.email}>`,
            to: m.to,
            date: m.date,
            bodyText: m.bodyText || m.snippet,
            attachments: m.attachments.map((a) => a.filename),
          })),
        }
      } catch (error: unknown) {
        return { success: false, error: errorMessage(error) }
      }
    },
  })
}

// ── Tool: send_or_reply_email ─────────────────────────────────────────────────

export function makeSendOrReplyEmailTool(clientId: string) {
  return tool({
    description:
      "Sends a new email or replies to an ongoing thread on Nehemiah's behalf from his Gmail account. " +
      'Always confirm with Nehemiah the recipient and body before executing.',
    inputSchema: z.object({
      to: z.string().describe('Recipient email address'),
      subject: z.string().describe('Email subject'),
      bodyText: z.string().describe('Email body content in Hebrew'),
      threadId: z.string().optional().describe('If replying in a thread, provide the threadId'),
      inReplyToHeader: z.string().optional().describe('Message-ID header for reply threading'),
    }),
    execute: async ({ to, subject, bodyText, threadId, inReplyToHeader }: { to: string; subject: string; bodyText: string; threadId?: string; inReplyToHeader?: string }) => {
      try {
        if (threadId) {
          const res = await replyToEmailThread({ threadId, to, subject, bodyText, inReplyToHeader })
          return { success: true, message: `✉️ המענה נשלח בהצלחה בשרשור אל ${to}!`, messageId: res.id }
        }
        const res = await sendNewClientEmail({ to, subject, bodyText })
        return { success: true, message: `✉️ המייל החדש נשלח בהצלחה אל ${to}!`, messageId: res.id }
      } catch (error: unknown) {
        return { success: false, error: errorMessage(error) }
      }
    },
  })
}

// ── Tool: get_client_tasks ─────────────────────────────────────────────────────

export function makeGetClientTasksTool(clientId: string) {
  return tool({
    description:
      'Retrieves the list of tasks for this client from the Nehemiah Operations task board.',
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const tasks = await listWorkspaceTasks(clientId)
        return {
          success: true,
          task_count: tasks.length,
          tasks: tasks.map((t) => ({
            id: t.id,
            title: t.title,
            description: t.description,
            status: t.status,
            priority: t.priority,
            dueAt: t.dueAt,
            reminderState: t.reminderState,
          })),
        }
      } catch (error: unknown) {
        return { success: false, error: errorMessage(error) }
      }
    },
  })
}

// ── Tool: create_or_update_task ───────────────────────────────────────────────

export function makeCreateOrUpdateTaskTool(clientId: string) {
  return tool({
    description:
      'Creates a new task or updates an existing task for this client in the Operations workspace.',
    inputSchema: z.object({
      taskId: z.string().optional().describe('Provide if updating an existing task'),
      title: z.string().describe('Task title in Hebrew'),
      description: z.string().optional().describe('Task description or notes'),
      status: z.enum(['todo', 'in_progress', 'completed', 'cancelled']).optional().default('todo'),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
      dueAt: z.string().optional().describe('Due date (ISO format or YYYY-MM-DD)'),
    }),
    execute: async (input: { taskId?: string; title: string; description?: string; status?: any; priority?: any; dueAt?: string }) => {
      try {
        if (input.taskId) {
          const task = await updateWorkspaceTask(input.taskId, {
            title: input.title,
            description: input.description,
            status: input.status,
            priority: input.priority,
            dueAt: input.dueAt,
          })
          return { success: true, message: `✅ משימה "${task.title}" עודכנה בהצלחה (סטטוס: ${task.status})`, task }
        }
        const task = await createWorkspaceTask({
          clientId,
          title: input.title,
          description: input.description,
          status: input.status || 'todo',
          priority: input.priority || 'medium',
          dueAt: input.dueAt,
        })
        return { success: true, message: `✅ משימה חדשה נוצרה בהצלחה: "${task.title}"`, task }
      } catch (error: unknown) {
        return { success: false, error: errorMessage(error) }
      }
    },
  })
}

// ── Tool: get_client_calendar_events ──────────────────────────────────────────

export function makeGetClientCalendarEventsTool(clientId: string) {
  return tool({
    description:
      "Fetches meetings and appointments related to this client from Google Calendar.",
    inputSchema: z.object({
      daysBack: z.number().optional().default(14).describe('How many days into the past to check'),
      daysForward: z.number().optional().default(30).describe('How many days into the future to check'),
    }),
    execute: async ({ daysBack = 14, daysForward = 30 }: { daysBack?: number; daysForward?: number }) => {
      try {
        const client = await getWorkspaceClient(clientId)
        const timeMin = new Date(Date.now() - daysBack * 86400000).toISOString()
        const timeMax = new Date(Date.now() + daysForward * 86400000).toISOString()

        const res = await listWorkspaceCalendarEvents({
          clientId,
          timeMin,
          timeMax,
        })

        return {
          success: true,
          event_count: res.events.length,
          events: res.events.map((e) => ({
            id: e.id,
            title: e.title,
            description: e.description,
            start: e.start,
            end: e.end,
            allDay: e.allDay,
            location: e.location,
            status: e.status,
          })),
        }
      } catch (error: unknown) {
        return { success: false, error: errorMessage(error) }
      }
    },
  })
}

// ── Tool: schedule_calendar_meeting ───────────────────────────────────────────

export function makeScheduleCalendarMeetingTool(clientId: string) {
  return tool({
    description:
      'Schedules a new meeting or reminder event in Google Calendar linked to this client.',
    inputSchema: z.object({
      title: z.string().describe('Event title in Hebrew, e.g. "פגישת סגירת רבעון - נסמארט"'),
      description: z.string().optional().describe('Agenda or details'),
      start: z.string().describe('Start time in ISO format, e.g. "2026-09-02T10:00:00+03:00"'),
      end: z.string().describe('End time in ISO format, e.g. "2026-09-02T11:00:00+03:00"'),
      location: z.string().optional().describe('Meeting location or Zoom/Meet link'),
      allDay: z.boolean().optional().default(false),
    }),
    execute: async (input: { title: string; description?: string; start: string; end: string; location?: string; allDay?: boolean }) => {
      try {
        const event = await createWorkspaceCalendarEvent({
          clientId,
          title: input.title,
          description: input.description,
          start: input.start,
          end: input.end,
          location: input.location,
          allDay: input.allDay || false,
        })
        return {
          success: true,
          message: `📅 הפגישה נוצרה בהצלחה ביומן: "${event.title}" בתאריך ${new Date(event.start).toLocaleString('he-IL')}`,
          eventId: event.id,
        }
      } catch (error: unknown) {
        return { success: false, error: errorMessage(error) }
      }
    },
  })
}

// ── Tool: search_client_documents (RAG & OCR) ──────────────────────────────────

export function makeSearchClientDocumentsTool(clientId: string) {
  return tool({
    description:
      "Performs a deep semantic search across the client's uploaded documents, contracts, OCR scans, invoices, and reports.",
    inputSchema: z.object({
      query: z.string().describe('Search query, e.g. "תנאי תשלום", "סעיף ביטול", "סכום חשבונית אחרונה"'),
      fileType: z.enum(['receipt', 'invoice', 'contract', 'report', 'other']).optional(),
    }),
    execute: async ({ query, fileType }: { query: string; fileType?: any }) => {
      try {
        const db = getWorkspaceAdminDb()
        let q = db
          .from('v2_client_documents')
          .select('id, file_name, file_type, ocr_status, ocr_text, amount, file_date, drive_url')
          .eq('client_id', clientId)

        if (fileType) q = q.eq('file_type', fileType)

        const { data: docs, error } = await q.limit(20)
        if (error) return { success: false, error: error.message }

        const matching = (docs || []).filter((d: any) => {
          if (!query.trim()) return true
          const text = `${d.file_name} ${d.ocr_text || ''}`.toLowerCase()
          return text.includes(query.toLowerCase())
        })

        return {
          success: true,
          found_count: matching.length,
          documents: matching.slice(0, 8).map((d: any) => ({
            id: d.id,
            name: d.file_name,
            type: d.file_type,
            date: d.file_date,
            amount: d.amount,
            snippet: (d.ocr_text || '').substring(0, 300),
            driveUrl: d.drive_url,
          })),
        }
      } catch (error: unknown) {
        return { success: false, error: errorMessage(error) }
      }
    },
  })
}

// ── Tool: cross_system_status_check (360° Omniscience) ─────────────────────────

export function makeCrossSystemStatusCheckTool(clientId: string) {
  return tool({
    description:
      'Performs a comprehensive 360-degree status check across ALL sources for this client: ' +
      'Living memory, unread/recent emails, active/overdue tasks, calendar meetings, and sheet connectivity.',
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const client = await getWorkspaceClient(clientId)

        const [memories, tasks, calendarRes, emailRes] = await Promise.all([
          getClientLivingMemory(clientId, 10),
          listWorkspaceTasks(clientId).catch(() => []),
          listWorkspaceCalendarEvents({
            clientId,
            timeMin: new Date(Date.now() - 7 * 86400000).toISOString(),
            timeMax: new Date(Date.now() + 14 * 86400000).toISOString(),
          }).catch(() => ({ events: [] })),
          listClientEmails({
            labelName: client.gmail_label,
            clientEmail: client.email,
            maxResults: 5,
          }).catch(() => ({ threads: [], unreadCount: 0, totalEstimate: 0 })),
        ])

        const overdueTasks = tasks.filter((t) => t.reminderState === 'overdue')
        const dueTodayTasks = tasks.filter((t) => t.reminderState === 'due_today')
        const unreadEmails = emailRes.threads.filter((t) => t.isUnread)

        return {
          success: true,
          client_name: client.name,
          has_sheet: Boolean(client.google_sheet_id),
          has_drive: Boolean(client.drive_folder_id),
          gmail_label: client.gmail_label,
          summary: {
            unread_emails_count: emailRes.unreadCount,
            overdue_tasks_count: overdueTasks.length,
            due_today_tasks_count: dueTodayTasks.length,
            upcoming_meetings_count: calendarRes.events.length,
            living_memories_count: memories.length,
          },
          details: {
            living_memories_sample: memories.slice(0, 5).map((m) => m.content),
            urgent_tasks: overdueTasks.concat(dueTodayTasks).map((t) => `${t.title} (${t.priority})`),
            unread_emails: unreadEmails.map((e) => `${e.from.name}: ${e.subject}`),
            upcoming_events: calendarRes.events.map((ev) => `${ev.title} (${new Date(ev.start).toLocaleDateString('he-IL')})`),
          },
        }
      } catch (error: unknown) {
        return { success: false, error: errorMessage(error) }
      }
    },
  })
}

