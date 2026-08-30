import { google } from 'googleapis'
import { getWorkspaceAdminDb } from '@/lib/v2/workspace-dal'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const rawState = searchParams.get('state')
  const error = searchParams.get('error')

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  let userId = rawState || ''
  let returnUrl = '/workspace/emails'

  if (rawState) {
    try {
      // Try decoding base64url JSON
      const decoded = JSON.parse(Buffer.from(rawState, 'base64url').toString('utf8'))
      if (decoded.userId) userId = decoded.userId
      if (decoded.returnUrl) returnUrl = decoded.returnUrl
    } catch {
      // Plain userId string fallback
      userId = rawState
      returnUrl = '/workspace/emails'
    }
  }

  const finalReturnUrl = new URL(returnUrl, baseUrl)

  if (error || !code || !userId) {
    console.error('Google OAuth error:', error)
    finalReturnUrl.searchParams.set('google_error', 'access_denied')
    return NextResponse.redirect(finalReturnUrl)
  }

  try {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${baseUrl}/api/google/callback`

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    )

    const { tokens } = await oauth2Client.getToken(code)

    if (!tokens.access_token) {
      throw new Error('No access token received from Google')
    }

    const adminDb = getWorkspaceAdminDb()

    // Fetch existing token to preserve refresh_token if Google omitted it in this grant
    const { data: existingRow } = await adminDb
      .from('google_tokens')
      .select('refresh_token')
      .eq('user_id', userId)
      .maybeSingle()

    const finalRefreshToken = tokens.refresh_token || existingRow?.refresh_token || null

    const { error: dbError } = await adminDb
      .from('google_tokens')
      .upsert({
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: finalRefreshToken,
        expires_at: tokens.expiry_date || null,
      }, { onConflict: 'user_id' })

    if (dbError) {
      console.error('Error saving Google tokens to DB:', dbError)
      finalReturnUrl.searchParams.set('google_error', 'save_failed')
      return NextResponse.redirect(finalReturnUrl)
    }

    finalReturnUrl.searchParams.set('google_connected', 'true')
    return NextResponse.redirect(finalReturnUrl)
  } catch (err: any) {
    console.error('Google OAuth callback error:', err)
    finalReturnUrl.searchParams.set('google_error', 'token_exchange_failed')
    return NextResponse.redirect(finalReturnUrl)
  }
}
