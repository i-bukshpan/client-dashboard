'use server'

import { supabase } from '@/lib/supabase'
import type { FilterGroup } from '@/lib/utils/filter-engine'

export interface SavedFilter {
    id: string
    client_id: string
    name: string
    description?: string | null
    filter_config: FilterGroup
    module_name: string
    is_shared: boolean
    created_by: string
    created_at: string
}

/**
 * Save a filter configuration
 */
export async function saveFilter(filter: Omit<SavedFilter, 'id' | 'created_at'>): Promise<{
    success: boolean
    filter?: SavedFilter
    error?: string
}> {
    try {
        const { data, error } = await supabase
            .from('saved_filters')
            .insert({
                client_id: filter.client_id,
                name: filter.name,
                description: filter.description,
                filter_config: filter.filter_config as any,
                module_name: filter.module_name,
                is_shared: filter.is_shared,
                created_by: filter.created_by,
            })
            .select()
            .single()

        if (error) {
            return { success: false, error: error.message }
        }

        return { success: true, filter: data as SavedFilter }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

/**
 * Get all saved filters for a client and module
 */
export async function getSavedFilters(
    clientId: string,
    moduleName: string
): Promise<{
    success: boolean
    filters?: SavedFilter[]
    error?: string
}> {
    try {
        const { data, error } = await supabase
            .from('saved_filters')
            .select('*')
            .eq('client_id', clientId)
            .eq('module_name', moduleName)
            .order('created_at', { ascending: false })

        if (error) {
            return { success: false, error: error.message }
        }

        return { success: true, filters: data as SavedFilter[] }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

/**
 * Delete a saved filter
 */
export async function deleteSavedFilter(filterId: string): Promise<{
    success: boolean
    error?: string
}> {
    try {
        const { error } = await supabase.from('saved_filters').delete().eq('id', filterId)

        if (error) {
            return { success: false, error: error.message }
        }

        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

/**
 * Update a saved filter
 */
export async function updateSavedFilter(
    filterId: string,
    updates: Partial<SavedFilter>
): Promise<{
    success: boolean
    error?: string
}> {
    try {
        const { error } = await supabase
            .from('saved_filters')
            .update({
                name: updates.name,
                description: updates.description,
                filter_config: updates.filter_config as any,
                is_shared: updates.is_shared,
            })
            .eq('id', filterId)

        if (error) {
            return { success: false, error: error.message }
        }

        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}
