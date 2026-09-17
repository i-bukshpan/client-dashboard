import 'server-only'

/**
 * src/lib/v2/notebook-recordings.ts
 *
 * Data Access Layer (DAL) for Nehemiah OS v3 Client Audio Recordings.
 * Stores audio meeting records, transcripts, and structured extracted items (tasks, decisions, amounts).
 */

import {
  getWorkspaceAdminDb,
  requireWorkspaceAdmin,
  parseWorkspaceClientId,
} from '@/lib/v2/workspace-dal'

export interface ClientRecordingRecord {
  id: string
  client_id: string
  file_name: string
  drive_file_id: string | null
  duration_sec: number | null
  transcript_text: string | null
  transcript_status: 'pending' | 'processing' | 'done' | 'failed'
  extracted_items: Array<{
    type: 'task' | 'decision' | 'amount' | 'deadline'
    text: string
    meta?: Record<string, unknown>
  }>
  uploaded_by: string | null
  created_at: string
  updated_at: string
}

export async function listClientRecordings(clientId: string): Promise<ClientRecordingRecord[]> {
  await requireWorkspaceAdmin()
  const validId = parseWorkspaceClientId(clientId)
  const db = getWorkspaceAdminDb()

  const { data, error } = await db
    .from('v3_client_recordings')
    .select('*')
    .eq('client_id', validId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[notebook-recordings] list error:', error)
    return []
  }

  return (data || []) as ClientRecordingRecord[]
}

export async function saveClientRecording(
  clientId: string,
  input: {
    fileName: string
    driveFileId?: string | null
    durationSec?: number | null
    transcriptText?: string | null
    transcriptStatus?: 'pending' | 'processing' | 'done' | 'failed'
    extractedItems?: any[]
  }
): Promise<ClientRecordingRecord> {
  await requireWorkspaceAdmin()
  const validId = parseWorkspaceClientId(clientId)
  const db = getWorkspaceAdminDb()

  const { data, error } = await db
    .from('v3_client_recordings')
    .insert({
      client_id: validId,
      file_name: input.fileName,
      drive_file_id: input.driveFileId || null,
      duration_sec: input.durationSec || null,
      transcript_text: input.transcriptText || null,
      transcript_status: input.transcriptStatus || 'pending',
      extracted_items: input.extractedItems || [],
    })
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`שגיאה בשמירת הקלטה: ${error?.message || 'שגיאה לא ידועה'}`)
  }

  return data as ClientRecordingRecord
}

export async function updateRecordingTranscript(
  recordingId: string,
  transcriptText: string,
  extractedItems: any[] = [],
  status: 'done' | 'failed' = 'done'
): Promise<ClientRecordingRecord> {
  await requireWorkspaceAdmin()
  const db = getWorkspaceAdminDb()

  const { data, error } = await db
    .from('v3_client_recordings')
    .update({
      transcript_text: transcriptText,
      extracted_items: extractedItems,
      transcript_status: status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', recordingId)
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`שגיאה בעדכון תמלול הקלטה: ${error?.message || 'שגיאה לא ידועה'}`)
  }

  return data as ClientRecordingRecord
}

export async function deleteClientRecording(recordingId: string): Promise<boolean> {
  await requireWorkspaceAdmin()
  const db = getWorkspaceAdminDb()

  const { error } = await db
    .from('v3_client_recordings')
    .delete()
    .eq('id', recordingId)

  if (error) {
    throw new Error(`שגיאה במחיקת הקלטה: ${error.message}`)
  }

  return true
}
