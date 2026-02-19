'use client'

import { useState, useEffect } from 'react'
import {
    Loader2,
    CheckCircle2,
    AlertCircle,
    Building2,
    ArrowLeftRight,
    MessageSquare,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { getRecords, addRecord } from '@/lib/actions/data-records'
import { getClientSchemas } from '@/lib/actions/schema'
import type { InvoiceData } from './invoice-upload'
import type { ClientSchema, ClientDataRecord, ColumnDefinition } from '@/lib/supabase'

interface InvoiceBranchBreakdownProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    invoiceData: InvoiceData
    clientId: string
    branchName?: string | null
    schemas?: ClientSchema[]
    onComplete?: () => void
}


export function InvoiceBranchBreakdown({
    open,
    onOpenChange,
    invoiceData,
    clientId,
    branchName,
    schemas: schemasProp,
    onComplete,
}: InvoiceBranchBreakdownProps) {
    const { showToast } = useToast()
    const [step, setStep] = useState<'config' | 'processing' | 'review' | 'saving'>('config')

    // Internal schemas state (auto-loaded when not provided via props)
    const [internalSchemas, setInternalSchemas] = useState<ClientSchema[]>([])
    const _schemas = schemasProp || internalSchemas

    useEffect(() => {
        if (!schemasProp && open) {
            getClientSchemas(clientId).then(result => {
                if (result.success && result.schemas) {
                    setInternalSchemas(result.schemas)
                }
            })
        }
    }, [clientId, open, schemasProp])

    // Config state
    const [targetModule, setTargetModule] = useState<string>('')
    const [refModule, setRefModule] = useState<string>('')
    const [customPrompt, setCustomPrompt] = useState<string>('')
    const [showPrompt, setShowPrompt] = useState(false)

    // Result state
    const [records, setRecords] = useState<Record<string, any>[]>([])

    const [targetColumns, setTargetColumns] = useState<ColumnDefinition[]>([])
    const [error, setError] = useState<string | null>(null)

    const handleProcess = async () => {
        if (!targetModule) return
        setStep('processing')
        setError(null)

        try {
            // Get target table schema
            const targetSchema = _schemas.find((s: ClientSchema) => s.module_name === targetModule)
            if (!targetSchema) {
                setError('לא נמצאה טבלת היעד')
                setStep('config')
                return
            }

            const cols = targetSchema.columns || []
            setTargetColumns(cols)

            // Get reference data if selected
            let referenceData: any[] = []
            if (refModule && refModule !== '__none__') {
                const refResult = await getRecords(clientId, refModule)
                if (refResult.success && refResult.records) {
                    // Include both column schema info and actual data
                    const refSchema = _schemas.find((s: ClientSchema) => s.module_name === refModule)
                    referenceData = refResult.records.map((r: ClientDataRecord) => {
                        const row: Record<string, any> = {}
                        if (refSchema?.columns) {
                            for (const col of refSchema.columns) {
                                // Use label as key for clarity in the prompt
                                row[col.label || col.name] = r.data?.[col.name] ?? ''
                            }
                        }
                        return row
                    })
                }
            }

            // Call the API
            const response = await fetch('/api/ocr-match-branches', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: invoiceData.items,
                    targetColumns: cols.map(c => ({ name: c.name, label: c.label, type: c.type })),
                    referenceData,
                    customPrompt: customPrompt.trim() || undefined,
                    invoiceMeta: {
                        vendor_name: invoiceData.vendor_name,
                        invoice_number: invoiceData.invoice_number,
                        payment_date: invoiceData.payment_date,
                        category: invoiceData.category,
                    },
                    invoiceTotals: invoiceData.totals,
                }),
            })

            const result = await response.json()
            if (!response.ok) {
                throw new Error(result.error || 'שגיאה בעיבוד')
            }

            setRecords(result.records || [])
            setStep('review')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'שגיאה לא ידועה')
            setStep('config')
        }
    }

    const handleCellEdit = (rowIndex: number, colName: string, value: string) => {
        setRecords(prev => prev.map((r, i) =>
            i === rowIndex ? { ...r, [colName]: value } : r
        ))
    }

    const handleSave = async () => {
        setStep('saving')
        try {
            let count = 0
            for (const record of records) {
                const result = await addRecord(clientId, targetModule, record)
                if (result.success) count++
            }

            if (count > 0) {
                showToast('success', `${count} רשומות נוספו בהצלחה ל-"${targetModule}"`)
                onOpenChange(false)
                onComplete?.()
            } else {
                showToast('error', 'לא הצלחנו לשמור רשומות')
                setStep('review')
            }
        } catch (err) {
            showToast('error', 'שגיאה בלתי צפויה בשמירה')
            setStep('review')
        }
    }

    const handleClose = (isOpen: boolean) => {
        if (!isOpen) {
            setStep('config')
            setTargetModule('')
            setRefModule('')
            setCustomPrompt('')
            setShowPrompt(false)
            setRecords([])
            setError(null)
        }
        onOpenChange(isOpen)
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent dir="rtl" className="max-w-3xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-blue-600" />
                        עיבוד חשבונית לטבלה
                    </DialogTitle>
                    <DialogDescription>
                        {invoiceData.vendor_name && `ספק: ${invoiceData.vendor_name} | `}
                        {invoiceData.invoice_number && `חשבונית: ${invoiceData.invoice_number} | `}
                        {invoiceData.items?.length} פריטים
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Step 1: Configuration */}
                    {step === 'config' && (
                        <div className="space-y-4">
                            {/* Target table */}
                            <div className="grid gap-2">
                                <Label className="font-semibold">טבלת יעד — לאן לשמור</Label>
                                <Select value={targetModule} onValueChange={setTargetModule}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="בחר טבלה..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {_schemas.map((s: ClientSchema) => (
                                            <SelectItem key={s.id} value={s.module_name}>
                                                {s.module_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Reference table (optional) */}
                            <div className="grid gap-2">
                                <Label className="font-semibold">
                                    טבלת עזר — לחיפוש נתונים
                                    <span className="text-grey font-normal mr-1">(אופציונלי)</span>
                                </Label>
                                <Select value={refModule} onValueChange={setRefModule}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="בחר טבלת עזר..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__none__">ללא</SelectItem>
                                        {_schemas
                                            .filter((s: ClientSchema) => s.module_name !== targetModule)
                                            .map((s: ClientSchema) => (
                                                <SelectItem key={s.id} value={s.module_name}>
                                                    {s.module_name}
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Custom prompt toggle + textarea */}
                            <div className="grid gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="w-fit gap-2"
                                    onClick={() => setShowPrompt(!showPrompt)}
                                >
                                    <MessageSquare className="h-4 w-4" />
                                    {showPrompt ? 'הסתר הוראות' : 'הוסף הוראות מותאמות'}
                                </Button>
                                {showPrompt && (
                                    <div className="space-y-1">
                                        <textarea
                                            className="w-full min-h-[100px] p-3 border rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            dir="rtl"
                                            placeholder={`כתוב הוראות בעברית, לדוגמא:\n"שייך כל פריט לסניף לפי כתובת IP מטבלת הסניפים. אם אין התאמה ישירה, חפש לפי שם המיקום."`}
                                            value={customPrompt}
                                            onChange={e => setCustomPrompt(e.target.value)}
                                        />
                                        <p className="text-xs text-grey">
                                            ההוראות יועברו ל-Gemini יחד עם נתוני החשבונית וטבלת העזר
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Show target table columns preview */}
                            {targetModule && (
                                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                                    <p className="font-medium text-blue-800 mb-1">עמודות בטבלת יעד:</p>
                                    <div className="flex flex-wrap gap-1">
                                        {_schemas.find((s: ClientSchema) => s.module_name === targetModule)?.columns?.map((c: ColumnDefinition, i: number) => (
                                            <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                                                {c.label || c.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {error && (
                                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-red-700">{error}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 2: Processing */}
                    {step === 'processing' && (
                        <div className="flex items-center justify-center gap-3 py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                            <span className="text-sm text-grey">מעבד פריטי חשבונית...</span>
                        </div>
                    )}

                    {/* Step 3: Review */}
                    {step === 'review' && (
                        <div className="space-y-3">
                            <p className="text-sm text-grey">
                                {records.length} רשומות נוצרו — ניתן לערוך לפני שמירה
                            </p>
                            <div className="border rounded-lg overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="text-right p-2 font-medium text-xs w-8">#</th>
                                            {targetColumns.map(col => (
                                                <th key={col.name} className="text-right p-2 font-medium text-xs whitespace-nowrap">
                                                    {col.label || col.name}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {records.map((record, rowIdx) => (
                                            <tr key={rowIdx} className="border-t hover:bg-gray-50/50">
                                                <td className="p-2 text-xs text-grey">{rowIdx + 1}</td>
                                                {targetColumns.map(col => (
                                                    <td key={col.name} className="p-1">
                                                        <input
                                                            className="w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                                                            dir="rtl"
                                                            value={record[col.name] ?? ''}
                                                            onChange={e => handleCellEdit(rowIdx, col.name, e.target.value)}
                                                        />
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Saving */}
                    {step === 'saving' && (
                        <div className="flex items-center justify-center gap-3 py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-green-600" />
                            <span className="text-sm text-grey">שומר {records.length} רשומות...</span>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2">
                    <Button
                        variant="outline"
                        onClick={() => handleClose(false)}
                        disabled={step === 'processing' || step === 'saving'}
                    >
                        ביטול
                    </Button>
                    {step === 'config' && targetModule && (
                        <Button onClick={handleProcess} className="gap-2">
                            <ArrowLeftRight className="h-4 w-4" />
                            עבד נתונים
                        </Button>
                    )}
                    {step === 'review' && (
                        <Button onClick={handleSave} className="gap-2 bg-green-600 hover:bg-green-700">
                            <CheckCircle2 className="h-4 w-4" />
                            שמור {records.length} רשומות ל-"{targetModule}"
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
