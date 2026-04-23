'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { CalendarDays, CheckCircle2, Clock, XCircle, FileText, Plus } from 'lucide-react'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import type { Appointment } from '@/types/database'
import { MeetingSummaryDialog } from './MeetingSummaryDialog'
import { AddAppointmentDialog } from './AddAppointmentDialog'

interface DashboardTimelineProps {
  appointments: Appointment[]
}

const statusConfig = {
  scheduled: { label: 'מתוכנן', color: 'bg-blue-500/20 text-blue-700 dark:text-blue-300', icon: Clock },
  done: { label: 'הסתיים', color: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300', icon: CheckCircle2 },
  cancelled: { label: 'בוטל', color: 'bg-red-500/20 text-red-700 dark:text-red-300', icon: XCircle },
}

export function DashboardTimeline({ appointments }: DashboardTimelineProps) {
  const [summaryAppt, setSummaryAppt] = useState<Appointment | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  const now = new Date()

  return (
    <Card className="border-border/50 shadow-sm h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-primary" />
          <CardTitle className="text-base">
            לוז היום — {format(now, 'EEEE, d בMMMM', { locale: he })}
          </CardTitle>
        </div>
        <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => setShowAdd(true)}>
          <Plus className="w-3.5 h-3.5" />
          פגישה חדשה
        </Button>
      </CardHeader>

      <CardContent className="relative">
        {appointments.length === 0 ? (
          <div className="text-center py-12">
            <CalendarDays className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">אין פגישות מתוכננות להיום</p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="timeline-line" />

            <div className="space-y-4">
              {appointments.map((appt, i) => {
                const cfg = statusConfig[appt.status]
                const Icon = cfg.icon
                const startTime = new Date(appt.start_time)
                const endTime = new Date(appt.end_time)
                const isPast = endTime < now
                const isCurrent = startTime <= now && endTime >= now
                const initials = appt.clients?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) ?? '?'

                return (
                  <div key={appt.id} className={`flex gap-4 pe-10 ${isPast && appt.status === 'scheduled' ? 'opacity-60' : ''}`}>
                    {/* Timeline dot */}
                    <div className="absolute end-[1.1rem] flex items-center justify-center">
                      <div
                        className={`w-4 h-4 rounded-full border-2 border-background ${
                          isCurrent ? 'bg-blue-500 shadow-lg shadow-blue-500/50' :
                          appt.status === 'done' ? 'bg-emerald-500' :
                          appt.status === 'cancelled' ? 'bg-red-400' :
                          'bg-muted-foreground'
                        }`}
                        style={{ marginTop: `${i * 0 + 0.7}rem` }}
                      />
                    </div>

                    {/* Card */}
                    <div className={`flex-1 bg-card border rounded-xl p-4 shadow-sm ${isCurrent ? 'border-blue-500/50 ring-1 ring-blue-500/20' : 'border-border/50'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-9 h-9">
                            <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">{initials}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold text-foreground text-sm">{appt.title}</p>
                            {appt.clients?.name && (
                              <p className="text-xs text-muted-foreground">{appt.clients.name}</p>
                            )}
                          </div>
                        </div>
                        <Badge className={`${cfg.color} text-xs border-0 gap-1`}>
                          <Icon className="w-3 h-3" />
                          {cfg.label}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between mt-3">
                        <p className="text-xs text-muted-foreground">
                          {format(startTime, 'HH:mm')} – {format(endTime, 'HH:mm')}
                        </p>
                        {appt.status === 'done' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground"
                            onClick={() => setSummaryAppt(appt)}
                          >
                            <FileText className="w-3 h-3" />
                            סכם פגישה
                          </Button>
                        )}
                        {isCurrent && (
                          <Badge className="bg-blue-500 text-white text-xs border-0 pulse-soft">עכשיו</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>

      {summaryAppt && (
        <MeetingSummaryDialog
          appointment={summaryAppt}
          open={!!summaryAppt}
          onClose={() => setSummaryAppt(null)}
        />
      )}
      {showAdd && (
        <AddAppointmentDialog open={showAdd} onClose={() => setShowAdd(false)} />
      )}
    </Card>
  )
}



