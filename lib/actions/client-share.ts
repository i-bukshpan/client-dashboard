'use server'

import { supabase } from '@/lib/supabase'
import { logAction } from '@/lib/audit-log'

/**
 * Server Action: Generate or get share token for client
 */
export async function getClientShareToken(
  clientId: string
): Promise<{ success: boolean; token?: string; url?: string; error?: string }> {
  try {
    // Get client with share_token
    const { data: client, error: fetchError } = await supabase
      .from('clients')
      .select('share_token')
      .eq('id', clientId)
      .single()

    if (fetchError || !client) {
      return { success: false, error: fetchError?.message || 'Client not found' }
    }

    let token = client.share_token

    // Generate new token if doesn't exist
    if (!token) {
      const { data: updatedClient, error: updateError } = await supabase
        .from('clients')
        .update({ share_token: crypto.randomUUID() })
        .eq('id', clientId)
        .select('share_token')
        .single()

      if (updateError || !updatedClient) {
        return { success: false, error: updateError?.message || 'Failed to generate token' }
      }

      token = updatedClient.share_token
    }

    // Generate share URL - return token, let client construct URL
    // Client will use window.location.origin or NEXT_PUBLIC_APP_URL
    const url = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/view/${token}`

    await logAction(
      'client.share_token_generated',
      'client',
      clientId,
      'Share token generated for client view',
      { token }
    )

    return { success: true, token, url }
  } catch (error: any) {
    console.error('Error getting share token:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Server Action: Get client by share token (public access)
 */
export async function getClientByShareToken(
  token: string
): Promise<{ success: boolean; client?: any; error?: string }> {
  try {
    const { data: client, error } = await supabase
      .from('clients')
      .select('id, name, email, phone, status, created_at, share_permissions, parent_id')
      .eq('share_token', token)
      .single()

    if (error || !client) {
      return { success: false, error: error?.message || 'Invalid share token' }
    }

    if (client.parent_id) {
      const { data: parent } = await supabase
        .from('clients')
        .select('share_permissions')
        .eq('id', client.parent_id)
        .single()

      if (parent?.share_permissions) {
        client.share_permissions = {
          ...parent.share_permissions,
          show_sub_clients: false
        }
      } else {
        client.share_permissions = {
          ...(client.share_permissions || {}),
          show_sub_clients: false
        }
      }
    }

    return { success: true, client }
  } catch (error: any) {
    console.error('Error fetching client by token:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Server Action: Regenerate share token (invalidates old link)
 */
export async function regenerateClientShareToken(
  clientId: string
): Promise<{ success: boolean; token?: string; url?: string; error?: string }> {
  try {
    const newToken = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : require('crypto').randomUUID()

    const { data: client, error } = await supabase
      .from('clients')
      .update({ share_token: newToken })
      .eq('id', clientId)
      .select('share_token')
      .single()

    if (error || !client) {
      return { success: false, error: error?.message || 'Failed to regenerate token' }
    }

    // Generate share URL - return token, let client construct URL
    // Client will use window.location.origin or NEXT_PUBLIC_APP_URL
    const url = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/view/${client.share_token}`

    await logAction(
      'client.share_token_regenerated',
      'client',
      clientId,
      'Share token regenerated for client view',
      { newToken }
    )

    return { success: true, token: client.share_token, url }
  } catch (error: any) {
    console.error('Error regenerating share token:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Server Action: Update client share permissions
 */
export async function updateClientSharePermissions(
  clientId: string,
  permissions: any // Using any to avoid importing the type directly in server action if not needed, or better, import it
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('clients')
      .update({ share_permissions: permissions })
      .eq('id', clientId)

    if (error) {
      return { success: false, error: error.message }
    }

    await logAction(
      'client.share_permissions_updated',
      'client',
      clientId,
      'Updated client share permissions',
      { permissions }
    )

    return { success: true }
  } catch (error: any) {
    console.error('Error updating share permissions:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

