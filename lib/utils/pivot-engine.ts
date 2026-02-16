// Pivot Table Engine
// Generates pivot tables from data with dynamic grouping and aggregations

export interface PivotConfig {
    rows: string[]          // Fields to group by (rows)
    columns?: string[]      // Fields to pivot (columns) - optional
    values: Array<{
        field: string
        aggregation: 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX' | 'MEDIAN'
        label?: string
    }>
    filters?: any           // Pre-filter data (optional)
}

export interface PivotRow {
    [key: string]: any      // Dynamic row data
}

export interface PivotResult {
    headers: string[]       // Column headers
    rows: PivotRow[]        // Data rows
    totals?: Record<string, number>  // Grand totals
    columnTotals?: Record<string, number>  // Column-wise totals
}

/**
 * Generate a pivot table from data
 */
export function generatePivot(data: any[], config: PivotConfig): PivotResult {
    // Apply filters if any
    let filteredData = data
    if (config.filters) {
        // TODO: Apply filters using filter-engine
        filteredData = data
    }

    // If no pivot columns, create simple grouped table
    if (!config.columns || config.columns.length === 0) {
        return generateSimpleGrouping(filteredData, config)
    }

    // Create full pivot table with row and column dimensions
    return generateFullPivot(filteredData, config)
}

/**
 * Generate simple grouped table (no column pivoting)
 */
function generateSimpleGrouping(data: any[], config: PivotConfig): PivotResult {
    const groups = new Map<string, any[]>()

    // Group data by row fields
    for (const record of data) {
        const key = config.rows.map((field) => getFieldValue(record, field)).join('|')
        if (!groups.has(key)) {
            groups.set(key, [])
        }
        groups.get(key)!.push(record)
    }

    // Calculate aggregations for each group
    const rows: PivotRow[] = []
    const totals: Record<string, number> = {}

    for (const [key, groupRecords] of groups.entries()) {
        const row: PivotRow = {}

        // Add row dimension values
        const keyParts = key.split('|')
        config.rows.forEach((field, i) => {
            row[field] = keyParts[i]
        })

        // Calculate value aggregations
        for (const valueConfig of config.values) {
            const { field, aggregation, label } = valueConfig
            const columnName = label || `${aggregation}(${field})`
            const values = groupRecords.map((r) => getFieldValue(r, field))
            const aggregated = aggregate(values, aggregation)

            row[columnName] = aggregated

            // Add to totals
            if (!totals[columnName]) {
                totals[columnName] = 0
            }
            totals[columnName] += aggregated
        }

        rows.push(row)
    }

    // Build headers
    const headers = [
        ...config.rows,
        ...config.values.map((v) => v.label || `${v.aggregation}(${v.field})`)
    ]

    return { headers, rows, totals }
}

/**
 * Generate full pivot table with row and column dimensions
 */
function generateFullPivot(data: any[], config: PivotConfig): PivotResult {
    if (!config.columns || config.columns.length === 0) {
        return generateSimpleGrouping(data, config)
    }

    // Get all unique column values
    const columnValues = new Set<string>()
    for (const record of data) {
        const colKey = config.columns.map((field) => getFieldValue(record, field)).join('|')
        columnValues.add(colKey)
    }

    const sortedColumnValues = Array.from(columnValues).sort()

    // Group data by rows and columns
    const pivotMap = new Map<string, Map<string, any[]>>()

    for (const record of data) {
        const rowKey = config.rows.map((field) => getFieldValue(record, field)).join('|')
        const colKey = config.columns.map((field) => getFieldValue(record, field)).join('|')

        if (!pivotMap.has(rowKey)) {
            pivotMap.set(rowKey, new Map())
        }
        if (!pivotMap.get(rowKey)!.has(colKey)) {
            pivotMap.get(rowKey)!.set(colKey, [])
        }
        pivotMap.get(rowKey)!.get(colKey)!.push(record)
    }

    // Build result rows
    const rows: PivotRow[] = []
    const columnTotals: Record<string, number> = {}

    for (const [rowKey, colMap] of pivotMap.entries()) {
        const row: PivotRow = {}

        // Add row dimension values
        const rowKeyParts = rowKey.split('|')
        config.rows.forEach((field, i) => {
            row[field] = rowKeyParts[i]
        })

        // For each column value, calculate aggregations
        for (const colValue of sortedColumnValues) {
            const cellRecords = colMap.get(colValue) || []

            for (const valueConfig of config.values) {
                const { field, aggregation, label } = valueConfig
                const columnName = `${colValue}|${label || field}`
                const values = cellRecords.map((r) => getFieldValue(r, field))
                const aggregated = aggregate(values, aggregation)

                row[columnName] = aggregated

                // Add to column totals
                if (!columnTotals[columnName]) {
                    columnTotals[columnName] = 0
                }
                columnTotals[columnName] += aggregated
            }
        }

        rows.push(row)
    }

    // Build headers
    const headers = [
        ...config.rows,
        ...sortedColumnValues.flatMap((colValue) =>
            config.values.map((v) => `${colValue}|${v.label || v.field}`)
        )
    ]

    return { headers, rows, columnTotals }
}

/**
 * Get field value from record (supports nested paths and data object)
 */
function getFieldValue(record: any, field: string): any {
    // Try direct access
    if (record[field] !== undefined) {
        return record[field]
    }

    // Try data object
    if (record.data && record.data[field] !== undefined) {
        return record.data[field]
    }

    // Try nested path
    const parts = field.split('.')
    let value = record
    for (const part of parts) {
        if (value && typeof value === 'object') {
            value = value[part]
        } else {
            return null
        }
    }

    return value
}

/**
 * Aggregate values based on aggregation type
 */
function aggregate(values: any[], aggregation: string): number {
    const numericValues = values
        .map((v) => (typeof v === 'number' ? v : parseFloat(String(v || 0))))
        .filter((v) => !isNaN(v))

    if (numericValues.length === 0) {
        return 0
    }

    switch (aggregation) {
        case 'SUM':
            return numericValues.reduce((sum, val) => sum + val, 0)

        case 'AVG':
            return numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length

        case 'COUNT':
            return values.length

        case 'MIN':
            return Math.min(...numericValues)

        case 'MAX':
            return Math.max(...numericValues)

        case 'MEDIAN':
            const sorted = [...numericValues].sort((a, b) => a - b)
            const mid = Math.floor(sorted.length / 2)
            return sorted.length % 2 === 0
                ? (sorted[mid - 1] + sorted[mid]) / 2
                : sorted[mid]

        default:
            return 0
    }
}

/**
 * Export pivot table to CSV format
 */
export function exportPivotToCSV(result: PivotResult): string {
    const lines: string[] = []

    // Headers
    lines.push(result.headers.join(','))

    // Data rows
    for (const row of result.rows) {
        const values = result.headers.map((header) => {
            const value = row[header]
            if (value === null || value === undefined) return ''
            const stringValue = String(value)
            // Escape commas and quotes
            if (stringValue.includes(',') || stringValue.includes('"')) {
                return `"${stringValue.replace(/"/g, '""')}"`
            }
            return stringValue
        })
        lines.push(values.join(','))
    }

    // Totals row (if available)
    if (result.totals) {
        const totalValues = result.headers.map((header) => {
            return result.totals![header] !== undefined ? String(result.totals![header]) : ''
        })
        lines.push(totalValues.join(','))
    }

    return lines.join('\n')
}
