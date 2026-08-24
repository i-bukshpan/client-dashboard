import { randomBytes } from 'crypto'
import { google } from 'googleapis'
import { NextRequest, NextResponse } from 'next/server'
import { V2_GOOGLE_SCOPES } from '@/lib/v2/google-auth'
import { getWorkspaceErrorStatus, requireWorkspaceAdmin } from '@/lib/v2/workspace-dal'

export const dynamic = 'force-dynamic'

const STATE_COOKIE = 'v2_google_oauth_state'

function redirectUri(request: NextRequest): string {
  const configured = process.env.GOOGLE_V2_OAUTH_REDIRECT_URI
  if (configured) return configured
  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin
  return `${base.replace(/\/$/, '')}/api/auth/google/callback`
}

export async function GET(request: NextRequest) {
  try {
    await requireWorkspaceAdmin()
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
    if (!clientId || !clientSecret) throw new Error('חסרים GOOGLE_OAUTH_CLIENT_ID או GOOGLE_OAUTH_CLIENT_SECRET')

    const state = randomBytes(32).toString('base64url')
    const oauth = new google.auth.OAuth2(clientId, clientSecret, redirectUri(request))
    const authorizationUrl = oauth.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: true,
      scope: [V2_GOOGLE_SCOPES.DRIVE, V2_GOOGLE_SCOPES.SHEETS, V2_GOOGLE_SCOPES.CALENDAR],
      state,
    })

    const response = NextResponse.redirect(authorizationUrl)
    response.cookies.set(STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth/google/callback',
      maxAge: 10 * 60,
    })
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Google authorization failed' },
      { status: getWorkspaceErrorStatus(error) }
    )
  }
}
