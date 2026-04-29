'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useState } from 'react'
import { Pencil, User, TrendingUp, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EditClientSheet } from './EditClientSheet'
import type { Client } from '@/types/database'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'

const RISK_LABELS: Record<string, { label: string; color: string }> = {
  low: { label: 'נמוך', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  medium: { label: 'בינוני', color: 'bg-amber-50 text-amber-700 border-amber-100' },
  high: { label: 'גבוה', color: 'bg-orange-50 text-orange-700 border-orange-100' },
  very_high: { label: 'גבוה מאוד', color: 'bg-red-50 text-red-700 border-red-100' },
}

const FREQ_LABELS: Record<string, string> = {
  weekly: 'שבועי',
  biweekly: 'דו-שבועי',
  monthly: 'חודשי',
  quarterly: 'רבעוני',
  annually: 'שנתי',
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: 'פעיל', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  inactive: { label: 'לא פעיל', color: 'bg-slate-100 text-slate-500 border-slate-200' },
  prospect: { label: 'פוטנציאל', color: 'bg-blue-50 text-blue-700 border-blue-100' },
  archived: { label: 'ארכיון', color: 'bg-purple-50 text-purple-700 border-purple-100' },
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-slate-50 last:border-0">
      <span className="text-xs text-slate-400 font-medium shrink-0">{label}</span>
      <span className="text-xs text-slate-700 font-medium text-left">{value}</span>
    </div>
  )
}

export function ClientProfile({ client }: { client: Client }) {
  const [editOpen, setEditOpen] = useState(false)

  const riskInfo = client.risk_level ? RISK_LABELS[client.risk_level] : null
  const statusInfo = client.status ? STATUS_LABELS[client.status] : STATUS_LABELS['active']

  return (
    <>
      <div className="space-y-4">
        {/* סטטוס ופרטי ייעוץ */}
        <Card className="border-border/50">
          <CardHeader className="pb-2 px-5 pt-4 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-700">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              פרטי ייעוץ
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs text-slate-500 hover:text-blue-600 hover:bg-blue-50"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="w-3.5 h-3.5" />
              עריכה
            </Button>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="flex items-center gap-2 mb-3">
              {statusInfo && (
                <Badge variant="outline" className={`text-[10px] font-semibold ${statusInfo.color}`}>
                  {statusInfo.label}
                </Badge>
              )}
              {riskInfo && (
                <Badge variant="outline" className={`text-[10px] font-semibold ${riskInfo.color}`}>
                  סיכון {riskInfo.label}
                </Badge>
              )}
            </div>

            <InfoRow label="מסלול ייעוץ" value={client.advisory_track} />
            <InfoRow label="יעד ייעוצי" value={client.advisory_goal} />
            <InfoRow label="תדירות פגישות" value={client.meeting_frequency ? FREQ_LABELS[client.meeting_frequency] : null} />
            <InfoRow
              label="שווי תיק"
              value={client.portfolio_value != null ? `₪${Number(client.portfolio_value).toLocaleString()}` : null}
            />
            <InfoRow
              label="לקוח מאז"
              value={client.client_since ? format(new Date(client.client_since), 'MMMM yyyy', { locale: he }) : null}
            />
            <InfoRow
              label="תאריך לידה"
              value={client.birth_date ? format(new Date(client.birth_date), 'dd/MM/yyyy') : null}
            />

            {!client.advisory_track && !client.advisory_goal && !client.portfolio_value && (
              <p className="text-xs text-muted-foreground italic py-2">לא הוזנו פרטי ייעוץ. לחץ "עריכה" להוספה.</p>
            )}
          </CardContent>
        </Card>

        {/* פרטים אישיים */}
        {(client.id_number || client.address || client.birth_date) && (
          <Card className="border-border/50">
            <CardHeader className="pb-2 px-5 pt-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-700">
                <User className="w-4 h-4 text-purple-500" />
                פרטים אישיים
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <InfoRow label="ת.ז. / ח.פ" value={client.id_number} />
              <InfoRow label="כתובת" value={client.address} />
            </CardContent>
          </Card>
        )}
      </div>

      <EditClientSheet client={client} open={editOpen} onOpenChange={setEditOpen} />
    </>
  )
}
