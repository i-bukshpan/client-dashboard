'use server'

import { supabase } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

export async function updateClientDriveFolder(clientId: string, folderId: string) {
  const { error } = await supabase
    .from('clients')
    .update({ google_drive_folder_id: folderId })
    .eq('id', clientId)

  if (error) {
    console.error('Error updating drive folder:', error)
    return { success: false, error: error.message }
  }

  revalidatePath(`/clients/${clientId}`)
  return { success: true }
}

export async function getClientDriveFiles(folderId: string) {
  // logic to fetch from Google Drive API will be implemented 
  // currently returns mock of intended structure
  return []
}
