/**
 * src/app/admin/crm/[id]/actions-workspace.ts
 *
 * Server Actions for the v2 Workspace — Google Drive + Sheets operations.
 * Scoped to a single client. All actions verify the caller is an admin.
 *
 * NOTE: Every function exported from a 'use server' file MUST be an async function.
 */
'use server'

import { revalidatePath } from 'next/cache'
import {
  getSheetData,
  getSheetRows,
  getSpreadsheetMeta,
  appendRows,
  formatRange,
} from '@/lib/google-sheets'
import { uploadFileToDrive } from '@/lib/google-drive'
import { extractDriveFolderId, extractSpreadsheetId, type ClientDriveFile as DriveFile } from '@/lib/workspace-utils'
import type { SheetRow, SheetMeta } from '@/lib/google-sheets'
import type { DashboardConfig, DashboardWidget } from '@/types/dashboard'
import {
  getWorkspaceAdminDb,
  getWorkspaceClient,
  requireWorkspaceAdmin,
} from '@/lib/v2/workspace-dal'
import { assertDriveFolderDescendsFrom } from '@/lib/v2/google-drive-security'
import { dashboardConfigSchema } from '@/lib/v2/dashboard-schema'

const supabaseAdmin = getWorkspaceAdminDb()

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

// ── Auth guard ─────────────────────────────────────────────────────────────────

async function getClientRecord(clientId: string) {
  return getWorkspaceClient(clientId)
}

// ── Drive Actions ──────────────────────────────────────────────────────────────

/**
 * Uploads a file directly to the client's Google Drive folder.
 */
export async function uploadFileToDriveAction(
  clientId: string,
  folderId: string,
  formData: FormData
): Promise<{ success: true; file: DriveFile } | { error: string }> {
  try {
    await requireWorkspaceAdmin()

    const file = formData.get('file') as File | null
    if (!file || !(file instanceof File)) {
      return { error: 'לא נבחר קובץ להעלאה' }
    }

    if (!folderId) {
      return { error: 'לא צוינה תיקיית יעד ב-Drive' }
    }

    const client = await getClientRecord(clientId)
    if (!client.drive_folder_id) return { error: 'לא הוגדרה תיקיית Drive ללקוח' }
    await assertDriveFolderDescendsFrom(folderId, client.drive_folder_id)

    const buffer = Buffer.from(await file.arrayBuffer())
    const uploaded = await uploadFileToDrive(folderId, file.name, file.type, buffer)

    revalidatePath(`/workspace/clients/${clientId}`)
    return { success: true, file: uploaded }
  } catch (error: unknown) {
    console.error('Error uploading file to Drive:', error)
    return { error: errorMessage(error, 'שגיאה בהעלאת הקובץ ל-Drive') }
  }
}

// ── Sheet Actions ──────────────────────────────────────────────────────────────

/**
 * Returns all tabs (sheets) in a client's spreadsheet.
 */
export async function getSheetTabsAction(clientId: string): Promise<
  { data: SheetMeta[] } | { error: string }
> {
  try {
    await requireWorkspaceAdmin()
    const client = await getClientRecord(clientId)
    if (!client.google_sheet_id) return { data: [] }

    const meta = await getSpreadsheetMeta(client.google_sheet_id)
    return { data: meta }
  } catch (error: unknown) {
    return { error: errorMessage(error, 'שגיאה בטעינת גיליונות') }
  }
}

/**
 * Returns raw 2D string array for a specific sheet tab.
 */
export async function getSheetDataAction(
  clientId: string,
  sheetName: string
): Promise<{ headers: string[]; rows: string[][] } | { error: string }> {
  try {
    await requireWorkspaceAdmin()
    const client = await getClientRecord(clientId)
    if (!client.google_sheet_id) {
      return { error: 'לא הוגדר גיליון עבור לקוח זה' }
    }

    const raw = await getSheetData(client.google_sheet_id, formatRange(sheetName, 'A:ZZ'))
    if (raw.length === 0) return { headers: [], rows: [] }

    // Find maximum column count across all rows (supports side tables & gap columns)
    const maxCols = Math.max(...raw.map((r) => r.length), 1)

    function getColLetter(colIdx: number): string {
      let temp = colIdx
      let letter = ''
      while (temp >= 0) {
        letter = String.fromCharCode((temp % 26) + 65) + letter
        temp = Math.floor(temp / 26) - 1
      }
      return letter
    }

    const rawHeader = raw[0] || []
    const headers: string[] = []
    for (let c = 0; c < maxCols; c++) {
      const val = rawHeader[c]?.trim()
      headers.push(val || `עמודה ${getColLetter(c)}`)
    }

    const allDataRows = raw.slice(1)
    const dataRows = allDataRows
      .filter((r) => r.some((c) => c && String(c).trim() !== ''))
      .map((r) => {
        const padded: string[] = []
        for (let c = 0; c < maxCols; c++) {
          padded.push(r[c] ?? '')
        }
        return padded
      })

    return { headers, rows: dataRows }
  } catch (error: unknown) {
    return { error: errorMessage(error, 'שגיאה בטעינת נתוני הגיליון') }
  }
}

/**
 * Returns rows as typed objects for a specific sheet tab.
 */
export async function getSheetRowsAction(
  clientId: string,
  sheetName: string
): Promise<{ data: SheetRow[] } | { error: string }> {
  try {
    await requireWorkspaceAdmin()
    const client = await getClientRecord(clientId)
    if (!client.google_sheet_id) {
      return { error: 'לא הוגדר גיליון עבור לקוח זה' }
    }

    const rows = await getSheetRows(client.google_sheet_id, sheetName)
    return { data: rows }
  } catch (error: unknown) {
    return { error: errorMessage(error, 'שגיאה בטעינת שורות') }
  }
}

/**
 * Appends a single row (as an ordered array matching the header columns) to a sheet.
 */
export async function appendRowAction(
  clientId: string,
  sheetName: string,
  rowValues: string[]
): Promise<{ success: true } | { error: string }> {
  try {
    await requireWorkspaceAdmin()
    const client = await getClientRecord(clientId)
    if (!client.google_sheet_id) {
      return { error: 'לא הוגדר גיליון עבור לקוח זה' }
    }

    await appendRows(client.google_sheet_id, sheetName, [rowValues])
    return { success: true }
  } catch (error: unknown) {
    return { error: errorMessage(error, 'שגיאה בהוספת שורה') }
  }
}

/**
 * Saves a Google Sheet ID to the client record.
 * Called by the AI agent after creating a new spreadsheet.
 */
export async function linkSheetAction(
  clientId: string,
  spreadsheetId: string
): Promise<{ success: true } | { error: string }> {
  try {
    await requireWorkspaceAdmin()
    const sanitizedId = extractSpreadsheetId(spreadsheetId)
    const { error } = await supabaseAdmin
      .from('clients')
      .update({ google_sheet_id: sanitizedId || null })
      .eq('id', clientId)

    if (error) return { error: error.message }
    revalidatePath(`/workspace/clients/${clientId}`)
    return { success: true }
  } catch (error: unknown) {
    return { error: errorMessage(error, 'שגיאה בקישור הגיליון') }
  }
}

/**
 * Updates the dashboard_config_json for a client.
 * Called by the AI agent's update_dashboard_layout tool.
 */
export async function updateDashboardConfigAction(
  clientId: string,
  config: DashboardConfig
): Promise<{ success: true } | { error: string }> {
  try {
    await requireWorkspaceAdmin()
    const { error } = await supabaseAdmin
      .from('clients')
      .update({ dashboard_config_json: config })
      .eq('id', clientId)

    if (error) return { error: error.message }
    revalidatePath(`/workspace/clients/${clientId}`)
    return { success: true }
  } catch (error: unknown) {
    return { error: errorMessage(error, 'שגיאה בעדכון הדשבורד') }
  }
}

/**
 * Updates complete client profile details including Google Drive Folder ID and Sheet ID.
 */
export interface UpdateClientDetailsInput {
  name: string
  email?: string | null
  phone?: string | null
  address?: string | null
  id_number?: string | null
  status?: string | null
  drive_folder_id?: string | null
  google_sheet_id?: string | null
  portfolio_value?: number | null
  advisory_goal?: string | null
  risk_level?: string | null
}

export async function updateClientDetailsAction(
  clientId: string,
  input: UpdateClientDetailsInput
): Promise<{ success: true } | { error: string }> {
  try {
    await requireWorkspaceAdmin()

    const driveFolderId = input.drive_folder_id
      ? extractDriveFolderId(input.drive_folder_id)
      : null

    const googleSheetId = input.google_sheet_id
      ? extractSpreadsheetId(input.google_sheet_id)
      : null

    const payload: Record<string, string | number | null> = {
      name: input.name.trim(),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      address: input.address?.trim() || null,
      id_number: input.id_number?.trim() || null,
      status: input.status || 'active',
      drive_folder_id: driveFolderId || null,
      google_sheet_id: googleSheetId || null,
      portfolio_value: typeof input.portfolio_value === 'number' ? input.portfolio_value : null,
      advisory_goal: input.advisory_goal?.trim() || null,
      risk_level: input.risk_level?.trim() || null,
    }

    const { error } = await supabaseAdmin
      .from('clients')
      .update(payload)
      .eq('id', clientId)

    if (error) return { error: error.message }

    revalidatePath(`/workspace/clients/${clientId}`)
    revalidatePath('/workspace/clients')
    return { success: true }
  } catch (error: unknown) {
    return { error: errorMessage(error, 'שגיאה בעדכון פרטי לקוח') }
  }
}

/**
 * Generates and applies a full smart dashboard for the client based on their connected Google Sheet.
 */
export async function generateAutoDashboardForClientAction(
  clientId: string
): Promise<{ success: true; widgetCount: number } | { error: string }> {
  try {
    await requireWorkspaceAdmin()

    const { data: client, error: clientErr } = await supabaseAdmin
      .from('clients')
      .select('id, name, google_sheet_id')
      .eq('id', clientId)
      .single()

    if (clientErr || !client?.google_sheet_id) {
      return { error: 'לא נמצא גיליון Google Sheets מחובר ללקוח' }
    }

    const sheets: SheetMeta[] = await getSpreadsheetMeta(client.google_sheet_id)
    if (sheets.length === 0) {
      return { error: 'הגיליון ריק מלשוניות' }
    }

    // Find main tab (prefer "תנועות" or first sheet)
    const mainSheet =
      sheets.find((s) => s.title === 'תנועות' || s.title.includes('תנועות'))?.title ||
      sheets.find((s) => s.title.includes('תזרים') || s.title.includes('הכנסות'))?.title ||
      sheets[0].title

    // Fetch headers of main sheet
    const rowsRes = await getSheetRows(client.google_sheet_id, mainSheet)
    const headers =
      Array.isArray(rowsRes) && rowsRes.length > 0 && rowsRes[0]
        ? Object.keys(rowsRes[0])
        : ['תאריך', 'ספק', 'סכום', 'הוצאה/הכנסה', 'אופן התשלום', 'חשבונית']

    const dateCol = headers.find((h) => h.includes('תאריך') || h.includes('חודש')) || 'תאריך'
    const typeCol = headers.find((h) => h.includes('הוצאה') || h.includes('הכנסה') || h.includes('סוג')) || 'הוצאה/הכנסה'
    const catCol = headers.find((h) => h.includes('ספק') || h.includes('קטגוריה') || h.includes('שם')) || 'ספק'
    const amountCol = headers.find((h) => h.includes('סכום') || h.includes('סה"כ') || h.includes('ש"ח')) || 'סכום'

    const widgets: DashboardWidget[] = [
      {
        id: 'stat-income',
        type: 'stat_card',
        title: 'סה״כ הכנסות',
        sheet: mainSheet,
        tab: 'ראשי',
        position: { col: 0, row: 0, w: 1, h: 1 },
        card_color: 'green',
        icon: 'trending-up',
        prefix: '₪',
        aggregation: 'sum',
        y_column: amountCol,
        filters: [{ column: typeCol, operator: 'equals', value: 'הכנסה' }],
      },
      {
        id: 'stat-expense',
        type: 'stat_card',
        title: 'סה״כ הוצאות',
        sheet: mainSheet,
        tab: 'ראשי',
        position: { col: 1, row: 0, w: 1, h: 1 },
        card_color: 'red',
        icon: 'trending-down',
        prefix: '₪',
        aggregation: 'sum',
        y_column: amountCol,
        filters: [{ column: typeCol, operator: 'equals', value: 'הוצאה' }],
      },
      {
        id: 'stat-net-profit',
        type: 'stat_card',
        title: 'רווח נקי (הכנסות פחות הוצאות)',
        sheet: mainSheet,
        tab: 'ראשי',
        position: { col: 2, row: 0, w: 2, h: 1 },
        card_color: 'purple',
        icon: 'wallet',
        prefix: '₪',
        aggregation: 'net_diff',
        net_formula: {
          column: amountCol,
          type_column: typeCol,
          positive_value: 'הכנסה',
          negative_value: 'הוצאה',
        },
      },
      {
        id: 'chart-bar-timeline',
        type: 'bar_chart',
        title: 'הכנסות והוצאות לאורך זמן',
        sheet: mainSheet,
        tab: 'ראשי',
        position: { col: 0, row: 1, w: 2, h: 2 },
        color: '#6366f1',
        x_column: dateCol,
        y_column: amountCol,
      },
      {
        id: 'chart-pie-categories',
        type: 'pie_chart',
        title: 'התפלגות לפי קטגוריות וספקים',
        sheet: mainSheet,
        tab: 'ספקים',
        position: { col: 0, row: 0, w: 2, h: 2 },
        label_column: catCol,
        value_column: amountCol,
      },
      {
        id: 'table-recent-rows',
        type: 'data_table',
        title: 'תנועות מלאות מהגיליון',
        sheet: mainSheet,
        tab: 'ראשי',
        position: { col: 0, row: 3, w: 4, h: 2 },
        columns: headers.slice(0, 6),
        max_rows: 15,
        sort_by: dateCol,
        sort_order: 'desc',
      },
    ]

    // ── Universal Multi-Tab Dynamic Sheet Analyzer ──────────────────────────
    // Automatically analyzes any sheet structure (any domain, client or language)
    for (const s of sheets) {
      if (s.title === mainSheet) continue

      try {
        const rows = await getSheetRows(client.google_sheet_id, s.title)
        if (!Array.isArray(rows) || rows.length === 0) continue

        const sampleRow = rows[0] || {}
        const tabHeaders = Object.keys(sampleRow)
        if (tabHeaders.length === 0) continue

        const tabAmountCol = tabHeaders.find((h) =>
          /סכום|מחיר|עלות|יתרה|שכר|שווי|השקעה|משיכה|חובה|זכות|amount|price|total|balance/i.test(h)
        )
        const tabDateCol = tabHeaders.find((h) =>
          /תאריך|חודש|שנה|יום|date|month|year/i.test(h)
        )
        const tabTypeCol = tabHeaders.find((h) =>
          /סוג|קטגוריה|סטטוס|הוצאה|הכנסה|type|category|status/i.test(h)
        )
        const tabEntityCol = tabHeaders.find((h) =>
          /שם|לקוח|ספק|עובד|פרויקט|נכס|תיאור|מזמין|משקיע|שותף|העברה|name|client|vendor|item/i.test(h)
        )

        const tabName = s.title
        const hasTransactions = tabAmountCol && (tabDateCol || tabTypeCol)

        if (hasTransactions) {
          // Add Stat cards for sums & counts
          if (tabTypeCol && tabAmountCol) {
            widgets.push({
              id: `stat-net-${s.title}`,
              type: 'stat_card',
              title: `רווח נקי (${tabName})`,
              sheet: s.title,
              tab: tabName,
              position: { col: 0, row: 0, w: 1, h: 1 },
              aggregation: 'net_diff',
              net_formula: {
                column: tabAmountCol,
                type_column: tabTypeCol,
                positive_value: 'הכנסה',
                negative_value: 'הוצאה',
              },
              icon: 'wallet',
              card_color: 'blue',
              prefix: '₪',
            })
          } else if (tabAmountCol) {
            widgets.push({
              id: `stat-sum-${s.title}`,
              type: 'stat_card',
              title: `סה״כ ${tabName}`,
              sheet: s.title,
              tab: tabName,
              position: { col: 0, row: 0, w: 1, h: 1 },
              aggregation: 'sum',
              value_column: tabAmountCol,
              icon: 'dollar-sign',
              card_color: 'purple',
              prefix: '₪',
            })
          }

          // Add Timeline Bar Chart if date exists
          if (tabDateCol && tabAmountCol) {
            widgets.push({
              id: `chart-bar-${s.title}`,
              type: 'bar_chart',
              title: `תנועות ${tabName} לאורך זמן`,
              sheet: s.title,
              tab: tabName,
              position: { col: 1, row: 0, w: 2, h: 2 },
              x_column: tabDateCol,
              y_column: tabAmountCol,
            })
          }

          // Add Distribution Pie Chart if entity/category column exists
          if (tabEntityCol && tabAmountCol) {
            widgets.push({
              id: `chart-pie-${s.title}`,
              type: 'pie_chart',
              title: `התפלגות לפי ${tabEntityCol}`,
              sheet: s.title,
              tab: tabName,
              position: { col: 3, row: 0, w: 1, h: 2 },
              label_column: tabEntityCol,
              value_column: tabAmountCol,
            })
          }

          // Add Data Table
          widgets.push({
            id: `table-${s.title}`,
            type: 'data_table',
            title: `פירוט ${tabName}`,
            sheet: s.title,
            tab: tabName,
            position: { col: 0, row: 2, w: 4, h: 2 },
            columns: tabHeaders.slice(0, 6),
            max_rows: 15,
            sort_by: tabDateCol,
            sort_order: 'desc',
          })
        } else {
          // Master / List Table (e.g. Suppliers, Customers, Fixed Expenses, Staff)
          widgets.push({
            id: `table-list-${s.title}`,
            type: 'data_table',
            title: `רשימת ${tabName}`,
            sheet: s.title,
            tab: tabName,
            position: { col: 0, row: 0, w: 4, h: 3 },
            columns: tabHeaders.slice(0, 6),
            max_rows: 20,
          })
        }
      } catch (err) {
        console.warn(`[AutoDashboard] Error parsing sheet tab ${s.title}:`, err)
      }
    }

    const config: DashboardConfig = { version: 1, widgets }

    const { error: updateErr } = await supabaseAdmin
      .from('clients')
      .update({ dashboard_config_json: config })
      .eq('id', clientId)

    if (updateErr) return { error: updateErr.message }

    revalidatePath(`/workspace/clients/${clientId}`)
    return { success: true, widgetCount: widgets.length }
  } catch (error: unknown) {
    return { error: errorMessage(error, 'שגיאה ביצירת דשבורד חכם') }
  }
}

/**
 * Returns the current dashboard configuration for a client.
 */
export async function getDashboardConfigAction(
  clientId: string
): Promise<{ data: DashboardConfig | null } | { error: string }> {
  try {
    await requireWorkspaceAdmin()
    const client = await getClientRecord(clientId)
    const config = dashboardConfigSchema.safeParse(client.dashboard_config_json)
    return { data: config.success ? config.data : null }
  } catch (error: unknown) {
    return { error: errorMessage(error, 'שגיאה בטעינת הגדרות דשבורד') }
  }
}
