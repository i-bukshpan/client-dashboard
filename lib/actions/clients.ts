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

