'use client'

import { useState, useEffect } from 'react'
import { History, Clock, User, FileText } from 'lucide-react'
import { getRecentAuditLogs, type AuditLogEntry } from '@/lib/audit-log'
import { Card } from '@/components/ui/card'

export function AuditLogViewer({ limit = 50 }: { limit?: number }) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadLogs()
  }, [limit])

  const loadLogs = async () => {
    try {
      setLoading(true)
      const recentLogs = await getRecentAuditLogs(limit)
      setLogs(recentLogs)
    } catch (error) {
      console.error('Error loading audit logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const getActionIcon = (actionType: string) => {
    if (actionType.includes('created')) return <FileText className="h-4 w-4 text-green-600" />
    if (actionType.includes('updated')) return <Clock className="h-4 w-4 text-blue-600" />
    if (actionType.includes('deleted')) return <FileText className="h-4 w-4 text-red-600" />
    return <History className="h-4 w-4 text-grey" />
  }

  const getActionLabel = (actionType: string) => {
    const labels: Record<string, string> = {
      'client.created': 'לקוח נוצר',
      'client.updated': 'לקוח עודכן',
      'client.deleted': 'לקוח נמחק',
      'payment.created': 'תשלום נוצר',
      'payment.updated': 'תשלום עודכן',
      'payment.deleted': 'תשלום נמחק',
      'reminder.created': 'תזכורת נוצרה',
      'reminder.updated': 'תזכורת עודכנה',
      'reminder.deleted': 'תזכורת נמחקה',
      'credential.created': 'פרטי גישה נוצרו',
      'credential.updated': 'פרטי גישה עודכנו',
      'credential.deleted': 'פרטי גישה נמחקו',
      'note.created': 'פתק נוצר',
      'note.updated': 'פתק עודכן',
      'note.deleted': 'פתק נמחק',
    }
    return labels[actionType] || actionType
  }

  if (loading) {
    return (
      <Card className="p-6">
        <div className="text-center py-8 text-grey">טוען היסטוריית פעילויות...</div>
      </Card>
    )
  }

  if (logs.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center py-8 text-grey">אין פעילויות אחרונות</div>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <History className="h-5 w-5 text-navy" />
        <h2 className="text-xl font-semibold">היסטוריית פעילויות אחרונות</h2>
      </div>
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {logs.map((log) => (
          <div
            key={log.id}
            className="flex items-start gap-3 p-3 bg-grey/5 rounded-lg border border-grey/10 hover:bg-grey/10 transition-colors"
          >
            <div className="mt-1">{getActionIcon(log.action_type)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-navy">
                  {getActionLabel(log.action_type)}
                </span>
                <span className="text-xs text-grey bg-grey/10 px-2 py-0.5 rounded">
                  {log.entity_type}
                </span>
              </div>
              <p className="text-sm text-grey mb-1">{log.description}</p>
              <div className="flex items-center gap-2 text-xs text-grey">
                <Clock className="h-3 w-3" />
                <span>
                  {new Date(log.created_at).toLocaleString('he-IL', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

