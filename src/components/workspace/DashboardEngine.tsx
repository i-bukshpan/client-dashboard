'use client'

/**
 * src/components/workspace/DashboardEngine.tsx
 *
 * The Nehemiah OS v2 Dynamic Learning Dashboard Engine.
 * Features:
 * - Dynamically renders widgets defined in DashboardConfig (Bar, Line, Pie, Stat Card, Data Table)
 * - Powerful live data filtering & sorting:
 *     - Interactive UI Toolbar: Global search, month/period filter, category filter, sorting
 *     - Widget-level filters: e.g. sum only where "סוג" = "הכנסה" or "הוצאה"
 *     - Net profit formula (רווח נקי): calculates sum(הכנסות) - sum(הוצאות)
 * - Fetches live data from Google Sheets via getSheetRowsAction
 * - Listens for Supabase Realtime updates on the `clients` table so AI tool invocations update the UI live
 * - Responsive grid system supporting 1 to 4 column spans
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Activity,
  CreditCard,
  Wallet,
  ShoppingBag,
  CheckCircle2,
  AlertCircle,
  LayoutGrid,
  RefreshCw,
  Sparkles,
  Bot,
  Search,
  Filter,
  ArrowUpDown,
  X,
  Calendar,
  FileDown,
  Share2,
  RotateCcw,
} from 'lucide-react'
import {
  getSheetRowsAction,
  getDashboardConfigAction,
} from '@/app/admin/crm/[id]/actions-workspace'
import {
  analyzeAndGenerateDashboardAction,
  resetClientAgentDataAction,
} from '@/app/workspace/actions/dashboard-intelligence'
import { createDashboardShareAction, exportDashboardPdfAction } from '@/app/workspace/actions/dashboard-snapshot'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import type { DashboardConfig, DashboardWidget, WidgetFilter } from '@/types/dashboard'
import type { SheetRow } from '@/lib/google-sheets'
import { dashboardConfigSchema } from '@/lib/v2/dashboard-schema'

interface DashboardEngineProps {
  clientId: string
  clientName: string
  initialConfig: DashboardConfig | null
  hasSheet: boolean
  onNavigateToAi?: () => void
}

// ── Color Palettes ─────────────────────────────────────────────────────────────

const CHART_COLORS = [
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#8b5cf6', // Violet
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#3b82f6', // Blue
]

const STAT_COLOR_MAP: Record<string, { bg: string; text: string; border: string; iconBg: string }> = {
  green: { bg: 'bg-emerald-50/70', text: 'text-emerald-700', border: 'border-emerald-200', iconBg: 'bg-emerald-100 text-emerald-600' },
  red: { bg: 'bg-red-50/70', text: 'text-red-700', border: 'border-red-200', iconBg: 'bg-red-100 text-red-600' },
  blue: { bg: 'bg-blue-50/70', text: 'text-blue-700', border: 'border-blue-200', iconBg: 'bg-blue-100 text-blue-600' },
  amber: { bg: 'bg-amber-50/70', text: 'text-amber-700', border: 'border-amber-200', iconBg: 'bg-amber-100 text-amber-600' },
  purple: { bg: 'bg-purple-50/70', text: 'text-purple-700', border: 'border-purple-200', iconBg: 'bg-purple-100 text-purple-600' },
}

function StatIcon({ iconName }: { iconName?: string }) {
  let Icon = Activity
  switch (iconName?.toLowerCase()) {
    case 'dollar-sign':
    case 'shekel':
    case 'money':
      Icon = DollarSign
      break
    case 'trending-up':
      Icon = TrendingUp
      break
    case 'trending-down':
      Icon = TrendingDown
      break
    case 'users':
      Icon = Users
      break
    case 'activity':
      Icon = Activity
      break
    case 'credit-card':
      Icon = CreditCard
      break
    case 'wallet':
      Icon = Wallet
      break
    case 'shopping-bag':
      Icon = ShoppingBag
      break
    case 'check':
      Icon = CheckCircle2
      break
  }
  return <Icon className="w-4 h-4" />
}

// ── Number parser helper ───────────────────────────────────────────────────────

function parseNumericValue(val: unknown): number {
  if (typeof val === 'number') return val
  if (!val) return 0
  const cleaned = String(val).replace(/[^0-9.-]+/g, '')
  const parsed = parseFloat(cleaned)
  return isNaN(parsed) ? 0 : parsed
}

// ── Row Filtering & Sorting Engine ────────────────────────────────────────────

function parseRowDate(row: SheetRow, dateCol?: string): Date | null {
  // If specific date column provided, check it first
  if (dateCol && row[dateCol]) {
    const d = parseSingleDateValue(String(row[dateCol]))
    if (d) return d
  }
  // Otherwise search any column containing date keywords
  for (const [key, val] of Object.entries(row)) {
    if (!val || typeof val !== 'string') continue
    const lowerKey = key.toLowerCase()
    if (
      lowerKey.includes('תאריך') ||
      lowerKey.includes('date') ||
      lowerKey.includes('יום') ||
      lowerKey.includes('חודש')
    ) {
      const d = parseSingleDateValue(val)
      if (d) return d
    }
  }
  return null
}

function parseSingleDateValue(val: string): Date | null {
  const trimmed = val.trim()
  if (!trimmed) return null
  // Match DD/MM/YYYY or DD/MM/YY or D/M/YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{2,4})$/)
  if (dmyMatch) {
    let year = parseInt(dmyMatch[3], 10)
    if (year < 100) year += 2000
    const month = parseInt(dmyMatch[2], 10) - 1
    const day = parseInt(dmyMatch[1], 10)
    const d = new Date(year, month, day)
    if (!isNaN(d.getTime())) return d
  }
  // Match ISO YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})[\/\.\-](\d{1,2})[\/\.\-](\d{1,2})$/)
  if (isoMatch) {
    const d = new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10))
    if (!isNaN(d.getTime())) return d
  }
  return null
}

function isWithinDateRange(
  rowDate: Date | null,
  dateRange: string,
  customStart?: string,
  customEnd?: string
): boolean {
  if (dateRange === 'all') return true
  if (!rowDate) return true // Keep rows with no recognizable date

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()

  if (dateRange === 'this_month') {
    return rowDate.getFullYear() === currentYear && rowDate.getMonth() === currentMonth
  }
  if (dateRange === 'last_month') {
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1
    return rowDate.getFullYear() === lastMonthYear && rowDate.getMonth() === lastMonth
  }
  if (dateRange === 'last_3_months') {
    const threeMonthsAgo = new Date(currentYear, currentMonth - 2, 1)
    return rowDate >= threeMonthsAgo && rowDate <= now
  }
  if (dateRange === 'this_year') {
    return rowDate.getFullYear() === currentYear
  }
  if (dateRange === 'custom') {
    if (customStart) {
      const start = new Date(customStart)
      if (rowDate < start) return false
    }
    if (customEnd) {
      const end = new Date(customEnd)
      end.setHours(23, 59, 59, 999)
      if (rowDate > end) return false
    }
    return true
  }
  return true
}

function applyRowFilters(
  rows: SheetRow[],
  filters?: WidgetFilter[],
  globalSearch?: string,
  categoryFilter?: string,
  dateRange: string = 'all',
  customStart?: string,
  customEnd?: string,
  dateCol?: string
): SheetRow[] {
  let result = [...rows]

  // 1. Apply global search query
  if (globalSearch && globalSearch.trim()) {
    const q = globalSearch.trim().toLowerCase()
    result = result.filter((row) =>
      Object.values(row).some((val) => String(val).toLowerCase().includes(q))
    )
  }

  // 2. Apply category/type global filter
  if (categoryFilter && categoryFilter !== 'all') {
    result = result.filter((row) =>
      Object.values(row).some((val) => String(val).trim() === categoryFilter)
    )
  }

  // 3. Apply Date Range filter
  if (dateRange !== 'all') {
    result = result.filter((row) => {
      const rowDate = parseRowDate(row, dateCol)
      return isWithinDateRange(rowDate, dateRange, customStart, customEnd)
    })
  }

  // 4. Apply widget-level filters
  if (filters && filters.length > 0) {
    result = result.filter((row) => {
      return filters.every((f) => {
        const cellValue = String(row[f.column] ?? '').trim()
        const targetValue = String(f.value).trim()

        switch (f.operator) {
          case 'equals':
            return cellValue.toLowerCase() === targetValue.toLowerCase()
          case 'not_equals':
            return cellValue.toLowerCase() !== targetValue.toLowerCase()
          case 'contains':
            return cellValue.toLowerCase().includes(targetValue.toLowerCase())
          case 'greater_than':
            return parseNumericValue(cellValue) > parseNumericValue(targetValue)
          case 'less_than':
            return parseNumericValue(cellValue) < parseNumericValue(targetValue)
          default:
            return true
        }
      })
    })
  }

  return result
}

function applySorting(rows: SheetRow[], sortBy?: string, sortOrder: 'asc' | 'desc' = 'desc'): SheetRow[] {
  if (!sortBy) return rows
  return [...rows].sort((a, b) => {
    const valA = a[sortBy] ?? ''
    const valB = b[sortBy] ?? ''
    const numA = parseNumericValue(valA)
    const numB = parseNumericValue(valB)

    if (numA !== 0 || numB !== 0) {
      return sortOrder === 'asc' ? numA - numB : numB - numA
    }
    return sortOrder === 'asc'
      ? String(valA).localeCompare(String(valB))
      : String(valB).localeCompare(String(valA))
  })
}

// ── Widget Subcomponents ───────────────────────────────────────────────────────

function StatCardWidget({
  widget,
  data,
}: {
  widget: DashboardWidget
  data: SheetRow[]
}) {
  const theme = STAT_COLOR_MAP[widget.card_color ?? 'blue'] ?? STAT_COLOR_MAP.blue

  const valColumn = widget.y_column || widget.value_column || Object.keys(data[0] || {})[1] || ''

  const value = useMemo(() => {
    if (!data.length) return 0

    // Net Difference calculation (e.g. Income - Expense)
    if (widget.aggregation === 'net_diff' && widget.net_formula) {
      const { column, type_column, positive_value, negative_value } = widget.net_formula
      let posTotal = 0
      let negTotal = 0

      data.forEach((row) => {
        const typeVal = String(row[type_column] ?? '').trim().toLowerCase()
        const amount = parseNumericValue(row[column])
        if (typeVal === positive_value.toLowerCase() || typeVal.includes(positive_value.toLowerCase())) {
          posTotal += amount
        } else if (typeVal === negative_value.toLowerCase() || typeVal.includes(negative_value.toLowerCase())) {
          negTotal += amount
        }
      })

      return posTotal - negTotal
    }

    if (widget.aggregation === 'count') {
      return data.length
    }

    if (widget.aggregation === 'avg') {
      const sum = data.reduce((acc, row) => acc + parseNumericValue(row[valColumn]), 0)
      return data.length > 0 ? sum / data.length : 0
    }

    if (widget.aggregation === 'min') {
      return Math.min(...data.map((row) => parseNumericValue(row[valColumn])))
    }

    if (widget.aggregation === 'max') {
      return Math.max(...data.map((row) => parseNumericValue(row[valColumn])))
    }

    // Default: sum
    return data.reduce((acc, row) => acc + parseNumericValue(row[valColumn]), 0)
  }, [data, valColumn, widget])

  const prefix = widget.prefix ?? (widget.title.includes('סכום') || widget.title.includes('הכנסות') || widget.title.includes('הוצאות') || widget.title.includes('רווח') ? '₪' : '')
  const formattedValue = `${prefix}${value.toLocaleString('he-IL', { maximumFractionDigits: 2 })}${widget.suffix ?? ''}`

  return (
    <Card className={`border ${theme.border} ${theme.bg} shadow-sm overflow-hidden flex flex-col justify-between`}>
      <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          {widget.title}
        </CardTitle>
        <div className={`w-8 h-8 rounded-xl ${theme.iconBg} flex items-center justify-center shadow-sm`}>
          <StatIcon iconName={widget.icon} />
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-1">
        <div className="text-2xl font-black text-foreground tracking-tight">
          {formattedValue}
        </div>
        <div className="flex items-center gap-1 mt-1 text-[11px] text-muted-foreground">
          <span>גיליון: {widget.sheet}</span>
          <span>·</span>
          <span>{data.length} רשומות מחושבות</span>
        </div>
      </CardContent>
    </Card>
  )
}

function BarChartWidget({
  widget,
  data,
}: {
  widget: DashboardWidget
  data: SheetRow[]
}) {
  const xKey = widget.x_column || Object.keys(data[0] || {})[0] || 'label'
  const yKey = widget.y_column || Object.keys(data[0] || {})[1] || 'value'

  const chartData = useMemo(() => {
    const map: Record<string, number> = {}
    data.forEach((row) => {
      let rawName = String(row[xKey] || '').trim()
      if (!rawName) return

      // Clean date formatting if full date string (e.g. 31/07/2025 -> 07/2025 or 2025-07)
      if (rawName.includes('/')) {
        const parts = rawName.split('/')
        if (parts.length === 3) {
          rawName = `${parts[1]}/${parts[2]}` // MM/YYYY
        }
      } else if (rawName.includes('-')) {
        const parts = rawName.split('-')
        if (parts.length === 3) {
          rawName = `${parts[0]}-${parts[1]}` // YYYY-MM
        }
      }

      const val = parseNumericValue(row[yKey])
      map[rawName] = (map[rawName] || 0) + val
    })

    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 16)
  }, [data, xKey, yKey])

  const color = widget.color || '#10b981'

  return (
    <Card className="border-border/60 shadow-sm flex flex-col h-full overflow-hidden">
      <CardHeader className="p-4 pb-2 border-b border-border/40 bg-card">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold text-foreground">{widget.title}</CardTitle>
          <Badge variant="outline" className="text-[10px] text-muted-foreground">
            {widget.sheet}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4 flex-1 min-h-[280px]">
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
            אין נתונים להצגה
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280} minWidth={0} minHeight={280}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 45 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: '#64748b' }}
                interval={0}
                angle={-25}
                textAnchor="end"
                height={45}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickFormatter={(v) =>
                  v >= 1000000 ? `₪${(v / 1000000).toFixed(1)}M` : v <= -1000000 ? `-₪${(Math.abs(v) / 1000000).toFixed(1)}M` : v >= 1000 ? `₪${(v / 1000).toFixed(0)}k` : v <= -1000 ? `-₪${(Math.abs(v) / 1000).toFixed(0)}k` : `₪${v}`
                }
              />
              <Tooltip
                formatter={(val: unknown) => [`₪${Number(val ?? 0).toLocaleString()}`, widget.title]}
                contentStyle={{ borderRadius: '10px', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
              />
              <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

function LineChartWidget({
  widget,
  data,
}: {
  widget: DashboardWidget
  data: SheetRow[]
}) {
  const xKey = widget.x_column || Object.keys(data[0] || {})[0] || 'date'
  const yKey = widget.y_column || Object.keys(data[0] || {})[1] || 'value'

  const chartData = useMemo(() => {
    const map: Record<string, number> = {}
    data.forEach((row) => {
      let rawDate = String(row[xKey] || '').trim()
      if (!rawDate) return
      map[rawDate] = (map[rawDate] || 0) + parseNumericValue(row[yKey])
    })

    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .slice(-20)
  }, [data, xKey, yKey])

  const color = widget.color || '#6366f1'

  return (
    <Card className="border-border/60 shadow-sm flex flex-col h-full overflow-hidden">
      <CardHeader className="p-4 pb-2 border-b border-border/40 bg-card">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold text-foreground">{widget.title}</CardTitle>
          <Badge variant="outline" className="text-[10px] text-muted-foreground">
            {widget.sheet}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4 flex-1 min-h-[280px]">
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
            אין נתונים להצגה
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280} minWidth={0} minHeight={280}>
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: '#64748b' }}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={40}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickFormatter={(v) =>
                  v >= 1000000 ? `₪${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `₪${(v / 1000).toFixed(0)}k` : `₪${v}`
                }
              />
              <Tooltip
                formatter={(val: unknown) => [`₪${Number(val ?? 0).toLocaleString()}`, widget.title]}
                contentStyle={{ borderRadius: '10px', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={3}
                dot={{ r: 4, fill: color }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

function PieChartWidget({
  widget,
  data,
}: {
  widget: DashboardWidget
  data: SheetRow[]
}) {
  const labelKey = widget.label_column || widget.x_column || Object.keys(data[0] || {})[0] || 'category'
  const valKey = widget.value_column || widget.y_column || Object.keys(data[0] || {})[1] || 'amount'

  const { chartData, totalSum } = useMemo(() => {
    const agg: Record<string, number> = {}
    let sum = 0
    data.forEach((row) => {
      const label = String(row[labelKey] || 'אחר').trim()
      const val = parseNumericValue(row[valKey])
      if (val > 0) {
        agg[label] = (agg[label] || 0) + val
        sum += val
      }
    })

    const items = Object.entries(agg)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([name, value]) => ({ name, value }))

    return { chartData: items, totalSum: sum }
  }, [data, labelKey, valKey])

  return (
    <Card className="border-border/60 shadow-sm flex flex-col h-full overflow-hidden">
      <CardHeader className="p-4 pb-2 border-b border-border/40 bg-card">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold text-foreground">{widget.title}</CardTitle>
          <Badge variant="outline" className="text-[10px] text-muted-foreground">
            {widget.sheet}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4 flex-1 min-h-[260px]">
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
            אין נתונים להצגה
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260} minWidth={0} minHeight={260}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="45%"
                outerRadius={75}
                innerRadius={45}
                paddingAngle={3}
              >
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(val: unknown, name: unknown) => {
                  const num = Number(val ?? 0)
                  const pct = totalSum > 0 ? ((num / totalSum) * 100).toFixed(1) : '0'
                  return [`₪${num.toLocaleString()} (${pct}%)`, String(name ?? '')]
                }}
                contentStyle={{ borderRadius: '10px', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
              />
              <Legend
                verticalAlign="bottom"
                wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                iconType="circle"
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

function DataTableWidget({
  widget,
  data,
}: {
  widget: DashboardWidget
  data: SheetRow[]
}) {
  const displayCols = widget.columns && widget.columns.length > 0
    ? widget.columns
    : Object.keys(data[0] || {}).slice(0, 6)

  const rows = (widget.max_rows ? data.slice(0, widget.max_rows) : data).slice(0, 20)

  return (
    <Card className="border-border/60 shadow-sm flex flex-col h-full overflow-hidden">
      <CardHeader className="p-4 pb-2 border-b border-border/40 bg-card">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold text-foreground">{widget.title}</CardTitle>
          <Badge variant="outline" className="text-[10px] text-muted-foreground">
            גיליון {widget.sheet} ({rows.length} שורות)
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1 overflow-auto max-h-[300px]">
        {rows.length === 0 ? (
          <div className="flex items-center justify-center p-8 text-xs text-muted-foreground">
            אין שורות נתונים תואמות
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50 border-b border-border/60">
              <tr>
                {displayCols.map((col) => (
                  <th key={col} className="text-right px-3 py-2 font-bold text-foreground/80 whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rIdx) => (
                <tr key={rIdx} className="border-b border-border/30 hover:bg-slate-50/60 transition-colors">
                  {displayCols.map((col) => (
                    <td key={col} className="px-3 py-2 whitespace-nowrap max-w-[160px] truncate">
                      {row[col] || <span className="text-muted-foreground/30">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  )
}

function WidgetRenderer({
  widget,
  data,
}: {
  widget: DashboardWidget
  data: SheetRow[]
}) {
  switch (widget.type) {
    case 'stat_card':
      return <StatCardWidget widget={widget} data={data} />
    case 'bar_chart':
      return <BarChartWidget widget={widget} data={data} />
    case 'line_chart':
      return <LineChartWidget widget={widget} data={data} />
    case 'pie_chart':
      return <PieChartWidget widget={widget} data={data} />
    case 'data_table':
      return <DataTableWidget widget={widget} data={data} />
    default:
      return null
  }
}

// ── Main Dashboard Engine Component ───────────────────────────────────────────

export function DashboardEngine({
  clientId,
  clientName,
  initialConfig,
  hasSheet,
  onNavigateToAi,
}: DashboardEngineProps) {
  const [config, setConfig] = useState<DashboardConfig | null>(initialConfig)
  const [sheetDataMap, setSheetDataMap] = useState<Record<string, SheetRow[]>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)

  // Interactive UI Filters State
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [dateRange, setDateRange] = useState<string>('all')
  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [customEndDate, setCustomEndDate] = useState<string>('')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')
  const [activeInnerTab, setActiveInnerTab] = useState('all')
  const [isAutoBuilding, setIsAutoBuilding] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isSharing, setIsSharing] = useState(false)

  const innerTabs = useMemo(() => {
    const set = new Set<string>()
    config?.widgets?.forEach((w) => {
      if (w.tab && w.tab.trim()) set.add(w.tab.trim())
    })
    return Array.from(set)
  }, [config?.widgets])

  // 1. Fetch live data for all referenced sheets
  const loadDashboardData = useCallback(async (currentConfig: DashboardConfig | null) => {
    if (!currentConfig || !currentConfig.widgets || currentConfig.widgets.length === 0) return
    setLoading(true)
    setError(null)
    try {
      const uniqueSheets = Array.from(new Set(currentConfig.widgets.map((w) => w.sheet)))
      const results = await Promise.all(
        uniqueSheets.map(async (sheetName) => {
          const res = await getSheetRowsAction(clientId, sheetName)
          if ('error' in res) {
            console.warn(`[DashboardEngine] Failed to load sheet ${sheetName}:`, res.error)
            return { sheet: sheetName, data: [] }
          }
          return { sheet: sheetName, data: res.data }
        })
      )

      const map: Record<string, SheetRow[]> = {}
      results.forEach((r) => {
        map[r.sheet] = r.data
      })
      setSheetDataMap(map)
      setLastRefreshed(new Date())
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'שגיאה בטעינת נתוני דשבורד')
    } finally {
      setLoading(false)
    }
  }, [clientId])

  const refreshAll = useCallback(async () => {
    setLoading(true)
    try {
      const cfgRes = await getDashboardConfigAction(clientId)
      let activeCfg = config
      if ('data' in cfgRes && cfgRes.data && cfgRes.data.widgets) {
        setConfig(cfgRes.data)
        activeCfg = cfgRes.data
      }
      if (activeCfg?.widgets && activeCfg.widgets.length > 0) {
        await loadDashboardData(activeCfg)
      }
    } finally {
      setLoading(false)
    }
  }, [clientId, config, loadDashboardData])

  useEffect(() => {
    if (!config?.widgets.length) return
    const timer = window.setTimeout(() => void loadDashboardData(config), 0)
    return () => window.clearTimeout(timer)
  }, [config, loadDashboardData])

  // 2. Supabase Realtime Subscription for live updates
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`client-dashboard-${clientId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'clients',
          filter: `id=eq.${clientId}`,
        },
        (payload) => {
          const parsed = dashboardConfigSchema.safeParse(payload.new?.dashboard_config_json)
          if (parsed.success) {
            setConfig(parsed.data)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [clientId, loadDashboardData])

  // Extract all categories/types for global filter dropdown
  const availableCategories = useMemo(() => {
    const set = new Set<string>()
    Object.values(sheetDataMap).forEach((rows) => {
      rows.forEach((r) => {
        ['סוג', 'קטגוריה', 'ספק', 'Type', 'Category'].forEach((key) => {
          if (r[key]) set.add(String(r[key]).trim())
        })
      })
    })
    return Array.from(set).filter(Boolean)
  }, [sheetDataMap])

  // ── No Sheet state ───────────────────────────────────────────────────────────
  if (!hasSheet) {
    return (
      <Card className="border-border/50 shadow-sm flex flex-col items-center justify-center py-20 text-center h-full">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
          <LayoutGrid className="w-8 h-8 text-indigo-400" />
        </div>
        <h3 className="font-bold text-foreground text-base">אין נתונים עבור דשבורד</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          טרם הוגדר גיליון נתונים עבור {clientName}. היעזר בסוכן ה-AI כדי לבנות את הגיליון תחילה.
        </p>
        {onNavigateToAi && (
          <Button onClick={onNavigateToAi} className="mt-4 gap-2 bg-indigo-600 hover:bg-indigo-700">
            <Bot className="w-4 h-4" />
            פתח שיחה עם הסוכן
          </Button>
        )}
      </Card>
    )
  }

  // ── Empty Config state ───────────────────────────────────────────────────────
  const handleAutoBuild = async () => {
    setIsAutoBuilding(true)
    const toastId = toast.loading('סורק את הגיליון ובונה דשבורד חכם...')
    try {
      const res = await analyzeAndGenerateDashboardAction(clientId)
      if ('error' in res) {
        toast.error(res.error, { id: toastId })
      } else {
        toast.success(`✅ הדשבורד נבנה עם ${res.widgetCount} ווידג'טים · ביטחון ${(res.confidence * 100).toFixed(0)}%`, { id: toastId })
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'שגיאה ביצירת דשבורד', { id: toastId })
    } finally {
      setIsAutoBuilding(false)
    }
  }

  const widgets = config?.widgets ?? []
  if (widgets.length === 0) {
    return (
      <Card className="border-border/50 shadow-sm flex flex-col items-center justify-center py-20 text-center h-full">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center mb-4 shadow-sm">
          <Sparkles className="w-8 h-8 text-indigo-600" />
        </div>
        <h3 className="font-bold text-foreground text-base">הדשבורד עדיין לא הוגדר</h3>
        <p className="text-sm text-muted-foreground mt-1.5 max-w-md">
          ניתן לבנות דשבורד חכם אוטומטית על בסיס הנתונים בגיליון, או לבקש מהסוכן התאמה אישית.
        </p>
        <div className="flex items-center gap-3 mt-5">
          <Button
            onClick={handleAutoBuild}
            disabled={isAutoBuilding}
            className="gap-2 bg-violet-600 hover:bg-violet-700 text-white shadow-md font-bold"
          >
            {isAutoBuilding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            בנה דשבורד חכם אוטומטית
          </Button>
          {onNavigateToAi && (
            <Button onClick={onNavigateToAi} variant="outline" className="gap-2">
              <Bot className="w-4 h-4" />
              התאמה אישית עם הסוכן
            </Button>
          )}
        </div>
      </Card>
    )
  }

  const hasActiveFilters = searchQuery.trim() !== '' || selectedCategory !== 'all'

  async function handleExportPdf() {
    setIsExporting(true)
    const toastId = toast.loading('יוצר צילום מצב ו-PDF ב-Google Drive...')
    try {
      const result = await exportDashboardPdfAction(clientId)
      if ('error' in result) throw new Error(result.error)
      toast.success('ה-PDF נשמר בתיקיית הלקוח', { id: toastId })
      window.open(result.pdfUrl, '_blank', 'noopener,noreferrer')
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'ייצוא PDF נכשל', { id: toastId })
    } finally {
      setIsExporting(false)
    }
  }

  async function handleSecureShare() {
    setIsSharing(true)
    const toastId = toast.loading('יוצר צילום מצב וקישור מאובטח...')
    try {
      const result = await createDashboardShareAction({ clientId, expiresInDays: 30 })
      if ('error' in result) throw new Error(result.error)
      await navigator.clipboard.writeText(result.shareUrl)
      toast.success('קישור קריאה בלבד ל-30 יום הועתק ללוח', { id: toastId, duration: 6000 })
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'יצירת קישור נכשלה', { id: toastId })
    } finally {
      setIsSharing(false)
    }
  }

  async function handleResetDashboard() {
    if (!window.confirm('האם אתה בטוח שברצונך לאפס את הדשבורד החכם? כל הווידג\'טים ימחקו ותוכל לבנות אותו מחדש מאפס.')) return
    const toastId = toast.loading('מאפס את הדשבורד...')
    try {
      const result = await resetClientAgentDataAction(clientId, { resetDashboard: true })
      setConfig(null)
      toast.success('הדשבורד אופס בהצלחה!', { id: toastId })
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'איפוס דשבורד נכשל', { id: toastId })
    }
  }

  return (
    <div className="flex flex-col h-full space-y-4 overflow-y-auto pr-1">
      {/* Header bar & Live Filters Toolbar */}
      <div className="bg-card p-3.5 rounded-2xl border border-border/60 shadow-sm shrink-0 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center shadow-xs">
              <LayoutGrid className="w-4 h-4 text-violet-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">דשבורד חכם · {clientName}</h2>
              {lastRefreshed && (
                <p className="text-[10px] text-muted-foreground">
                  עודכן {lastRefreshed.toLocaleTimeString('he-IL')} · סנכרון Realtime פעיל מ-Google Sheets
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-300 bg-emerald-50">
              ● Live Realtime
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshAll}
              disabled={loading}
              className="h-8 gap-1.5 text-xs font-semibold"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              רענן נתונים
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleResetDashboard()}
              className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-red-600 hover:border-red-200 hover:bg-red-50/50 transition-colors font-semibold"
              title="איפוס הדשבורד ובנייה מחדש מאפס"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              איפוס
            </Button>
            <Button variant="outline" size="sm" onClick={() => void handleExportPdf()} disabled={isExporting} className="h-8 gap-1.5 text-xs font-semibold">
              {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
              PDF
            </Button>
            <Button size="sm" onClick={() => void handleSecureShare()} disabled={isSharing} className="h-8 gap-1.5 bg-indigo-600 text-xs font-semibold hover:bg-indigo-700">
              {isSharing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
              שיתוף מאובטח
            </Button>
          </div>
        </div>

        {/* Interactive Filters & Search Toolbar */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40 text-xs">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-muted-foreground/60" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="חיפוש חופשי בכל הנתונים..."
              className="h-8 pr-8 text-xs bg-slate-50/70 border-border/60"
              dir="auto"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Date Range Filter Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground font-medium flex items-center gap-1 text-[11px]">
              <Calendar className="w-3 h-3 text-indigo-500" />
              תאריכים:
            </span>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="h-8 px-2 rounded-lg border border-border/60 bg-slate-50/70 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">כל הזמנים</option>
              <option value="this_month">החודש הנוכחי</option>
              <option value="last_month">חודש שעבר</option>
              <option value="last_3_months">3 חודשים אחרונים</option>
              <option value="this_year">השנה הנוכחית</option>
              <option value="custom">טווח תאריכים מותאם...</option>
            </select>
          </div>

          {dateRange === 'custom' && (
            <div className="flex items-center gap-1 bg-slate-100/90 p-1 px-2 rounded-lg border border-border/60">
              <span className="text-[10px] font-semibold text-muted-foreground">מתאריך:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="h-6 px-1 text-[11px] bg-white rounded border border-border/60 text-foreground font-sans focus:outline-none"
              />
              <span className="text-[10px] font-semibold text-muted-foreground mr-1">עד:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="h-6 px-1 text-[11px] bg-white rounded border border-border/60 text-foreground font-sans focus:outline-none"
              />
            </div>
          )}

          {availableCategories.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground font-medium flex items-center gap-1 text-[11px]">
                <Filter className="w-3 h-3" />
                סינון:
              </span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="h-8 px-2 rounded-lg border border-border/60 bg-slate-50/70 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">כל הקטגוריות / סוגים</option>
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSortOrder((o) => (o === 'desc' ? 'asc' : 'desc'))}
            className="h-8 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
          >
            <ArrowUpDown className="w-3 h-3" />
            {sortOrder === 'desc' ? 'מהחדש לישן' : 'מהישן לחדש'}
          </Button>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('')
                setSelectedCategory('all')
                setDateRange('all')
                setCustomStartDate('')
                setCustomEndDate('')
              }}
              className="h-8 px-2 text-xs text-red-600 hover:bg-red-50 gap-1 font-medium"
            >
              <X className="w-3 h-3" />
              נקה סינונים
            </Button>
          )}
        </div>
      </div>

      {/* Internal Sub-Tabs Pills */}
      {innerTabs.length > 0 && (
        <div className="flex items-center gap-1.5 p-1 bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl overflow-x-auto shrink-0">
          <Button
            variant={activeInnerTab === 'all' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveInnerTab('all')}
            className={`h-7 px-3 text-xs font-bold rounded-lg transition-all ${
              activeInnerTab === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            כל הווידג&apos;טים ({widgets.length})
          </Button>
          {innerTabs.map((tab) => {
            const count = widgets.filter((w) => (w.tab || 'ראשי') === tab).length
            return (
              <Button
                key={tab}
                variant={activeInnerTab === tab ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveInnerTab(tab)}
                className={`h-7 px-3 text-xs font-bold rounded-lg transition-all ${
                  activeInnerTab === tab
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab} ({count})
              </Button>
            )
          })}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Grid of Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pb-6">
        {(activeInnerTab === 'all'
          ? widgets
          : widgets.filter((w) => (w.tab || 'ראשי') === activeInnerTab)
        ).map((widget) => {
          const spanClass =
            widget.position.w === 4
              ? 'col-span-1 md:col-span-2 lg:col-span-4'
              : widget.position.w === 3
              ? 'col-span-1 md:col-span-2 lg:col-span-3'
              : widget.position.w === 2
              ? 'col-span-1 md:col-span-2'
              : 'col-span-1'

          const rawData = sheetDataMap[widget.sheet] || []

          // Apply both widget-level filters + active toolbar filters + date filtering + sorting
          const filteredData = applyRowFilters(
            rawData,
            widget.filters,
            searchQuery,
            selectedCategory,
            dateRange,
            customStartDate,
            customEndDate,
            widget.date_column || widget.x_column
          )
          const finalData = applySorting(
            filteredData,
            widget.sort_by || widget.date_column || widget.x_column,
            widget.sort_order || sortOrder
          )

          return (
            <div key={widget.id} className={`${spanClass} transition-all duration-300`}>
              {loading && rawData.length === 0 ? (
                <Card className="p-6 space-y-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-40 w-full" />
                </Card>
              ) : (
                <WidgetRenderer widget={widget} data={finalData} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
