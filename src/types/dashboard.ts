/**
 * src/types/dashboard.ts
 *
 * Types for the Nehemiah OS v2 Dynamic Learning Dashboard.
 * Supports multi-tab dashboards, rich widgets, calculations (sum, avg, diff/net profit), filters, and sorting.
 */

export type WidgetType =
  | 'bar_chart'
  | 'line_chart'
  | 'pie_chart'
  | 'stat_card'
  | 'data_table'

export interface WidgetPosition {
  /** Column start index (0 to 3 for a 4-column layout) */
  col: number
  /** Row start index (0-based) */
  row: number
  /** Width in grid columns (1 to 4) */
  w: number
  /** Height in grid units (1 to 4) */
  h: number
}

export interface WidgetFilter {
  column: string
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than'
  value: string | number
}

export interface NetDiffFormula {
  column: string
  positive_value: string // e.g. "הכנסה" in column "סוג"
  negative_value: string // e.g. "הוצאה" in column "סוג"
  type_column: string   // e.g. "סוג" or "קטגוריה"
}

export interface DashboardWidget {
  /** Unique ID for keying and updating */
  id: string
  /** The visualization type */
  type: WidgetType
  /** Display title in Hebrew */
  title: string
  /** The Google Sheet tab name where data lives */
  sheet: string
  /** Optional inner dashboard tab name, e.g. "ראשי", "ספקים", "סוכנים", "משכורות" */
  tab?: string
  /** Grid placement */
  position: WidgetPosition
  /** Optional custom color token or hex */
  color?: string

  // Aggregation & Net calculations
  aggregation?: 'sum' | 'count' | 'avg' | 'min' | 'max' | 'net_diff'
  net_formula?: NetDiffFormula

  // Filters & Sorting
  filters?: WidgetFilter[]
  sort_by?: string
  sort_order?: 'asc' | 'desc'
  date_column?: string

  // Chart configuration
  x_column?: string
  y_column?: string
  label_column?: string
  value_column?: string
  group_by?: string

  // Stat card configuration
  icon?: string
  card_color?: 'green' | 'red' | 'blue' | 'amber' | 'purple'
  prefix?: string
  suffix?: string

  // Data table configuration
  columns?: string[]
  max_rows?: number
}

export interface DashboardConfig {
  version: 1
  tabs?: string[]
  widgets: DashboardWidget[]
}
