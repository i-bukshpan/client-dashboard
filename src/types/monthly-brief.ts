export type MonthlyBriefState = 'needs_input' | 'draft' | 'approved'

export interface MonthlyBriefMissingInformation {
  id: string
  description: string
  question: string
  options: string[]
}

export interface MonthlyBriefResult {
  currentStatus: string
  completedThisMonth: string[]
  pendingActions: string[]
  missingInformation: MonthlyBriefMissingInformation[]
}

export interface MonthlyBriefEvidence {
  version: 1
  clientId: string
  clientName: string
  reportMonth: string
  period: { start: string; end: string }
  sheetRows: Record<string, Record<string, string>[]>
  tasks: Array<Record<string, unknown>>
  calendarEvents: Array<Record<string, unknown>>
  driveFiles: Array<Record<string, unknown>>
  deterministicIssues: MonthlyBriefMissingInformation[]
  bounds: { sheetTabs: number; sheetRows: number; tasks: number; calendarEvents: number; driveFiles: number }
}

export interface MonthlyBriefRecord extends MonthlyBriefResult {
  id: string
  clientId: string
  clientName: string
  reportMonth: string
  state: MonthlyBriefState
  generatedAt: string
  updatedAt: string
  resolutions: Array<{ issueId: string; decision: 'omit' | 'clarified' | 'will_provide'; answer: string; answeredAt: string }>
  evidenceSummary: MonthlyBriefEvidence['bounds']
  snapshotFileId: string | null
  documentFileId: string | null
}
