'use server'

import { supabase } from '@/lib/supabase'
import type { ColumnDefinition } from '@/lib/supabase'

export interface ValidationRule {
    id: string
    client_id: string
    module_name: string
    field_name: string
    rule_type: 'required' | 'min' | 'max' | 'pattern' | 'custom' | 'email' | 'phone' | 'url'
    rule_value?: string | null
    error_message: string
    is_active: boolean
    created_at: string
}

export interface ValidationResult {
    isValid: boolean
    errors: Array<{
        field: string
        message: string
    }>
}

export interface BulkValidationReport {
    totalRecords: number
    validRecords: number
    invalidRecords: number
    errors: Array<{
        recordId: string
        field: string
        value: any
        message: string
    }>
}

/**
 * Validate a single field against rules
 */
export function validateField(value: any, rules: ValidationRule[]): ValidationResult {
    const errors: Array<{ field: string; message: string }> = []

    for (const rule of rules) {
        if (!rule.is_active) continue

        switch (rule.rule_type) {
            case 'required':
                if (value === null || value === undefined || value === '') {
                    errors.push({ field: rule.field_name, message: rule.error_message })
                }
                break

            case 'min':
                if (rule.rule_value && typeof value === 'number') {
                    const minValue = parseFloat(rule.rule_value)
                    if (value < minValue) {
                        errors.push({ field: rule.field_name, message: rule.error_message })
                    }
                }
                break

            case 'max':
                if (rule.rule_value && typeof value === 'number') {
                    const maxValue = parseFloat(rule.rule_value)
                    if (value > maxValue) {
                        errors.push({ field: rule.field_name, message: rule.error_message })
                    }
                }
                break

            case 'pattern':
                if (rule.rule_value && typeof value === 'string') {
                    const regex = new RegExp(rule.rule_value)
                    if (!regex.test(value)) {
                        errors.push({ field: rule.field_name, message: rule.error_message })
                    }
                }
                break

            case 'email':
                if (value && typeof value === 'string') {
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
                    if (!emailRegex.test(value)) {
                        errors.push({ field: rule.field_name, message: rule.error_message })
                    }
                }
                break

            case 'phone':
                if (value && typeof value === 'string') {
                    const phoneRegex = /^0[2-9]\d{1,2}-?\d{7}$/
                    if (!phoneRegex.test(value.replace(/\s/g, ''))) {
                        errors.push({ field: rule.field_name, message: rule.error_message })
                    }
                }
                break

            case 'url':
                if (value && typeof value === 'string') {
                    try {
                        new URL(value)
                    } catch {
                        errors.push({ field: rule.field_name, message: rule.error_message })
                    }
                }
                break
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
    }
}

/**
 * Validate an entire record
 */
export async function validateRecord(
    data: Record<string, any>,
    moduleName: string,
    clientId: string
): Promise<ValidationResult> {
    try {
        const rulesResult = await getValidationRules(clientId, moduleName)
        if (!rulesResult.success || !rulesResult.rules) {
            return { isValid: true, errors: [] }
        }

        const allErrors: Array<{ field: string; message: string }> = []

        for (const [fieldName, value] of Object.entries(data)) {
            const fieldRules = rulesResult.rules.filter((r) => r.field_name === fieldName)
            if (fieldRules.length > 0) {
                const result = validateField(value, fieldRules)
                allErrors.push(...result.errors)
            }
        }

        return {
            isValid: allErrors.length === 0,
            errors: allErrors,
        }
    } catch (error: any) {
        console.error('Error validating record:', error)
        return { isValid: false, errors: [{ field: 'general', message: error.message }] }
    }
}

/**
 * Get validation rules for a module
 */
export async function getValidationRules(
    clientId: string,
    moduleName: string
): Promise<{ success: boolean; rules?: ValidationRule[]; error?: string }> {
    try {
        const { data, error } = await supabase
            .from('validation_rules')
            .select('*')
            .eq('client_id', clientId)
            .eq('module_name', moduleName)
            .eq('is_active', true)

        if (error) {
            return { success: false, error: error.message }
        }

        return { success: true, rules: data as ValidationRule[] }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

/**
 * Add a new validation rule
 */
export async function addValidationRule(rule: Omit<ValidationRule, 'id' | 'created_at'>): Promise<{
    success: boolean
    rule?: ValidationRule
    error?: string
}> {
    try {
        const { data, error } = await supabase
            .from('validation_rules')
            .insert(rule)
            .select()
            .single()

        if (error) {
            return { success: false, error: error.message }
        }

        return { success: true, rule: data as ValidationRule }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

/**
 * Update a validation rule
 */
export async function updateValidationRule(
    ruleId: string,
    updates: Partial<ValidationRule>
): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase
            .from('validation_rules')
            .update(updates)
            .eq('id', ruleId)

        if (error) {
            return { success: false, error: error.message }
        }

        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

/**
 * Delete a validation rule
 */
export async function deleteValidationRule(ruleId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.from('validation_rules').delete().eq('id', ruleId)

        if (error) {
            return { success: false, error: error.message }
        }

        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}
