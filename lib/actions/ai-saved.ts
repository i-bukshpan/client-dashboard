'use server'

import { supabase } from '@/lib/supabase'

export async function saveAiResponse(
  content: string,
  clientId?: string,
  clientName?: string,
  contextUrl?: string
) {
  // Auto-generate title from first meaningful line (up to 70 chars)
  const firstLine = content.split('\n').find(l => l.trim().length > 0) || content
  const title = firstLine.replace(/\*\*/g, '').trim().substring(0, 70)

  const { data, error } = await supabase
    .from('ai_saved_responses')
    .insert({ title, content, client_id: clientId || null, client_name: clientName || null, context_url: contextUrl || null })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, id: data.id }
}

export async function getSavedResponses(limit = 50) {
  const { data, error } = await supabase
    .from('ai_saved_responses')
    .select('id, title, content, client_name, context_url, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return { success: false, error: error.message }
  return { success: true, items: data || [] }
}

export async function deleteSavedResponse(id: string) {
  const { error } = await supabase
    .from('ai_saved_responses')
    .delete()
    .eq('id', id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}
