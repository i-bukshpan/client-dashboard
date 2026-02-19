'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, Trash2, Edit, Settings, Globe, Upload } from 'lucide-react'
import { getClientSchemas, upsertSchema, deleteModule } from '@/lib/actions/schema'
import { getDefaultSchemas, applyDefaultSchemaToClient } from '@/lib/actions/default-schemas'
import type { DefaultSchema } from '@/lib/actions/default-schemas'
import { SchemaBuilder } from '@/components/schema-builder'
import type { ClientSchema } from '@/lib/supabase'
import { useToast } from '@/components/ui/toast'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { ColumnDefinition } from '@/lib/supabase'
import { addRecordsBulk } from '@/lib/actions/data-records'
import { parseDateFromCSV } from '@/lib/utils/date-utils'

interface ModuleManagerProps {
  clientId: string
  onModuleUpdate?: () => void
}

export function ModuleManager({ clientId, onModuleUpdate }: ModuleManagerProps) {
  const { showToast } = useToast()
  const [schemas, setSchemas] = useState<ClientSchema[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedModule, setSelectedModule] = useState<string | null>(null)
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newModuleName, setNewModuleName] = useState('')
  const [selectedBranchForNewTable, setSelectedBranchForNewTable] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [defaultSchemas, setDefaultSchemas] = useState<DefaultSchema[]>([])
  const [selectedDefaultSchema, setSelectedDefaultSchema] = useState<string>('')
  const [useDefaultSchema, setUseDefaultSchema] = useState(false)
  const [importMode, setImportMode] = useState<'create' | 'import'>('create')
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')
  const [showAddBranchDialog, setShowAddBranchDialog] = useState(false)

  // Helper function to parse CSV
  const parseCSV = (csvText: string): { headers: string[]; rows: string[][] } => {
    let text = csvText
    if (text.charCodeAt(0) === 0xFEFF) {
      text = text.slice(1)
    }
    const lines = text.split(/\r?\n/).filter(line => line.trim())
    if (lines.length === 0) {
      return { headers: [], rows: [] }
    }

    const detectDelimiter = (line: string): string => {
      const candidates = [',', ';', '\t']
      let best = ','
      let bestCount = -1
      for (const candidate of candidates) {
        const count = line.split(candidate).length - 1
        if (count > bestCount) {
          best = candidate
          bestCount = count
        }
      }
      return best
    }

    const delimiter = detectDelimiter(lines[0])

    // Parse CSV line (handling quoted values and escaped quotes)
    const parseCSVLine = (line: string): string[] => {
      const row: string[] = []
      let currentField = ''
      let insideQuotes = false

      for (let i = 0; i <= line.length; i++) {
        const char = i < line.length ? line[i] : null
        const nextChar = i + 1 < line.length ? line[i + 1] : null

        if (char === '"') {
          if (insideQuotes && nextChar === '"') {
            currentField += '"'
            i++
          } else {
            insideQuotes = !insideQuotes
          }
          continue
        }

        if ((char === delimiter || char === null) && !insideQuotes) {
          row.push(currentField.trim())
          currentField = ''
          if (char === null) break
          continue
        }

        if (char !== null) {
          currentField += char
        }
      }
      return row
    }

    const headers = parseCSVLine(lines[0])
    const rows = lines.slice(1).map(parseCSVLine)

    return { headers, rows }
  }

  // Helper function to infer column type
  const inferColumnType = (values: string[]): 'number' | 'text' | 'date' | 'currency' => {
    if (values.length === 0) return 'text'

    const cleanValue = (val: string) => val.replace(/[,\s₪$€]/g, '')

    // Check if values look like currency (contain ₪, $, or €)
    const hasCurrencySymbol = values.some(val => val && /[₪$€]/.test(val))

    // Check if all values are numbers (after cleaning)
    const allNumbers = values.every(val => {
      if (!val || val.trim() === '') return true
      const cleaned = cleanValue(val)
      return !isNaN(Number(cleaned)) && !isNaN(parseFloat(cleaned))
    })

    if (allNumbers && values.some(v => v && v.trim() !== '')) {
      return hasCurrencySymbol ? 'currency' : 'number'
    }

    // Check if all values are dates
    const datePattern = /^\d{4}-\d{2}-\d{2}$|^\d{2}\/\d{2}\/\d{4}$|^\d{2}\.\d{2}\.\d{4}$/
    const allDates = values.every(val => {
      if (!val || val.trim() === '') return true
      const cleanVal = val.trim()
      // Use parseDateFromCSV helper if available, or basic regex/Date.parse
      return datePattern.test(cleanVal) || !isNaN(Date.parse(cleanVal))
    })
    if (allDates && values.some(v => v && v.trim() !== '')) {
      return 'date'
    }

    return 'text'
  }

  // Generate a key from Hebrew text
  const generateKey = (text: string, index: number): string => {
    const trimmed = text.trim()
    if (!trimmed) {
      // If empty, use column index
      return `column_${index + 1}`
    }

    // Convert Hebrew to transliterated key
    let key = trimmed
      .toLowerCase()
      .replace(/[^\w\s-א-ת]/g, '') // Keep Hebrew letters too
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')

    // If after processing it's empty, use column index
    if (!key) {
      return `column_${index + 1}`
    }

    return key
  }

  const handleImportFromCSV = async () => {
    if (!csvFile || !newModuleName.trim()) {
      showToast('error', 'יש להזין שם לטבלה ולבחור קובץ CSV')
      return
    }

    setImporting(true)
    try {
      const text = await csvFile.text()
      const { headers, rows } = parseCSV(text)

      if (headers.length === 0) {
        showToast('error', 'הקובץ ריק או לא תקין')
        return
      }

      // Check if module name already exists in the same branch
      if (schemas.some(s => s.module_name === newModuleName.trim() &&
        (s.branch_name || null) === (selectedBranchForNewTable || null))) {
        showToast('error', 'טבלה בשם זה כבר קיימת בסניף זה')
        return
      }

      // Create columns from headers
      const usedKeys = new Set<string>()
      const columns: ColumnDefinition[] = headers.map((header, index) => {
        const columnValues = rows.map(row => row[index] || '').filter(v => v)
        const inferredType = inferColumnType(columnValues)
        let key = generateKey(header, index)

        // Ensure unique key
        let uniqueKey = key
        let counter = 1
        while (usedKeys.has(uniqueKey)) {
          uniqueKey = `${key}_${counter}`
          counter++
        }
        usedKeys.add(uniqueKey)
        key = uniqueKey

        return {
          name: key,
          type: inferredType,
          label: header.trim() || `עמודה ${index + 1}`,
          required: false,
        }
      })

      // Create schema
      const schemaResult = await upsertSchema(clientId, newModuleName.trim(), columns, selectedBranchForNewTable)

      if (!schemaResult.success || !schemaResult.schema) {
        showToast('error', schemaResult.error || 'שגיאה ביצירת טבלה')
        return
      }

      // Import data rows (chunked to support large files)
      const dataRows: Record<string, any>[] = []
      for (const row of rows) {
        if (row.every(cell => !cell || cell.trim() === '')) continue // Skip empty rows

        const data: Record<string, any> = {}
        headers.forEach((header, index) => {
          const column = columns[index]
          const key = column.name
          const value = row[index]?.trim() || ''

          if (column.type === 'number' && value) {
            // Remove commas before parsing (e.g., "12,270.00" → 12270.00)
            const cleanedValue = value.replace(/[,₪]/g, '') // Remove commas and ₪ symbol
            const num = parseFloat(cleanedValue)
            data[key] = isNaN(num) ? 0 : num
          } else if (column.type === 'date' && value) {
            // Use parseDateFromCSV to handle DD/MM/YYYY format
            const parsedDate = parseDateFromCSV(value)
            if (parsedDate) {
              data[key] = parsedDate.toISOString()
            } else {
              // If parsing fails, keep original value
              data[key] = value
            }
          } else {
            data[key] = value
          }
        })
        dataRows.push(data)
      }

      const chunkSize = 500
      let importedCount = 0
      for (let i = 0; i < dataRows.length; i += chunkSize) {
        const chunk = dataRows.slice(i, i + chunkSize)
        const recordResult = await addRecordsBulk(clientId, newModuleName.trim(), chunk)
        if (!recordResult.success) {
          showToast('error', recordResult.error || 'שגיאה בייבוא שורות')
          return
        }
        importedCount += recordResult.inserted || 0
      }

      showToast('success', `טבלה נוצרה בהצלחה ו-${importedCount} רשומות יובאו`)
      setShowCreateDialog(false)
      setNewModuleName('')
      setCsvFile(null)
      await loadSchemas()
      setSelectedModule(newModuleName.trim())
      setSelectedBranch(selectedBranchForNewTable)
      onModuleUpdate?.()
    } catch (error: any) {
      console.error('Error importing CSV:', error)
      showToast('error', error.message || 'שגיאה בייבוא הקובץ')
    } finally {
      setImporting(false)
    }
  }

  const loadSchemas = async () => {
    setLoading(true)
    try {
      const result = await getClientSchemas(clientId)
      if (result.success && result.schemas) {
        setSchemas(result.schemas)
      }
    } catch (error) {
      console.error('Error loading schemas:', error)
    } finally {
      setLoading(false)
    }
  }

  // Get unique branches from schemas
  const getUniqueBranches = (): (string | null)[] => {
    const branches = new Set<string | null>()
    schemas.forEach(s => branches.add(s.branch_name || null))
    return Array.from(branches).sort((a, b) => {
      if (a === null) return -1
      if (b === null) return 1
      return a.localeCompare(b, 'he')
    })
  }

  useEffect(() => {
    loadSchemas()
    loadDefaultSchemas()
  }, [clientId])

  const loadDefaultSchemas = async () => {
    try {
      const result = await getDefaultSchemas()
      if (result.success && result.schemas) {
        setDefaultSchemas(result.schemas)
      }
    } catch (error) {
      console.error('Error loading default schemas:', error)
    }
  }

  const handleCreateModule = async () => {
    if (!newModuleName.trim()) {
      showToast('error', 'יש להזין שם לטבלה')
      return
    }

    // Check if module name already exists in the same branch
    if (schemas.some(s => s.module_name === newModuleName.trim() &&
      (s.branch_name || null) === (selectedBranchForNewTable || null))) {
      showToast('error', 'טבלה בשם זה כבר קיימת בתחום זה')
      return
    }

    setCreating(true)
    try {
      if (useDefaultSchema && selectedDefaultSchema) {
        // Apply default schema
        const result = await applyDefaultSchemaToClient(clientId, selectedDefaultSchema, selectedBranchForNewTable)
        if (result.success) {
          showToast('success', 'טבלת ברירת מחדל הוחלה בהצלחה')
          setShowCreateDialog(false)
          setNewModuleName('')
          setSelectedDefaultSchema('')
          setUseDefaultSchema(false)
          await loadSchemas()
          setSelectedModule(selectedDefaultSchema)
          onModuleUpdate?.()
        } else {
          showToast('error', result.error || 'שגיאה בהחלת טבלת ברירת מחדל')
        }
      } else {
        // Create empty schema - user will edit it after
        const result = await upsertSchema(clientId, newModuleName.trim(), [], selectedBranchForNewTable)

        if (result.success) {
          showToast('success', 'טבלה נוצרה בהצלחה. אנא הגדר את העמודות.')
          setShowCreateDialog(false)
          setNewModuleName('')
          await loadSchemas()
          setSelectedModule(newModuleName.trim())
          onModuleUpdate?.()
        } else {
          showToast('error', result.error || 'שגיאה ביצירת טבלה')
        }
      }
    } catch (error: any) {
      showToast('error', error.message || 'שגיאה בלתי צפויה')
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteModule = async (moduleName: string, branchName?: string | null) => {
    const branchText = branchName ? ` (תחום: ${branchName})` : ' (ראשי)'
    if (!confirm(`האם אתה בטוח שברצונך למחוק את הטבלה "${moduleName}"${branchText}? פעולה זו תמחק גם את כל הרשומות הקשורות.`)) {
      return
    }

    try {
      // Use the deleteModule action which handles both records and schema
      const result = await deleteModule(clientId, moduleName, branchName)
      if (result.success) {
        showToast('success', 'הטבלה נמחקה בהצלחה')
        await loadSchemas()
        if (selectedModule === moduleName) {
          setSelectedModule(null)
        }
        onModuleUpdate?.()
      } else {
        showToast('error', result.error || 'שגיאה במחיקת טבלה')
      }
    } catch (error: any) {
      showToast('error', error.message || 'שגיאה בלתי צפויה')
    }
  }

  const handleSchemaSave = () => {
    loadSchemas()
    onModuleUpdate?.()
  }

  if (loading) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">
          <p className="text-grey">טוען טבלאות...</p>
        </div>
      </Card>
    )
  }

  // If a module is selected for editing, show the schema builder
  if (selectedModule) {
    const selectedSchema = schemas.find(s => s.module_name === selectedModule &&
      (s.branch_name || null) === (selectedBranch || null))
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => {
              setSelectedModule(null)
              setSelectedBranch(null)
            }}
            className="gap-2"
          >
            <Settings className="h-4 w-4" />
            חזרה לרשימת טבלאות
          </Button>
          <div className="text-right">
            <h2 className="text-xl font-semibold">{selectedModule}</h2>
            {selectedBranch && (
              <p className="text-sm text-grey">תחום: {selectedBranch}</p>
            )}
          </div>
        </div>
        <SchemaBuilder
          clientId={clientId}
          moduleName={selectedModule}
          branchName={selectedBranch || undefined}
          onSave={handleSchemaSave}
        />
      </div>
    )
  }

  // Show list of modules
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">ניהול טבלאות</h2>
          <p className="text-sm text-grey mt-1">
            צור ונהל טבלאות שונות לניהול נתונים עבור הלקוח הזה
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          צור טבלה חדשה
        </Button>
      </div>

      {schemas.length === 0 ? (
        <Card className="p-8">
          <div className="text-center">
            <p className="text-grey mb-4">לא נמצאו טבלאות</p>
            <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              צור טבלה ראשונה
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {schemas.map((schema) => (
            <Card key={schema.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">{schema.module_name}</h3>
                  <p className="text-sm text-grey">
                    {schema.columns.length} עמודות
                  </p>
                  {schema.financial_type && (
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mt-1 ${schema.financial_type === 'income'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                      }`}>
                      {schema.financial_type === 'income' ? 'הכנסה' : 'הוצאה'}
                    </span>
                  )}
                  {schema.branch_name && (
                    <p className="text-xs text-grey mt-1">תחום: {schema.branch_name}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedModule(schema.module_name)
                      setSelectedBranch(schema.branch_name || null)
                    }}
                    className="gap-2"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteModule(schema.module_name, schema.branch_name)}
                    className="gap-2 text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="text-xs text-grey mt-2">
                עודכן: {new Date(schema.updated_at).toLocaleDateString('he-IL')}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create New Module Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        setShowCreateDialog(open)
        if (!open) {
          setNewModuleName('')
          setCsvFile(null)
          setImportMode('create')
          setUseDefaultSchema(false)
          setSelectedDefaultSchema('')
          setSelectedBranchForNewTable(null)
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>צור טבלה חדשה</DialogTitle>
            <DialogDescription>
              בחר איך ליצור את הטבלה - צור טבלה חדשה או ייבא מ-Google Sheets
            </DialogDescription>
          </DialogHeader>
          <Tabs value={importMode} onValueChange={(v) => setImportMode(v as 'create' | 'import')} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="create">צור טבלה חדשה</TabsTrigger>
              <TabsTrigger value="import">ייבא מ-Google Sheets</TabsTrigger>
            </TabsList>

            <TabsContent value="create" className="space-y-4 py-4">
              {defaultSchemas.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      id="use-default"
                      checked={useDefaultSchema}
                      onChange={(e) => {
                        setUseDefaultSchema(e.target.checked)
                        if (e.target.checked && defaultSchemas.length > 0) {
                          setNewModuleName(defaultSchemas[0].module_name)
                          setSelectedDefaultSchema(defaultSchemas[0].module_name)
                        } else {
                          setNewModuleName('')
                          setSelectedDefaultSchema('')
                        }
                      }}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="use-default" className="cursor-pointer">
                      השתמש בטבלת ברירת מחדל
                    </Label>
                  </div>
                  {useDefaultSchema && (
                    <Select
                      value={selectedDefaultSchema}
                      onValueChange={(value) => {
                        setSelectedDefaultSchema(value)
                        setNewModuleName(value)
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="בחר טבלת ברירת מחדל" />
                      </SelectTrigger>
                      <SelectContent>
                        {defaultSchemas.map((schema) => (
                          <SelectItem key={schema.id} value={schema.module_name}>
                            {schema.module_name} {schema.description && `- ${schema.description}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
              {!useDefaultSchema && (
                <>
                  <div>
                    <Label htmlFor="module-name">שם הטבלה</Label>
                    <Input
                      id="module-name"
                      value={newModuleName}
                      onChange={(e) => setNewModuleName(e.target.value)}
                      placeholder="לדוגמה: השקעות שותפים"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleCreateModule()
                        }
                      }}
                    />
                  </div>
                  <div>
                    <Label htmlFor="branch-select">תחום (אופציונלי - השאר ריק לטבלאות ראשיות)</Label>
                    <Select
                      value={selectedBranchForNewTable || '__main__'}
                      onValueChange={(value) => setSelectedBranchForNewTable(value === '__main__' ? null : value)}
                    >
                      <SelectTrigger id="branch-select">
                        <SelectValue placeholder="ראשי" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__main__">ראשי</SelectItem>
                        {getUniqueBranches()
                          .filter(b => b !== null)
                          .map((branch) => (
                            <SelectItem key={branch!} value={branch!}>
                              {branch}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <Input
                      className="mt-2"
                      value={selectedBranchForNewTable || ''}
                      onChange={(e) => setSelectedBranchForNewTable(e.target.value.trim() || null)}
                      placeholder="או הקלד שם תחום חדש"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleCreateModule()
                        }
                      }}
                    />
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="import" className="space-y-4 py-4">
              <div>
                <Label htmlFor="import-module-name">שם הטבלה</Label>
                <Input
                  id="import-module-name"
                  value={newModuleName}
                  onChange={(e) => setNewModuleName(e.target.value)}
                  placeholder="לדוגמה: השקעות שותפים"
                  className="mt-2"
                />
                <p className="text-xs text-grey mt-1">
                  שים לב: השורה הראשונה בקובץ CSV תהיה כותרות העמודות
                </p>
              </div>
              <div>
                <Label htmlFor="import-branch-select">תחום (אופציונלי - השאר ריק לטבלאות ראשיות)</Label>
                <Select
                  value={selectedBranchForNewTable || '__main__'}
                  onValueChange={(value) => setSelectedBranchForNewTable(value === '__main__' ? null : value)}
                >
                  <SelectTrigger id="import-branch-select">
                    <SelectValue placeholder="ראשי" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__main__">ראשי</SelectItem>
                    {getUniqueBranches()
                      .filter(b => b !== null)
                      .map((branch) => (
                        <SelectItem key={branch!} value={branch!}>
                          {branch}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Input
                  className="mt-2"
                  value={selectedBranchForNewTable || ''}
                  onChange={(e) => setSelectedBranchForNewTable(e.target.value.trim() || null)}
                  placeholder="או הקלד שם תחום חדש"
                />
              </div>
              <div>
                <Label>קובץ CSV מ-Google Sheets</Label>
                <div className="mt-2">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="csv-file-input"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('csv-file-input')?.click()}
                    className="w-full gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    {csvFile ? csvFile.name : 'בחר קובץ CSV'}
                  </Button>
                  {csvFile && (
                    <p className="text-sm text-grey mt-2">
                      נבחר: {csvFile.name} ({(csvFile.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                </div>
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-900 font-medium mb-1">איך לייצא מ-Google Sheets:</p>
                  <ol className="text-xs text-blue-800 list-decimal list-inside space-y-1">
                    <li>פתח את Google Sheets</li>
                    <li>עבור ל: קובץ → הורד → ערכים מופרדים בפסיקים (.csv)</li>
                    <li>בחר את הקובץ שהורד</li>
                  </ol>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false)
                setNewModuleName('')
                setCsvFile(null)
                setImportMode('create')
              }}
            >
              ביטול
            </Button>
            {importMode === 'create' ? (
              <Button onClick={handleCreateModule} disabled={creating || (!useDefaultSchema && !newModuleName.trim()) || (useDefaultSchema && !selectedDefaultSchema)}>
                {creating ? 'יוצר...' : useDefaultSchema ? 'החל טבלת ברירת מחדל' : 'צור טבלה'}
              </Button>
            ) : (
              <Button onClick={handleImportFromCSV} disabled={importing || !newModuleName.trim() || !csvFile}>
                {importing ? 'מייבא...' : 'ייבא וצור טבלה'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

