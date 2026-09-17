import 'server-only'

import { google } from 'googleapis'
import type { JWT, OAuth2Client } from 'google-auth-library'
import { decryptSecret } from '@/lib/v2/token-crypto'

export const V2_GOOGLE_SCOPES = {
  DRIVE: 'https://www.googleapis.com/auth/drive',
  SHEETS: 'https://www.googleapis.com/auth/spreadsheets',
  CALENDAR: 'https://www.googleapis.com/auth/calendar',
} as const

export type V2GoogleScope = (typeof V2_GOOGLE_SCOPES)[keyof typeof V2_GOOGLE_SCOPES]
export type V2GoogleAuthMode = 'oauth' | 'service-account'

export interface V2GoogleAuthResult {
  auth: OAuth2Client | JWT
  mode: V2GoogleAuthMode
}

function normalizedPrivateKey(): string | null {
  return process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n') ?? null
}

function hasServiceAccount(): boolean {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && normalizedPrivateKey())
}

function createOAuthClient(): OAuth2Client | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN
  if (!clientId || !clientSecret || !refreshToken) return null

  const client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    process.env.GOOGLE_REDIRECT_URI ?? process.env.NEXT_PUBLIC_APP_URL
  )
  const decrypted = decryptSecret(refreshToken)
  if (!decrypted) return null
  client.setCredentials({ refresh_token: decrypted })
  return client
}

function createServiceAccount(scopes: V2GoogleScope[]): JWT {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const privateKey = normalizedPrivateKey()
  if (!clientEmail || !privateKey) {
    throw new Error(
      '[v2/google-auth] Configure GOOGLE_OAUTH_* or GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY'
    )
  }

  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes,
    subject: process.env.GOOGLE_SERVICE_ACCOUNT_SUBJECT || undefined,
  })
}

/** Creates a fresh auth client per operation; no credentials are shared across requests. */
export function createV2GoogleAuth(
  scopes: V2GoogleScope[],
  options: { requireOAuth?: boolean; preferOAuth?: boolean } = {}
): V2GoogleAuthResult {
  const serviceAccountAvailable = hasServiceAccount()

  // 1. If Service Account is available and OAuth is not explicitly required or preferred,
  // use Service Account (reliable, non-expiring server-to-server enterprise credentials)
  if (serviceAccountAvailable && !options.preferOAuth && !options.requireOAuth) {
    return { auth: createServiceAccount(scopes), mode: 'service-account' }
  }

  // 2. Try OAuth client if available
  const oauth = createOAuthClient()
  if (oauth) return { auth: oauth, mode: 'oauth' }

  // 3. Fall back to Service Account if available
  if (serviceAccountAvailable) {
    return { auth: createServiceAccount(scopes), mode: 'service-account' }
  }

  if (options.requireOAuth) {
    throw new Error('[v2/google-auth] This operation requires Nehemiah OAuth credentials')
  }

  throw new Error(
    '[v2/google-auth] Configure GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY or GOOGLE_OAUTH_*'
  )
}

export function createV2DriveClient() {
  const { auth } = createV2GoogleAuth([V2_GOOGLE_SCOPES.DRIVE])
  return google.drive({ version: 'v3', auth })
}

export function createV2SheetsClient() {
  const { auth } = createV2GoogleAuth([
    V2_GOOGLE_SCOPES.SHEETS,
    V2_GOOGLE_SCOPES.DRIVE,
  ])
  return google.sheets({ version: 'v4', auth })
}

export function createV2CalendarClient() {
  const { auth } = createV2GoogleAuth([V2_GOOGLE_SCOPES.CALENDAR], {
    requireOAuth: !hasServiceAccount(),
  })
  return google.calendar({ version: 'v3', auth })
}

