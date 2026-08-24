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
