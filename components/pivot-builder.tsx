'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { X, Download, BarChart3 } from 'lucide-react'
import { generatePivot, exportPivotToCSV, type PivotConfig } from '@/lib/utils/pivot-engine'
import type { ColumnDefinition } from '@/lib/supabase'

interface PivotBuilderProps {
    data: any[]
    columns: ColumnDefinition[]
    onGenerate?: (result: any) => void
}

export function PivotBuilder({ data, columns, onGenerate }: PivotBuilderProps) {
    const [config, setConfig] = useState<PivotConfig>({
        rows: [],
        columns: [],
        values: []
    })
    const [pivotResult, setPivotResult] = useState<any>(null)
    const [generating, setGenerating] = useState(false)

    const availableFields = columns.filter(
        (col) => !config.rows.includes(col.name) &&
            !config.columns?.includes(col.name) &&
            !config.values.some(v => v.field === col.name)
    )

    const addRow = (fieldName: string) => {
        setConfig({
            ...config,
            rows: [...config.rows, fieldName]
        })
    }

    const addColumn = (fieldName: string) => {
        setConfig({
            ...config,
            columns: [...(config.columns || []), fieldName]
        })
    }

    const addValue = (fieldName: string) => {
        setConfig({
            ...config,
            values: [
                ...config.values,
                {
                    field: fieldName,
                    aggregation: 'SUM',
                    label: `${fieldName}_SUM`
                }
            ]
        })
    }

    const removeRow = (index: number) => {
        setConfig({
            ...config,
            rows: config.rows.filter((_, i) => i !== index)
        })
    }

    const removeColumn = (index: number) => {
        setConfig({
            ...config,
            columns: config.columns?.filter((_, i) => i !== index) || []
        })
    }

    const removeValue = (index: number) => {
        setConfig({
            ...config,
            values: config.values.filter((_, i) => i !== index)
        })
    }

    const updateValueAggregation = (index: number, aggregation: any) => {
        const newValues = [...config.values]
        newValues[index] = {
            ...newValues[index],
            aggregation,
            label: `${newValues[index].field}_${aggregation}`
        }
        setConfig({ ...config, values: newValues })
    }

    const handleGenerate = () => {
        if (config.rows.length === 0 || config.values.length === 0) {
            alert('יש לבחור לפחות שדה אחד לשורות ואחד לערכים')
            return
        }

        setGenerating(true)
        try {
            const result = generatePivot(data, config)
            setPivotResult(result)
            if (onGenerate) {
                onGenerate(result)
            }
        } catch (error) {
            console.error('Error generating pivot:', error)
            alert('שגיאה ביצירת הפיבוט')
        } finally {
            setGenerating(false)
        }
    }

    const handleExport = () => {
        if (!pivotResult) return

        const csv = exportPivotToCSV(pivotResult)
        const BOM = '\uFEFF'
        const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)

        const link = document.createElement('a')
        link.href = url
        link.download = `pivot_${new Date().toISOString().split('T')[0]}.csv`
        link.click()

        URL.revokeObjectURL(url)
    }

    return (
        <div className="space-y-4" dir="rtl">
            <Card className="p-6">
                <h3 className="text-lg font-semibold text-navy mb-4">בונה Pivot Table</h3>

                <div className="grid grid-cols-3 gap-4 mb-6">
                    {/* Rows */}
                    <div>
                        <Label className="text-sm font-medium mb-2 block">שורות (Rows)</Label>
                        <div className="border rounded-lg p-3 min-h-[120px] bg-blue-50/50">
                            {config.rows.length === 0 ? (
                                <p className="text-xs text-grey text-center py-4">גרור שדות לכאן</p>
                            ) : (
                                <div className="space-y-2">
                                    {config.rows.map((field, idx) => (
                                        <div key={idx} className="flex items-center justify-between bg-white px-2 py-1 rounded border">
                                            <span className="text-sm">{columns.find(c => c.name === field)?.label || field}</span>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => removeRow(idx)}
                                                className="h-6 w-6 p-0"
                                            >
                                                <X className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <Select onValueChange={addRow} value="">
                            <SelectTrigger className="mt-2">
                                <SelectValue placeholder="הוסף שדה" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableFields.map((col) => (
                                    <SelectItem key={col.name} value={col.name}>
                                        {col.label || col.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Columns (optional) */}
                    <div>
                        <Label className="text-sm font-medium mb-2 block">עמודות (Columns) - אופציונלי</Label>
                        <div className="border rounded-lg p-3 min-h-[120px] bg-green-50/50">
                            {(!config.columns || config.columns.length === 0) ? (
                                <p className="text-xs text-grey text-center py-4">אופציונלי</p>
                            ) : (
                                <div className="space-y-2">
                                    {config.columns.map((field, idx) => (
                                        <div key={idx} className="flex items-center justify-between bg-white px-2 py-1 rounded border">
                                            <span className="text-sm">{columns.find(c => c.name === field)?.label || field}</span>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => removeColumn(idx)}
                                                className="h-6 w-6 p-0"
                                            >
                                                <X className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <Select onValueChange={addColumn} value="">
                            <SelectTrigger className="mt-2">
                                <SelectValue placeholder="הוסף שדה" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableFields.map((col) => (
                                    <SelectItem key={col.name} value={col.name}>
                                        {col.label || col.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Values */}
                    <div>
                        <Label className="text-sm font-medium mb-2 block">ערכים (Values)</Label>
                        <div className="border rounded-lg p-3 min-h-[120px] bg-purple-50/50">
                            {config.values.length === 0 ? (
                                <p className="text-xs text-grey text-center py-4">בחר שדות לחישוב</p>
                            ) : (
                                <div className="space-y-2">
                                    {config.values.map((value, idx) => (
                                        <div key={idx} className="bg-white px-2 py-1 rounded border">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-xs font-medium">{value.field}</span>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => removeValue(idx)}
                                                    className="h-5 w-5 p-0"
                                                >
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </div>
                                            <Select
                                                value={value.aggregation}
                                                onValueChange={(agg) => updateValueAggregation(idx, agg)}
                                            >
                                                <SelectTrigger className="h-7 text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="SUM">סכום (SUM)</SelectItem>
                                                    <SelectItem value="AVG">ממוצע (AVG)</SelectItem>
                                                    <SelectItem value="COUNT">ספירה (COUNT)</SelectItem>
                                                    <SelectItem value="MIN">מינימום (MIN)</SelectItem>
                                                    <SelectItem value="MAX">מקסימום (MAX)</SelectItem>
                                                    <SelectItem value="MEDIAN">חציון (MEDIAN)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <Select onValueChange={addValue} value="">
                            <SelectTrigger className="mt-2">
                                <SelectValue placeholder="הוסף ערך" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableFields.filter(c => c.data_type === 'number' || c.data_type === 'integer').map((col) => (
                                    <SelectItem key={col.name} value={col.name}>
                                        {col.label || col.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                    <Button
                        onClick={handleGenerate}
                        disabled={generating || config.rows.length === 0 || config.values.length === 0}
                    >
                        <BarChart3 className="h-4 w-4 ml-1" />
                        {generating ? 'מייצר...' : 'צור Pivot'}
                    </Button>
                    {pivotResult && (
                        <Button onClick={handleExport} variant="outline">
                            <Download className="h-4 w-4 ml-1" />
                            ייצא CSV
                        </Button>
                    )}
                </div>
            </Card>

            {/* Result Preview */}
            {pivotResult && (
                <Card className="p-6">
                    <h4 className="font-semibold text-navy mb-3">תוצאת Pivot</h4>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="bg-grey/10 border-b-2">
                                    {pivotResult.headers.map((header: string, idx: number) => (
                                        <th key={idx} className="px-3 py-2 text-right font-medium">
                                            {header}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {pivotResult.rows.map((row: any, idx: number) => (
                                    <tr key={idx} className="border-b hover:bg-grey/5">
                                        {pivotResult.headers.map((header: string, cellIdx: number) => (
                                            <td key={cellIdx} className="px-3 py-2">
                                                {typeof row[header] === 'number'
                                                    ? row[header].toLocaleString('he-IL')
                                                    : row[header] || '-'
                                                }
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                                {pivotResult.totals && (
                                    <tr className="bg-blue-50 border-t-2 font-semibold">
                                        {pivotResult.headers.map((header: string, idx: number) => (
                                            <td key={idx} className="px-3 py-2">
                                                {idx === 0 ? 'סה"כ' : (
                                                    typeof pivotResult.totals[header] === 'number'
                                                        ? pivotResult.totals[header].toLocaleString('he-IL')
                                                        : '-'
                                                )}
                                            </td>
                                        ))}
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-xs text-grey mt-3">
                        {pivotResult.rows.length} שורות
                    </p>
                </Card>
            )}
        </div>
    )
}
