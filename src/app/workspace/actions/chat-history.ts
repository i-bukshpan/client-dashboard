'use server'

/**
 * src/app/workspace/actions/chat-history.ts
 *
 * Server actions for cloud synchronization of AI chat conversation history.
 */

import { randomUUID } from 'crypto'
import { getWorkspaceAdminDb, requireWorkspaceAdmin } from '@/lib/v2/workspace-dal'

export interface PersistedChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content?: string
  parts?: any[]
  createdAt?: string
}

/**
 * Fetches all persisted chat messages for a client from Supabase in chronological order.
 */
export async function fetchClientChatHistoryAction(clientId: string): Promise<{
  success: boolean
  messages: PersistedChatMessage[]
  error?: string
}> {
  try {
    await requireWorkspaceAdmin()
    const db = getWorkspaceAdminDb()

    const { data, error } = await db
      .from('v2_client_chat_messages')
      .select('id, role, content, parts_json, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: true })

    if (error) {
      console.warn('[chat-history] fetchClientChatHistory query error:', error.message)
      return { success: true, messages: [] }
    }

    const messages: PersistedChatMessage[] = (data || []).map((row: any) => {
      let parts = row.parts_json
      if (typeof parts === 'string') {
        try { parts = JSON.parse(parts) } catch { parts = [] }
      }
      if (!Array.isArray(parts) || parts.length === 0) {
        if (row.content) parts = [{ type: 'text', text: row.content }]
        else parts = []
      }

      return {
        id: String(row.id),
        role: row.role,
        content: row.content || '',
        parts,
        createdAt: row.created_at,
      }
    })

    return { success: true, messages }
  } catch (err: any) {
    console.warn('[chat-history] Exception loading chat history:', err)
    return { success: true, messages: [] }
  }
}

/**
 * Saves or updates a batch of chat messages for a client in Supabase.
 */
export async function saveClientChatMessagesAction(
  clientId: string,
  messages: any[]
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireWorkspaceAdmin()
    if (!messages || messages.length === 0) return { success: true }

    const db = getWorkspaceAdminDb()

    const rows = messages.map((m: any, index: number) => {
      let textContent = ''
      if (typeof m.content === 'string') textContent = m.content
      else if (Array.isArray(m.parts)) {
        textContent = m.parts
          .filter((p: any) => p && p.type === 'text')
          .map((p: any) => p.text || '')
          .join('\n')
      }

      const msgId = m.id && typeof m.id === 'string' && m.id.trim()
        ? m.id.trim()
        : `msg_${Date.now()}_${index}_${randomUUID().slice(0, 8)}`

      return {
        id: msgId,
        client_id: clientId,
        role: m.role || 'user',
        content: textContent,
        parts_json: Array.isArray(m.parts) ? m.parts : [{ type: 'text', text: textContent }],
        created_at: m.createdAt || new Date().toISOString(),
      }
    })

    const { error } = await db
      .from('v2_client_chat_messages')
      .upsert(rows, { onConflict: 'id' })

    if (error) {
      console.warn('[chat-history] Upsert warning, trying fallback rewrite:', error.message)
      await db.from('v2_client_chat_messages').delete().eq('client_id', clientId)
      const { error: insertErr } = await db.from('v2_client_chat_messages').insert(rows)
      if (insertErr) {
        console.error('[chat-history] Insert error:', insertErr.message)
        return { success: false, error: insertErr.message }
      }
    }

    return { success: true }
  } catch (err: any) {
    console.warn('[chat-history] Exception saving chat history:', err)
    return { success: false, error: err.message }
  }
}

/**
 * Clears the chat conversation history for a client.
 */
export async function clearClientChatHistoryAction(clientId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    await requireWorkspaceAdmin()
    const db = getWorkspaceAdminDb()
    const { error } = await db
      .from('v2_client_chat_messages')
      .delete()
      .eq('client_id', clientId)

    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}
