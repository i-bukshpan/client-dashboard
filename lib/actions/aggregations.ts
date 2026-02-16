'use server'

import { getRecords } from './data-records'
import type { FormulaMetadata } from '@/lib/supabase'

/**
 * Server Action: Get aggregated value from a module
 * Fast query optimized for formula calculations
 */
export async function getAggregatedValue(
  clientId: string,
  moduleName: string,
  columnKey: string,
  operation: 'SUM' | 'AVERAGE' | 'COUNT' | 'MIN' | 'MAX',
  filter?: Record<string, any>
): Promise<{ success: boolean; value?: number; error?: string }> {
  try {
    const recordsResult = await getRecords(clientId, moduleName)
    
    if (!recordsResult.success || !recordsResult.records) {
      return { success: true, value: 0 }
    }

    let records = recordsResult.records

    // Apply filter if provided
    if (filter && Object.keys(filter).length > 0) {
      records = records.filter((record) => {
        return Object.entries(filter).every(([key, value]) => {
          return record.data[key] === value
        })
      })
    }

    // Extract values from the specified column
    const values = records
      .map((record) => {
        const val = record.data[columnKey]
        if (val === null || val === undefined || val === '') return null
        const num = typeof val === 'number' ? val : parseFloat(String(val))
        return isNaN(num) ? null : num
      })
      .filter((val): val is number => val !== null)

    if (values.length === 0) {
      return { success: true, value: 0 }
    }

    // Perform aggregation
    let result: number = 0
    switch (operation) {
      case 'SUM':
        result = values.reduce((sum, val) => sum + val, 0)
        break
      case 'AVERAGE':
        result = values.reduce((sum, val) => sum + val, 0) / values.length
        break
      case 'COUNT':
        result = values.length
        break
      case 'MIN':
        result = Math.min(...values)
        break
      case 'MAX':
        result = Math.max(...values)
        break
    }

    return { success: true, value: result }
  } catch (error: any) {
    console.error('Error calculating aggregation:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

