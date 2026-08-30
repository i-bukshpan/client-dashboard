'use client'

import { useState, useEffect } from 'react'
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
  Layers,
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
  { type: 'stat_card', label: 'כרטיס מדד', icon: CreditCard, desc: 'סכום, ממוצע או סכימת עמודות מרובות' },
  { type: 'bar_chart', label: 'תרשים עמודות', icon: BarChart3, desc: 'השוואת נתונים לאורך זמן או קטגוריות' },
  { type: 'line_chart', label: 'תרשים קווי', icon: LineChartIcon, desc: 'מעקב אחר מגמות ותזרים' },
  { type: 'pie_chart', label: 'תרשים עוגה', icon: PieChartIcon, desc: 'התפלגות לפי ספקים/קטגוריות' },
  { type: 'data_table', label: 'טבלת נתונים', icon: TableIcon, desc: 'הצגת שורות נבחרות עם סינון ומיון' },
]

const COLOR_OPTIONS: Array<{
  value: 'blue' | 'green' | 'purple' | 'amber' | 'red'
  label: string
  bg: string
}> = [
  { value: 'blue', label: 'כחול', bg: 'bg-blue-500' },
  { value: 'green', label: 'ירוק', bg: 'bg-emerald-500' },
  { value: 'purple', label: 'סגול', bg: 'bg-violet-500' },
  { value: 'amber', label: 'ענבר / כתום', bg: 'bg-amber-500' },
  { value: 'red', label: 'אדום', bg: 'bg-rose-500' },
]

const ICON_OPTIONS = [
  { name: 'trending-up', label: 'מגמה', icon: TrendingUp },
  { name: 'dollar-sign', label: 'דולר/סכום', icon: DollarSign },
  { name: 'wallet', label: 'ארנק', icon: Wallet },
  { name: 'credit-card', label: 'כרטיס', icon: CreditCard },
  { name: 'activity', label: 'פעילות', icon: Activity },
  { name: 'users', label: 'לקוחות/משתמשים', icon: Users },
  { name: 'shopping-bag', label: 'הוצאות/רכש', icon: ShoppingBag },
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
      setSelectedColumns(initialWidget.columns || [])
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

  // Handle Sheet tab change
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

  // Toggle multi-column for stat card
  const toggleColumnSelection = (header: string) => {
    setSelectedColumns((prev) =>
      prev.includes(header) ? prev.filter((h) => h !== header) : [...prev, header]
    )
  }

  // Toggle table column
  const toggleTableColumn = (header: string) => {
    setTableColumns((prev) =>
      prev.includes(header) ? prev.filter((h) => h !== header) : [...prev, header]
    )
  }

  // Filter management
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

  // Save handler
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-violet-600 font-bold">
            <Sparkles className="w-5 h-5 text-violet-600" />
            <DialogTitle className="text-lg font-bold text-foreground">
              {initialWidget ? 'עריכת ווידג\'ט בדשבורד' : 'הוספת ווידג\'ט חדש לדשבורד'}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            הגדר את המאפיינים, העמודות, הסינונים והעיצוב לווידג&apos;ט שיוצג בדשבורד החכם
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* 1. Widget Type Selector */}
          <div>
            <Label className="text-xs font-bold mb-2 block">סוג הווידג&apos;ט</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {WIDGET_TYPES.map((wt) => {
                const IconComponent = wt.icon
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
                      flex flex-col items-start p-3 rounded-xl border text-right transition-all
                      ${
                        isSelected
                          ? 'border-violet-600 bg-violet-50/80 dark:bg-violet-950/40 text-violet-900 dark:text-violet-100 shadow-xs'
                          : 'border-border/70 hover:border-border hover:bg-muted/50 text-foreground'
                      }
                    `}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs mb-1">
                      <IconComponent className={`w-4 h-4 ${isSelected ? 'text-violet-600' : 'text-muted-foreground'}`} />
                      <span>{wt.label}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground leading-tight">
                      {wt.desc}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 2. Basic Properties (Title, Sheet Tab, Dashboard Tab) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 rounded-xl bg-muted/30 border border-border/60">
            <div className="sm:col-span-2">
              <Label className="text-xs font-bold mb-1 block">כותרת הווידג&apos;ט</Label>
              <Input
                placeholder="לדוגמה: סה״כ סכום חוזים (כולל מע״מ) או מגמת הוצאות"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-9 text-sm font-medium"
              />
            </div>

            <div>
              <Label className="text-xs font-bold mb-1 block">לשונית בגיליון Google Sheets</Label>
              <select
                value={sheet}
                onChange={(e) => handleSheetChange(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus:outline-hidden focus:ring-1 focus:ring-ring"
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
                  className="flex-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus:outline-hidden focus:ring-1 focus:ring-ring"
                >
                  {Array.from(new Set(['ראשי', ...existingDashboardTabs])).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                  <option value="__new__">+ טאב מותאם אישית</option>
                </select>
                {dashboardTab === '__new__' && (
                  <Input
                    placeholder="שם הטאב החדש..."
                    value={customTab}
                    onChange={(e) => setCustomTab(e.target.value)}
                    className="h-9 text-xs flex-1"
                  />
                )}
              </div>
            </div>
          </div>

          {/* 3. Type-Specific Configurations */}

          {/* A. STAT CARD CONFIGURATION */}
          {type === 'stat_card' && (
            <div className="space-y-4 p-3.5 rounded-xl bg-card border border-border/80">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-foreground">
                  עמודות לחישוב (ניתן לבחור עמודה אחת או לסמן מספר עמודות לסכימה משותפת)
                </Label>
                <Badge variant="outline" className="text-[10px]">
                  {selectedColumns.length > 0 ? `${selectedColumns.length} עמודות נבחרו לסכימה` : 'עמודה בודדת'}
                </Badge>
              </div>

              {/* Multi-column toggle chips */}
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 rounded-lg bg-muted/40 border border-border/50">
                {availableHeaders.map((h) => {
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
                        px-2.5 py-1 rounded-md text-xs font-medium transition-all
                        ${
                          isChecked
                            ? 'bg-violet-600 text-white font-bold shadow-xs'
                            : 'bg-background hover:bg-muted text-muted-foreground border border-border/60'
                        }
                      `}
                    >
                      {h}
                    </button>
                  )
                })}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <Label className="text-[11px] font-bold mb-1 block">סוג חישוב</Label>
                  <select
                    value={aggregation}
                    onChange={(e) => setAggregation(e.target.value as any)}
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value="sum">סכום (Sum)</option>
                    <option value="avg">ממוצע (Average)</option>
                    <option value="count">ספירת שורות (Count)</option>
                    <option value="min">מינימום (Min)</option>
                    <option value="max">מקסימום (Max)</option>
                  </select>
                </div>

                <div>
                  <Label className="text-[11px] font-bold mb-1 block">צבע כרטיס</Label>
                  <select
                    value={cardColor}
                    onChange={(e) => setCardColor(e.target.value as any)}
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                  >
                    {COLOR_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="text-[11px] font-bold mb-1 block">קידומת (למשל ₪)</Label>
                  <Input
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                    className="h-8 text-xs text-center"
                    placeholder="₪"
                  />
                </div>

                <div>
                  <Label className="text-[11px] font-bold mb-1 block">אייקון</Label>
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

          {/* B. BAR / LINE CHART CONFIGURATION */}
          {(type === 'bar_chart' || type === 'line_chart') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 rounded-xl bg-card border border-border/80">
              <div>
                <Label className="text-xs font-bold mb-1 block">עמודת ציר X (תאריך / קטגוריה / פרויקט)</Label>
                <select
                  value={xColumn}
                  onChange={(e) => setXColumn(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                >
                  {availableHeaders.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs font-bold mb-1 block">עמודת ציר Y (סכום / כמות למדידה)</Label>
                <select
                  value={yColumn}
                  onChange={(e) => setYColumn(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                >
                  {availableHeaders.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* C. PIE CHART CONFIGURATION */}
          {type === 'pie_chart' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 rounded-xl bg-card border border-border/80">
              <div>
                <Label className="text-xs font-bold mb-1 block">עמודת תוויות (קטגוריה / ספק / לקוח)</Label>
                <select
                  value={labelColumn}
                  onChange={(e) => setLabelColumn(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
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
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                >
                  {availableHeaders.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* D. DATA TABLE CONFIGURATION */}
          {type === 'data_table' && (
            <div className="space-y-3.5 p-3.5 rounded-xl bg-card border border-border/80">
              <Label className="text-xs font-bold block">עמודות להצגה בטבלה</Label>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 rounded-lg bg-muted/40 border border-border/50">
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
                            ? 'bg-violet-600 text-white font-bold shadow-xs'
                            : 'bg-background hover:bg-muted text-muted-foreground border border-border/60'
                        }
                      `}
                    >
                      {h}
                    </button>
                  )
                })}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] font-bold mb-1 block">מיון לפי עמודה</Label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value="">ללא מיון ספציפי</option>
                    {availableHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="text-[11px] font-bold mb-1 block">סדר מיון</Label>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as any)}
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value="desc">סדר יורד (מהגדול לקטן / מהחדש לישן)</option>
                    <option value="asc">סדר עולה (מהקטן לגדול / מהישן לחדש)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* 4. Grid Dimensions (Width & Height) */}
          <div className="grid grid-cols-2 gap-3.5 p-3.5 rounded-xl bg-muted/20 border border-border/60">
            <div>
              <Label className="text-xs font-bold mb-1.5 block">רוחב ווידג&apos;ט (1 עד 4 עמודות)</Label>
              <div className="grid grid-cols-4 gap-1">
                {[1, 2, 3, 4].map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setSpanWidth(w)}
                    className={`
                      py-1.5 text-xs font-bold rounded-lg border transition-all
                      ${
                        spanWidth === w
                          ? 'bg-violet-600 text-white border-violet-600 shadow-xs'
                          : 'bg-background text-muted-foreground border-border hover:bg-muted'
                      }
                    `}
                  >
                    {w} {w === 1 ? 'עמודה' : w === 4 ? 'מלא (4)' : 'עמודות'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold mb-1.5 block">גובה ווידג&apos;ט</Label>
              <div className="grid grid-cols-3 gap-1">
                {[1, 2, 3].map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setSpanHeight(h)}
                    className={`
                      py-1.5 text-xs font-bold rounded-lg border transition-all
                      ${
                        spanHeight === h
                          ? 'bg-violet-600 text-white border-violet-600 shadow-xs'
                          : 'bg-background text-muted-foreground border-border hover:bg-muted'
                      }
                    `}
                  >
                    גובה {h}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 5. Filters Section */}
          <div className="p-3.5 rounded-xl bg-muted/20 border border-border/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold">סינונים מותאמים (Filters)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addFilter}
                className="h-7 text-xs gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                הוסף סינון
              </Button>
            </div>

            {filters.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">אין סינונים פעילים (הווידג&apos;ט יחשב את כל השורות בגיליון)</p>
            ) : (
              <div className="space-y-2">
                {filters.map((f, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <select
                      value={f.column}
                      onChange={(e) => updateFilter(i, 'column', e.target.value)}
                      className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs"
                    >
                      {availableHeaders.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>

                    <select
                      value={f.operator}
                      onChange={(e) => updateFilter(i, 'operator', e.target.value as any)}
                      className="h-8 w-24 rounded-md border border-input bg-background px-2 text-xs"
                    >
                      <option value="equals">שווה ל-</option>
                      <option value="not_equals">שונה מ-</option>
                      <option value="contains">מכיל</option>
                      <option value="greater_than">גדול מ-</option>
                      <option value="less_than">קטן מ-</option>
                    </select>

                    <Input
                      placeholder="ערך להתאמה..."
                      value={f.value}
                      onChange={(e) => updateFilter(i, 'value', e.target.value)}
                      className="h-8 flex-1 text-xs"
                    />

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFilter(i)}
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between gap-2 border-t border-border/70 pt-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="text-xs"
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
