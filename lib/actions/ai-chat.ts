'use server'

import { supabase } from '@/lib/supabase'

export async function createChatSession(clientId?: string, pageContext?: string) {
  const { data, error } = await supabase
    .from('ai_chat_sessions')
    .insert({
      client_id: clientId || null,
      page_context: pageContext || null,
      title: 'שיחה חדשה',
    })
    .select()
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, session: data }
}

export async function saveChatMessage(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string,
  toolCalls?: any[]
) {
  const { error } = await supabase.from('ai_chat_messages').insert({
    session_id: sessionId,
    role,
    content,
    tool_calls: toolCalls || null,
  })

  if (error) return { success: false, error: error.message }

  // Update session's updated_at so history is sorted correctly
  await supabase
    .from('ai_chat_sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', sessionId)

  return { success: true }
}

export async function getChatHistory(sessionId: string, limit = 20) {
  const { data, error } = await supabase
    .from('ai_chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) return { success: false, error: error.message }
  return { success: true, messages: data || [] }
}

export async function listChatSessions(limit = 20) {
  const { data, error } = await supabase
    .from('ai_chat_sessions')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error) return { success: false, error: error.message }
  return { success: true, sessions: data || [] }
}

export async function updateChatSessionTitle(sessionId: string, title: string) {
  await supabase
    .from('ai_chat_sessions')
    .update({ title: title.substring(0, 80) })
    .eq('id', sessionId)
}
