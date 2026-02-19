'use server'

import { supabase } from '@/lib/supabase'
import type { ClientSchema, ColumnDefinition } from '@/lib/supabase'

/**
 * Server Action: Get schema for a client and module
 */
export async function getSchema(
  clientId: string,
  moduleName: string,
  branchName?: string | null
): Promise<{ success: boolean; schema?: ClientSchema; error?: string }> {
  try {
    let query = supabase
      .from('client_schemas')
      .select('*')
      .eq('client_id', clientId)
      .eq('module_name', moduleName)

    if (branchName === undefined || branchName === null) {
      query = query.is('branch_name', null)
    } else {
      query = query.eq('branch_name', branchName)
    }

    const { data: schema, error } = await query.single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching schema:', error)
      return { success: false, error: error.message }
    }

    return { success: true, schema: schema as ClientSchema | undefined }
  } catch (error: any) {
    console.error('Unexpected error fetching schema:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Server Action: Create or update schema for a client and module
 */
export async function upsertSchema(
  clientId: string,
  moduleName: string,
  columns: ColumnDefinition[],
  branchName?: string | null
): Promise<{ success: boolean; schema?: ClientSchema; error?: string }> {
  try {
    // First, try to get existing schema
    let query = supabase
      .from('client_schemas')
      .select('*')
      .eq('client_id', clientId)
      .eq('module_name', moduleName)

    if (branchName === undefined || branchName === null) {
      query = query.is('branch_name', null)
    } else {
      query = query.eq('branch_name', branchName)
    }

    const { data: existingSchema } = await query.single()

    let schema: ClientSchema
    if (existingSchema) {
      // Update existing schema
      const { data, error } = await supabase
        .from('client_schemas')
        .update({
          columns: columns,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingSchema.id)
        .select()
        .single()

      if (error) {
        console.error('Error updating schema:', error)
        return { success: false, error: error.message }
      }
      schema = data as ClientSchema
    } else {
      // Insert new schema
      const { data, error } = await supabase
        .from('client_schemas')
        .insert({
          client_id: clientId,
          module_name: moduleName,
          branch_name: branchName || null,
          columns: columns,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) {
        console.error('Error inserting schema:', error)
        return { success: false, error: error.message }
      }
      schema = data as ClientSchema
    }

    // Log action
    try {
      await supabase.from('audit_log').insert({
        action_type: existingSchema ? 'update' : 'create',
        entity_type: 'client_schema',
        entity_id: schema.id,
        description: `${existingSchema ? 'Updated' : 'Created'} schema for ${moduleName} module`,
        metadata: { clientId, moduleName, branchName: branchName || null, columnCount: columns.length },
      })
    } catch (logError) {
      console.error('Error logging action:', logError)
    }

    return { success: true, schema: schema }
  } catch (error: any) {
    console.error('Unexpected error upserting schema:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Server Action: Delete schema for a client and module
 */
export async function deleteSchema(
  clientId: string,
  moduleName: string,
  branchName?: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    let query = supabase
      .from('client_schemas')
      .delete()
      .eq('client_id', clientId)
      .eq('module_name', moduleName)

    if (branchName === undefined || branchName === null) {
      query = query.is('branch_name', null)
    } else {
      query = query.eq('branch_name', branchName)
    }

    const { error } = await query

    if (error) {
      console.error('Error deleting schema:', error)
      return { success: false, error: error.message }
    }

    // Log action
    try {
      await supabase.from('audit_log').insert({
        action_type: 'delete',
        entity_type: 'client_schema',
        entity_id: `${clientId}:${moduleName}`,
        description: `Deleted schema for ${moduleName} module`,
        metadata: { clientId, moduleName },
      })
    } catch (logError) {
      console.error('Error logging action:', logError)
    }

    return { success: true }
  } catch (error: any) {
    console.error('Unexpected error deleting schema:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Server Action: Get all schemas for a client
 */
export async function getClientSchemas(
  clientId: string
): Promise<{ success: boolean; schemas?: ClientSchema[]; error?: string }> {
  try {
    const { data: schemas, error } = await supabase
      .from('client_schemas')
      .select('*')
      .eq('client_id', clientId)
      .order('module_name')

    if (error) {
      console.error('Error fetching client schemas:', error)
      return { success: false, error: error.message }
    }

    return { success: true, schemas: schemas as ClientSchema[] }
  } catch (error: any) {
    console.error('Unexpected error fetching client schemas:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Server Action: Delete a module and all its associated records
 */
export async function deleteModule(
  clientId: string,
  moduleName: string,
  branchName?: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    // First, delete all records for this module
    // Note: records don't have branch_name yet, so we delete by module_type
    // This may delete records from multiple branches if module_name is duplicated
    // TODO: Add branch_name to client_data_records in future
    const { error: recordsError } = await supabase
      .from('client_data_records')
      .delete()
      .eq('client_id', clientId)
      .eq('module_type', moduleName)

    if (recordsError) {
      console.error('Error deleting module records:', recordsError)
      return { success: false, error: recordsError.message }
    }

    // Then delete the schema
    const deleteResult = await deleteSchema(clientId, moduleName, branchName)
    return deleteResult
  } catch (error: any) {
    console.error('Unexpected error deleting module:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Server Action: Update financial metadata for a schema
 */
export async function updateSchemaFinancial(
  schemaId: string,
  financialType: 'income' | 'expense' | null,
  amountColumn?: string | null,
  dateColumn?: string | null,
  descriptionColumn?: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('client_schemas')
      .update({
        financial_type: financialType,
        amount_column: financialType ? (amountColumn || null) : null,
        date_column: financialType ? (dateColumn || null) : null,
        description_column: financialType ? (descriptionColumn || null) : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', schemaId)

    if (error) {
      console.error('Error updating schema financial:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error: any) {
    console.error('Unexpected error updating schema financial:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}
