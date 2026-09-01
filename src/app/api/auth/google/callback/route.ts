import { google } from 'googleapis'
import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceAdminDb, getWorkspaceErrorStatus, requireWorkspaceAdmin } from '@/lib/v2/workspace-dal'
import { encryptSecret } from '@/lib/v2/token-crypto'

export const dynamic = 'force-dynamic'

const STATE_COOKIE = 'v2_google_oauth_state'

function redirectUri(request: NextRequest): string {
  const configured = process.env.GOOGLE_V2_OAUTH_REDIRECT_URI
  if (configured) return configured
  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin
  return `${base.replace(/\/$/, '')}/api/auth/google/callback`
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character)
}

function htmlPage(title: string, body: string, status = 200): NextResponse {
  return new NextResponse(`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>body{margin:0;background:#090d18;color:#eef2ff;font-family:Arial,sans-serif}.box{max-width:800px;margin:8vh auto;padding:32px;border:1px solid #29324a;border-radius:20px;background:#121827}h1{margin-top:0}p{color:#b8c0d9;line-height:1.7}.token{direction:ltr;text-align:left;word-break:break-all;padding:18px;border-radius:12px;background:#080b12;border:1px solid #394463;color:#a5f3fc;font-family:monospace;font-size:14px}.warning{color:#fbbf24}</style></head><body><main class="box"><h1>${escapeHtml(title)}</h1>${body}</main></body></html>`, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store, no-cache, must-revalidate, private', Pragma: 'no-cache', 'X-Robots-Tag': 'noindex, nofollow, noarchive', 'Referrer-Policy': 'no-referrer' } })
}

export async function GET(request: NextRequest) {
  let response: NextResponse
  try {
    const session = await requireWorkspaceAdmin()
    const code = request.nextUrl.searchParams.get('code')
    const state = request.nextUrl.searchParams.get('state')
    const oauthError = request.nextUrl.searchParams.get('error')
    const expectedState = request.cookies.get(STATE_COOKIE)?.value
    if (oauthError) throw new Error(`Google rejected authorization: ${oauthError}`)
    if (!code) throw new Error('Google callback did not include an authorization code')
    if (!state || !expectedState || state !== expectedState) throw new Error('OAuth state verification failed; restart the authorization flow')

    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
    if (!clientId || !clientSecret) throw new Error('חסרים GOOGLE_OAUTH_CLIENT_ID או GOOGLE_OAUTH_CLIENT_SECRET')
    const oauth = new google.auth.OAuth2(clientId, clientSecret, redirectUri(request))
    const { tokens } = await oauth.getToken(code)

    if (!tokens.refresh_token || !tokens.access_token) {
      response = htmlPage('לא התקבל Refresh Token', '<p>Google לא החזיר refresh token. נסה להתחיל שוב מהקישור, ודא שבחרת בחשבון הנכון ואישרת מחדש את כל ההרשאות. במידת הצורך בטל קודם את גישת האפליקציה בחשבון Google.</p>', 422)
    } else {
      const { error } = await getWorkspaceAdminDb().from('google_tokens').upsert({
        user_id: session.user.id,
        access_token: encryptSecret(tokens.access_token),
        refresh_token: encryptSecret(tokens.refresh_token),
        expires_at: tokens.expiry_date ?? null,
      }, { onConflict: 'user_id' })
      if (error) throw new Error(`[google-oauth] Failed to store credentials: ${error.message}`)
      response = htmlPage('Google OAuth הושלם', '<p>החיבור ל-Google נשמר בצורה מוצפנת. ניתן לסגור חלון זה ולחזור לסביבת העבודה.</p>')
    }
  } catch (error: unknown) {
    response = htmlPage('Google OAuth נכשל', `<p>${escapeHtml(error instanceof Error ? error.message : 'Authorization failed')}</p>`, getWorkspaceErrorStatus(error))
  }
  response.cookies.set(STATE_COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/auth/google/callback', maxAge: 0 })
  return response
}
