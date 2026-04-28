'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { syncGoogleEvents, pushAppointmentToGoogle } from '@/lib/google-calendar'

export async function createAppointment(formData: FormData) {
  const supabase = await createClient()

  const title = formData.get('title') as string
  const start_time = formData.get('start_time') as string
  const end_time = formData.get('end_time') as string
  const client_id = formData.get('client_id') as string | null
  const employee_id = formData.get('employee_id') as string | null
  const notes = formData.get('notes') as string | null

  if (!title || !start_time || !end_time) {
    return { error: 'חסרים שדות חובה' }
  }

  const { error } = await supabase.from('appointments').insert({
    title,
    start_time,
    end_time,
    client_id: client_id || null,
    employee_id: employee_id || null,
    notes,
    status: 'scheduled'
  })

  if (error) {
    console.error('Error creating appointment:', error)
    return { error: 'שגיאה ביצירת פגישה' }
  }

  // Push to Google Calendar if possible
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: appt } = await supabase.from('appointments').select('id').eq('title', title).eq('start_time', start_time).order('created_at', { ascending: false }).limit(1).single()
    if (appt) {
      await pushAppointmentToGoogle(appt.id, user.id)
    }
  }

  revalidatePath('/admin/calendar')
  revalidatePath('/admin/dashboard')
  return { success: true }
}

export async function syncCalendar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'משתמש לא מחובר' }
  
  try {
    const result = await syncGoogleEvents(user.id)
    revalidatePath('/admin/calendar')
    return { success: true, ...result }
  } catch (error: any) {
    console.error('Sync Error:', error)
    return { error: error.message || 'שגיאה בסנכרון' }
  }
}

export async function deleteAppointment(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('appointments').delete().eq('id', id)
  
  if (error) {
    return { error: 'שגיאה במחיקת פגישה' }
  }
  
  revalidatePath('/admin/calendar')
  revalidatePath('/admin/dashboard')
  return { success: true }
}
