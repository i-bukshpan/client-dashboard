'use server'

import { supabase } from '@/lib/supabase'

export interface CustomView {
  id: string
  client_id: string
  module_name: string
  view_name: string
  visible_columns: string[] // Array of column names to show
  column_order: string[] // Order of columns
  filters: Record<string, any> // Saved filters
  sort_by?: string // Column to sort by
  sort_direction?: 'asc' | 'desc'
  created_at: string
  updated_at: string
}

/**
 * Server Action: Get all views for a module
 */
export async function getModuleViews(
  clientId: string,
  moduleName: string
): Promise<{ success: boolean; views?: CustomView[]; error?: string }> {
  try {
    const { data: views, error } = await supabase
      .from('custom_views')
      .select('*')
      .eq('client_id', clientId)
      .eq('module_name', moduleName)
      .order('view_name')

    if (error) {
      console.error('Error fetching views:', error)
      return { success: false, error: error.message }
    }

    return { success: true, views: views as CustomView[] }
  } catch (error: any) {
    console.error('Unexpected error fetching views:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Server Action: Save a view
 */
export async function saveView(
  clientId: string,
  moduleName: string,
  viewName: string,
  viewConfig: {
    visible_columns: string[]
    column_order: string[]
    filters?: Record<string, any>
    sort_by?: string
    sort_direction?: 'asc' | 'desc'
  }
): Promise<{ success: boolean; view?: CustomView; error?: string }> {
  try {
    const { data: view, error } = await supabase
      .from('custom_views')
      .upsert({
        client_id: clientId,
        module_name: moduleName,
        view_name: viewName,
        visible_columns: viewConfig.visible_columns,
        column_order: viewConfig.column_order,
        filters: viewConfig.filters || {},
        sort_by: viewConfig.sort_by,
        sort_direction: viewConfig.sort_direction,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'client_id,module_name,view_name',
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving view:', error)
      return { success: false, error: error.message }
    }

    return { success: true, view: view as CustomView }
  } catch (error: any) {
    console.error('Unexpected error saving view:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Server Action: Delete a view
 */
export async function deleteView(
  clientId: string,
  moduleName: string,
  viewName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('custom_views')
      .delete()
      .eq('client_id', clientId)
      .eq('module_name', moduleName)
      .eq('view_name', viewName)

    if (error) {
      console.error('Error deleting view:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error: any) {
    console.error('Unexpected error deleting view:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

