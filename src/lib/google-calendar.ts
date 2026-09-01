import { google } from 'googleapis'
import { createClient } from '@/lib/supabase/server'
import { getOAuth2Client } from '@/lib/google-auth'
import { getWorkspaceAdminDb } from '@/lib/v2/workspace-dal'
import { decryptSecret, encryptSecret } from '@/lib/v2/token-crypto'

export async function getGoogleAuthClient(userId?: string) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_V2_OAUTH_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/google/callback`

  if (!clientId || !clientSecret) return null

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)

  // 1. Try fetching from google_tokens table in Supabase
  try {
    const adminDb = getWorkspaceAdminDb()
    let tokenData: any = null

    let resolvedUserId = userId
    if (!resolvedUserId) {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      resolvedUserId = user?.id
    }
    if (resolvedUserId) {
      const res = await adminDb.from('google_tokens').select('*').eq('user_id', resolvedUserId).maybeSingle()
      tokenData = res.data
    }

    if (tokenData && (tokenData.access_token || tokenData.refresh_token)) {
      oauth2Client.setCredentials({
        access_token: decryptSecret(tokenData.access_token),
        refresh_token: decryptSecret(tokenData.refresh_token),
        expiry_date: tokenData.expires_at,
      })

      // Check if token is expired and refresh if possible
      if (tokenData.expires_at && Date.now() >= tokenData.expires_at && tokenData.refresh_token) {
        try {
          const { credentials } = await oauth2Client.refreshAccessToken()
          await adminDb.from('google_tokens').update({
            access_token: encryptSecret(credentials.access_token!),
            expires_at: credentials.expiry_date!,
            refresh_token: encryptSecret(credentials.refresh_token || decryptSecret(tokenData.refresh_token)!),
          }).eq('user_id', tokenData.user_id)
        } catch (error) {
          console.error('Error refreshing Google token:', error)
        }
      }

      return oauth2Client
    }
  } catch (err) {
    console.warn('google_tokens lookup error in calendar:', err)
  }

  // 2. Fallback to GOOGLE_OAUTH_REFRESH_TOKEN from environment
  const serverOAuth = getOAuth2Client()
  if (serverOAuth) return serverOAuth

  return null
}

export async function syncGoogleEvents(userId: string) {
  const auth = await getGoogleAuthClient(userId)
  if (!auth) throw new Error('Google account not connected')

  const calendar = google.calendar({ version: 'v3', auth })
  const supabase = await createClient()

  // Fetch events from the last 30 days and next 90 days
  const timeMin = new Date()
  timeMin.setDate(timeMin.getDate() - 30)
  
  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: timeMin.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  })

  const events = response.data.items || []
  let syncedCount = 0

  for (const event of events) {
    if (!event.start?.dateTime || !event.end?.dateTime) continue

    // Check if event already exists
    const { data: existing } = await supabase
      .from('appointments')
      .select('id')
      .eq('google_event_id', event.id!)
      .single()

    if (!existing) {
      // Create new appointment
      const { error } = await supabase.from('appointments').insert({
        title: event.summary || 'פגישה ללא כותרת',
        start_time: event.start.dateTime,
        end_time: event.end.dateTime,
        notes: event.description || '',
        google_event_id: event.id!,
        employee_id: userId,
        status: 'scheduled'
      })
      if (!error) syncedCount++
    } else {
      // Update existing appointment
      await supabase.from('appointments').update({
        title: event.summary || 'פגישה ללא כותרת',
        start_time: event.start.dateTime,
        end_time: event.end.dateTime,
        notes: event.description || '',
      }).eq('id', existing.id)
    }
  }

  return { syncedCount, totalFound: events.length }
}

export async function pushAppointmentToGoogle(appointmentId: string, userId: string) {
  const auth = await getGoogleAuthClient(userId)
  if (!auth) return

  const supabase = await createClient()
  const { data: appt } = await supabase.from('appointments').select('*').eq('id', appointmentId).single()
  if (!appt) return

  const calendar = google.calendar({ version: 'v3', auth })
  
  const event = {
    summary: appt.title,
    description: appt.notes,
    start: { dateTime: appt.start_time },
    end: { dateTime: appt.end_time },
  }

  if (appt.google_event_id) {
    await calendar.events.update({
      calendarId: 'primary',
      eventId: appt.google_event_id,
      requestBody: event,
    })
  } else {
    const res = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
    })
    if (res.data.id) {
      await supabase.from('appointments').update({ google_event_id: res.data.id }).eq('id', appt.id)
    }
  }
}
