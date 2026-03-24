'use server'

import { supabase } from '@/lib/supabase'
import { logAction } from '@/lib/audit-log'

/**
 * Server Action: Delete a client and all related data (CASCADE)
 */
export async function deleteClient(clientId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Get client name for audit log
    const { data: client, error: fetchError } = await supabase
      .from('clients')
      .select('name')
      .eq('id', clientId)
      .single()

    if (fetchError) {
      console.error('Error fetching client for deletion:', fetchError)
      return { success: false, error: fetchError.message }
    }

    // Delete client (CASCADE will handle related data)
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', clientId)

    if (error) {
      console.error('Error deleting client:', error)
      return { success: false, error: error.message }
    }

    // Log action
    await logAction(
      'client.deleted',
      'client',
      clientId,
      `לקוח נמחק: ${client?.name || clientId}`,
      { clientId }
    )

    return { success: true }
  } catch (error: any) {
    console.error('Unexpected error deleting client:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Server Action: Update client basic information
 */
export async function updateClient(clientId: string, data: Partial<import('@/lib/supabase').Client>): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('clients')
      .update(data)
      .eq('id', clientId)

    if (error) {
      console.error('Error updating client:', error)
      return { success: false, error: error.message }
    }

    // Log action (selective fields for security)
    const logData = { ...data }
    delete logData.internal_notes // Don't log internal notes content

    await logAction(
      'client.updated',
      'client',
      clientId,
      `נתוני לקוח עודכנו`,
      logData
    )

    return { success: true }
  } catch (error: any) {
    console.error('Unexpected error updating client:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Server Action: Specifically update advisor fields
 */
export async function updateAdvisorFields(clientId: string, advisor_status: string, internal_notes?: string): Promise<{ success: boolean; error?: string }> {
  return updateClient(clientId, { advisor_status, internal_notes })
}

/**
 * Server Action: Update client's Google Drive folder ID
 */
export async function updateClientDriveFolder(clientId: string, folderId: string): Promise<{ success: boolean; error?: string }> {
  return updateClient(clientId, { google_drive_folder_id: folderId })
}

/**
 * Server Action: Fetch unified timeline for a client
 */
export async function getClientTimeline(clientId: string): Promise<{ success: boolean; data: any[] }> {
  try {
    const [{ data: logs }, { data: meetings }, { data: reminders }] = await Promise.all([
      supabase.from('audit_log').select('*').eq('entity_id', clientId).order('created_at', { ascending: false }),
      supabase.from('meetings').select('*').eq('client_id', clientId),
      supabase.from('reminders').select('*').eq('client_id', clientId),
    ])

    // Merge and format
    const timeline = [
      ...(logs || []).map(l => ({ ...l, type: 'log', date: l.created_at })),
      ...(meetings || []).map(m => ({ ...m, type: 'meeting', date: m.meeting_date })),
      ...(reminders || []).map(r => ({ ...r, type: 'task', date: r.due_date || r.created_at }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return { success: true, data: timeline }
  } catch (error) {
    console.error('Error fetching timeline:', error)
    return { success: false, data: [] }
  }
}
