/**
 * Export utilities for data export functionality
 */

import { type SheetData } from '@/lib/google-sheets-client'
import { type Client, type Payment, type Reminder, type ClientCredential, type Note } from '@/lib/supabase'

/**
 * Exports sheet data to CSV format
 */
export function exportSheetDataToCSV(data: SheetData, clientName: string): void {
  // Get additional column names from first row if available
  const additionalHeaders = data.rows[0]?.additionalData ? Object.keys(data.rows[0].additionalData) : []
  const headers = ['תאריך', 'תיאור', 'הכנסה', 'הוצאה', 'קטגוריה', 'יתרה', ...additionalHeaders]
  
  const rows = data.rows.map(row => {
    const baseRow = [
      new Date(row.date).toLocaleDateString('he-IL'),
      row.description || '',
      row.income.toString(),
      row.expense.toString(),
      row.category || '',
      row.balance?.toString() || ''
    ]
    // Add additional columns
    if (row.additionalData) {
      additionalHeaders.forEach(key => {
        const value = row.additionalData![key]
        baseRow.push(typeof value === 'number' ? value.toString() : (value || ''))
      })
    }
    return baseRow
  })
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')
  
  downloadFile(csvContent, `נפחים-${clientName}-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv')
}

/**
 * Exports payments to CSV format
 */
export function exportPaymentsToCSV(payments: Payment[], clientName: string): void {
  const headers = ['תאריך', 'סכום', 'סטטוס', 'אמצעי תשלום', 'תיאור']
  
  const rows = payments.map(payment => [
    new Date(payment.payment_date).toLocaleDateString('he-IL'),
    payment.amount.toString(),
    payment.payment_status || '',
    payment.payment_method || '',
    payment.description || ''
  ])
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')
  
  downloadFile(csvContent, `תשלומים-${clientName}-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv')
}

/**
 * Exports reminders to CSV format
 */
export function exportRemindersToCSV(reminders: Reminder[], clientName: string): void {
  const headers = ['כותרת', 'תיאור', 'תאריך יעד', 'עדיפות', 'סוג', 'הושלם']
  
  const rows = reminders.map(reminder => [
    reminder.title || '',
    reminder.description || '',
    reminder.due_date ? new Date(reminder.due_date).toLocaleDateString('he-IL') : '',
    reminder.priority || '',
    reminder.reminder_type || '',
    reminder.is_completed ? 'כן' : 'לא'
  ])
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')
  
  downloadFile(csvContent, `תזכורות-${clientName}-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv')
}

/**
 * Exports all client data to a combined CSV
 */
export function exportClientDataToCSV(
  client: Client,
  sheetData: SheetData | null,
  payments: Payment[],
  reminders: Reminder[],
  credentials: ClientCredential[],
  notes: Note[]
): void {
  const sections: string[] = []
  
  // Client Info
  sections.push('=== פרטי לקוח ===')
  sections.push('שם,ערך')
  sections.push(`שם לקוח,"${client.name}"`)
  if (client.email) sections.push(`אימייל,"${client.email}"`)
  if (client.phone) sections.push(`טלפון,"${client.phone}"`)
  sections.push(`סטטוס,"${client.status || 'פעיל'}"`)
  sections.push('')
  
  // Sheet Data
  if (sheetData && sheetData.rows.length > 0) {
    sections.push('=== נתוני גיליון ===')
    sections.push('תאריך,תיאור,הכנסה,הוצאה,קטגוריה,יתרה')
    sheetData.rows.forEach(row => {
      sections.push([
        new Date(row.date).toLocaleDateString('he-IL'),
        row.description || '',
        row.income.toString(),
        row.expense.toString(),
        row.category || '',
        row.balance?.toString() || ''
      ].map(cell => `"${cell}"`).join(','))
    })
    sections.push('')
  }
  
  // Payments
  if (payments.length > 0) {
    sections.push('=== תשלומים ===')
    sections.push('תאריך,סכום,סטטוס,אמצעי תשלום,תיאור')
    payments.forEach(payment => {
      sections.push([
        new Date(payment.payment_date).toLocaleDateString('he-IL'),
        payment.amount.toString(),
        payment.payment_status || '',
        payment.payment_method || '',
        payment.description || ''
      ].map(cell => `"${cell}"`).join(','))
    })
    sections.push('')
  }
  
  // Reminders
  if (reminders.length > 0) {
    sections.push('=== תזכורות ===')
    sections.push('כותרת,תיאור,תאריך יעד,עדיפות,סוג,הושלם')
    reminders.forEach(reminder => {
      sections.push([
        reminder.title || '',
        reminder.description || '',
        reminder.due_date ? new Date(reminder.due_date).toLocaleDateString('he-IL') : '',
        reminder.priority || '',
        reminder.reminder_type || '',
        reminder.is_completed ? 'כן' : 'לא'
      ].map(cell => `"${cell}"`).join(','))
    })
    sections.push('')
  }
  
  // Notes
  if (notes.length > 0) {
    sections.push('=== פתקים ===')
    sections.push('תאריך,תוכן')
    notes.forEach(note => {
      sections.push([
        new Date(note.created_at).toLocaleDateString('he-IL'),
        note.content || ''
      ].map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
    })
  }
  
  const csvContent = sections.join('\n')
  downloadFile(csvContent, `לקוח-${client.name}-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv')
}

/**
 * Helper function to trigger file download
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob(['\uFEFF' + content], { type: `${mimeType};charset=utf-8;` }) // BOM for UTF-8
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

