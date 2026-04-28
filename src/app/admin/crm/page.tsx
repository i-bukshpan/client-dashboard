import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Users, Mail, Phone, FolderOpen, CheckSquare, Calendar, CalendarDays } from 'lucide-react'
import { AddClientSheet } from '@/components/crm/AddClientSheet'
import { format } from 'date-fns'

export const metadata = { title: 'לקוחות (CRM) | Nehemiah OS' }

export default async function CRMPage() {
  const supabase = await createClient()
  const [{ data: clients }, { data: tasks }, { data: appointments }] = await Promise.all([
    supabase.from('clients').select('*').order('created_at', { ascending: false }),
    supabase.from('tasks').select('client_id, status'),
    supabase.from('appointments').select('client_id, start_time').order('start_time', { ascending: false }),
  ])

  // Compute per-client stats
  const openTasksByClient: Record<string, number> = {}
  for (const t of (tasks as any[]) ?? []) {
    if (t.status !== 'done') {
      openTasksByClient[t.client_id] = (openTasksByClient[t.client_id] || 0) + 1
    }
  }

  const lastApptByClient: Record<string, string> = {}
  for (const a of (appointments as any[]) ?? []) {
    if (!lastApptByClient[a.client_id]) {
      lastApptByClient[a.client_id] = a.start_time
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shadow-inner">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-bold text-xl text-foreground">ניהול לקוחות</h2>
            <p className="text-muted-foreground text-sm">{clients?.length ?? 0} לקוחות רשומים</p>
          </div>
        </div>
        <AddClientSheet />
      </div>

      {/* Client Grid */}
      {!clients || clients.length === 0 ? (
        <div className="text-center py-20 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
          <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">אין לקוחות עדיין. לחץ "הוסף לקוח" כדי להתחיל.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {(clients as any[]).map((client) => {
            const initials = client.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)
            const openTasks = openTasksByClient[client.id] || 0
            const lastAppt = lastApptByClient[client.id]
            const joinedDate = client.created_at ? format(new Date(client.created_at), 'MM/yyyy') : null

            return (
              <Card key={client.id} className="kpi-card border-border/50 group hover:border-primary/40 transition-all duration-300 overflow-hidden">
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
                    {client.drive_folder_id && (
                      <Badge variant="outline" className="text-[10px] border-primary/20 text-primary gap-1 bg-primary/5 shrink-0">
                        <FolderOpen className="w-3 h-3" />
                        Drive
                      </Badge>
                    )}
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
            )
          })}
        </div>
      )}
    </div>
  )
}
