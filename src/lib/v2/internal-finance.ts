import 'server-only'

import { randomUUID } from 'crypto'
import { createSpreadsheet, appendRows, clearRange, getSheetRows, updateRange, formatRange, type SheetTemplate } from '@/lib/google-sheets'
import { createWorkspaceFolder, moveWorkspaceFile } from '@/lib/google-drive'
import { getWorkspaceAdminDb, requireWorkspaceAdmin } from '@/lib/v2/workspace-dal'
import {
  INTERNAL_FINANCE_TABS,
  type AgencyWorkspaceSettings,
  type InternalFinanceDashboardData,
  type InternalFinanceMutation,
  type InternalFinanceMutationTab,
} from '@/types/internal-finance'

const TEMPLATES: Record<InternalFinanceMutationTab | 'monthlySummary', SheetTemplate> = {
  income: { title: INTERNAL_FINANCE_TABS.income, headers: ['מזהה', 'תאריך', 'לקוח', 'תיאור', 'סכום לפני מע״מ', 'מע״מ', 'סכום כולל', 'אמצעי תשלום', 'סטטוס', 'אסמכתא'] },
  expenses: { title: INTERNAL_FINANCE_TABS.expenses, headers: ['מזהה', 'תאריך', 'ספק', 'קטגוריה', 'תיאור', 'סכום לפני מע״מ', 'מע״מ', 'סכום כולל', 'אמצעי תשלום', 'מוכר למס', 'אסמכתא'] },
  retainers: { title: INTERNAL_FINANCE_TABS.retainers, headers: ['מזהה', 'לקוח', 'סכום חודשי', 'תאריך התחלה', 'תאריך חיוב הבא', 'סטטוס', 'חשבונית אחרונה', 'הערות'] },
  invoices: { title: INTERNAL_FINANCE_TABS.invoices, headers: ['מזהה', 'מספר חשבונית', 'לקוח', 'תאריך הפקה', 'תאריך פירעון', 'סכום כולל', 'סטטוס', 'קישור למסמך', 'הערות'] },
  monthlySummary: { title: INTERNAL_FINANCE_TABS.monthlySummary, headers: ['חודש', 'הכנסות', 'הוצאות', 'רווח', 'שיעור רווח'] },
}

function parseMoney(value: unknown): number {
  const normalized = String(value ?? '').replace(/,/g, '').replace(/[^0-9.-]/g, '')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function monthKey(value: string): string | null {
  const iso = /^(\d{4})-(\d{2})/.exec(value)
  if (iso) return `${iso[1]}-${iso[2]}`
  const local = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})/.exec(value)
  if (local) return `${local[3]}-${local[2].padStart(2, '0')}`
  return null
}

export async function getAgencyWorkspaceSettings(): Promise<AgencyWorkspaceSettings | null> {
  await requireWorkspaceAdmin()
  const { data, error } = await getWorkspaceAdminDb()
    .from('v2_agency_workspace')
    .select('workbook_id, drive_folder_id, updated_at')
    .eq('singleton_key', true)
    .maybeSingle()
  if (error) throw new Error(`[internal-finance] Settings query failed: ${error.message}`)
  if (!data) return null
  return { workbookId: data.workbook_id as string, driveFolderId: data.drive_folder_id as string, updatedAt: data.updated_at as string }
}

export async function setupInternalAgencyWorkspace(): Promise<AgencyWorkspaceSettings> {
  const session = await requireWorkspaceAdmin()
  const existing = await getAgencyWorkspaceSettings()
  if (existing) return existing

  const folderId = await createWorkspaceFolder('Nehemiah OS — Internal Agency', process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID)
  const workbookId = await createSpreadsheet('Internal Agency — Nehemiah OS', Object.values(TEMPLATES))
  await moveWorkspaceFile(workbookId, folderId)

  const { data, error } = await getWorkspaceAdminDb()
    .from('v2_agency_workspace')
    .upsert({ singleton_key: true, workbook_id: workbookId, drive_folder_id: folderId, created_by: session.user.id, updated_at: new Date().toISOString() }, { onConflict: 'singleton_key' })
    .select('workbook_id, drive_folder_id, updated_at')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'שמירת הגדרות הסוכנות נכשלה')
  return { workbookId: data.workbook_id as string, driveFolderId: data.drive_folder_id as string, updatedAt: data.updated_at as string }
}

async function readAll(settings: AgencyWorkspaceSettings) {
  const [income, expenses, retainers, invoices, monthlySummary] = await Promise.all([
    getSheetRows(settings.workbookId, INTERNAL_FINANCE_TABS.income),
    getSheetRows(settings.workbookId, INTERNAL_FINANCE_TABS.expenses),
    getSheetRows(settings.workbookId, INTERNAL_FINANCE_TABS.retainers),
    getSheetRows(settings.workbookId, INTERNAL_FINANCE_TABS.invoices),
    getSheetRows(settings.workbookId, INTERNAL_FINANCE_TABS.monthlySummary),
  ])
  return { income, expenses, retainers, invoices, monthlySummary }
}

export async function getInternalFinanceDashboard(): Promise<InternalFinanceDashboardData> {
  const settings = await getAgencyWorkspaceSettings()
  if (!settings) return { configured: false, settings: null, totals: { income: 0, expenses: 0, profit: 0, openInvoices: 0, activeRetainers: 0 }, recentIncome: [], recentExpenses: [], retainers: [], invoices: [], monthlySummary: [] }
  const data = await readAll(settings)
  const income = data.income.reduce((sum, row) => sum + parseMoney(row['סכום כולל']), 0)
  const expenses = data.expenses.reduce((sum, row) => sum + parseMoney(row['סכום כולל']), 0)
  const openInvoices = data.invoices.filter((row) => !['שולם', 'בוטלה', 'מבוטלת'].includes(row['סטטוס'])).reduce((sum, row) => sum + parseMoney(row['סכום כולל']), 0)
  const activeRetainers = data.retainers.filter((row) => ['פעיל', 'active'].includes(row['סטטוס']?.toLowerCase())).length
  return {
    configured: true,
    settings,
    totals: { income, expenses, profit: income - expenses, openInvoices, activeRetainers },
    recentIncome: data.income.slice(-8).reverse(),
    recentExpenses: data.expenses.slice(-8).reverse(),
    retainers: data.retainers.slice(-10).reverse(),
    invoices: data.invoices.slice(-10).reverse(),
    monthlySummary: data.monthlySummary.slice(-12).reverse(),
  }
}

async function refreshMonthlySummary(workbookId: string): Promise<void> {
  const [income, expenses] = await Promise.all([
    getSheetRows(workbookId, INTERNAL_FINANCE_TABS.income),
    getSheetRows(workbookId, INTERNAL_FINANCE_TABS.expenses),
  ])
  const months = new Map<string, { income: number; expenses: number }>()
  for (const row of income) {
    const key = monthKey(row['תאריך'])
    if (key) months.set(key, { income: (months.get(key)?.income ?? 0) + parseMoney(row['סכום כולל']), expenses: months.get(key)?.expenses ?? 0 })
  }
  for (const row of expenses) {
    const key = monthKey(row['תאריך'])
    if (key) months.set(key, { income: months.get(key)?.income ?? 0, expenses: (months.get(key)?.expenses ?? 0) + parseMoney(row['סכום כולל']) })
  }
  const rows = [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, totals]) => {
    const profit = totals.income - totals.expenses
    const margin = totals.income ? profit / totals.income : 0
    return [month, totals.income.toFixed(2), totals.expenses.toFixed(2), profit.toFixed(2), margin.toFixed(4)]
  })
  await clearRange(workbookId, formatRange(INTERNAL_FINANCE_TABS.monthlySummary, 'A2:E1000'))
  if (rows.length) await updateRange(workbookId, formatRange(INTERNAL_FINANCE_TABS.monthlySummary, 'A2'), rows)
}

export async function applyInternalFinanceMutation(mutation: InternalFinanceMutation): Promise<void> {
  await requireWorkspaceAdmin()
  const settings = await getAgencyWorkspaceSettings()
  if (!settings) throw new Error('יש להקים תחילה את גיליון הסוכנות הפנימי')
  const template = TEMPLATES[mutation.tab]
  const existing = await getSheetRows(settings.workbookId, template.title)
  if (mutation.operation === 'append') {
    if (existing.some((row) => row['מזהה'] === mutation.id)) throw new Error('הפעולה כבר בוצעה ולא תירשם שוב')
    const values = template.headers.map((header) => header === 'מזהה' ? mutation.id : mutation.values[header] ?? '')
    await appendRows(settings.workbookId, template.title, [values])
  } else {
    const rowIndex = existing.findIndex((row) => row['מזהה'] === mutation.targetId)
    if (rowIndex < 0) throw new Error('הרשומה המיועדת לעדכון לא נמצאה')
    const current = existing[rowIndex]
    const values = template.headers.map((header) => mutation.values[header] ?? current[header] ?? '')
    await updateRange(settings.workbookId, formatRange(template.title, `A${rowIndex + 2}`), [values])
  }
  if (mutation.tab === 'income' || mutation.tab === 'expenses') await refreshMonthlySummary(settings.workbookId)
}

export function newInternalFinanceMutationId(): string {
  return `ifm_${randomUUID()}`
}

export async function getInternalFinanceAgentContext(): Promise<Record<string, unknown>> {
  const dashboard = await getInternalFinanceDashboard()
  if (!dashboard.configured) return { configured: false }
  return {
    configured: true,
    totals: dashboard.totals,
    recentIncome: dashboard.recentIncome.slice(0, 20),
    recentExpenses: dashboard.recentExpenses.slice(0, 20),
    retainers: dashboard.retainers.slice(0, 30),
    invoices: dashboard.invoices.slice(0, 30),
    monthlySummary: dashboard.monthlySummary,
  }
}
