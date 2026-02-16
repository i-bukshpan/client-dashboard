'use server'

import { supabase } from '@/lib/supabase'
import type { ColumnDefinition } from '@/lib/supabase'

export interface DefaultSchema {
  id: string
  module_name: string
  columns: ColumnDefinition[]
  description?: string | null
  created_at: string
  updated_at: string
}

/**
 * Server Action: Get all default schemas
 */
export async function getDefaultSchemas(): Promise<{ success: boolean; schemas?: DefaultSchema[]; error?: string }> {
  try {
    const { data: schemas, error } = await supabase
      .from('default_schemas')
      .select('*')
      .order('module_name')

    if (error) {
      console.error('Error fetching default schemas:', error)
      return { success: false, error: error.message }
    }

    return { success: true, schemas: schemas as DefaultSchema[] }
  } catch (error: any) {
    console.error('Unexpected error fetching default schemas:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Server Action: Get a specific default schema by module name
 */
export async function getDefaultSchema(moduleName: string): Promise<{ success: boolean; schema?: DefaultSchema; error?: string }> {
  try {
    const { data: schema, error } = await supabase
      .from('default_schemas')
      .select('*')
      .eq('module_name', moduleName)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching default schema:', error)
      return { success: false, error: error.message }
    }

    return { success: true, schema: schema as DefaultSchema | undefined }
  } catch (error: any) {
    console.error('Unexpected error fetching default schema:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Server Action: Save or update a default schema
 */
export async function saveDefaultSchema(
  moduleName: string,
  columns: ColumnDefinition[],
  description?: string
): Promise<{ success: boolean; schema?: DefaultSchema; error?: string }> {
  try {
    const { data: schema, error } = await supabase
      .from('default_schemas')
      .upsert({
        module_name: moduleName,
        columns: columns,
        description: description || null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'module_name',
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving default schema:', error)
      return { success: false, error: error.message }
    }

    // Log action
    try {
      await supabase.from('audit_log').insert({
        action_type: 'update',
        entity_type: 'default_schema',
        entity_id: schema.id,
        description: `Saved default schema for ${moduleName}`,
        metadata: { moduleName, columnCount: columns.length },
      })
    } catch (logError) {
      console.error('Error logging action:', logError)
    }

    return { success: true, schema: schema as DefaultSchema }
  } catch (error: any) {
    console.error('Unexpected error saving default schema:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Server Action: Delete a default schema
 */
export async function deleteDefaultSchema(moduleName: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('default_schemas')
      .delete()
      .eq('module_name', moduleName)

    if (error) {
      console.error('Error deleting default schema:', error)
      return { success: false, error: error.message }
    }

    // Log action
    try {
      await supabase.from('audit_log').insert({
        action_type: 'delete',
        entity_type: 'default_schema',
        entity_id: moduleName,
        description: `Deleted default schema for ${moduleName}`,
        metadata: { moduleName },
      })
    } catch (logError) {
      console.error('Error logging action:', logError)
    }

    return { success: true }
  } catch (error: any) {
    console.error('Unexpected error deleting default schema:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Server Action: Apply a default schema to a client
 */
export async function applyDefaultSchemaToClient(
  clientId: string,
  moduleName: string,
  branchName?: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get the default schema
    const defaultSchemaResult = await getDefaultSchema(moduleName)
    if (!defaultSchemaResult.success || !defaultSchemaResult.schema) {
      return { success: false, error: 'Default schema not found' }
    }

    // Apply it to the client
    const { upsertSchema } = await import('@/lib/actions/schema')
    const result = await upsertSchema(clientId, moduleName, defaultSchemaResult.schema.columns, branchName)

    return result
  } catch (error: any) {
    console.error('Unexpected error applying default schema:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

