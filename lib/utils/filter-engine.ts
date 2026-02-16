// Filter Engine - Advanced filtering logic
// Supports complex conditions with AND/OR logic

export interface FilterCondition {
    field: string
    operator: 'equals' | 'notEquals' | 'contains' | 'notContains' | 'startsWith' | 'endsWith' |
    'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'in' | 'notIn' | 'isEmpty' | 'isNotEmpty'
    value: any
    value2?: any // for 'between' operator
    dataType: 'text' | 'number' | 'date' | 'boolean'
}

export interface FilterGroup {
    logic: 'AND' | 'OR'
    conditions: FilterCondition[]
}

/**
 * Apply filters to a dataset
 */
export function applyFilters(records: any[], filterGroup: FilterGroup): any[] {
    if (!filterGroup.conditions || filterGroup.conditions.length === 0) {
        return records
    }

    return records.filter((record) => {
        const results = filterGroup.conditions.map((condition) =>
            evaluateCondition(record, condition)
        )

        // Apply AND/OR logic
        if (filterGroup.logic === 'AND') {
            return results.every((r) => r === true)
        } else {
            return results.some((r) => r === true)
        }
    })
}

/**
 * Evaluate a single condition against a record
 */
function evaluateCondition(record: any, condition: FilterCondition): boolean {
    const fieldValue = getFieldValue(record, condition.field)
    const { operator, value, value2, dataType } = condition

    // Handle empty checks
    if (operator === 'isEmpty') {
        return fieldValue === null || fieldValue === undefined || fieldValue === ''
    }
    if (operator === 'isNotEmpty') {
        return fieldValue !== null && fieldValue !== undefined && fieldValue !== ''
    }

    // Handle null/undefined values
    if (fieldValue === null || fieldValue === undefined) {
        return false
    }

    // Type-specific evaluation
    switch (dataType) {
        case 'text':
            return evaluateTextCondition(String(fieldValue), operator, value)
        case 'number':
            return evaluateNumberCondition(Number(fieldValue), operator, value, value2)
        case 'date':
            return evaluateDateCondition(fieldValue, operator, value, value2)
        case 'boolean':
            return evaluateBooleanCondition(fieldValue, operator, value)
        default:
            return false
    }
}

/**
 * Get field value from record (supports nested paths)
 */
function getFieldValue(record: any, field: string): any {
    // Support nested fields like "data.amount" or "client.name"
    const parts = field.split('.')
    let value = record

    for (const part of parts) {
        if (value && typeof value === 'object') {
            value = value[part]
        } else {
            return undefined
        }
    }

    return value
}

/**
 * Evaluate text conditions
 */
function evaluateTextCondition(value: string, operator: string, filterValue: any): boolean {
    const valueLower = value.toLowerCase()
    const filterLower = String(filterValue).toLowerCase()

    switch (operator) {
        case 'equals':
            return valueLower === filterLower
        case 'notEquals':
            return valueLower !== filterLower
        case 'contains':
            return valueLower.includes(filterLower)
        case 'notContains':
            return !valueLower.includes(filterLower)
        case 'startsWith':
            return valueLower.startsWith(filterLower)
        case 'endsWith':
            return valueLower.endsWith(filterLower)
        case 'in':
            return Array.isArray(filterValue) && filterValue.some((v) => valueLower === String(v).toLowerCase())
        case 'notIn':
            return Array.isArray(filterValue) && !filterValue.some((v) => valueLower === String(v).toLowerCase())
        default:
            return false
    }
}

/**
 * Evaluate number conditions
 */
function evaluateNumberCondition(value: number, operator: string, filterValue: any, filterValue2?: any): boolean {
    const numFilter = Number(filterValue)
    const numFilter2 = filterValue2 !== undefined ? Number(filterValue2) : undefined

    switch (operator) {
        case 'equals':
            return value === numFilter
        case 'notEquals':
            return value !== numFilter
        case 'gt':
            return value > numFilter
        case 'gte':
            return value >= numFilter
        case 'lt':
            return value < numFilter
        case 'lte':
            return value <= numFilter
        case 'between':
            return numFilter2 !== undefined && value >= numFilter && value <= numFilter2
        case 'in':
            return Array.isArray(filterValue) && filterValue.map(Number).includes(value)
        case 'notIn':
            return Array.isArray(filterValue) && !filterValue.map(Number).includes(value)
        default:
            return false
    }
}

/**
 * Evaluate date conditions
 */
function evaluateDateCondition(value: any, operator: string, filterValue: any, filterValue2?: any): boolean {
    const dateValue = new Date(value)
    const dateFilter = new Date(filterValue)
    const dateFilter2 = filterValue2 ? new Date(filterValue2) : undefined

    if (isNaN(dateValue.getTime()) || isNaN(dateFilter.getTime())) {
        return false
    }

    switch (operator) {
        case 'equals':
            return dateValue.toDateString() === dateFilter.toDateString()
        case 'notEquals':
            return dateValue.toDateString() !== dateFilter.toDateString()
        case 'gt':
            return dateValue > dateFilter
        case 'gte':
            return dateValue >= dateFilter
        case 'lt':
            return dateValue < dateFilter
        case 'lte':
            return dateValue <= dateFilter
        case 'between':
            return dateFilter2 !== undefined && dateValue >= dateFilter && dateValue <= dateFilter2
        default:
            return false
    }
}

/**
 * Evaluate boolean conditions
 */
function evaluateBooleanCondition(value: any, operator: string, filterValue: any): boolean {
    const boolValue = Boolean(value)
    const boolFilter = Boolean(filterValue)

    switch (operator) {
        case 'equals':
            return boolValue === boolFilter
        case 'notEquals':
            return boolValue !== boolFilter
        default:
            return false
    }
}

/**
 * Get human-readable description of a filter
 */
export function getFilterDescription(filterGroup: FilterGroup): string {
    if (!filterGroup.conditions || filterGroup.conditions.length === 0) {
        return 'אין פילטרים'
    }

    const descriptions = filterGroup.conditions.map((condition) => {
        const operatorLabels: Record<string, string> = {
            equals: 'שווה ל',
            notEquals: 'לא שווה ל',
            contains: 'מכיל',
            notContains: 'לא מכיל',
            startsWith: 'מתחיל ב',
            endsWith: 'מסתיים ב',
            gt: 'גדול מ',
            gte: 'גדול או שווה ל',
            lt: 'קטן מ',
            lte: 'קטן או שווה ל',
            between: 'בין',
            in: 'אחד מ',
            notIn: 'לא אחד מ',
            isEmpty: 'ריק',
            isNotEmpty: 'לא ריק',
        }

        const operator = operatorLabels[condition.operator] || condition.operator
        const value = condition.operator === 'between'
            ? `${condition.value} ל-${condition.value2}`
            : Array.isArray(condition.value)
                ? condition.value.join(', ')
                : condition.value

        if (condition.operator === 'isEmpty' || condition.operator === 'isNotEmpty') {
            return `${condition.field} ${operator}`
        }

        return `${condition.field} ${operator} ${value}`
    })

    const logic = filterGroup.logic === 'AND' ? ' וגם ' : ' או '
    return descriptions.join(logic)
}
