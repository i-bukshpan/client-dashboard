'use server'

import { supabase } from '@/lib/supabase'

export interface ClientTag {
  id: string
  name: string
  color: string
  description?: string | null
  created_at: string
  updated_at: string
}

export interface ClientTagAssignment {
  id: string
  client_id: string
  tag_id: string
  created_at: string
}

/**
 * Get all tags
 */
export async function getAllTags(): Promise<{ success: boolean; tags?: ClientTag[]; error?: string }> {
  try {
    const { data: tags, error } = await supabase
      .from('client_tags')
      .select('*')
      .order('name')

    if (error) {
      console.error('Error fetching tags:', error)
      return { success: false, error: error.message }
    }

    return { success: true, tags: tags as ClientTag[] }
  } catch (error: any) {
    console.error('Unexpected error fetching tags:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Create a new tag
 */
export async function createTag(
  name: string,
  color?: string,
  description?: string
): Promise<{ success: boolean; tag?: ClientTag; error?: string }> {
  try {
    const { data: tag, error } = await supabase
      .from('client_tags')
      .insert({
        name: name.trim(),
        color: color || '#3b82f6',
        description: description?.trim() || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating tag:', error)
      return { success: false, error: error.message }
    }

    return { success: true, tag: tag as ClientTag }
  } catch (error: any) {
    console.error('Unexpected error creating tag:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Update a tag
 */
export async function updateTag(
  tagId: string,
  name?: string,
  color?: string,
  description?: string
): Promise<{ success: boolean; tag?: ClientTag; error?: string }> {
  try {
    const updateData: any = {}
    if (name !== undefined) updateData.name = name.trim()
    if (color !== undefined) updateData.color = color
    if (description !== undefined) updateData.description = description?.trim() || null

    const { data: tag, error } = await supabase
      .from('client_tags')
      .update(updateData)
      .eq('id', tagId)
      .select()
      .single()

    if (error) {
      console.error('Error updating tag:', error)
      return { success: false, error: error.message }
    }

    return { success: true, tag: tag as ClientTag }
  } catch (error: any) {
    console.error('Unexpected error updating tag:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Delete a tag
 */
export async function deleteTag(tagId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('client_tags')
      .delete()
      .eq('id', tagId)

    if (error) {
      console.error('Error deleting tag:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error: any) {
    console.error('Unexpected error deleting tag:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Get tags for a specific client
 */
export async function getClientTags(clientId: string): Promise<{ success: boolean; tags?: ClientTag[]; error?: string }> {
  try {
    const { data: assignments, error } = await supabase
      .from('client_tag_assignments')
      .select('tag_id, client_tags(*)')
      .eq('client_id', clientId)

    if (error) {
      console.error('Error fetching client tags:', error)
      return { success: false, error: error.message }
    }

    const tags = (assignments || []).map((a: any) => a.client_tags).filter(Boolean) as ClientTag[]
    return { success: true, tags }
  } catch (error: any) {
    console.error('Unexpected error fetching client tags:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Assign tag to client
 */
export async function assignTagToClient(
  clientId: string,
  tagId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('client_tag_assignments')
      .insert({
        client_id: clientId,
        tag_id: tagId,
      })

    if (error) {
      // If it's a duplicate, that's okay
      if (error.code === '23505') {
        return { success: true }
      }
      console.error('Error assigning tag:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error: any) {
    console.error('Unexpected error assigning tag:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Remove tag from client
 */
export async function removeTagFromClient(
  clientId: string,
  tagId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('client_tag_assignments')
      .delete()
      .eq('client_id', clientId)
      .eq('tag_id', tagId)

    if (error) {
      console.error('Error removing tag:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error: any) {
    console.error('Unexpected error removing tag:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Assign multiple tags to multiple clients (bulk operation)
 */
export async function bulkAssignTags(
  clientIds: string[],
  tagIds: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const assignments = clientIds.flatMap(clientId =>
      tagIds.map(tagId => ({
        client_id: clientId,
        tag_id: tagId,
      }))
    )

    // Use upsert to handle duplicates gracefully
    const { error } = await supabase
      .from('client_tag_assignments')
      .upsert(assignments, {
        onConflict: 'client_id,tag_id',
        ignoreDuplicates: true,
      })

    if (error) {
      console.error('Error bulk assigning tags:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error: any) {
    console.error('Unexpected error bulk assigning tags:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Remove tags from multiple clients (bulk operation)
 */
export async function bulkRemoveTags(
  clientIds: string[],
  tagIds: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('client_tag_assignments')
      .delete()
      .in('client_id', clientIds)
      .in('tag_id', tagIds)

    if (error) {
      console.error('Error bulk removing tags:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error: any) {
    console.error('Unexpected error bulk removing tags:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

