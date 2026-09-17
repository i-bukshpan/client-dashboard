'use server'

/**
 * src/app/workspace/actions/recordings.ts
 *
 * Server Actions for Nehemiah OS v3 Client Audio Recordings.
 */

import { revalidatePath } from 'next/cache'
import {
  saveClientRecording,
  listClientRecordings,
  deleteClientRecording,
  updateRecordingTranscript,
} from '@/lib/v2/notebook-recordings'

export async function listClientRecordingsAction(clientId: string) {
  try {
    const recordings = await listClientRecordings(clientId)
    return { success: true, recordings }
  } catch (err: any) {
    return { success: false, recordings: [], error: err.message }
  }
}

export async function saveClientRecordingAction(
  clientId: string,
  data: {
    fileName: string
    durationSec?: number
    transcriptText?: string
    extractedItems?: any[]
  }
) {
  try {
    const record = await saveClientRecording(clientId, {
      fileName: data.fileName,
      durationSec: data.durationSec,
      transcriptText: data.transcriptText,
      transcriptStatus: data.transcriptText ? 'done' : 'pending',
      extractedItems: data.extractedItems || [],
    })
    revalidatePath(`/workspace/clients/${clientId}/notebook`)
    return { success: true, record }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function deleteClientRecordingAction(recordingId: string, clientId: string) {
  try {
    await deleteClientRecording(recordingId)
    revalidatePath(`/workspace/clients/${clientId}/notebook`)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}
