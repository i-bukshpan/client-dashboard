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
