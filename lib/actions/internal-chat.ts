'use server'

import { supabase } from '@/lib/supabase'

// Get or create a conversation between two parties
export async function getOrCreateConversation(
  clientId: string,
  otherType: 'advisor' | 'client',
  otherId: string
) {
  // For client↔client chats, canonicalize the key so both sides find the same record
  let canonicalClientId = clientId
  let canonicalOtherId = otherId
  if (otherType === 'client') {
    if (clientId > otherId) {
      canonicalClientId = otherId
      canonicalOtherId = clientId
    }
  }

  const { data: existing } = await supabase
    .from('internal_conversations')
    .select('*')
    .eq('client_id', canonicalClientId)
    .eq('other_type', otherType)
    .eq('other_id', canonicalOtherId)
    .single()

  if (existing) return { success: true, conversation: existing }

  const { data, error } = await supabase
    .from('internal_conversations')
    .insert({ client_id: canonicalClientId, other_type: otherType, other_id: canonicalOtherId })
    .select()
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, conversation: data }
}

export async function getMessages(conversationId: string, limit = 50) {
  const { data, error } = await supabase
    .from('internal_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) return { success: false, error: error.message }
  return { success: true, messages: data || [] }
}

export async function sendMessage(
  conversationId: string,
  senderType: 'advisor' | 'client',
  senderId: string,
  recipientType: 'advisor' | 'client',
  recipientId: string,
  content: string
) {
  const { data, error } = await supabase
    .from('internal_messages')
    .insert({
      conversation_id: conversationId,
      sender_type: senderType,
      sender_id: senderId,
      recipient_type: recipientType,
      recipient_id: recipientId,
      content,
    })
    .select()
    .single()

  if (error) return { success: false, error: error.message }

  // Update conversation last_message
  await supabase
    .from('internal_conversations')
    .update({
      last_message: content.substring(0, 100),
      last_message_at: new Date().toISOString(),
    })
    .eq('id', conversationId)

  return { success: true, message: data }
}

export async function markMessagesRead(conversationId: string, readerType: 'advisor' | 'client', readerId: string) {
  await supabase
    .from('internal_messages')
    .update({ is_read: true })
    .eq('conversation_id', conversationId)
    .neq('sender_id', readerId)
    .eq('is_read', false)
}

export async function getAdvisorConversations() {
  const { data, error } = await supabase
    .from('internal_conversations')
    .select('*')
    .eq('other_type', 'advisor')
    .order('last_message_at', { ascending: false })

  if (error) return { success: false, error: error.message }
  if (!data || data.length === 0) return { success: true, conversations: [] }

  // Fetch client data (including parent_id for sub-client detection)
  const clientIds = [...new Set(data.map(c => c.client_id))]
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, email, parent_id')
    .in('id', clientIds)

  // Fetch parent client names for any sub-clients
  const parentIds = [...new Set((clients || []).filter(c => c.parent_id).map(c => c.parent_id as string))]
  const { data: parentClients } = parentIds.length > 0
    ? await supabase.from('clients').select('id, name').in('id', parentIds)
    : { data: [] }

  const clientMap = new Map((clients || []).map(c => [c.id, c]))
  const parentMap = new Map((parentClients || []).map(c => [c.id, c]))

  const conversations = data.map(conv => {
    const client = clientMap.get(conv.client_id) || null
    const parentClient = client?.parent_id ? (parentMap.get(client.parent_id) || null) : null
    return { ...conv, clients: client, parentClient }
  })

  return { success: true, conversations }
}

export async function getClientConversations(clientId: string) {
  const { data, error } = await supabase
    .from('internal_conversations')
    .select('*')
    .or(`client_id.eq.${clientId},other_id.eq.${clientId}`)
    .order('last_message_at', { ascending: false })

  if (error) return { success: false, error: error.message }
  return { success: true, conversations: data || [] }
}

export async function getUnreadCountForAdvisor(): Promise<number> {
  const { count } = await supabase
    .from('internal_messages')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_type', 'advisor')
    .eq('is_read', false)
  return count || 0
}
