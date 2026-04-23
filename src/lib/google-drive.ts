/**
 * Google Drive API integration.
 * Currently uses MOCK data. Replace the mock implementations with real
 * Google Drive API calls once service-account credentials are provided in .env.local.
 */

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  modifiedTime: string
  size: string | null
  webViewLink: string
  iconLink: string
}

const MOCK_FILES: DriveFile[] = [
  {
    id: 'file-001',
    name: 'חוזה שירות.pdf',
    mimeType: 'application/pdf',
    modifiedTime: '2024-03-15T10:00:00Z',
    size: '245000',
    webViewLink: '#',
    iconLink: 'https://drive-thirdparty.googleusercontent.com/16/type/application/pdf',
  },
  {
    id: 'file-002',
    name: 'דוח שנתי 2023.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    modifiedTime: '2024-02-20T14:30:00Z',
    size: '124000',
    webViewLink: '#',
    iconLink: 'https://drive-thirdparty.googleusercontent.com/16/type/application/vnd.ms-excel',
  },
  {
    id: 'file-003',
    name: 'תיק לקוח.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    modifiedTime: '2024-01-10T09:00:00Z',
    size: '58000',
    webViewLink: '#',
    iconLink: 'https://drive-thirdparty.googleusercontent.com/16/type/application/vnd.ms-word',
  },
]

/**
 * List files in a client's Drive folder.
 * MOCK: returns sample files regardless of folderId.
 */
export async function getClientFiles(folderId: string): Promise<DriveFile[]> {
  await new Promise((r) => setTimeout(r, 600)) // simulate latency
  if (!folderId) return []
  return MOCK_FILES
}

/**
 * Create a new Drive folder for a client inside the parent folder.
 * MOCK: returns a fake folder ID.
 */
export async function createClientFolder(clientName: string): Promise<string> {
  await new Promise((r) => setTimeout(r, 800))
  const fakeId = `folder-${Date.now()}-${clientName.replace(/\s+/g, '-').toLowerCase()}`
  console.log('[Drive Mock] Created folder:', fakeId)
  return fakeId
}

/**
 * Get the shareable link for a folder.
 * MOCK: returns a placeholder Google Drive URL.
 */
export function getFolderLink(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`
}

export function formatFileSize(bytes: string | null): string {
  if (!bytes) return '—'
  const n = parseInt(bytes)
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function getMimeIcon(mimeType: string): string {
  if (mimeType.includes('pdf')) return '📄'
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊'
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝'
  if (mimeType.includes('image')) return '🖼️'
  if (mimeType.includes('folder')) return '📁'
  return '📎'
}

