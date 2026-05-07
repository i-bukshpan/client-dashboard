import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * GET /api/admin/daily-summary
 * 
 * סיכום יומי עבור היועץ הראשי (Admin Portal)
 * כולל: הכנסות/הוצאות, פגישות, משימות, לקוחות, יעדים
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
  const tomorrowStr = new Date(today.getTime() + 86400000).toISOString().split('T')[0]

  // Month range
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]

  // Previous month
  const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split('T')[0]
  const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split('T')[0]

  try {
    const [
      // Current month finances
      { data: monthlyIncome },
      { data: monthlyExpenses },
      // Previous month finances
      { data: prevIncome },
      { data: prevExpenses },
      // Today's appointments
      { data: allAppointments },
      // Tasks
      { data: allTasks },
      // Clients
      { data: allClients },
      // Goals
      { data: allGoals },
      // Recurring finances
      { data: recurringFinances },
      // Today's income & expenses
      { data: todayIncome },
      { data: todayExpenses },
    ] = await Promise.all([
      db.from('income').select('amount, date, category, client_id, notes')
        .gte('date', startOfMonth).lte('date', endOfMonth),
      db.from('expenses').select('amount, date, category, notes')
        .gte('date', startOfMonth).lte('date', endOfMonth),
      db.from('income').select('amount')
        .gte('date', prevMonthStart).lte('date', prevMonthEnd),
      db.from('expenses').select('amount')
        .gte('date', prevMonthStart).lte('date', prevMonthEnd),
      db.from('appointments').select('*, clients(name)')
        .gte('start_time', todayStart)
        .lte('start_time', todayEnd)
        .order('start_time'),
      db.from('tasks').select('*, clients(name)')
        .neq('status', 'done')
        .is('archived', false),
      db.from('clients').select('id, name, status, phone, email'),
      db.from('goals').select('*').eq('is_completed', false),
      db.from('recurring_finances').select('*').eq('active', true),
      db.from('income').select('amount, category, notes, client_id')
        .eq('date', todayStr),
      db.from('expenses').select('amount, category, notes')
        .eq('date', todayStr),
    ])

    // Financials
    const incomeTotal = (monthlyIncome ?? []).reduce((s: number, r: any) => s + Number(r.amount), 0)
    const expensesTotal = (monthlyExpenses ?? []).reduce((s: number, r: any) => s + Number(r.amount), 0)
    const profit = incomeTotal - expensesTotal

    const prevIncomeTotal = (prevIncome ?? []).reduce((s: number, r: any) => s + Number(r.amount), 0)
    const prevExpensesTotal = (prevExpenses ?? []).reduce((s: number, r: any) => s + Number(r.amount), 0)
    const prevProfit = prevIncomeTotal - prevExpensesTotal

    // Tasks analysis
    const tasks = allTasks ?? []
    const urgentTasks = tasks.filter((t: any) => t.priority === 'urgent')
    const overdueTasks = tasks.filter((t: any) => t.due_date && t.due_date < todayStr)
    const dueTodayTasks = tasks.filter((t: any) => t.due_date === todayStr)

    // Clients
    const activeClients = (allClients ?? []).filter((c: any) => c.status === 'active')

    // Goals
    const goals = (allGoals ?? []).map((g: any) => ({
      title: g.title,
      progress: g.target_amount > 0 ? Math.round((Number(g.current_amount) / Number(g.target_amount)) * 100) : 0,
      target: Number(g.target_amount),
      current: Number(g.current_amount),
      due_date: g.due_date,
    }))

    // Income by category
    const incomeByCategory: Record<string, number> = {}
    ;(monthlyIncome ?? []).forEach((r: any) => {
      const cat = r.category || 'אחר'
      incomeByCategory[cat] = (incomeByCategory[cat] || 0) + Number(r.amount)
    })

    // Expenses by category
    const expensesByCategory: Record<string, number> = {}
    ;(monthlyExpenses ?? []).forEach((r: any) => {
      const cat = r.category || 'אחר'
      expensesByCategory[cat] = (expensesByCategory[cat] || 0) + Number(r.amount)
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
        const dayAppointments = (allAppointments ?? []).filter((a: any) => a.start_time.startsWith(dStr))
        const dayTasks = tasks.filter((t: any) => t.due_date === dStr)
        if (dayAppointments.length > 0 || dayTasks.length > 0) {
          weeklySummary.push({
            date: dStr,
            day_name: d.toLocaleDateString('he-IL', { weekday: 'long' }),
            appointments: dayAppointments.map(a => ({ time: new Date(a.start_time).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }), client: a.clients?.name })),
            tasks_count: dayTasks.length
          })
        }
      }
    }

    const summary = {
      date: todayStr,
      greeting: getGreeting(),

      // Financial KPIs
      financials: {
        monthly_income: incomeTotal,
        monthly_expenses: expensesTotal,
        monthly_profit: profit,
        prev_month_income: prevIncomeTotal,
        prev_month_expenses: prevExpensesTotal,
        prev_month_profit: prevProfit,
        income_change_pct: prevIncomeTotal > 0 ? Math.round(((incomeTotal - prevIncomeTotal) / prevIncomeTotal) * 100) : 0,
        profit_change_pct: prevProfit !== 0 ? Math.round(((profit - prevProfit) / Math.abs(prevProfit)) * 100) : 0,
        income_by_category: incomeByCategory,
        expenses_by_category: expensesByCategory,
        recurring_income: recurringIncome,
        recurring_expenses: recurringExpense,
      },

      // Today's activity
      today: {
        income: (todayIncome ?? []).map((r: any) => ({
          amount: Number(r.amount),
          category: r.category,
          notes: r.notes,
        })),
        income_total: (todayIncome ?? []).reduce((s: number, r: any) => s + Number(r.amount), 0),
        expenses: (todayExpenses ?? []).map((r: any) => ({
          amount: Number(r.amount),
          category: r.category,
          notes: r.notes,
        })),
        expenses_total: (todayExpenses ?? []).reduce((s: number, r: any) => s + Number(r.amount), 0),
      },


      // Weekly Overview (only on Sundays)
      weekly_overview: weeklySummary,

      // Appointments
      appointments: (allAppointments ?? []).map((a: any) => ({
        client: a.clients?.name ?? 'לא ידוע',
        phone: a.clients?.phone,
        email: a.clients?.email,
        time: new Date(a.start_time).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
        end_time: a.end_time ? new Date(a.end_time).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : null,
        status: a.status,
        notes: a.notes,
      })),

      // Tasks
      tasks: {
        total_open: tasks.length,
        urgent: urgentTasks.length,
        overdue: overdueTasks.length,
        due_today: dueTodayTasks.length,
        urgent_list: urgentTasks.slice(0, 10).map((t: any) => ({
          title: t.title,
          client: t.clients?.name,
          due_date: t.due_date,
          status: t.status,
        })),
        overdue_list: overdueTasks.slice(0, 10).map((t: any) => ({
          title: t.title,
          client: t.clients?.name,
          due_date: t.due_date,
        })),
        due_today_list: dueTodayTasks.map((t: any) => ({
          title: t.title,
          client: t.clients?.name,
          priority: t.priority,
        })),
      },

      // Clients
      clients: {
        total_active: activeClients.length,
      },

      // Goals
      goals,

      // Pre-formatted WhatsApp message
      whatsapp_message: formatAdminWhatsApp({
        todayStr, incomeTotal, expensesTotal, profit,
        allAppointments: allAppointments ?? [],
        urgentTasks, overdueTasks, dueTodayTasks,
        todayIncome: todayIncome ?? [],
        todayExpenses: todayExpenses,
        activeClients: activeClients,
        goals: goals,
        weeklySummary: weeklySummary
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

function formatAdminWhatsApp(data: any) {
  const fmt = (n: number) => '₪' + n.toLocaleString('he-IL', { maximumFractionDigits: 0 })
  const lines: string[] = []

  const isSunday = new Date(data.todayStr).getDay() === 0

  lines.push(`${isSunday ? '📅 *מבט שבועי — ייעוץ*' : '📊 *סיכום יומי — ייעוץ*'} | ${data.todayStr}`)
  lines.push('')

  // Financial snapshot
  lines.push(`📈 *הכנסות החודש:* ${fmt(data.incomeTotal)}`)
  lines.push(`📉 *הוצאות החודש:* ${fmt(data.expensesTotal)}`)
  lines.push(`💰 *רווח נקי:* ${fmt(data.profit)}`)
  lines.push('')

  // Weekly Overview (If Sunday)
  if (isSunday && data.weeklySummary && data.weeklySummary.length > 0) {
    lines.push('🗓️ *פגישות ומשימות לשבוע הקרוב:*')
    data.weeklySummary.forEach((day: any) => {
      lines.push(`  • *${day.day_name}* (${day.date.split('-').reverse().slice(0, 2).join('/')}):`)
      if (day.appointments.length > 0) lines.push(`    📅 ${day.appointments.length} פגישות`)
      if (day.tasks_count > 0) lines.push(`    📋 ${day.tasks_count} משימות`)
    })
    lines.push('')
  }

  // Today's financial activity
  const todayIn = data.todayIncome.reduce((s: number, r: any) => s + Number(r.amount), 0)
  const todayEx = data.todayExpenses.reduce((s: number, r: any) => s + Number(r.amount), 0)
  if (todayIn > 0 || todayEx > 0) {
    lines.push('💳 *פעילות כספית היום:*')
    if (todayIn > 0) lines.push(`  ✅ הכנסות: ${fmt(todayIn)} (${data.todayIncome.length} רשומות)`)
    if (todayEx > 0) lines.push(`  💸 הוצאות: ${fmt(todayEx)} (${data.todayExpenses.length} רשומות)`)
    lines.push('')
  }

  // Appointments
  if (data.allAppointments.length > 0) {
    lines.push(`📅 *${data.allAppointments.length} פגישות היום:*`)
    data.allAppointments.forEach((a: any) => {
      const time = new Date(a.start_time).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
      lines.push(`  • ${time} — ${a.clients?.name || 'לקוח'}${a.notes ? ` (${a.notes})` : ''}`)
    })
    lines.push('')
  }

  // Tasks
  const taskAlerts = []
  if (data.urgentTasks.length > 0) taskAlerts.push(`🔴 ${data.urgentTasks.length} דחופות`)
  if (data.overdueTasks.length > 0) taskAlerts.push(`⚠️ ${data.overdueTasks.length} באיחור`)
  if (data.dueTodayTasks.length > 0) taskAlerts.push(`📌 ${data.dueTodayTasks.length} להיום`)

  if (taskAlerts.length > 0) {
    lines.push(`📋 *משימות:* ${taskAlerts.join(' | ')}`)
    if (data.urgentTasks.length > 0) {
      data.urgentTasks.slice(0, 3).forEach((t: any) => {
        lines.push(`  🔴 ${t.title}${t.clients?.name ? ` (${t.clients.name})` : ''}`)
      })
    }
    lines.push('')
  }

  // Goals progress
  if (data.goals.length > 0) {
    const topGoals = data.goals.sort((a: any, b: any) => b.progress - a.progress).slice(0, 3)
    lines.push('🎯 *יעדים:*')
    topGoals.forEach((g: any) => {
      const bar = g.progress >= 75 ? '🟢' : g.progress >= 40 ? '🟡' : '🔴'
      lines.push(`  ${bar} ${g.title} — ${g.progress}%`)
    })
    lines.push('')
  }

  lines.push(`👥 *${data.activeClients.length} לקוחות פעילים*`)

  return lines.join('\n')
}
