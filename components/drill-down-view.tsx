'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ExternalLink, ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface DrillDownViewProps {
    sourceRecord: any
    relationship: {
        id: string
        source_module: string
        target_module: string
        source_key: string
        target_key: string
        relationship_type: string
        aggregate_function?: string | null
        aggregate_field?: string | null
        aggregate_label?: string | null
    }
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function DrillDownView({ sourceRecord, relationship, open, onOpenChange }: DrillDownViewProps) {
    const [relatedRecords, setRelatedRecords] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [aggregates, setAggregates] = useState<Record<string, number>>({})

    useEffect(() => {
        if (open && sourceRecord) {
            loadRelatedRecords()
        }
    }, [open, sourceRecord])

    const loadRelatedRecords = async () => {
        setLoading(true)
        try {
            const sourceValue = sourceRecord[relationship.source_key] || sourceRecord.data?.[relationship.source_key]

            const { data, error } = await supabase
                .from(relationship.target_module)
                .select('*')
                .eq(relationship.target_key, sourceValue)

            if (error) throw error

            setRelatedRecords(data || [])

            // Calculate aggregates
            if (relationship.aggregate_function && relationship.aggregate_field && data) {
                const values = data.map(r => {
                    const val = r[relationship.aggregate_field!] || r.data?.[relationship.aggregate_field!]
                    return typeof val === 'number' ? val : parseFloat(String(val || 0))
                }).filter(v => !isNaN(v))

                let result = 0
                switch (relationship.aggregate_function) {
                    case 'COUNT':
                        result = data.length
                        break
                    case 'SUM':
                        result = values.reduce((sum, v) => sum + v, 0)
                        break
                    case 'AVG':
                        result = values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0
                        break
                }

                setAggregates({
                    [relationship.aggregate_label || relationship.aggregate_function]: result
                })
            }
        } catch (error) {
            console.error('Error loading related records:', error)
        } finally {
            setLoading(false)
        }
    }

    const getRecordDisplayValue = (record: any, field: string) => {
        const value = record[field] || record.data?.[field]
        if (value === null || value === undefined) return '-'
        if (typeof value === 'object') return JSON.stringify(value)
        return String(value)
    }

    const getRecordFields = (record: any): string[] => {
        const fields = new Set<string>()

        // Direct fields
        Object.keys(record).forEach(key => {
            if (key !== 'data' && key !== 'id' && key !== 'client_id' && key !== 'created_at' && key !== 'updated_at') {
                fields.add(key)
            }
        })

        // Data object fields
        if (record.data && typeof record.data === 'object') {
            Object.keys(record.data).forEach(key => fields.add(key))
        }

        return Array.from(fields).slice(0, 5) // Limit to 5 fields for display
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ArrowLeft className="h-5 w-5" />
                        {relationship.source_module} → {relationship.target_module}
                    </DialogTitle>
                    <p className="text-sm text-grey">
                        {relationship.relationship_type === '1:N'
                            ? 'כל הרשומות המקושרות'
                            : 'רשומה מקושרת'
                        }
                    </p>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Source Record Info */}
                    <Card className="p-4 bg-blue-50 border-blue-200">
                        <h4 className="font-medium text-navy mb-2">רשומת מקור</h4>
                        <div className="text-sm space-y-1">
                            {getRecordFields(sourceRecord).map((field) => (
                                <div key={field} className="flex gap-2">
                                    <span className="text-grey font-medium min-w-[120px]">{field}:</span>
                                    <span>{getRecordDisplayValue(sourceRecord, field)}</span>
                                </div>
                            ))}
                        </div>
                    </Card>

                    {/* Aggregates */}
                    {Object.keys(aggregates).length > 0 && (
                        <div className="grid grid-cols-3 gap-3">
                            {Object.entries(aggregates).map(([label, value]) => (
                                <Card key={label} className="p-4 bg-gradient-to-br from-purple-50 to-blue-50">
                                    <div className="text-xs text-grey mb-1">{label}</div>
                                    <div className="text-2xl font-bold text-navy">
                                        {typeof value === 'number' ? value.toLocaleString('he-IL') : value}
                                    </div>
                                </Card>
                            ))}
                            {relatedRecords.length > 0 && (
                                <Card className="p-4 bg-gradient-to-br from-green-50 to-emerald-50">
                                    <div className="text-xs text-grey mb-1">סה"כ רשומות</div>
                                    <div className="text-2xl font-bold text-navy">{relatedRecords.length}</div>
                                </Card>
                            )}
                        </div>
                    )}

                    {/* Related Records */}
                    <div>
                        <h4 className="font-medium text-navy mb-3">
                            רשומות מקושרות ({relatedRecords.length})
                        </h4>

                        {loading ? (
                            <div className="text-center py-8 text-grey">טוען...</div>
                        ) : relatedRecords.length === 0 ? (
                            <div className="text-center py-8 text-grey bg-grey/5 rounded-lg">
                                <p>אין רשומות מקושרות</p>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                {relatedRecords.map((record, idx) => {
                                    const fields = getRecordFields(record)
                                    return (
                                        <Card key={record.id || idx} className="p-3 hover:shadow-md transition-shadow">
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                                                {fields.map((field) => (
                                                    <div key={field}>
                                                        <span className="text-grey text-xs block">{field}</span>
                                                        <span className="font-medium">{getRecordDisplayValue(record, field)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </Card>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-end">
                    <Button onClick={() => onOpenChange(false)} variant="outline">
                        סגור
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
