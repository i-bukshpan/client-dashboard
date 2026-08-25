/**
 * src/lib/google-auth.ts
 *
 * Single source of truth for all server-side Google API authentication.
 *
 * Strategies:
 * 1. OAuth2 Refresh Token (Nehemiah's personal account) — preferred when available
 *    so all personal Google Drive & Sheets files are accessible without permission errors.
 * 2. Service Account (server-to-server) — fallback if OAuth2 is not configured.
 */

import { google } from 'googleapis'

export const SCOPES = {
  DRIVE: 'https://www.googleapis.com/auth/drive',
  DRIVE_READONLY: 'https://www.googleapis.com/auth/drive.readonly',
  DRIVE_FILE: 'https://www.googleapis.com/auth/drive.file',
  SHEETS: 'https://www.googleapis.com/auth/spreadsheets',
  SHEETS_READONLY: 'https://www.googleapis.com/auth/spreadsheets.readonly',
} as const

export type GoogleScope = (typeof SCOPES)[keyof typeof SCOPES]

/**
 * Returns an authenticated OAuth2 client using Nehemiah's personal Refresh Token.
 */
export function getOAuth2Client() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN

  if (!clientId || !clientSecret || !refreshToken) {
    return null
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  )

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  })

  return oauth2Client
}

/**
 * Returns a GoogleAuth instance authenticated as the Service Account.
 */
export function getGoogleAuth(
  scopes: GoogleScope[] = [SCOPES.DRIVE, SCOPES.SHEETS]
) {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  const subject = process.env.GOOGLE_SERVICE_ACCOUNT_SUBJECT

  if (!email || !rawKey) {
    throw new Error(
      '[google-auth] Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or ' +
        'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY environment variables. ' +
        'Ensure they are set in .env.local.'
    )
  }

  const privateKey = rawKey.replace(/\\n/g, '\n')

  return new google.auth.GoogleAuth({
    credentials: {
      client_email: email,
      private_key: privateKey,
    },
    clientOptions: subject ? { subject } : undefined,
    scopes,
  })
}

/**
 * Returns auth client for Drive operations:
 * Uses OAuth2 user account if available, otherwise Service Account.
 */
export function getDriveUploadAuth() {
  const oauth2 = getOAuth2Client()
  if (oauth2) return oauth2
  return getDriveAuth()
}

/**
 * Returns Drive auth instance.
 */
export function getDriveAuth() {
  const oauth2 = getOAuth2Client()
  if (oauth2) return oauth2
  return getGoogleAuth([SCOPES.DRIVE])
}

/**
 * Returns Sheets auth instance.
 */
export function getSheetsAuth() {
  const oauth2 = getOAuth2Client()
  if (oauth2) return oauth2
  return getGoogleAuth([SCOPES.SHEETS])
}
