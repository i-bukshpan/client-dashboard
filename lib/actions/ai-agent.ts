'use server'

import { supabase } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

export async function createAIChatSession(clientId: string, title: string = 'שיחה חדשה') {
  const { data, error } = await supabase
    .from('ai_chat_sessions')
    .insert([{ client_id: clientId, title }])
    .select()
    .single()

  if (error) {
    console.error('Error creating AI session:', error)
    return { success: false, error: error.message }
  }

  return { success: true, data }
}

export async function getAIChatSessions(clientId: string) {
  const { data, error } = await supabase
    .from('ai_chat_sessions')
    .select('*')
    .eq('client_id', clientId)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('Error fetching AI sessions:', error)
    return { success: false, error: error.message }
  }

  return { success: true, data }
}

export async function getAIChatMessages(sessionId: string) {
  const { data, error } = await supabase
    .from('ai_chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching AI messages:', error)
    return { success: false, error: error.message }
  }

  return { success: true, data }
}

export async function sendAIMessage(sessionId: string, role: 'user' | 'assistant', content: string) {
  const { data, error } = await supabase
    .from('ai_chat_messages')
    .insert([{ session_id: sessionId, role, content }])
    .select()
    .single()

  if (error) {
    console.error('Error sending AI message:', error)
    return { success: false, error: error.message }
  }

  // Update session's updated_at
  await supabase
    .from('ai_chat_sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', sessionId)

  return { success: true, data }
}

// Logic for Gemini integration will go here, potentially in a separate route for streaming
