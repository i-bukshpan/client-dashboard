import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Users, Plus, Mail, Phone, FolderOpen } from 'lucide-react'
import { AddClientSheet } from '@/components/crm/AddClientSheet'

import { InviteClientButton } from '@/components/crm/InviteClientButton'

export const metadata = { title: 'לקוחות (CRM) | Nehemiah OS' }

export default async function CRMPage() {
  const supabase = await createClient()
  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })

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
            return (
              <Card key={client.id} className="kpi-card border-border/50 group hover:border-primary/40 transition-all duration-300 overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <Avatar className="w-12 h-12 shadow-sm border border-slate-100">
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold text-sm">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 truncate group-hover:text-primary transition-colors">{client.name}</p>
                      {client.id_number && (
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">ת.ז. {client.id_number}</p>
                      )}
                    </div>
                    {client.drive_folder_id && (
                      <Badge variant="outline" className="text-[10px] border-primary/20 text-primary gap-1 bg-primary/5">
                        <FolderOpen className="w-3 h-3" />
                        Drive
                      </Badge>
                    )}
                  </div>
                  
                  <div className="space-y-2 mb-4">
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

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <Link href={`/admin/crm/${client.id}`}>
                      <Button variant="ghost" size="sm" className="text-xs h-8 text-slate-500 hover:text-primary">
                        צפה בפרופיל
                      </Button>
                    </Link>
                    <InviteClientButton 
                      clientId={client.id} 
                      email={client.email} 
                      name={client.name} 
                      isInvited={!!client.user_id}
                    />
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

