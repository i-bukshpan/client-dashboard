import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function getDriveAuth() {
  const clientId     = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN
  if (clientId && clientSecret && refreshToken) {
    const oauth2 = new google.auth.OAuth2(clientId, clientSecret)
    oauth2.setCredentials({ refresh_token: refreshToken })
    return oauth2
  }
  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL
  const rawKey      = process.env.GOOGLE_DRIVE_PRIVATE_KEY
  if (!clientEmail || !rawKey) return null
  const privateKey = rawKey
    .replace(/\\n/g, '\n').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    .replace(/^["']|["']$/g, '')
    .replace(/(-----BEGIN PRIVATE KEY-----)([^\n])/, '$1\n$2')
    .replace(/([^\n])(-----END PRIVATE KEY-----)/, '$1\n$2')
  return new google.auth.GoogleAuth({
    credentials: { client_email: clientEmail, private_key: privateKey },
    scopes: ['https://www.googleapis.com/auth/drive'],
  })
}

function extractFolderId(url: string): string | null {
  const m = url.match(/folders\/([a-zA-Z0-9_-]+)/)
  return m ? m[1] : url.match(/^[a-zA-Z0-9_-]{20,}$/) ? url : null
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const folderParam = searchParams.get('folder') ?? ''
  const folderId = extractFolderId(folderParam) ?? process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID

  if (!folderId) return NextResponse.json({ error: 'נדרש מזהה תיקייה' }, { status: 400 })

  const auth = getDriveAuth()
  if (!auth) return NextResponse.json({ error: 'Drive לא מוגדר' }, { status: 500 })

  const drive = google.drive({ version: 'v3', auth })
  try {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, size, webViewLink, createdTime, modifiedTime)',
      orderBy: 'name',
      pageSize: 200,
    })
    return NextResponse.json({ files: res.data.files ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: `שגיאה: ${err.message}` }, { status: 500 })
  }
}
