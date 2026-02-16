'use server'

import { supabase } from '@/lib/supabase'
import type { Payment } from '@/lib/supabase'
import { logAction } from '@/lib/audit-log'

/**
 * Server Action: Generate next recurring payment
 */
export async function generateNextRecurringPayment(
  paymentId: string
): Promise<{ success: boolean; newPayment?: Payment; error?: string }> {
  try {
    // Get the original payment
    const { data: originalPayment, error: fetchError } = await supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single()

    if (fetchError || !originalPayment) {
      return { success: false, error: fetchError?.message || 'Payment not found' }
    }

    if (!originalPayment.is_recurring || !originalPayment.next_payment_date) {
      return { success: false, error: 'Payment is not recurring or has no next payment date' }
    }

    // Calculate next payment date based on frequency
    const nextDate = calculateNextPaymentDate(
      originalPayment.next_payment_date,
      originalPayment.frequency || 'monthly'
    )

    // Create new payment
    const { data: newPayment, error: createError } = await supabase
      .from('payments')
      .insert({
        client_id: originalPayment.client_id,
        amount: originalPayment.amount,
        payment_date: originalPayment.next_payment_date,
        payment_status: 'ממתין',
        payment_method: originalPayment.payment_method,
        description: originalPayment.description,
        is_recurring: originalPayment.is_recurring,
        payment_type: originalPayment.payment_type,
        frequency: originalPayment.frequency,
        next_payment_date: nextDate,
        notes: originalPayment.notes,
        category: originalPayment.category,
        auto_generate_next: originalPayment.auto_generate_next,
      })
      .select()
      .single()

    if (createError) {
      return { success: false, error: createError.message }
    }

    // Update original payment's next_payment_date if auto_generate_next is true
    if (originalPayment.auto_generate_next && nextDate) {
      await supabase
        .from('payments')
        .update({ next_payment_date: nextDate })
        .eq('id', paymentId)
    }

    await logAction(
      'payment.recurring_generated',
      'payment',
      newPayment.id,
      `Generated next recurring payment for payment ${paymentId}`,
      { originalPaymentId: paymentId, nextPaymentDate: nextDate }
    )

    return { success: true, newPayment: newPayment as Payment }
  } catch (error: any) {
    console.error('Unexpected error generating recurring payment:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Calculate next payment date based on frequency
 */
function calculateNextPaymentDate(currentDate: string, frequency: string): string | null {
  const date = new Date(currentDate)
  
  switch (frequency) {
    case 'daily':
      date.setDate(date.getDate() + 1)
      break
    case 'weekly':
      date.setDate(date.getDate() + 7)
      break
    case 'monthly':
      date.setMonth(date.getMonth() + 1)
      break
    case 'quarterly':
      date.setMonth(date.getMonth() + 3)
      break
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1)
      break
    default:
      return null
  }
  
  return date.toISOString().split('T')[0]
}

/**
 * Server Action: Get all recurring payments for a client
 */
export async function getRecurringPayments(
  clientId: string
): Promise<{ success: boolean; payments?: Payment[]; error?: string }> {
  try {
    const { data: payments, error } = await supabase
      .from('payments')
      .select('*')
      .eq('client_id', clientId)
      .eq('is_recurring', true)
      .order('next_payment_date', { ascending: true })

    if (error) {
      console.error('Error fetching recurring payments:', error)
      return { success: false, error: error.message }
    }

    return { success: true, payments: payments as Payment[] }
  } catch (error: any) {
    console.error('Unexpected error fetching recurring payments:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Server Action: Get upcoming payments (next 30 days)
 */
export async function getUpcomingPayments(
  clientId?: string
): Promise<{ success: boolean; payments?: Payment[]; error?: string }> {
  try {
    const today = new Date()
    const nextMonth = new Date()
    nextMonth.setDate(nextMonth.getDate() + 30)

    let query = supabase
      .from('payments')
      .select('*')
      .gte('next_payment_date', today.toISOString().split('T')[0])
      .lte('next_payment_date', nextMonth.toISOString().split('T')[0])
      .eq('payment_status', 'ממתין')
      .order('next_payment_date', { ascending: true })

    if (clientId) {
      query = query.eq('client_id', clientId)
    }

    const { data: payments, error } = await query

    if (error) {
      console.error('Error fetching upcoming payments:', error)
      return { success: false, error: error.message }
    }

    return { success: true, payments: payments as Payment[] }
  } catch (error: any) {
    console.error('Unexpected error fetching upcoming payments:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

