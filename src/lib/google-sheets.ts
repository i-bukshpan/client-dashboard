/**
 * src/lib/google-sheets.ts
 *
 * Google Sheets API integration.
 * This is the core data layer for Nehemiah OS v2 — all client financial
 * and business data lives in Google Sheets, not in Supabase.
 *
 * Performance: read operations are cached with server-side TTL caching.
 * Write operations invalidate all cache entries for the affected spreadsheet.
 */

import { createV2DriveClient, createV2SheetsClient } from '@/lib/v2/google-auth'
import { sheetsMetaCache, sheetsDataCache } from '@/lib/server-cache'

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

const conversionCache = new Map<string, string>()
const inFlightConversions = new Map<string, Promise<string>>()

/**
 * Automatically converts an Excel (.xlsx) file in Google Drive to a native Google Sheet if needed.
 * Features:
 * - In-memory caching so repeated reads never re-convert.
 * - In-flight promise locking so concurrent widget requests for the same file only trigger one conversion.
 * - Searches parent folder to reuse existing converted Google Sheet if one already exists.
 */
export async function ensureNativeGoogleSheet(fileId: string): Promise<string> {
  if (!fileId) return fileId

  if (conversionCache.has(fileId)) {
    return conversionCache.get(fileId)!
  }

  if (inFlightConversions.has(fileId)) {
    return inFlightConversions.get(fileId)!
  }

  const conversionPromise = (async () => {
    const drive = createV2DriveClient()
    try {
      const fileRes = await drive.files.get({
        fileId,
        fields: 'id, name, mimeType, parents, trashed',
        supportsAllDrives: true,
      })

      if (fileRes.data.trashed) {
        return fileId
      }

      const mime = fileRes.data.mimeType
      // If already a native Google Sheet, cache and return immediately
      if (mime === 'application/vnd.google-apps.spreadsheet') {
        conversionCache.set(fileId, fileId)
        return fileId
      }

      // Check if it's an Excel file
      if (
        mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        mime === 'application/vnd.ms-excel' ||
        fileRes.data.name?.endsWith('.xlsx') ||
        fileRes.data.name?.endsWith('.xls')
      ) {
        const cleanName = (fileRes.data.name || 'Converted Sheet').replace(/\.xlsx?$/i, '')
        const parentId = fileRes.data.parents?.[0]

        // 1. Check if a converted Google Sheet with the exact clean name already exists in the same folder
        if (parentId) {
          try {
            const escapedName = cleanName.replace(/'/g, "\\'")
            const existingRes = await drive.files.list({
              q: `'${parentId}' in parents and name = '${escapedName}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
              fields: 'files(id, name)',
              spaces: 'drive',
              supportsAllDrives: true,
              pageSize: 5,
            })
            if (existingRes.data.files && existingRes.data.files.length > 0) {
              const existingId = existingRes.data.files[0].id!
              conversionCache.set(fileId, existingId)
              return existingId
            }
          } catch (listErr) {
            console.warn('[google-sheets] Error checking existing converted sheet:', listErr)
          }
        }

        // 2. If not found, copy and convert once
        const convertedRes = await drive.files.copy({
          fileId,
          requestBody: {
            name: cleanName,
            mimeType: 'application/vnd.google-apps.spreadsheet',
            parents: parentId ? [parentId] : undefined,
          },
          supportsAllDrives: true,
        })

        const convertedId = convertedRes.data.id || fileId
        conversionCache.set(fileId, convertedId)
        return convertedId
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn('[google-sheets] ensureNativeGoogleSheet notice:', message)
    }
    return fileId
  })()

  inFlightConversions.set(fileId, conversionPromise)
  try {
    const result = await conversionPromise
    conversionCache.set(fileId, result)
    return result
  } finally {
    inFlightConversions.delete(fileId)
  }
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

  const cacheKey = `sheet-data:${realId}:${finalRange}`
  return sheetsDataCache.getOrSet(cacheKey, async () => {
    const sheets = getSheetsClient()
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: realId,
      range: finalRange,
      valueRenderOption: 'FORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING',
    })

    return (response.data.values ?? []).map((row) =>
      row.map((cell) => String(cell ?? ''))
    )
  }, 30_000)
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
  const cacheKey = `sheet-meta:${realId}`

  return sheetsMetaCache.getOrSet(cacheKey, async () => {
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
  }, 60_000)
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

  // Invalidate cache for this spreadsheet after write
  invalidateSheetCache(spreadsheetId)

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

  // Invalidate cache for this spreadsheet after write
  invalidateSheetCache(spreadsheetId)
}

/** Clears values from a range while preserving formatting and sheet structure. */
export async function clearRange(spreadsheetId: string, range: string): Promise<void> {
  const sheets = getSheetsClient()
  await sheets.spreadsheets.values.clear({ spreadsheetId, range, requestBody: {} })
  invalidateSheetCache(spreadsheetId)
}

/**
 * Creates a brand-new spreadsheet with predefined sheet tabs, headers, and RTL layout.
 * If parentFolderId is provided, the spreadsheet is automatically moved into that Drive folder.
 */
export async function createSpreadsheet(
  title: string,
  sheetsToCreate: SheetTemplate[],
  parentFolderId?: string
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

  // Automatically place in parent folder if specified
  if (parentFolderId) {
    try {
      const { moveWorkspaceFile } = await import('@/lib/google-drive')
      await moveWorkspaceFile(spreadsheetId, parentFolderId)
    } catch (moveErr) {
      console.warn('[google-sheets] Warning moving created spreadsheet to parentFolder:', moveErr)
    }
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

  invalidateSheetCache(spreadsheetId)
  return newSheetId
}

// ── Cache Invalidation ────────────────────────────────────────────────────────

/** Invalidates all cached data for a specific spreadsheet after a write operation. */
export function invalidateSheetCache(spreadsheetId: string): void {
  sheetsMetaCache.invalidateByPrefix(`sheet-meta:${spreadsheetId}`)
  sheetsDataCache.invalidateByPrefix(`sheet-data:${spreadsheetId}`)
}
