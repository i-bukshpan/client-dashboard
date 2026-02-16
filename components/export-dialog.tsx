'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Download, FileSpreadsheet, FileText } from 'lucide-react'
import type { ClientDataRecord, ColumnDefinition } from '@/lib/supabase'
import { formatDateForCSV } from '@/lib/utils/date-utils'

interface ExportDialogProps {
    records: ClientDataRecord[]
    columns: ColumnDefinition[]
    moduleName: string
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function ExportDialog({ records, columns, moduleName, open, onOpenChange }: ExportDialogProps) {
    const [exporting, setExporting] = useState(false)

    const exportToCSV = () => {
        setExporting(true)
        try {
            // יצירת headers
            const headers = columns.map((col) => col.label || col.name).join(',')

            // יצירת rows
            const rows = records.map((record) => {
                return columns
                    .map((col) => {
                        const value = record.data[col.name]
                        // Handle dates with proper formatting
                        if (col.type === 'date' && value) {
                            return formatDateForCSV(value)
                        }
                        // Escape commas and quotes
                        if (value === null || value === undefined) return ''
                        const stringValue = String(value)
                        if (stringValue.includes(',') || stringValue.includes('"')) {
                            return `"${stringValue.replace(/"/g, '""')}"`
                        }
                        return stringValue
                    })
                    .join(',')
            })

            const csv = [headers, ...rows].join('\n')

            // יצירת BOM ל-UTF-8 (תמיכה בעברית ב-Excel)
            const BOM = '\uFEFF'
            const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)

            const link = document.createElement('a')
            link.href = url
            link.download = `${moduleName}_${new Date().toISOString().split('T')[0]}.csv`
            link.click()

            URL.revokeObjectURL(url)
            onOpenChange(false)
        } catch (error) {
            console.error('Error exporting CSV:', error)
            alert('שגיאה בייצוא CSV')
        } finally {
            setExporting(false)
        }
    }

    const exportToJSON = () => {
        setExporting(true)
        try {
            const data = records.map((record) => {
                const row: Record<string, any> = { id: record.id }
                columns.forEach((col) => {
                    row[col.name] = record.data[col.name]
                })
                return row
            })

            const json = JSON.stringify(data, null, 2)
            const blob = new Blob([json], { type: 'application/json' })
            const url = URL.createObjectURL(blob)

            const link = document.createElement('a')
            link.href = url
            link.download = `${moduleName}_${new Date().toISOString().split('T')[0]}.json`
            link.click()

            URL.revokeObjectURL(url)
            onOpenChange(false)
        } catch (error) {
            console.error('Error exporting JSON:', error)
            alert('שגיאה בייצוא JSON')
        } finally {
            setExporting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent dir="rtl" className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>ייצוא נתונים</DialogTitle>
                    <p className="text-sm text-grey">
                        {records.length} רשומות מוכנות לייצוא
                    </p>
                </DialogHeader>

                <div className="space-y-3 py-4">
                    <Button
                        onClick={exportToCSV}
                        disabled={exporting}
                        className="w-full justify-start gap-3"
                        variant="outline"
                    >
                        <FileSpreadsheet className="h-5 w-5 text-green-600" />
                        <div className="text-right">
                            <div className="font-medium">ייצא ל-CSV/Excel</div>
                            <div className="text-xs text-grey">מתאים ל-Excel וגיליונות אלקטרוניים</div>
                        </div>
                    </Button>

                    <Button
                        onClick={exportToJSON}
                        disabled={exporting}
                        className="w-full justify-start gap-3"
                        variant="outline"
                    >
                        <FileText className="h-5 w-5 text-blue-600" />
                        <div className="text-right">
                            <div className="font-medium">ייצא ל-JSON</div>
                            <div className="text-xs text-grey">מתאים למפתחים ו-APIs</div>
                        </div>
                    </Button>
                </div>

                <div className="text-xs text-grey text-center">
                    הקובץ יורד אוטומטית למחשב שלך
                </div>
            </DialogContent>
        </Dialog>
    )
}
