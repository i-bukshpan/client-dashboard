'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Upload, FileSpreadsheet, Check, X } from 'lucide-react'
import type { ColumnDefinition } from '@/lib/supabase'
import { parseDateFromCSV } from '@/lib/utils/date-utils'
import { addRecordsBulk } from '@/lib/actions/data-records'
import { useToast } from '@/components/ui/toast'

interface CSVImportDialogProps {
    clientId: string
    moduleType: string
    columns: ColumnDefinition[]
    open: boolean
    onOpenChange: (open: boolean) => void
    onImportComplete: () => void
}

interface ParsedRow {
    [key: string]: any
}

/**
 * Parse CSV content with proper handling of quoted fields
 */
function parseCSV(csvText: string): string[][] {
    const rows: string[][] = []
    const lines = csvText.split(/\r?\n/)

    for (const line of lines) {
        if (!line.trim() && line.indexOf(',') === -1) continue

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

            if ((char === ',' || char === null) && !insideQuotes) {
                row.push(currentField.trim())
                currentField = ''
                if (char === null) break
                continue
            }

            if (char !== null) {
                currentField += char
            }
        }

        rows.push(row)
    }

    return rows
}

/**
 * Detect if a column contains dates based on sample values
 */
function detectDateColumn(values: string[]): boolean {
    const sampleSize = Math.min(values.length, 10)
    let dateCount = 0

    for (let i = 0; i < sampleSize; i++) {
        const value = values[i]
        if (!value || value.trim() === '') continue

        const parsed = parseDateFromCSV(value)
        if (parsed) {
            dateCount++
        }
    }

    // If more than 50% of samples are valid dates, it's likely a date column
    return dateCount > 0 && (dateCount / sampleSize) > 0.5
}

export function CSVImportDialog({
    clientId,
    moduleType,
    columns,
    open,
    onOpenChange,
    onImportComplete,
}: CSVImportDialogProps) {
    const { showToast } = useToast()
    const [file, setFile] = useState<File | null>(null)
    const [csvData, setCSVData] = useState<string[][] | null>(null)
    const [columnMapping, setColumnMapping] = useState<Record<string, string>>({})
    const [detectedDateColumns, setDetectedDateColumns] = useState<Set<string>>(new Set())
    const [importing, setImporting] = useState(false)
    const [step, setStep] = useState<'upload' | 'mapping' | 'importing'>('upload')

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (!selectedFile) return

        if (!selectedFile.name.endsWith('.csv')) {
            showToast('error', 'אנא בחר קובץ CSV')
            return
        }

        setFile(selectedFile)

        // Read file
        const reader = new FileReader()
        reader.onload = (event) => {
            let csvText = event.target?.result as string

            // Remove BOM if present
            if (csvText.charCodeAt(0) === 0xFEFF) {
                csvText = csvText.slice(1)
            }

            const rows = parseCSV(csvText.trim())
            if (rows.length === 0) {
                showToast('error', 'קובץ CSV ריק')
                return
            }

            console.log(`🔍 CSV file loaded: ${rows.length} rows (including header)`)
            console.log(`🔍 First row (headers): ${rows[0].join(' | ')}`)

            setCSVData(rows)

            // Auto-detect column mapping
            const headers = rows[0].filter(h => h && h.trim()) // Remove empty headers from trailing commas
            const dataRows = rows.slice(1).map(row => row.slice(0, headers.length)) // Trim rows to match headers
            const mapping: Record<string, string> = {}
            const dateColumns = new Set<string>()

            headers.forEach((header, index) => {
                // Skip empty headers
                if (!header || !header.trim()) return

                // Try to find matching column by name
                const matchingColumn = columns.find(
                    col => col.label === header || col.name === header
                )

                if (matchingColumn) {
                    mapping[header] = matchingColumn.name
                } else {
                    // Use header as-is if no match found
                    mapping[header] = header
                }

                // Detect date columns
                const columnValues = dataRows.map(row => row[index] || '')
                if (detectDateColumn(columnValues)) {
                    dateColumns.add(header)
                }
            })

            setColumnMapping(mapping)
            setDetectedDateColumns(dateColumns)
            setStep('mapping')
        }

        reader.onerror = () => {
            showToast('error', 'שגיאה בקריאת הקובץ')
        }

        reader.readAsText(selectedFile)
    }, [columns, showToast])

    const handleImport = useCallback(async () => {
        console.log('🚀 handleImport called!')

        if (!csvData || csvData.length < 2) {
            showToast('error', 'אין נתונים לייבוא')
            return
        }

        // Prevent multiple simultaneous imports
        if (importing) {
            console.warn('Import already in progress')
            return
        }

        setImporting(true)
        setStep('importing')

        try {
            // Use filtered headers (without empty columns from trailing commas)
            const headers = csvData[0].filter(h => h && h.trim())
            const dataRows = csvData.slice(1).map(row => row.slice(0, headers.length))

            console.log(`CSV Headers: ${headers.join(', ')}`)
            console.log(`Detected date columns: ${Array.from(detectedDateColumns).join(', ')}`)

            const parsedRows: ParsedRow[] = []

            for (const row of dataRows) {
                if (row.length === 0 || row.every(cell => !cell || cell.trim() === '')) {
                    continue // Skip empty rows
                }

                const rowData: ParsedRow = {}

                headers.forEach((header, index) => {
                    const mappedColumnName = columnMapping[header]
                    if (!mappedColumnName) return

                    const cellValue = row[index]?.trim() || ''

                    // Find column definition
                    const colDef = columns.find(col => col.name === mappedColumnName)

                    // Parse value based on type
                    if (colDef?.type === 'date' || detectedDateColumns.has(header)) {
                        if (!cellValue) return // Skip empty dates

                        const parsedDate = parseDateFromCSV(cellValue)
                        if (parsedDate) {
                            rowData[mappedColumnName] = parsedDate.toISOString()
                        } else {
                            console.warn(`Failed to parse date: "${cellValue}" in column "${header}"`)
                        }
                    } else if (colDef?.type === 'number') {
                        if (!cellValue) return // Skip empty numbers

                        // Remove commas and parse number (e.g., "12,270.00" → 12270.00)
                        const cleanedValue = cellValue.replace(/,/g, '')
                        const num = parseFloat(cleanedValue)
                        if (!isNaN(num)) {
                            rowData[mappedColumnName] = num
                        }
                    } else {
                        if (!cellValue) return // Skip empty text
                        rowData[mappedColumnName] = cellValue
                    }
                })

                if (Object.keys(rowData).length > 0) {
                    parsedRows.push(rowData)
                }
            }

            if (parsedRows.length === 0) {
                showToast('error', 'לא נמצאו רשומות תקינות לייבוא')
                setImporting(false)
                return
            }

            console.log(`Starting import of ${parsedRows.length} rows`)

            // Import in chunks of 50 to avoid payload size issues
            const chunkSize = 50
            let importedCount = 0
            let errorCount = 0

            for (let i = 0; i < parsedRows.length; i += chunkSize) {
                const chunk = parsedRows.slice(i, i + chunkSize)
                console.log(`Importing chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(parsedRows.length / chunkSize)}`)

                const result = await addRecordsBulk(clientId, moduleType, chunk)

                if (result.success) {
                    importedCount += result.inserted || 0
                    console.log(`Chunk imported successfully: ${result.inserted} records`)
                } else {
                    errorCount += chunk.length
                    console.error('Error importing chunk:', result.error)
                }
            }

            if (errorCount > 0) {
                showToast('warning', `${importedCount} רשומות יובאו בהצלחה, ${errorCount} נכשלו`)
            } else {
                showToast('success', `${importedCount} רשומות יובאו בהצלחה`)
            }

            console.log(`Import completed: ${importedCount} success, ${errorCount} errors`)

            // Refresh the data
            onImportComplete()
            handleClose()
        } catch (error: any) {
            console.error('Error importing CSV:', error)
            showToast('error', error.message || 'שגיאה בייבוא CSV')
            setImporting(false)
        }
    }, [csvData, columnMapping, detectedDateColumns, columns, clientId, moduleType, importing, showToast, onImportComplete])

    const handleClose = useCallback(() => {
        setFile(null)
        setCSVData(null)
        setColumnMapping({})
        setDetectedDateColumns(new Set())
        setStep('upload')
        onOpenChange(false)
    }, [onOpenChange])

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent dir="rtl" className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5 text-emerald" />
                        ייבוא נתונים מ-CSV
                    </DialogTitle>
                </DialogHeader>

                {step === 'upload' && (
                    <div className="space-y-4 py-4">
                        <div className="text-sm text-grey space-y-2">
                            <p>• העלה קובץ CSV עם כותרות בשורה הראשונה</p>
                            <p>• תאריכים צריכים להיות בפורמט DD/MM/YYYY (לדוגמה: 03/01/2026)</p>
                            <p>• המערכת תזהה אוטומטית עמודות תאריך</p>
                        </div>

                        <div className="border-2 border-dashed border-grey/30 rounded-lg p-8 text-center">
                            <Input
                                type="file"
                                accept=".csv"
                                onChange={handleFileChange}
                                className="hidden"
                                id="csv-upload"
                            />
                            <Label htmlFor="csv-upload" className="cursor-pointer">
                                <div className="flex flex-col items-center gap-2">
                                    <Upload className="h-12 w-12 text-grey" />
                                    <p className="text-sm font-medium">לחץ לבחירת קובץ CSV</p>
                                    {file && (
                                        <p className="text-xs text-emerald mt-2">
                                            <Check className="inline h-4 w-4" /> {file.name}
                                        </p>
                                    )}
                                </div>
                            </Label>
                        </div>
                    </div>
                )}

                {step === 'mapping' && csvData && (
                    <div className="space-y-4 py-4">
                        <div className="text-sm text-grey">
                            <p>נמצאו {csvData.length - 1} רשומות</p>
                            {detectedDateColumns.size > 0 && (
                                <p className="text-emerald mt-1">
                                    ✓ זוהו {detectedDateColumns.size} עמודות תאריך
                                </p>
                            )}
                        </div>

                        <div className="max-h-60 overflow-y-auto border rounded p-2">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b">
                                        <th className="p-2 text-right">עמודה ב-CSV</th>
                                        <th className="p-2 text-right">טיפוס</th>
                                        <th className="p-2 text-right">דוגמה</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {csvData[0].map((header, index) => (
                                        <tr key={index} className="border-b">
                                            <td className="p-2 font-medium">{header}</td>
                                            <td className="p-2">
                                                {detectedDateColumns.has(header) ? (
                                                    <span className="text-emerald">📅 תאריך</span>
                                                ) : (
                                                    <span className="text-grey">טקסט</span>
                                                )}
                                            </td>
                                            <td className="p-2 text-grey text-xs">
                                                {csvData[1]?.[index] || '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex gap-2">
                            <Button onClick={handleImport} className="flex-1" disabled={importing}>
                                <Upload className="h-4 w-4 ml-2" />
                                ייבא {csvData.length - 1} רשומות
                            </Button>
                            <Button onClick={handleClose} variant="outline" disabled={importing}>
                                ביטול
                            </Button>
                        </div>
                    </div>
                )}

                {step === 'importing' && (
                    <div className="py-8 text-center">
                        <div className="animate-spin h-12 w-12 border-4 border-emerald border-t-transparent rounded-full mx-auto mb-4"></div>
                        <p className="text-grey">מייבא נתונים...</p>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
