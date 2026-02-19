'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, X, FileImage, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'

export interface InvoiceItem {
    desc: string
    qty: number
    price: number
    total: number
}

export interface InvoiceData {
    amount: number | null
    payment_date: string | null
    payment_method: string | null
    description: string | null
    payment_type: 'income' | 'expense' | 'other' | null
    category: string | null
    vendor_name: string | null
    invoice_number: string | null
    // Full OCR data
    supplier?: {
        name: string | null
        vat_id: string | null
        address: string | null
    }
    invoice_meta?: {
        number: string | null
        date: string | null
        currency: string | null
    }
    items?: InvoiceItem[]
    totals?: {
        subtotal: number | null
        vat_amount: number | null
        grand_total: number | null
    }
}

interface InvoiceUploadProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onDataExtracted: (data: InvoiceData) => void
    onBranchBreakdown?: (data: InvoiceData) => void
}

export function InvoiceUpload({ open, onOpenChange, onDataExtracted, onBranchBreakdown }: InvoiceUploadProps) {
    const [file, setFile] = useState<File | null>(null)
    const [preview, setPreview] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [extractedData, setExtractedData] = useState<InvoiceData | null>(null)
    const [isDragging, setIsDragging] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFile = useCallback((selectedFile: File) => {
        setFile(selectedFile)
        setError(null)
        setExtractedData(null)

        // Create preview
        if (selectedFile.type.startsWith('image/')) {
            const reader = new FileReader()
            reader.onload = (e) => setPreview(e.target?.result as string)
            reader.readAsDataURL(selectedFile)
        } else {
            setPreview(null)
        }
    }, [])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        const droppedFile = e.dataTransfer.files[0]
        if (droppedFile) handleFile(droppedFile)
    }, [handleFile])

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
    }, [])

    const handleScan = async () => {
        if (!file) return

        setLoading(true)
        setError(null)

        try {
            const formData = new FormData()
            formData.append('invoice', file)

            const response = await fetch('/api/ocr-invoice', {
                method: 'POST',
                body: formData,
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.error || 'שגיאה בעיבוד החשבונית')
            }

            setExtractedData(result.data)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'שגיאה לא ידועה')
        } finally {
            setLoading(false)
        }
    }

    const handleConfirm = () => {
        if (extractedData) {
            onDataExtracted(extractedData)
            resetState()
            onOpenChange(false)
        }
    }

    const resetState = () => {
        setFile(null)
        setPreview(null)
        setLoading(false)
        setError(null)
        setExtractedData(null)
        setIsDragging(false)
    }

    const handleClose = (isOpen: boolean) => {
        if (!isOpen) resetState()
        onOpenChange(isOpen)
    }

    const paymentTypeLabels: Record<string, string> = {
        income: 'הכנסה',
        expense: 'הוצאה',
        subscription: 'מנוי',
        salary: 'משכורת',
        rent: 'שכר דירה',
        utility: 'שירותים',
        other: 'אחר',
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent dir="rtl" className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileImage className="h-5 w-5 text-blue-600" />
                        סריקת חשבונית
                    </DialogTitle>
                    <DialogDescription>
                        העלה תמונה של חשבונית והמערכת תזהה את הנתונים אוטומטית
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Upload Zone */}
                    {!file && (
                        <div
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onClick={() => fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${isDragging
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-grey/30 hover:border-blue-400 hover:bg-blue-50/50'
                                }`}
                        >
                            <Upload className="h-10 w-10 mx-auto mb-3 text-grey/60" />
                            <p className="text-sm font-medium text-navy">
                                גרור תמונה לכאן או לחץ לבחירה
                            </p>
                            <p className="text-xs text-grey mt-1">
                                JPG, PNG, WebP או PDF
                            </p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                                onChange={(e) => {
                                    const selectedFile = e.target.files?.[0]
                                    if (selectedFile) handleFile(selectedFile)
                                }}
                                className="hidden"
                            />
                        </div>
                    )}

                    {/* File Preview */}
                    {file && (
                        <div className="relative">
                            <div className="flex items-center justify-between p-3 bg-grey/5 rounded-lg border">
                                <div className="flex items-center gap-2 min-w-0">
                                    <FileImage className="h-5 w-5 text-blue-600 flex-shrink-0" />
                                    <span className="text-sm font-medium truncate">{file.name}</span>
                                    <span className="text-xs text-grey flex-shrink-0">
                                        ({(file.size / 1024).toFixed(0)} KB)
                                    </span>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setFile(null)
                                        setPreview(null)
                                        setExtractedData(null)
                                        setError(null)
                                    }}
                                    className="text-grey hover:text-red-600"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                            {preview && (
                                <div className="mt-2 rounded-lg overflow-hidden border max-h-48 flex items-center justify-center bg-grey/5">
                                    <img
                                        src={preview}
                                        alt="תצוגה מקדימה"
                                        className="max-h-48 object-contain"
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Loading */}
                    {loading && (
                        <div className="flex items-center justify-center gap-3 py-4">
                            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                            <span className="text-sm text-grey">מעבד את החשבונית...</span>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm text-red-700">{error}</p>
                                <Button
                                    variant="link"
                                    size="sm"
                                    className="text-red-600 p-0 h-auto mt-1"
                                    onClick={handleScan}
                                >
                                    נסה שוב
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Extracted Data Preview */}
                    {extractedData && (
                        <div className="space-y-2 p-4 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-center gap-2 mb-3">
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                                <span className="text-sm font-semibold text-green-800">נתונים זוהו בהצלחה</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                {extractedData.amount != null && (
                                    <div>
                                        <span className="text-grey">סכום:</span>{' '}
                                        <span className="font-medium">₪{extractedData.amount.toLocaleString('he-IL')}</span>
                                    </div>
                                )}
                                {extractedData.payment_date && (
                                    <div>
                                        <span className="text-grey">תאריך:</span>{' '}
                                        <span className="font-medium">{new Date(extractedData.payment_date).toLocaleDateString('he-IL')}</span>
                                    </div>
                                )}
                                {extractedData.payment_method && (
                                    <div>
                                        <span className="text-grey">אמצעי תשלום:</span>{' '}
                                        <span className="font-medium">{extractedData.payment_method}</span>
                                    </div>
                                )}
                                {extractedData.payment_type && (
                                    <div>
                                        <span className="text-grey">סוג:</span>{' '}
                                        <span className="font-medium">{paymentTypeLabels[extractedData.payment_type] || extractedData.payment_type}</span>
                                    </div>
                                )}
                                {extractedData.category && (
                                    <div>
                                        <span className="text-grey">קטגוריה:</span>{' '}
                                        <span className="font-medium">{extractedData.category}</span>
                                    </div>
                                )}
                                {extractedData.vendor_name && (
                                    <div>
                                        <span className="text-grey">ספק:</span>{' '}
                                        <span className="font-medium">{extractedData.vendor_name}</span>
                                    </div>
                                )}
                                {extractedData.description && (
                                    <div className="col-span-2">
                                        <span className="text-grey">תיאור:</span>{' '}
                                        <span className="font-medium">{extractedData.description}</span>
                                    </div>
                                )}
                                {extractedData.invoice_number && (
                                    <div>
                                        <span className="text-grey">מס׳ חשבונית:</span>{' '}
                                        <span className="font-medium">{extractedData.invoice_number}</span>
                                    </div>
                                )}
                                {extractedData.items && extractedData.items.length > 0 && (
                                    <div className="col-span-2">
                                        <span className="text-grey">פריטים:</span>{' '}
                                        <span className="font-medium">{extractedData.items.length} שורות</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2">
                    <Button
                        variant="outline"
                        onClick={() => handleClose(false)}
                        disabled={loading}
                    >
                        ביטול
                    </Button>
                    {file && !extractedData && !loading && (
                        <Button onClick={handleScan} className="gap-2">
                            <FileImage className="h-4 w-4" />
                            סרוק חשבונית
                        </Button>
                    )}
                    {extractedData && (
                        <>
                            <Button onClick={handleConfirm} className="gap-2 bg-green-600 hover:bg-green-700">
                                <CheckCircle2 className="h-4 w-4" />
                                השתמש בנתונים
                            </Button>
                            {onBranchBreakdown && extractedData.items && extractedData.items.length > 0 && (
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        onBranchBreakdown(extractedData)
                                        resetState()
                                        onOpenChange(false)
                                    }}
                                    className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
                                >
                                    פירוט לפי סניפים
                                </Button>
                            )}
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
