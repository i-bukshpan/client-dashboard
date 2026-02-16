'use client'

import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2 } from 'lucide-react'
import type { ConditionalFormatting, ColumnDefinition } from '@/lib/supabase'

interface ConditionalFormattingEditorProps {
  column: ColumnDefinition
  onUpdate: (formatting: ConditionalFormatting[]) => void
}

export function ConditionalFormattingEditor({ column, onUpdate }: ConditionalFormattingEditorProps) {
  const [rules, setRules] = useState<ConditionalFormatting[]>(column.conditionalFormatting || [])

  const handleAddRule = () => {
    const newRule: ConditionalFormatting = {
      condition: 'gt',
      value: 0,
      backgroundColor: '#fef3c7', // yellow-100
      textColor: '#92400e', // yellow-800
    }
    const updated = [...rules, newRule]
    setRules(updated)
    onUpdate(updated)
  }

  const handleRemoveRule = (index: number) => {
    const updated = rules.filter((_, i) => i !== index)
    setRules(updated)
    onUpdate(updated)
  }

  const handleUpdateRule = (index: number, field: keyof ConditionalFormatting, value: any) => {
    const updated = [...rules]
    updated[index] = { ...updated[index], [field]: value }
    setRules(updated)
    onUpdate(updated)
  }

  return (
    <Card className="p-4 mt-2 bg-grey/5">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>עיצוב מותנה</Label>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddRule}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            הוסף כלל
          </Button>
        </div>

        {rules.length === 0 ? (
          <p className="text-sm text-grey">אין כללי עיצוב. הוסף כלל כדי להתחיל.</p>
        ) : (
          <div className="space-y-3">
            {rules.map((rule, index) => (
              <Card key={index} className="p-3 bg-white">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                  <div>
                    <Label className="text-xs">תנאי</Label>
                    <Select
                      value={rule.condition}
                      onValueChange={(value: any) => handleUpdateRule(index, 'condition', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gt">גדול מ-</SelectItem>
                        <SelectItem value="lt">קטן מ-</SelectItem>
                        <SelectItem value="gte">גדול או שווה ל-</SelectItem>
                        <SelectItem value="lte">קטן או שווה ל-</SelectItem>
                        <SelectItem value="eq">שווה ל-</SelectItem>
                        <SelectItem value="contains">מכיל</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">ערך</Label>
                    <Input
                      type={column.type === 'number' ? 'number' : 'text'}
                      value={rule.value}
                      onChange={(e) => {
                        const newValue = column.type === 'number' ? parseFloat(e.target.value) : e.target.value
                        handleUpdateRule(index, 'value', newValue)
                      }}
                      placeholder="ערך"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">צבע רקע</Label>
                    <Input
                      type="color"
                      value={rule.backgroundColor || '#ffffff'}
                      onChange={(e) => handleUpdateRule(index, 'backgroundColor', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">צבע טקסט</Label>
                    <Input
                      type="color"
                      value={rule.textColor || '#000000'}
                      onChange={(e) => handleUpdateRule(index, 'textColor', e.target.value)}
                    />
                  </div>
                  <div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveRule(index)}
                      className="gap-2 text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                      מחק
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}

