'use server'

import { supabase } from '@/lib/supabase'

export interface HistoryEntry {
    id: string
    client_id: string
    table_name: string
    record_id: string
    field_name: string
    old_value: string | null
    new_value: string | null
    changed_by: string
    changed_at: string
    change_type: 'create' | 'update' | 'delete'
}

export interface VersionDiff {
    field: string
    oldValue: any
    newValue: any
}

export interface ActionResult {
    success: boolean
    error?: string
}

/**
 * Track a field change in the history
 */
export async function trackChange(params: {
    clientId: string
    tableName: string
    recordId: string
    fieldName: string
    oldValue: any
    newValue: any
    changedBy?: string
    changeType?: 'create' | 'update' | 'delete'
}): Promise<ActionResult> {
    try {
        const { error } = await supabase.from('record_history').insert({
            client_id: params.clientId,
            table_name: params.tableName,
            record_id: params.recordId,
            field_name: params.fieldName,
            old_value: params.oldValue != null ? String(params.oldValue) : null,
            new_value: params.newValue != null ? String(params.newValue) : null,
            changed_by: params.changedBy || 'system',
            change_type: params.changeType || 'update',
        })

        if (error) {
            console.error('Error tracking change:', error)
            return { success: false, error: error.message }
        }

        return { success: true }
    } catch (error: any) {
        console.error('Error tracking change:', error)
        return { success: false, error: error.message }
    }
}

/**
 * Get history for a specific record
 */
export async function getRecordHistory(
    recordId: string
): Promise<{ success: boolean; history?: HistoryEntry[]; error?: string }> {
    try {
        const { data, error } = await supabase
            .from('record_history')
            .select('*')
            .eq('record_id', recordId)
            .order('changed_at', { ascending: false })

        if (error) {
            return { success: false, error: error.message }
        }

        return { success: true, history: data as HistoryEntry[] }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

/**
 * Get recent changes for a client
 */
export async function getClientHistory(
    clientId: string,
    limit: number = 50
): Promise<{ success: boolean; history?: HistoryEntry[]; error?: string }> {
    try {
        const { data, error } = await supabase
            .from('record_history')
            .select('*')
            .eq('client_id', clientId)
            .order('changed_at', { ascending: false })
            .limit(limit)

        if (error) {
            return { success: false, error: error.message }
        }

        return { success: true, history: data as HistoryEntry[] }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

/**
 * Compare two versions of a record
 */
export async function compareVersions(
    recordId: string,
    timestamp1: string,
    timestamp2: string
): Promise<{ success: boolean; diff?: VersionDiff[]; error?: string }> {
    try {
        const { data, error } = await supabase
            .from('record_history')
            .select('*')
            .eq('record_id', recordId)
            .or(`changed_at.eq.${timestamp1},changed_at.eq.${timestamp2}`)
            .order('changed_at', { ascending: true })

        if (error) {
            return { success: false, error: error.message }
        }

        if (!data || data.length < 2) {
            return { success: false, error: 'Not enough versions to compare' }
        }

        const diff: VersionDiff[] = []
        const version1 = data.find((h) => h.changed_at === timestamp1)
        const version2 = data.find((h) => h.changed_at === timestamp2)

        if (version1 && version2) {
            diff.push({
                field: version1.field_name,
                oldValue: version1.old_value,
                newValue: version2.new_value,
            })
        }

        return { success: true, diff }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

/**
 * Get all changes for a specific table/module
 */
export async function getModuleHistory(
    clientId: string,
    tableName: string,
    limit: number = 100
): Promise<{ success: boolean; history?: HistoryEntry[]; error?: string }> {
    try {
        const { data, error } = await supabase
            .from('record_history')
            .select('*')
            .eq('client_id', clientId)
            .eq('table_name', tableName)
            .order('changed_at', { ascending: false })
            .limit(limit)

        if (error) {
            return { success: false, error: error.message }
        }

        return { success: true, history: data as HistoryEntry[] }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}
