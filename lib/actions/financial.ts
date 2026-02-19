'use server'

import { supabase } from '@/lib/supabase'
import type { ClientSchema, ClientDataRecord, Payment } from '@/lib/supabase'
import { getClientSchemas } from '@/lib/actions/schema'
import { getRecords } from '@/lib/actions/data-records'

export interface FinancialItem {
    id: string
    type: 'income' | 'expense'
    amount: number
    date: string
    description: string
    source: 'manual' | 'table'
    source_table?: string
    source_record_id?: string
    status?: string
    payment_method?: string
    category?: string
    extra_data?: Record<string, any> // all other columns from the table row
}

export interface FinancialFilters {
    type?: 'income' | 'expense' | 'all'
    source_table?: string
    date_from?: string
    date_to?: string
    category?: string
    search?: string
    extra_filters?: Record<string, string> // column_name -> value
    include_sub_clients?: boolean
}

export interface FinancialSummary {
    total_income: number
    total_expenses: number
    net: number
    pending: number
    items: FinancialItem[]
    available_tables: { module_name: string; financial_type: 'income' | 'expense' }[]
    filterable_columns: { column_name: string; label: string; values: string[] }[]
}

export async function getFinancialData(
    clientId: string,
    filters?: FinancialFilters
): Promise<{ success: boolean; data?: FinancialSummary; error?: string }> {
    try {
        // 1. Get all schemas for this client
        const schemasResult = await getClientSchemas(clientId)
        if (!schemasResult.success || !schemasResult.schemas) {
            return { success: false, error: 'Failed to load schemas' }
        }

        const financialSchemas = schemasResult.schemas.filter(
            (s: ClientSchema) => s.financial_type && s.amount_column
        )

        // 2. Load records from each financial table
        const tableItems: FinancialItem[] = []
        const filterableColumnsMap: Record<string, Set<string>> = {}
        const filterableColumnsLabels: Record<string, string> = {}

        for (const schema of financialSchemas) {
            // Apply source_table filter
            if (filters?.source_table && schema.module_name !== filters.source_table) continue

            const recordsResult = await getRecords(clientId, schema.module_name)
            if (!recordsResult.success || !recordsResult.records) continue

            for (const record of recordsResult.records) {
                const amount = parseFloat(record.data?.[schema.amount_column!]) || 0
                const date = record.data?.[schema.date_column!] || record.entry_date || ''
                const description = record.data?.[schema.description_column!] || ''

                // Collect extra columns for filtering
                const extraData: Record<string, any> = {}
                for (const col of schema.columns) {
                    if (
                        col.name !== schema.amount_column &&
                        col.name !== schema.date_column &&
                        col.name !== schema.description_column
                    ) {
                        const val = record.data?.[col.name]
                        if (val !== undefined && val !== null && val !== '') {
                            extraData[col.name] = val

                            // Track filterable text columns
                            if (col.type === 'text') {
                                if (!filterableColumnsMap[col.name]) {
                                    filterableColumnsMap[col.name] = new Set()
                                    filterableColumnsLabels[col.name] = col.label || col.name
                                }
                                filterableColumnsMap[col.name].add(String(val))
                            }
                        }
                    }
                }

                // Apply extra filters
                if (filters?.extra_filters) {
                    let skip = false
                    for (const [colName, filterVal] of Object.entries(filters.extra_filters)) {
                        if (filterVal && extraData[colName] !== filterVal) {
                            skip = true
                            break
                        }
                    }
                    if (skip) continue
                }

                const item: FinancialItem = {
                    id: record.id,
                    type: schema.financial_type as 'income' | 'expense',
                    amount,
                    date,
                    description,
                    source: 'table',
                    source_table: schema.module_name,
                    source_record_id: record.id,
                    extra_data: extraData,
                }

                tableItems.push(item)
            }
        }

        // 3. Load manual payments
        let paymentsQuery = supabase
            .from('payments')
            .select('*')
            .eq('client_id', clientId)
            .order('payment_date', { ascending: false })

        const { data: payments, error: paymentsError } = await paymentsQuery
        if (paymentsError) throw paymentsError

        const manualItems: FinancialItem[] = (payments || []).map((p: Payment) => ({
            id: p.id,
            type: (p.payment_type === 'income' ? 'income' : 'expense') as 'income' | 'expense',
            amount: p.amount,
            date: p.payment_date,
            description: p.description || '',
            source: 'manual' as const,
            status: p.payment_status,
            payment_method: p.payment_method || undefined,
            category: p.category || undefined,
            source_table: p.linked_module || undefined,
            source_record_id: p.linked_record_id || undefined,
        }))

        // 4. Combine and filter
        let allItems = [...tableItems, ...manualItems]

        // Type filter
        if (filters?.type && filters.type !== 'all') {
            allItems = allItems.filter(i => i.type === filters.type)
        }

        // Date range filter
        if (filters?.date_from) {
            allItems = allItems.filter(i => i.date >= filters.date_from!)
        }
        if (filters?.date_to) {
            allItems = allItems.filter(i => i.date <= filters.date_to!)
        }

        // Category filter
        if (filters?.category) {
            allItems = allItems.filter(i => i.category === filters.category)
        }

        // Search filter
        if (filters?.search) {
            const s = filters.search.toLowerCase()
            allItems = allItems.filter(i =>
                i.description.toLowerCase().includes(s) ||
                (i.source_table || '').toLowerCase().includes(s) ||
                (i.category || '').toLowerCase().includes(s)
            )
        }

        // Sort by date descending
        allItems.sort((a, b) => (b.date || '').localeCompare(a.date || ''))

        // 5. Calculate totals
        const total_income = allItems.filter(i => i.type === 'income').reduce((s, i) => s + i.amount, 0)
        const total_expenses = allItems.filter(i => i.type === 'expense').reduce((s, i) => s + i.amount, 0)
        const pending = manualItems
            .filter(i => i.status === 'ממתין')
            .reduce((s, i) => s + i.amount, 0)

        // 6. Build available tables list
        const available_tables = financialSchemas.map((s: ClientSchema) => ({
            module_name: s.module_name,
            financial_type: s.financial_type as 'income' | 'expense',
        }))

        // 7. Build filterable columns
        const filterable_columns = Object.entries(filterableColumnsMap).map(([name, values]) => ({
            column_name: name,
            label: filterableColumnsLabels[name] || name,
            values: Array.from(values).sort(),
        }))

        return {
            success: true,
            data: {
                total_income,
                total_expenses,
                net: total_income - total_expenses,
                pending,
                items: allItems,
                available_tables,
                filterable_columns,
            },
        }
    } catch (error: any) {
        console.error('Error loading financial data:', error)
        return { success: false, error: error.message }
    }
}
