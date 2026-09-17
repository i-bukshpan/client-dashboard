'use server'

/**
 * src/app/workspace/actions/chat-history.ts
 *
 * Server actions for multi-session cloud synchronization of AI chat conversation history.
 * Supports both Client Notebooks and Global Workspace chats in public.v3_chat_sessions.
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

export interface WorkspaceChatSession {
  id: string
  clientId: string | null
  title: string
  messages: any[]
  createdAt: string
  updatedAt: string
}

/**
 * Fetches all persisted chat sessions with full message histories from Supabase.
 * If clientId is provided, fetches client sessions. Otherwise, fetches global sessions.
 */
export async function fetchWorkspaceChatSessionsAction(clientId?: string | null): Promise<{
  success: boolean
  sessions: WorkspaceChatSession[]
  error?: string
}> {
  try {
    await requireWorkspaceAdmin()
    const db = getWorkspaceAdminDb()

    let query = db
      .from('v3_chat_sessions')
      .select('id, client_id, title, messages_json, created_at, updated_at')
      .order('updated_at', { ascending: false })

    if (clientId) {
      query = query.eq('client_id', clientId)
    } else {
      query = query.is('client_id', null)
    }

    const { data, error } = await query

    if (error) {
      console.warn('[chat-history] fetchWorkspaceChatSessions query error:', error.message)
      return { success: true, sessions: [] }
    }

    const sessions: WorkspaceChatSession[] = (data || []).map((row: any) => {
      let msgs = row.messages_json
      if (typeof msgs === 'string') {
        try { msgs = JSON.parse(msgs) } catch { msgs = [] }
      }
      if (!Array.isArray(msgs)) msgs = []

      return {
        id: String(row.id),
        clientId: row.client_id || null,
        title: row.title || 'שיחה חדשה',
        messages: msgs,
        createdAt: row.created_at,
        updatedAt: row.updated_at || row.created_at,
      }
    })

    return { success: true, sessions }
  } catch (err: any) {
    console.warn('[chat-history] Exception loading workspace chat sessions:', err)
    return { success: true, sessions: [] }
  }
}

/**
 * Saves or updates an entire chat session (including all messages) in Supabase.
 */
export async function saveWorkspaceChatSessionAction(params: {
  id: string
  clientId?: string | null
  title: string
  messages: any[]
}): Promise<{ success: boolean; error?: string }> {
  try {
    await requireWorkspaceAdmin()
    const db = getWorkspaceAdminDb()

    const { id, clientId, title, messages } = params
    if (!id) return { success: false, error: 'Session ID is required' }

    const { error } = await db.from('v3_chat_sessions').upsert(
      {
        id,
        client_id: clientId || null,
        title: title || 'שיחה חדשה',
        messages_json: Array.isArray(messages) ? messages : [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )

    if (error) {
      console.error('[chat-history] Error upserting v3_chat_sessions:', error.message)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err: any) {
    console.error('[chat-history] Exception saving workspace chat session:', err)
    return { success: false, error: err.message }
  }
}

/**
 * Deletes a chat session from Supabase.
 */
export async function deleteWorkspaceChatSessionAction(sessionId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    await requireWorkspaceAdmin()
    const db = getWorkspaceAdminDb()

    const { error } = await db
      .from('v3_chat_sessions')
      .delete()
      .eq('id', sessionId)

    if (error) {
      console.error('[chat-history] Error deleting v3_chat_sessions:', error.message)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

// ── Legacy Compatibility Helpers ──────────────────────────────────────────────

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

    // 1. Try v3_chat_sessions first
    const { data: v3Sessions } = await db
      .from('v3_chat_sessions')
      .select('messages_json')
      .eq('client_id', clientId)
      .order('updated_at', { ascending: false })
      .limit(1)

    if (v3Sessions && v3Sessions.length > 0 && Array.isArray(v3Sessions[0].messages_json) && v3Sessions[0].messages_json.length > 0) {
      return { success: true, messages: v3Sessions[0].messages_json }
    }

    // 2. Fallback to v2_client_chat_messages
    const { data, error } = await db
      .from('v2_client_chat_messages')
      .select('id, role, content, parts_json, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: true })

    if (error) {
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
  return saveWorkspaceChatSessionAction({
    id: `sess_client_${clientId}`,
    clientId,
    title: 'שיחת לקוח',
    messages,
  })
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
    await db.from('v3_chat_sessions').delete().eq('client_id', clientId)
    await db.from('v2_client_chat_messages').delete().eq('client_id', clientId)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}
