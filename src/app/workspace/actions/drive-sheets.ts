'use server'

/**
 * src/app/workspace/actions/drive-sheets.ts
 *
 * Dedicated Server Actions for Google Drive & Sheets operations in Nehemiah OS v2 Workspace.
 * All actions are strictly scoped to the workspace admin role and perform input validation.
 */

import { revalidatePath } from 'next/cache'
import {
  getSheetData,
  getSheetRows,
  getSpreadsheetMeta,
  appendRows,
  formatRange,
  ensureNativeGoogleSheet,
  type SheetRow,
  type SheetMeta,
} from '@/lib/google-sheets'
import { uploadFileToDrive } from '@/lib/google-drive'
import { extractDriveFolderId, extractSpreadsheetId, type ClientDriveFile as DriveFile } from '@/lib/workspace-utils'
import type { DashboardConfig } from '@/types/dashboard'
import {
  getWorkspaceAdminDb,
  getWorkspaceClient,
  parseWorkspaceClientId,
  requireWorkspaceAdmin,
} from '@/lib/v2/workspace-dal'
import { assertDriveFolderDescendsFrom } from '@/lib/v2/google-drive-security'
import { dashboardConfigSchema } from '@/lib/v2/dashboard-schema'

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
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
    const validId = parseWorkspaceClientId(clientId)

    const file = formData.get('file') as File | null
    if (!file || !(file instanceof File)) {
      return { error: 'לא נבחר קובץ להעלאה' }
    }

    if (!folderId) {
      return { error: 'לא צוינה תיקיית יעד ב-Drive' }
    }

    const client = await getWorkspaceClient(validId)
    if (!client.drive_folder_id) return { error: 'לא הוגדרה תיקיית Drive ללקוח' }
    await assertDriveFolderDescendsFrom(folderId, client.drive_folder_id)

    const buffer = Buffer.from(await file.arrayBuffer())
    const uploaded = await uploadFileToDrive(folderId, file.name, file.type, buffer)

    revalidatePath(`/workspace/clients/${validId}`)
    return { success: true, file: uploaded }
  } catch (error: unknown) {
    console.error('[workspace/drive-sheets] Error uploading file to Drive:', error)
    return { error: errorMessage(error, 'שגיאה בהעלאת הקובץ ל-Drive') }
  }
}

/**
 * Links a spreadsheet to a client record in Supabase.
 */
export async function linkSheetAction(
  clientId: string,
  spreadsheetInput: string
): Promise<{ success: true; spreadsheetId?: string } | { error: string }> {
  try {
    await requireWorkspaceAdmin()
    const validId = parseWorkspaceClientId(clientId)

    let spreadsheetId = extractSpreadsheetId(spreadsheetInput)
    if (!spreadsheetId) {
      return { error: 'מזהה או קישור הגיליון אינו תקין' }
    }

    try {
      spreadsheetId = await ensureNativeGoogleSheet(spreadsheetId)
    } catch (conversionErr) {
      console.warn('[workspace/drive-sheets] Sheet conversion skipped/failed:', conversionErr)
    }

    try {
      await getSpreadsheetMeta(spreadsheetId)
    } catch {
      return {
        error: 'לא ניתן לגשת לגיליון. ודא שהקובץ קיים ושהרשאות הגישה תקינות.',
      }
    }

    const db = getWorkspaceAdminDb()
    const { error: dbError } = await db
      .from('clients')
      .update({ google_sheet_id: spreadsheetId })
      .eq('id', validId)

    if (dbError) throw new Error(dbError.message)

    revalidatePath(`/workspace/clients/${validId}`)
    revalidatePath('/workspace/clients')

    return { success: true, spreadsheetId }
  } catch (error: unknown) {
    return { error: errorMessage(error, 'שגיאה בקישור הגיליון') }
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
    const validId = parseWorkspaceClientId(clientId)
    const client = await getWorkspaceClient(validId)
    if (!client.google_sheet_id) return { data: [] }

    const meta = await getSpreadsheetMeta(client.google_sheet_id)
    return { data: meta }
  } catch (error: unknown) {
    return { error: errorMessage(error, 'שגיאה בטעינת גיליונות') }
  }
}

/**
 * Returns raw 2D string array with headers for a specific sheet tab.
 */
export async function getSheetDataAction(
  clientId: string,
  sheetName: string
): Promise<{ headers: string[]; rows: string[][] } | { error: string }> {
  try {
    await requireWorkspaceAdmin()
    const validId = parseWorkspaceClientId(clientId)
    const client = await getWorkspaceClient(validId)
    if (!client.google_sheet_id) {
      return { error: 'לא הוגדר גיליון עבור לקוח זה' }
    }

    const raw = await getSheetData(client.google_sheet_id, formatRange(sheetName, 'A:ZZ'))
    if (raw.length === 0) return { headers: [], rows: [] }

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
    const validId = parseWorkspaceClientId(clientId)
    const client = await getWorkspaceClient(validId)
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
 * Appends a single row (as an ordered array matching header columns) to a sheet.
 */
export async function appendRowAction(
  clientId: string,
  sheetName: string,
  rowValues: string[]
): Promise<{ success: true } | { error: string }> {
  try {
    await requireWorkspaceAdmin()
    const validId = parseWorkspaceClientId(clientId)
    const client = await getWorkspaceClient(validId)
    if (!client.google_sheet_id) {
      return { error: 'לא הוגדר גיליון עבור לקוח זה' }
    }

    await appendRows(client.google_sheet_id, sheetName, [rowValues])
    revalidatePath(`/workspace/clients/${validId}`)
    return { success: true }
  } catch (error: unknown) {
    return { error: errorMessage(error, 'שגיאה בהוספת שורה') }
  }
}

// ── Dashboard Config Actions ───────────────────────────────────────────────────

/**
 * Returns the current dashboard configuration for a client.
 */
export async function getDashboardConfigAction(
  clientId: string
): Promise<{ data: DashboardConfig | null } | { error: string }> {
  try {
    await requireWorkspaceAdmin()
    const validId = parseWorkspaceClientId(clientId)
    const client = await getWorkspaceClient(validId)
    const config = dashboardConfigSchema.safeParse(client.dashboard_config_json)
    return { data: config.success ? config.data : null }
  } catch (error: unknown) {
    return { error: errorMessage(error, 'שגיאה בטעינת הגדרות דשבורד') }
  }
}
