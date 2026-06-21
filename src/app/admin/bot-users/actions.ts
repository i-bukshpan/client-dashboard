'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function addBotContact(data: { name: string, phone: string, user_type: string, is_active: boolean }) {
  const supabase = await createClient()

  // Format phone to start with 972 and remove leading 0 if needed
  let formattedPhone = data.phone.replace(/[\s\-()]/g, '')
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '972' + formattedPhone.slice(1)
  }

  const { error } = await supabase.from('bot_contacts').insert({
    name: data.name,
    phone: formattedPhone,
    user_type: data.user_type,
    is_active: data.is_active,
  })

  if (error) {
    console.error('Error adding bot contact:', error)
    return { error: error.message }
  }

  revalidatePath('/admin/bot-users')
  return { success: true }
}

export async function updateBotContact(id: string, data: { name: string, phone: string, user_type: string, is_active: boolean }) {
  const supabase = await createClient()

  let formattedPhone = data.phone.replace(/[\s\-()]/g, '')
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '972' + formattedPhone.slice(1)
  }

  const { error } = await supabase.from('bot_contacts').update({
    name: data.name,
    phone: formattedPhone,
    user_type: data.user_type,
    is_active: data.is_active,
  }).eq('id', id)

  if (error) {
    console.error('Error updating bot contact:', error)
    return { error: error.message }
  }

  revalidatePath('/admin/bot-users')
  return { success: true }
}

export async function deleteBotContact(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('bot_contacts').delete().eq('id', id)

  if (error) {
    console.error('Error deleting bot contact:', error)
    return { error: error.message }
  }

  revalidatePath('/admin/bot-users')
  return { success: true }
}
