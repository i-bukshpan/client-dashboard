import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Readable } from 'stream'

// No body size limit — allow large file uploads
export const maxDuration = 120

function getDriveAuth() {
  // OAuth (personal Drive) — preferred
  const clientId     = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN

  if (clientId && clientSecret && refreshToken) {
    const oauth2 = new google.auth.OAuth2(clientId, clientSecret)
    oauth2.setCredentials({ refresh_token: refreshToken })
    return oauth2
  }

  // Service Account fallback (Workspace Shared Drives only)
  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL
  const rawKey      = process.env.GOOGLE_DRIVE_PRIVATE_KEY
  if (!clientEmail || !rawKey) return null

  const privateKey = rawKey
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/^["']|["']$/g, '')
    .replace(/(-----BEGIN PRIVATE KEY-----)([^\n])/, '$1\n$2')
    .replace(/([^\n])(-----END PRIVATE KEY-----)/, '$1\n$2')

  return new google.auth.GoogleAuth({
    credentials: { client_email: clientEmail, private_key: privateKey + (privateKey.endsWith('\n') ? '' : '\n') },
    scopes: ['https://www.googleapis.com/auth/drive'],
  })
}

function extractFolderId(url: string | null): string | null {
  if (!url) return null
  const m = url.match(/folders\/([a-zA-Z0-9_-]+)/)
  return m ? m[1] : null
}

export async function POST(request: NextRequest) {
  // Verify auth
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const auth = getDriveAuth()
  if (!auth) {
    return NextResponse.json({ error: 'Google Drive לא מוגדר בסביבה' }, { status: 500 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'שגיאה בקריאת הנתונים' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  const folderUrl = formData.get('folderUrl') as string | null
  const parentFolderEnv = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID ?? null

  if (!file) return NextResponse.json({ error: 'לא נבחר קובץ' }, { status: 400 })

  // Determine target folder
  const folderId = extractFolderId(folderUrl) ?? parentFolderEnv
  if (!folderId) {
    return NextResponse.json({ error: 'לא נמצאה תיקיית יעד. הגדר קישור תיקיית Drive בפרויקט.' }, { status: 400 })
  }

  const drive = google.drive({ version: 'v3', auth })

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const stream = Readable.from(buffer)

  try {
    const res = await drive.files.create({
      requestBody: {
        name: file.name,
        parents: [folderId],
      },
      media: {
        mimeType: file.type || 'application/octet-stream',
        body: stream,
      },
      fields: 'id, name, webViewLink, mimeType',
    })

    const fileId = res.data.id!
    // Make the file readable by anyone with the link
    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
    })

    return NextResponse.json({
      id: fileId,
      name: res.data.name,
      url: res.data.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`,
      mimeType: res.data.mimeType,
    })
  } catch (err: any) {
    console.error('[Drive Upload]', err)
    return NextResponse.json({ error: `שגיאה בהעלאה: ${err.message ?? 'שגיאה לא ידועה'}` }, { status: 500 })
  }
}
