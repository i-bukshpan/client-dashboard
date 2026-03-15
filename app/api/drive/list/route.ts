import { NextResponse } from 'next/server'
import { listFiles } from '@/lib/google-drive'
import { supabase } from '@/lib/supabase'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('clientId')

  if (!clientId) {
    return NextResponse.json({ error: 'Missing clientId' }, { status: 400 })
  }

  // 1. Get folder ID from DB
  const { data: client } = await supabase
    .from('clients')
    .select('google_drive_folder_id')
    .eq('id', clientId)
    .single()

  if (!client?.google_drive_folder_id) {
    return NextResponse.json({ files: [] })
  }

  // 2. Fetch files (Note: Using a placeholder for Refresh Token for now)
  // In a real app, this should come from a secure setting or the user session
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN || ''
  
  if (!refreshToken) {
    return NextResponse.json({ error: 'Google Drive not configured' }, { status: 500 })
  }

  const files = await listFiles(client.google_drive_folder_id, refreshToken)
  return NextResponse.json({ files })
}
