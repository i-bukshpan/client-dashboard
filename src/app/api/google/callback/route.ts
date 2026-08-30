import { google } from 'googleapis'
import { getWorkspaceAdminDb } from '@/lib/v2/workspace-dal'
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char] ?? char)
}

function renderAuthPage({
  title,
  message,
  refreshToken,
  returnUrl,
  isError = false,
}: {
  title: string
  message: string
  refreshToken?: string | null
  returnUrl: string
  isError?: boolean
}) {
  const safeTitle = escapeHtml(title)
  const safeMsg = escapeHtml(message)
  const safeToken = refreshToken ? escapeHtml(refreshToken) : ''
  const safeReturnUrl = escapeHtml(returnUrl)

  return new NextResponse(
    `<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeTitle}</title>
  <style>
    body {
      margin: 0;
      background: #0b0f19;
      color: #f1f5f9;
      font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
      box-sizing: border-box;
    }
    .card {
      width: 100%;
      max-width: 680px;
      background: #131b2e;
      border: 1px solid ${isError ? '#ef444455' : '#22c55e44'};
      border-radius: 24px;
      padding: 32px;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 700;
      background: ${isError ? '#ef444422' : '#22c55e22'};
      color: ${isError ? '#f87171' : '#4ade80'};
      margin-bottom: 16px;
    }
    h1 {
      margin: 0 0 10px;
      font-size: 22px;
      font-weight: 800;
    }
    p {
      color: #94a3b8;
      font-size: 14px;
      line-height: 1.6;
      margin: 0 0 20px;
    }
    .services-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 24px;
    }
    .service-chip {
      background: #1e293b;
      border: 1px solid #334155;
      padding: 10px 8px;
      border-radius: 12px;
      text-align: center;
      font-size: 11px;
      font-weight: 700;
      color: #cbd5e1;
    }
    .token-box {
      direction: ltr;
      text-align: left;
      word-break: break-all;
      padding: 14px;
      border-radius: 12px;
      background: #090d16;
      border: 1px solid #334155;
      color: #38bdf8;
      font-family: monospace;
      font-size: 13px;
      margin-bottom: 12px;
      user-select: all;
    }
    .actions {
      display: flex;
      gap: 12px;
      margin-top: 24px;
      flex-wrap: wrap;
    }
    .btn-primary {
      flex: 1;
      min-width: 160px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 12px 20px;
      border-radius: 12px;
      background: #4f46e5;
      color: white;
      text-decoration: none;
      font-size: 14px;
      font-weight: 700;
      border: none;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn-primary:hover { background: #4338ca; }
    .btn-secondary {
      padding: 12px 18px;
      border-radius: 12px;
      background: #1e293b;
      color: #e2e8f0;
      border: 1px solid #334155;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-secondary:hover { background: #334155; }
    .note {
      font-size: 12px;
      color: #64748b;
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">${isError ? '✕ שגיאת אימות' : '✓ החיבור הושלם בהצלחה'}</div>
    <h1>${safeTitle}</h1>
    <p>${safeMsg}</p>

    ${!isError ? `
    <div class="services-grid">
      <div class="service-chip">📁 Google Drive</div>
      <div class="service-chip">📊 Google Sheets</div>
      <div class="service-chip">📅 Google Calendar</div>
      <div class="service-chip">✉️ Gmail</div>
    </div>
    ` : ''}

    ${safeToken ? `
    <div style="margin-bottom: 8px; font-size: 12px; font-weight: bold; color: #cbd5e1;">GOOGLE_OAUTH_REFRESH_TOKEN:</div>
    <div class="token-box" id="tokenBox">${safeToken}</div>
    <button class="btn-secondary" onclick="navigator.clipboard.writeText(document.getElementById('tokenBox').innerText); this.innerText='✓ הועתק!';">העתק טוקן ללוח</button>
    ` : ''}

    <div class="actions">
      <a href="${safeReturnUrl}" class="btn-primary">המשך למערכת ←</a>
    </div>

    <div class="note">
      ${!isError ? 'הטוקן נשמר במערכת ועודכן עבור כל השירותים (Drive, Sheets, יומן ו-Gmail).' : ''}
    </div>
  </div>
</body>
</html>`,
    {
      status: isError ? 400 : 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  )
}

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
      const decoded = JSON.parse(Buffer.from(rawState, 'base64url').toString('utf8'))
      if (decoded.userId) userId = decoded.userId
      if (decoded.returnUrl) returnUrl = decoded.returnUrl
    } catch {
      userId = rawState
      returnUrl = '/workspace/emails'
    }
  }

  if (error || !code || !userId) {
    console.error('Google OAuth error:', error)
    return renderAuthPage({
      title: 'האימות מול Google בוטל או נכשל',
      message: `Google החזיר שגיאה: ${error || 'לא התקבל קוד אימות'}. אנא נסה שוב.`,
      returnUrl,
      isError: true,
    })
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
      throw new Error('לא התקבל Access Token מ-Google')
    }

    const adminDb = getWorkspaceAdminDb()

    // Fetch existing token to preserve refresh_token if Google omitted it in this grant
    let existingRefreshToken: string | null = null
    try {
      const { data: existingRow } = await adminDb
        .from('google_tokens')
        .select('refresh_token')
        .eq('user_id', userId)
        .maybeSingle()
      existingRefreshToken = existingRow?.refresh_token || null
    } catch {
      // Ignore DB read errors
    }

    const finalRefreshToken = tokens.refresh_token || existingRefreshToken || process.env.GOOGLE_OAUTH_REFRESH_TOKEN || null

    // 1. Save to Supabase google_tokens table
    try {
      await adminDb
        .from('google_tokens')
        .upsert({
          user_id: userId,
          access_token: tokens.access_token,
          refresh_token: finalRefreshToken,
          expires_at: tokens.expiry_date || null,
        }, { onConflict: 'user_id' })
    } catch (dbErr) {
      console.warn('Could not upsert google_tokens to Supabase:', dbErr)
    }

    // 2. Automatically update GOOGLE_OAUTH_REFRESH_TOKEN in .env.local if available locally
    if (finalRefreshToken) {
      try {
        const envPath = path.join(process.cwd(), '.env.local')
        if (fs.existsSync(envPath)) {
          let envContent = fs.readFileSync(envPath, 'utf8')
          if (envContent.includes('GOOGLE_OAUTH_REFRESH_TOKEN=')) {
            envContent = envContent.replace(/GOOGLE_OAUTH_REFRESH_TOKEN=.*/, `GOOGLE_OAUTH_REFRESH_TOKEN=${finalRefreshToken}`)
          } else {
            envContent += `\nGOOGLE_OAUTH_REFRESH_TOKEN=${finalRefreshToken}\n`
          }
          fs.writeFileSync(envPath, envContent, 'utf8')
          process.env.GOOGLE_OAUTH_REFRESH_TOKEN = finalRefreshToken
          console.log('[Google OAuth] Successfully auto-updated GOOGLE_OAUTH_REFRESH_TOKEN in .env.local')
        }
      } catch (fsErr) {
        console.warn('[Google OAuth] Could not auto-write to .env.local:', fsErr)
      }
    }

    return renderAuthPage({
      title: 'כל שירותי Google חוברו בהצלחה!',
      message: 'ההרשאות המלאות עבור Drive, Sheets, יומן (Calendar) ו-Gmail חוברו וסונכרנו בהצלחה.',
      refreshToken: finalRefreshToken,
      returnUrl,
      isError: false,
    })
  } catch (err: any) {
    console.error('Google OAuth callback error:', err)
    return renderAuthPage({
      title: 'שגיאה בעיבוד האימות מול Google',
      message: err.message || 'אירעה שגיאה בעת המרת קוד האימות לטוקן גישה.',
      returnUrl,
      isError: true,
    })
  }
}
