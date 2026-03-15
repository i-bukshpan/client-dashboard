'use server'

import { supabase } from '@/lib/supabase'

export async function getClientHealthIndex(clientId: string) {
  try {
    // 1. Fetch relevant data
    const { data: openTasks } = await supabase.from('reminders').select('id, priority').eq('client_id', clientId).eq('is_completed', false)
    const { data: overdueTasks } = await supabase.from('reminders').select('id').eq('client_id', clientId).eq('is_completed', false).lt('due_date', new Date().toISOString())
    const { data: recentPayments } = await supabase.from('payments').select('payment_status').eq('client_id', clientId).limit(10)

    // 2. Simple Scoring Algorithm
    let score = 100
    
    // Penalize for open tasks
    if (openTasks) {
      score -= openTasks.length * 2
      // Penalize more for urgent tasks
      const urgentCount = openTasks.filter(t => t.priority === 'דחוף').length
      score -= urgentCount * 5
    }

    // Penalize for overdue tasks
    if (overdueTasks) {
      score -= overdueTasks.length * 10
    }

    // Penalize for missed payments
    if (recentPayments) {
      const missedCount = recentPayments.filter(p => p.payment_status === 'ממתין' || p.payment_status === 'בוטל').length
      score -= missedCount * 15
    }

    // Ensure score is between 0 and 100
    const finalScore = Math.max(0, Math.min(100, score))

    let status = 'מעולה'
    let color = 'emerald'
    
    if (finalScore < 40) {
      status = 'בסיכון גבוה'
      color = 'rose'
    } else if (finalScore < 70) {
      status = 'דורש תשומת לב'
      color = 'amber'
    } else if (finalScore < 90) {
      status = 'טוב'
      color = 'blue'
    }

    return { 
      success: true, 
      score: finalScore, 
      status, 
      color,
      details: {
        openTasks: openTasks?.length || 0,
        overdueTasks: overdueTasks?.length || 0,
        unpaidPayments: recentPayments?.filter(p => p.payment_status === 'ממתין').length || 0
      }
    }
  } catch (error: any) {
    console.error('Error calculating health index:', error)
    return { success: false, error: error.message }
  }
}
