/**
 * src/ai/systemContext.ts
 *
 * בונה "context document" דינמי שמוזרק ל-system instruction של הבוט.
 * מכיל רשימות עדכניות (שמות + IDs) של כל הישויות הרלוונטיות במערכת.
 *
 * הרעיון: הבוט מקבל context מלא ולא צריך לנחש שמות.
 * לדוגמה אם המשתמש כותב "אחמד" — הבוט מזהה מיד באיזה עובד מדובר.
 */

import { createClient } from '@supabase/supabase-js'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface SystemContextData {
  projects: Array<{ id: string; name: string; status: string; address?: string }>
  mosheWorkers: Array<{ id: string; name: string; phone?: string; role?: string }>
  partners: Array<{ id: string; name: string; phone?: string; project_id: string; project_name?: string }>
  clients: Array<{ id: string; name: string; phone?: string; status: string }>
  officeEmployees: Array<{ id: string; name?: string; email: string; role?: string }>
}

/**
 * שולף את כל הנתונים הדרושים לבניית ה-context.
 * נקרא בכל בקשה לבוט — מהיר כי מחזיר רק שדות מינימליים.
 */
export async function fetchSystemContext(): Promise<SystemContextData> {
  const [
    { data: projects },
    { data: workers },
    { data: partnersRaw },
    { data: clients },
    { data: employees },
  ] = await Promise.all([
    db.from('moshe_projects')
      .select('id, name, status, address')
      .neq('status', 'closed')
      .order('name'),
    db.from('moshe_workers')
      .select('id, name, phone, role')
      .eq('is_active', true)
      .order('name'),
    db.from('moshe_partners')
      .select('id, name, phone, project_id, moshe_projects(name)')
      .order('name'),
    db.from('clients')
      .select('id, name, phone, status')
      .neq('status', 'archived')
      .order('name')
      .limit(50),
    db.from('profiles')
      .select('id, full_name, email, role')
      .order('full_name')
      .limit(30),
  ])

  const partners = (partnersRaw ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    phone: p.phone ?? undefined,
    project_id: p.project_id,
    project_name: (p.moshe_projects as any)?.name ?? undefined,
  }))

  return {
    projects: (projects ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      address: p.address ?? undefined,
    })),
    mosheWorkers: (workers ?? []).map((w: any) => ({
      id: w.id,
      name: w.name,
      phone: w.phone ?? undefined,
      role: w.role ?? undefined,
    })),
    partners,
    clients: (clients ?? []).map((c: any) => ({
      id: c.id,
      name: c.name,
      phone: c.phone ?? undefined,
      status: c.status,
    })),
    officeEmployees: (employees ?? []).map((e: any) => ({
      id: e.id,
      name: e.full_name ?? undefined,
      email: e.email,
      role: e.role ?? undefined,
    })),
  }
}

/**
 * ממיר את ה-context ל-string לקריא שמוזרק ל-system instruction.
 */
export function formatSystemContext(ctx: SystemContextData): string {
  const lines: string[] = []

  lines.push('━━━ מידע עדכני מהמערכת ━━━')
  lines.push('(ה-ID מצוין כדי שתוכל להשתמש בו ישירות בכלים. אל תמציא ID — השתמש רק במה שנמצא כאן.)')
  lines.push('')

  // פרויקטים פעילים
  if (ctx.projects.length > 0) {
    lines.push('📁 פרויקטים פעילים בפורטל (פורטל = פרויקטי משה פרוש):')
    ctx.projects.forEach(p => {
      const addr = p.address ? ` | ${p.address}` : ''
      lines.push(`  • ${p.name}${addr} [ID: ${p.id}]`)
    })
    lines.push('')
  }

  // עובדי פורטל משה
  if (ctx.mosheWorkers.length > 0) {
    lines.push('👷 עובדי הפורטל (עובדי משה):')
    ctx.mosheWorkers.forEach(w => {
      const phone = w.phone ? ` | ${w.phone}` : ''
      const role = w.role ? ` | ${w.role}` : ''
      lines.push(`  • ${w.name}${phone}${role} [ID: ${w.id}]`)
    })
    lines.push('')
  }

  // שותפים
  if (ctx.partners.length > 0) {
    lines.push('🤝 שותפים:')
    ctx.partners.forEach(p => {
      const proj = p.project_name ? ` (פרויקט: ${p.project_name})` : ''
      const phone = p.phone ? ` | ${p.phone}` : ''
      lines.push(`  • ${p.name}${phone}${proj} [ID: ${p.id}]`)
    })
    lines.push('')
  }

  // לקוחות (50 ראשונים)
  if (ctx.clients.length > 0) {
    lines.push('👥 לקוחות (50 ראשונים פעילים):')
    ctx.clients.slice(0, 20).forEach(c => {
      const phone = c.phone ? ` | ${c.phone}` : ''
      lines.push(`  • ${c.name}${phone} [ID: ${c.id}]`)
    })
    if (ctx.clients.length > 20) {
      lines.push(`  ... ועוד ${ctx.clients.length - 20} לקוחות. השתמש בכלי searchClients לחיפוש.`)
    }
    lines.push('')
  }

  // עובדי משרד
  if (ctx.officeEmployees.length > 0) {
    lines.push('🏢 עובדי המשרד (מערכת מנהל):')
    ctx.officeEmployees.forEach(e => {
      const name = e.name || e.email
      const role = e.role ? ` | ${e.role}` : ''
      lines.push(`  • ${name}${role} [ID: ${e.id}]`)
    })
    lines.push('')
  }

  lines.push('━━━ סוף מידע מערכת ━━━')
  lines.push('')

  return lines.join('\n')
}
