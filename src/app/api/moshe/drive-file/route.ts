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
            // Ignore malformed token
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

  const saAuth = getServiceAccountAuth()
  if (saAuth) candidates.push(saAuth)

  return candidates
}

export async function DELETE(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const fileId = searchParams.get('fileId')
  if (!fileId) return NextResponse.json({ error: 'נדרש מזהה קובץ' }, { status: 400 })

  const candidates = await getDriveAuthCandidates(user.email)
  if (candidates.length === 0) {
    return NextResponse.json({ error: 'Drive לא מוגדר' }, { status: 500 })
  }

  let lastError = 'שגיאה במחיקת קובץ'
  for (const auth of candidates) {
    const drive = google.drive({ version: 'v3', auth })
    try {
      await drive.files.delete({ fileId, supportsAllDrives: true })
      return NextResponse.json({ success: true })
    } catch (err: any) {
      lastError = err?.message || lastError
    }
  }

  return NextResponse.json({ error: `שגיאה במחיקה: ${lastError}` }, { status: 500 })
}
