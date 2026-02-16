'use client'

import { useState, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import type { FormulaMetadata, ClientSchema, ColumnDefinition } from '@/lib/supabase'

interface FormulaEditorProps {
  column: ColumnDefinition
  columnIndex: number
  availableModules: ClientSchema[]
  onUpdate: (index: number, formula: FormulaMetadata) => void
}

export function FormulaEditor({ column, columnIndex, availableModules, onUpdate }: FormulaEditorProps) {
  const [targetModule, setTargetModule] = useState<string>(column.formula?.target_module_name || '')
  const [targetColumn, setTargetColumn] = useState<string>(column.formula?.target_column_key || '')
  const [operation, setOperation] = useState<'SUM' | 'AVERAGE' | 'COUNT' | 'MIN' | 'MAX'>(
    column.formula?.operation || 'SUM'
  )

  // Get columns from selected module
  const selectedModuleSchema = availableModules.find(m => m.module_name === targetModule)
  const availableColumns = selectedModuleSchema?.columns.filter(c => c.type === 'number') || []

  // Update formula when values change
  useEffect(() => {
    if (targetModule && targetColumn && operation) {
      onUpdate(columnIndex, {
        target_module_name: targetModule,
        target_column_key: targetColumn,
        operation,
      })
    }
  }, [targetModule, targetColumn, operation, columnIndex])

  return (
    <Card className="p-4 mt-2 bg-grey/5">
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>טבלה מקור</Label>
            <Select value={targetModule} onValueChange={setTargetModule}>
              <SelectTrigger>
                <SelectValue placeholder="בחר טבלה" />
              </SelectTrigger>
              <SelectContent>
                {availableModules.map((module) => (
                  <SelectItem key={module.id} value={module.module_name}>
                    {module.module_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>עמודה לחישוב</Label>
            <Select 
              value={targetColumn} 
              onValueChange={setTargetColumn}
              disabled={!targetModule || availableColumns.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="בחר עמודה" />
              </SelectTrigger>
              <SelectContent>
                {availableColumns.map((col) => (
                  <SelectItem key={col.name} value={col.name}>
                    {col.label} ({col.name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>פעולה</Label>
            <Select value={operation} onValueChange={(value: any) => setOperation(value)}>
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
        </div>

        {!targetModule && (
          <p className="text-sm text-grey">
            בחר טבלה מקור כדי להגדיר את הנוסחה
          </p>
        )}
      </div>
    </Card>
  )
}

