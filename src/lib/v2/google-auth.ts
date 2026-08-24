import 'server-only'

import { google } from 'googleapis'
import type { JWT, OAuth2Client } from 'google-auth-library'

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
  client.setCredentials({ refresh_token: refreshToken })
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
  options: { requireOAuth?: boolean } = {}
): V2GoogleAuthResult {
  const oauth = createOAuthClient()
  if (oauth) return { auth: oauth, mode: 'oauth' }

  if (options.requireOAuth) {
    throw new Error('[v2/google-auth] This operation requires Nehemiah OAuth credentials')
  }

  return { auth: createServiceAccount(scopes), mode: 'service-account' }
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
    requireOAuth: !process.env.GOOGLE_SERVICE_ACCOUNT_SUBJECT,
  })
  return google.calendar({ version: 'v3', auth })
}
