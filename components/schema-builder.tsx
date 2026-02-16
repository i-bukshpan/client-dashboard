'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2, Save, Globe } from 'lucide-react'
import { upsertSchema, getSchema, getClientSchemas } from '@/lib/actions/schema'
import { saveDefaultSchema } from '@/lib/actions/default-schemas'
import type { ColumnDefinition, FormulaMetadata, RelationshipMetadata, ClientSchema } from '@/lib/supabase'
import { useToast } from '@/components/ui/toast'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { generateUniqueKey } from '@/lib/utils/key-generator'
import { FormulaEditor } from '@/components/formula-editor'
import { CalculatedColumnEditor } from '@/components/calculated-column-editor'
import { ConditionalFormattingEditor } from '@/components/conditional-formatting-editor'
import { RelationshipEditor } from '@/components/relationship-editor'

interface SchemaBuilderProps {
  clientId: string
  moduleName: string
  branchName?: string
  defaultColumns?: ColumnDefinition[]
  onSave?: () => void
}

export function SchemaBuilder({ clientId, moduleName, branchName, defaultColumns = [], onSave }: SchemaBuilderProps) {
  const { showToast } = useToast()
  const [columns, setColumns] = useState<ColumnDefinition[]>(defaultColumns)
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [availableModules, setAvailableModules] = useState<ClientSchema[]>([])
  const [showSaveDefaultDialog, setShowSaveDefaultDialog] = useState(false)
  const [defaultDescription, setDefaultDescription] = useState('')
  const [savingDefault, setSavingDefault] = useState(false)

  // Load existing schema and available modules on mount
  useEffect(() => {
    const loadSchema = async () => {
      setInitialLoading(true)
      try {
        // Load current schema
        const result = await getSchema(clientId, moduleName, branchName || null)
        if (result.success && result.schema) {
          setColumns(result.schema.columns)
        } else if (defaultColumns.length > 0) {
          setColumns(defaultColumns)
        } else if (moduleName === 'cash_flow') {
          // Default cash flow schema
          setColumns([
            { name: 'date', type: 'date', label: 'תאריך', required: true },
            { name: 'description', type: 'text', label: 'תיאור', required: true },
            { name: 'income', type: 'number', label: 'הכנסה', required: false },
            { name: 'expense', type: 'number', label: 'הוצאה', required: false },
            { name: 'category', type: 'text', label: 'קטגוריה', required: false },
          ])
        }

        // Load all available modules for formula references (exclude current module)
        const modulesResult = await getClientSchemas(clientId)
        if (modulesResult.success && modulesResult.schemas) {
          setAvailableModules(modulesResult.schemas.filter(s => s.module_name !== moduleName))
        }
      } catch (error) {
        console.error('Error loading schema:', error)
      } finally {
        setInitialLoading(false)
      }
    }

    loadSchema()
  }, [clientId, moduleName, branchName])

  // Auto-generate key when label changes
  const handleLabelChange = (index: number, newLabel: string) => {
    const updated = [...columns]
    const existingKeys = columns.map(col => col.name).filter((_, i) => i !== index)
    const newKey = generateUniqueKey(newLabel, existingKeys)
    updated[index] = { ...updated[index], label: newLabel, name: newKey }
    setColumns(updated)
  }

  const handleAddColumn = () => {
    const existingKeys = columns.map(col => col.name)
    const newKey = generateUniqueKey('עמודה חדשה', existingKeys)
    setColumns([
      ...columns,
      { name: newKey, type: 'text', label: 'עמודה חדשה', required: false }
    ])
  }

  const handleRemoveColumn = (index: number) => {
    setColumns(columns.filter((_, i) => i !== index))
  }

  const handleUpdateColumn = (index: number, field: keyof ColumnDefinition, value: any) => {
    const updated = [...columns]
    updated[index] = { ...updated[index], [field]: value }

    // Clear formula/relationship if type changes
    if (field === 'type') {
      if (value !== 'formula' && value !== 'reference' && value !== 'calculated') {
        updated[index].formula = undefined
      }
      if (value !== 'lookup') {
        updated[index].relationship = undefined
      }
    }

    setColumns(updated)
  }

  const handleUpdateFormula = (index: number, formula: FormulaMetadata) => {
    const updated = [...columns]
    updated[index] = { ...updated[index], formula }
    setColumns(updated)
  }

  const handleUpdateRelationship = useCallback((index: number, relationship: RelationshipMetadata) => {
    setColumns(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], relationship }
      return updated
    })
  }, [])

  const handleKeyChange = (index: number, newKey: string) => {
    // Only allow lowercase letters, numbers, and underscores
    const sanitized = newKey.toLowerCase().replace(/[^a-z0-9_]/g, '_')
    const updated = [...columns]
    // Check for duplicates
    const existingKeys = columns.map(col => col.name).filter((_, i) => i !== index)
    if (existingKeys.includes(sanitized)) {
      showToast('error', 'שם המפתח כבר קיים. אנא בחר שם אחר.')
      return
    }
    updated[index] = { ...updated[index], name: sanitized }
    setColumns(updated)
  }

  const handleSave = async () => {
    // Validate columns
    const hasEmptyNames = columns.some(col => !col.name || !col.label)
    if (hasEmptyNames) {
      showToast('error', 'יש למלא שם ולפחות תווית לכל עמודה')
      return
    }

    // Validate formula columns have formula metadata
    const invalidFormulas = columns.filter(
      col => (col.type === 'formula' || col.type === 'reference') && !col.formula
    )
    if (invalidFormulas.length > 0) {
      showToast('error', 'עמודות נוסחה צריכות הגדרה מלאה של הנוסחה')
      return
    }

    // Validate calculated columns have expression
    const invalidCalculated = columns.filter(
      col => col.type === 'calculated' && (!col.formula || !col.formula.expression)
    )
    if (invalidCalculated.length > 0) {
      showToast('error', 'עמודות מחושבות צריכות נוסחה')
      return
    }

    // Validate lookup columns have relationship
    const invalidLookups = columns.filter(
      col => col.type === 'lookup' && !col.relationship
    )
    if (invalidLookups.length > 0) {
      showToast('error', 'עמודות קישור צריכות הגדרת קשר')
      return
    }

    // Check for duplicate names
    const names = columns.map(col => col.name)
    const uniqueNames = new Set(names)
    if (names.length !== uniqueNames.size) {
      showToast('error', 'לא ניתן להשתמש באותו שם פנימי פעמיים')
      return
    }

    setLoading(true)
    try {
      const result = await upsertSchema(clientId, moduleName, columns, branchName || null)
      if (result.success) {
        showToast('success', 'הסכמה נשמרה בהצלחה')
        onSave?.()
      } else {
        showToast('error', result.error || 'שגיאה בשמירת הסכמה')
      }
    } catch (error: any) {
      showToast('error', error.message || 'שגיאה בלתי צפויה')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveAsDefault = async () => {
    // Validate columns (same validation as handleSave)
    const hasEmptyNames = columns.some(col => !col.name || !col.label)
    if (hasEmptyNames) {
      showToast('error', 'יש למלא שם ולפחות תווית לכל עמודה')
      return
    }

    // Check for duplicate names
    const names = columns.map(col => col.name)
    const uniqueNames = new Set(names)
    if (names.length !== uniqueNames.size) {
      showToast('error', 'לא ניתן להשתמש באותו שם פנימי פעמיים')
      return
    }

    setSavingDefault(true)
    try {
      const result = await saveDefaultSchema(moduleName, columns, defaultDescription.trim() || undefined)
      if (result.success) {
        showToast('success', 'הטבלה נשמרה כטבלת ברירת מחדל וזמינה לכל הלקוחות')
        setShowSaveDefaultDialog(false)
        setDefaultDescription('')
      } else {
        showToast('error', result.error || 'שגיאה בשמירת טבלת ברירת מחדל')
      }
    } catch (error: any) {
      showToast('error', error.message || 'שגיאה בלתי צפויה')
    } finally {
      setSavingDefault(false)
    }
  }

  if (initialLoading) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">
          <p className="text-grey">טוען סכמה...</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">הגדרת מבנה נתונים - {moduleName}</h3>
            <p className="text-sm text-grey mt-1">
              הגדר את העמודות שיוצגו בטבלת הנתונים. המפתח (JSON Key) נוצר אוטומטית מהתווית בעברית.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setShowSaveDefaultDialog(true)}
              disabled={loading || columns.length === 0}
              variant="outline"
              className="gap-2"
            >
              <Globe className="h-4 w-4" />
              שמור כטבלת ברירת מחדל
            </Button>
            <Button onClick={handleSave} disabled={loading || columns.length === 0} className="gap-2">
              <Save className="h-4 w-4" />
              שמור סכמה
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {columns.map((column, index) => (
            <Card key={index} className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div>
                  <Label>תווית בעברית</Label>
                  <Input
                    value={column.label}
                    onChange={(e) => handleLabelChange(index, e.target.value)}
                    onFocus={(e) => {
                      // Select all text if it's the default value to allow easy replacement
                      if (e.target.value === 'עמודה חדשה') {
                        e.target.select()
                      }
                    }}
                    placeholder="תאריך, סכום וכו'"
                    required
                  />
                </div>
                <div>
                  <Label>מפתח (JSON Key)</Label>
                  <Input
                    value={column.name}
                    onChange={(e) => handleKeyChange(index, e.target.value)}
                    placeholder="date, amount, etc."
                    dir="ltr"
                    className="text-left font-mono text-sm"
                    required
                  />
                  <p className="text-xs text-grey mt-1">נוצר אוטומטית מהתווית</p>
                </div>
                <div>
                  <Label>סוג נתונים</Label>
                  <Select
                    value={column.type}
                    onValueChange={(value: 'number' | 'text' | 'date' | 'currency' | 'formula' | 'reference') =>
                      handleUpdateColumn(index, 'type', value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">טקסט</SelectItem>
                      <SelectItem value="number">מספר</SelectItem>
                      <SelectItem value="currency">מטבע ₪</SelectItem>
                      <SelectItem value="date">תאריך</SelectItem>
                      <SelectItem value="formula">נוסחה (חישוב מטבלה אחרת)</SelectItem>
                      <SelectItem value="reference">הפניה (קישור לטבלה אחרת)</SelectItem>
                      <SelectItem value="calculated">מחושב (נוסחה ברמת שורה)</SelectItem>
                      <SelectItem value="lookup">קישור לטבלה אחרת (Lookup)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemoveColumn(index)}
                    className="gap-2"
                    disabled={columns.length <= 1}
                  >
                    <Trash2 className="h-4 w-4" />
                    מחק
                  </Button>
                </div>
              </div>
              {/* Formula editor for formula/reference columns */}
              {(column.type === 'formula' || column.type === 'reference') && (
                <FormulaEditor
                  column={column}
                  columnIndex={index}
                  availableModules={availableModules}
                  onUpdate={handleUpdateFormula}
                />
              )}
              {/* Calculated column editor */}
              {column.type === 'calculated' && (
                <CalculatedColumnEditor
                  column={column}
                  columnIndex={index}
                  allColumns={columns}
                  onUpdate={handleUpdateFormula}
                />
              )}
              {/* Relationship editor for lookup columns */}
              {column.type === 'lookup' && (
                <RelationshipEditor
                  column={column}
                  columnIndex={index}
                  availableModules={availableModules}
                  allColumns={columns}
                  onUpdate={handleUpdateRelationship}
                />
              )}
              {/* Conditional formatting editor - available for all column types */}
              <ConditionalFormattingEditor
                column={column}
                onUpdate={(formatting) => {
                  const updated = [...columns]
                  updated[index] = { ...updated[index], conditionalFormatting: formatting }
                  setColumns(updated)
                }}
              />
            </Card>
          ))}
        </div>

        <Button onClick={handleAddColumn} variant="outline" className="gap-2">
          <Plus className="h-4 w-4" />
          הוסף עמודה
        </Button>
      </div>

      {/* Save as Default Dialog */}
      <Dialog open={showSaveDefaultDialog} onOpenChange={setShowSaveDefaultDialog}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>שמור כטבלת ברירת מחדל</DialogTitle>
            <DialogDescription>
              הטבלה תהיה זמינה לכל הלקוחות. ניתן להחיל אותה על כל לקוח חדש או קיים.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="default-description">תיאור (אופציונלי)</Label>
            <Input
              id="default-description"
              value={defaultDescription}
              onChange={(e) => setDefaultDescription(e.target.value)}
              placeholder="לדוגמה: טבלה לניהול תזרים מזומנים"
              className="mt-2"
            />
            <p className="text-sm text-grey mt-2">
              שם הטבלה: <strong>{moduleName}</strong>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowSaveDefaultDialog(false)
              setDefaultDescription('')
            }}>
              ביטול
            </Button>
            <Button onClick={handleSaveAsDefault} disabled={savingDefault || columns.length === 0}>
              {savingDefault ? 'שומר...' : 'שמור'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

