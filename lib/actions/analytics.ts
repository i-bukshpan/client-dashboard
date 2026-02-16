'use server'

import { supabase } from '@/lib/supabase'
import type { Client, Payment, ClientDataRecord } from '@/lib/supabase'

/**
 * Server Action: Get financial summary for all clients
 */
export async function getFinancialSummary(
  startDate?: string,
  endDate?: string
): Promise<{ success: boolean; summary?: any; error?: string }> {
  try {
    let paymentsQuery = supabase
      .from('payments')
      .select('*')
      .eq('payment_status', 'שולם')

    if (startDate) {
      paymentsQuery = paymentsQuery.gte('payment_date', startDate)
    }
    if (endDate) {
      paymentsQuery = paymentsQuery.lte('payment_date', endDate)
    }

    const { data: payments, error: paymentsError } = await paymentsQuery

    if (paymentsError) {
      return { success: false, error: paymentsError.message }
    }

    const totalRevenue = payments?.reduce((sum, p) => sum + p.amount, 0) || 0
    const paymentCount = payments?.length || 0
    const averagePayment = paymentCount > 0 ? totalRevenue / paymentCount : 0

    // Get pending payments
    let pendingQuery = supabase
      .from('payments')
      .select('*')
      .eq('payment_status', 'ממתין')

    if (startDate) {
      pendingQuery = pendingQuery.gte('payment_date', startDate)
    }
    if (endDate) {
      pendingQuery = pendingQuery.lte('payment_date', endDate)
    }

    const { data: pendingPayments, error: pendingError } = await pendingQuery
    const totalPending = pendingPayments?.reduce((sum, p) => sum + p.amount, 0) || 0

    return {
      success: true,
      summary: {
        totalRevenue,
        paymentCount,
        averagePayment,
        totalPending,
        pendingCount: pendingPayments?.length || 0,
      },
    }
  } catch (error: any) {
    console.error('Unexpected error getting financial summary:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Server Action: Get client analytics (most profitable, active, etc.)
 */
export async function getClientAnalytics(): Promise<{ success: boolean; analytics?: any; error?: string }> {
  try {
    // Get all clients
    const { data: clients, error: clientsError } = await supabase.from('clients').select('*')

    if (clientsError) {
      return { success: false, error: clientsError.message }
    }

    // Get all payments
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('*')
      .eq('payment_status', 'שולם')

    if (paymentsError) {
      return { success: false, error: paymentsError.message }
    }

    // Calculate revenue per client
    const clientRevenue = new Map<string, number>()
    const clientPaymentCount = new Map<string, number>()

    payments?.forEach((payment) => {
      const current = clientRevenue.get(payment.client_id) || 0
      clientRevenue.set(payment.client_id, current + payment.amount)
      clientPaymentCount.set(payment.client_id, (clientPaymentCount.get(payment.client_id) || 0) + 1)
    })

    // Build analytics data
    const clientAnalytics = clients?.map((client) => {
      const revenue = clientRevenue.get(client.id) || 0
      const paymentCount = clientPaymentCount.get(client.id) || 0

      return {
        client,
        revenue,
        paymentCount,
        averagePayment: paymentCount > 0 ? revenue / paymentCount : 0,
        isActive: client.status === 'פעיל',
      }
    }) || []

    // Sort by revenue
    clientAnalytics.sort((a, b) => b.revenue - a.revenue)

    const topClients = clientAnalytics.slice(0, 10)
    const activeClients = clientAnalytics.filter((c) => c.isActive).length
    const totalClients = clients?.length || 0

    return {
      success: true,
      analytics: {
        totalClients,
        activeClients,
        topClients,
        clientAnalytics,
      },
    }
  } catch (error: any) {
    console.error('Unexpected error getting client analytics:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Server Action: Get revenue trends (monthly, quarterly, yearly)
 */
export async function getRevenueTrends(
  period: 'month' | 'quarter' | 'year' = 'month'
): Promise<{ success: boolean; trends?: any; error?: string }> {
  try {
    const { data: payments, error } = await supabase
      .from('payments')
      .select('*')
      .eq('payment_status', 'שולם')
      .order('payment_date', { ascending: true })

    if (error) {
      return { success: false, error: error.message }
    }

    const trends: Record<string, number> = {}

    payments?.forEach((payment) => {
      const date = new Date(payment.payment_date)
      let key: string

      if (period === 'month') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      } else if (period === 'quarter') {
        const quarter = Math.floor(date.getMonth() / 3) + 1
        key = `${date.getFullYear()}-Q${quarter}`
      } else {
        key = String(date.getFullYear())
      }

      trends[key] = (trends[key] || 0) + payment.amount
    })

    const trendData = Object.entries(trends)
      .map(([period, revenue]) => ({ period, revenue }))
      .sort((a, b) => a.period.localeCompare(b.period))

    return { success: true, trends: trendData }
  } catch (error: any) {
    console.error('Unexpected error getting revenue trends:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

