'use server'

import { supabase } from '@/lib/supabase'
import type { GlobalTemplate, GlobalCategory } from '@/lib/supabase'
import { logAction } from '@/lib/audit-log'

/**
 * Server Action: Get all global templates
 */
export async function getGlobalTemplates(
  templateType?: GlobalTemplate['template_type']
): Promise<{ success: boolean; templates?: GlobalTemplate[]; error?: string }> {
  try {
    let query = supabase.from('global_templates').select('*').order('name')

    if (templateType) {
      query = query.eq('template_type', templateType)
    }

    const { data: templates, error } = await query

    if (error) {
      console.error('Error fetching templates:', error)
      return { success: false, error: error.message }
    }

    return { success: true, templates: templates as GlobalTemplate[] }
  } catch (error: any) {
    console.error('Unexpected error fetching templates:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Server Action: Create a global template
 */
export async function createGlobalTemplate(
  template: Omit<GlobalTemplate, 'id' | 'created_at' | 'updated_at'>
): Promise<{ success: boolean; template?: GlobalTemplate; error?: string }> {
  try {
    const { data: newTemplate, error } = await supabase
      .from('global_templates')
      .insert(template)
      .select()
      .single()

    if (error) {
      console.error('Error creating template:', error)
      return { success: false, error: error.message }
    }

    await logAction(
      'template.created',
      'global_template',
      newTemplate.id,
      `Created template: ${template.name}`,
      { templateType: template.template_type }
    )

    return { success: true, template: newTemplate as GlobalTemplate }
  } catch (error: any) {
    console.error('Unexpected error creating template:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Server Action: Update a global template
 */
export async function updateGlobalTemplate(
  id: string,
  updates: Partial<Omit<GlobalTemplate, 'id' | 'created_at' | 'updated_at'>>
): Promise<{ success: boolean; template?: GlobalTemplate; error?: string }> {
  try {
    const { data: updatedTemplate, error } = await supabase
      .from('global_templates')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating template:', error)
      return { success: false, error: error.message }
    }

    await logAction('template.updated', 'global_template', id, `Updated template: ${updates.name || id}`)

    return { success: true, template: updatedTemplate as GlobalTemplate }
  } catch (error: any) {
    console.error('Unexpected error updating template:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Server Action: Delete a global template
 */
export async function deleteGlobalTemplate(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('global_templates')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting template:', error)
      return { success: false, error: error.message }
    }

    await logAction('template.deleted', 'global_template', id, 'Deleted template')

    return { success: true }
  } catch (error: any) {
    console.error('Unexpected error deleting template:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Server Action: Get all global categories
 */
export async function getGlobalCategories(
  type?: 'income' | 'expense'
): Promise<{ success: boolean; categories?: GlobalCategory[]; error?: string }> {
  try {
    let query = supabase.from('global_categories').select('*').order('name')

    if (type) {
      query = query.eq('type', type)
    }

    const { data: categories, error } = await query

    if (error) {
      console.error('Error fetching categories:', error)
      return { success: false, error: error.message }
    }

    return { success: true, categories: categories as GlobalCategory[] }
  } catch (error: any) {
    console.error('Unexpected error fetching categories:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Server Action: Create a global category
 */
export async function createGlobalCategory(
  category: Omit<GlobalCategory, 'id' | 'created_at' | 'updated_at'>
): Promise<{ success: boolean; category?: GlobalCategory; error?: string }> {
  try {
    const { data: newCategory, error } = await supabase
      .from('global_categories')
      .insert(category)
      .select()
      .single()

    if (error) {
      console.error('Error creating category:', error)
      return { success: false, error: error.message }
    }

    await logAction('category.created', 'global_category', newCategory.id, `Created category: ${category.name}`)

    return { success: true, category: newCategory as GlobalCategory }
  } catch (error: any) {
    console.error('Unexpected error creating category:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Server Action: Delete a global category
 */
export async function deleteGlobalCategory(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('global_categories')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting category:', error)
      return { success: false, error: error.message }
    }

    await logAction('category.deleted', 'global_category', id, 'Deleted category')

    return { success: true }
  } catch (error: any) {
    console.error('Unexpected error deleting category:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

