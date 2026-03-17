// ── Google Drive Public File Reader ────────────────────────────────────────
// Reads publicly shared Google Docs/Sheets/Drive files (no auth required)

const MAX_CHARS = 8000

function extractFileId(url: string): string | null {
  const patterns = [
    /\/document\/d\/([a-zA-Z0-9_-]+)/,
    /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/,
    /\/presentation\/d\/([a-zA-Z0-9_-]+)/,
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

function getExportUrl(url: string, fileId: string): string {
  if (url.includes('/document/')) {
    return `https://docs.google.com/document/d/${fileId}/export?format=txt`
  }
  if (url.includes('/spreadsheets/')) {
    return `https://docs.google.com/spreadsheets/d/${fileId}/export?format=csv&gid=0`
  }
  if (url.includes('/presentation/')) {
    return `https://docs.google.com/presentation/d/${fileId}/export?format=txt`
  }
  // Generic Drive file
  return `https://drive.google.com/uc?export=download&id=${fileId}`
}

export async function readPublicDriveFile(url: string): Promise<{
  success: boolean
  content?: string
  error?: string
}> {
  // Validate it's a Google URL
  if (!url.includes('google.com') && !url.includes('docs.google') && !url.includes('drive.google')) {
    return { success: false, error: 'כתובת URL אינה של Google Drive/Docs/Sheets' }
  }

  const fileId = extractFileId(url)
  if (!fileId) {
    return { success: false, error: 'לא ניתן לזהות את מזהה הקובץ מהכתובת' }
  }

  const exportUrl = getExportUrl(url, fileId)

  try {
    const response = await fetch(exportUrl, {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })

    if (!response.ok) {
      if (response.status === 403 || response.status === 401) {
        return { success: false, error: 'הקובץ אינו משותף לציבור. יש לשתף את הקובץ עם "כל מי שיש לו את הקישור"' }
      }
      return { success: false, error: `שגיאה בגישה לקובץ (קוד: ${response.status})` }
    }

    const text = await response.text()
    const truncated = text.length > MAX_CHARS
      ? text.substring(0, MAX_CHARS) + `\n\n[...תוכן חתוך - הוצגו ${MAX_CHARS} תווים מתוך ${text.length}]`
      : text

    return { success: true, content: truncated }
  } catch (error: any) {
    if (error.name === 'TimeoutError') {
      return { success: false, error: 'הבקשה לקובץ פגה (timeout). יש לבדוק שהקובץ נגיש' }
    }
    return { success: false, error: `שגיאה בקריאת הקובץ: ${error.message}` }
  }
}
