import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { 
  Users, Mail, Phone, MapPin, 
  Calendar, CheckCircle2, DollarSign,
  Clock, ArrowRight, FolderOpen, ClipboardList, CheckSquare
} from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { ClientNotes } from '@/components/crm/ClientNotes'
import { MeetingSummaryDialog } from '@/components/crm/MeetingSummaryDialog'
import { InviteClientButton } from '@/components/crm/InviteClientButton'

export const dynamic = 'force-dynamic'

export default async function ClientProfilePage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { id } = await (params as any)

  const [
    { data: client },
    { data: tasks },
    { data: appts },
    { data: income },
    { data: employees },
    { data: summaries }
  ] = await Promise.all([
    supabase.from('clients').select('*').eq('id', id).single(),
    supabase.from('tasks').select('*, assigned_person:profiles!tasks_assigned_to_fkey(full_name)').eq('client_id', id).order('created_at', { ascending: false }),
    supabase.from('appointments').select('*').eq('client_id', id).order('start_time', { ascending: false }),
    supabase.from('income').select('*').eq('client_id', id).order('date', { ascending: false }),
    supabase.from('profiles').select('id, full_name').eq('role', 'employee').order('full_name'),
    supabase.from('meeting_summaries').select('*, appointments(title, start_time)').eq('appointments.client_id', id).order('created_at', { ascending: false })
  ])

  const clientObj = client as any
  if (!clientObj) notFound()

  const totalRevenue = (income as any[])?.reduce((s, r) => s + Number(r.amount), 0) ?? 0
  const initials = clientObj.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)

  return (
    <div className="space-y-6">
      {/* Header / Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/admin/crm" className="hover:text-primary transition-colors">ניהול לקוחות</Link>
        <ArrowRight className="w-4 h-4 rotate-180" />
        <span className="text-foreground font-medium">{clientObj.name}</span>
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
              <h2 className="text-2xl font-bold text-slate-900 leading-none">{clientObj.name}</h2>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-2">לקוח רשום במערכת</p>
              
              <div className="mt-6 flex flex-col gap-2">
                <InviteClientButton 
                  clientId={id} 
                  email={clientObj.email} 
                  name={clientObj.name} 
                  isInvited={!!clientObj.user_id} 
                />
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="bg-emerald-50/50 p-3 rounded-2xl border border-emerald-100/50">
                  <p className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider mb-1">סה"כ הכנסות</p>
                  <p className="text-lg font-black text-emerald-700">₪{totalRevenue.toLocaleString()}</p>
                </div>
                <div className="bg-blue-50/50 p-3 rounded-2xl border border-blue-100/50">
                  <p className="text-[9px] text-blue-600 font-bold uppercase tracking-wider mb-1">משימות פתוחות</p>
                  <p className="text-lg font-black text-blue-700">
                    {(tasks as any[])?.filter(t => t.status !== 'done').length ?? 0}
                  </p>
                </div>
              </div>
            </CardContent>
            <div className="p-4 bg-slate-50/50 border-t border-slate-100 space-y-3">
              {clientObj.email && (
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <span dir="ltr">{clientObj.email}</span>
                </div>
              )}
              {clientObj.phone && (
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span dir="ltr">{clientObj.phone}</span>
                </div>
              )}
              {clientObj.id_number && (
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span>ת.ז. {clientObj.id_number}</span>
                </div>
              )}
              {clientObj.address && (
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span>{clientObj.address}</span>
                </div>
              )}
            </div>
          </Card>

          {clientObj.drive_folder_id && (
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

          {/* Client Notes Widget */}
          <ClientNotes clientId={clientObj.id} initialNotes={clientObj.notes} />
        </div>

        {/* Main Content Areas */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="tasks" className="w-full">
            <div className="bg-white border border-border/50 rounded-2xl p-1 mb-6 shadow-sm max-w-fit">
              <TabsList className="bg-transparent gap-1">
                <TabsTrigger 
                  value="tasks" 
                  className="rounded-xl px-6 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-none font-bold transition-all gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  משימות
                </TabsTrigger>
                <TabsTrigger 
                  value="appointments" 
                  className="rounded-xl px-6 data-[state=active]:bg-amber-50 data-[state=active]:text-amber-700 data-[state=active]:shadow-none font-bold transition-all gap-2"
                >
                  <Calendar className="w-4 h-4" />
                  פגישות
                </TabsTrigger>
                <TabsTrigger 
                  value="finance" 
                  className="rounded-xl px-6 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 data-[state=active]:shadow-none font-bold transition-all gap-2"
                >
                  <DollarSign className="w-4 h-4" />
                  תשלומים
                </TabsTrigger>
                <TabsTrigger 
                  value="meetings" 
                  className="rounded-xl px-6 data-[state=active]:bg-purple-50 data-[state=active]:text-purple-700 data-[state=active]:shadow-none font-bold transition-all gap-2"
                >
                  <ClipboardList className="w-4 h-4" />
                  סיכומים
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="tasks" className="space-y-6 focus-visible:outline-none">
              <Card className="border-border/50 shadow-sm overflow-hidden bg-white">
                <CardHeader className="border-b border-border/50 bg-slate-50/50 py-3 px-5">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-700">
                      <CheckCircle2 className="w-4 h-4 text-blue-600" />
                      משימות לביצוע
                    </CardTitle>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700">{(tasks as any[])?.filter(t => t.status !== 'done').length ?? 0} פתוחות</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {!(tasks as any[]) || (tasks as any[]).length === 0 ? (
                    <div className="p-12 text-center">
                      <CheckCircle2 className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                      <p className="text-sm text-slate-400 italic">אין משימות משויכות ללקוח זה</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {(tasks as any[]).map((task) => (
                        <div key={task.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors group">
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                              task.status === 'done' ? "bg-emerald-100 text-emerald-600" : task.status === 'in_progress' ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-400"
                            )}>
                              <CheckSquare className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-bold text-sm text-slate-900 group-hover:text-blue-600 transition-colors">{task.title}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  <Users className="w-3 h-3" /> {task.assigned_person?.full_name ?? 'לא הוקצה'}
                                </span>
                                {task.due_date && (
                                  <span className={cn(
                                    "text-[10px] font-medium flex items-center gap-1",
                                    new Date(task.due_date) < new Date() && task.status !== 'done' ? "text-red-500" : "text-muted-foreground"
                                  )}>
                                    <Calendar className="w-3 h-3" /> {format(new Date(task.due_date), 'dd/MM/yy')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <Badge variant="outline" className={cn(
                            "text-[9px] uppercase tracking-wider",
                            task.status === 'done' ? "border-emerald-200 text-emerald-700 bg-emerald-50" : task.status === 'in_progress' ? "border-blue-200 text-blue-700 bg-blue-50" : "border-slate-200 text-slate-500 bg-slate-50"
                          )}>
                            {task.status === 'done' ? 'בוצע' : task.status === 'in_progress' ? 'בביצוע' : 'ממתין'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="appointments" className="space-y-6 focus-visible:outline-none">
              <Card className="border-border/50 shadow-sm bg-white overflow-hidden">
                <CardHeader className="py-3 px-5 border-b border-border/50 bg-slate-50/50">
                  <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-700">
                    <Clock className="w-4 h-4 text-amber-600" />
                    לוח פגישות
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-50">
                    {(appts as any[])?.map((appt) => (
                      <div key={appt.id} className="p-4 flex items-center justify-between group hover:bg-slate-50/50 transition-colors">
                        <div className="flex gap-4">
                          <div className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-amber-50 text-amber-700 border border-amber-100 shrink-0">
                            <span className="text-[10px] font-bold leading-none">{format(new Date(appt.start_time), 'MMM')}</span>
                            <span className="text-lg font-black leading-none mt-1">{format(new Date(appt.start_time), 'dd')}</span>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-800">{appt.title}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {format(new Date(appt.start_time), 'HH:mm')} - {format(new Date(appt.end_time), 'HH:mm')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={cn(
                            "text-[9px]",
                            appt.status === 'done' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-amber-50 text-amber-700 border-amber-100"
                          )}>
                            {appt.status === 'done' ? 'בוצע' : 'עתידי'}
                          </Badge>
                          {appt.status !== 'done' && (
                            <MeetingSummaryDialog 
                              appointmentId={appt.id} 
                              clientId={id} 
                              employeeId={appt.employee_id} 
                              employees={(employees as any[]) || []}
                              trigger={
                                <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 text-amber-600 hover:bg-amber-50">
                                  <ClipboardList className="w-3.5 h-3.5" /> סיכום
                                </Button>
                              }
                            />
                          )}
                        </div>
                      </div>
                    ))}
                    {(!(appts as any[]) || (appts as any[]).length === 0) && (
                      <div className="p-12 text-center">
                        <Calendar className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                        <p className="text-sm text-slate-400 italic">אין פגישות רשומות</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="finance" className="space-y-6 focus-visible:outline-none animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="bg-emerald-50/50 border-emerald-100 shadow-sm">
                  <CardContent className="p-4">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">סה"כ שולם</p>
                    <p className="text-2xl font-black text-emerald-700">₪{totalRevenue.toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card className="bg-blue-50/50 border-blue-100 shadow-sm">
                  <CardContent className="p-4">
                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">מספר תשלומים</p>
                    <p className="text-2xl font-black text-blue-700">{(income as any[])?.length ?? 0}</p>
                  </CardContent>
                </Card>
                <Card className="bg-slate-50 border-slate-200 shadow-sm">
                  <CardContent className="p-4">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">תשלום אחרון</p>
                    <p className="text-xl font-bold text-slate-700">
                      {(income as any[])?.[0] ? format(new Date((income as any[])[0].date), 'dd/MM/yy') : '—'}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-border/50 shadow-sm overflow-hidden bg-white">
                <CardHeader className="py-3 px-5 border-b border-border/50 bg-slate-50/50">
                  <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-700">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    פירוט תנועות כספיות
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50/30">
                        <TableRow>
                          <TableHead className="text-right text-[11px] font-bold uppercase tracking-wider h-10">תאריך</TableHead>
                          <TableHead className="text-right text-[11px] font-bold uppercase tracking-wider h-10">קטגוריה</TableHead>
                          <TableHead className="text-right text-[11px] font-bold uppercase tracking-wider h-10">תיאור/הערות</TableHead>
                          <TableHead className="text-left text-[11px] font-bold uppercase tracking-wider h-10">סכום</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(income as any[])?.map((row) => (
                          <TableRow key={row.id} className="hover:bg-slate-50/50 transition-colors group">
                            <TableCell className="text-xs text-slate-600 font-medium">{format(new Date(row.date), 'dd/MM/yyyy')}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-[10px] font-medium bg-emerald-50 text-emerald-700 border-emerald-100">
                                {row.category}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-slate-500 max-w-[200px] truncate">{row.notes}</TableCell>
                            <TableCell className="text-left font-black text-emerald-600 text-sm">₪{Number(row.amount).toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                        {(!(income as any[]) || (income as any[]).length === 0) && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-12">
                              <DollarSign className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                              <p className="text-sm text-slate-400 italic">אין תשלומים רשומים</p>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="meetings" className="space-y-6">
              <div className="grid grid-cols-1 gap-4">
                {(summaries as any[])?.filter(s => s.appointments).map((s) => (
                  <Card key={s.id} className="border-border/50 shadow-sm overflow-hidden">
                    <CardHeader className="py-3 px-4 bg-slate-50 border-b border-border/50 flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-sm font-bold">{s.appointments.title}</CardTitle>
                        <p className="text-[10px] text-muted-foreground">{format(new Date(s.appointments.start_time), 'dd/MM/yyyy HH:mm')}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">סיכום פגישה</Badge>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                      <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                        {s.notes}
                      </div>
                      {s.action_items && (s.action_items as any[]).length > 0 && (
                        <div className="pt-4 border-t border-slate-100">
                          <p className="text-[10px] font-black uppercase text-slate-400 mb-2">משימות המשך:</p>
                          <ul className="space-y-1">
                            {(s.action_items as any[]).map((item: any, i: number) => (
                              <li key={i} className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 p-2 rounded-md border border-slate-100">
                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                {item.title}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
                {(!(summaries as any[]) || (summaries as any[]).filter(s => s.appointments).length === 0) && (
                  <div className="py-20 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <ClipboardList className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="text-slate-500 font-medium">אין סיכומי פגישות קודמים</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
