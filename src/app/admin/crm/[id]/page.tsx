import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { 
  Users, Mail, Phone, MapPin, 
  Calendar, CheckCircle2, DollarSign,
  Clock, ArrowRight, FolderOpen
} from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'

export const dynamic = 'force-dynamic'

export default async function ClientProfilePage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { id } = params

  const [
    { data: client },
    { data: tasks },
    { data: appts },
    { data: income }
  ] = await Promise.all([
    supabase.from('clients').select('*').eq('id', id).single(),
    supabase.from('tasks').select('*, assigned_person:profiles!tasks_assigned_to_fkey(full_name)').eq('client_id', id).order('created_at', { ascending: false }),
    supabase.from('appointments').select('*').eq('client_id', id).order('start_time', { ascending: false }),
    supabase.from('income').select('*').eq('client_id', id).order('date', { ascending: false })
  ])

  if (!client) notFound()

  const totalRevenue = (income as any[])?.reduce((s, r) => s + Number(r.amount), 0) ?? 0
  const initials = client.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)

  return (
    <div className="space-y-6">
      {/* Header / Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/admin/crm" className="hover:text-primary transition-colors">ניהול לקוחות</Link>
        <ArrowRight className="w-4 h-4 rotate-180" />
        <span className="text-foreground font-medium">{client.name}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Info Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-border/50 shadow-sm overflow-hidden">
            <div className="h-24 bg-gradient-to-r from-blue-600 to-indigo-700" />
            <CardContent className="relative pt-12 text-center">
              <div className="absolute -top-12 left-1/2 -translate-x-1/2">
                <Avatar className="w-24 h-24 border-4 border-white shadow-xl">
                  <AvatarFallback className="bg-slate-100 text-slate-800 text-2xl font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </div>
              <h2 className="text-2xl font-bold text-slate-900">{client.name}</h2>
              <p className="text-sm text-muted-foreground mt-1">לקוח רשום</p>
              
              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">סה"כ הכנסות</p>
                  <p className="text-lg font-bold text-emerald-600">₪{totalRevenue.toLocaleString()}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">משימות פתוחות</p>
                  <p className="text-lg font-bold text-blue-600">
                    {tasks?.filter(t => t.status !== 'done').length ?? 0}
                  </p>
                </div>
              </div>
            </CardContent>
            <div className="p-4 bg-slate-50/50 border-t border-slate-100 space-y-3">
              {client.email && (
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <span dir="ltr">{client.email}</span>
                </div>
              )}
              {client.phone && (
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span dir="ltr">{client.phone}</span>
                </div>
              )}
              {client.id_number && (
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span>ת.ז. {client.id_number}</span>
                </div>
              )}
              {client.address && (
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span>{client.address}</span>
                </div>
              )}
            </div>
          </Card>

          {client.drive_folder_id && (
            <Card className="border-blue-100 bg-blue-50/30 overflow-hidden group cursor-pointer hover:bg-blue-50 transition-colors">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                    <FolderOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-blue-900">תיקיית מסמכים ב-Drive</p>
                    <p className="text-[10px] text-blue-600 font-medium">לחץ למעבר לתיקייה</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-blue-400 group-hover:translate-x-1 transition-transform rotate-180" />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Main Content Areas */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tasks Section */}
          <Card className="border-border/50 shadow-sm overflow-hidden">
            <CardHeader className="border-b border-border/50 bg-muted/20 py-4 flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-blue-600" />
                משימות פתוחות
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!(tasks as any[]) || (tasks as any[]).length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm italic">אין משימות משויכות ללקוח זה.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {(tasks as any[]).map((task) => (
                    <div key={task.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          task.status === 'done' ? "bg-emerald-500" : task.status === 'in_progress' ? "bg-blue-500" : "bg-slate-400"
                        )} />
                        <div>
                          <p className="font-bold text-sm text-slate-900">{task.title}</p>
                          <p className="text-[10px] text-muted-foreground">אחראי: {task.assigned_person?.full_name ?? 'לא הוקצה'}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px]">{task.due_date ? format(new Date(task.due_date), 'dd/MM/yy') : 'ללא תאריך'}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Appointments & History */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="py-4 border-b border-border/50">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600" />
                  פגישות אחרונות
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-4">
                  {(appts as any[])?.slice(0, 3).map((appt) => (
                    <div key={appt.id} className="flex gap-3">
                      <div className="w-1 bg-amber-200 rounded-full" />
                      <div>
                        <p className="text-xs font-bold text-slate-800">{appt.title}</p>
                        <p className="text-[10px] text-slate-400">{format(new Date(appt.start_time), 'dd/MM/yy HH:mm')}</p>
                      </div>
                    </div>
                  ))}
                  {(!(appts as any[]) || (appts as any[]).length === 0) && <p className="text-xs text-muted-foreground italic text-center py-2">אין פגישות רשומות</p>}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-sm">
              <CardHeader className="py-4 border-b border-border/50">
                <CardTitle className="text-sm flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  היסטוריית תשלומים
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-4">
                  {(income as any[])?.slice(0, 3).map((inc) => (
                    <div key={inc.id} className="flex justify-between items-center">
                      <div>
                        <p className="text-xs font-bold text-slate-800">{inc.category}</p>
                        <p className="text-[10px] text-slate-400">{format(new Date(inc.date), 'dd/MM/yy')}</p>
                      </div>
                      <span className="text-sm font-bold text-emerald-600">₪{Number(inc.amount).toLocaleString()}</span>
                    </div>
                  ))}
                  {(!income || income.length === 0) && <p className="text-xs text-muted-foreground italic text-center py-2">אין תשלומים רשומים</p>}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
