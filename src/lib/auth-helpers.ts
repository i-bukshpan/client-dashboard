/**
 * Centralized authorization & email helper functions.
 * All email comparisons are normalized (trimmed and lowercased) to avoid
 * case-sensitivity or whitespace mismatches with environment variables.
 */

export function normalizeEmail(email?: string | null): string {
  return (email || '').trim().toLowerCase()
}

export function getAdminEmail(): string {
  return normalizeEmail(process.env.NEXT_PUBLIC_ADMIN_EMAIL)
}

export function getMosheEmail(): string {
  return normalizeEmail(process.env.MOSHE_EMAIL)
}

export function isAdminEmail(email?: string | null): boolean {
  const admin = getAdminEmail()
  const current = normalizeEmail(email)
  return Boolean(admin && current && current === admin)
}

export function isMosheEmail(email?: string | null): boolean {
  const moshe = getMosheEmail()
  const current = normalizeEmail(email)
  return Boolean(moshe && current && current === moshe)
}

export function isAuthorizedEmail(email?: string | null): boolean {
  return isAdminEmail(email) || isMosheEmail(email)
}

export function resolveUserDestination(email?: string | null, dbRole?: string | null): string {
  if (isAdminEmail(email) || dbRole === 'admin') {
    return '/admin/dashboard'
  }
  if (isMosheEmail(email)) {
    return '/moshe'
  }
  if (dbRole === 'employee') {
    return '/employee/dashboard'
  }
  return '/employee/dashboard'
}
