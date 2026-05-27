import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { google } from 'googleapis'
import { Readable } from 'stream'

export const maxDuration = 120
export const dynamic = 'force-dynamic'; // 👈 אומר ל-Next.js לדלג על הקובץ הזה בזמן ה-Build!

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function getDriveAuth() {
  const clientId     = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN
  if (clientId && clientSecret && refreshToken) {
    const oauth2 = new google.auth.OAuth2(clientId, clientSecret)
    oauth2.setCredentials({ refresh_token: refreshToken })
    return oauth2
  }
  return null
}

const TABLES = [
  'moshe_projects',
  'moshe_project_payments',
  'moshe_buyer_payments',
  'moshe_transactions',
  'moshe_buyers',
  'moshe_partners',
  'moshe_partner_transactions',
  'moshe_loans',
  'moshe_loan_payments',
  'moshe_project_documents',
  'moshe_project_logs',
  'moshe_audit_log',
  'moshe_workers',
  'moshe_worker_project_permissions',
  'moshe_worker_logs',
  'moshe_worker_tasks',
  'moshe_calendar_events',
]

export async function GET(request: NextRequest) {
  // Auth check
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const uploadToDrive = new URL(request.url).searchParams.get('drive') === '1'

  // Fetch all tables in parallel
  const results = await Promise.all(
    TABLES.map(t => db.from(t).select('*').then(r => ({ table: t, rows: r.data ?? [] })))
  )

  const backup = {
    created_at: new Date().toISOString(),
    created_by: user.email,
    tables: Object.fromEntries(results.map(r => [r.table, r.rows])),
  }

  const json  = JSON.stringify(backup, null, 2)
  const bytes = Buffer.from(json, 'utf-8')
  const date  = new Date().toISOString().slice(0, 10)
  const fileName = `backup-${date}.json`

  // Optionally upload to Drive
  if (uploadToDrive) {
    const auth = getDriveAuth()
    const parentFolderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID
    if (auth && parentFolderId) {
      try {
        const drive = google.drive({ version: 'v3', auth })

        // Find or create "גיבויים" subfolder
        const folderSearch = await drive.files.list({
          q: `'${parentFolderId}' in parents and name = 'גיבויים' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
          fields: 'files(id)',
        })
        let backupFolderId = folderSearch.data.files?.[0]?.id
        if (!backupFolderId) {
          const created = await drive.files.create({
            requestBody: { name: 'גיבויים', mimeType: 'application/vnd.google-apps.folder', parents: [parentFolderId] },
            fields: 'id',
          })
          backupFolderId = created.data.id!
        }

        await drive.files.create({
          requestBody: { name: fileName, parents: [backupFolderId] },
          media: { mimeType: 'application/json', body: Readable.from(bytes) },
        })
      } catch {
        // Drive upload failure is non-fatal — still return the file
      }
    }
  }

  return new NextResponse(bytes, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}
