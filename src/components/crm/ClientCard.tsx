'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Mail, Phone, FolderOpen, CheckSquare, Calendar, CalendarDays, Pencil } from 'lucide-react'
import { format } from 'date-fns'
import { EditClientSheet } from './EditClientSheet'
import type { Client } from '@/types/database'

interface Props {
  client: Client
  openTasks: number
  lastAppt: string | null
}

export function ClientCard({ client, openTasks, lastAppt }: Props) {
  const [editOpen, setEditOpen] = useState(false)
  const initials = client.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)
  const joinedDate = client.created_at ? format(new Date(client.created_at), 'MM/yyyy') : null

  return (
    <>
      <Card className="kpi-card border-border/50 group hover:border-primary/40 transition-all duration-300 overflow-hidden">
        <CardContent className="p-5">
          {/* Header row */}
          <div className="flex items-center gap-3 mb-4">
            <Avatar className="w-12 h-12 shadow-sm border border-slate-100 shrink-0">
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold text-sm">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-900 truncate group-hover:text-primary transition-colors">{client.name}</p>
              {client.id_number && (
                <p className="text-[10px] text-muted-foreground font-medium">ת.ז. {client.id_number}</p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {client.drive_folder_id && (
                <Badge variant="outline" className="text-[10px] border-primary/20 text-primary gap-1 bg-primary/5">
                  <FolderOpen className="w-3 h-3" />
                  Drive
                </Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="w-7 h-7 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-50 hover:text-blue-600"
                onClick={(e) => { e.preventDefault(); setEditOpen(true) }}
                title="ערוך לקוח"
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Contact info */}
          <div className="space-y-1.5 mb-4">
            {client.email && (
              <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-1.5 rounded-lg border border-slate-100/50">
                <Mail className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                <span className="truncate" dir="ltr">{client.email}</span>
              </div>
            )}
            {client.phone && (
              <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-1.5 rounded-lg border border-slate-100/50">
                <Phone className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                <span dir="ltr">{client.phone}</span>
              </div>
            )}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className={`flex flex-col items-center p-2 rounded-xl text-center ${openTasks > 0 ? 'bg-amber-50 border border-amber-100' : 'bg-slate-50 border border-slate-100'}`}>
              <CheckSquare className={`w-3.5 h-3.5 mb-0.5 ${openTasks > 0 ? 'text-amber-500' : 'text-slate-300'}`} />
              <span className={`text-sm font-black leading-none ${openTasks > 0 ? 'text-amber-700' : 'text-slate-400'}`}>{openTasks}</span>
              <span className="text-[9px] text-muted-foreground mt-0.5">משימות</span>
            </div>
            <div className="flex flex-col items-center p-2 rounded-xl bg-slate-50 border border-slate-100 text-center">
              <Calendar className="w-3.5 h-3.5 mb-0.5 text-blue-400" />
              <span className="text-[10px] font-bold text-slate-700 leading-none">
                {lastAppt ? format(new Date(lastAppt), 'dd/MM') : '—'}
              </span>
              <span className="text-[9px] text-muted-foreground mt-0.5">פגישה אחרונה</span>
            </div>
            <div className="flex flex-col items-center p-2 rounded-xl bg-slate-50 border border-slate-100 text-center">
              <CalendarDays className="w-3.5 h-3.5 mb-0.5 text-purple-400" />
              <span className="text-[10px] font-bold text-slate-700 leading-none">{joinedDate ?? '—'}</span>
              <span className="text-[9px] text-muted-foreground mt-0.5">הצטרף</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <Link href={`/admin/crm/${client.id}`} className="block">
              <Button variant="ghost" size="sm" className="text-xs h-8 text-slate-500 hover:text-primary w-full">
                צפה בפרופיל מלא
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <EditClientSheet client={client} open={editOpen} onOpenChange={setEditOpen} />
    </>
  )
}
