'use server'

import { supabase, type Client } from '@/lib/supabase'
import { formatDateForCSV } from '@/lib/utils/date-utils'

export interface ExportOptions {
  clientIds?: string[]
  includeColumns: string[]
  format: 'csv' | 'json'
  includePayments?: boolean
  includeReminders?: boolean
  includeTags?: boolean
}

/**
 * Export clients with advanced options
 */
export async function exportClientsAdvanced(options: ExportOptions): Promise<{ success: boolean; data?: string; error?: string }> {
  try {
    let query = supabase.from('clients').select('*')

    if (options.clientIds && options.clientIds.length > 0) {
      query = query.in('id', options.clientIds)
    }

    const { data: clients, error } = await query.order('created_at', { ascending: false })

    if (error) {
      return { success: false, error: error.message }
    }

    if (!clients) {
      return { success: false, error: 'No clients found' }
    }

    // Get tags for clients if requested
    let clientTagsMap: Record<string, string[]> = {}
    if (options.includeTags) {
      const { data: tagAssignments } = await supabase
        .from('client_tag_assignments')
        .select('client_id, client_tags(name)')

      if (tagAssignments) {
        tagAssignments.forEach((assignment: any) => {
          if (!clientTagsMap[assignment.client_id]) {
            clientTagsMap[assignment.client_id] = []
          }
          if (assignment.client_tags) {
            clientTagsMap[assignment.client_id].push(assignment.client_tags.name)
          }
        })
      }
    }

    // Create header mapping based on selected columns
    const headerMap: Record<string, string> = {}
    const headers: string[] = []

    options.includeColumns.forEach(column => {
      switch (column) {
        case 'id':
          headerMap['id'] = 'ID'
          headers.push('ID')
          break
        case 'name':
          headerMap['name'] = 'שם'
          headers.push('שם')
          break
        case 'email':
          headerMap['email'] = 'אימייל'
          headers.push('אימייל')
          break
        case 'phone':
          headerMap['phone'] = 'טלפון'
          headers.push('טלפון')
          break
        case 'status':
          headerMap['status'] = 'סטטוס'
          headers.push('סטטוס')
          break
        case 'created_at':
          headerMap['created_at'] = 'תאריך יצירה'
          headers.push('תאריך יצירה')
          break
        case 'updated_at':
          headerMap['updated_at'] = 'תאריך עדכון'
          headers.push('תאריך עדכון')
          break
      }
    })

    if (options.includeTags) {
      headers.push('תגיות')
    }

    // Format data based on selected columns
    const formattedClients = clients.map(client => {
      const clientData: any = {}

      options.includeColumns.forEach(column => {
        switch (column) {
          case 'id':
            clientData['ID'] = client.id || ''
            break
          case 'name':
            clientData['שם'] = client.name || ''
            break
          case 'email':
            clientData['אימייל'] = client.email || ''
            break
          case 'phone':
            clientData['טלפון'] = client.phone || ''
            break
          case 'status':
            clientData['סטטוס'] = client.status || ''
            break
          case 'created_at':
            clientData['תאריך יצירה'] = formatDateForCSV(client.created_at)
            break
          case 'updated_at':
            clientData['תאריך עדכון'] = formatDateForCSV(client.updated_at)
            break
        }
      })

      if (options.includeTags) {
        clientData['תגיות'] = (clientTagsMap[client.id] || []).join(', ')
      }

      return clientData
    })

    if (options.format === 'csv') {
      if (formattedClients.length === 0) {
        return { success: false, error: 'No data to export' }
      }

      // Create CSV rows with consistent column order
      const rows = formattedClients.map(clientData =>
        headers.map(header => {
          const value = clientData[header] ?? ''
          // Escape quotes and wrap in quotes if contains comma, quotes, or newlines
          const stringValue = String(value)
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`
          }
          return stringValue
        }).join(',')
      )

      const csvContent = [
        headers.join(','),
        ...rows
      ].join('\n')

      // Add UTF-8 BOM for Excel compatibility with Hebrew text
      const csvWithBOM = '\uFEFF' + csvContent

      return { success: true, data: csvWithBOM }
    } else {
      return { success: true, data: JSON.stringify(formattedClients, null, 2) }
    }
  } catch (error: any) {
    console.error('Error exporting clients:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

