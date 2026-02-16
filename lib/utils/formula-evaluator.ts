/**
 * Formula evaluator for row-level calculations
 */

/**
 * Evaluate a simple expression with column references
 * Supports: +, -, *, /, parentheses
 * Example: "income - expense", "(amount * quantity) / 2"
 */
export function evaluateExpression(
  expression: string,
  columnValues: Record<string, any>
): number {
  try {
    // Replace column references with actual values
    let evaluatedExpression = expression
    Object.entries(columnValues).forEach(([colName, value]) => {
      const numValue = typeof value === 'number' ? value : parseFloat(String(value || 0))
      if (!isNaN(numValue)) {
        // Replace column name with its value
        const regex = new RegExp(`\\b${colName}\\b`, 'g')
        evaluatedExpression = evaluatedExpression.replace(regex, String(numValue))
      }
    })

    // Evaluate the expression safely
    // Only allow basic arithmetic operations
    const sanitized = evaluatedExpression.replace(/[^0-9+\-*/().\s]/g, '')
    const result = Function(`"use strict"; return (${sanitized})`)()
    return typeof result === 'number' ? result : 0
  } catch (error) {
    console.error('Error evaluating expression:', error)
    return 0
  }
}

/**
 * Evaluate an IF statement
 * Syntax: IF(condition, trueValue, falseValue)
 * Example: IF(amount > 1000, 'high', 'low')
 */
export function evaluateIfStatement(
  expression: string,
  columnValues: Record<string, any>
): any {
  try {
    // Simple IF pattern: IF(condition, trueValue, falseValue)
    const ifMatch = expression.match(/IF\s*\(\s*(.+?)\s*,\s*(.+?)\s*,\s*(.+?)\s*\)/i)
    if (!ifMatch) return null

    const [, condition, trueValue, falseValue] = ifMatch

    // Evaluate condition (supports: >, <, >=, <=, ==, !=)
    let conditionResult = false
    const conditionOperators = [
      { op: '>=', regex: /(.+?)\s*>=\s*(.+?)/ },
      { op: '<=', regex: /(.+?)\s*<=\s*(.+?)/ },
      { op: '>', regex: /(.+?)\s*>\s*(.+?)/ },
      { op: '<', regex: /(.+?)\s*<\s*(.+?)/ },
      { op: '==', regex: /(.+?)\s*==\s*(.+?)/ },
      { op: '!=', regex: /(.+?)\s*!=\s*(.+?)/ },
    ]

    for (const { op, regex } of conditionOperators) {
      const match = condition.match(regex)
      if (match) {
        const [, left, right] = match
        const leftVal = getValue(left.trim(), columnValues)
        const rightVal = getValue(right.trim(), columnValues)

        switch (op) {
          case '>':
            conditionResult = leftVal > rightVal
            break
          case '<':
            conditionResult = leftVal < rightVal
            break
          case '>=':
            conditionResult = leftVal >= rightVal
            break
          case '<=':
            conditionResult = leftVal <= rightVal
            break
          case '==':
            conditionResult = leftVal == rightVal
            break
          case '!=':
            conditionResult = leftVal != rightVal
            break
        }
        break
      }
    }

    const resultValue = conditionResult ? trueValue.trim() : falseValue.trim()
    return getValue(resultValue, columnValues)
  } catch (error) {
    console.error('Error evaluating IF statement:', error)
    return null
  }
}

function getValue(expr: string, columnValues: Record<string, any>): any {
  // If it's a number, return it
  const num = parseFloat(expr)
  if (!isNaN(num) && expr.trim() === String(num)) {
    return num
  }

  // If it's a string in quotes, return it without quotes
  if ((expr.startsWith('"') && expr.endsWith('"')) || (expr.startsWith("'") && expr.endsWith("'"))) {
    return expr.slice(1, -1)
  }

  // If it's a column reference, return its value
  if (columnValues[expr] !== undefined) {
    return columnValues[expr]
  }

  // Otherwise try to evaluate as expression
  try {
    return evaluateExpression(expr, columnValues)
  } catch {
    return expr
  }
}

/**
 * Evaluate a formula expression (supports both expressions and IF statements)
 */
export function evaluateFormulaExpression(
  expression: string,
  columnValues: Record<string, any>
): any {
  // Check if it's an IF statement
  if (expression.trim().toUpperCase().startsWith('IF(')) {
    return evaluateIfStatement(expression, columnValues)
  }

  // Otherwise treat as arithmetic expression
  return evaluateExpression(expression, columnValues)
}

