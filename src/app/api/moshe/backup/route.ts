import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { google } from 'googleapis'
import { Readable } from 'stream'
import {
  buildMosheOrganizedBackup,
  renderMosheBackupHtml,
  renderMosheBackupCsv,
} from '@/lib/moshe/backup-builder'

export const maxDuration = 120
export const dynamic = 'force-dynamic'

function getDriveAuth() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN
  if (clientId && clientSecret && refreshToken) {
    const oauth2 = new google.auth.OAuth2(clientId, clientSecret)
    oauth2.setCredentials({ refresh_token: refreshToken })
    return oauth2
  }
  return null
}

export async function GET(request: NextRequest) {
  // Auth check
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const searchParams = new URL(request.url).searchParams
  const uploadToDrive = searchParams.get('drive') === '1'
  const formatParam = (searchParams.get('format') || 'json').toLowerCase()

  const backup = await buildMosheOrganizedBackup(user.email)
  const date = new Date().toISOString().slice(0, 10)

  let contentString: string
  let mimeType: string
  let fileName: string

  if (formatParam === 'html' || formatParam === 'report') {
    contentString = renderMosheBackupHtml(backup)
    mimeType = 'text/html; charset=utf-8'
    fileName = `moshe-portal-report-${date}.html`
  } else if (formatParam === 'csv' || formatParam === 'excel') {
    contentString = renderMosheBackupCsv(backup)
    mimeType = 'text/csv; charset=utf-8'
    fileName = `moshe-portal-backup-${date}.csv`
  } else {
    contentString = JSON.stringify(backup, null, 2)
    mimeType = 'application/json; charset=utf-8'
    fileName = `moshe-portal-backup-${date}.json`
  }

  const bytes = Buffer.from(contentString, 'utf-8')

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
            requestBody: {
              name: 'גיבויים',
              mimeType: 'application/vnd.google-apps.folder',
              parents: [parentFolderId],
            },
            fields: 'id',
          })
          backupFolderId = created.data.id!
        }

        // Upload requested file
        await drive.files.create({
          requestBody: { name: fileName, parents: [backupFolderId] },
          media: { mimeType: mimeType.split(';')[0], body: Readable.from(bytes) },
        })

        // If user triggered Drive backup from JSON mode, also upload the readable HTML report to Drive!
        if (formatParam === 'json') {
          const htmlBytes = Buffer.from(renderMosheBackupHtml(backup), 'utf-8')
          await drive.files.create({
            requestBody: { name: `moshe-portal-report-${date}.html`, parents: [backupFolderId] },
            media: { mimeType: 'text/html', body: Readable.from(htmlBytes) },
          })
        }
      } catch {
        // Drive upload failure is non-fatal — still return the file
      }
    }
  }

  return new NextResponse(bytes, {
    headers: {
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}
