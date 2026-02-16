'use server'

import { supabase } from '@/lib/supabase'
import type { Goal } from '@/lib/supabase'
import { logAction } from '@/lib/audit-log'

/**
 * Server Action: Get all goals
 */
export async function getGoals(): Promise<{ success: boolean; goals?: Goal[]; error?: string }> {
  try {
    const { data: goals, error } = await supabase
      .from('goals')
      .select('*')
      .order('target_date', { ascending: true })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching goals:', error)
      return { success: false, error: error.message }
    }

    return { success: true, goals: goals as Goal[] }
  } catch (error: any) {
    console.error('Unexpected error fetching goals:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Server Action: Create a new goal
 */
export async function createGoal(
  goal: Omit<Goal, 'id' | 'created_at' | 'updated_at' | 'current_value'>
): Promise<{ success: boolean; goal?: Goal; error?: string }> {
  try {
    const { data: newGoal, error } = await supabase
      .from('goals')
      .insert({
        ...goal,
        current_value: 0,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating goal:', error)
      return { success: false, error: error.message }
    }

    await logAction(
      'goal.created',
      'goal',
      newGoal.id,
      `Created goal: ${goal.title || goal.goal_type}`,
      { goalType: goal.goal_type, targetValue: goal.target_value }
    )

    return { success: true, goal: newGoal as Goal }
  } catch (error: any) {
    console.error('Unexpected error creating goal:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Server Action: Update a goal
 */
export async function updateGoal(
  id: string,
  updates: Partial<Omit<Goal, 'id' | 'created_at' | 'updated_at'>>
): Promise<{ success: boolean; goal?: Goal; error?: string }> {
  try {
    const { data: updatedGoal, error } = await supabase
      .from('goals')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating goal:', error)
      return { success: false, error: error.message }
    }

    await logAction(
      'goal.updated',
      'goal',
      id,
      `Updated goal: ${updates.title || id}`,
      updates
    )

    return { success: true, goal: updatedGoal as Goal }
  } catch (error: any) {
    console.error('Unexpected error updating goal:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Server Action: Delete a goal
 */
export async function deleteGoal(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('goals')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting goal:', error)
      return { success: false, error: error.message }
    }

    await logAction('goal.deleted', 'goal', id, 'Deleted goal')

    return { success: true }
  } catch (error: any) {
    console.error('Unexpected error deleting goal:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Server Action: Update goal current value (used for progress tracking)
 */
export async function updateGoalProgress(
  id: string,
  currentValue: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: goal, error: fetchError } = await supabase
      .from('goals')
      .select('target_value, status')
      .eq('id', id)
      .single()

    if (fetchError) {
      return { success: false, error: fetchError.message }
    }

    let status = goal.status
    if (currentValue >= goal.target_value && status === 'active') {
      status = 'achieved'
    }

    const { error } = await supabase
      .from('goals')
      .update({ current_value: currentValue, status })
      .eq('id', id)

    if (error) {
      console.error('Error updating goal progress:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error: any) {
    console.error('Unexpected error updating goal progress:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

