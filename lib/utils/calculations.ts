/**
 * Calculation engine for cross-table formulas and aggregations
 */

import { getRecords } from '@/lib/actions/data-records'
import { getClientSchemas, getSchema } from '@/lib/actions/schema'
import type { FormulaMetadata, ClientDataRecord, ColumnDefinition } from '@/lib/supabase'

/**
 * Get aggregated value from a module's column
 */
export async function getModuleAggregation(
  clientId: string,
  moduleName: string,
  columnKey: string,
  operation: 'SUM' | 'AVERAGE' | 'COUNT' | 'MIN' | 'MAX',
  filter?: Record<string, any>
): Promise<number> {
  try {
    // Get all records for the target module
    const recordsResult = await getRecords(clientId, moduleName)
    if (!recordsResult.success || !recordsResult.records) {
      return 0
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
        const num = typeof val === 'number' ? val : parseFloat(val)
        return isNaN(num) ? null : num
      })
      .filter((val): val is number => val !== null)

    if (values.length === 0) {
      return 0
    }

    // Perform aggregation
    switch (operation) {
      case 'SUM':
        return values.reduce((sum, val) => sum + val, 0)
      case 'AVERAGE':
        return values.reduce((sum, val) => sum + val, 0) / values.length
      case 'COUNT':
        return values.length
      case 'MIN':
        return Math.min(...values)
      case 'MAX':
        return Math.max(...values)
      default:
        return 0
    }
  } catch (error) {
    console.error('Error calculating aggregation:', error)
    return 0
  }
}

/**
 * Evaluate a formula column value for a specific record
 * Note: For formula columns, we typically calculate based on all records in the target module
 * rather than per-record, but this function can be used for record-specific calculations
 */
export async function evaluateFormula(
  clientId: string,
  formula: FormulaMetadata
): Promise<number> {
  return getModuleAggregation(
    clientId,
    formula.target_module_name,
    formula.target_column_key,
    formula.operation,
    formula.filter
  )
}

/**
 * Evaluate all formula columns in a schema and return calculated values
 */
export async function evaluateFormulaColumns(
  clientId: string,
  schemaColumns: ColumnDefinition[]
): Promise<Record<string, number>> {
  const results: Record<string, number> = {}

  for (const column of schemaColumns) {
    if (column.type === 'formula' || column.type === 'reference') {
      if (column.formula) {
        results[column.name] = await evaluateFormula(clientId, column.formula)
      }
    }
  }

  return results
}

