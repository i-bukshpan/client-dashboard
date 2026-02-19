import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface Client {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  status?: string | null // 'פעיל', 'ליד', 'ארכיון'
  internal_notes?: string | null
  share_token?: string | null
  parent_id?: string | null
  created_at: string
  updated_at: string
  share_permissions?: ClientSharePermissions | null
}

export interface ClientSharePermissions {
  allow_edit: boolean
  show_overview: boolean
  show_billing: boolean
  show_credentials: boolean
  show_notes: boolean
  allowed_modules: string[] // List of module_names to show
}

export interface ClientCredential {
  id: string
  client_id: string
  service_name: string
  username?: string | null
  password?: string | null
  website_url?: string | null
  created_at: string
}

export interface Payment {
  id: string
  client_id: string
  amount: number
  payment_date: string
  payment_status: string // 'שולם', 'ממתין', 'בוטל'
  payment_method?: string | null
  description?: string | null
  is_recurring?: boolean
  payment_type?: 'income' | 'expense' | 'subscription' | 'salary' | 'rent' | 'utility' | 'other' | null
  frequency?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'one-time' | null
  next_payment_date?: string | null
  notes?: string | null
  category?: string | null
  auto_generate_next?: boolean
  linked_module?: string | null
  linked_record_id?: string | null
  linked_record_label?: string | null
  created_at: string
}

export interface Reminder {
  id: string
  client_id?: string | null
  title: string
  description?: string | null
  due_date: string
  priority: string // 'דחוף', 'רגיל', 'נמוך'
  is_completed: boolean
  reminder_type?: string | null // 'משימה', 'פירעון צ'ק', 'דוח רבעוני'
  created_at: string
}

export interface Note {
  id: string
  client_id: string
  content: string
  color?: string | null // 'yellow', etc.
  created_at: string
  updated_at: string
}

export interface AuditLogEntry {
  id: string
  action_type: string
  entity_type: string
  entity_id: string
  user_id?: string | null
  description: string
  metadata?: Record<string, any>
  created_at: string
}

// System Management Types
export interface Goal {
  id: string
  goal_type: 'revenue' | 'clients' | 'payments' | 'custom'
  target_value: number
  target_date: string
  current_value: number
  status: 'active' | 'achieved' | 'failed' | 'cancelled'
  title?: string | null
  description?: string | null
  created_at: string
  updated_at: string
}

export interface Backup {
  id: string
  backup_type: 'manual' | 'automatic'
  file_path?: string | null
  file_size?: number | null
  description?: string | null
  backup_date: string
  metadata?: Record<string, any> | null
  created_at: string
}

export interface GlobalTemplate {
  id: string
  template_type: 'schema' | 'category' | 'payment_method' | 'reminder' | 'note'
  name: string
  data: Record<string, any>
  description?: string | null
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface GlobalCategory {
  id: string
  name: string
  type: 'income' | 'expense'
  parent_id?: string | null
  icon?: string | null
  color?: string | null
  created_at: string
  updated_at: string
}

// Dynamic Schema System Types
export interface FormulaMetadata {
  target_module_name?: string // The module name to pull data from (for cross-table formulas)
  target_column_key?: string // The column key to aggregate (e.g., "amount")
  operation?: 'SUM' | 'AVERAGE' | 'COUNT' | 'MIN' | 'MAX' // Aggregation operation
  filter?: Record<string, any> // Optional filter (e.g., { status: 'paid' })

  // For row-level calculations
  expression?: string // Expression like "income - expense" or "IF(amount > 1000, 'high', 'low')"
  columnReferences?: string[] // Column names referenced in expression
}

export interface RelationshipMetadata {
  target_module_name: string // The module to link to
  target_column_key: string // The column in target module to match against
  source_column_key: string // The column in current module that holds the foreign key value
  display_column_key: string // The column in target module to display (e.g., "name")
}

export interface ConditionalFormatting {
  id?: string
  column_key?: string
  condition: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains'
  value: string | number
  backgroundColor?: string
  textColor?: string
  fontWeight?: string
}

export interface ColumnDefinition {
  name: string // Internal name (e.g., 'amount', 'description')
  type: 'number' | 'text' | 'date' | 'currency' | 'formula' | 'reference' | 'calculated' | 'lookup' // Data type
  label: string // Display label in Hebrew (e.g., 'סכום', 'תיאור')
  required?: boolean // Whether this field is required
  default?: any // Default value
  formula?: FormulaMetadata // Formula metadata if type is 'formula', 'reference', or 'calculated'
  relationship?: RelationshipMetadata // Relationship metadata if type is 'lookup'
  conditionalFormatting?: ConditionalFormatting[] // Conditional formatting rules
}

export interface ClientSchema {
  id: string
  client_id: string
  module_name: string // e.g., 'cash_flow', 'investments', 'scribe_payments'
  branch_name?: string | null // e.g., 'ירושלים', 'בני ברק', 'רעננה' - null = טבלאות ראשיות
  columns: ColumnDefinition[]
  financial_type?: 'income' | 'expense' | null
  amount_column?: string | null
  date_column?: string | null
  description_column?: string | null
  created_at: string
  updated_at: string
}

export interface ClientDataRecord {
  id: string
  client_id: string
  module_type: string // e.g., 'cash_flow', 'investments', 'scribe_payments'
  entry_date: string
  data: Record<string, any> // JSONB object storing actual values
  created_at: string
  updated_at: string
}

// Extended types for UI usage
export interface ClientDataRecordWithSchema extends ClientDataRecord {
  schema?: ClientSchema
}

export interface ClientLink {
  id: string
  client_id: string
  title: string
  url: string
  link_type: 'google_sheets' | 'google_drive' | 'google_docs' | 'dropbox' | 'onedrive' | 'website' | 'other'
  description?: string | null
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  client_id: string
  sender_role: 'admin' | 'client'
  content: string
  created_at: string
  is_read: boolean
  context_type?: 'general' | 'module' | 'payment' | 'credential' | 'note' | null
  context_id?: string | null
  context_name?: string | null
  context_data?: any | null
}
