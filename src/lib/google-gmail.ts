/**
 * src/lib/google-gmail.ts
 *
 * Full-featured server-side Gmail integration for Nehemiah OS Workspace v2.
 * Supports:
 * - Label listing & client email thread querying
 * - Unread email tracking and filtering
 * - Full thread view with multipart body parsing (HTML & Plain Text)
 * - Marking threads as read/unread
 * - Inline thread reply and sending new emails with RFC 2822 UTF-8 MIME encoding
 * - Graceful handling of OAuth token expiry and Re-Auth error classification
 */

import { google, type gmail_v1 } from 'googleapis'
import { getOAuth2Client } from '@/lib/google-auth'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { getWorkspaceAdminDb } from '@/lib/v2/workspace-dal'

export type GmailErrorCode =
  | 'AUTH_REQUIRED'
  | 'INVALID_GRANT'
  | 'INSUFFICIENT_PERMISSIONS'
  | 'TOKEN_EXPIRED'
  | 'GMAIL_API_ERROR'
  | 'NOT_FOUND'

export class GmailAuthError extends Error {
  constructor(
    public readonly code: GmailErrorCode,
    message: string,
    public readonly originalError?: unknown
  ) {
    super(message)
    this.name = 'GmailAuthError'
  }
}

export function isGmailAuthError(err: unknown): err is GmailAuthError {
  return err instanceof GmailAuthError
}

export function classifyGmailError(error: any): GmailAuthError {
  const msg = error?.message || String(error)
  const status = error?.status || error?.code || error?.response?.status

  if (
    msg.includes('invalid_grant') ||
    msg.includes('Token has been expired or revoked') ||
    msg.includes('No refresh token') ||
    msg.includes('invalid_request')
  ) {
    return new GmailAuthError('INVALID_GRANT', 'טוקן החיבור ל-Google פג תוקף או בוטל. יש לחבר מחדש את Gmail.', error)
  }

  if (
    status === 401 ||
    status === 403 ||
    msg.includes('insufficientPermissions') ||
    msg.includes('Request had insufficient authentication scopes') ||
    msg.includes('Access Not Configured')
  ) {
    return new GmailAuthError('INSUFFICIENT_PERMISSIONS', 'נדרשות הרשאות גישה מתאימות ל-Gmail. יש להתחבר מחדש עם הרשאות מעודכנות.', error)
  }

  return new GmailAuthError('GMAIL_API_ERROR', msg || 'שגיאה בתקשורת מול Gmail API', error)
}

/**
 * Returns an authenticated OAuth2 client with Gmail access.
 * Prioritizes the user-authorized tokens in `google_tokens` (which include Gmail scopes),
 * with automatic token refreshing and fallback to server environment credentials.
 */
export async function getGmailAuthClient(): Promise<any> {
  const adminDb = getWorkspaceAdminDb()

  // Strategy 1: Check Supabase google_tokens table first (holds user-authorized Gmail scopes)
  try {
    let tokenRow: any = null

    try {
      const supabase = await createServerSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.id) {
        const { data } = await adminDb
          .from('google_tokens')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle()
        tokenRow = data
      }
    } catch {
      // Ignore user session retrieval error and fallback to latest token
    }

    if (!tokenRow) {
      // Check if any authorized token is stored
      const { data } = await adminDb
        .from('google_tokens')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      tokenRow = data
    }

    if (tokenRow && (tokenRow.access_token || tokenRow.refresh_token)) {
      const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.GOOGLE_CLIENT_ID
      const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET
      const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/google/callback`

      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)
      oauth2Client.setCredentials({
        access_token: tokenRow.access_token,
        refresh_token: tokenRow.refresh_token,
        expiry_date: tokenRow.expires_at,
      })

      // Auto-refresh if expired or close to expiry
      const isExpired = !tokenRow.expires_at || Date.now() >= (Number(tokenRow.expires_at) - 60000)
      if (isExpired && tokenRow.refresh_token) {
        try {
          const { credentials } = await oauth2Client.refreshAccessToken()
          oauth2Client.setCredentials(credentials)

          await adminDb
            .from('google_tokens')
            .update({
              access_token: credentials.access_token!,
              expires_at: credentials.expiry_date || null,
              refresh_token: credentials.refresh_token || tokenRow.refresh_token,
            })
            .eq('user_id', tokenRow.user_id)
        } catch (refreshErr: any) {
          console.error('[getGmailAuthClient] Refresh failed:', refreshErr)
          throw classifyGmailError(refreshErr)
        }
      }

      return oauth2Client
    }
  } catch (err: any) {
    if (err instanceof GmailAuthError && (err.code === 'INVALID_GRANT' || err.code === 'TOKEN_EXPIRED')) {
      throw err
    }
    console.warn('[getGmailAuthClient] google_tokens lookup error:', err)
  }

  // Strategy 2: Fallback to server-side configured OAuth client in environment
  const serverOAuth = getOAuth2Client()
  if (serverOAuth) {
    return serverOAuth
  }

  throw new GmailAuthError('AUTH_REQUIRED', 'חשבון Gmail עדיין לא חובר. לחץ על הכפתור כדי לחבר את החשבון.')
}

/**
 * Returns an instance of the Gmail API client.
 */
export async function getGmailClient(): Promise<gmail_v1.Gmail> {
  const auth = await getGmailAuthClient()
  return google.gmail({ version: 'v1', auth })
}

// ── Data Interfaces ────────────────────────────────────────────────────────────

export interface GmailLabelItem {
  id: string
  name: string
  type: 'user' | 'system'
  messagesUnread?: number
  messagesTotal?: number
}

export interface ClientEmailThreadHeader {
  id: string
  threadId: string
  subject: string
  snippet: string
  from: {
    name: string
    email: string
    raw: string
  }
  to: string[]
  date: string
  isUnread: boolean
  hasAttachments: boolean
  labels: string[]
  messageCount: number
}

export interface EmailAttachmentMeta {
  id: string
  filename: string
  mimeType: string
  size: number
}

export interface ClientEmailMessage {
  id: string
  threadId: string
  messageIdHeader?: string
  subject: string
  from: {
    name: string
    email: string
    raw: string
  }
  to: string[]
  cc?: string[]
  bcc?: string[]
  date: string
  snippet: string
  bodyHtml: string
  bodyText: string
  isUnread: boolean
  attachments: EmailAttachmentMeta[]
}

export interface ClientEmailThreadFull {
  threadId: string
  subject: string
  isUnread: boolean
  labels: string[]
  messages: ClientEmailMessage[]
}

// ── Parsing Helpers ────────────────────────────────────────────────────────────

function parseEmailAddress(raw: string): { name: string; email: string; raw: string } {
  if (!raw) return { name: '', email: '', raw: '' }
  const match = raw.match(/^(?:"?([^"]*)"?\s)?(?:<?(.+@[^>]+)>?)$/)
  if (match) {
    return {
      name: (match[1] || match[2] || '').trim(),
      email: (match[2] || '').trim(),
      raw,
    }
  }
  return { name: raw.trim(), email: raw.trim(), raw }
}

function decodeBase64Url(data: string): string {
  if (!data) return ''
  try {
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/')
    return Buffer.from(base64, 'base64').toString('utf8')
  } catch {
    return ''
  }
}

function extractMessageBody(payload?: gmail_v1.Schema$MessagePart): { html: string; text: string; attachments: EmailAttachmentMeta[] } {
  let html = ''
  let text = ''
  const attachments: EmailAttachmentMeta[] = []

  if (!payload) return { html, text, attachments }

  function processPart(part: gmail_v1.Schema$MessagePart) {
    const mime = part.mimeType || ''
    const filename = part.filename || ''
    const body = part.body

    if (filename && body?.attachmentId) {
      attachments.push({
        id: body.attachmentId,
        filename,
        mimeType: mime,
        size: body.size || 0,
      })
    }

    if (mime === 'text/plain' && body?.data && !text) {
      text = decodeBase64Url(body.data)
    } else if (mime === 'text/html' && body?.data && !html) {
      html = decodeBase64Url(body.data)
    }

    if (part.parts && part.parts.length > 0) {
      for (const subPart of part.parts) {
        processPart(subPart)
      }
    }
  }

  processPart(payload)

  return { html, text, attachments }
}

// ── Public API Methods ─────────────────────────────────────────────────────────

/**
 * Lists all available Gmail labels.
 */
export async function listGmailLabels(): Promise<GmailLabelItem[]> {
  const { gmailCache } = await import('@/lib/server-cache')
  return gmailCache.getOrSet('gmail-labels-all', async () => {
    try {
      const gmail = await getGmailClient()
      const res = await gmail.users.labels.list({ userId: 'me' })
      const labels = res.data.labels || []

      return labels.map((l) => ({
        id: l.id || '',
        name: l.name || '',
        type: l.type === 'system' ? 'system' : 'user',
        messagesUnread: l.messagesUnread || 0,
        messagesTotal: l.messagesTotal || 0,
      }))
    } catch (err) {
      throw classifyGmailError(err)
    }
  }, 300_000) // 5 minute TTL
}

/**
 * Lists email threads for a specific client or general inbox/folder.
 */
export async function listClientEmails({
  labelName,
  clientEmail,
  folder,
  unreadOnly = false,
  query = '',
  maxResults = 25,
  pageToken,
}: {
  labelName?: string | null
  clientEmail?: string | null
  folder?: string | null
  unreadOnly?: boolean
  query?: string
  maxResults?: number
  pageToken?: string
}): Promise<{ threads: ClientEmailThreadHeader[]; totalEstimate: number; unreadCount: number; nextPageToken?: string }> {
  try {
    const gmail = await getGmailClient()

    // Build query parts
    const qParts: string[] = []

    if (folder) {
      const f = folder.toUpperCase()
      if (f === 'INBOX') qParts.push('in:inbox')
      else if (f === 'SENT') qParts.push('in:sent')
      else if (f === 'STARRED') qParts.push('is:starred')
      else if (f === 'DRAFT' || f === 'DRAFTS') qParts.push('in:draft')
      else if (f === 'TRASH') qParts.push('in:trash')
      else if (f === 'SPAM') qParts.push('in:spam')
      else if (f === 'ALL') {
        // No folder restriction
      } else {
        qParts.push(`label:"${folder}"`)
      }
    } else if (labelName && labelName.trim()) {
      // Exact label matching
      qParts.push(`label:"${labelName.trim()}"`)
    } else if (clientEmail && clientEmail.trim()) {
      // Fallback matching by client email address
      qParts.push(`(from:${clientEmail.trim()} OR to:${clientEmail.trim()})`)
    } else {
      // Default global mailbox query: show inbox
      qParts.push('in:inbox')
    }

    if (unreadOnly) {
      qParts.push('is:unread')
    }

    if (query && query.trim()) {
      qParts.push(query.trim())
    }

    const finalQuery = qParts.join(' ')

    const listRes = await gmail.users.threads.list({
      userId: 'me',
      q: finalQuery || undefined,
      maxResults,
      pageToken,
    })

    const rawThreads = listRes.data.threads || []
    const totalEstimate = listRes.data.resultSizeEstimate || rawThreads.length

    if (rawThreads.length === 0) {
      return { threads: [], totalEstimate: 0, unreadCount: 0 }
    }

    // Fetch thread summaries concurrently (with limit)
    const threadHeaders: ClientEmailThreadHeader[] = []
    let unreadCount = 0

    // Fetch threads in parallel
    const threadFetches = await Promise.all(
      rawThreads.slice(0, maxResults).map(async (t) => {
        if (!t.id) return null
        try {
          const detail = await gmail.users.threads.get({
            userId: 'me',
            id: t.id,
            format: 'metadata',
            metadataHeaders: ['Subject', 'From', 'To', 'Date', 'Message-ID'],
          })
          return detail.data
        } catch {
          return null
        }
      })
    )

    for (const thread of threadFetches) {
      if (!thread || !thread.messages || thread.messages.length === 0) continue

      const lastMsg = thread.messages[thread.messages.length - 1]
      const firstMsg = thread.messages[0]

      const headers = lastMsg.payload?.headers || []
      const firstHeaders = firstMsg.payload?.headers || []

      const subject =
        headers.find((h) => h.name?.toLowerCase() === 'subject')?.value ||
        firstHeaders.find((h) => h.name?.toLowerCase() === 'subject')?.value ||
        '(ללא נושא)'

      const fromRaw = headers.find((h) => h.name?.toLowerCase() === 'from')?.value || ''
      const toRaw = headers.find((h) => h.name?.toLowerCase() === 'to')?.value || ''
      const dateRaw = headers.find((h) => h.name?.toLowerCase() === 'date')?.value || ''

      const isThreadUnread = thread.messages.some((m) => m.labelIds?.includes('UNREAD'))
      if (isThreadUnread) unreadCount++

      const allLabels = Array.from(new Set(thread.messages.flatMap((m) => m.labelIds || [])))
      const hasAttachments = thread.messages.some((m) =>
        m.payload?.parts?.some((p) => Boolean(p.filename && p.body?.attachmentId))
      )

      threadHeaders.push({
        id: thread.id || lastMsg.id || '',
        threadId: thread.id || '',
        subject,
        snippet: lastMsg.snippet || thread.messages[0].snippet || '',
        from: parseEmailAddress(fromRaw),
        to: toRaw.split(',').map((s) => s.trim()),
        date: dateRaw ? new Date(dateRaw).toISOString() : new Date().toISOString(),
        isUnread: isThreadUnread,
        hasAttachments,
        labels: allLabels,
        messageCount: thread.messages.length,
      })
    }

    // Sort by date descending
    threadHeaders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return {
      threads: threadHeaders,
      totalEstimate,
      unreadCount,
      nextPageToken: listRes.data.nextPageToken || undefined,
    }
  } catch (err) {
    throw classifyGmailError(err)
  }
}

/**
 * Fetches the complete message thread with all messages, HTML/text body, and attachments.
 */
export async function getEmailThread(threadId: string): Promise<ClientEmailThreadFull> {
  try {
    const gmail = await getGmailClient()
    const res = await gmail.users.threads.get({
      userId: 'me',
      id: threadId,
      format: 'full',
    })

    const thread = res.data
    const messages = thread.messages || []

    if (messages.length === 0) {
      throw new GmailAuthError('NOT_FOUND', 'שרשור המייל לא נמצא')
    }

    const firstHeaders = messages[0].payload?.headers || []
    const subject = firstHeaders.find((h) => h.name?.toLowerCase() === 'subject')?.value || '(ללא נושא)'
    const isUnread = messages.some((m) => m.labelIds?.includes('UNREAD'))
    const labels = Array.from(new Set(messages.flatMap((m) => m.labelIds || [])))

    const parsedMessages: ClientEmailMessage[] = messages.map((m) => {
      const headers = m.payload?.headers || []
      const msgSubject = headers.find((h) => h.name?.toLowerCase() === 'subject')?.value || subject
      const fromRaw = headers.find((h) => h.name?.toLowerCase() === 'from')?.value || ''
      const toRaw = headers.find((h) => h.name?.toLowerCase() === 'to')?.value || ''
      const ccRaw = headers.find((h) => h.name?.toLowerCase() === 'cc')?.value || ''
      const bccRaw = headers.find((h) => h.name?.toLowerCase() === 'bcc')?.value || ''
      const dateRaw = headers.find((h) => h.name?.toLowerCase() === 'date')?.value || ''
      const messageIdHeader = headers.find((h) => h.name?.toLowerCase() === 'message-id')?.value

      const { html, text, attachments } = extractMessageBody(m.payload)

      return {
        id: m.id || '',
        threadId: m.threadId || threadId,
        messageIdHeader: messageIdHeader || undefined,
        subject: msgSubject,
        from: parseEmailAddress(fromRaw),
        to: toRaw.split(',').map((s) => s.trim()).filter(Boolean),
        cc: ccRaw ? ccRaw.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        bcc: bccRaw ? bccRaw.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        date: dateRaw ? new Date(dateRaw).toISOString() : new Date().toISOString(),
        snippet: m.snippet || '',
        bodyHtml: html,
        bodyText: text,
        isUnread: Boolean(m.labelIds?.includes('UNREAD')),
        attachments,
      }
    })

    return {
      threadId,
      subject,
      isUnread,
      labels,
      messages: parsedMessages,
    }
  } catch (err) {
    throw classifyGmailError(err)
  }
}

/**
 * Marks an entire thread as read or unread.
 */
export async function markEmailThreadRead(threadId: string, read = true): Promise<boolean> {
  try {
    const gmail = await getGmailClient()
    await gmail.users.threads.modify({
      userId: 'me',
      id: threadId,
      requestBody: read
        ? { removeLabelIds: ['UNREAD'] }
        : { addLabelIds: ['UNREAD'] },
    })
    return true
  } catch (err) {
    throw classifyGmailError(err)
  }
}

// ── Email Sending & Replying ──────────────────────────────────────────────────

function buildRfc2822Message({
  to,
  subject,
  bodyHtml,
  bodyText,
  cc,
  bcc,
  inReplyTo,
  references,
}: {
  to: string | string[]
  subject: string
  bodyHtml?: string
  bodyText?: string
  cc?: string | string[]
  bcc?: string | string[]
  inReplyTo?: string
  references?: string
}): string {
  const toStr = Array.isArray(to) ? to.join(', ') : to
  const ccStr = cc ? (Array.isArray(cc) ? cc.join(', ') : cc) : null
  const bccStr = bcc ? (Array.isArray(bcc) ? bcc.join(', ') : bcc) : null

  // UTF-8 encoded subject
  const utf8Subject = `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`

  const boundary = `__boundary_${Date.now()}__`

  const headers: string[] = [
    `To: ${toStr}`,
    `Subject: ${utf8Subject}`,
    'MIME-Version: 1.0',
  ]

  if (ccStr) headers.push(`Cc: ${ccStr}`)
  if (bccStr) headers.push(`Bcc: ${bccStr}`)
  if (inReplyTo) headers.push(`In-Reply-To: ${inReplyTo}`)
  if (references) headers.push(`References: ${references}`)

  const textContent = bodyText || ''
  const htmlContent = bodyHtml || (bodyText ? `<div dir="rtl">${bodyText.replace(/\n/g, '<br/>')}</div>` : '')

  if (htmlContent && textContent) {
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`)
    const parts = [
      headers.join('\r\n'),
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(textContent, 'utf8').toString('base64'),
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(htmlContent, 'utf8').toString('base64'),
      '',
      `--${boundary}--`,
    ]
    return parts.join('\r\n')
  }

  // Single HTML/Text part
  headers.push('Content-Type: text/html; charset=UTF-8')
  headers.push('Content-Transfer-Encoding: base64')
  return `${headers.join('\r\n')}\r\n\r\n${Buffer.from(htmlContent || textContent, 'utf8').toString('base64')}`
}

/**
 * Sends a reply to an existing Gmail thread.
 */
export async function replyToEmailThread({
  threadId,
  to,
  subject,
  bodyHtml,
  bodyText,
  cc,
  inReplyToHeader,
}: {
  threadId: string
  to: string | string[]
  subject: string
  bodyHtml?: string
  bodyText?: string
  cc?: string | string[]
  inReplyToHeader?: string
}): Promise<{ id: string; threadId: string }> {
  try {
    const gmail = await getGmailClient()

    const replySubject = subject.startsWith('Re:') || subject.startsWith('תגובה:')
      ? subject
      : `Re: ${subject}`

    const rawMessage = buildRfc2822Message({
      to,
      subject: replySubject,
      bodyHtml,
      bodyText,
      cc,
      inReplyTo: inReplyToHeader,
      references: inReplyToHeader,
    })

    const encodedRaw = Buffer.from(rawMessage, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedRaw,
        threadId,
      },
    })

    return {
      id: res.data.id || '',
      threadId: res.data.threadId || threadId,
    }
  } catch (err) {
    throw classifyGmailError(err)
  }
}

/**
 * Sends a new independent email.
 */
export async function sendNewClientEmail({
  to,
  subject,
  bodyHtml,
  bodyText,
  cc,
}: {
  to: string | string[]
  subject: string
  bodyHtml?: string
  bodyText?: string
  cc?: string | string[]
}): Promise<{ id: string; threadId: string }> {
  try {
    const gmail = await getGmailClient()

    const rawMessage = buildRfc2822Message({
      to,
      subject,
      bodyHtml,
      bodyText,
      cc,
    })

    const encodedRaw = Buffer.from(rawMessage, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedRaw,
      },
    })

    return {
      id: res.data.id || '',
      threadId: res.data.threadId || '',
    }
  } catch (err) {
    throw classifyGmailError(err)
  }
}
