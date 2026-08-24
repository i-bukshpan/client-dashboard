import type { DashboardConfig } from '@/types/dashboard'
import type { SheetProfile } from '@/types/sheet-profile'
import type { SheetRow } from '@/lib/google-sheets'

export interface DashboardSnapshot {
  version: 1
  clientId: string
  clientName: string
  title: string
  generatedAt: string
  sourceSpreadsheetId: string
  profile: SheetProfile
  config: DashboardConfig
  data: Record<string, SheetRow[]>
}

export interface DashboardShareGrant {
  id: string
  client_id: string
  title: string
  snapshot_file_id: string
  pdf_file_id: string | null
  expires_at: string | null
  revoked_at: string | null
  created_at: string
}
