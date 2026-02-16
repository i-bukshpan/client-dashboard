'use server'

import { supabase } from '@/lib/supabase'

/**
 * Parse CSV content with proper handling of quoted fields
 * Handles: quoted fields, escaped quotes (""), commas inside quotes
 */
function parseCSV(csvText: string): string[][] {
  const rows: string[][] = []
  const lines = csvText.split(/\r?\n/)
  
  for (const line of lines) {
    if (!line.trim() && line.indexOf(',') === -1) continue // Skip completely empty lines
    
    const row: string[] = []
    let currentField = ''
    let insideQuotes = false
    
    for (let i = 0; i <= line.length; i++) {
      const char = i < line.length ? line[i] : null
      const nextChar = i + 1 < line.length ? line[i + 1] : null
      
      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          // Escaped quote (double quote) - add single quote to field
          currentField += '"'
          i++ // Skip next quote
        } else {
          // Toggle quote state
          insideQuotes = !insideQuotes
        }
        continue
      }
      
      if ((char === ',' || char === null) && !insideQuotes) {
        // End of field (comma or end of line)
        row.push(currentField)
        currentField = ''
        if (char === null) break // End of line
        continue
      }
      
      if (char !== null) {
        // Add character to current field
        currentField += char
      }
    }
    
    rows.push(row)
  }
  
  return rows
}

/**
 * Import clients from CSV file
 */
export async function importClientsFromCSV(csvText: string): Promise<{ success: boolean; imported?: number; error?: string }> {
  try {
    // Remove BOM if present
    if (csvText.charCodeAt(0) === 0xFEFF) {
      csvText = csvText.slice(1)
    }

    const rows = parseCSV(csvText.trim())
    
    if (rows.length === 0) {
      return { success: false, error: 'קובץ CSV ריק' }
    }

    const clientsToImport: Array<{
      name: string
      email?: string | null
      phone?: string | null
      status?: string | null
      internal_notes?: string | null
    }> = []

    // Skip header row (first row)
    const dataRows = rows.slice(1)

    for (const row of dataRows) {
      if (row.length === 0) continue

      // CSV structure based on headers:
      // Column 0: שם סניף
      // Column 1: כתובת
      // Column 2: שם משכיר
      // Column 3: טלפון משכיר
      // Column 4: מנהל סניף
      // Column 5: מספר סניף
      // Column 6: מייל
      // Column 7: פרטי חשבון בנק
      // Column 8: סכום
      // Column 9: אי פי
      // Column 10: הערות
      
      const branchName = (row[0] || '').trim()
      const landlordName = (row[2] || '').trim()
      const phone = (row[3] || '').trim()
      const email = (row[6] || '').trim()
      const bankDetails = (row[7] || '').trim()
      const notes = (row[10] || '').trim()
      
      // Build name - use branch name or landlord name, prefer landlord name if available
      let name = ''
      if (landlordName) {
        name = branchName && branchName.length > 0 ? `${branchName} - ${landlordName}`.trim() : landlordName
      } else {
        name = branchName
      }
      
      if (!name || name.length === 0) continue // Skip empty names

      // Combine bank details and notes
      const internalNotes = [bankDetails, notes].filter(Boolean).join('\n').trim()

      clientsToImport.push({
        name,
        email: email || null,
        phone: phone || null,
        status: 'פעיל',
        internal_notes: internalNotes || null,
      })
    }

    if (clientsToImport.length === 0) {
      return { success: false, error: 'לא נמצאו לקוחות לייבוא' }
    }

    // Import clients
    const { data, error } = await supabase
      .from('clients')
      .insert(clientsToImport)
      .select()

    if (error) {
      console.error('Error importing clients:', error)
      return { success: false, error: error.message }
    }

    return { success: true, imported: data?.length || 0 }
  } catch (error: any) {
    console.error('Error parsing CSV:', error)
    return { success: false, error: error.message || 'שגיאה בפרסור קובץ CSV' }
  }
}