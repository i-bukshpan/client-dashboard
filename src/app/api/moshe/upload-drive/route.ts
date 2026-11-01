import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Readable } from 'stream'
import { decryptSecret } from '@/lib/v2/token-crypto'

export const maxDuration = 120
export const dynamic = 'force-dynamic'

const adminDb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const STORAGE_BUCKET = 'moshe-documents'

function extractFolderId(url: string | null | undefined): string | null {
  if (!url) return null
  const clean = url.trim()
  const folderMatch = clean.match(/folders\/([a-zA-Z0-9_-]+)/)
  if (folderMatch) return folderMatch[1]
  const idParamMatch = clean.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (idParamMatch) return idParamMatch[1]
  if (/^[a-zA-Z0-9_-]{20,}$/.test(clean)) return clean
  return null
}

async function getOAuthClientsToTry() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET
  const clients: InstanceType<typeof google.auth.OAuth2>[] = []

  if (!clientId || !clientSecret) return clients

  // 1. Check google_tokens table in Supabase
  try {
    const { data: rows } = await adminDb.from('google_tokens').select('*')
    for (const row of rows || []) {
      try {
        const refreshToken = decryptSecret(row.refresh_token)
        const accessToken = decryptSecret(row.access_token)
        if (refreshToken || accessToken) {
          const oauth2 = new google.auth.OAuth2(clientId, clientSecret)
          oauth2.setCredentials({
            refresh_token: refreshToken || undefined,
            access_token: accessToken || undefined,
            expiry_date: row.expires_at || undefined,
          })
          clients.push(oauth2)
        }
      } catch {
        // Ignore rows encrypted with a different key
      }
    }
  } catch {
    // Table optional
  }

  // 2. Check environment GOOGLE_OAUTH_REFRESH_TOKEN
  const envRefresh = process.env.GOOGLE_OAUTH_REFRESH_TOKEN
  if (envRefresh) {
    try {
      const decrypted = decryptSecret(envRefresh) || envRefresh
      const oauth2 = new google.auth.OAuth2(clientId, clientSecret)
      oauth2.setCredentials({ refresh_token: decrypted })
      clients.push(oauth2)
    } catch {
      const oauth2 = new google.auth.OAuth2(clientId, clientSecret)
      oauth2.setCredentials({ refresh_token: envRefresh })
      clients.push(oauth2)
    }
  }

  return clients
}

async function uploadToSupabaseStorage(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  projectId: string | null
) {
  // Ensure bucket exists and is public
  await adminDb.storage.createBucket(STORAGE_BUCKET, { public: true }).catch(() => {})

  const extMatch = originalName.match(/(\.[a-zA-Z0-9]{1,10})$/)
  const ext = extMatch ? extMatch[1].toLowerCase() : ''
  const folderPrefix = projectId && /^[a-zA-Z0-9_-]+$/.test(projectId) ? projectId : 'general'
  const storagePath = `${folderPrefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`

  const { error: uploadError } = await adminDb.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, buffer, {
      contentType: mimeType || 'application/octet-stream',
      upsert: true,
    })

  if (uploadError) {
    throw new Error(uploadError.message)
  }

  const { data: pub } = adminDb.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath)
  return {
    id: storagePath,
    name: originalName,
    url: pub.publicUrl,
    mimeType: mimeType || 'application/octet-stream',
    storage: 'supabase' as const,
  }
}

export async function POST(request: NextRequest) {
  // Verify auth
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

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'שגיאה בקריאת הנתונים' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  const folderUrl = formData.get('folderUrl') as string | null
  const projectId = formData.get('projectId') as string | null

  if (!file) return NextResponse.json({ error: 'לא נבחר קובץ' }, { status: 400 })

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const mimeType = file.type || 'application/octet-stream'

  // Determine target Drive folder if configured
  let folderId = extractFolderId(folderUrl)
  if (!folderId && projectId) {
    const { data: proj } = await adminDb
      .from('moshe_projects')
      .select('drive_folder_url')
      .eq('id', projectId)
      .maybeSingle()
    folderId = extractFolderId(proj?.drive_folder_url)
  }

  // If no Drive folder configured for this project, require updating it first
  if (!folderId) {
    return NextResponse.json(
      {
        error: 'לא מוגדרת תיקיית Google Drive לפרויקט זה. יש לעדכן קישור לתיקיית דרייב לפני העלאת מסמכים.',
        code: 'NO_DRIVE_FOLDER',
      },
      { status: 400 }
    )
  }

  // 1. Try uploading to Google Drive if folderId and valid OAuth client exist
  const oauthClients = await getOAuthClientsToTry()
  let driveUploadError: string | null = null

  for (const auth of oauthClients) {
    try {
      const drive = google.drive({ version: 'v3', auth })
      const res = await drive.files.create({
        supportsAllDrives: true,
        requestBody: {
          name: file.name,
          parents: [folderId],
        },
        media: {
          mimeType,
          body: Readable.from(buffer),
        },
        fields: 'id, name, webViewLink, mimeType',
      })

      const fileId = res.data.id!
      await drive.permissions
        .create({
          fileId,
          supportsAllDrives: true,
          requestBody: { role: 'reader', type: 'anyone' },
        })
        .catch(() => {})

      return NextResponse.json({
        id: fileId,
        name: res.data.name ?? file.name,
        url: res.data.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`,
        mimeType: res.data.mimeType ?? mimeType,
        storage: 'drive',
      })
    } catch (driveErr: any) {
      driveUploadError = driveErr?.message || String(driveErr)
      console.warn('[Drive Upload Attempt Failed]:', driveUploadError)
    }
  }

  // 2. Guaranteed Fallback: Upload to Supabase Storage ('moshe-documents' public bucket)
  try {
    const stored = await uploadToSupabaseStorage(buffer, file.name, mimeType, projectId)
    return NextResponse.json(stored)
  } catch (err: any) {
    console.error('[Moshe Document Upload Error]', err)
    return NextResponse.json(
      { error: `שגיאה בהעלאת הקובץ: ${err.message ?? 'שגיאה לא ידועה'}` },
      { status: 500 }
    )
  }
}
