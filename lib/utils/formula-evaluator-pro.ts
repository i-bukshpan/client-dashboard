/**
 * Enhanced Formula Evaluator with advanced functions
 * Supports: IF, LOOKUP, DATE, TEXT, MATH functions
 */

export interface FormulaContext {
    columnValues: Record<string, any>
    allRecords?: any[] // for LOOKUP/VLOOKUP
    lookupTables?: Record<string, any[]> // for cross-table LOOKUP
}

/**
 * Main formula evaluator
 */
export function evaluateFormula(formula: string, context: FormulaContext): any {
    try {
        // Normalize formula
        const normalized = formula.trim()

        // Check for function calls
        if (normalized.toUpperCase().startsWith('IF(')) {
            return evaluateIF(normalized, context)
        }
        if (normalized.toUpperCase().startsWith('SWITCH(')) {
            return evaluateSWITCH(normalized, context)
        }
        if (normalized.toUpperCase().startsWith('LOOKUP(')) {
            return evaluateLOOKUP(normalized, context)
        }
        if (normalized.toUpperCase().startsWith('TODAY()')) {
            return new Date()
        }
        if (normalized.toUpperCase().startsWith('NOW()')) {
            return new Date()
        }
        if (normalized.toUpperCase().startsWith('CONCAT(')) {
            return evaluateCONCAT(normalized, context)
        }
        if (normalized.toUpperCase().startsWith('UPPER(')) {
            return evaluateUPPER(normalized, context)
        }
        if (normalized.toUpperCase().startsWith('LOWER(')) {
            return evaluateLOWER(normalized, context)
        }
        if (normalized.toUpperCase().startsWith('DATEDIFF(')) {
            return evaluateDATEDIFF(normalized, context)
        }
        if (normalized.toUpperCase().startsWith('DATEADD(')) {
            return evaluateDATEADD(normalized, context)
        }
        if (normalized.toUpperCase().startsWith('ROUND(')) {
            return evaluateROUND(normalized, context)
        }
        if (normalized.toUpperCase().startsWith('ABS(')) {
            return evaluateABS(normalized, context)
        }

        // Otherwise, arithmetic expression
        return evaluateExpression(normalized, context.columnValues)
    } catch (error) {
        console.error('Formula evaluation error:', error)
        return null
    }
}

/**
 * IF(condition, trueValue, falseValue)
 */
function evaluateIF(formula: string, context: FormulaContext): any {
    const match = formula.match(/IF\s*\(\s*(.+?)\s*,\s*(.+?)\s*,\s*(.+?)\s*\)$/i)
    if (!match) return null

    const [, condition, trueVal, falseVal] = match
    const conditionResult = evaluateCondition(condition, context)

    return conditionResult
        ? getValue(trueVal.trim(), context)
        : getValue(falseVal.trim(), context)
}

/**
 * SWITCH(expr, case1, result1, case2, result2, ..., default)
 */
function evaluateSWITCH(formula: string, context: FormulaContext): any {
    const argsMatch = formula.match(/SWITCH\s*\((.+)\)$/i)
    if (!argsMatch) return null

    const args = parseArguments(argsMatch[1])
    if (args.length < 3) return null

    const expr = getValue(args[0], context)

    // Check pairs
    for (let i = 1; i < args.length - 1; i += 2) {
        const caseVal = getValue(args[i], context)
        if (expr == caseVal) {
            return getValue(args[i + 1], context)
        }
    }

    // Default (last arg if odd number)
    if (args.length % 2 === 0) {
        return getValue(args[args.length - 1], context)
    }

    return null
}

/**
 * LOOKUP(key, table, keyColumn, valueColumn)
 * Note: Simplified version, real implementation would query database
 */
function evaluateLOOKUP(formula: string, context: FormulaContext): any {
    const match = formula.match(/LOOKUP\s*\(\s*(.+?)\s*,\s*['"](.+?)['"]\s*,\s*['"](.+?)['"]\s*,\s*['"](.+?)['"]\s*\)$/i)
    if (!match) return null

    const [, keyExpr, tableName, keyColumn, valueColumn] = match
    const key = getValue(keyExpr, context)

    // Get table data from context
    const tableData = context.lookupTables?.[tableName]
    if (!tableData) return null

    const record = tableData.find((r) => r[keyColumn] === key || r.data?.[keyColumn] === key)
    if (record) {
        return record[valueColumn] || record.data?.[value Column] || null
    }

    return null
}

/**
 * CONCAT(text1, text2, ...)
 */
function evaluateCONCAT(formula: string, context: FormulaContext): string {
    const argsMatch = formula.match(/CONCAT\s*\((.+)\)$/i)
    if (!argsMatch) return ''

    const args = parseArguments(argsMatch[1])
    return args.map((arg) => String(getValue(arg, context) || '')).join('')
}

/**
 * UPPER(text)
 */
function evaluateUPPER(formula: string, context: FormulaContext): string {
    const match = formula.match(/UPPER\s*\((.+)\)$/i)
    if (!match) return ''

    const value = getValue(match[1], context)
    return String(value || '').toUpperCase()
}

/**
 * LOWER(text)
 */
function evaluateLOWER(formula: string, context: FormulaContext): string {
    const match = formula.match(/LOWER\s*\((.+)\)$/i)
    if (!match) return ''

    const value = getValue(match[1], context)
    return String(value || '').toLowerCase()
}

/**
 * DATEDIFF(date1, date2, unit)
 * unit: 'days', 'months', 'years'
 */
function evaluateDATEDIFF(formula: string, context: FormulaContext): number {
    const match = formula.match(/DATEDIFF\s*\(\s*(.+?)\s*,\s*(.+?)\s*,\s*['"](.+?)['"]\s*\)$/i)
    if (!match) return 0

    const [, date1Expr, date2Expr, unit] = match
    const date1 = new Date(getValue(date1Expr, context))
    const date2 = new Date(getValue(date2Expr, context))

    if (isNaN(date1.getTime()) || isNaN(date2.getTime())) return 0

    const diffMs = date1.getTime() - date2.getTime()

    switch (unit.toLowerCase()) {
        case 'days':
            return Math.floor(diffMs / (1000 * 60 * 60 * 24))
        case 'months':
            return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.44))
        case 'years':
            return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25))
        default:
            return 0
    }
}

/**
 * DATEADD(date, amount, unit)
 */
function evaluateDATEADD(formula: string, context: FormulaContext): Date | null {
    const match = formula.match(/DATEADD\s*\(\s*(.+?)\s*,\s*(.+?)\s*,\s*['"](.+?)['"]\s*\)$/i)
    if (!match) return null

    const [, dateExpr, amountExpr, unit] = match
    const date = new Date(getValue(dateExpr, context))
    const amount = Number(getValue(amountExpr, context))

    if (isNaN(date.getTime()) || isNaN(amount)) return null

    const result = new Date(date)

    switch (unit.toLowerCase()) {
        case 'days':
            result.setDate(result.getDate() + amount)
            break
        case 'months':
            result.setMonth(result.getMonth() + amount)
            break
        case 'years':
            result.setFullYear(result.getFullYear() + amount)
            break
    }

    return result
}

/**
 * ROUND(number, decimals)
 */
function evaluateROUND(formula: string, context: FormulaContext): number {
    const match = formula.match(/ROUND\s*\(\s*(.+?)\s*,\s*(.+?)\s*\)$/i)
    if (!match) return 0

    const [, numExpr, decimalsExpr] = match
    const num = Number(getValue(numExpr, context))
    const decimals = Number(getValue(decimalsExpr, context))

    if (isNaN(num) || isNaN(decimals)) return 0

    return Number(num.toFixed(decimals))
}

/**
 * ABS(number)
 */
function evaluateABS(formula: string, context: FormulaContext): number {
    const match = formula.match(/ABS\s*\((.+)\)$/i)
    if (!match) return 0

    const num = Number(getValue(match[1], context))
    return isNaN(num) ? 0 : Math.abs(num)
}

/**
 * Evaluate a condition (for IF statements)
 */
function evaluateCondition(condition: string, context: FormulaContext): boolean {
    const operators = [
        { op: '>=', regex: /(.+?)\s*>=\s*(.+)/ },
        { op: '<=', regex: /(.+?)\s*<=\s*(.+)/ },
        { op: '>', regex: /(.+?)\s*>\s*(.+)/ },
        { op: '<', regex: /(.+?)\s*<\s*(.+)/ },
        { op: '==', regex: /(.+?)\s*==\s*(.+)/ },
        { op: '!=', regex: /(.+?)\s*!=\s*(.+)/ },
    ]

    for (const { op, regex } of operators) {
        const match = condition.match(regex)
        if (match) {
            const [, left, right] = match
            const leftVal = getValue(left.trim(), context)
            const rightVal = getValue(right.trim(), context)

            switch (op) {
                case '>': return leftVal > rightVal
                case '<': return leftVal < rightVal
                case '>=': return leftVal >= rightVal
                case '<=': return leftVal <= rightVal
                case '==': return leftVal == rightVal
                case '!=': return leftVal != rightVal
            }
        }
    }

    return false
}

/**
 * Get value from expression
 */
function getValue(expr: string, context: FormulaContext): any {
    expr = expr.trim()

    // Number
    const num = parseFloat(expr)
    if (!isNaN(num) && expr === String(num)) {
        return num
    }

    // String literal
    if ((expr.startsWith('"') && expr.endsWith('"')) || (expr.startsWith("'") && expr.endsWith("'"))) {
        return expr.slice(1, -1)
    }

    // Special: TODAY(), NOW()
    if (expr.toUpperCase() === 'TODAY()' || expr.toUpperCase() === 'NOW()') {
        return new Date()
    }

    // Column reference
    if (context.columnValues[expr] !== undefined) {
        return context.columnValues[expr]
    }

    // Nested formula
    if (expr.includes('(')) {
        return evaluateFormula(expr, context)
    }

    // Try as expression
    try {
        return evaluateExpression(expr, context.columnValues)
    } catch {
        return expr
    }
}

/**
 * Evaluate arithmetic expression
 */
function evaluateExpression(expression: string, columnValues: Record<string, any>): number {
    try {
        let evaluatedExpression = expression
        Object.entries(columnValues).forEach(([colName, value]) => {
            const numValue = typeof value === 'number' ? value : parseFloat(String(value || 0))
            if (!isNaN(numValue)) {
                const regex = new RegExp(`\\b${colName}\\b`, 'g')
                evaluatedExpression = evaluatedExpression.replace(regex, String(numValue))
            }
        })

        const sanitized = evaluatedExpression.replace(/[^0-9+\-*/(). \s]/g, '')
        const result = Function(`"use strict"; return (${sanitized})`)()
        return typeof result === 'number' ? result : 0
    } catch (error) {
        console.error('Error evaluating expression:', error)
        return 0
    }
}

/**
 * Parse function arguments (handles nested parentheses)
 */
function parseArguments(argsString: string): string[] {
    const args: string[] = []
    let current = ''
    let depth = 0

    for (const char of argsString) {
        if (char === '(') {
            depth++
            current += char
        } else if (char === ')') {
            depth--
            current += char
        } else if (char === ',' && depth === 0) {
            args.push(current.trim())
            current = ''
        } else {
            current += char
        }
    }

    if (current.trim()) {
        args.push(current.trim())
    }

    return args
}

// Export backward compatibility
export { evaluateFormula as evaluateFormulaExpression }
