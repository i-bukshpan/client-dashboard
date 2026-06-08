/**
 * POST /api/reminder-cron
 *
 * נקודת כניסה ל-N8N לניהול תזכורות WhatsApp.
 *
 * מצב 1 — GET / POST ללא body:
 *   שולף את כל התזכורות הממתינות שהגיע זמנן,
 *   מסמן אותן כ"נשלחו" ומחזיר רשימה ל-N8N.
 *
 * מצב 2 — POST עם body: { action: 'generate_daily' }:
 *   מייצר תזכורות בוקר אוטומטיות (פגישות, תשלומים, משימות עובדים)
 *   ושומר אותן ב-DB לשליחה מאוחרת.
 *
 * Auth: Bearer / x-api-key עם SUPABASE_SERVICE_ROLE_KEY
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Auth ───────────────────────────────────────────────────────────────────────

function checkAuth(request: Request): NextResponse | null {
  const authHeader = request.headers.get('Authorization')
  const apiKeyHeader = request.headers.get('x-api-key')
  let providedToken = ''
  if (authHeader?.startsWith('Bearer ')) providedToken = authHeader.substring(7)
  else if (authHeader) providedToken = authHeader
  else if (apiKeyHeader) providedToken = apiKeyHeader
  providedToken = providedToken.trim()
  const expectedKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  if (!expectedKey || !providedToken || providedToken !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

// ── Format utils ────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return '₪' + Math.round(n).toLocaleString('he-IL')
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('he-IL', {
    timeZone: 'Asia/Jerusalem',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('he-IL', {
    timeZone: 'Asia/Jerusalem',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function todayRange() {
  const now = new Date()
  // Start of today Israel time (UTC is -3h behind IL in summer)
  const startOfDayISO = new Date(now.toLocaleDateString('sv', { timeZone: 'Asia/Jerusalem' }) + 'T00:00:00+03:00').toISOString()
  const endOfDayISO = new Date(now.toLocaleDateString('sv', { timeZone: 'Asia/Jerusalem' }) + 'T23:59:59+03:00').toISOString()
  const tomorrowISO = new Date(new Date(startOfDayISO).getTime() + 24 * 60 * 60 * 1000).toISOString()
  const dayAfterISO = new Date(new Date(startOfDayISO).getTime() + 48 * 60 * 60 * 1000).toISOString()
  return { startOfDayISO, endOfDayISO, tomorrowISO, dayAfterISO }
}

// ── GET / POST without body: fetch pending reminders ─────────────────────────

async function fetchPendingReminders() {
  // Use current time in ISO UTC
  const now = new Date()
  const nowISO = now.toISOString()

  // Fetch all unsent reminders whose scheduled_at has passed
  // We compare using UTC timestamps — Supabase stores TIMESTAMPTZ correctly
  const { data, error } = await db
    .from('bot_reminders')
    .select('id, phone, message, is_recurring, recur_cron')
    .eq('is_sent', false)
    .lte('scheduled_at', nowISO)
    .order('scheduled_at', { ascending: true })
    .limit(50)

  if (error) {
    console.error('[reminder-cron] fetch error:', error)
    return { reminders: [] }
  }

  if (!data || data.length === 0) return { reminders: [] }

  // Mark as sent
  const ids = data.map((r: any) => r.id)
  await db
    .from('bot_reminders')
    .update({ is_sent: true, sent_at: now })
    .in('id', ids)

  // For recurring reminders, schedule next occurrence (simple: add 1 day for daily)
  for (const r of (data as any[])) {
    if (r.is_recurring && r.recur_cron === 'daily') {
      const nextAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      await db.from('bot_reminders').insert({
        phone: r.phone,
        message: r.message,
        reminder_type: 'daily_tasks',
        scheduled_at: nextAt,
        is_sent: false,
        is_recurring: true,
        recur_cron: 'daily',
      })
    }
  }

  return {
    reminders: (data as any[]).map((r) => ({
      phone: r.phone,
      message: r.message,
    })),
  }
}

// ── Generate daily morning reminders ────────────────────────────────────────────

async function generateDailyReminders() {
  const { startOfDayISO, endOfDayISO, tomorrowISO, dayAfterISO } = todayRange()
  const generatedCount = { meetings: 0, payments: 0, workers: 0 }

  // Fetch admin phones from env
  const adminPhones: string[] = []
  if (process.env.BOT_ADMIN_PHONE) adminPhones.push(process.env.BOT_ADMIN_PHONE.replace(/^\+/, ''))
  if (process.env.BOT_EXTRA_ADMIN_PHONE) adminPhones.push(process.env.BOT_EXTRA_ADMIN_PHONE.replace(/^\+/, ''))
  if (process.env.BOT_MOSHE_PHONE) adminPhones.push(process.env.BOT_MOSHE_PHONE.replace(/^\+/, ''))

  // Schedule for 07:00 Israel time today
  const sendAt = new Date(new Date().toLocaleDateString('sv', { timeZone: 'Asia/Jerusalem' }) + 'T07:00:00+03:00').toISOString()

  // 1. Calendar events today
  const { data: todayEvents } = await db
    .from('moshe_calendar_events')
    .select('title, start_time, notes')
    .gte('start_time', startOfDayISO)
    .lte('start_time', endOfDayISO)
    .order('start_time', { ascending: true })

  if (todayEvents && todayEvents.length > 0) {
    const lines = (todayEvents as any[]).map(
      (e) => `• ${e.title} בשעה ${fmtTime(e.start_time)}${e.notes ? ' — ' + e.notes : ''}`
    )
    const message = `📅 *פגישות היום (${fmtDate(startOfDayISO)}):*\n${lines.join('\n')}`
    for (const phone of adminPhones) {
      await db.from('bot_reminders').insert({
        phone, message, reminder_type: 'meeting_today', scheduled_at: sendAt, is_sent: false,
      })
    }
    generatedCount.meetings = todayEvents.length
  }

  // 2. Payments due today or tomorrow
  const paymentMessages: string[] = []

  // Project payments
  const { data: projPay } = await db
    .from('moshe_project_payments')
    .select('amount, due_date, notes, moshe_projects(name)')
    .eq('is_paid', false)
    .gte('due_date', startOfDayISO.substring(0, 10))
    .lte('due_date', dayAfterISO.substring(0, 10))

  for (const p of (projPay as any[]) ?? []) {
    const proj = (p.moshe_projects as any)?.name || 'פרויקט'
    paymentMessages.push(`• תשלום ${fmt(p.amount)} לפרויקט ${proj} — ${fmtDate(p.due_date)}${p.notes ? ' (' + p.notes + ')' : ''}`)
  }

  // Buyer payments
  const { data: buyerPay } = await db
    .from('moshe_buyer_payments')
    .select('amount, due_date, notes, moshe_buyers(name), moshe_projects(name)')
    .eq('is_received', false)
    .gte('due_date', startOfDayISO.substring(0, 10))
    .lte('due_date', dayAfterISO.substring(0, 10))

  for (const p of (buyerPay as any[]) ?? []) {
    const buyer = (p.moshe_buyers as any)?.name || 'קונה'
    const proj = (p.moshe_projects as any)?.name || 'פרויקט'
    paymentMessages.push(`• תקבול ${fmt(p.amount)} מ${buyer} (${proj}) — ${fmtDate(p.due_date)}${p.notes ? ' (' + p.notes + ')' : ''}`)
  }

  // Loan payments
  const { data: loanPay } = await db
    .from('moshe_loan_payments')
    .select('amount, due_date, notes, moshe_loans(lender), moshe_projects(name)')
    .eq('is_paid', false)
    .gte('due_date', startOfDayISO.substring(0, 10))
    .lte('due_date', dayAfterISO.substring(0, 10))

  for (const p of (loanPay as any[]) ?? []) {
    const lender = (p.moshe_loans as any)?.lender || 'מלווה'
    paymentMessages.push(`• החזר הלוואה ${fmt(p.amount)} ל${lender} — ${fmtDate(p.due_date)}${p.notes ? ' (' + p.notes + ')' : ''}`)
  }

  if (paymentMessages.length > 0) {
    const message = `💰 *תשלומים קרובים (היום ומחר):*\n${paymentMessages.join('\n')}`
    for (const phone of adminPhones) {
      await db.from('bot_reminders').insert({
        phone, message, reminder_type: 'payment_due', scheduled_at: sendAt, is_sent: false,
      })
    }
    generatedCount.payments = paymentMessages.length
  }

  // 3. Worker tasks (send to each worker with phone + open tasks)
  const { data: workers } = await db
    .from('moshe_workers')
    .select('id, name, phone')
    .eq('is_active', true)
    .not('phone', 'is', null)

  for (const worker of (workers as any[]) ?? []) {
    if (!worker.phone) continue

    const { data: tasks } = await db
      .from('moshe_worker_tasks')
      .select('title, due_date')
      .eq('worker_id', worker.id)
      .eq('is_done', false)
      .order('due_date', { ascending: true })
      .limit(10)

    if (!tasks || tasks.length === 0) continue

    const lines = (tasks as any[]).map(
      (t) => `• ${t.title}${t.due_date ? ' (עד ' + fmtDate(t.due_date) + ')' : ''}`
    )
    const message = `🌅 *בוקר טוב ${worker.name}!*\nהמשימות הפתוחות שלך:\n${lines.join('\n')}`

    await db.from('bot_reminders').insert({
      phone: worker.phone.replace(/^\+/, ''),
      user_name: worker.name,
      message,
      reminder_type: 'daily_tasks',
      scheduled_at: sendAt,
      is_sent: false,
    })
    generatedCount.workers++
  }

  return { success: true, generated: generatedCount }
}

// ── Generate weekly overdue report ────────────────────────────────────────────

async function generateOverdueReport() {
  const today = new Date().toISOString().split('T')[0]
  const sendAt = new Date(new Date().toLocaleDateString('sv', { timeZone: 'Asia/Jerusalem' }) + 'T07:00:00+03:00').toISOString()

  const adminPhones: string[] = []
  if (process.env.BOT_MOSHE_PHONE) adminPhones.push(process.env.BOT_MOSHE_PHONE.replace(/^\+/, ''))

  const lines: string[] = []

  const { data: pp } = await db.from('moshe_project_payments').select('amount, due_date, moshe_projects(name)').eq('is_paid', false).lt('due_date', today)
  for (const p of (pp as any[]) ?? []) lines.push(`• הוצאה ${fmt(p.amount)} — ${(p.moshe_projects as any)?.name} (${fmtDate(p.due_date)})`)

  const { data: bp } = await db.from('moshe_buyer_payments').select('amount, due_date, moshe_buyers(name), moshe_projects(name)').eq('is_received', false).lt('due_date', today)
  for (const p of (bp as any[]) ?? []) lines.push(`• תקבול ${fmt(p.amount)} מ${(p.moshe_buyers as any)?.name} — ${(p.moshe_projects as any)?.name} (${fmtDate(p.due_date)})`)

  const { data: lp } = await db.from('moshe_loan_payments').select('amount, due_date, moshe_loans(lender)').eq('is_paid', false).lt('due_date', today)
  for (const p of (lp as any[]) ?? []) lines.push(`• הלוואה ${fmt(p.amount)} מ${(p.moshe_loans as any)?.lender} (${fmtDate(p.due_date)})`)

  if (lines.length === 0) return { success: true, overdue: 0 }

  const message = `⚠️ *דוח איחורים שבועי (${fmtDate(today)}):*\n${lines.join('\n')}`
  for (const phone of adminPhones) {
    await db.from('bot_reminders').insert({
      phone, message, reminder_type: 'overdue', scheduled_at: sendAt, is_sent: false,
    })
  }

  return { success: true, overdue: lines.length }
}

// ── Handlers ────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const authError = checkAuth(request)
  if (authError) return authError
  try {
    const result = await fetchPendingReminders()
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[reminder-cron] GET error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const authError = checkAuth(request)
  if (authError) return authError
  try {
    let body: { action?: string } = {}
    try { body = await request.json() } catch { /* empty body = fetch reminders */ }

    if (body.action === 'generate_daily') {
      const result = await generateDailyReminders()
      return NextResponse.json(result)
    }

    if (body.action === 'generate_overdue') {
      const result = await generateOverdueReport()
      return NextResponse.json(result)
    }

    // Default: fetch pending reminders (same as GET)
    const result = await fetchPendingReminders()
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[reminder-cron] POST error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
