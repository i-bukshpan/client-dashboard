import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { decryptSecret } from '@/lib/v2/token-crypto'

function getServiceAccountAuth() {
  const clientEmail =
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
    process.env.GOOGLE_DRIVE_CLIENT_EMAIL
  const rawKey =
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ||
    process.env.GOOGLE_DRIVE_PRIVATE_KEY
  if (!clientEmail || !rawKey) return null
  const privateKey = rawKey
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/^["']|["']$/g, '')
    .replace(/(-----BEGIN PRIVATE KEY-----)([^\n])/, '$1\n$2')
    .replace(/([^\n])(-----END PRIVATE KEY-----)/, '$1\n$2')
  return new google.auth.GoogleAuth({
    credentials: { client_email: clientEmail, private_key: privateKey },
    scopes: ['https://www.googleapis.com/auth/drive'],
  })
}

async function getDriveAuthCandidates(userEmail?: string | null) {
  const candidates: any[] = []

  // Service account is fast and reliable for listing shared folders
  const saAuth = getServiceAccountAuth()
  if (saAuth) candidates.push(saAuth)

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET

  if (clientId && clientSecret) {
    try {
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      )
      const { data: tokens } = await admin
        .from('google_tokens')
        .select('user_email, refresh_token')
        .not('refresh_token', 'is', null)

      if (tokens && tokens.length > 0) {
        const sorted = [...tokens].sort((a, b) =>
          a.user_email === userEmail ? -1 : b.user_email === userEmail ? 1 : 0,
        )
        for (const row of sorted) {
          if (!row.refresh_token) continue
          try {
            const rawToken = decryptSecret(row.refresh_token)
            if (!rawToken) continue
            const oauth2 = new google.auth.OAuth2(clientId, clientSecret)
            oauth2.setCredentials({ refresh_token: rawToken })
            candidates.push(oauth2)
          } catch {
            // Ignore malformed token row
          }
        }
      }
    } catch {
      // Ignore DB lookup errors
    }

    if (process.env.GOOGLE_OAUTH_REFRESH_TOKEN) {
      const oauth2 = new google.auth.OAuth2(clientId, clientSecret)
      oauth2.setCredentials({ refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN })
      candidates.push(oauth2)
    }
  }

  return candidates
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

  const candidates = await getDriveAuthCandidates(user.email)
  if (candidates.length === 0) {
    return NextResponse.json({ error: 'Drive לא מוגדר' }, { status: 500 })
  }

  let lastError = 'שגיאה בגישה לתיקיית הדרייב'
  for (const auth of candidates) {
    const drive = google.drive({ version: 'v3', auth })
    try {
      const res = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'files(id, name, mimeType, size, webViewLink, createdTime, modifiedTime)',
        orderBy: 'name',
        pageSize: 200,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      })
      return NextResponse.json({ files: res.data.files ?? [] })
    } catch (err: any) {
      lastError = err?.message || lastError
    }
  }

  return NextResponse.json({ error: `שגיאה: ${lastError}` }, { status: 500 })
}
