'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { getRecordHistory, type HistoryEntry } from '@/lib/actions/history'
import { Clock, User, ArrowRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { he } from 'date-fns/locale'

interface RecordTimelineProps {
    recordId: string
    tableName: string
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function RecordTimeline({ recordId, tableName, open, onOpenChange }: RecordTimelineProps) {
    const [history, setHistory] = useState<HistoryEntry[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (open && recordId) {
            loadHistory()
        }
    }, [open, recordId])

    const loadHistory = async () => {
        setLoading(true)
        const result = await getRecordHistory(recordId)
        if (result.success && result.history) {
            setHistory(result.history)
        }
        setLoading(false)
    }

    const getChangeTypeColor = (type: string) => {
        switch (type) {
            case 'create':
                return 'bg-green-100 text-green-700'
            case 'update':
                return 'bg-blue-100 text-blue-700'
            case 'delete':
                return 'bg-red-100 text-red-700'
            default:
                return 'bg-grey/20 text-grey'
        }
    }

    const formatValue = (value: string | null) => {
        if (value === null || value === 'null' || value === '') return '(ריק)'
        return value
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-xl">היסטוריית שינויים</DialogTitle>
                    <p className="text-sm text-grey">
                        טבלה: <span className="font-medium">{tableName}</span>
                    </p>
                </DialogHeader>

                {loading ? (
                    <div className="py-8 text-center">
                        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
                        <p className="mt-4 text-grey">טוען היסטוריה...</p>
                    </div>
                ) : history.length === 0 ? (
                    <div className="py-12 text-center">
                        <Clock className="h-12 w-12 text-grey/50 mx-auto mb-4" />
                        <p className="text-grey">אין היסטוריית שינויים לרשומה זו</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Timeline */}
                        <div className="relative">
                            {/* Vertical line */}
                            <div className="absolute right-4 top-0 bottom-0 w-0.5 bg-grey/20"></div>

                            {/* Timeline items */}
                            <div className="space-y-6">
                                {history.map((entry, index) => (
                                    <div key={entry.id} className="relative pr-12">
                                        {/* Timeline dot */}
                                        <div className="absolute right-2.5 top-1.5 h-4 w-4 rounded-full bg-blue-500 border-4 border-white"></div>

                                        {/* Content */}
                                        <div className="bg-white border rounded-lg p-4 shadow-sm">
                                            {/* Header */}
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span
                                                        className={`px-2 py-0.5 rounded text-xs font-medium ${getChangeTypeColor(
                                                            entry.change_type
                                                        )}`}
                                                    >
                                                        {entry.change_type === 'create'
                                                            ? 'נוצר'
                                                            : entry.change_type === 'update'
                                                                ? 'עודכן'
                                                                : 'נמחק'}
                                                    </span>
                                                    <span className="text-sm font-medium text-navy">{entry.field_name}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-grey">
                                                    <User className="h-3 w-3" />
                                                    <span>{entry.changed_by}</span>
                                                </div>
                                            </div>

                                            {/* Change details */}
                                            {entry.change_type !== 'create' && (
                                                <div className="flex items-center gap-3 text-sm">
                                                    <div className="flex-1 bg-red-50 border border-red-200 rounded px-3 py-2">
                                                        <div className="text-xs text-red-600 mb-1">ערך קודם:</div>
                                                        <div className="text-red-700 font-mono break-all">
                                                            {formatValue(entry.old_value)}
                                                        </div>
                                                    </div>
                                                    <ArrowRight className="h-4 w-4 text-grey shrink-0" />
                                                    <div className="flex-1 bg-green-50 border border-green-200 rounded px-3 py-2">
                                                        <div className="text-xs text-green-600 mb-1">ערך חדש:</div>
                                                        <div className="text-green-700 font-mono break-all">
                                                            {formatValue(entry.new_value)}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Timestamp */}
                                            <div className="mt-3 flex items-center gap-1 text-xs text-grey">
                                                <Clock className="h-3 w-3" />
                                                <span>
                                                    {formatDistanceToNow(new Date(entry.changed_at), {
                                                        addSuffix: true,
                                                        locale: he,
                                                    })}
                                                </span>
                                                <span className="text-grey/50">•</span>
                                                <span>{new Date(entry.changed_at).toLocaleString('he-IL')}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Summary */}
                        <div className="pt-4 border-t">
                            <div className="text-sm text-grey text-center">
                                סה"כ {history.length} שינויים נרשמו
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex justify-end pt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        סגור
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
