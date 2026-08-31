/**
 * src/app/workspace/actions/emails.ts
 *
 * Server Actions for Gmail integration in Nehemiah OS Workspace v2.
 * All actions require Workspace Admin role.
 */
'use server'

import { revalidatePath } from 'next/cache'
import {
  listClientEmails,
  getEmailThread,
  markEmailThreadRead,
  replyToEmailThread,
  sendNewClientEmail,
  listGmailLabels,
  isGmailAuthError,
  type GmailLabelItem,
  type ClientEmailThreadHeader,
  type ClientEmailThreadFull,
} from '@/lib/google-gmail'
import {
  getWorkspaceAdminDb,
  getWorkspaceClient,
  requireWorkspaceAdmin,
} from '@/lib/v2/workspace-dal'

export interface EmailActionResult<T> {
  success?: boolean
  data?: T
  error?: string
  isAuthError?: boolean
  errorCode?: string
}

function handleGmailError(error: unknown, fallbackMessage: string): { error: string; isAuthError: boolean; errorCode: string } {
  console.error('[workspace/emails] Error:', error)
  if (isGmailAuthError(error)) {
    const isAuth = ['AUTH_REQUIRED', 'INVALID_GRANT', 'INSUFFICIENT_PERMISSIONS', 'TOKEN_EXPIRED'].includes(error.code)
    return {
      error: error.message,
      isAuthError: isAuth,
      errorCode: error.code,
    }
  }
  const msg = error instanceof Error && error.message ? error.message : fallbackMessage
  return {
    error: msg,
    isAuthError: false,
    errorCode: 'UNKNOWN_ERROR',
  }
}

/**
 * Lists email threads across the entire Gmail inbox, folders, or specific label (Global Mailbox).
 */
export async function getGlobalEmailsAction(
  options?: {
    folder?: string
    labelName?: string
    unreadOnly?: boolean
    query?: string
    pageToken?: string
    maxResults?: number
  }
): Promise<EmailActionResult<{
  threads: ClientEmailThreadHeader[]
  totalEstimate: number
  unreadCount: number
  folder?: string
  labelName?: string
  nextPageToken?: string
}>> {
  try {
    await requireWorkspaceAdmin()

    const res = await listClientEmails({
      folder: options?.folder,
      labelName: options?.labelName,
      unreadOnly: options?.unreadOnly,
      query: options?.query,
      pageToken: options?.pageToken,
      maxResults: options?.maxResults ?? 35,
    })

    return {
      success: true,
      data: {
        threads: res.threads,
        totalEstimate: res.totalEstimate,
        unreadCount: res.unreadCount,
        folder: options?.folder,
        labelName: options?.labelName,
        nextPageToken: res.nextPageToken,
      },
    }
  } catch (error) {
    const errInfo = handleGmailError(error, 'שגיאה בטעינת תיבת הדוא״ל הראשית')
    return {
      error: errInfo.error,
      isAuthError: errInfo.isAuthError,
      errorCode: errInfo.errorCode,
    }
  }
}

/**
 * Lists email threads associated with a client's label or email.
 */
export async function getClientEmailsAction(
  clientId: string,
  options?: {
    unreadOnly?: boolean
    query?: string
    pageToken?: string
    maxResults?: number
  }
): Promise<EmailActionResult<{
  threads: ClientEmailThreadHeader[]
  totalEstimate: number
  unreadCount: number
  labelName: string | null
  clientEmail: string | null
  nextPageToken?: string
}>> {
  try {
    await requireWorkspaceAdmin()
    const client = await getWorkspaceClient(clientId)

    if (!client.gmail_label || client.gmail_label.trim() === '') {
      return {
        success: true,
        data: {
          threads: [],
          totalEstimate: 0,
          unreadCount: 0,
          labelName: null,
          clientEmail: client.email,
        },
      }
    }

    const res = await listClientEmails({
      labelName: client.gmail_label,
      clientEmail: client.email,
      unreadOnly: options?.unreadOnly,
      query: options?.query,
      pageToken: options?.pageToken,
      maxResults: options?.maxResults ?? 30,
    })

    return {
      success: true,
      data: {
        threads: res.threads,
        totalEstimate: res.totalEstimate,
        unreadCount: res.unreadCount,
        labelName: client.gmail_label,
        clientEmail: client.email,
        nextPageToken: res.nextPageToken,
      },
    }
  } catch (error) {
    const errInfo = handleGmailError(error, 'שגיאה בטעינת מיילים של הלקוח')
    return {
      error: errInfo.error,
      isAuthError: errInfo.isAuthError,
      errorCode: errInfo.errorCode,
    }
  }
}

/**
 * Fetches complete thread conversation.
 */
export async function getEmailThreadAction(
  clientId: string,
  threadId: string
): Promise<EmailActionResult<ClientEmailThreadFull>> {
  try {
    await requireWorkspaceAdmin()
    if (!threadId) throw new Error('מזהה שרשור לא צוין')

    const thread = await getEmailThread(threadId)
    return { success: true, data: thread }
  } catch (error) {
    const errInfo = handleGmailError(error, 'שגיאה בטעינת שרשור המייל')
    return {
      error: errInfo.error,
      isAuthError: errInfo.isAuthError,
      errorCode: errInfo.errorCode,
    }
  }
}

/**
 * Marks a thread as read or unread.
 */
export async function markEmailThreadReadAction(
  clientId: string,
  threadId: string,
  read = true
): Promise<EmailActionResult<{ threadId: string; isRead: boolean }>> {
  try {
    await requireWorkspaceAdmin()
    await markEmailThreadRead(threadId, read)
    return { success: true, data: { threadId, isRead: read } }
  } catch (error) {
    const errInfo = handleGmailError(error, 'שגיאה בעדכון סטטוס קריאה')
    return {
      error: errInfo.error,
      isAuthError: errInfo.isAuthError,
      errorCode: errInfo.errorCode,
    }
  }
}

/**
 * Replies to an existing email thread.
 */
export async function replyToEmailAction(
  clientId: string,
  params: {
    threadId: string
    to: string | string[]
    subject: string
    bodyText: string
    bodyHtml?: string
    cc?: string | string[]
    inReplyToHeader?: string
  }
): Promise<EmailActionResult<{ id: string; threadId: string }>> {
  try {
    await requireWorkspaceAdmin()
    if (!params.threadId) throw new Error('מזהה שרשור חסר')
    if (!params.bodyText?.trim()) throw new Error('תוכן ההודעה ריק')

    const sent = await replyToEmailThread({
      threadId: params.threadId,
      to: params.to,
      subject: params.subject,
      bodyText: params.bodyText,
      bodyHtml: params.bodyHtml,
      cc: params.cc,
      inReplyToHeader: params.inReplyToHeader,
    })

    revalidatePath(`/workspace/clients/${clientId}`)
    return { success: true, data: sent }
  } catch (error) {
    const errInfo = handleGmailError(error, 'שגיאה בשליחת מענה למייל')
    return {
      error: errInfo.error,
      isAuthError: errInfo.isAuthError,
      errorCode: errInfo.errorCode,
    }
  }
}

/**
 * Sends a new direct email to the client or other recipient.
 */
export async function sendClientEmailAction(
  clientId: string,
  params: {
    to: string | string[]
    subject: string
    bodyText: string
    bodyHtml?: string
    cc?: string | string[]
  }
): Promise<EmailActionResult<{ id: string; threadId: string }>> {
  try {
    await requireWorkspaceAdmin()
    if (!params.to) throw new Error('כתובת נמען חסרה')
    if (!params.subject?.trim()) throw new Error('נושא המייל ריק')
    if (!params.bodyText?.trim()) throw new Error('תוכן המייל ריק')

    const sent = await sendNewClientEmail({
      to: params.to,
      subject: params.subject,
      bodyText: params.bodyText,
      bodyHtml: params.bodyHtml,
      cc: params.cc,
    })

    revalidatePath(`/workspace/clients/${clientId}`)
    return { success: true, data: sent }
  } catch (error) {
    const errInfo = handleGmailError(error, 'שגיאה בשליחת המייל')
    return {
      error: errInfo.error,
      isAuthError: errInfo.isAuthError,
      errorCode: errInfo.errorCode,
    }
  }
}

/**
 * Lists all available Gmail labels for selection.
 */
export async function getAvailableGmailLabelsAction(): Promise<EmailActionResult<GmailLabelItem[]>> {
  try {
    await requireWorkspaceAdmin()
    const labels = await listGmailLabels()
    // Sort: user labels first, alphabetically
    labels.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'user' ? -1 : 1
      return a.name.localeCompare(b.name, 'he')
    })
    return { success: true, data: labels }
  } catch (error) {
    const errInfo = handleGmailError(error, 'שגיאה בטעינת תוויות Gmail')
    return {
      error: errInfo.error,
      isAuthError: errInfo.isAuthError,
      errorCode: errInfo.errorCode,
    }
  }
}

/**
 * Updates the client's linked Gmail label in the database.
 */
export async function updateClientGmailLabelAction(
  clientId: string,
  gmailLabel: string | null
): Promise<EmailActionResult<{ gmailLabel: string | null }>> {
  try {
    await requireWorkspaceAdmin()
    const sanitized = gmailLabel?.trim() || null
    const db = getWorkspaceAdminDb()

    const { error } = await db
      .from('clients')
      .update({ gmail_label: sanitized })
      .eq('id', clientId)

    if (error) throw new Error(error.message)

    revalidatePath(`/workspace/clients/${clientId}`)
    revalidatePath('/workspace/clients')
    return { success: true, data: { gmailLabel: sanitized } }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'שגיאה בעדכון תווית Gmail',
      isAuthError: false,
    }
  }
}
