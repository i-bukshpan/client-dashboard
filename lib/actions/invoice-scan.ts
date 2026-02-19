'use server'


import type { ColumnDefinition } from '@/lib/supabase'
import { upsertSchema, getSchema } from '@/lib/actions/schema'
import { addRecord } from '@/lib/actions/data-records'

// Default column definitions for the invoices module
const INVOICES_COLUMNS: ColumnDefinition[] = [
    { name: 'invoice_number', type: 'text', label: 'מס׳ חשבונית' },
    { name: 'vendor_name', type: 'text', label: 'ספק' },
    { name: 'amount', type: 'currency', label: 'סכום' },
    { name: 'payment_date', type: 'date', label: 'תאריך' },
    { name: 'payment_method', type: 'text', label: 'אמצעי תשלום' },
    { name: 'payment_type', type: 'text', label: 'סוג תשלום' },
    { name: 'category', type: 'text', label: 'קטגוריה' },
    { name: 'description', type: 'text', label: 'תיאור' },
    { name: 'status', type: 'text', label: 'סטטוס' },
]

const INVOICES_MODULE_NAME = 'חשבוניות'

/**
 * Ensure the invoices module exists for a client in a specific branch.
 * If it doesn't exist, create it with the default column schema.
 */
export async function ensureInvoicesModule(
    clientId: string,
    branchName?: string | null
): Promise<{ success: boolean; error?: string }> {
    try {
        // Check if schema already exists
        const existing = await getSchema(clientId, INVOICES_MODULE_NAME, branchName)
        if (existing.success && existing.schema) {
            return { success: true }
        }

        // Create the schema
        const result = await upsertSchema(clientId, INVOICES_MODULE_NAME, INVOICES_COLUMNS, branchName)
        return result
    } catch (error: any) {
        console.error('Error ensuring invoices module:', error)
        return { success: false, error: error.message }
    }
}

/**
 * Add a scanned invoice record to the invoices module.
 * Auto-creates the module if it doesn't exist.
 */
export async function addScannedInvoice(
    clientId: string,
    invoiceData: {
        amount?: number | null
        payment_date?: string | null
        payment_method?: string | null
        description?: string | null
        payment_type?: string | null
        category?: string | null
        vendor_name?: string | null
        invoice_number?: string | null
    },
    branchName?: string | null
): Promise<{ success: boolean; error?: string }> {
    try {
        // Ensure invoices module exists
        const ensureResult = await ensureInvoicesModule(clientId, branchName)
        if (!ensureResult.success) {
            return { success: false, error: ensureResult.error || 'Failed to create invoices module' }
        }

        // Map payment_type to Hebrew
        const paymentTypeMap: Record<string, string> = {
            income: 'הכנסה',
            expense: 'הוצאה',
            subscription: 'מנוי',
            salary: 'משכורת',
            rent: 'שכר דירה',
            utility: 'שירותים',
            other: 'אחר',
        }

        // Construct the data record
        const recordData: Record<string, any> = {
            invoice_number: invoiceData.invoice_number || '',
            vendor_name: invoiceData.vendor_name || '',
            amount: invoiceData.amount || 0,
            payment_date: invoiceData.payment_date || new Date().toISOString().split('T')[0],
            payment_method: invoiceData.payment_method || '',
            payment_type: invoiceData.payment_type
                ? (paymentTypeMap[invoiceData.payment_type] || invoiceData.payment_type)
                : '',
            category: invoiceData.category || '',
            description: invoiceData.description || '',
            status: 'חדש',
        }

        // Add the record
        const result = await addRecord(clientId, INVOICES_MODULE_NAME, recordData)
        return result
    } catch (error: any) {
        console.error('Error adding scanned invoice:', error)
        return { success: false, error: error.message }
    }
}
