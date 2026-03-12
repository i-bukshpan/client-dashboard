'use server'

import { supabase } from '@/lib/supabase'
import type { Reminder } from '@/lib/supabase'
import { addDays, addWeeks, addMonths, addYears, format } from 'date-fns'

/**
 * Checks for recurring tasks that need to be generated and creates them.
 * This can be called when an advisor logs in or periodically via a cron substitute.
 */
export async function processRecurringTasks() {
    try {
        // 1. Get all reminders that have a recurrence rule
        const { data: templates, error } = await supabase
            .from('reminders')
            .select('*')
            .not('recurrence_rule', 'is', null)

        if (error) throw error
        if (!templates || templates.length === 0) return { success: true, count: 0 }

        let generatedCount = 0

        for (const template of templates) {
            const result = await generateNextInstanceIfNeeded(template)
            if (result.generated) {
                generatedCount++
            }
        }

        return { success: true, count: generatedCount }
    } catch (error: any) {
        console.error('Error processing recurring tasks:', error)
        return { success: false, error: error.message }
    }
}

/**
 * Generates the next instance of a recurring task if it doesn't exist yet.
 */
async function generateNextInstanceIfNeeded(template: Reminder) {
    const rule = template.recurrence_rule
    if (!rule) return { generated: false }

    const lastDate = template.last_generated_date
        ? new Date(template.last_generated_date)
        : new Date(template.due_date)

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let nextDueDate: Date

    // Calculate next due date based on rule
    switch (rule.toLowerCase()) {
        case 'daily':
            nextDueDate = addDays(lastDate, 1)
            break
        case 'weekly':
            nextDueDate = addWeeks(lastDate, 1)
            break
        case 'monthly':
            nextDueDate = addMonths(lastDate, 1)
            break
        case 'yearly':
            nextDueDate = addYears(lastDate, 1)
            break
        default:
            return { generated: false }
    }

    // If the next due date is in the past or today, and we haven't generated it yet
    if (nextDueDate <= addDays(today, 7)) { // Generate up to 7 days in advance

        // Check if we already generated for this date to prevent duplicates
        const { data: exists } = await supabase
            .from('recurring_task_logs')
            .select('id')
            .eq('reminder_template_id', template.id)
            .eq('generated_for_date', format(nextDueDate, 'yyyy-MM-dd'))
            .single()

        if (exists) return { generated: false }

        // Create the new task instance (without recurrence_rule so it's a "leaf" task)
        const { data: newReminder, error: insertError } = await supabase
            .from('reminders')
            .insert({
                client_id: template.client_id,
                title: template.title,
                description: template.description,
                due_date: nextDueDate.toISOString(),
                priority: template.priority,
                reminder_type: template.reminder_type,
                category: template.category,
                is_completed: false,
            })
            .select()
            .single()

        if (insertError) throw insertError

        // Log the generation
        await supabase.from('recurring_task_logs').insert({
            reminder_template_id: template.id,
            generated_for_date: format(nextDueDate, 'yyyy-MM-dd')
        })

        // Update the template's last_generated_date
        await supabase
            .from('reminders')
            .update({ last_generated_date: nextDueDate.toISOString() })
            .eq('id', template.id)

        return { generated: true }
    }

    return { generated: false }
}

/**
 * Marks a recurring task as completed and triggers immediate generation check.
 */
export async function completeRecurringTask(taskId: string) {
    try {
        const { error } = await supabase
            .from('reminders')
            .update({ is_completed: true })
            .eq('id', taskId)

        if (error) throw error

        // If this task was a template (had a rule), check for next instance
        // Usually we generate from templates, but we can also check here
        await processRecurringTasks()

        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}
