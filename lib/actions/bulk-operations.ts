'use server'

import { supabase } from '@/lib/supabase'
import { logAction } from '@/lib/audit-log'

/**
 * Bulk update client status
 */
export async function bulkUpdateClientStatus(
  clientIds: string[],
  status: string
): Promise<{ success: boolean; error?: string; updated?: number }> {
  try {
    if (clientIds.length === 0) {
      return { success: false, error: 'לא נבחרו לקוחות' }
    }

    const { data, error } = await supabase
      .from('clients')
      .update({ status })
      .in('id', clientIds)
      .select('id, name')

    if (error) {
      console.error('Error bulk updating status:', error)
      return { success: false, error: error.message }
    }

    // Log actions
    for (const client of data || []) {
      await logAction(
        'client.updated',
        'client',
        client.id,
        `סטטוס לקוח עודכן: ${client.name} -> ${status}`,
        { status }
      )
    }

    return { success: true, updated: data?.length || 0 }
  } catch (error: any) {
    console.error('Unexpected error bulk updating status:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Bulk delete clients
 */
export async function bulkDeleteClients(
  clientIds: string[]
): Promise<{ success: boolean; error?: string; deleted?: number }> {
  try {
    if (clientIds.length === 0) {
      return { success: false, error: 'לא נבחרו לקוחות' }
    }

    // Get client names for audit log
    const { data: clients, error: fetchError } = await supabase
      .from('clients')
      .select('id, name')
      .in('id', clientIds)

    if (fetchError) {
      console.error('Error fetching clients for deletion:', fetchError)
      return { success: false, error: fetchError.message }
    }

    // Delete clients (CASCADE will handle related data)
    const { error } = await supabase
      .from('clients')
      .delete()
      .in('id', clientIds)

    if (error) {
      console.error('Error bulk deleting clients:', error)
      return { success: false, error: error.message }
    }

    // Log actions
    for (const client of clients || []) {
      await logAction(
        'client.deleted',
        'client',
        client.id,
        `לקוח נמחק: ${client.name}`,
        { bulk: true }
      )
    }

    return { success: true, deleted: clients?.length || 0 }
  } catch (error: any) {
    console.error('Unexpected error bulk deleting clients:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

