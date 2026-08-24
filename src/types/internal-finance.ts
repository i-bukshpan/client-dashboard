export const INTERNAL_FINANCE_TABS = {
  income: 'הכנסות',
  expenses: 'הוצאות',
  retainers: 'ריטיינרים',
  invoices: 'חשבוניות',
  monthlySummary: 'סיכום חודשי',
} as const

export type InternalFinanceTabKey = keyof typeof INTERNAL_FINANCE_TABS
export type InternalFinanceMutationTab = Exclude<InternalFinanceTabKey, 'monthlySummary'>

export interface AgencyWorkspaceSettings {
  workbookId: string
  driveFolderId: string
  updatedAt: string
}

export interface InternalFinanceTotals {
  income: number
  expenses: number
  profit: number
  openInvoices: number
  activeRetainers: number
}

export interface InternalFinanceDashboardData {
  configured: boolean
  settings: AgencyWorkspaceSettings | null
  totals: InternalFinanceTotals
  recentIncome: Record<string, string>[]
  recentExpenses: Record<string, string>[]
  retainers: Record<string, string>[]
  invoices: Record<string, string>[]
  monthlySummary: Record<string, string>[]
}

export interface InternalFinanceMutation {
  id: string
  operation: 'append' | 'update'
  tab: InternalFinanceMutationTab
  targetId: string | null
  values: Record<string, string>
  reason: string
}

export interface PendingInternalFinanceMutation extends InternalFinanceMutation {
  token: string
  expiresAt: string
  summary: string
}
