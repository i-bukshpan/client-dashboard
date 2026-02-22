'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { getClientActivityLogs, type ClientActivityLog } from '@/lib/actions/activity-logs'
import { format, formatDistanceToNow } from 'date-fns'
import { he } from 'date-fns/locale'
import { FileText, DollarSign, PlusCircle, RefreshCw, ScanLine, UserPlus, Key, Link2, Activity } from 'lucide-react'

interface TimelineProps {
    clientId: string
}

export function Timeline({ clientId }: TimelineProps) {
    const [logs, setLogs] = useState<ClientActivityLog[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function loadLogs() {
            setLoading(true)
            const result = await getClientActivityLogs(clientId)
            if (result.success && result.logs) {
                setLogs(result.logs)
            }
            setLoading(false)
        }
        loadLogs()
    }, [clientId])

    const getIconForActivity = (type: string) => {
        switch (type) {
            case 'NOTE_ADDED': return <FileText className="h-4 w-4 text-amber-500" />
            case 'PAYMENT_RECEIVED': return <DollarSign className="h-4 w-4 text-emerald-500" />
            case 'RECORD_CREATED': return <PlusCircle className="h-4 w-4 text-blue-500" />
            case 'STATUS_CHANGED': return <RefreshCw className="h-4 w-4 text-purple-500" />
            case 'INVOICE_SCANNED': return <ScanLine className="h-4 w-4 text-indigo-500" />
            case 'CLIENT_CREATED': return <UserPlus className="h-4 w-4 text-teal-500" />
            case 'CREDENTIAL_ADDED': return <Key className="h-4 w-4 text-slate-500" />
            case 'LINK_ADDED': return <Link2 className="h-4 w-4 text-pink-500" />
            default: return <Activity className="h-4 w-4 text-grey" />
        }
    }

    const getBgColorForActivity = (type: string) => {
        switch (type) {
            case 'NOTE_ADDED': return 'bg-amber-50'
            case 'PAYMENT_RECEIVED': return 'bg-emerald-50'
            case 'RECORD_CREATED': return 'bg-blue-50'
            case 'STATUS_CHANGED': return 'bg-purple-50'
            case 'INVOICE_SCANNED': return 'bg-indigo-50'
            case 'CLIENT_CREATED': return 'bg-teal-50'
            case 'CREDENTIAL_ADDED': return 'bg-slate-50'
            case 'LINK_ADDED': return 'bg-pink-50'
            default: return 'bg-slate-50'
        }
    }

    const getBorderColorForActivity = (type: string) => {
        switch (type) {
            case 'NOTE_ADDED': return 'border-amber-200'
            case 'PAYMENT_RECEIVED': return 'border-emerald-200'
            case 'RECORD_CREATED': return 'border-blue-200'
            case 'STATUS_CHANGED': return 'border-purple-200'
            case 'INVOICE_SCANNED': return 'border-indigo-200'
            case 'CLIENT_CREATED': return 'border-teal-200'
            case 'CREDENTIAL_ADDED': return 'border-slate-200'
            case 'LINK_ADDED': return 'border-pink-200'
            default: return 'border-slate-200'
        }
    }

    if (loading) {
        return (
            <div className="space-y-4 animate-pulse">
                {[1, 2, 3].map(i => (
                    <div key={i} className="flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-slate-200 shrink-0" />
                        <div className="flex-1 space-y-2 py-1">
                            <div className="h-4 bg-slate-200 rounded w-3/4" />
                            <div className="h-3 bg-slate-200 rounded w-1/4" />
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    if (logs.length === 0) {
        return (
            <div className="text-center py-8 text-grey">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p>אין עדיין היסטוריית פעילות ללקוח זה.</p>
                <p className="text-xs mt-1 text-slate-400">הפעילות תתעדכן ברגע שיווספו נתונים חדשים.</p>
            </div>
        )
    }

    return (
        <div className="relative border-r-2 border-slate-100 pr-5 ml-4 space-y-8 py-2">
            {logs.map((log) => {
                const date = new Date(log.created_at)
                return (
                    <div key={log.id} className="relative group">
                        <span className={`absolute -right-[29px] top-1 flex h-8 w-8 items-center justify-center rounded-full border ${getBgColorForActivity(log.activity_type)} ${getBorderColorForActivity(log.activity_type)} shadow-sm z-10 transition-transform group-hover:scale-110`}>
                            {getIconForActivity(log.activity_type)}
                        </span>
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-between gap-4">
                                <p className="text-sm font-bold text-navy">
                                    {log.description}
                                </p>
                                <time className="text-xs text-slate-400 flex-shrink-0" dateTime={log.created_at}>
                                    {formatDistanceToNow(date, { addSuffix: true, locale: he })}
                                </time>
                            </div>
                            <p className="text-xs text-slate-500" title={format(date, 'dd/MM/yyyy HH:mm')}>
                                {format(date, 'dd/MM/yyyy HH:mm')}
                            </p>

                            {/* Optional metadata display */}
                            {log.metadata && Object.keys(log.metadata).length > 0 && (
                                <div className="mt-2 bg-slate-50/80 rounded-lg p-2.5 text-xs text-slate-600 border border-slate-100">
                                    {Object.entries(log.metadata).map(([key, value]) => (
                                        <div key={key} className="flex gap-2">
                                            <span className="font-semibold text-slate-500">{key}:</span>
                                            <span>{String(value)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
