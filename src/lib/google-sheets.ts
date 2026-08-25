/**
 * src/lib/google-sheets.ts
 *
 * Google Sheets API integration.
 * This is the core data layer for Nehemiah OS v2 — all client financial
 * and business data lives in Google Sheets, not in Supabase.
 */

import { createV2DriveClient, createV2SheetsClient } from '@/lib/v2/google-auth'

// ── Types ─────────────────────────────────────────────────────────────────────

/** A sheet tab definition — used when creating a new spreadsheet structure. */
export interface SheetTemplate {
  /** The display name of the sheet tab (e.g. "Income", "הוצאות") */
  title: string
  /** Column header names for the first row (e.g. ["Date", "Category", "Amount", "Notes"]) */
  headers: string[]
}

/** A single row returned from a sheet, keyed by the header row values. */
export type SheetRow = Record<string, string>

/** Metadata about a sheet tab within a spreadsheet. */
export interface SheetMeta {
  sheetId: number
  title: string
  index: number
  rowCount: number
  columnCount: number
}

// ── Internal helper ───────────────────────────────────────────────────────────

function getSheetsClient() {
  return createV2SheetsClient()
}

/**
 * Automatically converts an Excel (.xlsx) file in Google Drive to a native Google Sheet if needed.
 */
export async function ensureNativeGoogleSheet(fileId: string): Promise<string> {
  if (!fileId) return fileId
  const drive = createV2DriveClient()
  try {
    const fileRes = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType',
      supportsAllDrives: true,
    })

    const mime = fileRes.data.mimeType
    if (mime === 'application/vnd.google-apps.spreadsheet') {
      return fileId
    }

    if (
      mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mime === 'application/vnd.ms-excel' ||
      fileRes.data.name?.endsWith('.xlsx') ||
      fileRes.data.name?.endsWith('.xls')
    ) {
      const cleanName = (fileRes.data.name || 'Converted Sheet').replace(/\.xlsx?$/i, '')
      const convertedRes = await drive.files.copy({
        fileId,
        requestBody: {
          name: cleanName,
          mimeType: 'application/vnd.google-apps.spreadsheet',
        },
        supportsAllDrives: true,
      })

      return convertedRes.data.id || fileId
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn('[google-sheets] ensureNativeGoogleSheet notice:', message)
  }
  return fileId
}

/**
 * Ensures a sheet tab name is safely quoted in A1 notation.
 * e.g. "תזרים חודשי ריבל" -> "'תזרים חודשי ריבל'"
 */
export function formatRange(sheetName: string, cellRange = 'A:ZZ'): string {
  const escapedName = sheetName.replace(/'/g, "''")
  return `'${escapedName}'!${cellRange}`
}

// ── Core Read Operations ──────────────────────────────────────────────────────

/**
 * Reads all values from a sheet range as a raw 2D string array.
 * The first row is typically the header row.
 */
export async function getSheetData(
  spreadsheetId: string,
  range?: string
): Promise<string[][]> {
  const realId = await ensureNativeGoogleSheet(spreadsheetId)
  const sheets = getSheetsClient()

  // If no range specified, fetch spreadsheet metadata first to get the first sheet's title
  let finalRange = range
  if (!finalRange) {
    const meta = await getSpreadsheetMeta(realId)
    const firstTab = meta[0]?.title ?? 'Sheet1'
    finalRange = formatRange(firstTab, 'A:ZZ')
  } else if (finalRange.includes('!') && !finalRange.startsWith("'")) {
    const bangIdx = finalRange.lastIndexOf('!')
    const sheetPart = finalRange.slice(0, bangIdx)
    const cellPart = finalRange.slice(bangIdx + 1)
    finalRange = formatRange(sheetPart, cellPart)
  }

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: realId,
    range: finalRange,
    valueRenderOption: 'FORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  })

  return (response.data.values ?? []).map((row) =>
    row.map((cell) => String(cell ?? ''))
  )
}

/**
 * Reads a sheet and returns rows as typed objects, using the first row as headers.
 * Empty/blank rows are filtered out.
 */
export async function getSheetRows(
  spreadsheetId: string,
  sheetName?: string
): Promise<SheetRow[]> {
  const realId = await ensureNativeGoogleSheet(spreadsheetId)
  const range = sheetName ? formatRange(sheetName, 'A:ZZ') : undefined
  const raw = await getSheetData(realId, range)

  if (raw.length < 2) return []

  const [headerRow, ...dataRows] = raw
  const headers = headerRow.map((h) => h.trim())

  return dataRows
    .filter((row) => row.some((cell) => cell.trim() !== ''))
    .map((row) => {
      const obj: SheetRow = {}
      headers.forEach((header, index) => {
        if (header) {
          obj[header] = row[index] ?? ''
        }
      })
      return obj
    })
}

/**
 * Returns metadata about all sheets (tabs) in a spreadsheet.
 */
export async function getSpreadsheetMeta(
  spreadsheetId: string
): Promise<SheetMeta[]> {
  const realId = await ensureNativeGoogleSheet(spreadsheetId)
  const sheets = getSheetsClient()

  const response = await sheets.spreadsheets.get({
    spreadsheetId: realId,
    fields: 'sheets.properties(sheetId,title,index,gridProperties)',
  })

  return (response.data.sheets ?? []).map((s) => ({
    sheetId: s.properties?.sheetId ?? 0,
    title: s.properties?.title ?? '',
    index: s.properties?.index ?? 0,
    rowCount: s.properties?.gridProperties?.rowCount ?? 1000,
    columnCount: s.properties?.gridProperties?.columnCount ?? 26,
  }))
}

// ── Core Write Operations ─────────────────────────────────────────────────────

/**
 * Appends one or more rows to the end of a sheet tab.
 */
export async function appendRows(
  spreadsheetId: string,
  sheetName: string,
  rows: string[][]
): Promise<{ updatedRows: number }> {
  if (rows.length === 0) return { updatedRows: 0 }

  const sheets = getSheetsClient()

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: formatRange(sheetName, 'A1'),
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: rows,
    },
  })

  return {
    updatedRows: response.data.updates?.updatedRows ?? rows.length,
  }
}

/**
 * Updates a specific range with new values (overwrites existing).
 */
export async function updateRange(
  spreadsheetId: string,
  range: string,
  values: string[][]
): Promise<void> {
  const sheets = getSheetsClient()

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values,
    },
  })
}

/** Clears values from a range while preserving formatting and sheet structure. */
export async function clearRange(spreadsheetId: string, range: string): Promise<void> {
  const sheets = getSheetsClient()
  await sheets.spreadsheets.values.clear({ spreadsheetId, range, requestBody: {} })
}

/**
 * Creates a brand-new spreadsheet with predefined sheet tabs, headers, and RTL layout.
 */
export async function createSpreadsheet(
  title: string,
  sheetsToCreate: SheetTemplate[]
): Promise<string> {
  const sheets = getSheetsClient()

  const response = await sheets.spreadsheets.create({
    requestBody: {
      properties: {
        title,
        timeZone: 'Asia/Jerusalem',
      },
      sheets: sheetsToCreate.map((s, index) => ({
        properties: {
          title: s.title,
          index,
          rightToLeft: true,
          gridProperties: {
            frozenRowCount: 1,
            rowCount: 1000,
            columnCount: Math.max(s.headers.length + 5, 26),
          },
        },
        data: [
          {
            startRow: 0,
            startColumn: 0,
            rowData: [
              {
                values: s.headers.map((header) => ({
                  userEnteredValue: { stringValue: header },
                  userEnteredFormat: {
                    textFormat: { bold: true },
                    backgroundColor: { red: 0.94, green: 0.94, blue: 0.96 },
                    horizontalAlignment: 'RIGHT',
                  },
                })),
              },
            ],
          },
        ],
      })),
    },
    fields: 'spreadsheetId',
  })

  const spreadsheetId = response.data.spreadsheetId
  if (!spreadsheetId) {
    throw new Error('[google-sheets] Failed to create spreadsheet — no ID returned')
  }

  return spreadsheetId
}

/**
 * Adds a new sheet tab to an existing spreadsheet.
 */
export async function addSheetTab(
  spreadsheetId: string,
  template: SheetTemplate
): Promise<number> {
  const sheets = getSheetsClient()

  const addSheetResponse = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title: template.title,
              rightToLeft: true,
              gridProperties: {
                frozenRowCount: 1,
              },
            },
          },
        },
      ],
    },
  })

  const newSheetId =
    addSheetResponse.data.replies?.[0]?.addSheet?.properties?.sheetId ?? 0

  if (template.headers.length > 0) {
    await updateRange(spreadsheetId, formatRange(template.title, 'A1'), [template.headers])
  }

  return newSheetId
}
