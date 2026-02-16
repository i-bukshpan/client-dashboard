/**
 * Audit Log utility functions
 * Logs user actions for tracking and history
 */

import { supabase } from './supabase'

export type ActionType = 
  | 'client.created'
  | 'client.updated'
  | 'client.deleted'
  | 'payment.created'
  | 'payment.updated'
  | 'payment.deleted'
  | 'reminder.created'
  | 'reminder.updated'
  | 'reminder.deleted'
  | 'credential.created'
  | 'credential.updated'
  | 'credential.deleted'
  | 'note.created'
  | 'note.updated'
  | 'note.deleted'

export interface AuditLogEntry {
  id?: string
  action_type: ActionType
  entity_type: string // 'client', 'payment', etc.
  entity_id: string
  user_id?: string | null
  description: string
  metadata?: Record<string, any>
  created_at?: string
}

/**
 * Log an action to the audit log
 */
export async function logAction(
  actionType: ActionType,
  entityType: string,
  entityId: string,
  description: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    // Create audit_log table if it doesn't exist (run this SQL in Supabase first)
    // For now, we'll use console.log as fallback
    const entry: Omit<AuditLogEntry, 'id' | 'created_at'> = {
      action_type: actionType,
      entity_type: entityType,
      entity_id: entityId,
      user_id: null, // Can be enhanced with user authentication later
      description,
      metadata: metadata || {},
    }

    // Try to insert into audit_log table
    const { error } = await supabase
      .from('audit_log')
      .insert([entry])

    if (error) {
      // If table doesn't exist, just log to console
      console.log('[AUDIT LOG]', entry)
    }
  } catch (error) {
    // Fallback to console logging if audit log fails
    console.log('[AUDIT LOG]', {
      action_type: actionType,
      entity_type: entityType,
      entity_id: entityId,
      description,
      metadata,
      error,
    })
  }
}

/**
 * Get audit log entries for an entity
 */
export async function getAuditLog(entityType: string, entityId: string): Promise<AuditLogEntry[]> {
  try {
    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Error fetching audit log:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error fetching audit log:', error)
    return []
  }
}

/**
 * Get all recent audit log entries
 */
export async function getRecentAuditLogs(limit: number = 100): Promise<AuditLogEntry[]> {
  try {
    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching audit log:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error fetching audit log:', error)
    return []
  }
}

