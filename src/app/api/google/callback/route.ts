import { google } from 'googleapis'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const userId = searchParams.get('state') // The user ID passed during auth init
  const error = searchParams.get('error')

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  if (error || !code || !userId) {
    console.error('Google OAuth error:', error)
    return NextResponse.redirect(new URL('/admin/calendar?google_error=access_denied', baseUrl))
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    )

    const { tokens } = await oauth2Client.getToken(code)

    if (!tokens.access_token) {
      throw new Error('No access token received')
    }

    // Save tokens to Supabase
    const supabase = await createClient()
    const { error: dbError } = await supabase
      .from('google_tokens')
      .upsert({
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        expires_at: tokens.expiry_date || null,
      }, { onConflict: 'user_id' })

    if (dbError) {
      console.error('Error saving Google tokens:', dbError)
      return NextResponse.redirect(new URL('/admin/calendar?google_error=save_failed', baseUrl))
    }

    return NextResponse.redirect(new URL('/admin/calendar?google_connected=true', baseUrl))
  } catch (err: any) {
    console.error('Google OAuth callback error:', err)
    return NextResponse.redirect(new URL('/admin/calendar?google_error=token_exchange_failed', baseUrl))
  }
}
