'use client'

import { useState, useEffect, useRef } from 'react'
import * as React from 'react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import type { RelationshipMetadata, ClientSchema, ColumnDefinition } from '@/lib/supabase'

interface RelationshipEditorProps {
  column: ColumnDefinition
  columnIndex: number
  availableModules: ClientSchema[]
  allColumns: ColumnDefinition[]
  onUpdate: (index: number, relationship: RelationshipMetadata) => void
}

export function RelationshipEditor({ column, columnIndex, availableModules, allColumns, onUpdate }: RelationshipEditorProps) {
  const [targetModule, setTargetModule] = useState<string>(column.relationship?.target_module_name || '')
  const [targetColumn, setTargetColumn] = useState<string>(column.relationship?.target_column_key || '')
  const [sourceColumn, setSourceColumn] = useState<string>(column.relationship?.source_column_key || column.name)
  const [displayColumn, setDisplayColumn] = useState<string>(column.relationship?.display_column_key || '')

  // Get columns from selected module
  const selectedModuleSchema = availableModules.find(m => m.module_name === targetModule)
  const targetModuleColumns = selectedModuleSchema?.columns || []
  const sourceModuleColumns = allColumns.filter(c => c.name !== column.name)

  // Update relationship when values change - use ref to prevent infinite loops
  const prevValuesRef = useRef<string>('')
  const onUpdateRef = useRef(onUpdate)
  
  // Keep ref updated
  useEffect(() => {
    onUpdateRef.current = onUpdate
  }, [onUpdate])
  
  useEffect(() => {
    if (targetModule && targetColumn && displayColumn) {
      const currentValues = `${targetModule}-${targetColumn}-${sourceColumn}-${displayColumn}`
      if (prevValuesRef.current !== currentValues) {
        prevValuesRef.current = currentValues
        onUpdateRef.current(columnIndex, {
          target_module_name: targetModule,
          target_column_key: targetColumn,
          source_column_key: sourceColumn,
          display_column_key: displayColumn,
        })
      }
    }
  }, [targetModule, targetColumn, sourceColumn, displayColumn, columnIndex])

  return (
    <Card className="p-4 mt-2 bg-grey/5">
      <div className="space-y-4">
        <h4 className="text-sm font-semibold">הגדרות קישור בין טבלאות</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>טבלת יעד</Label>
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
            <Label>עמודת מקור (בטבלה הנוכחית)</Label>
            <Select value={sourceColumn} onValueChange={setSourceColumn}>
              <SelectTrigger>
                <SelectValue placeholder="בחר עמודה" />
              </SelectTrigger>
              <SelectContent>
                {sourceModuleColumns.map((col) => (
                  <SelectItem key={col.name} value={col.name}>
                    {col.label} ({col.name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>עמודת מפתח בטבלת היעד (להתאמה)</Label>
            <Select
              value={targetColumn}
              onValueChange={setTargetColumn}
              disabled={!targetModule}
            >
              <SelectTrigger>
                <SelectValue placeholder="בחר עמודה" />
              </SelectTrigger>
              <SelectContent>
                {targetModuleColumns.map((col) => (
                  <SelectItem key={col.name} value={col.name}>
                    {col.label} ({col.name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>עמודה להצגה מטבלת היעד</Label>
            <Select
              value={displayColumn}
              onValueChange={setDisplayColumn}
              disabled={!targetModule}
            >
              <SelectTrigger>
                <SelectValue placeholder="בחר עמודה להצגה" />
              </SelectTrigger>
              <SelectContent>
                {targetModuleColumns.map((col) => (
                  <SelectItem key={col.name} value={col.name}>
                    {col.label} ({col.name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {targetModule && targetColumn && displayColumn && (
          <p className="text-xs text-grey mt-2">
            העמודה תציג ערכים מטבלת "{targetModule}" לפי התאמה בין "{sourceColumn}" ל-"{targetColumn}"
          </p>
        )}
      </div>
    </Card>
  )
}

