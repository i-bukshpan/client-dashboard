'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function updateTask(id: string, data: any) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'משתמש לא מחובר' }

  const { error } = await supabaseAdmin
    .from('tasks')
    .update(data)
    .eq('id', id)

  if (error) {
    console.error('Update Task Error:', error)
    return { error: `שגיאה בעדכון המשימה: ${error.message}` }
  }

  revalidatePath('/admin/tasks')
  revalidatePath('/employee/tasks')
  return { success: true }
}

export async function deleteTask(id: string) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'משתמש לא מחובר' }

  const { error } = await supabaseAdmin
    .from('tasks')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Delete Task Error:', error)
    return { error: `שגיאה במחיקת המשימה: ${error.message}` }
  }

  revalidatePath('/admin/tasks')
  revalidatePath('/employee/tasks')
  return { success: true }
}

export async function addTaskComment(taskId: string, content: string) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'משתמש לא מחובר' }

  const { error } = await supabaseAdmin
    .from('task_updates')
    .insert({
      task_id: taskId,
      user_id: user.id,
      content
    })

  if (error) {
    console.error('Add Task Comment Error:', error)
    return { error: `שגיאה בהוספת תגובה: ${error.message}` }
  }

  revalidatePath('/admin/tasks')
  revalidatePath('/employee/tasks')
  return { success: true }
}

export async function archiveTask(taskId: string, archived: boolean = true) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'משתמש לא מחובר' }

    const { error } = await supabaseAdmin
      .from('tasks')
      .update({ archived })
      .eq('id', taskId)

    if (error) throw error
    revalidatePath('/admin/tasks')
    revalidatePath('/employee/tasks')
    return { success: true }
  } catch (err: any) {
    console.error('Archive Task Error:', err)
    return { error: `שגיאה בארכיון המשימה: ${err.message}` }
  }
}

export async function getTaskComments(taskId: string) {
  const { data, error } = await supabaseAdmin
    .from('task_updates')
    .select('*, profiles:user_id(full_name, avatar_url)')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Get Task Comments Error:', error)
    return { error: error.message }
  }

  return { data }
}
