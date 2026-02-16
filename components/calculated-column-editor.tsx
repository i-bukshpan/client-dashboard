'use client'

import { useState, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Info } from 'lucide-react'
import type { ColumnDefinition, FormulaMetadata } from '@/lib/supabase'

interface CalculatedColumnEditorProps {
  column: ColumnDefinition
  columnIndex: number
  allColumns: ColumnDefinition[]
  onUpdate: (index: number, formula: FormulaMetadata) => void
}

export function CalculatedColumnEditor({ column, columnIndex, allColumns, onUpdate }: CalculatedColumnEditorProps) {
  const [expression, setExpression] = useState<string>(column.formula?.expression || '')
  const [helperVisible, setHelperVisible] = useState(false)

  // Extract column names from expression
  useEffect(() => {
    if (expression) {
      const columnNames = allColumns
        .filter(col => col.name !== column.name && col.type === 'number')
        .map(col => col.name)
      
      onUpdate(columnIndex, {
        expression,
        columnReferences: columnNames.filter(name => expression.includes(name)),
      })
    }
  }, [expression, columnIndex, column.name, allColumns])

  const numericColumns = allColumns.filter(col => col.type === 'number' && col.name !== column.name)

  return (
    <Card className="p-4 mt-2 bg-grey/5">
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Label>נוסחה</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setHelperVisible(!helperVisible)}
              className="h-6 px-2 text-xs"
            >
              <Info className="h-3 w-3 mr-1" />
              עזרה
            </Button>
          </div>
          <Input
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            placeholder="לדוגמה: income - expense או IF(amount > 1000, 'high', 'low')"
            dir="ltr"
            className="font-mono text-sm"
          />
          {helperVisible && (
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-900">
              <p className="font-semibold mb-2">דוגמאות נוסחאות:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>חשבון פשוט: <code>income - expense</code></li>
                <li>כפל וחלוקה: <code>(price * quantity) / 2</code></li>
                <li>תנאי: <code>IF(amount &gt; 1000, 'high', 'low')</code></li>
                <li>השוואות: <code>IF(income &gt; expense, 'profit', 'loss')</code></li>
              </ul>
              <p className="mt-2 font-semibold">עמודות מספריות זמינות:</p>
              <div className="flex flex-wrap gap-2 mt-1">
                {numericColumns.map(col => (
                  <button
                    key={col.name}
                    onClick={() => setExpression(prev => prev + (prev ? ' + ' : '') + col.name)}
                    className="px-2 py-1 bg-blue-100 hover:bg-blue-200 rounded text-xs"
                  >
                    {col.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {numericColumns.length === 0 && (
          <p className="text-sm text-orange-600">
            אין עמודות מספריות אחרות שניתן להפנות אליהן
          </p>
        )}
      </div>
    </Card>
  )
}

