/**
 * src/lib/workspace-utils.ts
 *
 * Client-safe utilities for formatting file sizes, mime types, and extracting Google IDs.
 * Contains no server-side or Node.js dependencies so it is safe to import
 * in Client Components ('use client') as well as Server Actions.
 */

export interface ClientDriveFile {
  id: string
  name: string
  mimeType: string
  modifiedTime: string
  size: string | null
  webViewLink: string
  iconLink: string
  isFolder?: boolean
}

export function formatFileSize(bytes: string | null): string {
  if (!bytes) return '—'
  const n = parseInt(bytes)
  if (isNaN(n) || n === 0) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function getMimeIcon(mimeType: string): string {
  if (mimeType === 'application/vnd.google-apps.folder' || mimeType.includes('folder')) return '📁'
  if (mimeType.includes('pdf')) return '📄'
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊'
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝'
  if (mimeType.includes('image')) return '🖼️'
  if (mimeType.includes('google-apps.form')) return '📋'
  return '📎'
}

export function getFolderLink(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`
}

/**
 * Extracts Google Drive folder ID whether the user pasted a raw ID or a full URL.
 */
export function extractDriveFolderId(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  const match = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/)
  if (match && match[1]) return match[1]
  return trimmed
}

/**
 * Extracts Google Spreadsheet ID whether the user pasted a raw ID or a full URL.
 */
export function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  if (match && match[1]) return match[1]
  return trimmed
}
