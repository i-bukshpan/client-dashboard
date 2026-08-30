import 'server-only'

/**
 * src/lib/v2/agent-memory.ts
 *
 * Living Memory & Continuous Learning Data Access Layer for Nehemiah AI Agent.
 * Stores and retrieves accumulated decisions, insights, client preferences,
 * and key operational facts.
 */

import { getWorkspaceAdminDb } from '@/lib/v2/workspace-dal'

export type MemoryCategory =
  | 'insight'
  | 'decision'
  | 'preference'
  | 'financial_fact'
  | 'contact'
  | 'note'

export type MemoryImportance = 'low' | 'medium' | 'high'

export interface AgentMemoryItem {
  id: string
  clientId: string
  category: MemoryCategory
  content: string
  importance: MemoryImportance
  source: string
  createdAt: string
  updatedAt: string
}

/**
 * Fetches all living memories for a client, sorted by importance and recency.
 */
export async function getClientLivingMemory(
  clientId: string,
  limit: number = 30
): Promise<AgentMemoryItem[]> {
  try {
    const db = getWorkspaceAdminDb()
    const { data, error } = await db
      .from('v2_agent_memories')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.warn('[agent-memory] getClientLivingMemory fallback:', error.message)
      return []
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      clientId: row.client_id,
      category: row.category,
      content: row.content,
      importance: row.importance,
      source: row.source,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  } catch (err) {
    console.warn('[agent-memory] Exception fetching memory:', err)
    return []
  }
}

/**
 * Adds a new living memory item for a client.
 */
export async function addClientLivingMemory(
  clientId: string,
  input: {
    category?: MemoryCategory
    content: string
    importance?: MemoryImportance
    source?: string
  }
): Promise<{ success: boolean; memoryId?: string; error?: string }> {
  try {
    const db = getWorkspaceAdminDb()
    const { data, error } = await db
      .from('v2_agent_memories')
      .insert({
        client_id: clientId,
        category: input.category || 'insight',
        content: input.content.trim(),
        importance: input.importance || 'medium',
        source: input.source || 'chat',
      })
      .select('id')
      .single()

    if (error) {
      console.error('[agent-memory] Failed to add memory:', error.message)
      return { success: false, error: error.message }
    }

    return { success: true, memoryId: data?.id }
  } catch (err: any) {
    console.error('[agent-memory] Exception adding memory:', err)
    return { success: false, error: err.message || 'שגיאה בשמירת הזיכרון' }
  }
}

/**
 * Deletes a memory item.
 */
export async function deleteClientLivingMemory(
  id: string,
  clientId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getWorkspaceAdminDb()
    const { error } = await db
      .from('v2_agent_memories')
      .delete()
      .eq('id', id)
      .eq('client_id', clientId)

    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Formats living memory items into a readable, high-signal Markdown block for the AI Agent.
 */
export function formatLivingMemoryForPrompt(memories: AgentMemoryItem[]): string {
  if (!memories || memories.length === 0) {
    return 'אין עדיין זיכרונות מצטברים עבור לקוח זה. תוכל להשתמש בכלי `remember_client_fact` כדי לתעד עובדות והחלטות חדשות.'
  }

  const categoryLabels: Record<MemoryCategory, string> = {
    decision: '📌 החלטות וסיכומי דברים',
    financial_fact: '💰 עובדות ונתונים פיננסיים',
    preference: '⚙️ העדפות ודרישות עבודה',
    insight: '💡 תובנות עסקיות',
    contact: '👥 אנשי קשר ושותפים',
    note: '📝 הערות כלליות',
  }

  const grouped: Partial<Record<MemoryCategory, AgentMemoryItem[]>> = {}
  for (const item of memories) {
    if (!grouped[item.category]) grouped[item.category] = []
    grouped[item.category]!.push(item)
  }

  const sections: string[] = []
  for (const [cat, items] of Object.entries(grouped) as [MemoryCategory, AgentMemoryItem[]][]) {
    const title = categoryLabels[cat] || cat
    const lines = items.map((m) => {
      const imp = m.importance === 'high' ? '⭐ [חשוב] ' : ''
      const date = new Date(m.createdAt).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })
      return `- ${imp}${m.content} (${date})`
    })
    sections.push(`### ${title}\n${lines.join('\n')}`)
  }

  return sections.join('\n\n')
}
