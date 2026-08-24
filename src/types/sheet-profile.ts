export type SheetSemanticType =
  | 'date'
  | 'datetime'
  | 'currency'
  | 'number'
  | 'percentage'
  | 'boolean'
  | 'identifier'
  | 'category'
  | 'text'
  | 'empty'

export type SheetTabRole = 'transactions' | 'summary' | 'master_data' | 'timeline' | 'unknown'

export interface SheetColumnProfile {
  name: string
  semanticType: SheetSemanticType
  confidence: number
  nullable: boolean
  uniqueRatio: number
  sampleValues: string[]
  currency: string | null
  dateFormats: string[]
}

export interface SheetTabProfile {
  title: string
  role: SheetTabRole
  roleConfidence: number
  rowCount: number
  columns: SheetColumnProfile[]
  findings: string[]
}

export interface SheetProfile {
  version: 1
  spreadsheetId: string
  analyzedAt: string
  tabs: SheetTabProfile[]
  currencies: string[]
  confidence: number
  ambiguities: string[]
}
