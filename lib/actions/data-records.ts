'use server'

import { supabase } from '@/lib/supabase'
import type { ClientDataRecord, ColumnDefinition } from '@/lib/supabase'

/**
 * Server Action: Add a new data record
 */
export async function addRecord(
  clientId: string,
  moduleType: string,
  data: Record<string, any>
): Promise<{ success: boolean; record?: ClientDataRecord; error?: string }> {
  try {
    const { data: record, error } = await supabase
      .from('client_data_records')
      .insert({
        client_id: clientId,
        module_type: moduleType,
        entry_date: new Date().toISOString(),
        data: data,
      })
      .select()
      .single()

    if (error) {
      console.error('Error adding record:', error)
      return { success: false, error: error.message }
    }

    // Log action (using simple string action_type)
    try {
      await supabase.from('audit_log').insert({
        action_type: 'create',
        entity_type: 'data_record',
        entity_id: record.id,
        description: `Added new ${moduleType} record for client ${clientId}`,
        metadata: { clientId, moduleType, dataKeys: Object.keys(data) },
      })
    } catch (logError) {
      console.error('Error logging action:', logError)
    }

    return { success: true, record: record as ClientDataRecord }
  } catch (error: any) {
    console.error('Unexpected error adding record:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Server Action: Add multiple data records in bulk (chunked on caller side)
 */
export async function addRecordsBulk(
  clientId: string,
  moduleType: string,
  dataRows: Array<Record<string, any>>
): Promise<{ success: boolean; inserted?: number; error?: string }> {
  try {
    if (dataRows.length === 0) {
      return { success: true, inserted: 0 }
    }

    const entryDate = new Date().toISOString()
    const payload = dataRows.map((data) => ({
      client_id: clientId,
      module_type: moduleType,
      entry_date: entryDate,
      data,
    }))

    const { data: records, error } = await supabase
      .from('client_data_records')
      .insert(payload)
      .select('id')

    if (error) {
      console.error('Error adding records in bulk:', error)
      return { success: false, error: error.message }
    }

    try {
      await supabase.from('audit_log').insert({
        action_type: 'create',
        entity_type: 'data_record',
        entity_id: `${clientId}:${moduleType}:bulk`,
        description: `Added ${payload.length} ${moduleType} records for client ${clientId}`,
        metadata: { clientId, moduleType, count: payload.length },
      })
    } catch (logError) {
      console.error('Error logging bulk action:', logError)
    }

    return { success: true, inserted: records?.length || payload.length }
  } catch (error: any) {
    console.error('Unexpected error adding records in bulk:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Server Action: Update a specific field in a data record
 */
export async function updateRecordField(
  recordId: string,
  fieldName: string,
  newValue: any
): Promise<{ success: boolean; record?: ClientDataRecord; error?: string }> {
  try {
    // First, get the current record
    const { data: currentRecord, error: fetchError } = await supabase
      .from('client_data_records')
      .select('*')
      .eq('id', recordId)
      .single()

    if (fetchError || !currentRecord) {
      return { success: false, error: 'Record not found' }
    }

    // Update the specific field in the JSONB data
    const updatedData = {
      ...currentRecord.data,
      [fieldName]: newValue,
    }

    const { data: updatedRecord, error } = await supabase
      .from('client_data_records')
      .update({
        data: updatedData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', recordId)
      .select()
      .single()

    if (error) {
      console.error('Error updating record:', error)
      return { success: false, error: error.message }
    }

    // Log action
    try {
      await supabase.from('audit_log').insert({
        action_type: 'update',
        entity_type: 'data_record',
        entity_id: recordId,
        description: `Updated field "${fieldName}" in ${currentRecord.module_type} record`,
        metadata: { 
          clientId: currentRecord.client_id, 
          moduleType: currentRecord.module_type,
          fieldName,
          oldValue: currentRecord.data[fieldName],
          newValue 
        },
      })
    } catch (logError) {
      console.error('Error logging action:', logError)
    }

    return { success: true, record: updatedRecord as ClientDataRecord }
  } catch (error: any) {
    console.error('Unexpected error updating record:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Server Action: Update entire data record
 */
export async function updateRecord(
  recordId: string,
  data: Record<string, any>
): Promise<{ success: boolean; record?: ClientDataRecord; error?: string }> {
  try {
    const { data: updatedRecord, error } = await supabase
      .from('client_data_records')
      .update({
        data: data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', recordId)
      .select()
      .single()

    if (error) {
      console.error('Error updating record:', error)
      return { success: false, error: error.message }
    }

    // Log action
    try {
      await supabase.from('audit_log').insert({
        action_type: 'update',
        entity_type: 'data_record',
        entity_id: recordId,
        description: `Updated ${updatedRecord.module_type} record`,
        metadata: { 
          clientId: updatedRecord.client_id, 
          moduleType: updatedRecord.module_type,
          dataKeys: Object.keys(data)
        },
      })
    } catch (logError) {
      console.error('Error logging action:', logError)
    }

    return { success: true, record: updatedRecord as ClientDataRecord }
  } catch (error: any) {
    console.error('Unexpected error updating record:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Server Action: Delete a data record
 */
export async function deleteRecord(
  recordId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get record info for logging before deletion
    const { data: record } = await supabase
      .from('client_data_records')
      .select('client_id, module_type')
      .eq('id', recordId)
      .single()

    const { error } = await supabase
      .from('client_data_records')
      .delete()
      .eq('id', recordId)

    if (error) {
      console.error('Error deleting record:', error)
      return { success: false, error: error.message }
    }

    // Log action
    if (record) {
      try {
        await supabase.from('audit_log').insert({
          action_type: 'delete',
          entity_type: 'data_record',
          entity_id: recordId,
          description: `Deleted ${record.module_type} record`,
          metadata: { clientId: record.client_id, moduleType: record.module_type },
        })
      } catch (logError) {
        console.error('Error logging action:', logError)
      }
    }

    return { success: true }
  } catch (error: any) {
    console.error('Unexpected error deleting record:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Server Action: Get all records for a client and module type
 */
export async function getRecords(
  clientId: string,
  moduleType: string
): Promise<{ success: boolean; records?: ClientDataRecord[]; error?: string }> {
  try {
    const pageSize = 1000
    let from = 0
    let allRecords: ClientDataRecord[] = []

    while (true) {
      const to = from + pageSize - 1
      const { data: records, error } = await supabase
        .from('client_data_records')
        .select('*')
        .eq('client_id', clientId)
        .eq('module_type', moduleType)
        .order('entry_date', { ascending: false })
        .range(from, to)

      if (error) {
        console.error('Error fetching records:', error)
        return { success: false, error: error.message }
      }

      const batch = (records || []) as ClientDataRecord[]
      allRecords = allRecords.concat(batch)

      if (batch.length < pageSize) {
        break
      }

      from += pageSize
    }

    return { success: true, records: allRecords }
  } catch (error: any) {
    console.error('Unexpected error fetching records:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

