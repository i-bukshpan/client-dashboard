/**
 * Export utilities for reminders
 */

import { type Reminder } from '@/lib/supabase'

/**
 * Exports reminders to CSV format
 */
export function exportRemindersToCSV(reminders: Reminder[], clientName: string): void {
  const headers = ['כותרת', 'תיאור', 'תאריך יעד', 'עדיפות', 'סוג תזכורת', 'הושלם']
  
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
    ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
  ].join('\n')
  
  downloadFile(csvContent, `תזכורות-${clientName}-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv')
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

