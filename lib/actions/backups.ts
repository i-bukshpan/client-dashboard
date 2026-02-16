'use server'

import { supabase } from '@/lib/supabase'
import type { Backup, Client, Payment, Reminder, Note, ClientCredential, ClientSchema, ClientDataRecord } from '@/lib/supabase'
import { logAction } from '@/lib/audit-log'

/**
 * Server Action: Get all backups
 */
export async function getBackups(): Promise<{ success: boolean; backups?: Backup[]; error?: string }> {
  try {
    const { data: backups, error } = await supabase
      .from('backups')
      .select('*')
      .order('backup_date', { ascending: false })

    if (error) {
      console.error('Error fetching backups:', error)
      return { success: false, error: error.message }
    }

    return { success: true, backups: backups as Backup[] }
  } catch (error: any) {
    console.error('Unexpected error fetching backups:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Server Action: Create a backup record
 */
export async function createBackup(
  backup: Omit<Backup, 'id' | 'created_at' | 'backup_date'>
): Promise<{ success: boolean; backup?: Backup; error?: string }> {
  try {
    const { data: newBackup, error } = await supabase
      .from('backups')
      .insert(backup)
      .select()
      .single()

    if (error) {
      console.error('Error creating backup:', error)
      return { success: false, error: error.message }
    }

    await logAction(
      'backup.created',
      'backup',
      newBackup.id,
      `Created ${backup.backup_type} backup`,
      { backupType: backup.backup_type }
    )

    return { success: true, backup: newBackup as Backup }
  } catch (error: any) {
    console.error('Unexpected error creating backup:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Server Action: Export all data to JSON
 */
export async function exportAllData(): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    // Fetch all data from all tables
    const [clients, payments, reminders, notes, credentials, schemas, records] = await Promise.all([
      supabase.from('clients').select('*'),
      supabase.from('payments').select('*'),
      supabase.from('reminders').select('*'),
      supabase.from('notes').select('*'),
      supabase.from('client_credentials').select('*'),
      supabase.from('client_schemas').select('*'),
      supabase.from('client_data_records').select('*'),
    ])

    const exportData = {
      export_date: new Date().toISOString(),
      version: '1.0',
      clients: clients.data || [],
      payments: payments.data || [],
      reminders: reminders.data || [],
      notes: notes.data || [],
      credentials: credentials.data || [],
      schemas: schemas.data || [],
      records: records.data || [],
    }

    await logAction('data.exported', 'system', 'all', 'Exported all data')

    return { success: true, data: exportData }
  } catch (error: any) {
    console.error('Unexpected error exporting data:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Server Action: Import data from JSON
 */
export async function importData(
  data: any
): Promise<{ success: boolean; imported?: Record<string, number>; error?: string }> {
  try {
    const imported: Record<string, number> = {}

    // Import clients
    if (data.clients && Array.isArray(data.clients)) {
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .upsert(data.clients, { onConflict: 'id' })
        .select()
      
      if (!clientsError) {
        imported.clients = clientsData?.length || 0
      }
    }

    // Import payments
    if (data.payments && Array.isArray(data.payments)) {
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .upsert(data.payments, { onConflict: 'id' })
        .select()
      
      if (!paymentsError) {
        imported.payments = paymentsData?.length || 0
      }
    }

    // Import reminders
    if (data.reminders && Array.isArray(data.reminders)) {
      const { data: remindersData, error: remindersError } = await supabase
        .from('reminders')
        .upsert(data.reminders, { onConflict: 'id' })
        .select()
      
      if (!remindersError) {
        imported.reminders = remindersData?.length || 0
      }
    }

    // Import notes
    if (data.notes && Array.isArray(data.notes)) {
      const { data: notesData, error: notesError } = await supabase
        .from('notes')
        .upsert(data.notes, { onConflict: 'id' })
        .select()
      
      if (!notesError) {
        imported.notes = notesData?.length || 0
      }
    }

    // Import schemas
    if (data.schemas && Array.isArray(data.schemas)) {
      const { data: schemasData, error: schemasError } = await supabase
        .from('client_schemas')
        .upsert(data.schemas, { onConflict: 'id' })
        .select()
      
      if (!schemasError) {
        imported.schemas = schemasData?.length || 0
      }
    }

    // Import records
    if (data.records && Array.isArray(data.records)) {
      const { data: recordsData, error: recordsError } = await supabase
        .from('client_data_records')
        .upsert(data.records, { onConflict: 'id' })
        .select()
      
      if (!recordsError) {
        imported.records = recordsData?.length || 0
      }
    }

    await logAction(
      'data.imported',
      'system',
      'all',
      'Imported data',
      { imported }
    )

    return { success: true, imported }
  } catch (error: any) {
    console.error('Unexpected error importing data:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

