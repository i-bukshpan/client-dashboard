/**
 * src/lib/google-drive.ts
 *
 * Real Google Drive API integration.
 * - Reads & Listings: Service Account (fast, server-to-server)
 * - File Uploads: Uses OAuth2 Refresh Token (Nehemiah's personal account) to avoid
 *   the Service Account 0GB storage quota restriction on personal @gmail.com accounts.
 */

import { Readable } from 'stream'
import { createV2DriveClient } from '@/lib/v2/google-auth'
import type { ClientDriveFile as DriveFile } from '@/lib/workspace-utils'
import { formatFileSize, getMimeIcon, getFolderLink } from '@/lib/workspace-utils'

export type { DriveFile }
export { formatFileSize, getMimeIcon, getFolderLink }

// ── Internal helpers ──────────────────────────────────────────────────────────

function getDriveClient() {
  return createV2DriveClient()
}

function getDriveUploadClient() {
  return createV2DriveClient()
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * List all items (subfolders and files) directly inside a Drive folder.
 * Returns subfolders first, followed by files ordered by modified time desc.
 */
export async function getClientFiles(folderId: string): Promise<DriveFile[]> {
  if (!folderId) return []

  const drive = getDriveClient()

  const response = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, modifiedTime, size, webViewLink, iconLink)',
    orderBy: 'folder, modifiedTime desc',
    pageSize: 100,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })

  const files = response.data.files ?? []

  const items = files.map((f) => {
    const isFolder = f.mimeType === 'application/vnd.google-apps.folder'
    return {
      id: f.id ?? '',
      name: f.name ?? 'Untitled',
      mimeType: f.mimeType ?? 'application/octet-stream',
      modifiedTime: f.modifiedTime ?? new Date().toISOString(),
      size: f.size ?? null,
      webViewLink:
        f.webViewLink ??
        (isFolder
          ? `https://drive.google.com/drive/folders/${f.id}`
          : `https://drive.google.com/file/d/${f.id}`),
      iconLink: f.iconLink ?? '',
      isFolder,
    }
  })

  // Ensure folders are at top, then newest files
  return items.sort((a, b) => {
    if (a.isFolder && !b.isFolder) return -1
    if (!a.isFolder && b.isFolder) return 1
    return new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime()
  })
}

/**
 * Upload a file directly to a specific Google Drive folder.
 * Uses Nehemiah's personal OAuth2 Refresh Token so the file is stored under
 * his personal Google Drive quota (bypassing the Service Account 0GB quota limit).
 */
export async function uploadFileToDrive(
  folderId: string,
  fileName: string,
  mimeType: string,
  buffer: Buffer
): Promise<DriveFile> {
  const drive = getDriveUploadClient()

  const stream = new Readable()
  stream.push(buffer)
  stream.push(null)

  const response = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType: mimeType || 'application/octet-stream',
      body: stream,
    },
    fields: 'id, name, mimeType, modifiedTime, size, webViewLink, iconLink',
  })

  const f = response.data
  return {
    id: f.id ?? '',
    name: f.name ?? fileName,
    mimeType: f.mimeType ?? mimeType,
    modifiedTime: f.modifiedTime ?? new Date().toISOString(),
    size: f.size ?? String(buffer.length),
    webViewLink: f.webViewLink ?? `https://drive.google.com/file/d/${f.id}`,
    iconLink: f.iconLink ?? '',
    isFolder: false,
  }
}

/** Downloads a non-Google binary file from Drive into server memory. */
export async function downloadFileFromDrive(fileId: string): Promise<Buffer> {
  const drive = getDriveClient()
  const response = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' }
  )
  return Buffer.from(response.data as ArrayBuffer)
}

/**
 * Create a new folder inside the configured parent folder.
 * Returns the new folder's Drive ID.
 */
export async function createClientFolder(clientName: string): Promise<string> {
  const parentFolderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID
  if (!parentFolderId) {
    throw new Error(
      '[google-drive] GOOGLE_DRIVE_PARENT_FOLDER_ID is not set in .env.local'
    )
  }

  const drive = getDriveUploadClient()

  const response = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: clientName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    },
    fields: 'id',
  })

  const folderId = response.data.id
  if (!folderId) throw new Error('[google-drive] Failed to create folder — no ID returned')

  return folderId
}

/** Creates a v2-owned Drive folder without relying on any legacy CRM record. */
export async function createWorkspaceFolder(name: string, parentFolderId?: string): Promise<string> {
  const drive = getDriveUploadClient()
  const response = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentFolderId ? { parents: [parentFolderId] } : {}),
    },
    fields: 'id',
  })
  const folderId = response.data.id
  if (!folderId) throw new Error('[google-drive] Failed to create workspace folder')
  return folderId
}

/** Moves a Google-native file into one v2 Drive folder. */
export async function moveWorkspaceFile(fileId: string, folderId: string): Promise<void> {
  const drive = getDriveUploadClient()
  const current = await drive.files.get({ fileId, fields: 'parents', supportsAllDrives: true })
  await drive.files.update({
    fileId,
    addParents: folderId,
    removeParents: (current.data.parents ?? []).join(',') || undefined,
    supportsAllDrives: true,
    fields: 'id, parents',
  })
}

/**
 * Searches for files across Google Drive by filename or content keywords.
 * Supports restricting to a specific parent folder (e.g. client folder).
 */
export async function searchDriveFiles(
  query: string,
  options?: { folderId?: string; pageSize?: number }
): Promise<DriveFile[]> {
  if (!query || !query.trim()) return []
  const drive = getDriveClient()
  const safeQuery = query.trim().replace(/'/g, "\\'")
  const pageSize = Math.min(options?.pageSize || 20, 50)

  // Try combined search first (name or fullText)
  try {
    let q = `trashed = false and (name contains '${safeQuery}' or fullText contains '${safeQuery}')`
    if (options?.folderId) {
      q = `'${options.folderId}' in parents and trashed = false and (name contains '${safeQuery}' or fullText contains '${safeQuery}')`
    }

    const response = await drive.files.list({
      q,
      fields: 'files(id, name, mimeType, modifiedTime, size, webViewLink, iconLink)',
      pageSize,
      orderBy: 'modifiedTime desc',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })

    const files = response.data.files ?? []
    return files.map((f) => {
      const isFolder = f.mimeType === 'application/vnd.google-apps.folder'
      return {
        id: f.id ?? '',
        name: f.name ?? 'Untitled',
        mimeType: f.mimeType ?? 'application/octet-stream',
        modifiedTime: f.modifiedTime ?? new Date().toISOString(),
        size: f.size ?? null,
        webViewLink:
          f.webViewLink ??
          (isFolder
            ? `https://drive.google.com/drive/folders/${f.id}`
            : `https://drive.google.com/file/d/${f.id}`),
        iconLink: f.iconLink ?? '',
        isFolder,
      }
    })
  } catch (_err: any) {
    // If fullText search causes query syntax error on certain drive accounts, fallback to name contains
    const fallbackQ = options?.folderId
      ? `'${options.folderId}' in parents and trashed = false and name contains '${safeQuery}'`
      : `trashed = false and name contains '${safeQuery}'`

    const fallbackResponse = await drive.files.list({
      q: fallbackQ,
      fields: 'files(id, name, mimeType, modifiedTime, size, webViewLink, iconLink)',
      pageSize,
      orderBy: 'modifiedTime desc',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })

    const files = fallbackResponse.data.files ?? []
    return files.map((f) => {
      const isFolder = f.mimeType === 'application/vnd.google-apps.folder'
      return {
        id: f.id ?? '',
        name: f.name ?? 'Untitled',
        mimeType: f.mimeType ?? 'application/octet-stream',
        modifiedTime: f.modifiedTime ?? new Date().toISOString(),
        size: f.size ?? null,
        webViewLink:
          f.webViewLink ??
          (isFolder
            ? `https://drive.google.com/drive/folders/${f.id}`
            : `https://drive.google.com/file/d/${f.id}`),
        iconLink: f.iconLink ?? '',
        isFolder,
      }
    })
  }
}

/**
 * Reads text content or exported text from a Drive file (Docs, plain text, markdown, csv).
 * Truncates safely to maxBytes (default 40KB) to prevent token overflow.
 */
export async function getDriveFileText(
  fileId: string,
  maxBytes: number = 40960
): Promise<{ text: string; mimeType: string; name: string }> {
  const drive = getDriveClient()

  // 1. Get file metadata
  const meta = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType, size',
    supportsAllDrives: true,
  })

  const fileName = meta.data.name ?? 'Untitled'
  const mimeType = meta.data.mimeType ?? 'application/octet-stream'

  // 2. If Google Doc -> export as plain text
  if (mimeType === 'application/vnd.google-apps.document') {
    const exported = await drive.files.export(
      { fileId, mimeType: 'text/plain' },
      { responseType: 'text' }
    )
    const rawText = String(exported.data ?? '')
    return {
      name: fileName,
      mimeType,
      text: rawText.length > maxBytes ? rawText.slice(0, maxBytes) + '\n...[תוכן נחתך]' : rawText,
    }
  }

  // 3. If Google Sheet -> export first sheet as csv
  if (mimeType === 'application/vnd.google-apps.spreadsheet') {
    const exported = await drive.files.export(
      { fileId, mimeType: 'text/csv' },
      { responseType: 'text' }
    )
    const rawText = String(exported.data ?? '')
    return {
      name: fileName,
      mimeType,
      text: rawText.length > maxBytes ? rawText.slice(0, maxBytes) + '\n...[תוכן נחתך]' : rawText,
    }
  }

  // 4. If binary or text file -> download media
  const buffer = await downloadFileFromDrive(fileId)
  const isLikelyText =
    mimeType.startsWith('text/') ||
    mimeType.includes('json') ||
    mimeType.includes('xml') ||
    mimeType.includes('javascript') ||
    fileName.endsWith('.txt') ||
    fileName.endsWith('.md') ||
    fileName.endsWith('.csv') ||
    fileName.endsWith('.json')

  if (isLikelyText) {
    const text = buffer.toString('utf8', 0, Math.min(buffer.length, maxBytes))
    return {
      name: fileName,
      mimeType,
      text: buffer.length > maxBytes ? text + '\n...[תוכן נחתך]' : text,
    }
  }

  return {
    name: fileName,
    mimeType,
    text: `[קובץ בינארי מסוג ${mimeType}, גודל: ${buffer.length} בתים. קישור צפייה זמין דרך Google Drive]`,
  }
}
