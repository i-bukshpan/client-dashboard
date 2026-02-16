'use server'

import { supabase } from '@/lib/supabase'
import { getRecords } from './data-records'
import type { RelationshipMetadata } from '@/lib/supabase'

/**
 * Server Action: Get related record value for a lookup column
 */
export async function getLookupValue(
  clientId: string,
  relationship: RelationshipMetadata,
  sourceValue: any
): Promise<{ success: boolean; value?: any; error?: string }> {
  try {
    if (!sourceValue) {
      return { success: true, value: null }
    }

    // Get records from target module
    const result = await getRecords(clientId, relationship.target_module_name)
    if (!result.success || !result.records) {
      return { success: false, error: result.error || 'Failed to fetch target records' }
    }

    // Find matching record
    const matchingRecord = result.records.find(
      record => String(record.data[relationship.target_column_key]) === String(sourceValue)
    )

    if (!matchingRecord) {
      return { success: true, value: null }
    }

    // Return the display column value
    const displayValue = matchingRecord.data[relationship.display_column_key]
    return { success: true, value: displayValue }
  } catch (error: any) {
    console.error('Error fetching lookup value:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Server Action: Get all possible values for a lookup column (for dropdowns)
 */
export async function getLookupOptions(
  clientId: string,
  relationship: RelationshipMetadata
): Promise<{ success: boolean; options?: Array<{ value: any; label: string }>; error?: string }> {
  try {
    // Get records from target module
    const result = await getRecords(clientId, relationship.target_module_name)
    if (!result.success || !result.records) {
      return { success: false, error: result.error || 'Failed to fetch target records' }
    }

    // Map records to options
    const options = result.records.map(record => ({
      value: record.data[relationship.target_column_key],
      label: String(record.data[relationship.display_column_key] || record.data[relationship.target_column_key]),
    }))

    // Remove duplicates
    const uniqueOptions = Array.from(
      new Map(options.map(opt => [opt.value, opt])).values()
    )

    return { success: true, options: uniqueOptions }
  } catch (error: any) {
    console.error('Error fetching lookup options:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

