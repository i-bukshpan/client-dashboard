'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ClientSchema, ClientDataRecord, ColumnDefinition } from '@/lib/supabase'
import { getRecords } from '@/lib/actions/data-records'
import { useToast } from '@/components/ui/toast'

type MetricOperation = 'SUM' | 'AVERAGE' | 'COUNT' | 'MIN' | 'MAX'

type MetricType = 'standard' | 'calculated'
type ConditionOperator = 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'not_empty' | 'is_empty'

interface MetricBase {
  id: string
  label: string
  type: MetricType
}

interface StandardMetric extends MetricBase {
  type: 'standard'
  source_module_name: string
  source_foreign_key_column_key: string
  source_value_column_key: string
  operation: MetricOperation
  date_column_key?: string
  condition?: {
    column_key: string
    operator: ConditionOperator
    value: string
  }
}

interface CalculatedMetric extends MetricBase {
  type: 'calculated'
  formula: string
}

export type DashboardMetric = StandardMetric | CalculatedMetric

interface DashboardConfig {
  primary_module_name: string
  primary_key_column_key: string
  primary_display_column_key: string
  metrics: DashboardMetric[]
}

interface BranchDashboardProps {
  clientId: string
  branchName: string | null
  schemas: ClientSchema[]
  readOnly?: boolean
}

interface DateRange {
  from?: string
  to?: string
}

const emptyConfig: DashboardConfig = {
  primary_module_name: '',
  primary_key_column_key: '',
  primary_display_column_key: '',
  metrics: [],
}

function getStorageKey(clientId: string, branchName: string | null) {
  const branchKey = branchName ? branchName : 'main'
  return `branch-dashboard:${clientId}:${branchKey}`
}

function isValidDateRange({ from, to }: DateRange) {
  if (!from && !to) return true
  if (from && to) {
    return new Date(from).getTime() <= new Date(to).getTime()
  }
  return true
}

function parseDateValue(value: any): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  const asString = String(value)
  const parsed = new Date(asString)
  if (!isNaN(parsed.getTime())) return parsed
  return null
}

function matchesDateRange(date: Date | null, range: DateRange) {
  if (!date) return false
  const time = date.getTime()
  if (range.from && time < new Date(range.from).getTime()) return false
  if (range.to && time > new Date(range.to).getTime()) return false
  return true
}

function getNumericValue(value: any): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return isNaN(value) ? null : value
  const parsed = parseFloat(String(value))
  return isNaN(parsed) ? null : parsed
}

export function BranchDashboard({ clientId, branchName, schemas, readOnly = false }: BranchDashboardProps) {
  const { showToast } = useToast()
  const [config, setConfig] = useState<DashboardConfig>(emptyConfig)
  const [recordsByModule, setRecordsByModule] = useState<Record<string, ClientDataRecord[]>>({})
  const [loading, setLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [search, setSearch] = useState('')
  const [dateRange, setDateRange] = useState<DateRange>({})
  const [newMetric, setNewMetric] = useState<DashboardMetric>({
    id: '',
    label: '',
    type: 'standard',
    source_module_name: '',
    source_foreign_key_column_key: '',
    source_value_column_key: '',
    operation: 'SUM',
    date_column_key: '',
  })

  const storageKey = useMemo(() => getStorageKey(clientId, branchName), [clientId, branchName])

  const availableModules = useMemo(() => schemas, [schemas])

  const primarySchema = useMemo(
    () => availableModules.find(m => m.module_name === config.primary_module_name),
    [availableModules, config.primary_module_name]
  )

  const primaryColumns = primarySchema?.columns || []

  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as DashboardConfig
      setConfig(parsed)
      setIsEditing(false)
    } catch (error) {
      console.error('Failed to parse dashboard config', error)
    }
  }, [storageKey])

  const loadRecords = async () => {
    if (!config.primary_module_name) return
    setLoading(true)
    try {
      const modules = new Set<string>([config.primary_module_name])
      config.metrics.forEach(metric => {
        if (metric.type === 'standard' && metric.source_module_name) {
          modules.add(metric.source_module_name)
        }
      })
      const entries = Array.from(modules)
      const results = await Promise.all(
        entries.map(async (moduleName) => {
          const result = await getRecords(clientId, moduleName)
          return { moduleName, records: result.success ? result.records || [] : [] }
        })
      )
      const nextMap: Record<string, ClientDataRecord[]> = {}
      results.forEach(({ moduleName, records }) => {
        nextMap[moduleName] = records
      })
      setRecordsByModule(nextMap)
    } catch (error) {
      console.error('Error loading dashboard records:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!config.primary_module_name || config.metrics.length === 0) return
    loadRecords()
  }, [config.primary_module_name, config.metrics.length])

  const primaryRecords = recordsByModule[config.primary_module_name] || []

  const displayColumnLabel = primaryColumns.find(col => col.name === config.primary_display_column_key)?.label

  const filteredPrimaryRecords = useMemo(() => {
    if (!search.trim()) return primaryRecords
    const needle = search.trim().toLowerCase()
    return primaryRecords.filter(record => {
      const displayValue = record.data[config.primary_display_column_key]
      const keyValue = record.data[config.primary_key_column_key]
      return String(displayValue ?? '').toLowerCase().includes(needle) ||
        String(keyValue ?? '').toLowerCase().includes(needle)
    })
  }, [primaryRecords, search, config.primary_display_column_key, config.primary_key_column_key])

  const metricsById = useMemo(() => {
    const byId: Record<string, DashboardMetric> = {}
    config.metrics.forEach(metric => {
      byId[metric.id] = metric
    })
    return byId
  }, [config.metrics])

  const metricResults = useMemo(() => {
    if (!config.primary_key_column_key || config.metrics.length === 0) {
      return { values: {}, totals: {} }
    }

    const metricValues: Record<string, Record<string, number>> = {}
    const metricTotals: Record<string, number> = {}

    // Phase 1: Calculate Standard Metrics
    config.metrics.forEach(metric => {
      if (metric.type !== 'standard') return

      const sourceRecords = recordsByModule[metric.source_module_name] || []
      const grouped: Record<string, number[]> = {}

      sourceRecords.forEach(record => {
        const foreignKey = record.data[metric.source_foreign_key_column_key]
        if (foreignKey === null || foreignKey === undefined || foreignKey === '') return

        if (metric.date_column_key && (dateRange.from || dateRange.to)) {
          const dateValue = parseDateValue(record.data[metric.date_column_key])
          if (!matchesDateRange(dateValue, dateRange)) return
        }

        // Apply conditional logic
        if (metric.condition && metric.condition.column_key && metric.condition.operator && metric.condition.value !== undefined) {
          const val = String(record.data[metric.condition.column_key] || '')
          const target = metric.condition.value
          let match = false
          switch (metric.condition.operator) {
            case 'equals': match = val === target; break;
            case 'not_equals': match = val !== target; break;
            case 'greater_than': match = parseFloat(val) > parseFloat(target); break;
            case 'less_than': match = parseFloat(val) < parseFloat(target); break;
            case 'contains': match = val.includes(target); break;
            case 'not_empty': match = val !== '' && val !== null && val !== undefined; break;
            case 'is_empty': match = val === '' || val === null || val === undefined; break;
          }
          if (!match) return
        }

        const numeric = metric.operation === 'COUNT'
          ? 1
          : getNumericValue(record.data[metric.source_value_column_key])

        if (numeric === null || numeric === undefined) return

        const key = String(foreignKey)
        if (!grouped[key]) grouped[key] = []
        grouped[key].push(numeric)
      })

      const aggregated: Record<string, number> = {}
      let total = 0

      Object.entries(grouped).forEach(([key, values]) => {
        let value = 0
        switch (metric.operation) {
          case 'SUM':
            value = values.reduce((sum, v) => sum + v, 0)
            break
          case 'AVERAGE':
            value = values.reduce((sum, v) => sum + v, 0) / values.length
            break
          case 'COUNT':
            value = values.length
            break
          case 'MIN':
            value = Math.min(...values)
            break
          case 'MAX':
            value = Math.max(...values)
            break
        }
        aggregated[key] = value
        total += value
      })

      metricValues[metric.id] = aggregated
      metricTotals[metric.id] = total
    })

    // Phase 2: Calculate Calculated Metrics
    // Simple implementation: 2-passes to allow simple dependencies (Calculated can depend on Standard)
    config.metrics.forEach(metric => {
      if (metric.type !== 'calculated') return

      try {
        // Prepare variables for formula evaluation
        // We need to replace [Metric Name] with values
        // To avoid conflicts, we'll use a unique replacement strategy or just sort by length desc to avoid partial matches

        // Calculate total
        let totalFormula = metric.formula
        config.metrics.forEach(m => {
          if (m.id === metric.id) return
          // Regex to replace [Metric Name] with the value
          // We use a specific pattern to ensure we match the exact placeholder
          const placeholder = `[${m.label}]`
          const value = metricTotals[m.id] || 0
          totalFormula = totalFormula.split(placeholder).join(String(value))
        })

        // Evaluate total safely
        // We only allow numbers, operators, parens, and whitespace
        // But since we substituted values, it should be just numbers and operators
        // To be safe against "alert(1)" we check chars
        if (!/^[0-9.+\-*/()\s]+$/.test(totalFormula)) {
          console.warn(`Invalid formula characters in metric ${metric.label}: ${totalFormula}`)
          metricTotals[metric.id] = 0
        } else {
          // eslint-disable-next-line no-new-func
          const func = new Function(`return ${totalFormula}`)
          metricTotals[metric.id] = func() || 0
        }

        // Calculate per-key values
        // We need a union of all keys from all referenced metrics
        // This is expensive if we check all metrics. Optimization: check only referenced metrics?
        // For now, simpler: iterate all keys found in Phase 1
        const allKeys = new Set<string>()
        Object.values(metricValues).forEach(rec => {
          Object.keys(rec).forEach(k => allKeys.add(k))
        })

        const aggregated: Record<string, number> = {}
        allKeys.forEach(key => {
          let rowFormula = metric.formula
          config.metrics.forEach(m => {
            if (m.id === metric.id) return
            const placeholder = `[${m.label}]`
            const val = metricValues[m.id]?.[key] || 0
            rowFormula = rowFormula.split(placeholder).join(String(val))
          })

          if (!/^[0-9.+\-*/()\s]+$/.test(rowFormula)) {
            aggregated[key] = 0
          } else {
            try {
              // eslint-disable-next-line no-new-func
              const func = new Function(`return ${rowFormula}`)
              aggregated[key] = func() || 0
            } catch (e) {
              aggregated[key] = 0
            }
          }
        })
        metricValues[metric.id] = aggregated

      } catch (e) {
        console.error(`Error calculating metric ${metric.label}`, e)
        metricTotals[metric.id] = 0
        metricValues[metric.id] = {}
      }
    })

    return { values: metricValues, totals: metricTotals }
  }, [config.metrics, config.primary_key_column_key, recordsByModule, dateRange])

  const handleSaveConfig = () => {
    if (!config.primary_module_name || !config.primary_key_column_key || !config.primary_display_column_key) {
      showToast('error', 'יש לבחור טבלה ראשית ועמודות מפתח ותצוגה')
      return
    }
    if (config.metrics.length === 0) {
      showToast('error', 'יש להוסיף לפחות מדד אחד')
      return
    }
    if (!isValidDateRange(dateRange)) {
      showToast('error', 'טווח תאריכים לא תקין')
      return
    }
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(config))
      showToast('success', 'הדשבורד נשמר בהצלחה')
      setIsEditing(false)
      loadRecords()
    } catch (error) {
      console.error('Error saving dashboard config:', error)
      showToast('error', 'שגיאה בשמירת הדשבורד')
    }
  }

  const handleAddMetric = () => {
    if (!newMetric.label) {
      showToast('error', 'יש לתת שם למדד')
      return
    }

    if (newMetric.type === 'standard') {
      if (!newMetric.source_module_name || !newMetric.source_foreign_key_column_key || !newMetric.source_value_column_key) {
        showToast('error', 'יש למלא את כל שדות המדד')
        return
      }
    } else {
      if (!newMetric.formula) {
        showToast('error', 'יש להזין נוסחה לחישוב')
        return
      }
    }

    const metricToAdd: DashboardMetric = {
      ...newMetric,
      id: Date.now().toString(),
    } as DashboardMetric // Cast is safe here due to validation above

    setConfig(prev => ({ ...prev, metrics: [...prev.metrics, metricToAdd] }))
    setNewMetric({
      id: '',
      label: '',
      type: 'standard',
      source_module_name: '',
      source_foreign_key_column_key: '',
      source_value_column_key: '',
      operation: 'SUM',
      date_column_key: '',
    })
  }

  const handleRemoveMetric = (metricId: string) => {
    setConfig(prev => ({ ...prev, metrics: prev.metrics.filter(m => m.id !== metricId) }))
  }

  // Helper variables for Standard Metric form
  const metricModuleSchema = newMetric.type === 'standard'
    ? availableModules.find(m => m.module_name === newMetric.source_module_name)
    : null

  const metricColumns = metricModuleSchema?.columns || []
  const numericColumns = metricColumns.filter(col => col.type === 'number' || col.type === 'currency')
  const dateColumns = metricColumns.filter(col => col.type === 'date')
  const allColumns = metricColumns // For condition column selector

  // Check if we are editing a standard metric or calculated
  const isStandard = newMetric.type === 'standard'

  // Auto-detect: compute summary stats across all modules
  const autoDetectSummary = useMemo(() => {
    if (schemas.length === 0) return null
    if (config.primary_module_name && !isEditing) return null // Don't compute if user has a config

    const moduleSummaries: Array<{
      moduleName: string
      recordCount: number
      numericStats: Array<{
        columnLabel: string
        columnName: string
        sum: number
        avg: number
        count: number
      }>
    }> = []

    schemas.forEach(schema => {
      const records = recordsByModule[schema.module_name] || []
      const numericCols = (schema.columns || []).filter(col => col.type === 'number')

      if (numericCols.length === 0 && records.length === 0) return

      const numericStats = numericCols.map(col => {
        let sum = 0
        let count = 0
        records.forEach(record => {
          const val = getNumericValue(record.data[col.name])
          if (val !== null) {
            sum += val
            count++
          }
        })
        return {
          columnLabel: col.label,
          columnName: col.name,
          sum,
          avg: count > 0 ? sum / count : 0,
          count,
        }
      })

      moduleSummaries.push({
        moduleName: schema.module_name,
        recordCount: records.length,
        numericStats,
      })
    })

    // Cross-table totals
    const crossTableTotals: Record<string, { sum: number; count: number; label: string }> = {}
    moduleSummaries.forEach(mod => {
      mod.numericStats.forEach(stat => {
        const key = stat.columnLabel.toLowerCase()
        if (!crossTableTotals[key]) {
          crossTableTotals[key] = { sum: 0, count: 0, label: stat.columnLabel }
        }
        crossTableTotals[key].sum += stat.sum
        crossTableTotals[key].count += stat.count
      })
    })

    return { moduleSummaries, crossTableTotals }
  }, [schemas, recordsByModule, config.primary_module_name, isEditing])

  // Load records for auto-detect when no config
  useEffect(() => {
    if (schemas.length === 0) return
    if (config.primary_module_name) return // Already have a config
    const loadAllModuleRecords = async () => {
      setLoading(true)
      try {
        const results = await Promise.all(
          schemas.map(async (schema) => {
            const result = await getRecords(clientId, schema.module_name)
            return { moduleName: schema.module_name, records: result.success ? result.records || [] : [] }
          })
        )
        const nextMap: Record<string, ClientDataRecord[]> = {}
        results.forEach(({ moduleName, records }) => {
          nextMap[moduleName] = records
        })
        setRecordsByModule(nextMap)
      } catch (error) {
        console.error('Error loading records for auto-detect:', error)
      } finally {
        setLoading(false)
      }
    }
    loadAllModuleRecords()
  }, [schemas, clientId, config.primary_module_name])

  if (schemas.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center text-grey">אין טבלאות בתחום זה.</div>
      </Card>
    )
  }

  // Show auto-detect dashboard when no config exists
  if (!config.primary_module_name && !isEditing) {
    const totalRecords = autoDetectSummary?.moduleSummaries.reduce((sum, mod) => sum + mod.recordCount, 0) || 0
    const crossTotals = autoDetectSummary?.crossTableTotals || {}
    const crossTotalEntries = Object.values(crossTotals).filter(t => t.sum !== 0)

    return (
      <div className="space-y-8 animate-fade-in-up">
        <div className="flex items-center justify-between flex-wrap gap-4 bg-white/40 backdrop-blur-md p-6 rounded-[2.5rem] border border-border/50 shadow-sm">
          <div>
            <h3 className="text-xl font-black text-navy tracking-tight">כיוון דשבורד — סיכום אוטומטי</h3>
            <p className="text-xs font-medium text-grey mt-1">ניתוח נתונים אוטומטי מכל הטבלאות המשויכות לסניף זה</p>
          </div>
          {!readOnly && (
            <Button
              variant="outline"
              onClick={() => setIsEditing(true)}
              className="rounded-xl border-border/50 font-bold hover:bg-white hover:text-primary h-11 px-6 shadow-sm"
            >
              הגדרות מתקדמות
            </Button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-20 bg-white/30 backdrop-blur-md rounded-[2.5rem] border border-border/50">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-grey font-bold">מנתח נתונים ומחשב מדדים...</p>
          </div>
        ) : (
          <>
            {/* Bento-grid Cross-table totals */}
            {crossTotalEntries.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-blue-600 p-6 rounded-[2.5rem] text-white shadow-xl shadow-blue-600/20 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl transition-transform duration-700 group-hover:scale-150" />
                  <div className="relative z-10 flex flex-col h-full justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-70">סה&quot;כ רשומות</span>
                      <div className="text-4xl font-black mt-1 mb-2">{totalRecords.toLocaleString('he-IL')}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] bg-white/20 px-2 py-1 rounded-full font-bold">{autoDetectSummary?.moduleSummaries.length || 0} טבלאות</span>
                    </div>
                  </div>
                </div>

                {crossTotalEntries.slice(0, 3).map((total, i) => {
                  const colors = [
                    'bg-emerald-600 shadow-lg shadow-emerald-600/20',
                    'bg-amber-600 shadow-lg shadow-amber-600/20',
                    'bg-purple-600 shadow-lg shadow-purple-600/20'
                  ]
                  const colorClass = colors[i % colors.length]

                  return (
                    <div key={i} className={`${colorClass} p-6 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden group`}>
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl transition-transform duration-700 group-hover:scale-150" />
                      <div className="relative z-10 flex flex-col h-full justify-between">
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-widest opacity-70">סה&quot;כ {total.label}</span>
                          <div className="text-4xl font-black mt-1 mb-2" dir="ltr">₪{total.sum.toLocaleString('he-IL')}</div>
                        </div>
                        <div className="text-[10px] font-bold opacity-80">
                          ממוצע: ₪{total.count > 0 ? (total.sum / total.count).toLocaleString('he-IL', { maximumFractionDigits: 1 }) : '0'}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Per-module summaries with glass-cards */}
            <div className="space-y-4">
              <h4 className="text-sm font-black text-navy uppercase tracking-widest px-2">פירוט לפי טבלה</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {autoDetectSummary?.moduleSummaries.map(mod => (
                  <div key={mod.moduleName} className="glass-card hover-lift p-6 rounded-[2rem] border border-border/50 bg-white/60 relative overflow-hidden group">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                          <span className="font-black text-xs">{mod.moduleName.charAt(0)}</span>
                        </div>
                        <h5 className="font-black text-navy">{mod.moduleName}</h5>
                      </div>
                      <span className="text-[10px] font-black bg-navy/5 text-navy/60 px-3 py-1 rounded-full">{mod.recordCount} רשומות</span>
                    </div>
                    {mod.numericStats.length > 0 ? (
                      <div className="space-y-3">
                        {mod.numericStats.map(stat => (
                          <div key={stat.columnName} className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100/50 flex items-center justify-between group/stat hover:bg-white transition-colors">
                            <span className="text-xs font-bold text-grey">{stat.columnLabel}</span>
                            <div className="flex items-center gap-4">
                              <span className="font-black text-navy text-sm">₪{stat.sum.toLocaleString('he-IL')}</span>
                              <div className="hidden sm:block w-px h-3 bg-slate-200" />
                              <span className="hidden sm:block text-[10px] font-medium text-grey">ממוצע: ₪{stat.avg.toLocaleString('he-IL', { maximumFractionDigits: 1 })}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-4 text-center">
                        <p className="text-xs text-grey font-medium">אין עמודות מספריות בטבלה זו</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {autoDetectSummary?.moduleSummaries.length === 0 && (
              <div className="text-center py-20 bg-white/40 backdrop-blur-sm border-2 border-dashed rounded-[2.5rem] border-grey/20">
                <div className="w-16 h-16 bg-grey/5 rounded-full flex items-center justify-center mx-auto mb-4">
                  <div className="h-8 w-8 text-grey/30">📊</div>
                </div>
                <p className="text-grey font-bold mb-2">אין נתונים בטבלאות עדיין.</p>
                <p className="text-xs text-grey">הוסף רשומות בטבלאות כדי לראות סיכום אוטומטי וניתוח נתונים.</p>
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  if (isEditing) {
    return (
      <Card className="p-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold">הגדרת דשבורד תחום</h3>
          <p className="text-sm text-grey mt-1">
            בחר טבלה ראשית והגדר מדדים לפי טבלאות קשורות.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>טבלה ראשית</Label>
            <Select
              value={config.primary_module_name || '__empty__'}
              onValueChange={(value) => {
                const moduleValue = value === '__empty__' ? '' : value
                setConfig({
                  ...config,
                  primary_module_name: moduleValue,
                  primary_key_column_key: '',
                  primary_display_column_key: '',
                })
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="בחר טבלה" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__empty__">בחר טבלה</SelectItem>
                {availableModules.map(module => (
                  <SelectItem key={module.id} value={module.module_name}>
                    {module.module_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>עמודת מפתח</Label>
            <Select
              value={config.primary_key_column_key || '__empty__'}
              onValueChange={(value) => {
                setConfig({ ...config, primary_key_column_key: value === '__empty__' ? '' : value })
              }}
              disabled={!config.primary_module_name}
            >
              <SelectTrigger>
                <SelectValue placeholder="בחר עמודה" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__empty__">בחר עמודה</SelectItem>
                {primaryColumns.map(col => (
                  <SelectItem key={col.name} value={col.name}>
                    {col.label} ({col.name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>עמודת תצוגה</Label>
            <Select
              value={config.primary_display_column_key || '__empty__'}
              onValueChange={(value) => {
                setConfig({ ...config, primary_display_column_key: value === '__empty__' ? '' : value })
              }}
              disabled={!config.primary_module_name}
            >
              <SelectTrigger>
                <SelectValue placeholder="בחר עמודה" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__empty__">בחר עמודה</SelectItem>
                {primaryColumns.map(col => (
                  <SelectItem key={col.name} value={col.name}>
                    {col.label} ({col.name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="border-t pt-4 space-y-4">
          <h4 className="text-md font-semibold">מדדים</h4>
          {config.metrics.length === 0 ? (
            <p className="text-sm text-grey">אין מדדים עדיין</p>
          ) : (
            <div className="space-y-2">
              {config.metrics.map(metric => (
                <div key={metric.id} className="flex items-center justify-between gap-4">
                  <div className="text-sm">
                    <span className="font-semibold">{metric.label}</span>
                    <span className="text-grey"> · {metric.type === 'standard' ? metric.source_module_name : 'נוסחה'}</span>
                  </div>
                  <Button variant="ghost" onClick={() => handleRemoveMetric(metric.id)} className="text-red-600">
                    מחק
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Card className="p-4 bg-grey/5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="md:col-span-1">
                <Label>שם מדד</Label>
                <Input
                  value={newMetric.label}
                  onChange={(e) => setNewMetric({ ...newMetric, label: e.target.value })}
                  placeholder="לדוגמה: סה&quot;כ הוצאות"
                />
              </div>

              <div className="md:col-span-1">
                <Label>סוג מדד</Label>
                <Select
                  value={newMetric.type}
                  onValueChange={(value: MetricType) => {
                    if (value === 'standard') {
                      setNewMetric({
                        id: '',
                        label: newMetric.label,
                        type: 'standard',
                        source_module_name: '',
                        source_foreign_key_column_key: '',
                        source_value_column_key: '',
                        operation: 'SUM',
                        date_column_key: '',
                      })
                    } else {
                      setNewMetric({
                        id: '',
                        label: newMetric.label,
                        type: 'calculated',
                        formula: '',
                      })
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">רגיל (סיכום מטבלה)</SelectItem>
                    <SelectItem value="calculated">מחושב (בין מדדים)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Standard Metric Fields */}
              {newMetric.type === 'standard' && (
                <>
                  <div className="md:col-span-1">
                    <Label>טבלה מקור</Label>
                    <Select
                      value={(newMetric.type === 'standard' ? newMetric.source_module_name : '') || '__empty__'}
                      onValueChange={(value) => {
                        const moduleValue = value === '__empty__' ? '' : value
                        setNewMetric(prev => ({
                          ...prev,
                          source_module_name: moduleValue,
                          source_foreign_key_column_key: '',
                          source_value_column_key: '',
                          date_column_key: '',
                        } as unknown as DashboardMetric))
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="בחר טבלה" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__empty__">בחר טבלה</SelectItem>
                        {availableModules.map(module => (
                          <SelectItem key={module.id} value={module.module_name}>
                            {module.module_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="md:col-span-1">
                    <Label>עמודת מזהה בטבלה</Label>
                    <Select
                      value={(newMetric.type === 'standard' ? newMetric.source_foreign_key_column_key : '') || '__empty__'}
                      onValueChange={(value) =>
                        setNewMetric(prev => ({ ...prev, source_foreign_key_column_key: value === '__empty__' ? '' : value } as unknown as DashboardMetric))
                      }
                      disabled={newMetric.type === 'standard' ? !newMetric.source_module_name : true}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="בחר עמודה לקישור" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__empty__">בחר עמודה</SelectItem>
                        {metricColumns.map(col => (
                          <SelectItem key={col.name} value={col.name}>
                            {col.label} ({col.name})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="md:col-span-1">
                    <Label>עמודת ערך</Label>
                    <Select
                      value={(newMetric.type === 'standard' ? newMetric.source_value_column_key : '') || '__empty__'}
                      onValueChange={(value) =>
                        setNewMetric(prev => ({ ...prev, source_value_column_key: value === '__empty__' ? '' : value } as unknown as DashboardMetric))
                      }
                      disabled={newMetric.type === 'standard' ? !newMetric.source_module_name : true}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="בחר עמודה מספרית" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__empty__">בחר עמודה</SelectItem>
                        {numericColumns.map(col => (
                          <SelectItem key={col.name} value={col.name}>
                            {col.label} ({col.name})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="md:col-span-1">
                    <Label>פעולה</Label>
                    <Select
                      value={newMetric.type === 'standard' ? newMetric.operation : 'SUM'}
                      onValueChange={(value: MetricOperation) => setNewMetric(prev => {
                        if (prev.type !== 'standard') return prev
                        return { ...prev, operation: value }
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SUM">סכום</SelectItem>
                        <SelectItem value="AVERAGE">ממוצע</SelectItem>
                        <SelectItem value="COUNT">מונה</SelectItem>
                        <SelectItem value="MIN">מינימום</SelectItem>
                        <SelectItem value="MAX">מקסימום</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="md:col-span-1">
                    <Label>סינון תאריך (אופציונלי)</Label>
                    <Select
                      value={(newMetric.type === 'standard' ? newMetric.date_column_key : '') || '__empty__'}
                      onValueChange={(value) =>
                        setNewMetric(prev => ({ ...prev, date_column_key: value === '__empty__' ? '' : value } as unknown as DashboardMetric))
                      }
                      disabled={newMetric.type === 'standard' ? !newMetric.source_module_name : true}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="בחר עמודה" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__empty__">ללא סינון תאריך</SelectItem>
                        {dateColumns.map(col => (
                          <SelectItem key={col.name} value={col.name}>
                            {col.label} ({col.name})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Condition Editor */}
                  <div className="md:col-span-4 border-t pt-4 mt-2">
                    <Label className="mb-2 block">תנאי (אופציונלי) - סכם רק אם...</Label>
                    <div className="flex gap-2 items-center">
                      <Select
                        value={(newMetric.type === 'standard' ? newMetric.condition?.column_key : '') || '__empty__'}
                        onValueChange={(value) =>
                          setNewMetric(prev => {
                            if (prev.type !== 'standard') return prev
                            return {
                              ...prev,
                              condition: value === '__empty__' ? undefined : {
                                column_key: value,
                                operator: 'equals',
                                value: ''
                              }
                            }
                          })
                        }
                        disabled={newMetric.type === 'standard' ? !newMetric.source_module_name : true}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="בחר עמודה לתנאי" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__empty__">-- ללא תנאי --</SelectItem>
                          {allColumns.map(col => (
                            <SelectItem key={col.name} value={col.name}>
                              {col.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {newMetric.type === 'standard' && newMetric.condition && (
                        <>
                          <Select
                            value={newMetric.condition.operator}
                            onValueChange={(value: any) =>
                              setNewMetric(prev => {
                                if (prev.type !== 'standard' || !prev.condition) return prev
                                return {
                                  ...prev,
                                  condition: { ...prev.condition, operator: value }
                                }
                              })
                            }
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="equals">שווה ל-</SelectItem>
                              <SelectItem value="not_equals">שונה מ-</SelectItem>
                              <SelectItem value="greater_than">גדול מ-</SelectItem>
                              <SelectItem value="less_than">קטן מ-</SelectItem>
                              <SelectItem value="contains">מכיל</SelectItem>
                              <SelectItem value="not_empty">לא ריק</SelectItem>
                              <SelectItem value="is_empty">ריק</SelectItem>
                            </SelectContent>
                          </Select>

                          {newMetric.condition.operator !== 'not_empty' && newMetric.condition.operator !== 'is_empty' && (
                            <Input
                              value={newMetric.condition.value}
                              onChange={(e) =>
                                setNewMetric(prev => {
                                  if (prev.type !== 'standard' || !prev.condition) return prev
                                  return {
                                    ...prev,
                                    condition: { ...prev.condition, value: e.target.value }
                                  }
                                })
                              }
                              placeholder="ערך להשוואה"
                              className="w-[180px]"
                            />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Calculated Metric Fields */}
              {newMetric.type === 'calculated' && (
                <div className="md:col-span-4 border-t pt-4 mt-2">
                  <Label className="mb-2 block">נוסחה</Label>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2 mb-2">
                      {config.metrics.map(m => (
                        <Button
                          key={m.id}
                          variant="outline"
                          size="sm"
                          onClick={() => setNewMetric(prev => {
                            if (prev.type !== 'calculated') return prev
                            return { ...prev, formula: prev.formula + `[${m.label}]` }
                          })}
                          className="text-xs"
                        >
                          {m.label}
                        </Button>
                      ))}
                      {['+', '-', '*', '/', '(', ')'].map(op => (
                        <Button
                          key={op}
                          variant="ghost"
                          size="sm"
                          onClick={() => setNewMetric(prev => {
                            if (prev.type !== 'calculated') return prev
                            return { ...prev, formula: prev.formula + op }
                          })}
                          className="text-xs font-mono"
                        >
                          {op}
                        </Button>
                      ))}
                    </div>
                    <textarea
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-left"
                      dir="ltr"
                      value={newMetric.formula}
                      onChange={(e) => setNewMetric(prev => {
                        if (prev.type !== 'calculated') return prev
                        return { ...prev, formula: e.target.value }
                      })}
                      placeholder="לדוגמה: ([Income] - [Expense]) * 1.17"
                    />
                    <p className="text-xs text-grey">
                      השתמש בכפתורים למעלה כדי להוסיף מדדים ופעולות, או הקלד באופן חופשי.
                    </p>
                  </div>
                </div>
              )}

              <div className="md:col-span-1 md:col-start-4">
                <Button onClick={handleAddMetric} className="w-full">
                  הוסף מדד
                </Button>
              </div>
            </div>
          </Card>
        </div >

        <div className="flex gap-2">
          <Button onClick={handleSaveConfig}>שמור דשבורד</Button>
          <Button
            variant="outline"
            onClick={() => {
              setConfig(emptyConfig)
              setIsEditing(false)
            }}
          >
            בטל
          </Button>
        </div>
      </Card >
    )
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white/40 backdrop-blur-md p-6 rounded-[2.5rem] border border-border/50 shadow-sm">
        <div>
          <h3 className="text-xl font-black text-navy tracking-tight">דשבורד תחום</h3>
          <p className="text-xs font-bold text-grey mt-1">
            טבלה ראשית: <span className="text-primary">{config.primary_module_name}</span> · תצוגה לפי <span className="text-navy">{displayColumnLabel || config.primary_display_column_key}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={loadRecords}
            disabled={loading}
            className="rounded-xl border-border/50 font-bold hover:bg-white h-11 px-6 shadow-sm"
          >
            רענן
          </Button>
          {!readOnly && (
            <Button
              variant="outline"
              onClick={() => setIsEditing(true)}
              className="rounded-xl border-border/50 font-bold hover:bg-white h-11 px-6 shadow-sm"
            >
              ערוך הגדרות
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white/40 backdrop-blur-md p-6 rounded-[2.5rem] border border-border/50 shadow-sm">
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase text-grey tracking-widest px-1">חיפוש חופשי</Label>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חפש לפי שם או מזהה..."
            className="rounded-2xl border-border/30 bg-white/50 h-10 px-4 focus:bg-white transition-all"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase text-grey tracking-widest px-1">מתאריך</Label>
          <Input
            type="date"
            value={dateRange.from || ''}
            onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
            className="rounded-2xl border-border/30 bg-white/50 h-10 px-4 focus:bg-white transition-all"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase text-grey tracking-widest px-1">עד תאריך</Label>
          <Input
            type="date"
            value={dateRange.to || ''}
            onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
            className="rounded-2xl border-border/30 bg-white/50 h-10 px-4 focus:bg-white transition-all"
          />
        </div>
      </div>

      <div className="rounded-[2.5rem] border border-border/50 bg-white/60 backdrop-blur-md overflow-hidden shadow-xl shadow-navy/5">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-border/30">
                <th className="p-5 text-right text-xs font-black text-navy uppercase tracking-widest">
                  {displayColumnLabel || 'פריט'}
                </th>
                {config.metrics.map(metric => (
                  <th key={metric.id} className="p-5 text-center text-xs font-black text-navy uppercase tracking-widest">
                    {metric.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/10">
              {filteredPrimaryRecords.map((record, idx) => {
                const keyValue = record.data[config.primary_key_column_key]
                const displayValue = record.data[config.primary_display_column_key] ?? keyValue
                const rowKey = String(keyValue ?? record.id)
                return (
                  <tr key={rowKey} className="hover:bg-primary/5 transition-colors group">
                    <td className="p-4 text-right">
                      <div className="font-bold text-navy group-hover:text-primary transition-colors pr-1 border-r-2 border-transparent group-hover:border-primary">
                        {displayValue ?? '-'}
                      </div>
                    </td>
                    {config.metrics.map(metric => {
                      const value = metricResults.values[metric.id]?.[String(keyValue)] ?? 0
                      const isCount = metric.type === 'standard' && metric.operation === 'COUNT'
                      const display = isCount
                        ? value.toLocaleString('he-IL')
                        : `₪${value.toLocaleString('he-IL')}`
                      return (
                        <td key={metric.id} className="p-4 text-center">
                          <span className={`inline-block px-3 py-1 rounded-full text-sm font-black transition-all ${value > 0 ? 'bg-emerald/10 text-emerald' :
                            value < 0 ? 'bg-rose-500/10 text-rose-500' :
                              'bg-slate-100 text-slate-400'
                            }`}>
                            {display}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
              {filteredPrimaryRecords.length === 0 && (
                <tr>
                  <td colSpan={config.metrics.length + 1} className="p-12 text-center">
                    <div className="text-grey font-bold">אין נתונים להצגה</div>
                    <p className="text-xs text-grey/60 mt-1">נסה לשנות את מסנני החיפוש או התאריכים</p>
                  </td>
                </tr>
              )}
            </tbody>
            {filteredPrimaryRecords.length > 0 && (
              <tfoot>
                <tr className="bg-navy/5 border-t-2 border-border/50">
                  <td className="p-5 text-right">
                    <span className="text-xs font-black text-navy uppercase tracking-widest">סה&quot;כ</span>
                  </td>
                  {config.metrics.map(metric => {
                    const total = metricResults.totals[metric.id] ?? 0
                    const isCount = metric.type === 'standard' && metric.operation === 'COUNT'
                    const display = isCount
                      ? total.toLocaleString('he-IL')
                      : `₪${total.toLocaleString('he-IL')}`
                    return (
                      <td key={metric.id} className="p-5 text-center">
                        <span className="text-lg font-black text-navy" dir="ltr">
                          {display}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
