'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type PaginationState,
} from '@tanstack/react-table'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChatContextTrigger } from '@/components/chat/chat-context-trigger'
import { Plus, Trash2, Save, X, Search, Filter, Download, Copy, Edit3, CopyPlus, BarChart3, Upload, MessageSquarePlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { addRecord, updateRecordField, deleteRecord } from '@/lib/actions/data-records'
import type { ClientDataRecord, ColumnDefinition } from '@/lib/supabase'
import { useToast } from '@/components/ui/toast'
import { getAggregatedValue } from '@/lib/actions/aggregations'
import { evaluateFormulaExpression } from '@/lib/utils/formula-evaluator'
import { getLookupValue, getLookupOptions } from '@/lib/actions/relationships'
import { TableFilters } from '@/components/table-filters'
import { formatDateForCSV, parseDateFromCSV } from '@/lib/utils/date-utils'
import { CSVImportDialog } from '@/components/csv-import-dialog'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

interface DynamicDataTableProps {
  clientId: string
  moduleType: string
  records: ClientDataRecord[]
  columns: ColumnDefinition[]
  onRecordUpdate?: () => void
  onViewConfigChange?: (config: {
    visible_columns: string[]
    column_order: string[]
    filters: Record<string, any>
    sort_by?: string
    sort_direction?: 'asc' | 'desc'
  }) => void
  customView?: {
    visible_columns?: string[]
    column_order?: string[]
    filters?: Record<string, any>
    sort_by?: string
    sort_direction?: 'asc' | 'desc'
  } | null
  readOnly?: boolean
  highlightId?: string | null
  branchName?: string
}

interface EditableCell {
  recordId: string
  fieldName: string
  value: any
}

export function DynamicDataTable({
  clientId,
  moduleType,
  records,
  columns,
  onRecordUpdate,
  onViewConfigChange,
  customView,
  readOnly = false,
  highlightId,
  branchName
}: DynamicDataTableProps) {
  const { showToast } = useToast()
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')

  // Highlight effect
  useEffect(() => {
    if (highlightId && records.length > 0) {
      // We use a timeout to ensuring rendering is complete
      setTimeout(() => {
        const rowId = `row-${highlightId}`
        const element = document.getElementById(rowId)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
          element.classList.add('bg-blue-50')
          setTimeout(() => {
            element.classList.remove('bg-blue-50')
          }, 3000)
        }
      }, 500)
    }
  }, [highlightId, records.length])
  const [editingCell, setEditingCell] = useState<EditableCell | null>(null)
  const [editValue, setEditValue] = useState<any>('')
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [newRecordData, setNewRecordData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(false)
  const [calculatedValues, setCalculatedValues] = useState<Record<string, number>>({})
  const [calculating, setCalculating] = useState(false)
  const [lookupValues, setLookupValues] = useState<Record<string, Record<string, any>>>({})
  const [lookupOptions, setLookupOptions] = useState<Record<string, Array<{ value: any; label: string }>>>({})
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [showColumnFilters, setShowColumnFilters] = useState(false)
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })
  // Batch edit mode
  const [batchEditMode, setBatchEditMode] = useState(false)
  const [batchEditData, setBatchEditData] = useState<Record<string, Record<string, any>>>({})
  const [batchSaving, setBatchSaving] = useState(false)
  // Inline chart state
  const [showChart, setShowChart] = useState(false)
  const [chartXAxis, setChartXAxis] = useState<string>('')
  const [chartYAxis, setChartYAxis] = useState<string>('')
  // CSV import dialog state
  const [csvImportDialogOpen, setCSVImportDialogOpen] = useState(false)

  // Calculate formula values when columns or records change
  useEffect(() => {
    const calculateFormulas = async () => {
      const formulaColumns = columns.filter(col => col.type === 'formula' || col.type === 'reference')
      if (formulaColumns.length === 0) return

      setCalculating(true)
      try {
        const values: Record<string, number> = {}
        for (const col of formulaColumns) {
          if (col.formula) {
            const result = await getAggregatedValue(
              clientId,
              col.formula.target_module_name!,
              col.formula.target_column_key!,
              col.formula.operation!,
              col.formula.filter
            )
            if (result.success && result.value !== undefined) {
              values[col.name] = result.value
            }
          }
        }
        setCalculatedValues(values)
      } catch (error) {
        console.error('Error calculating formulas:', error)
      } finally {
        setCalculating(false)
      }
    }

    calculateFormulas()
  }, [columns, clientId, records])

  // Load lookup options and calculate lookup values when columns or records change
  useEffect(() => {
    const loadLookupData = async () => {
      const lookupColumns = columns.filter(col => col.type === 'lookup' && col.relationship)
      if (lookupColumns.length === 0) return

      try {
        // Load options for each lookup column
        const newLookupOptions: Record<string, Array<{ value: any; label: string }>> = {}
        for (const col of lookupColumns) {
          if (!col.relationship) continue
          const optionsResult = await getLookupOptions(clientId, col.relationship)
          if (optionsResult.success && optionsResult.options) {
            newLookupOptions[col.name] = optionsResult.options
          }
        }
        setLookupOptions(newLookupOptions)

        // Calculate display values for each record
        const newLookupValues: Record<string, Record<string, any>> = {}
        for (const record of records) {
          for (const col of lookupColumns) {
            if (!col.relationship) continue

            // Use source_column_key if specified, otherwise use the column name itself
            const sourceKey = col.relationship.source_column_key || col.name
            const sourceValue = record.data[sourceKey] ?? record.data[col.name]

            if (sourceValue !== null && sourceValue !== undefined) {
              const result = await getLookupValue(clientId, col.relationship, sourceValue)
              if (result.success && result.value !== undefined) {
                if (!newLookupValues[record.id]) {
                  newLookupValues[record.id] = {}
                }
                newLookupValues[record.id][col.name] = result.value
              }
            }
          }
        }

        setLookupValues(newLookupValues)
      } catch (error) {
        console.error('Error loading lookup data:', error)
      }
    }

    loadLookupData()
  }, [columns, clientId, records])

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }))
  }, [records, globalFilter, columnFilters, sorting])

  useEffect(() => {
    if (!customView) {
      setColumnFilters([])
      setSorting([])
      setGlobalFilter('')
      return
    }

    const filterEntries = customView.filters && typeof customView.filters === 'object'
      ? Object.entries(customView.filters)
      : []

    const nextFilters = filterEntries
      .filter(([, value]) => value !== null && value !== undefined && value !== '')
      .map(([id, value]) => ({ id, value }))

    setColumnFilters(nextFilters)

    if (customView.sort_by) {
      setSorting([{
        id: customView.sort_by,
        desc: customView.sort_direction === 'desc',
      }])
    } else {
      setSorting([])
    }
  }, [customView])

  // Apply custom view filtering/ordering
  const visibleColumns = useMemo(() => {
    if (customView?.visible_columns && customView.visible_columns.length > 0) {
      const visible = customView.visible_columns
      const ordered = customView.column_order || visible
      return columns.filter(col => visible.includes(col.name))
        .sort((a, b) => {
          const aIndex = ordered.indexOf(a.name)
          const bIndex = ordered.indexOf(b.name)
          return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex)
        })
    }
    return columns
  }, [columns, customView])

  useEffect(() => {
    if (!onViewConfigChange) return
    const filters: Record<string, any> = {}
    for (const filter of columnFilters) {
      filters[filter.id] = filter.value
    }
    const sort = sorting[0]
    onViewConfigChange({
      visible_columns: visibleColumns.map((col) => col.name),
      column_order: visibleColumns.map((col) => col.name),
      filters,
      sort_by: sort?.id,
      sort_direction: sort ? (sort.desc ? 'desc' : 'asc') : undefined,
    })
  }, [columnFilters, sorting, visibleColumns, onViewConfigChange])

  const columnValueOptions = useMemo(() => {
    const options: Record<string, string[]> = {}
    const maxUnique = 20
    for (const col of columns) {
      if (col.type === 'number' || col.type === 'date' || col.type === 'formula' || col.type === 'reference') {
        continue
      }
      const values = new Set<string>()
      for (const record of records) {
        const raw = record.data?.[col.name]
        if (raw === null || raw === undefined || raw === '') continue
        const value = String(raw).trim()
        if (!value) continue
        values.add(value)
        if (values.size > maxUnique) break
      }
      if (values.size > 0 && values.size <= maxUnique) {
        options[col.name] = Array.from(values).sort((a, b) => a.localeCompare(b, 'he'))
      }
    }
    return options
  }, [columns, records])

  const handleSaveEdit = useCallback(async (recordId: string, fieldName: string, moveToNext: boolean = false, value?: any) => {
    if (!editingCell) return

    setLoading(true)
    try {
      // Convert value based on column type
      const colDef = columns.find((col) => col.name === fieldName)
      const valueToProcess = value !== undefined ? value : editValue
      let processedValue: any = valueToProcess

      if (colDef?.type === 'number') {
        processedValue = valueToProcess === '' ? null : parseFloat(valueToProcess as string)
        if (isNaN(processedValue)) {
          showToast('error', 'ערך מספרי לא תקין')
          setLoading(false)
          return
        }
      } else if (colDef?.type === 'date' && valueToProcess) {
        const parsedDate = parseDateFromCSV(valueToProcess as string)
        if (!parsedDate) {
          showToast('error', 'פורמט תאריך לא חוקי. השתמש ב-DD/MM/YYYY')
          setLoading(false)
          return
        }
        processedValue = parsedDate.toISOString()
      } else if (colDef?.type === 'currency') {
        // Additional handling for currency if needed before save
        processedValue = typeof valueToProcess === 'string' ? parseFloat(valueToProcess.replace(/[^0-9.-]+/g, "")) : valueToProcess
        if (isNaN(processedValue)) {
          showToast('error', 'ערך מטבע לא תקין')
          setLoading(false)
          return
        }
      }

      const result = await updateRecordField(recordId, fieldName, processedValue)
      if (result.success) {
        showToast('success', 'השדה עודכן בהצלחה')

        if (moveToNext) {
          // Find current column index
          const currentColumnIndex = columns.findIndex(c => c.name === fieldName);
          // Find current row index
          const currentRowIndex = records.findIndex(r => r.id === recordId);

          if (currentColumnIndex !== -1 && currentRowIndex !== -1) {
            // Try to find the next editable column in the current row
            let nextColIndex = currentColumnIndex + 1;
            let nextRowIndex = currentRowIndex;
            let foundNext = false;

            while (nextRowIndex < records.length && !foundNext) {
              while (nextColIndex < columns.length) {
                const nextCol = columns[nextColIndex];
                const isEditable = !readOnly && nextCol.type !== 'formula' && nextCol.type !== 'calculated' && nextCol.type !== 'reference' && nextCol.type !== 'lookup';

                if (isEditable) {
                  const nextRecord = records[nextRowIndex];
                  const nextValue = nextRecord.data[nextCol.name];

                  setEditingCell({ recordId: nextRecord.id, fieldName: nextCol.name, value: nextValue });
                  const initialValue = nextCol.type === 'date' && nextValue ? formatDateForCSV(nextValue) : (nextValue ?? (nextCol.type === 'number' ? 0 : ''));
                  setEditValue(initialValue);
                  foundNext = true;
                  break;
                }
                nextColIndex++;
              }
              if (!foundNext) {
                nextRowIndex++;
                nextColIndex = 0; // Wrap around to first column of next row
              }
            }

            if (!foundNext) {
              setEditingCell(null); // Reached end of table
            }
          } else {
            setEditingCell(null)
          }
        } else {
          setEditingCell(null)
        }

        onRecordUpdate?.()
      } else {
        showToast('error', result.error || 'שגיאה בעדכון השדה')
      }
    } catch (error: any) {
      showToast('error', error.message || 'שגיאה בלתי צפויה')
    } finally {
      setLoading(false)
    }
  }, [editingCell, editValue, columns, showToast, onRecordUpdate, readOnly, records])

  const handleDelete = useCallback(async (recordId: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק רשומה זו?')) return

    setLoading(true)
    try {
      const result = await deleteRecord(recordId)
      if (result.success) {
        showToast('success', 'הרשומה נמחקה בהצלחה')
        onRecordUpdate?.()
      } else {
        showToast('error', result.error || 'שגיאה במחיקה')
      }
    } catch (error: any) {
      showToast('error', error.message || 'שגיאה בלתי צפויה')
    } finally {
      setLoading(false)
    }
  }, [showToast, onRecordUpdate])

  // Row duplication handler
  const handleDuplicate = useCallback(async (record: ClientDataRecord) => {
    setLoading(true)
    try {
      const dataCopy = { ...record.data }
      const result = await addRecord(clientId, moduleType, dataCopy)
      if (result.success) {
        showToast('success', 'הרשומה שוכפלה בהצלחה')
        onRecordUpdate?.()
      } else {
        showToast('error', result.error || 'שגיאה בשכפול')
      }
    } catch (error: any) {
      showToast('error', error.message || 'שגיאה בלתי צפויה')
    } finally {
      setLoading(false)
    }
  }, [clientId, moduleType, showToast, onRecordUpdate])

  // Batch edit handlers
  const handleBatchEditChange = useCallback((recordId: string, fieldName: string, value: any) => {
    setBatchEditData(prev => ({
      ...prev,
      [recordId]: {
        ...(prev[recordId] || {}),
        [fieldName]: value,
      },
    }))
  }, [])

  const handleBatchSaveAll = useCallback(async () => {
    const entries = Object.entries(batchEditData)
    if (entries.length === 0) {
      showToast('info', 'אין שינויים לשמירה')
      return
    }
    setBatchSaving(true)
    try {
      let successCount = 0
      for (const [recordId, fields] of entries) {
        for (const [fieldName, value] of Object.entries(fields)) {
          const colDef = columns.find(col => col.name === fieldName)
          let processedValue = value
          if (colDef?.type === 'number') {
            processedValue = value === '' ? null : parseFloat(value)
            if (isNaN(processedValue)) continue
          } else if (colDef?.type === 'date' && value) {
            const parsedDate = parseDateFromCSV(value)
            if (!parsedDate) continue
            processedValue = parsedDate.toISOString()
          }
          const result = await updateRecordField(recordId, fieldName, processedValue)
          if (result.success) successCount++
        }
      }
      showToast('success', `${successCount} שדות עודכנו בהצלחה`)
      setBatchEditData({})
      setBatchEditMode(false)
      onRecordUpdate?.()
    } catch (error: any) {
      showToast('error', error.message || 'שגיאה בשמירה מרובה')
    } finally {
      setBatchSaving(false)
    }
  }, [batchEditData, columns, showToast, onRecordUpdate])

  const handleBatchCancelAll = useCallback(() => {
    setBatchEditData({})
    setBatchEditMode(false)
  }, [])

  // Totals calculation for all filtered records
  const totalsRow = useMemo(() => {
    const numericColumns = visibleColumns.filter(col => col.type === 'number')
    if (numericColumns.length === 0) return null

    const totals: Record<string, { sum: number; count: number }> = {}
    numericColumns.forEach(col => {
      totals[col.name] = { sum: 0, count: 0 }
    })

    // Calculate over ALL records (not just current page)
    for (const record of records) {
      for (const col of numericColumns) {
        const val = record.data[col.name]
        if (val !== null && val !== undefined && val !== '') {
          const num = typeof val === 'number' ? val : parseFloat(String(val))
          if (!isNaN(num)) {
            totals[col.name].sum += num
            totals[col.name].count++
          }
        }
      }
    }
    return totals
  }, [records, visibleColumns])

  // Create table columns dynamically from schema
  const tableColumns = useMemo<ColumnDef<ClientDataRecord>[]>(() => {
    const cols: ColumnDef<ClientDataRecord>[] = visibleColumns.map((colDef) => ({
      id: colDef.name,
      accessorKey: `data.${colDef.name}`,
      header: colDef.label,
      cell: ({ row, getValue }) => {
        const record = row.original
        const isFormula = colDef.type === 'formula' || colDef.type === 'reference'
        const isCalculated = colDef.type === 'calculated'
        const isLookup = colDef.type === 'lookup'
        let value = record.data[colDef.name] ?? getValue()

        // Handle calculated columns (row-level formulas)
        if (isCalculated && colDef.formula?.expression) {
          try {
            value = evaluateFormulaExpression(colDef.formula.expression, record.data)
          } catch (error) {
            console.error('Error evaluating calculated column:', error)
            value = null
          }
        } else if (isFormula) {
          value = calculatedValues[colDef.name]
        } else if (isLookup && colDef.relationship) {
          // Use lookup value from cache
          value = lookupValues[record.id]?.[colDef.name] ?? record.data[colDef.name]
        }

        // Check if this cell is being edited
        const isEditing = !readOnly && !isFormula && !isCalculated && !isLookup && editingCell?.recordId === record.id && editingCell?.fieldName === colDef.name

        // For lookup columns, check if the source column is being edited
        const lookupSourceKey = isLookup && colDef.relationship ? (colDef.relationship.source_column_key || colDef.name) : null
        const isEditingLookup = isLookup && lookupSourceKey && editingCell?.recordId === record.id && editingCell?.fieldName === lookupSourceKey

        // Formula and calculated columns are read-only
        if (isFormula || isCalculated) {
          if (isFormula && calculating && calculatedValues[colDef.name] === undefined) {
            return (
              <div className="flex items-center gap-2 p-2">
                <div className="animate-spin h-4 w-4 border-2 border-emerald border-t-transparent rounded-full"></div>
                <span className="text-grey text-sm">מחשב...</span>
              </div>
            )
          }

          const displayValue = value !== undefined && value !== null ? (typeof value === 'number' ? value.toLocaleString('he-IL') : String(value)) : '-'
          const title = isCalculated ? "עמודה מחושבת - רק לקריאה" : "עמודת נוסחה - רק לקריאה"
          return (
            <div className="p-2 text-emerald font-medium flex items-center justify-center min-h-[2rem]" title={title}>
              <span
                className="line-clamp-2 break-words text-ellipsis overflow-hidden px-1"
                title={String(displayValue).length > 30 ? String(displayValue) : undefined}
              >
                {displayValue}
              </span>
            </div>
          )
        }

        // Lookup columns: editable with dropdown
        if (isLookup && colDef.relationship) {
          const sourceKey = colDef.relationship.source_column_key || colDef.name
          const foreignKeyValue = record.data[sourceKey] ?? record.data[colDef.name]
          const displayValue = lookupValues[record.id]?.[colDef.name] ?? foreignKeyValue ?? '-'
          const options = lookupOptions[colDef.name] || []

          if (isEditingLookup) {
            // Use native select temporarily to avoid Radix UI ref issues
            return (
              <div className="flex items-center gap-2">
                <select
                  value={String(foreignKeyValue ?? '')}
                  onChange={(e) => {
                    const sourceKey = colDef.relationship?.source_column_key || colDef.name
                    handleSaveEdit(record.id, sourceKey, false, e.target.value === '' ? null : e.target.value)
                  }}
                  className="w-48 p-2 border rounded text-center"
                  onBlur={() => setEditingCell(null)}
                  autoFocus
                >
                  <option value="">-- ללא ערך --</option>
                  {options.map((opt, idx) => (
                    <option key={idx} value={String(opt.value)}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingCell(null)}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )
          }

          return (
            <div
              className="cursor-pointer hover:bg-grey/10 p-2 rounded min-h-[2rem] flex items-center justify-center text-center text-emerald font-medium"
              onClick={() => {
                const sourceKey = colDef.relationship?.source_column_key || colDef.name
                setEditingCell({ recordId: record.id, fieldName: sourceKey, value: foreignKeyValue })
                setEditValue(foreignKeyValue ?? '')
              }}
              title={readOnly ? '' : "לחץ לעריכה"}
            >
              <span
                className="line-clamp-2 break-words text-ellipsis overflow-hidden px-1"
                title={String(displayValue).length > 30 ? String(displayValue) : undefined}
              >
                {displayValue}
              </span>
            </div>
          )
        }

        if (isEditing) {
          return (
            <div className="flex items-center justify-center gap-2">
              {colDef.type === 'date' ? (
                <Input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => handleSaveEdit(record.id, colDef.name, false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit(record.id, colDef.name, true)
                    if (e.key === 'Tab') { e.preventDefault(); handleSaveEdit(record.id, colDef.name, true) }
                    if (e.key === 'Escape') setEditingCell(null)
                  }}
                  placeholder="DD/MM/YYYY"
                  autoFocus
                  className="w-32 text-center"
                />
              ) : colDef.type === 'currency' ? (
                <Input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => handleSaveEdit(record.id, colDef.name, false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit(record.id, colDef.name, true)
                    if (e.key === 'Tab') { e.preventDefault(); handleSaveEdit(record.id, colDef.name, true) }
                    if (e.key === 'Escape') setEditingCell(null)
                  }}
                  placeholder="₪0.00"
                  autoFocus
                  className="w-32 text-center"
                  dir="ltr"
                />
              ) : colDef.type === 'number' ? (
                <Input
                  type="number"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  onBlur={() => handleSaveEdit(record.id, colDef.name, false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit(record.id, colDef.name, true)
                    if (e.key === 'Tab') { e.preventDefault(); handleSaveEdit(record.id, colDef.name, true) }
                    if (e.key === 'Escape') setEditingCell(null)
                  }}
                  autoFocus
                  className="w-32 text-center"
                />
              ) : (
                <Input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => handleSaveEdit(record.id, colDef.name)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit(record.id, colDef.name, true)
                    if (e.key === 'Tab') { e.preventDefault(); handleSaveEdit(record.id, colDef.name, true) }
                    if (e.key === 'Escape') setEditingCell(null)
                  }}
                  autoFocus
                  className="min-w-48 text-center"
                />
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleSaveEdit(record.id, colDef.name)}
                className="h-6 w-6 p-0"
              >
                <Save className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditingCell(null)}
                className="h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )
        }

        // Format value based on type
        let displayValue: string = ''
        if (value === null || value === undefined) {
          displayValue = '-'
        } else if (colDef.type === 'date' && value) {
          displayValue = formatDateForCSV(value)
        } else if (colDef.type === 'number') {
          displayValue = typeof value === 'number' ? value.toLocaleString('he-IL') : String(value)
        } else if (colDef.type === 'currency') {
          const numValue = typeof value === 'number' ? value : parseFloat(String(value))
          displayValue = isNaN(numValue) ? String(value) : `₪${numValue.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        } else if (colDef.type === 'calculated' && colDef.formula) {
          // Calculated columns are handled above, but this ensures they don't fall through to String(value)
          // If value is already calculated, use it directly.
          displayValue = value !== undefined && value !== null ? (typeof value === 'number' ? value.toLocaleString('he-IL') : String(value)) : '-'
        } else {
          displayValue = String(value)
        }

        // Apply conditional formatting
        let cellStyle: React.CSSProperties = {}
        let isEditable = !readOnly && !isFormula && !isCalculated
        let cellClassName = `p-2 rounded min-h-[2rem] flex items-center justify-center text-center transition-colors ${isEditable
          ? 'cursor-text hover:bg-slate-50 border border-transparent hover:border-slate-200 group relative'
          : ''
          }`

        if (colDef.conditionalFormatting && colDef.conditionalFormatting.length > 0) {
          for (const rule of colDef.conditionalFormatting) {
            let conditionMet = false
            const numValue = typeof value === 'number' ? value : parseFloat(String(value))
            const ruleValue = typeof rule.value === 'number' ? rule.value : parseFloat(String(rule.value))

            switch (rule.condition) {
              case 'gt':
                conditionMet = !isNaN(numValue) && !isNaN(ruleValue) && numValue > ruleValue
                break
              case 'lt':
                conditionMet = !isNaN(numValue) && !isNaN(ruleValue) && numValue < ruleValue
                break
              case 'gte':
                conditionMet = !isNaN(numValue) && !isNaN(ruleValue) && numValue >= ruleValue
                break
              case 'lte':
                conditionMet = !isNaN(numValue) && !isNaN(ruleValue) && numValue <= ruleValue
                break
              case 'eq':
                conditionMet = value == rule.value
                break
              case 'contains':
                conditionMet = String(value).toLowerCase().includes(String(rule.value).toLowerCase())
                break
            }

            if (conditionMet) {
              if (rule.backgroundColor) {
                cellStyle.backgroundColor = rule.backgroundColor
              }
              if (rule.textColor) {
                cellStyle.color = rule.textColor
              }
              if (rule.fontWeight) {
                cellStyle.fontWeight = rule.fontWeight
              }
              break // Use first matching rule
            }
          }
        }

        return (
          <div
            className={cellClassName}
            style={cellStyle}
            tabIndex={isEditable ? 0 : undefined}
            onClick={() => {
              if (isEditable) {
                setEditingCell({ recordId: record.id, fieldName: colDef.name, value })
                const initialValue = colDef.type === 'date' && value ? formatDateForCSV(value) : (value ?? (colDef.type === 'number' ? 0 : ''))
                setEditValue(initialValue)
              }
            }}
            onKeyDown={(e) => {
              if (isEditable && e.key === 'Enter') {
                e.preventDefault()
                setEditingCell({ recordId: record.id, fieldName: colDef.name, value })
                const initialValue = colDef.type === 'date' && value ? formatDateForCSV(value) : (value ?? (colDef.type === 'number' ? 0 : ''))
                setEditValue(initialValue)
              }
            }}
          >
            <span
              className="line-clamp-2 break-words text-ellipsis overflow-hidden px-1"
              title={String(displayValue).length > 30 ? String(displayValue) : undefined}
            >
              {displayValue}
            </span>
            {isEditable && (
              <Edit3 className="absolute left-2 h-3 w-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </div>
        )
      },
    }))

    // Add checkbox column at the beginning
    if (!readOnly) {
      cols.unshift({
        id: 'select',
        accessorFn: (row) => row.id,
        header: '✓',
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={selectedRows.has(row.original.id)}
            onChange={() => {
              const newSelected = new Set(selectedRows)
              if (newSelected.has(row.original.id)) {
                newSelected.delete(row.original.id)
              } else {
                newSelected.add(row.original.id)
              }
              setSelectedRows(newSelected)
            }}
            className="cursor-pointer"
          />
        ),
        enableSorting: false,
        enableColumnFilter: false,
      })
    }

    // Add actions column (edit/delete for admin, chat for everyone/client)
    cols.push({
      id: 'actions',
      header: 'פעולות',
      cell: ({ row }) => {
        // Try to find a meaningful name for the record
        const nameCol = columns.find(c => c.name.toLowerCase().includes('name') || c.name.toLowerCase().includes('title') || c.name.includes('שם') || c.name.includes('כותרת')) || columns.find(c => c.type === 'text') || columns[0]
        const recordValue = nameCol ? row.original.data[nameCol.name] : ''
        const recordName = recordValue ? String(recordValue) : `רשומה ${row.original.id.substring(0, 4)}`

        return (
          <div className="flex items-center gap-1 justify-center">
            <ChatContextTrigger
              type="module"
              id={row.original.id}
              name={`${moduleType}: ${recordName}`}
              data={{ ...(row.original.data || {}), id: row.original.id }}
              navData={{
                tab: 'module',
                subTab: branchName || 'ראשי', // Top-level tab (Branch)
                innerTab: moduleType, // Inner/Module tab
                id: row.original.id
              }}
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-blue-500 hover:text-blue-700 hover:bg-blue-50"
              icon={<MessageSquarePlus className="h-4 w-4" />}
            />
            {!readOnly && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDuplicate(row.original)}
                  className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  title="שכפל רשומה"
                >
                  <CopyPlus className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(row.original.id)}
                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                  title="מחק רשומה"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        )
      },
    })

    return cols as any
  }, [visibleColumns, columns, readOnly, selectedRows, clientId, moduleType, branchName, calculatedValues, calculating, lookupValues, lookupOptions, handleSaveEdit, handleDelete, handleDuplicate, batchEditMode, batchEditData, handleBatchEditChange])

  const handleAddNew = async () => {
    if (columns.length === 0) {
      showToast('error', 'אין עמודות מוגדרות. אנא הגדר סכמה תחילה.')
      return
    }

    setLoading(true)
    try {
      // Build data object with defaults
      const data: Record<string, any> = {}
      columns.forEach((col) => {
        // Skip formula, reference, and calculated columns
        if (col.type === 'formula' || col.type === 'reference' || col.type === 'calculated') {
          return
        }

        // Handle lookup columns - use source_column_key if defined
        if (col.type === 'lookup' && col.relationship) {
          const sourceKey = col.relationship.source_column_key || col.name
          if (newRecordData[sourceKey] !== undefined && newRecordData[sourceKey] !== null && newRecordData[sourceKey] !== '') {
            data[sourceKey] = newRecordData[sourceKey]
          }
          return
        }

        // Regular columns
        if (newRecordData[col.name] !== undefined && newRecordData[col.name] !== '') {
          data[col.name] = newRecordData[col.name]
        } else if (col.default !== undefined) {
          data[col.name] = col.default
        } else if (col.type === 'date') {
          data[col.name] = new Date().toISOString().split('T')[0] // Just the date part
        } else if (col.type === 'number') {
          // Don't set default 0, leave empty
        } else {
          // Don't set default empty string
        }
      })

      const result = await addRecord(clientId, moduleType, data)
      if (result.success) {
        showToast('success', 'רשומה חדשה נוספה בהצלחה')
        setIsAddingNew(false)
        setNewRecordData({})
        onRecordUpdate?.()
      } else {
        showToast('error', result.error || 'שגיאה בהוספת רשומה')
      }
    } catch (error: any) {
      showToast('error', error.message || 'שגיאה בלתי צפויה')
    } finally {
      setLoading(false)
    }
  }


  const table = useReactTable({
    data: records,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: 'includesString',
  })

  const handleExportCSV = () => {
    const headers = columns.map(col => col.label).join(',')
    const rows = table.getFilteredRowModel().rows.map(row => {
      return columns.map(col => {
        const value = row.original.data[col.name]
        if (value === null || value === undefined) return ''
        if (col.type === 'date') {
          return formatDateForCSV(value)
        }
        return String(value).replace(/,/g, ';') // Replace commas to avoid CSV issues
      }).join(',')
    })

    const csvContent = [headers, ...rows].join('\n')
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' }) // BOM for Hebrew
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${moduleType}_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    showToast('success', 'הקובץ יוצא בהצלחה')
  }

  const handleBulkDelete = async () => {
    if (selectedRows.size === 0) return
    const count = selectedRows.size
    if (!confirm(`האם אתה בטוח שברצונך למחוק ${count} רשומות?`)) return

    setLoading(true)
    try {
      const deletePromises = Array.from(selectedRows).map(id => deleteRecord(id))
      const results = await Promise.all(deletePromises)
      const successCount = results.filter(r => r.success).length
      setSelectedRows(new Set())
      showToast('success', `${successCount} רשומות נמחקו בהצלחה`)
      onRecordUpdate?.()
    } catch (error: any) {
      showToast('error', error.message || 'שגיאה במחיקה מרובה')
    } finally {
      setLoading(false)
    }
  }

  // Update checkbox header in tableColumns
  const tableColumnsWithHeader = useMemo(() => {
    const cols = [...tableColumns]
    const selectCol = cols.find(col => col.id === 'select')
    if (selectCol) {
      const selectIndex = cols.indexOf(selectCol)
      const updatedCol: any = {
        ...selectCol,
        header: ({ table }: any) => {
          const allSelected = table.getFilteredRowModel().rows.length > 0 &&
            table.getFilteredRowModel().rows.every((row: any) => selectedRows.has(row.original.id))
          return (
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => {
                const visibleRows = table.getFilteredRowModel().rows
                if (allSelected) {
                  setSelectedRows(new Set())
                } else {
                  setSelectedRows(new Set(visibleRows.map((row: any) => row.original.id)))
                }
              }}
              className="cursor-pointer"
            />
          )
        },
      }
      cols[selectIndex] = updatedCol
    }
    return cols as any
  }, [tableColumns, selectedRows, setSelectedRows])

  const tableFinal = useReactTable({
    data: records,
    columns: tableColumnsWithHeader,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: {
      sorting,
      columnFilters,
      globalFilter,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    globalFilterFn: 'includesString',
  })

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="bg-white/40 backdrop-blur-md p-6 rounded-[2.5rem] border border-border/50 shadow-sm space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xl font-black text-navy tracking-tight">רשומות נתונים</h3>
              <p className="text-xs font-medium text-grey">נהל רשומות, ערוך שדות ובצע פעולות מרובות</p>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap items-center">
            {selectedRows.size > 0 && (
              <Button
                variant="destructive"
                onClick={handleBulkDelete}
                disabled={loading}
                className="gap-2 rounded-xl px-4 h-10 font-black shadow-lg shadow-rose-500/10"
              >
                <Trash2 className="h-4 w-4" />
                מחק {selectedRows.size}
              </Button>
            )}

            {batchEditMode ? (
              <div className="flex gap-2 bg-slate-100/50 p-1 rounded-2xl border border-slate-200/50">
                <Button
                  onClick={handleBatchSaveAll}
                  disabled={batchSaving || Object.keys(batchEditData).length === 0}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-9 px-4 font-black shadow-lg shadow-emerald-500/10"
                >
                  <Save className="h-4 w-4" />
                  שמור {Object.keys(batchEditData).length}
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleBatchCancelAll}
                  disabled={batchSaving}
                  className="rounded-xl h-9 px-4 font-black text-grey"
                >
                  <X className="h-4 w-4" />
                  ביטול
                </Button>
              </div>
            ) : (
              !readOnly && (
                <Button
                  variant="outline"
                  onClick={() => setBatchEditMode(true)}
                  disabled={records.length === 0}
                  className="gap-2 rounded-xl h-10 px-4 font-black border-border/50 hover:bg-white shadow-sm"
                >
                  <Edit3 className="h-4 w-4 text-primary" />
                  עריכה מרובה
                </Button>
              )
            )}

            <div className="w-px h-6 bg-border/30 mx-1 hidden sm:block" />

            <Button
              variant="outline"
              size="icon"
              onClick={handleExportCSV}
              className="rounded-xl h-10 w-10 border-border/50 hover:bg-white shadow-sm"
              title="ייצוא ל-CSV"
            >
              <Download className="h-4 w-4 text-navy" />
            </Button>
            {!readOnly && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCSVImportDialogOpen(true)}
                className="rounded-xl h-10 w-10 border-border/50 hover:bg-white shadow-sm"
                title="ייבוא מ-CSV"
              >
                <Upload className="h-4 w-4 text-navy" />
              </Button>
            )}
            {!readOnly && (
              <Button
                onClick={() => setIsAddingNew(true)}
                disabled={loading}
                className="gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black px-6 h-10 shadow-lg shadow-blue-500/20"
              >
                <Plus className="h-4 w-4" />
                הוסף רשומה
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-grey pointer-events-none" />
            <Input
              placeholder="חיפוש חופשי בכל הטבלה..."
              value={globalFilter ?? ''}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="w-full pr-11 h-12 rounded-[1.25rem] border-border/30 bg-white/50 focus:bg-white transition-all font-bold"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowColumnFilters(!showColumnFilters)}
              className={cn(
                "gap-2 rounded-[1.25rem] h-12 px-6 font-black border-border/30 shadow-sm transition-all",
                showColumnFilters ? "bg-blue-600 text-white border-blue-600" : "bg-white/50 hover:bg-white"
              )}
            >
              <Filter className="h-4 w-4" />
              סינונים מתקדמים
              {columnFilters.length > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-primary text-[10px] font-black">
                  {columnFilters.length}
                </span>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowChart(!showChart)}
              className={cn(
                "gap-2 rounded-[1.25rem] h-12 px-6 font-black border-border/30 shadow-sm transition-all",
                showChart ? "bg-blue-500 text-white border-blue-500" : "bg-white/50 hover:bg-white"
              )}
            >
              <BarChart3 className="h-4 w-4" />
              גרף
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <TableFilters
        columns={columns}
        columnFilters={columnFilters}
        globalFilter={globalFilter || ''}
        onColumnFiltersChange={setColumnFilters}
        onGlobalFilterChange={setGlobalFilter}
        showFilters={showColumnFilters}
        onToggleFilters={() => setShowColumnFilters(!showColumnFilters)}
        columnValueOptions={columnValueOptions}
      />

      {/* Inline Chart Panel */}
      {showChart && (
        <Card className="p-6 bg-blue-50/30 border-blue-200 rounded-[2.5rem] overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-100 text-blue-600">
                <BarChart3 className="h-5 w-5" />
              </div>
              <h4 className="font-black text-navy uppercase tracking-tight">תצוגת גרף מהירה</h4>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowChart(false)} className="rounded-full">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-6 mb-8 flex-wrap">
            <div className="space-y-1.5 min-w-[200px] flex-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-grey mr-1">ציר X (קיבוץ)</label>
              <select
                value={chartXAxis}
                onChange={(e) => setChartXAxis(e.target.value)}
                className="w-full h-11 rounded-xl border-border/40 bg-white/70 px-4 font-bold text-sm focus:bg-white transition-all outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">בחר עמודה</option>
                {columns.filter(c => c.type === 'text' || c.type === 'date').map(c => (
                  <option key={c.name} value={c.name}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 min-w-[200px] flex-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-grey mr-1">ציר Y (ערך)</label>
              <select
                value={chartYAxis}
                onChange={(e) => setChartYAxis(e.target.value)}
                className="w-full h-11 rounded-xl border-border/40 bg-white/70 px-4 font-bold text-sm focus:bg-white transition-all outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">בחר עמודה</option>
                {columns.filter(c => c.type === 'number' || c.type === 'currency' || c.type === 'calculated').map(c => (
                  <option key={c.name} value={c.name}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
          {chartXAxis && chartYAxis && (() => {
            // Aggregate data by X axis value
            const grouped: Record<string, number> = {}
            records.forEach(record => {
              let xVal = record.data[chartXAxis]
              if (xVal === null || xVal === undefined) return
              const xCol = columns.find(c => c.name === chartXAxis)
              if (xCol?.type === 'date' && xVal) {
                try {
                  const d = new Date(xVal)
                  xVal = d.toLocaleDateString('he-IL', { year: 'numeric', month: '2-digit' })
                } catch { }
              }
              const key = String(xVal)
              const rawY = record.data[chartYAxis]
              const yVal = typeof rawY === 'number' ? rawY : parseFloat(String(rawY || 0).replace(/[₪,]/g, ''))
              if (!isNaN(yVal)) {
                grouped[key] = (grouped[key] || 0) + yVal
              }
            })
            const chartData = Object.entries(grouped).map(([x, y]) => ({ name: x, value: y })).slice(0, 50)
            const yLabel = columns.find(c => c.name === chartYAxis)?.label || chartYAxis
            if (chartData.length === 0) {
              return <p className="text-sm text-grey text-center py-8 bg-white/50 rounded-2xl border-2 border-dashed border-border/30">אין נתונים מספריים להצגה בצירי הבחירה</p>
            }
            return (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-border/50" style={{ width: '100%', height: 350 }}>
                <ResponsiveContainer>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700, fill: '#64748B' }} axisLine={false} tickLine={false} dy={10} />
                    <YAxis tick={{ fontSize: 11, fontWeight: 700, fill: '#64748B' }} axisLine={false} tickLine={false} tickFormatter={(val) => `₪${val.toLocaleString()}`} />
                    <Tooltip cursor={{ fill: '#F8FAFC' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} formatter={(val: number) => [`₪${val.toLocaleString('he-IL')}`, yLabel]} />
                    <Bar dataKey="value" name={yLabel} fill="#3B82F6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )
          })()}
        </Card>
      )}

      {/* Add New Row Form */}
      {isAddingNew && (
        <Card className="p-8 bg-primary/5 border-primary/20 rounded-[2.5rem] relative overflow-hidden animate-fade-in-up">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full -mr-16 -mt-16 blur-3xl" />
          <div className="flex items-center gap-3 mb-6 relative z-10">
            <div className="p-2.5 rounded-xl bg-primary/20 text-primary">
              <Plus className="h-5 w-5" />
            </div>
            <h4 className="font-black text-navy uppercase tracking-tight">הוספת רשומה חדשה ל-{moduleType}</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-8 relative z-10">
            {columns.map((col) => {
              if (col.type === 'formula' || col.type === 'reference' || col.type === 'calculated') {
                return null
              }

              if (col.type === 'lookup' && col.relationship) {
                const sourceKey = col.relationship.source_column_key || col.name
                const options = lookupOptions[col.name] || []
                const selectId = `new-record-${sourceKey}-${moduleType}`

                return (
                  <div key={`${col.name}-${moduleType}-lookup`} className="space-y-1.5">
                    <label htmlFor={selectId} className="text-[10px] font-black uppercase tracking-widest text-grey mr-1">{col.label}</label>
                    <select
                      id={selectId}
                      value={newRecordData[sourceKey] || ''}
                      onChange={(e) =>
                        setNewRecordData({
                          ...newRecordData,
                          [sourceKey]: e.target.value === '' ? null : e.target.value,
                        })
                      }
                      className="w-full h-11 rounded-xl border-border/40 bg-white px-4 font-bold text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                    >
                      <option value="">-- בחר ערך --</option>
                      {options.map((opt, idx) => (
                        <option key={idx} value={String(opt.value)}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              }

              const inputId = `new-record-${col.name}-${moduleType}`
              return (
                <div key={`${col.name}-${moduleType}`} className="space-y-1.5">
                  <label htmlFor={inputId} className="text-[10px] font-black uppercase tracking-widest text-grey mr-1">{col.label}</label>
                  {col.type === 'date' ? (
                    <Input
                      id={inputId}
                      type="date"
                      value={newRecordData[col.name] || ''}
                      onChange={(e) =>
                        setNewRecordData({ ...newRecordData, [col.name]: e.target.value })
                      }
                      className="h-11 rounded-xl border-border/40 bg-white font-bold"
                    />
                  ) : col.type === 'number' || col.type === 'currency' ? (
                    <Input
                      id={inputId}
                      type="text"
                      value={newRecordData[col.name] !== undefined && newRecordData[col.name] !== null
                        ? (col.type === 'currency' ? `₪${newRecordData[col.name].toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : String(newRecordData[col.name]))
                        : ''}
                      onChange={(e) => {
                        let val: string | number | null = e.target.value
                        if (col.type === 'currency' || col.type === 'number') {
                          const cleanValue = val.toString().replace(/[₪,]/g, '').trim()
                          const num = parseFloat(cleanValue)
                          val = isNaN(num) ? '' : num
                        }
                        setNewRecordData({
                          ...newRecordData,
                          [col.name]: val,
                        })
                      }}
                      dir={col.type === 'currency' ? 'ltr' : 'auto'}
                      placeholder={col.type === 'currency' ? '₪0.00' : ''}
                      className="h-11 rounded-xl border-border/40 bg-white font-bold"
                    />
                  ) : (
                    <Input
                      id={inputId}
                      type="text"
                      value={newRecordData[col.name] || ''}
                      onChange={(e) =>
                        setNewRecordData({ ...newRecordData, [col.name]: e.target.value })
                      }
                      className="h-11 rounded-xl border-border/40 bg-white font-bold"
                    />
                  )}
                </div>
              )
            })}
          </div>
          <div className="flex gap-3 relative z-10">
            <Button onClick={handleAddNew} disabled={loading} className="rounded-xl h-12 px-8 bg-blue-600 hover:bg-blue-700 text-white font-black shadow-lg shadow-blue-500/20">
              <Save className="h-5 w-5 ml-2" />
              שמור רשומה
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setIsAddingNew(false)
                setNewRecordData({})
              }}
              className="rounded-xl h-12 px-8 font-black text-grey"
            >
              ביטול
            </Button>
          </div>
        </Card>
      )}

      {/* Table Container */}
      <div className="bg-white/70 backdrop-blur-xl border border-border/50 rounded-[2.5rem] shadow-xl shadow-navy/5 overflow-hidden">
        <div className="overflow-x-auto selection-table-container max-h-[800px] relative">
          <table className="w-full border-collapse border-spacing-0">
            <thead className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur-md shadow-sm">
              {tableFinal.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-border/50">
                  {headerGroup.headers.map((header, index) => {
                    const isFirst = index === 0;
                    const isLast = index === headerGroup.headers.length - 1;
                    const isCheckbox = header.id === 'select';
                    const isActions = header.id === 'actions';

                    let stickyClasses = '';
                    if (isCheckbox) stickyClasses = 'sticky right-0 z-40 bg-slate-50/95 shadow-[1px_0_0_0_rgba(0,0,0,0.05)]';
                    else if (isActions) stickyClasses = 'sticky left-0 z-40 bg-slate-50/95 shadow-[-1px_0_0_0_rgba(0,0,0,0.05)]';
                    else if (isFirst) stickyClasses = 'sticky right-0 z-40 bg-slate-50/95 shadow-[1px_0_0_0_rgba(0,0,0,0.05)]';

                    return (
                      <th
                        key={header.id}
                        className={`p-4 text-center text-[10px] font-black uppercase tracking-widest text-grey whitespace-nowrap ${stickyClasses}`}
                        style={{ cursor: header.column.getCanSort() ? 'pointer' : 'default' }}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <div className="flex items-center justify-center gap-1">
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                          {{
                            asc: ' ↑',
                            desc: ' ↓',
                          }[header.column.getIsSorted() as string] ?? ''}
                        </div>
                      </th>
                    )
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {loading ? (
                // Skeleton Loader Rows
                Array.from({ length: 5 }).map((_, rowIndex) => (
                  <tr key={`skeleton-${rowIndex}`} className="border-b border-border/30">
                    {tableFinal.getVisibleLeafColumns().map((column, colIndex) => {
                      const isFirst = colIndex === 0;
                      const isLast = colIndex === tableFinal.getVisibleLeafColumns().length - 1;
                      const isCheckbox = column.id === 'select';
                      const isActions = column.id === 'actions';

                      let stickyClasses = '';
                      if (isCheckbox) stickyClasses = 'sticky right-0 z-20 bg-white shadow-[1px_0_0_0_rgba(0,0,0,0.05)]';
                      else if (isActions) stickyClasses = 'sticky left-0 z-20 bg-white shadow-[-1px_0_0_0_rgba(0,0,0,0.05)]';
                      else if (isFirst) stickyClasses = 'sticky right-0 z-20 bg-white shadow-[1px_0_0_0_rgba(0,0,0,0.05)]';

                      return (
                        <td key={`skeleton-col-${rowIndex}-${colIndex}`} className={`p-4 bg-white/70 backdrop-blur-sm ${stickyClasses}`}>
                          <div className="flex items-center justify-center min-h-[40px]">
                            <div className={`h-6 bg-slate-200/50 rounded-lg animate-pulse ${column.id === 'select' || column.id === 'actions' ? 'w-8' : 'w-3/4 max-w-[120px]'
                              }`} />
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))
              ) : (
                tableFinal.getRowModel().rows.map((row) => {
                  const recordId = row.original.id
                  return (
                    <tr key={row.id} className={cn(
                      "border-b border-border/30 transition-colors duration-200 group relative",
                      batchEditData[recordId] ? "bg-amber-50/50" : "hover:bg-slate-50/50"
                    )}>
                      {row.getVisibleCells().map((cell, colIndex) => {
                        const isFirst = colIndex === 0;
                        const isLast = colIndex === row.getVisibleCells().length - 1;
                        const isCheckbox = cell.column.id === 'select';
                        const isActions = cell.column.id === 'actions';

                        let stickyClasses = '';
                        // When hovering the row we want the sticky columns to match the hover background
                        // We use group-hover for this effect
                        const bgClass = batchEditData[recordId] ? "bg-amber-50" : "bg-white/70 backdrop-blur-sm group-hover:bg-slate-50/90";

                        if (isCheckbox) stickyClasses = `sticky right-0 z-20 ${bgClass} shadow-[1px_0_0_0_rgba(0,0,0,0.05)]`;
                        else if (isActions) stickyClasses = `sticky left-0 z-20 ${bgClass} shadow-[-1px_0_0_0_rgba(0,0,0,0.05)]`;
                        else if (isFirst) stickyClasses = `sticky right-0 z-20 ${bgClass} shadow-[1px_0_0_0_rgba(0,0,0,0.05)]`;

                        if (batchEditMode && cell.column.id !== 'select' && cell.column.id !== 'actions') {
                          const colDef = visibleColumns.find(c => c.name === cell.column.id)
                          if (colDef && colDef.type !== 'formula' && colDef.type !== 'reference' && colDef.type !== 'calculated' && colDef.type !== 'lookup') {
                            const currentVal = batchEditData[recordId]?.[colDef.name] ?? row.original.data[colDef.name] ?? ''
                            const isChanged = batchEditData[recordId]?.[colDef.name] !== undefined
                            return (
                              <td key={cell.id} className={`p-2 text-center ${stickyClasses}`}>
                                <Input
                                  type={colDef.type === 'number' ? 'number' : colDef.type === 'date' ? 'date' : 'text'}
                                  value={currentVal}
                                  onChange={(e) => {
                                    const val = colDef.type === 'number' ? (e.target.value === '' ? '' : parseFloat(e.target.value)) : e.target.value
                                    handleBatchEditChange(recordId, colDef.name, val)
                                  }}
                                  className={cn(
                                    "text-center text-sm h-10 rounded-xl font-bold transition-all",
                                    isChanged ? "border-amber-400 bg-amber-50 shadow-sm" : "border-transparent bg-transparent hover:bg-white hover:border-slate-200"
                                  )}
                                />
                              </td>
                            )
                          }
                        }
                        return (
                          <td key={cell.id} className={`p-4 text-center ${stickyClasses}`}>
                            <div className="flex items-center justify-center min-h-[40px]">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })
              )}
            </tbody>
            {/* Totals Row */}
            {totalsRow && records.length > 0 && (
              <tfoot className="sticky bottom-0 z-30 shadow-[0_-1px_0_0_rgba(0,0,0,0.05)]">
                <tr className="bg-slate-50/95 backdrop-blur-md">
                  {tableFinal.getHeaderGroups()[0]?.headers.map((header, index) => {
                    const isFirst = index === 0;
                    const isLast = index === tableFinal.getHeaderGroups()[0]?.headers.length - 1;
                    const isCheckbox = header.id === 'select';
                    const isActions = header.id === 'actions';

                    let stickyClasses = '';
                    if (isCheckbox) stickyClasses = 'sticky right-0 z-40 bg-slate-50/95 shadow-[1px_0_0_0_rgba(0,0,0,0.05)]';
                    else if (isActions) stickyClasses = 'sticky left-0 z-40 bg-slate-50/95 shadow-[-1px_0_0_0_rgba(0,0,0,0.05)]';
                    else if (isFirst) stickyClasses = 'sticky right-0 z-40 bg-slate-50/95 shadow-[1px_0_0_0_rgba(0,0,0,0.05)]';

                    if (header.id === 'select') return <td key={header.id} className={`p-4 text-center text-sm font-black text-grey ${stickyClasses}`}>Σ</td>
                    if (header.id === 'actions') return <td key={header.id} className={`p-4 ${stickyClasses}`}></td>
                    const colDef = visibleColumns.find(c => c.name === header.id)
                    if (colDef && totalsRow[colDef.name]) {
                      const { sum, count } = totalsRow[colDef.name]
                      return (
                        <td key={header.id} className={`p-4 text-center ${stickyClasses}`}>
                          <div className="text-sm font-black text-navy" dir="ltr">₪{sum.toLocaleString()}</div>
                          <div className="text-[10px] font-bold text-grey uppercase tracking-tighter">ממוצע: {count > 0 ? (sum / count).toLocaleString('he-IL', { maximumFractionDigits: 1 }) : '-'}</div>
                        </td>
                      )
                    }
                    return <td key={header.id} className={`p-4 ${stickyClasses}`}></td>
                  })}
                </tr>
              </tfoot>
            )}
          </table>

          {records.length === 0 && !isAddingNew && (
            <div className="py-24 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="h-8 w-8 text-slate-300" />
              </div>
              <p className="text-navy font-black text-lg">אין רשומות להצגה</p>
              <p className="text-sm text-grey font-medium mt-1">נסה לשנות את הסינון או להוסיף רשומה חדשה</p>
            </div>
          )}
        </div>

        {/* Pagination bar */}
        {records.length > 0 && (
          <div className="p-6 border-t border-border/30 flex flex-wrap items-center justify-between gap-6 bg-slate-50/30">
            <div className="flex items-center gap-6">
              <div className="text-xs font-bold text-grey bg-white px-4 py-2 rounded-full border border-border/50 shadow-xs">
                מציג <span className="text-navy">{pagination.pageIndex * pagination.pageSize + 1}</span>
                - <span className="text-navy">{Math.min(pagination.pageIndex * pagination.pageSize + tableFinal.getRowModel().rows.length, tableFinal.getFilteredRowModel().rows.length)}</span>
                מתוך <span className="text-navy font-black uppercase ml-1">{tableFinal.getFilteredRowModel().rows.length}</span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-grey">שורות לעמוד:</span>
                <Select
                  value={String(pagination.pageSize)}
                  onValueChange={(value) => setPagination((prev) => ({ ...prev, pageIndex: 0, pageSize: Number(value) }))}
                >
                  <SelectTrigger className="w-[80px] h-9 rounded-xl font-bold bg-white border-border/50 focus:ring-primary/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border/50 shadow-xl">
                    {[10, 20, 50, 100].map((size) => (
                      <SelectItem key={size} value={String(size)} className="font-bold">{size}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => tableFinal.previousPage()}
                disabled={!tableFinal.getCanPreviousPage()}
                className="rounded-xl font-black h-10 px-4 border-border/50 bg-white hover:bg-slate-50"
              >
                קודם
              </Button>
              <div className="flex items-center justify-center min-w-[100px] h-10 bg-white rounded-xl border border-border/50 text-xs font-black text-navy px-4">
                עמוד {pagination.pageIndex + 1} מתוך {tableFinal.getPageCount()}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => tableFinal.nextPage()}
                disabled={!tableFinal.getCanNextPage()}
                className="rounded-xl font-black h-10 px-4 border-border/50 bg-white hover:bg-slate-50"
              >
                הבא
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* CSV Import Dialog */}
      {!readOnly && (
        <CSVImportDialog
          clientId={clientId}
          moduleType={moduleType}
          columns={columns}
          open={csvImportDialogOpen}
          onOpenChange={setCSVImportDialogOpen}
          onImportComplete={onRecordUpdate || (() => { })}
        />
      )}
    </div>
  )
}
