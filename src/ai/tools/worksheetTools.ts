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

        return {
          success: true,
          widget_count: formattedWidgets.length,
          message: `✅ הדשבורד עודכן עם ${formattedWidgets.length} ווידג'טים. לחץ על לשונית Dashboard לצפייה.`,
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
        const client = await getClientRecord(clientId)
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
