'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import {
  BarChart3,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  CreditCard,
  Table as TableIcon,
  Plus,
  Trash2,
  TrendingUp,
  DollarSign,
  Wallet,
  Activity,
  Users,
  ShoppingBag,
  Sparkles,
  Search,
  Check,
  Eye,
} from 'lucide-react'
import type { DashboardWidget, WidgetType, WidgetFilter } from '@/types/dashboard'
import type { SheetTabHeaderInfo } from '@/app/workspace/actions/dashboard-builder'

interface WidgetBuilderModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialWidget?: DashboardWidget | null
  tabs: SheetTabHeaderInfo[]
  existingDashboardTabs: string[]
  onSave: (widget: DashboardWidget) => void
}

const WIDGET_TYPES: Array<{
  type: WidgetType
  label: string
  icon: any
  desc: string
}> = [
  { type: 'stat_card', label: 'כרטיס מדד (Stat Card)', icon: CreditCard, desc: 'סכום, ממוצע או סכימת מספר עמודות' },
  { type: 'bar_chart', label: 'תרשים עמודות (Bar)', icon: BarChart3, desc: 'השוואת נתונים לאורך זמן או קטגוריות' },
  { type: 'line_chart', label: 'תרשים קווי (Line)', icon: LineChartIcon, desc: 'מעקב אחר מגמות ותזרים' },
  { type: 'pie_chart', label: 'תרשים עוגה (Pie)', icon: PieChartIcon, desc: 'התפלגות לפי ספקים / קטגוריות' },
  { type: 'data_table', label: 'טבלת נתונים (Table)', icon: TableIcon, desc: 'תצוגת שורות מפורטות עם מיון' },
]

const COLOR_OPTIONS: Array<{
  value: 'blue' | 'green' | 'purple' | 'amber' | 'red'
  label: string
  bg: string
  border: string
  text: string
}> = [
  { value: 'blue', label: 'כחול מנהלים', bg: 'bg-blue-50/80 dark:bg-blue-950/40', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-900 dark:text-blue-100' },
  { value: 'green', label: 'ירוק צמיחה', bg: 'bg-emerald-50/80 dark:bg-emerald-950/40', border: 'border-emerald-200 dark:border-emerald-800', text: 'text-emerald-900 dark:text-emerald-100' },
  { value: 'purple', label: 'סגול פרימיום', bg: 'bg-violet-50/80 dark:bg-violet-950/40', border: 'border-violet-200 dark:border-violet-800', text: 'text-violet-900 dark:text-violet-100' },
  { value: 'amber', label: 'ענבר / כתום', bg: 'bg-amber-50/80 dark:bg-amber-950/40', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-900 dark:text-amber-100' },
  { value: 'red', label: 'אדום התראות', bg: 'bg-rose-50/80 dark:bg-rose-950/40', border: 'border-rose-200 dark:border-rose-800', text: 'text-rose-900 dark:text-rose-100' },
]

const ICON_OPTIONS = [
  { name: 'trending-up', label: 'מגמה חיובית', icon: TrendingUp },
  { name: 'dollar-sign', label: 'סכום / כספים', icon: DollarSign },
  { name: 'wallet', label: 'ארנק / תזרים', icon: Wallet },
  { name: 'credit-card', label: 'כרטיס / תשלומים', icon: CreditCard },
  { name: 'activity', label: 'פעילות עסקית', icon: Activity },
  { name: 'users', label: 'לקוחות / ספקים', icon: Users },
  { name: 'shopping-bag', label: 'רכש / הוצאות', icon: ShoppingBag },
]

export function WidgetBuilderModal({
  open,
  onOpenChange,
  initialWidget,
  tabs,
  existingDashboardTabs,
  onSave,
}: WidgetBuilderModalProps) {
  const [type, setType] = useState<WidgetType>('stat_card')
  const [title, setTitle] = useState('')
  const [sheet, setSheet] = useState('')
  const [dashboardTab, setDashboardTab] = useState('ראשי')
  const [customTab, setCustomTab] = useState('')
  const [columnSearch, setColumnSearch] = useState('')

  // Stat Card Fields
  const [yColumn, setYColumn] = useState('')
  const [selectedColumns, setSelectedColumns] = useState<string[]>([])
  const [aggregation, setAggregation] = useState<'sum' | 'avg' | 'count' | 'min' | 'max' | 'net_diff'>('sum')
  const [cardColor, setCardColor] = useState<'blue' | 'green' | 'purple' | 'amber' | 'red'>('blue')
  const [icon, setIcon] = useState('trending-up')
  const [prefix, setPrefix] = useState('₪')
  const [suffix, setSuffix] = useState('')

  // Chart Fields
  const [xColumn, setXColumn] = useState('')
  const [labelColumn, setLabelColumn] = useState('')
  const [valueColumn, setValueColumn] = useState('')

  // Table Fields
  const [tableColumns, setTableColumns] = useState<string[]>([])
  const [maxRows, setMaxRows] = useState(15)
  const [sortBy, setSortBy] = useState('')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')

  // Grid Span
  const [spanWidth, setSpanWidth] = useState<number>(1)
  const [spanHeight, setSpanHeight] = useState<number>(1)

  // Filters
  const [filters, setFilters] = useState<WidgetFilter[]>([])

  // Available headers for selected sheet
  const currentSheetInfo = tabs.find((t) => t.title === sheet)
  const availableHeaders = currentSheetInfo?.headers || []

  const filteredHeaders = useMemo(() => {
    if (!columnSearch.trim()) return availableHeaders
    return availableHeaders.filter((h) => h.toLowerCase().includes(columnSearch.toLowerCase()))
  }, [availableHeaders, columnSearch])

  // Initialize or reset form on open
  useEffect(() => {
    if (initialWidget) {
      setType(initialWidget.type)
      setTitle(initialWidget.title || '')
      setSheet(initialWidget.sheet || tabs[0]?.title || '')
      setDashboardTab(initialWidget.tab || 'ראשי')
      setCustomTab('')
      setSpanWidth(initialWidget.position?.w || (initialWidget.type === 'stat_card' ? 1 : 2))
      setSpanHeight(initialWidget.position?.h || (initialWidget.type === 'stat_card' ? 1 : 2))

      setYColumn(initialWidget.y_column || '')
      setSelectedColumns(initialWidget.columns || (initialWidget.y_column?.includes(',') ? initialWidget.y_column.split(',').map((s) => s.trim()) : []))
      setAggregation(initialWidget.aggregation || 'sum')
      setCardColor(initialWidget.card_color || 'blue')
      setIcon(initialWidget.icon || 'trending-up')
      setPrefix(initialWidget.prefix ?? (initialWidget.title?.includes('סכום') || initialWidget.title?.includes('הכנס') || initialWidget.title?.includes('הוצא') ? '₪' : ''))
      setSuffix(initialWidget.suffix || '')

      setXColumn(initialWidget.x_column || '')
      setLabelColumn(initialWidget.label_column || '')
      setValueColumn(initialWidget.value_column || initialWidget.y_column || '')

      setTableColumns(initialWidget.columns || [])
      setMaxRows(initialWidget.max_rows || 15)
      setSortBy(initialWidget.sort_by || '')
      setSortOrder(initialWidget.sort_order || 'desc')

      setFilters(initialWidget.filters || [])
    } else {
      setType('stat_card')
      setTitle('')
      setSheet(tabs[0]?.title || '')
      setDashboardTab(existingDashboardTabs[0] || 'ראשי')
      setCustomTab('')
      setSpanWidth(1)
      setSpanHeight(1)
      setYColumn('')
      setSelectedColumns([])
      setAggregation('sum')
      setCardColor('blue')
      setIcon('trending-up')
      setPrefix('₪')
      setSuffix('')
      setXColumn('')
      setLabelColumn('')
      setValueColumn('')
      setTableColumns([])
      setMaxRows(15)
      setSortBy('')
      setSortOrder('desc')
      setFilters([])
    }
  }, [initialWidget, open, tabs, existingDashboardTabs])

  const handleSheetChange = (newSheet: string) => {
    setSheet(newSheet)
    const newHeaders = tabs.find((t) => t.title === newSheet)?.headers || []
    if (newHeaders.length > 0) {
      if (!yColumn || !newHeaders.includes(yColumn)) setYColumn(newHeaders[0])
      if (!xColumn || !newHeaders.includes(xColumn)) setXColumn(newHeaders[0])
      if (!labelColumn || !newHeaders.includes(labelColumn)) setLabelColumn(newHeaders[0])
      if (!valueColumn || !newHeaders.includes(valueColumn)) setValueColumn(newHeaders[1] || newHeaders[0])
      if (tableColumns.length === 0) setTableColumns(newHeaders.slice(0, 6))
    }
  }

  const toggleColumnSelection = (header: string) => {
    setSelectedColumns((prev) =>
      prev.includes(header) ? prev.filter((h) => h !== header) : [...prev, header]
    )
  }

  const toggleTableColumn = (header: string) => {
    setTableColumns((prev) =>
      prev.includes(header) ? prev.filter((h) => h !== header) : [...prev, header]
    )
  }

  const addFilter = () => {
    if (!availableHeaders[0]) return
    setFilters((prev) => [
      ...prev,
      { column: availableHeaders[0], operator: 'equals', value: '' },
    ])
  }

  const updateFilter = (index: number, field: keyof WidgetFilter, val: any) => {
    setFilters((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: val }
      return next
    })
  }

  const removeFilter = (index: number) => {
    setFilters((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSave = () => {
    const finalTab = (customTab.trim() || dashboardTab || 'ראשי').trim()
    const widgetId = initialWidget?.id || `widget-${type}-${Date.now()}`

    const baseWidget: DashboardWidget = {
      id: widgetId,
      type,
      title: title.trim() || (type === 'stat_card' ? 'כרטיס מדד' : 'תרשים חדש'),
      sheet: sheet || tabs[0]?.title || '',
      tab: finalTab,
      position: {
        col: initialWidget?.position?.col ?? 0,
        row: initialWidget?.position?.row ?? 0,
        w: spanWidth,
        h: spanHeight,
      },
      filters: filters.filter((f) => String(f.value).trim() !== ''),
    }

    if (type === 'stat_card') {
      baseWidget.aggregation = aggregation
      baseWidget.card_color = cardColor
      baseWidget.icon = icon
      baseWidget.prefix = prefix
      baseWidget.suffix = suffix
      if (selectedColumns.length > 0) {
        baseWidget.columns = selectedColumns
        baseWidget.y_column = selectedColumns.join(', ')
      } else {
        baseWidget.y_column = yColumn || availableHeaders[0] || ''
      }
    } else if (type === 'bar_chart' || type === 'line_chart') {
      baseWidget.x_column = xColumn || availableHeaders[0] || ''
      baseWidget.y_column = yColumn || availableHeaders[1] || availableHeaders[0] || ''
    } else if (type === 'pie_chart') {
      baseWidget.label_column = labelColumn || availableHeaders[0] || ''
      baseWidget.value_column = valueColumn || availableHeaders[1] || availableHeaders[0] || ''
    } else if (type === 'data_table') {
      baseWidget.columns = tableColumns.length > 0 ? tableColumns : availableHeaders.slice(0, 6)
      baseWidget.max_rows = maxRows
      if (sortBy) {
        baseWidget.sort_by = sortBy
        baseWidget.sort_order = sortOrder
      }
    }

    onSave(baseWidget)
    onOpenChange(false)
  }

  const currentColorConfig = COLOR_OPTIONS.find((c) => c.value === cardColor) || COLOR_OPTIONS[0]
  const currentIconConfig = ICON_OPTIONS.find((i) => i.name === icon) || ICON_OPTIONS[0]
  const CurrentIcon = currentIconConfig.icon

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-4xl max-w-4xl w-[92vw] max-h-[92vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-3 border-b border-border/60 bg-muted/20">
          <div className="flex items-center gap-2 text-violet-600 font-bold">
            <Sparkles className="w-5 h-5 text-violet-600" />
            <DialogTitle className="text-base font-bold text-foreground">
              {initialWidget ? 'עריכת ווידג\'ט בדשבורד' : 'הוספת ווידג\'ט חדש לדשבורד'}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            בחר את סוג הווידג&apos;ט, מקור הנתונים מ-Google Sheets, עמודות החישוב והעיצוב
          </DialogDescription>
        </DialogHeader>

        {/* 2-Column Responsive Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* 1. Widget Type Selection Grid */}
          <div>
            <Label className="text-xs font-bold text-foreground mb-2 block">סוג הווידג&apos;ט</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
              {WIDGET_TYPES.map((wt) => {
                const IconComp = wt.icon
                const isSelected = type === wt.type
                return (
                  <button
                    key={wt.type}
                    type="button"
                    onClick={() => {
                      setType(wt.type)
                      if (wt.type === 'stat_card') {
                        setSpanWidth(1)
                        setSpanHeight(1)
                      } else if (wt.type === 'data_table') {
                        setSpanWidth(4)
                        setSpanHeight(2)
                      } else {
                        setSpanWidth(2)
                        setSpanHeight(2)
                      }
                    }}
                    className={`
                      flex flex-col items-center text-center p-3 rounded-xl border transition-all duration-200
                      ${
                        isSelected
                          ? 'border-violet-600 bg-violet-50/80 dark:bg-violet-950/50 text-violet-950 dark:text-violet-100 shadow-sm ring-2 ring-violet-500/20 font-bold'
                          : 'border-border/70 hover:border-border hover:bg-muted/40 text-foreground'
                      }
                    `}
                  >
                    <div className={`w-8 h-8 rounded-lg mb-1.5 flex items-center justify-center ${isSelected ? 'bg-violet-600 text-white' : 'bg-muted text-muted-foreground'}`}>
                      <IconComp className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold block mb-0.5">{wt.label.split(' (')[0]}</span>
                    <span className="text-[10px] text-muted-foreground leading-tight hidden sm:block">
                      {wt.desc}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 2. Main Setup & Live Preview Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left/Middle: Setup Forms */}
            <div className="lg:col-span-2 space-y-4">
              {/* Basic Details (Title, Sheet, Tab) */}
              <div className="p-4 rounded-xl bg-card border border-border/70 space-y-3 shadow-xs">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-violet-600"></span>
                  הגדרות בסיסיות ומקור נתונים
                </h4>

                <div>
                  <Label className="text-xs font-bold mb-1 block">כותרת הווידג&apos;ט</Label>
                  <Input
                    placeholder="לדוגמה: סה״כ היקף חוזים (כולל מע״מ)"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="h-9 text-xs font-semibold"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-bold mb-1 block">לשונית ב-Google Sheets</Label>
                    <select
                      value={sheet}
                      onChange={(e) => handleSheetChange(e.target.value)}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs shadow-xs"
                    >
                      {tabs.map((t) => (
                        <option key={t.title} value={t.title}>
                          {t.title} ({t.headers.length} עמודות)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label className="text-xs font-bold mb-1 block">טאב פנימי בדשבורד</Label>
                    <div className="flex gap-1.5">
                      <select
                        value={dashboardTab}
                        onChange={(e) => {
                          setDashboardTab(e.target.value)
                          setCustomTab('')
                        }}
                        className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-xs shadow-xs"
                      >
                        {Array.from(new Set(['ראשי', ...existingDashboardTabs])).map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                        <option value="__new__">+ טאב חדש</option>
                      </select>
                      {dashboardTab === '__new__' && (
                        <Input
                          placeholder="שם הטאב..."
                          value={customTab}
                          onChange={(e) => setCustomTab(e.target.value)}
                          className="h-9 text-xs flex-1"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Column Selection & Aggregation for Stat Card */}
              {type === 'stat_card' && (
                <div className="p-4 rounded-xl bg-card border border-border/70 space-y-3.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                      בחירת עמודות לחישוב (ניתן לסמן מספר עמודות לסכימה)
                    </h4>
                    <Badge variant="outline" className="text-[10px] font-bold">
                      {selectedColumns.length > 0 ? `${selectedColumns.length} עמודות מסומנות` : 'עמודה בודדת'}
                    </Badge>
                  </div>

                  {/* Search inside columns */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-muted-foreground" />
                    <Input
                      placeholder="חפש עמודה..."
                      value={columnSearch}
                      onChange={(e) => setColumnSearch(e.target.value)}
                      className="h-8 pr-8 text-xs bg-muted/20"
                    />
                  </div>

                  {/* Chips for columns */}
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2.5 rounded-lg bg-muted/30 border border-border/60">
                    {filteredHeaders.map((h) => {
                      const isChecked = selectedColumns.includes(h) || (!selectedColumns.length && yColumn === h)
                      return (
                        <button
                          key={h}
                          type="button"
                          onClick={() => {
                            toggleColumnSelection(h)
                            setYColumn(h)
                          }}
                          className={`
                            px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5
                            ${
                              isChecked
                                ? 'bg-violet-600 text-white font-bold shadow-xs'
                                : 'bg-background hover:bg-muted text-muted-foreground border border-border/70'
                            }
                          `}
                        >
                          {isChecked && <Check className="w-3 h-3" />}
                          <span>{h}</span>
                        </button>
                      )
                    })}
                  </div>

                  {/* Stat Card Controls Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                    <div>
                      <Label className="text-xs font-bold mb-1 block">סוג חישוב</Label>
                      <select
                        value={aggregation}
                        onChange={(e) => setAggregation(e.target.value as any)}
                        className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                      >
                        <option value="sum">סכום כולל (Sum)</option>
                        <option value="avg">ממוצע (Average)</option>
                        <option value="count">ספירת שורות (Count)</option>
                        <option value="min">מינימום (Min)</option>
                        <option value="max">מקסימום (Max)</option>
                      </select>
                    </div>

                    <div>
                      <Label className="text-xs font-bold mb-1 block">צבע כרטיס</Label>
                      <select
                        value={cardColor}
                        onChange={(e) => setCardColor(e.target.value as any)}
                        className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs font-semibold"
                      >
                        {COLOR_OPTIONS.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <Label className="text-xs font-bold mb-1 block">קידומת</Label>
                      <Input
                        value={prefix}
                        onChange={(e) => setPrefix(e.target.value)}
                        className="h-8 text-xs text-center font-bold"
                        placeholder="₪"
                      />
                    </div>

                    <div>
                      <Label className="text-xs font-bold mb-1 block">אייקון</Label>
                      <select
                        value={icon}
                        onChange={(e) => setIcon(e.target.value)}
                        className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                      >
                        {ICON_OPTIONS.map((ico) => (
                          <option key={ico.name} value={ico.name}>
                            {ico.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Chart Controls */}
              {(type === 'bar_chart' || type === 'line_chart') && (
                <div className="p-4 rounded-xl bg-card border border-border/70 space-y-3 shadow-xs">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                    הגדרת צירי התרשים
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-bold mb-1 block">ציר X (תאריך / קטגוריה)</Label>
                      <select
                        value={xColumn}
                        onChange={(e) => setXColumn(e.target.value)}
                        className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                      >
                        {availableHeaders.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <Label className="text-xs font-bold mb-1 block">ציר Y (סכום / ערך מספרי)</Label>
                      <select
                        value={yColumn}
                        onChange={(e) => setYColumn(e.target.value)}
                        className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                      >
                        {availableHeaders.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Pie Chart Controls */}
              {type === 'pie_chart' && (
                <div className="p-4 rounded-xl bg-card border border-border/70 space-y-3 shadow-xs">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                    הגדרת פילוח התפלגות
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-bold mb-1 block">עמודת תוויות (ספק / קטגוריה)</Label>
                      <select
                        value={labelColumn}
                        onChange={(e) => setLabelColumn(e.target.value)}
                        className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                      >
                        {availableHeaders.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <Label className="text-xs font-bold mb-1 block">עמודת ערכים (סכום)</Label>
                      <select
                        value={valueColumn}
                        onChange={(e) => setValueColumn(e.target.value)}
                        className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                      >
                        {availableHeaders.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Table Controls */}
              {type === 'data_table' && (
                <div className="p-4 rounded-xl bg-card border border-border/70 space-y-3 shadow-xs">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                    עמודות להצגה בטבלה
                  </h4>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 rounded-lg bg-muted/30 border border-border/60">
                    {availableHeaders.map((h) => {
                      const isChecked = tableColumns.includes(h)
                      return (
                        <button
                          key={h}
                          type="button"
                          onClick={() => toggleTableColumn(h)}
                          className={`
                            px-2.5 py-1 rounded-md text-xs font-medium transition-all
                            ${
                              isChecked
                                ? 'bg-violet-600 text-white font-bold'
                                : 'bg-background hover:bg-muted text-muted-foreground border border-border/70'
                            }
                          `}
                        >
                          {h}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Grid Width & Span */}
              <div className="p-4 rounded-xl bg-muted/20 border border-border/70 space-y-2">
                <Label className="text-xs font-bold block">רוחב הווידג&apos;ט ברשת הדשבורד</Label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setSpanWidth(w)}
                      className={`
                        py-2 text-xs font-bold rounded-lg border transition-all
                        ${
                          spanWidth === w
                            ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                            : 'bg-background text-muted-foreground border-border hover:bg-muted'
                        }
                      `}
                    >
                      {w === 1 ? '1 (כרטיס רגיל)' : w === 2 ? '2 (חצי מסך)' : w === 3 ? '3 (רחב)' : '4 (רוחב מלא)'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Realtime Live Preview Card */}
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                <Eye className="w-4 h-4 text-violet-600" />
                <span>תצוגה מקדימה חיה (Live Preview)</span>
              </div>

              <div className="p-4 rounded-2xl bg-muted/30 border border-border/70 min-h-[220px] flex items-center justify-center">
                {type === 'stat_card' ? (
                  <Card className={`w-full border ${currentColorConfig.border} ${currentColorConfig.bg} shadow-md overflow-hidden`}>
                    <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                      <CardTitle className="text-xs font-bold text-muted-foreground uppercase">
                        {title.trim() || 'כותרת כרטיס מדד'}
                      </CardTitle>
                      <div className="w-8 h-8 rounded-xl bg-white dark:bg-card flex items-center justify-center shadow-xs">
                        <CurrentIcon className="w-4 h-4 text-violet-600" />
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-1">
                      <div className="text-2xl font-black text-foreground">
                        {prefix}2,200,932.12{suffix}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        גיליון: {sheet || 'פרויקטים'} · {selectedColumns.length > 1 ? `${selectedColumns.length} עמודות מסוכמות` : 'עמודה יחידה'}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="w-full p-4 rounded-xl bg-card border border-border/80 text-center space-y-2">
                    <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-950 flex items-center justify-center mx-auto text-violet-600">
                      <BarChart3 className="w-5 h-5" />
                    </div>
                    <h5 className="text-xs font-bold text-foreground">{title || 'תצוגת תרשים'}</h5>
                    <p className="text-[11px] text-muted-foreground">
                      מקור: {sheet} · רוחב {spanWidth} עמודות
                    </p>
                  </div>
                )}
              </div>

              {/* Filters Preview Section */}
              <div className="p-3 rounded-xl bg-muted/20 border border-border/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">סינונים ({filters.length})</span>
                  <Button type="button" variant="outline" size="sm" onClick={addFilter} className="h-6 text-[11px] px-2 gap-1">
                    <Plus className="w-3 h-3" />
                    הוסף
                  </Button>
                </div>
                {filters.map((f, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <select
                      value={f.column}
                      onChange={(e) => updateFilter(i, 'column', e.target.value)}
                      className="h-7 text-[11px] rounded border bg-background px-1 flex-1"
                    >
                      {availableHeaders.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                    <Input
                      placeholder="ערך..."
                      value={f.value}
                      onChange={(e) => updateFilter(i, 'value', e.target.value)}
                      className="h-7 text-[11px] flex-1"
                    />
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeFilter(i)} className="h-7 w-7 p-0 text-red-500">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="p-3 px-5 border-t border-border/60 bg-muted/20 flex items-center justify-between sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="text-xs font-semibold"
          >
            ביטול
          </Button>

          <Button
            type="button"
            onClick={handleSave}
            className="bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs gap-1.5 shadow-sm"
          >
            <Sparkles className="w-4 h-4" />
            {initialWidget ? 'שמור שינויים בווידג\'ט' : 'הוסף ווידג\'ט לדשבורד'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
