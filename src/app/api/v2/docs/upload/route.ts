import { NextRequest, NextResponse } from 'next/server'
import { Readable } from 'stream'
import { z } from 'zod'
import { createV2DriveClient } from '@/lib/v2/google-auth'
import {
  getWorkspaceAdminDb,
  getWorkspaceClient,
  getWorkspaceErrorStatus,
  requireWorkspaceAdmin,
} from '@/lib/v2/workspace-dal'

export const dynamic = 'force-dynamic'

const DocumentTypeSchema = z.enum(['receipt', 'invoice', 'contract', 'report', 'other'])

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.ms-excel',
  'text/plain',
])

const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB

export async function POST(request: NextRequest) {
  // 1. בדיקת אימות: מנהל בלבד
  let userId: string
  try {
    const session = await requireWorkspaceAdmin()
    userId = session.user.id
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Request failed' },
      { status: getWorkspaceErrorStatus(error) }
    )
  }

  // 2. קריאת form data
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  const clientId = formData.get('client_id') as string | null
  const fileTypeResult = DocumentTypeSchema.safeParse(formData.get('file_type') ?? 'other')

  if (!file) return NextResponse.json({ error: 'Missing file' }, { status: 400 })
  if (!clientId) return NextResponse.json({ error: 'Missing client_id' }, { status: 400 })
  if (!fileTypeResult.success) return NextResponse.json({ error: 'Invalid file_type' }, { status: 400 })
  const fileType = fileTypeResult.data

  // 3. וולידציה
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json({ error: `סוג קובץ לא נתמך: ${file.type}` }, { status: 415 })
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: `הקובץ גדול מדי. מקסימום 25MB` }, { status: 413 })
  }

  // 4. בדיקת לקוח + drive_folder_id
  let client
  try {
    client = await getWorkspaceClient(clientId)
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Request failed' },
      { status: getWorkspaceErrorStatus(error) }
    )
  }

  if (!client.drive_folder_id) {
    return NextResponse.json(
      { error: 'ללקוח זה אין תיקיה ב-Drive. צור תיקיה תחילה.', code: 'NO_DRIVE_FOLDER' },
      { status: 422 }
    )
  }

  // 5. העלאה ל-Google Drive
  let driveFileId: string
  let driveUrl: string

  try {
    const drive = createV2DriveClient()

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const readableStream = Readable.from(buffer)

    const response = await drive.files.create({
      requestBody: {
        name: file.name,
        parents: [client.drive_folder_id],
        description: `V2 | Client: ${client.name} | Type: ${fileType}`,
      },
      media: { mimeType: file.type, body: readableStream },
      fields: 'id, webViewLink',
    })

    driveFileId = response.data.id!
    driveUrl = response.data.webViewLink ?? `https://drive.google.com/file/d/${driveFileId}/view`
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[v2/docs/upload] Drive error:', message)
    return NextResponse.json({ error: `שגיאה בהעלאה ל-Drive: ${message}` }, { status: 500 })
  }

  // 6. שמירה ב-Supabase
  const db = getWorkspaceAdminDb()
  const { data: document, error: dbError } = await db
    .from('v2_client_documents')
    .insert({
      client_id: clientId,
      file_name: file.name,
      file_type: fileType,
      drive_file_id: driveFileId,
      drive_url: driveUrl,
      drive_folder_id: client.drive_folder_id,
      mime_type: file.type,
      file_size_bytes: file.size,
      ocr_status: 'pending',
      uploaded_by: userId,
    })
    .select('id, file_name, drive_url, ocr_status')
    .single()

  if (dbError || !document) {
    console.error('[v2/docs/upload] DB error:', dbError)
    return NextResponse.json({ error: 'שגיאה בשמירת מסמך' }, { status: 500 })
  }


  // 7. הכנסה לתור OCR
  const { data: queueRow, error: queueError } = await db
    .from('v2_ocr_queue')
    .insert({ document_id: document.id, status: 'queued' })
    .select('id')
    .single()

  if (queueError) {
    console.warn('[v2/docs/upload] OCR queue error:', queueError.message)
  }

  // 8. הפעלת n8n Webhook מיידית (fire-and-forget)
  const n8nUrl = process.env.N8N_OCR_WEBHOOK_URL
  if (n8nUrl && !queueError && queueRow) {
    fetch(n8nUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document_id:   document.id,
        queue_id:      queueRow.id,
        drive_file_id: driveFileId,
        mime_type:     file.type,
        client_id:     clientId,
      }),
    }).catch(e => console.warn('[v2/upload] n8n notify failed (non-fatal):', e))
  }

  return NextResponse.json(
    {
      success: true,
      document: {
        id: document.id,
        file_name: document.file_name,
        drive_url: document.drive_url,
        ocr_status: document.ocr_status,
        queued_for_ocr: !queueError,
        n8n_notified: !!(n8nUrl && !queueError),
      },
      message: `הקובץ "${file.name}" הועלה בהצלחה`,
    },
    { status: 201 }
  )
}
