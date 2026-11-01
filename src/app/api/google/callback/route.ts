import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { encryptSecret } from '@/lib/v2/token-crypto'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char] ?? char)
}

function renderAuthPage({
  title,
  message,
  returnUrl,
  isError = false,
}: {
  title: string
  message: string
  returnUrl: string
  isError?: boolean
}) {
  const safeTitle = escapeHtml(title)
  const safeMsg = escapeHtml(message)
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
      max-width: 640px;
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
    h1 { margin: 0 0 10px; font-size: 22px; font-weight: 800; }
    p { color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 24px; }
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
    .actions { display: flex; gap: 12px; margin-top: 24px; }
    .btn-primary {
      flex: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 12px 20px;
      border-radius: 12px;
      background: #3b82f6;
      color: white;
      text-decoration: none;
      font-size: 14px;
      font-weight: 700;
      transition: background 0.2s;
    }
    .btn-primary:hover { background: #2563eb; }
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
      <div class="service-chip">📅 Calendar</div>
      <div class="service-chip">✉️ Gmail</div>
    </div>
    ` : ''}

    <div class="actions">
      <a href="${safeReturnUrl}" class="btn-primary">המשך למערכת ←</a>
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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const rawState = searchParams.get('state')
  const error = searchParams.get('error')

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin

  let userId = 'admin'
  let returnUrl = '/moshe/projects'

  if (rawState) {
    try {
      const decoded = JSON.parse(Buffer.from(rawState, 'base64url').toString('utf8'))
      if (decoded.userId) userId = decoded.userId
      if (decoded.returnUrl) returnUrl = decoded.returnUrl
    } catch {
      userId = rawState
    }
  }

  if (error || !code) {
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
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${baseUrl.replace(/\/$/, '')}/api/google/callback`

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    )

    const { tokens } = await oauth2Client.getToken(code)

    if (!tokens.access_token) {
      throw new Error('לא התקבל Access Token מ-Google')
    }

    const adminDb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Preserve previous refresh token if not returned on this consent
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

    const finalRefreshToken = tokens.refresh_token || existingRefreshToken || null

    // 1. Save to Supabase google_tokens table with encryption
    if (finalRefreshToken || tokens.access_token) {
      try {
        await adminDb
          .from('google_tokens')
          .upsert({
            user_id: userId,
            access_token: encryptSecret(tokens.access_token!),
            refresh_token: finalRefreshToken ? encryptSecret(finalRefreshToken) : null,
            expires_at: tokens.expiry_date || null,
          }, { onConflict: 'user_id' })
      } catch (dbErr) {
        console.warn('[Google OAuth Callback] DB save error:', dbErr)
      }
    }

    // 2. Automatically update GOOGLE_OAUTH_REFRESH_TOKEN in .env.local if present locally
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
        }
      } catch (fsErr) {
        console.warn('[Google OAuth Callback] Could not update .env.local:', fsErr)
      }
    }

    return renderAuthPage({
      title: 'חשבון Google מחובר בהצלחה!',
      message: 'כל ההרשאות הנדרשות עבור Google Drive, Sheets, יומן ומסמכים חוברו ועודכנו במערכת.',
      returnUrl,
      isError: false,
    })
  } catch (err: any) {
    console.error('Google OAuth callback error:', err)
    return renderAuthPage({
      title: 'שגיאה בעיבוד האימות מול Google',
      message: err?.message || 'אירעה שגיאה בעת המרת קוד האימות לטוקן גישה.',
      returnUrl,
      isError: true,
    })
  }
}
