'use server'

import { supabase } from '@/lib/supabase'
import type { Client, Payment, Reminder, ClientSchema } from '@/lib/supabase'
import type { ClientTag } from '@/lib/actions/tags'

// ── Types ──────────────────────────────────────────────────────────────

export interface ClientWithData extends Client {
    currentBalance: number
    monthlyIncome: number
    monthlyExpense: number
    tags: ClientTag[]
    pendingPaymentsCount: number
    openRemindersCount: number
    unreadMessagesCount: number
    childCount: number
    monthlyTrends?: {
        income: Array<{ month: string; value: number }>
        expense: Array<{ month: string; value: number }>
    }
}

export interface DashboardAlerts {
    pendingPayments: Array<Payment & { client: Client }>
    upcomingReminders: Array<Reminder & { client: Client | null }>
}

export interface DashboardData {
    clients: ClientWithData[]
    alerts: DashboardAlerts & {
        recentMeetings: any[]
    }
    availableTags: ClientTag[]
}

// ── Helpers ────────────────────────────────────────────────────────────

function getLast3Months(now: Date) {
    const months: Array<{ start: Date; end: Date; label: string }> = []
    for (let i = 2; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
        months.push({
            start: new Date(monthDate.getFullYear(), monthDate.getMonth(), 1),
            end: new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59),
            label: `${monthDate.getMonth() + 1}/${monthDate.getFullYear()}`,
        })
    }
    return months
}

// ── Main optimized loader ──────────────────────────────────────────────

/**
 * Loads ALL dashboard data in a single server action, using parallel queries
 * and batch operations instead of N+1 patterns.
 *
 * Previous approach: 6+ sequential queries + N queries per client for financial
 *   schemas + N queries per client for tags ≈ O(2N + 6) DB calls
 * New approach: 8 parallel queries total ≈ O(8) DB calls regardless of client count
 */
export async function loadDashboardData(): Promise<{
    success: boolean
    data?: DashboardData
    error?: string
}> {
    try {
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()
        const last3Months = getLast3Months(now)

        // ── Step 1: Run ALL queries in parallel ──────────────────────────
        const [
            clientsResult,
            allPaymentsResult,
            allRemindersResult,
            allUnreadResult,
            childCountsResult,
            financialSchemasResult,
            allFinancialRecordsResult,
            tagAssignmentsResult,
            allTagsResult,
            pendingPaymentsResult,
            upcomingRemindersResult,
            recentMeetingsResult,
        ] = await Promise.all([
            // 1. All parent clients
            supabase
                .from('clients')
                .select('*')
                .is('parent_id', null)
                .order('created_at', { ascending: false }),

            // 2. ALL payments (single query, no per-client loop)
            supabase
                .from('payments')
                .select('client_id, amount, payment_status, payment_date, payment_type'),

            // 3. ALL open reminders count
            supabase
                .from('reminders')
                .select('client_id')
                .eq('is_completed', false),

            // 4. ALL unread messages count
            supabase
                .from('messages')
                .select('client_id')
                .eq('is_read', false)
                .eq('sender_role', 'client'),

            // 5. ALL child client counts
            supabase
                .from('clients')
                .select('parent_id')
                .not('parent_id', 'is', null),

            // 6. ALL financial schemas (single query instead of N per client)
            supabase
                .from('client_schemas')
                .select('*')
                .not('financial_type', 'is', null)
                .not('amount_column', 'is', null),

            // 7. ALL financial records for schemas with financial_type
            // (batch query instead of per-client per-schema loop)
            supabase
                .from('client_data_records')
                .select('client_id, module_type, data, entry_date'),

            // 8. ALL tag assignments with tag details (single query)
            supabase
                .from('client_tag_assignments')
                .select('client_id, tag_id, client_tags(*)'),

            // 9. All available tags
            supabase
                .from('client_tags')
                .select('*')
                .order('name'),

            // 10. Pending payments for alerts
            supabase
                .from('payments')
                .select('*, clients(*)')
                .eq('payment_status', 'ממתין')
                .order('payment_date', { ascending: true })
                .limit(10),

            // 11. Upcoming reminders for alerts
            (() => {
                const nextWeek = new Date()
                nextWeek.setDate(nextWeek.getDate() + 7)
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                return supabase
                    .from('reminders')
                    .select('*, clients(*)')
                    .eq('is_completed', false)
                    .lte('due_date', nextWeek.toISOString())
                    .gte('due_date', today.toISOString())
                    .order('due_date', { ascending: true })
                    .limit(10)
            })(),

            // 12. Recent meeting logs
            supabase
                .from('meeting_logs')
                .select('*, clients(*)')
                .order('meeting_date', { ascending: false })
                .limit(5),
        ])

        if (clientsResult.error) throw clientsResult.error

        const clients = clientsResult.data || []
        if (clients.length === 0) {
            return {
                success: true,
                data: {
                    clients: [],
                    alerts: { pendingPayments: [], upcomingReminders: [], recentMeetings: [] },
                    availableTags: (allTagsResult.data || []) as ClientTag[],
                },
            }
        }

        // ── Step 2: Build lookup maps (pure computation, no DB calls) ────

        // 2a. Payment stats per client
        const allPayments = allPaymentsResult.data || []
        const paymentsByClient: Record<string, {
            balance: number
            monthlyIncome: number
            monthlyExpense: number
            pendingCount: number
            trends: {
                income: Array<{ month: string; value: number }>
                expense: Array<{ month: string; value: number }>
            }
        }> = {}

        for (const p of allPayments) {
            if (!paymentsByClient[p.client_id]) {
                paymentsByClient[p.client_id] = {
                    balance: 0,
                    monthlyIncome: 0,
                    monthlyExpense: 0,
                    pendingCount: 0,
                    trends: {
                        income: last3Months.map(m => ({ month: m.label, value: 0 })),
                        expense: last3Months.map(m => ({ month: m.label, value: 0 })),
                    },
                }
            }
            const stats = paymentsByClient[p.client_id]
            if (p.payment_status === 'שולם') {
                const isIncome = !p.payment_type || p.payment_type === 'income'
                const isExpense = p.payment_type === 'expense' || p.payment_type === 'rent' || p.payment_type === 'utility' || p.payment_type === 'salary'
                if (isIncome) stats.balance += p.amount
                if (isExpense) stats.balance -= p.amount

                if (p.payment_date >= startOfMonth && p.payment_date <= endOfMonth) {
                    if (isIncome) stats.monthlyIncome += p.amount
                    if (isExpense) stats.monthlyExpense += p.amount
                }

                const paymentDate = new Date(p.payment_date)
                last3Months.forEach((month, idx) => {
                    if (paymentDate >= month.start && paymentDate <= month.end) {
                        if (isIncome) stats.trends.income[idx].value += p.amount
                        if (isExpense) stats.trends.expense[idx].value += p.amount
                    }
                })
            }
            if (p.payment_status === 'ממתין') {
                stats.pendingCount++
            }
        }

        // 2b. Financial schema data (batch aggregation instead of N+1)
        const financialSchemas = financialSchemasResult.data || []
        const allFinancialRecords = allFinancialRecordsResult.data || []

        if (financialSchemas.length > 0) {
            // Build a lookup: clientId+moduleType -> schema
            const schemaLookup = new Map<string, typeof financialSchemas[0]>()
            for (const schema of financialSchemas) {
                schemaLookup.set(`${schema.client_id}::${schema.module_name}`, schema)
            }

            // Process ALL records in a single pass
            for (const record of allFinancialRecords) {
                const schema = schemaLookup.get(`${record.client_id}::${record.module_type}`)
                if (!schema) continue

                const amount = parseFloat(record.data?.[schema.amount_column!]) || 0
                if (amount === 0) continue

                const dateStr = record.data?.[schema.date_column!] || record.entry_date || ''
                const isIncome = schema.financial_type === 'income'

                if (!paymentsByClient[record.client_id]) {
                    paymentsByClient[record.client_id] = {
                        balance: 0, monthlyIncome: 0, monthlyExpense: 0, pendingCount: 0,
                        trends: {
                            income: last3Months.map(m => ({ month: m.label, value: 0 })),
                            expense: last3Months.map(m => ({ month: m.label, value: 0 })),
                        },
                    }
                }
                const stats = paymentsByClient[record.client_id]

                if (isIncome) stats.balance += amount
                else stats.balance -= amount

                if (dateStr >= startOfMonth && dateStr <= endOfMonth) {
                    if (isIncome) stats.monthlyIncome += amount
                    else stats.monthlyExpense += amount
                }

                const recordDate = new Date(dateStr)
                if (!isNaN(recordDate.getTime())) {
                    last3Months.forEach((month, idx) => {
                        if (recordDate >= month.start && recordDate <= month.end) {
                            if (isIncome) stats.trends.income[idx].value += amount
                            else stats.trends.expense[idx].value += amount
                        }
                    })
                }
            }
        }

        // 2c. Reminders count per client
        const remindersByClient: Record<string, number> = {}
        for (const r of (allRemindersResult.data || [])) {
            if (r.client_id) {
                remindersByClient[r.client_id] = (remindersByClient[r.client_id] || 0) + 1
            }
        }

        // 2d. Unread messages count per client
        const unreadByClient: Record<string, number> = {}
        for (const m of (allUnreadResult.data || [])) {
            if (m.client_id) {
                unreadByClient[m.client_id] = (unreadByClient[m.client_id] || 0) + 1
            }
        }

        // 2e. Child count per client
        const childCountMap: Record<string, number> = {}
        for (const c of (childCountsResult.data || [])) {
            if (c.parent_id) {
                childCountMap[c.parent_id] = (childCountMap[c.parent_id] || 0) + 1
            }
        }

        // 2f. Tags per client (single query result, no per-client calls)
        const tagsByClient: Record<string, ClientTag[]> = {}
        for (const assignment of (tagAssignmentsResult.data || [])) {
            const clientId = (assignment as any).client_id
            const tag = (assignment as any).client_tags
            if (clientId && tag) {
                if (!tagsByClient[clientId]) tagsByClient[clientId] = []
                tagsByClient[clientId].push(tag as ClientTag)
            }
        }

        // ── Step 3: Assemble final client objects ────────────────────────
        const clientsWithData: ClientWithData[] = clients.map((client) => {
            const stats = paymentsByClient[client.id]
            return {
                ...client,
                currentBalance: stats?.balance || 0,
                monthlyIncome: stats?.monthlyIncome || 0,
                monthlyExpense: stats?.monthlyExpense || 0,
                pendingPaymentsCount: stats?.pendingCount || 0,
                openRemindersCount: remindersByClient[client.id] || 0,
                unreadMessagesCount: unreadByClient[client.id] || 0,
                childCount: childCountMap[client.id] || 0,
                monthlyTrends: stats?.trends,
                tags: tagsByClient[client.id] || [],
            }
        })

        // ── Step 4: Assemble alerts ──────────────────────────────────────
        const alerts: DashboardAlerts & { recentMeetings: any[] } = {
            pendingPayments: (pendingPaymentsResult.data || []) as Array<Payment & { client: Client }>,
            upcomingReminders: (upcomingRemindersResult.data || []) as Array<Reminder & { client: Client | null }>,
            recentMeetings: recentMeetingsResult.data || [],
        }

        return {
            success: true,
            data: {
                clients: clientsWithData,
                alerts,
                availableTags: (allTagsResult.data || []) as ClientTag[],
            },
        }
    } catch (error: any) {
        console.error('Error loading dashboard data:', error)
        return { success: false, error: error.message || 'Unknown error' }
    }
}

/**
 * Lightweight refresh: only reload client list with counts
 * (used after realtime message events)
 */
export async function refreshClientCounts(): Promise<{
    success: boolean
    counts?: Record<string, { unread: number; pending: number; reminders: number }>
    error?: string
}> {
    try {
        const [unreadResult, pendingResult, remindersResult] = await Promise.all([
            supabase
                .from('messages')
                .select('client_id')
                .eq('is_read', false)
                .eq('sender_role', 'client'),
            supabase
                .from('payments')
                .select('client_id')
                .eq('payment_status', 'ממתין'),
            supabase
                .from('reminders')
                .select('client_id')
                .eq('is_completed', false),
        ])

        const counts: Record<string, { unread: number; pending: number; reminders: number }> = {}

        for (const m of (unreadResult.data || [])) {
            if (!m.client_id) continue
            if (!counts[m.client_id]) counts[m.client_id] = { unread: 0, pending: 0, reminders: 0 }
            counts[m.client_id].unread++
        }
        for (const p of (pendingResult.data || [])) {
            if (!p.client_id) continue
            if (!counts[p.client_id]) counts[p.client_id] = { unread: 0, pending: 0, reminders: 0 }
            counts[p.client_id].pending++
        }
        for (const r of (remindersResult.data || [])) {
            if (!r.client_id) continue
            if (!counts[r.client_id]) counts[r.client_id] = { unread: 0, pending: 0, reminders: 0 }
            counts[r.client_id].reminders++
        }

        return { success: true, counts }
    } catch (error: any) {
        console.error('Error refreshing counts:', error)
        return { success: false, error: error.message }
    }
}
/**
 * Generates a personalized AI briefing for the dashboard based on real data.
 */
import { google } from '@ai-sdk/google'
import { generateText } from 'ai'

export async function getDashboardBriefing(data: DashboardData) {
    try {
        const meetingsCount = data.alerts.recentMeetings.filter((m: any) => 
            new Date(m.meeting_date).toDateString() === new Date().toDateString()
        ).length || 0
        
        const tasksCount = data.alerts.upcomingReminders.filter((t: any) => 
            new Date(t.due_date).toDateString() === new Date().toDateString() && !t.is_completed
        ).length || 0

        const overdueCount = data.alerts.upcomingReminders.filter((t: any) => 
            new Date(t.due_date) < new Date() && !t.is_completed
        ).length || 0

        const prompt = `
אתה העוזר האישי של נחמיה, יועץ פיננסי בכיר.
הנתונים להיום:
- פגישות מתוכננות להיום: ${meetingsCount}
- משימות לביצוע היום: ${tasksCount}
- משימות בעיכוב (Overdue): ${overdueCount}

משימה:
כתוב משפט פתיחה בוקר קצר, אנרגטי ומקצועי (2-3 משפטים).
אל תמציא שמות של לקוחות או אירועים.
אם הכל אפס, עודד אותו למצוא הזדמנויות חדשות.
ענה בעברית.
`

        const { text } = await generateText({
            model: google('models/gemini-1.5-flash'),
            prompt,
        })

        return { success: true, text }
    } catch (error: any) {
        console.error('Error generating dashboard briefing:', error)
        return { success: false, error: error.message }
    }
}
