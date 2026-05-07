import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * GET /api/moshe/daily-summary
 * 
 * סיכום יומי עבור פורטל משה בלבד (נדל"ן/קבלנות)
 * כולל: אירועי יומן, תשלומים לביצוע/לגבייה, הלוואות, שותפים, תובנות
 */

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // ── Forgiving Auth Logic ──
  const authHeader = request.headers.get('Authorization')
  const apiKeyHeader = request.headers.get('x-api-key')
  
  // Extract token from Bearer or use x-api-key
  let providedToken = ''
  if (authHeader?.startsWith('Bearer ')) {
    providedToken = authHeader.substring(7)
  } else if (authHeader) {
    providedToken = authHeader
  } else if (apiKeyHeader) {
    providedToken = apiKeyHeader
  }

  providedToken = providedToken.trim()
  const expectedKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  
  if (!providedToken) {
    return NextResponse.json({ 
      error: 'Unauthorized',
      message: 'Missing authentication. Use Authorization header (Bearer) or x-api-key.',
    }, { status: 401 })
  }

  if (!expectedKey) {
    return NextResponse.json({
      error: 'Server configuration error',
      message: 'SUPABASE_SERVICE_ROLE_KEY is not configured on the server.',
    }, { status: 500 })
  }

  if (providedToken !== expectedKey) {
    return NextResponse.json({
      error: 'Unauthorized',
      message: 'Invalid API key.',
      received_token_length: providedToken.length,
      expected_token_length: expectedKey.length,
      received_start: providedToken.substring(0, 15) + '...',
      expected_start: expectedKey.substring(0, 15) + '...',
      debug_info: 'Comparison failed. Ensure your token in n8n exactly matches SUPABASE_SERVICE_ROLE_KEY in Vercel/Supabase.'
    }, { status: 401 })
  }

  // ── Date Logic: use ?date=YYYY-MM-DD or default to today ──
  const { searchParams } = new URL(request.url)
  const dateParam = searchParams.get('date')
  
  let today = new Date()
  if (dateParam) {
    const parsed = new Date(dateParam)
    if (!isNaN(parsed.getTime())) {
      today = parsed
    }
  }

  const todayStr = today.toISOString().split('T')[0]
  const todayStart = `${todayStr}T00:00:00+00:00`
  const todayEnd = `${todayStr}T23:59:59+00:00`
  const in7Days = new Date(today)
  in7Days.setDate(in7Days.getDate() + 7)
  const in7Str = in7Days.toISOString().split('T')[0]
  const in30Days = new Date(today)
  in30Days.setDate(in30Days.getDate() + 30)
  const in30Str = in30Days.toISOString().split('T')[0]

  try {
    const [
      { data: calendarEvents },
      { data: projects },
      { data: allProjectPayments },
      { data: allBuyerPayments },
      { data: allTransactions },
      { data: buyers },
      { data: partners },
      { data: partnerTx },
      { data: loans },
      { data: allLoanPayments },
    ] = await Promise.all([
      db.from('moshe_calendar_events').select('*')
        .gte('start_time', todayStart)
        .lte('start_time', todayEnd)
        .order('start_time'),
      db.from('moshe_projects').select('*').neq('status', 'closed'),
      db.from('moshe_project_payments').select('*'),
      db.from('moshe_buyer_payments').select('*, moshe_buyers!inner(name)'),
      db.from('moshe_transactions').select('*'),
      db.from('moshe_buyers').select('id, name, project_id'),
      db.from('moshe_partners').select('*'),
      db.from('moshe_partner_transactions').select('*'),
      db.from('moshe_loans').select('*'),
      db.from('moshe_loan_payments').select('*'),
    ])

    const proj = projects ?? []
    const pp = allProjectPayments ?? []
    const bp = allBuyerPayments ?? []
    const tx = allTransactions ?? []
    const ptx = partnerTx ?? []
    const lp = allLoanPayments ?? []

    const projectMap: Record<string, string> = {}
    proj.forEach((p: any) => { projectMap[p.id] = p.name })

    // Overdue payments
    const overdueExpenses = pp.filter((p: any) => !p.is_paid && p.due_date && p.due_date < todayStr)
    const overdueIncome = bp.filter((p: any) => !p.is_received && p.due_date && p.due_date < todayStr)
    const overdueLoanPayments = lp.filter((p: any) => !p.is_paid && p.due_date && p.due_date < todayStr)

    // Due today
    const todayExpenses = pp.filter((p: any) => !p.is_paid && p.due_date === todayStr)
    const todayIncome = bp.filter((p: any) => !p.is_received && p.due_date === todayStr)

    // Upcoming 7 days (not today, not overdue)
    const upcoming7Expenses = pp.filter((p: any) => !p.is_paid && p.due_date && p.due_date > todayStr && p.due_date <= in7Str)
    const upcoming7Income = bp.filter((p: any) => !p.is_received && p.due_date && p.due_date > todayStr && p.due_date <= in7Str)

    // Overall KPIs
    const totalPaid = pp.filter((p: any) => p.is_paid).reduce((s: number, p: any) => s + Number(p.amount), 0)
      + tx.filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + Number(t.amount), 0)
    const totalReceived = bp.filter((p: any) => p.is_received).reduce((s: number, p: any) => s + Number(p.amount), 0)
      + tx.filter((t: any) => t.type === 'income').reduce((s: number, t: any) => s + Number(t.amount), 0)
    const partnerInvested = ptx.filter((t: any) => t.type === 'investment').reduce((s: number, t: any) => s + Number(t.amount), 0)
    const partnerWithdrawn = ptx.filter((t: any) => t.type === 'withdrawal').reduce((s: number, t: any) => s + Number(t.amount), 0)
    const realBalance = (totalReceived + partnerInvested) - (totalPaid + partnerWithdrawn)

    // Today's transactions
    const todayTx = tx.filter((t: any) => t.date === todayStr)

    // Per-project insights
    const projectInsights = proj.map((p: any) => {
      const bRecv = bp.filter((x: any) => x.project_id === p.id && x.is_received).reduce((s: number, x: any) => s + Number(x.amount), 0)
      const bTotal = bp.filter((x: any) => x.project_id === p.id).reduce((s: number, x: any) => s + Number(x.amount), 0)
      const pPaid = pp.filter((x: any) => x.project_id === p.id && x.is_paid).reduce((s: number, x: any) => s + Number(x.amount), 0)
      const overdue = pp.filter((x: any) => x.project_id === p.id && !x.is_paid && x.due_date && x.due_date < todayStr)
        .reduce((s: number, x: any) => s + Number(x.amount), 0)
        + bp.filter((x: any) => x.project_id === p.id && !x.is_received && x.due_date && x.due_date < todayStr)
        .reduce((s: number, x: any) => s + Number(x.amount), 0)
      const collectionPct = bTotal > 0 ? Math.round((bRecv / bTotal) * 100) : 0

      return {
        name: p.name,
        status: p.status,
        address: p.address,
        total_cost: Number(p.total_project_cost),
        collection_pct: collectionPct,
        real_balance: bRecv - pPaid,
        overdue_amount: overdue,
        is_at_risk: overdue > (Number(p.total_project_cost) * 0.05) || (collectionPct < 30 && p.status === 'active'),
        stats: {
          received: bRecv,
          paid: pPaid,
          expected_total: bTotal,
        }
      }
    })

    // Sunday Weekly Breakdown
    const isSunday = today.getDay() === 0
    let weeklySummary: any = null
    if (isSunday) {
      weeklySummary = []
      for (let i = 0; i < 7; i++) {
        const d = new Date(today)
        d.setDate(d.getDate() + i)
        const dStr = d.toISOString().split('T')[0]
        const dayExpenses = pp.filter((p: any) => !p.is_paid && p.due_date === dStr)
        const dayIncome = bp.filter((p: any) => !p.is_received && p.due_date === dStr)
        if (dayExpenses.length > 0 || dayIncome.length > 0) {
          weeklySummary.push({
            date: dStr,
            day_name: d.toLocaleDateString('he-IL', { weekday: 'long' }),
            expenses: dayExpenses.map(x => ({ amount: Number(x.amount), project: projectMap[x.project_id], notes: x.notes })),
            income: dayIncome.map(x => ({ amount: Number(x.amount), buyer: x.moshe_buyers?.name, project: projectMap[x.project_id] }))
          })
        }
      }
    }

    // Loan summary
    const loanSummary = (loans ?? []).map((l: any) => {
      const payments = lp.filter((p: any) => p.loan_id === l.id)
      const paid = payments.filter((p: any) => p.is_paid).reduce((s: number, p: any) => s + Number(p.amount), 0)
      const remaining = payments.filter((p: any) => !p.is_paid).reduce((s: number, p: any) => s + Number(p.amount), 0)
      const paidCount = payments.filter((p: any) => p.is_paid).length
      const nextPayment = payments.filter((p: any) => !p.is_paid && p.due_date).sort((a: any, b: any) => a.due_date.localeCompare(b.due_date))[0]

      return {
        lender: l.lender,
        project: projectMap[l.project_id] ?? 'פרויקט',
        total_amount: Number(l.total_amount),
        paid,
        remaining,
        payments_completed: `${paidCount}/${l.num_payments}`,
        next_payment: nextPayment ? {
          amount: Number(nextPayment.amount),
          due_date: nextPayment.due_date,
          is_overdue: nextPayment.due_date < todayStr,
        } : null,
      }
    })

    // Partner summary
    const partnerSummary = (partners ?? []).map((p: any) => {
      const txs = ptx.filter((t: any) => t.partner_id === p.id)
      const invested = txs.filter((t: any) => t.type === 'investment').reduce((s: number, t: any) => s + Number(t.amount), 0)
      const withdrawn = txs.filter((t: any) => t.type === 'withdrawal').reduce((s: number, t: any) => s + Number(t.amount), 0)
      return {
        name: p.name,
        project: projectMap[p.project_id] ?? 'פרויקט',
        invested,
        withdrawn,
        balance: invested - withdrawn,
      }
    })

    const summary = {
      date: todayStr,
      greeting: getGreeting(),

      // Overall KPIs
      kpis: {
        real_balance: realBalance,
        total_received: totalReceived + partnerInvested,
        total_paid: totalPaid + partnerWithdrawn,
        active_projects: proj.length,
        partners_balance: partnerInvested - partnerWithdrawn,
      },

      // Calendar events today
      events: (calendarEvents ?? []).map((e: any) => ({
        title: e.title,
        type: e.type,
        time: new Date(e.start_time).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
        notes: e.notes,
      })),

      },

      // Weekly Breakdown (only on Sundays)
      weekly_overview: weeklySummary,

      // Payments due today
      today: {
        expenses_to_pay: todayExpenses.map((p: any) => ({
          project: projectMap[p.project_id] ?? 'פרויקט',
          amount: Number(p.amount),
          notes: p.notes,
        })),
        income_to_collect: todayIncome.map((p: any) => ({
          buyer: p.moshe_buyers?.name ?? 'קונה',
          project: projectMap[p.project_id] ?? 'פרויקט',
          amount: Number(p.amount),
        })),
        transactions: todayTx.map((t: any) => ({
          type: t.type,
          amount: Number(t.amount),
          category: t.category,
          notes: t.notes,
          project: projectMap[t.project_id] ?? 'פרויקט',
        })),
      },

      // Overdue
      overdue: {
        expenses: overdueExpenses.slice(0, 10).map((p: any) => ({
          project: projectMap[p.project_id] ?? 'פרויקט',
          amount: Number(p.amount),
          due_date: p.due_date,
          notes: p.notes,
        })),
        expenses_total: overdueExpenses.reduce((s: number, p: any) => s + Number(p.amount), 0),
        income: overdueIncome.slice(0, 10).map((p: any) => ({
          buyer: p.moshe_buyers?.name ?? 'קונה',
          amount: Number(p.amount),
          due_date: p.due_date,
        })),
        income_total: overdueIncome.reduce((s: number, p: any) => s + Number(p.amount), 0),
        loans: overdueLoanPayments.length,
        loans_total: overdueLoanPayments.reduce((s: number, p: any) => s + Number(p.amount), 0),
      },

      // Next 7 days
      next_7_days: {
        expenses_to_pay: upcoming7Expenses.reduce((s: number, p: any) => s + Number(p.amount), 0),
        income_to_collect: upcoming7Income.reduce((s: number, p: any) => s + Number(p.amount), 0),
      },

      // Project insights
      projects_at_risk: projectInsights.filter(p => p.is_at_risk),
      all_projects: projectInsights,

      // Loans & Partners
      loans: loanSummary,
      partners: partnerSummary,

      // Pre-formatted WhatsApp message
      whatsapp_message: formatMosheWhatsApp({
        todayStr, realBalance, overdueExpenses, overdueIncome, overdueLoanPayments,
        upcoming7Expenses, upcoming7Income, projectInsights, proj, calendarEvents: calendarEvents ?? [],
        todayExpenses, todayIncome,
      }),
    }

    return NextResponse.json(summary)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'בוקר טוב! ☀️'
  if (hour < 17) return 'צהריים טובים! 🌤️'
  if (hour < 21) return 'ערב טוב! 🌙'
  return 'לילה טוב! 🌃'
}

function formatMosheWhatsApp(data: any) {
  const fmt = (n: number) => '₪' + n.toLocaleString('he-IL', { maximumFractionDigits: 0 })
  const lines: string[] = []

  const isSunday = new Date(data.todayStr).getDay() === 0

  lines.push(`${isSunday ? '📅 *מבט שבועי — נדל"ן*' : '🏗️ *סיכום יומי — נדל"ן*'} | ${data.todayStr}`)
  lines.push('')
  lines.push(`💰 *מאזן פרויקטים:* ${fmt(data.realBalance)}`)
  lines.push(`📁 *${data.proj.length} פרויקטים פעילים*`)
  lines.push('')

  // Weekly Overview (If Sunday)
  if (isSunday && data.weeklySummary && data.weeklySummary.length > 0) {
    lines.push('🗓️ *לו"ז פיננסי לשבוע הקרוב:*')
    data.weeklySummary.forEach((day: any) => {
      const expTotal = day.expenses.reduce((s: number, e: any) => s + e.amount, 0)
      const incTotal = day.income.reduce((s: number, e: any) => s + e.amount, 0)
      lines.push(`  • *${day.day_name}* (${day.date.split('-').reverse().slice(0, 2).join('/')}):`)
      if (incTotal > 0) lines.push(`    ✅ לגבייה: ${fmt(incTotal)}`)
      if (expTotal > 0) lines.push(`    💸 לתשלום: ${fmt(expTotal)}`)
    })
    lines.push('')
  }

  // Calendar events
  if (data.calendarEvents.length > 0) {
    lines.push('📅 *אירועים היום:*')
    data.calendarEvents.forEach((e: any) => {
      const time = new Date(e.start_time).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
      lines.push(`  • ${time} — ${e.title}`)
    })
    lines.push('')
  }

  // Today's payments
  if (data.todayExpenses.length > 0 || data.todayIncome.length > 0) {
    lines.push('💳 *תשלומים להיום:*')
    data.todayExpenses.forEach((p: any) => {
      lines.push(`  💸 לתשלום: ${fmt(Number(p.amount))} — ${p.notes || 'הוצאה'}`)
    })
    data.todayIncome.forEach((p: any) => {
      lines.push(`  ✅ לגבייה: ${fmt(Number(p.amount))} — ${p.moshe_buyers?.name || 'קונה'}`)
    })
    lines.push('')
  }

  // Overdue
  const totalOverdue = data.overdueExpenses.length + data.overdueIncome.length + data.overdueLoanPayments.length
  if (totalOverdue > 0) {
    lines.push(`⚠️ *${totalOverdue} תשלומים באיחור!*`)
    if (data.overdueExpenses.length > 0) {
      const total = data.overdueExpenses.reduce((s: number, p: any) => s + Number(p.amount), 0)
      lines.push(`  🔴 ${data.overdueExpenses.length} הוצאות — ${fmt(total)}`)
    }
    if (data.overdueIncome.length > 0) {
      const total = data.overdueIncome.reduce((s: number, p: any) => s + Number(p.amount), 0)
      lines.push(`  🟡 ${data.overdueIncome.length} לגבייה — ${fmt(total)}`)
    }
    if (data.overdueLoanPayments.length > 0) {
      const total = data.overdueLoanPayments.reduce((s: number, p: any) => s + Number(p.amount), 0)
      lines.push(`  🏦 ${data.overdueLoanPayments.length} הלוואות — ${fmt(total)}`)
    }
    lines.push('')
  }

  // Next 7 days
  const next7In = data.upcoming7Income.reduce((s: number, p: any) => s + Number(p.amount), 0)
  const next7Ex = data.upcoming7Expenses.reduce((s: number, p: any) => s + Number(p.amount), 0)
  if (next7In + next7Ex > 0) {
    lines.push('📅 *7 ימים קרובים:*')
    if (next7In > 0) lines.push(`  ✅ לגבייה: ${fmt(next7In)}`)
    if (next7Ex > 0) lines.push(`  💸 לתשלום: ${fmt(next7Ex)}`)
    lines.push('')
  }

  // Projects at risk
  const atRisk = data.projectInsights.filter((p: any) => p.is_at_risk)
  if (atRisk.length > 0) {
    lines.push('🚨 *פרויקטים בסיכון:*')
    atRisk.forEach((p: any) => {
      lines.push(`  • ${p.name} — גבייה ${p.collection_pct}%${p.overdue_amount > 0 ? `, ${fmt(p.overdue_amount)} באיחור` : ''}`)
    })
  }

  return lines.join('\n')
}
