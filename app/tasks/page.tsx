'use client'

import { useState, useEffect, useMemo } from 'react'
import { 
  Plus, CheckCircle2, Circle, Clock, Calendar, AlertCircle, 
  Filter, Search, User, Trash2, ChevronDown, Users, 
  Phone, FileText, CheckSquare, X, RefreshCcw
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { supabase, type Reminder, type Client } from '@/lib/supabase'
import { format, isToday, isBefore, startOfDay, addDays } from 'date-fns'
import { he } from 'date-fns/locale'
import Link from 'next/link'
import { GlobalRecurringTasks } from '@/components/global-recurring-tasks'

type ReminderWithClient = Reminder & { clients?: Client | null }

export default function TasksPage() {
    const [reminders, setReminders] = useState<ReminderWithClient[]>([])
    const [clients, setClients] = useState<{ id: string; name: string }[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('all')
    const [priorityFilter, setPriorityFilter] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')

    // New task form state
    const [dialogOpen, setDialogOpen] = useState(false)
    const [newTitle, setNewTitle] = useState('')
    const [newDescription, setNewDescription] = useState('')
    const [newDueDate, setNewDueDate] = useState(format(new Date(), 'yyyy-MM-dd'))
    const [newPriority, setNewPriority] = useState('רגיל')
    const [newCategory, setNewCategory] = useState('task')
    const [newClientId, setNewClientId] = useState<string>('personal')

    useEffect(() => {
        loadAll()
    }, [])

    const loadAll = async () => {
        setLoading(true)
        const [remResult, clientsResult] = await Promise.all([
            supabase
                .from('reminders')
                .select('*, clients(*)')
                .is('recurrence_rule', null) // Only instances, not templates
                .order('due_date', { ascending: true }),
            supabase
                .from('clients')
                .select('id, name')
                .is('parent_id', null)
                .order('name')
        ])

        if (!remResult.error && remResult.data) {
            setReminders(remResult.data as ReminderWithClient[])
        }
        if (!clientsResult.error && clientsResult.data) {
            setClients(clientsResult.data)
        }
        setLoading(false)
    }

    const handleToggleComplete = async (e: React.MouseEvent, id: string, current: boolean) => {
        e.preventDefault()
        e.stopPropagation()
        const { error } = await supabase
            .from('reminders')
            .update({ is_completed: !current })
            .eq('id', id)
        
        if (!error) {
            setReminders(prev => prev.map(r => r.id === id ? { ...r, is_completed: !current } : r))
        } else {
            console.error('Failed to toggle completion:', error)
            alert('שגיאה בעדכון המשימה: ' + error.message)
        }
    }

    const handleDelete = async (id: string) => {
        const { error } = await supabase.from('reminders').delete().eq('id', id)
        if (!error) {
            setReminders(prev => prev.filter(r => r.id !== id))
        }
    }

    const handleCreateTask = async () => {
        if (!newTitle.trim()) return

        const { data, error } = await supabase
            .from('reminders')
            .insert({
                title: newTitle.trim(),
                description: newDescription.trim() || null,
                due_date: new Date(newDueDate).toISOString(),
                priority: newPriority,
                category: newCategory,
                client_id: newClientId === 'personal' ? null : newClientId,
                is_completed: false,
            })
            .select('*, clients(*)')
            .single()

        if (!error && data) {
            setReminders(prev => [...prev, data as ReminderWithClient].sort(
                (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
            ))
            setNewTitle('')
            setNewDescription('')
            setNewDueDate(format(new Date(), 'yyyy-MM-dd'))
            setNewPriority('רגיל')
            setNewCategory('task')
            setNewClientId('personal')
            setDialogOpen(false)
        }
    }

    // Filtered + searched list
    const filteredReminders = useMemo(() => {
        let list = [...reminders]

        // Tab filter
        if (activeTab === 'personal') {
            list = list.filter(r => !r.client_id)
        } else if (activeTab === 'client') {
            list = list.filter(r => !!r.client_id)
        } else if (activeTab === 'completed') {
            list = list.filter(r => r.is_completed)
        } else {
            // "all" tab — show only open tasks
            list = list.filter(r => !r.is_completed)
        }

        // Priority filter
        if (priorityFilter !== 'all') {
            list = list.filter(r => r.priority === priorityFilter)
        }

        // Search
        if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase()
            list = list.filter(r => 
                r.title.toLowerCase().includes(q) ||
                (r.clients as any)?.name?.toLowerCase().includes(q)
            )
        }

        return list
    }, [reminders, activeTab, priorityFilter, searchQuery])

    // Stats
    const stats = useMemo(() => {
        const open = reminders.filter(r => !r.is_completed)
        const today = startOfDay(new Date())
        return {
            total: open.length,
            overdue: open.filter(r => isBefore(new Date(r.due_date), today)).length,
            todayCount: open.filter(r => isToday(new Date(r.due_date))).length,
            personal: open.filter(r => !r.client_id).length,
        }
    }, [reminders])

    const categoryIcon = (cat?: string | null) => {
        switch (cat) {
            case 'phone_call': return <Phone className="h-3.5 w-3.5" />
            case 'meeting': return <Users className="h-3.5 w-3.5" />
            case 'document_review': return <FileText className="h-3.5 w-3.5" />
            default: return <CheckSquare className="h-3.5 w-3.5" />
        }
    }

    const priorityColor = (p: string) => {
        if (p === 'דחוף') return 'text-rose-600 bg-rose-50 border-rose-200'
        if (p === 'נמוך') return 'text-slate-500 bg-slate-50 border-slate-200'
        return 'text-blue-600 bg-blue-50 border-blue-200'
    }

    return (
        <div className="p-6 sm:p-10 bg-slate-50/50 min-h-screen" dir="rtl">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-10 animate-fade-in-up">
                <div>
                    <h1 className="text-4xl font-black text-navy tracking-tight mb-2">מרכז משימות</h1>
                    <p className="text-grey font-bold">ניהול אחיד של כל המשימות שלך – אישיות ולקוחות</p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black gap-2 h-12 px-6 shadow-lg shadow-blue-500/20">
                            <Plus className="h-4 w-4" />
                            משימה חדשה
                        </Button>
                    </DialogTrigger>
                    <DialogContent dir="rtl" className="rounded-2xl">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-black text-navy">יצירת משימה חדשה</DialogTitle>
                            <DialogDescription>הוסף משימה אישית או ללקוח ספציפי</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label className="font-bold">כותרת</Label>
                                <Input 
                                    value={newTitle} 
                                    onChange={e => setNewTitle(e.target.value)} 
                                    placeholder="מה צריך לעשות?" 
                                    className="rounded-xl h-11"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="font-bold">תיאור / הערות (אופציונלי)</Label>
                                <Input 
                                    value={newDescription} 
                                    onChange={e => setNewDescription(e.target.value)} 
                                    placeholder="פרטים נוספים..." 
                                    className="rounded-xl h-11"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="font-bold">תאריך יעד</Label>
                                    <Input 
                                        type="date" 
                                        value={newDueDate} 
                                        onChange={e => setNewDueDate(e.target.value)} 
                                        className="rounded-xl"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-bold">עדיפות</Label>
                                    <Select value={newPriority} onValueChange={setNewPriority}>
                                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                            <SelectItem value="נמוך">נמוך</SelectItem>
                                            <SelectItem value="רגיל">רגיל</SelectItem>
                                            <SelectItem value="דחוף">דחוף</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="font-bold">קטגוריה</Label>
                                    <Select value={newCategory} onValueChange={setNewCategory}>
                                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                            <SelectItem value="task">משימה</SelectItem>
                                            <SelectItem value="phone_call">שיחת טלפון</SelectItem>
                                            <SelectItem value="meeting">פגישה</SelectItem>
                                            <SelectItem value="document_review">בדיקת מסמכים</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-bold">שיוך ללקוח</Label>
                                    <Select value={newClientId} onValueChange={setNewClientId}>
                                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                                        <SelectContent className="rounded-xl max-h-60">
                                            <SelectItem value="personal">🔒 אישי (לא משויך)</SelectItem>
                                            {clients.map(c => (
                                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleCreateTask} className="rounded-xl w-full h-11 font-black shadow-lg shadow-primary/20">
                                צור משימה
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <Tabs defaultValue="current" className="space-y-8">
                <div className="bg-white/50 backdrop-blur-md border border-border/50 p-1.5 rounded-2xl inline-flex shadow-sm animate-fade-in-up">
                    <TabsList className="bg-transparent h-auto p-0 flex gap-1">
                        <TabsTrigger value="current" className="rounded-xl px-6 py-2.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white font-black transition-all shadow-sm">
                            משימות שוטפות
                        </TabsTrigger>
                        <TabsTrigger value="recurring" className="rounded-xl px-6 py-2.5 data-[state=active]:bg-emerald-600 data-[state=active]:text-white font-black transition-all shadow-sm gap-2">
                            <RefreshCcw className="h-4 w-4" />
                            ניהול תבניות מחזוריות
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="current" className="mt-0 outline-none space-y-8">
                    {/* KPI Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8 animate-fade-in-up delay-100">
                <MiniStat label="פתוחות" value={stats.total} icon={<Circle className="h-4 w-4" />} color="blue" />
                <MiniStat label="באיחור" value={stats.overdue} icon={<AlertCircle className="h-4 w-4" />} color="rose" />
                <MiniStat label="היום" value={stats.todayCount} icon={<Clock className="h-4 w-4" />} color="amber" />
                <MiniStat label="אישיות" value={stats.personal} icon={<User className="h-4 w-4" />} color="indigo" />
            </div>

            {/* Main Content */}
            <Card className="rounded-[2.5rem] border-border/50 bg-white/70 backdrop-blur-xl shadow-xl shadow-navy/5 overflow-hidden animate-fade-in-up delay-200">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <div className="p-6 sm:p-8 border-b border-border/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="bg-slate-100/80 p-1 rounded-2xl inline-flex">
                            <TabsList className="bg-transparent h-auto p-0 flex gap-1">
                                <TabsTrigger value="all" className="rounded-xl px-5 py-2 data-[state=active]:bg-white data-[state=active]:text-navy data-[state=active]:shadow-sm font-bold text-sm">
                                    הכל ({stats.total})
                                </TabsTrigger>
                                <TabsTrigger value="personal" className="rounded-xl px-5 py-2 data-[state=active]:bg-white data-[state=active]:text-navy data-[state=active]:shadow-sm font-bold text-sm">
                                    אישי ({stats.personal})
                                </TabsTrigger>
                                <TabsTrigger value="client" className="rounded-xl px-5 py-2 data-[state=active]:bg-white data-[state=active]:text-navy data-[state=active]:shadow-sm font-bold text-sm">
                                    לקוחות
                                </TabsTrigger>
                                <TabsTrigger value="completed" className="rounded-xl px-5 py-2 data-[state=active]:bg-white data-[state=active]:text-navy data-[state=active]:shadow-sm font-bold text-sm">
                                    הושלמו
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <div className="relative flex-1 sm:w-64">
                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-grey" />
                                <Input 
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="חפש משימה..."
                                    className="pr-10 rounded-xl h-10 bg-white/80 border-border/50"
                                />
                            </div>
                            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                                <SelectTrigger className="rounded-xl w-28 h-10 border-border/50">
                                    <SelectValue placeholder="עדיפות" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="all">הכל</SelectItem>
                                    <SelectItem value="דחוף">דחוף</SelectItem>
                                    <SelectItem value="רגיל">רגיל</SelectItem>
                                    <SelectItem value="נמוך">נמוך</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Task List Content – shared across tabs */}
                    <div className="p-4 sm:p-8">
                        {loading ? (
                            <div className="py-20 text-center text-grey animate-pulse font-bold">טוען משימות...</div>
                        ) : filteredReminders.length === 0 ? (
                            <div className="py-20 text-center space-y-4">
                                <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto text-slate-300">
                                    <CheckCircle2 className="h-8 w-8" />
                                </div>
                                <p className="text-navy font-bold text-lg">
                                    {activeTab === 'completed' ? 'אין משימות שהושלמו' : 'אין משימות פתוחות'}
                                </p>
                                <p className="text-grey text-sm">
                                    {activeTab === 'completed' ? 'סמן משימות כ"הושלמו" והן יופיעו כאן' : 'לחץ "משימה חדשה" כדי להתחיל'}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {filteredReminders.map(task => {
                                    const isOverdue = !task.is_completed && isBefore(new Date(task.due_date), startOfDay(new Date()))
                                    const isDueToday = isToday(new Date(task.due_date))

                                    return (
                                        <div 
                                            key={task.id}
                                            className={`flex items-center gap-4 p-4 rounded-2xl border transition-all group hover:shadow-md ${
                                                task.is_completed 
                                                    ? 'bg-slate-50/50 border-slate-100 opacity-60' 
                                                    : isOverdue 
                                                        ? 'bg-rose-50/30 border-rose-200/50 hover:border-rose-300'
                                                        : 'bg-white/50 border-border/40 hover:border-primary/30'
                                            }`}
                                        >
                                            {/* Toggle complete */}
                                            <button 
                                                onClick={(e) => handleToggleComplete(e, task.id, task.is_completed)}
                                                className={`shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${
                                                    task.is_completed 
                                                        ? 'bg-emerald-500 border-emerald-500 text-white' 
                                                        : 'border-slate-300 hover:border-primary hover:bg-primary/5'
                                                }`}
                                            >
                                                {task.is_completed && <CheckCircle2 className="h-4 w-4" />}
                                            </button>

                                            {/* Category icon */}
                                            <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${
                                                task.client_id ? 'bg-blue-50 text-blue-500' : 'bg-indigo-50 text-indigo-500'
                                            }`}>
                                                {categoryIcon(task.category)}
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-col mb-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className={`font-bold text-navy truncate ${task.is_completed ? 'line-through' : ''}`}>
                                                            {task.title}
                                                        </h4>
                                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${priorityColor(task.priority)}`}>
                                                            {task.priority}
                                                        </span>
                                                    </div>
                                                    {task.description && (
                                                        <p className={`text-xs text-grey mt-0.5 ${task.is_completed ? 'line-through opacity-70' : ''}`}>
                                                            {task.description}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 text-[11px] font-bold text-grey">
                                                    <span className={`flex items-center gap-1 ${isOverdue ? 'text-rose-500' : isDueToday ? 'text-amber-600' : ''}`}>
                                                        <Calendar className="h-3 w-3" />
                                                        {isOverdue ? 'באיחור – ' : isDueToday ? 'היום – ' : ''}
                                                        {format(new Date(task.due_date), 'd בMMM', { locale: he })}
                                                    </span>
                                                    {task.clients ? (
                                                        <Link href={`/clients/${task.client_id}`} className="flex items-center gap-1 hover:text-primary transition-colors">
                                                            <Users className="h-3 w-3" />
                                                            {(task.clients as any).name}
                                                        </Link>
                                                    ) : (
                                                        <span className="flex items-center gap-1 text-indigo-500">
                                                            <User className="h-3 w-3" />
                                                            אישי
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <button 
                                                onClick={() => handleDelete(task.id)}
                                                className="shrink-0 p-2 rounded-xl text-slate-300 hover:text-rose-500 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </Tabs>
            </Card>
                </TabsContent>

                <TabsContent value="recurring" className="mt-0 outline-none">
                    <GlobalRecurringTasks />
                </TabsContent>
            </Tabs>
        </div>
    )
}

function MiniStat({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
    const colors: Record<string, string> = {
        blue: 'bg-blue-50 text-blue-600 border-blue-100',
        rose: 'bg-rose-50 text-rose-600 border-rose-100',
        amber: 'bg-amber-50 text-amber-600 border-amber-100',
        indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    }
    return (
        <Card className="p-4 rounded-2xl border-border/40 bg-white/60 backdrop-blur-sm hover:scale-[1.02] transition-all">
            <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${colors[color]} shadow-sm`}>{icon}</div>
                <div>
                    <div className="text-2xl font-black text-navy">{value}</div>
                    <div className="text-[10px] font-bold text-grey uppercase tracking-widest">{label}</div>
                </div>
            </div>
        </Card>
    )
}
