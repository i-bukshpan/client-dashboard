'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Plus, X, Save } from 'lucide-react'
import type { FilterCondition, FilterGroup } from '@/lib/utils/filter-engine'
import { getFilterDescription } from '@/lib/utils/filter-engine'
import type { ColumnDefinition } from '@/lib/supabase'

interface FilterBuilderProps {
    columns: ColumnDefinition[]
    onApply: (filterGroup: FilterGroup) => void
    onSave?: (name: string, filterGroup: FilterGroup) => void
    initialFilter?: FilterGroup
}

export function FilterBuilder({ columns, onApply, onSave, initialFilter }: FilterBuilderProps) {
    const [filterGroup, setFilterGroup] = useState<FilterGroup>(
        initialFilter || {
            logic: 'AND',
            conditions: [],
        }
    )
    const [saveDialogOpen, setSaveDialogOpen] = useState(false)
    const [filterName, setFilterName] = useState('')

    const addCondition = () => {
        setFilterGroup({
            ...filterGroup,
            conditions: [
                ...filterGroup.conditions,
                {
                    field: columns[0]?.name || '',
                    operator: 'equals',
                    value: '',
                    dataType: columns[0]?.data_type as any || 'text',
                },
            ],
        })
    }

    const removeCondition = (index: number) => {
        setFilterGroup({
            ...filterGroup,
            conditions: filterGroup.conditions.filter((_, i) => i !== index),
        })
    }

    const updateCondition = (index: number, updates: Partial<FilterCondition>) => {
        const newConditions = [...filterGroup.conditions]
        newConditions[index] = { ...newConditions[index], ...updates }
        setFilterGroup({ ...filterGroup, conditions: newConditions })
    }

    const getOperatorsForType = (dataType: string): Array<{ value: string; label: string }> => {
        const common = [
            { value: 'equals', label: 'שווה ל' },
            { value: 'notEquals', label: 'לא שווה ל' },
            { value: 'isEmpty', label: 'ריק' },
            { value: 'isNotEmpty', label: 'לא ריק' },
        ]

        switch (dataType) {
            case 'text':
                return [
                    ...common,
                    { value: 'contains', label: 'מכיל' },
                    { value: 'notContains', label: 'לא מכיל' },
                    { value: 'startsWith', label: 'מתחיל ב' },
                    { value: 'endsWith', label: 'מסתיים ב' },
                ]
            case 'number':
                return [
                    ...common,
                    { value: 'gt', label: 'גדול מ' },
                    { value: 'gte', label: 'גדול או שווה ל' },
                    { value: 'lt', label: 'קטן מ' },
                    { value: 'lte', label: 'קטן או שווה ל' },
                    { value: 'between', label: 'בין' },
                ]
            case 'date':
                return [
                    ...common,
                    { value: 'gt', label: 'אחרי' },
                    { value: 'gte', label: 'אחרי או ב' },
                    { value: 'lt', label: 'לפני' },
                    { value: 'lte', label: 'לפני או ב' },
                    { value: 'between', label: 'בין' },
                ]
            default:
                return common
        }
    }

    const handleApply = () => {
        onApply(filterGroup)
    }

    const handleSave = () => {
        if (onSave && filterName.trim()) {
            onSave(filterName, filterGroup)
            setFilterName('')
            setSaveDialogOpen(false)
        }
    }

    const getColumnType = (fieldName: string): string => {
        const column = columns.find((c) => c.name === fieldName)
        return column?.data_type || 'text'
    }

    return (
        <div className="border rounded-lg p-4 bg-white" dir="rtl">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-navy">בונה פילטרים מתקדם</h3>
                <div className="flex items-center gap-2">
                    <Select
                        value={filterGroup.logic}
                        onValueChange={(value) => setFilterGroup({ ...filterGroup, logic: value as 'AND' | 'OR' })}
                    >
                        <SelectTrigger className="w-24">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="AND">וגם (AND)</SelectItem>
                            <SelectItem value="OR">או (OR)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Conditions */}
            <div className="space-y-3 mb-4">
                {filterGroup.conditions.map((condition, index) => (
                    <div key={index} className="flex items-end gap-2 p-3 bg-grey/5 rounded border">
                        {/* Field */}
                        <div className="flex-1">
                            <Label className="text-xs">שדה</Label>
                            <Select
                                value={condition.field}
                                onValueChange={(value) => {
                                    const dataType = getColumnType(value)
                                    updateCondition(index, {
                                        field: value,
                                        dataType: dataType as any,
                                        operator: 'equals' // reset operator when field changes
                                    })
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {columns.map((col) => (
                                        <SelectItem key={col.name} value={col.name}>
                                            {col.label || col.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Operator */}
                        <div className="flex-1">
                            <Label className="text-xs">תנאי</Label>
                            <Select
                                value={condition.operator}
                                onValueChange={(value) => updateCondition(index, { operator: value as any })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {getOperatorsForType(condition.dataType).map((op) => (
                                        <SelectItem key={op.value} value={op.value}>
                                            {op.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Value */}
                        {condition.operator !== 'isEmpty' && condition.operator !== 'isNotEmpty' && (
                            <div className="flex-1">
                                <Label className="text-xs">ערך</Label>
                                <Input
                                    type={condition.dataType === 'number' ? 'number' : condition.dataType === 'date' ? 'date' : 'text'}
                                    value={condition.value}
                                    onChange={(e) => updateCondition(index, { value: e.target.value })}
                                    placeholder="הזן ערך"
                                />
                            </div>
                        )}

                        {/* Value 2 (for between) */}
                        {condition.operator === 'between' && (
                            <div className="flex-1">
                                <Label className="text-xs">עד</Label>
                                <Input
                                    type={condition.dataType === 'number' ? 'number' : condition.dataType === 'date' ? 'date' : 'text'}
                                    value={condition.value2 || ''}
                                    onChange={(e) => updateCondition(index, { value2: e.target.value })}
                                    placeholder="ערך שני"
                                />
                            </div>
                        )}

                        {/* Remove button */}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeCondition(index)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                ))}

                {filterGroup.conditions.length === 0 && (
                    <div className="text-center py-8 text-grey">
                        <p>אין תנאי סינון</p>
                        <p className="text-sm">לחץ על "הוסף תנאי" להתחיל</p>
                    </div>
                )}
            </div>

            {/* Add condition button */}
            <Button onClick={addCondition} variant="outline" size="sm" className="mb-4">
                <Plus className="h-4 w-4 ml-1" />
                הוסף תנאי
            </Button>

            {/* Description */}
            {filterGroup.conditions.length > 0 && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
                    <strong>סינון:</strong> {getFilterDescription(filterGroup)}
                </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
                <Button onClick={handleApply} disabled={filterGroup.conditions.length === 0}>
                    החל סינון
                </Button>
                {onSave && (
                    <>
                        {!saveDialogOpen ? (
                            <Button onClick={() => setSaveDialogOpen(true)} variant="outline" disabled={filterGroup.conditions.length === 0}>
                                <Save className="h-4 w-4 ml-1" />
                                שמור view
                            </Button>
                        ) : (
                            <div className="flex gap-2 flex-1">
                                <Input
                                    value={filterName}
                                    onChange={(e) => setFilterName(e.target.value)}
                                    placeholder="שם ה-view"
                                    className="flex-1"
                                />
                                <Button onClick={handleSave} size="sm">
                                    שמור
                                </Button>
                                <Button onClick={() => setSaveDialogOpen(false)} variant="outline" size="sm">
                                    ביטול
                                </Button>
                            </div>
                        )}
                    </>
                )}
                <Button
                    onClick={() => setFilterGroup({ logic: 'AND', conditions: [] })}
                    variant="outline"
                    disabled={filterGroup.conditions.length === 0}
                >
                    נקה הכל
                </Button>
            </div>
        </div>
    )
}
