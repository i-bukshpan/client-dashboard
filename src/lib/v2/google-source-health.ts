import 'server-only'

export type GoogleSourceStatus = 'ok' | 'reauth_required' | 'rate_limited' | 'permission_denied' | 'unavailable'

export interface GoogleSourceHealth {
  status: GoogleSourceStatus
  message?: string
  retryable?: boolean
  retryAfterSeconds?: number
}

export function classifyGoogleSourceError(error: unknown): GoogleSourceHealth {
  const candidate = error as { code?: unknown; status?: unknown; message?: unknown; response?: { status?: unknown; headers?: Record<string, unknown> } }
  const status = Number(candidate?.response?.status ?? candidate?.status ?? candidate?.code)
  const message = typeof candidate?.message === 'string' ? candidate.message : 'Google service unavailable'
  if (status === 401 || /invalid_grant|expired|revoked/i.test(message)) {
    return { status: 'reauth_required', message: 'החיבור ל-Google פג תוקף. יש להתחבר מחדש.', retryable: false }
  }
  if (status === 403) {
    return { status: 'permission_denied', message: 'ההרשאה לשירות Google חסרה או הוסרה.', retryable: false }
  }
  if (status === 429 || /rate.?limit|quota/i.test(message)) {
    const retryAfter = Number(candidate?.response?.headers?.['retry-after'])
    return { status: 'rate_limited', message: 'Google מגביל זמנית את קצב הבקשות.', retryable: true, retryAfterSeconds: Number.isFinite(retryAfter) ? retryAfter : 30 }
  }
  return { status: 'unavailable', message: 'שירות Google אינו זמין זמנית.', retryable: status >= 500 || !status }
}
