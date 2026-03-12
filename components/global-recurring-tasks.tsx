'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, RefreshCcw, Calendar, FileText, CheckSquare, Phone, Users, User, Search, Filter, ArrowDownWideNarrow } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { supabase, type Reminder, type Client } from '@/lib/supabase'
import Link from 'next/link'

type ReminderWithClient = Reminder & { clients?: Client | null }

export function GlobalRecurringTasks() {
    const [templates, setTemplates] = useState<ReminderWithClient[]>([])
    const [clients, setClients] = useState<Client[]>([])
    const [loading, setLoading] = useState(true)
    
    // Filters and Sorting
    const [searchQuery, setSearchQuery] = useState('')
    const [priorityFilter, setPriorityFilter] = useState('all')
    const [sortBy, setSortBy] = useState('newest')

    // New Form
    const [dialogOpen, setDialogOpen] = useState(false)
    const [recTitle, setRecTitle] = useState('')
    const [recDescription, setRecDescription] = useState('')
    const [recFrequency, setRecFrequency] = useState('monthly')
    const [recPriority, setRecPriority] = useState('רגיל')
    const [recCategory, setRecCategory] = useState('task')
    const [recClientId, setRecClientId] = useState('personal')

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        setLoading(true)
        const [tempRes, cliRes] = await Promise.all([
            supabase.from('reminders')
                    .select('*, clients(*)')
                    .not('recurrence_rule', 'is', null) // only templates
                    .order('created_at', { ascending: false }),
            supabase.from('clients')
                    .select('*')
                    .is('parent_id', null)
                    .order('name')
        ])

        if (!tempRes.error && tempRes.data) {
            setTemplates(tempRes.data as ReminderWithClient[])
        }
        if (!cliRes.error && cliRes.data) {
            setClients(cliRes.data as Client[])
        }
        setLoading(false)
    }

    const handleCreateTemplate = async () => {
        if (!recTitle.trim()) return

        const { data, error } = await supabase
            .from('reminders')
            .insert({
                title: recTitle.trim(),
                description: recDescription.trim() || null,
                recurrence_rule: recFrequency,
                priority: recPriority,
                category: recCategory,
                client_id: recClientId === 'personal' ? null : recClientId,
                due_date: new Date().toISOString(), // Needed for DB default requirements
                is_completed: false
            })
            .select('*, clients(*)')
            .single()

        if (!error && data) {
            setTemplates(prev => [data as ReminderWithClient, ...prev])
            setDialogOpen(false)
            setRecTitle('')
            setRecDescription('')
            setRecFrequency('monthly')
            setRecPriority('רגיל')
            setRecCategory('task')
            setRecClientId('personal')
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('האם רצונך למחוק תבנית זו? המחיקה לא תשפיע על משימות שכבר נוצרו בעבר.')) return
        const { error } = await supabase.from('reminders').delete().eq('id', id)
        if (!error) {
            setTemplates(prev => prev.filter(t => t.id !== id))
        }
    }

    const filteredAndSortedTemplates = useMemo(() => {
        let list = [...templates]
        
        // Priority filter
        if (priorityFilter !== 'all') {
            list = list.filter(t => t.priority === priorityFilter)
        }
        
        // Search
        if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase()
            list = list.filter(t => 
                t.title.toLowerCase().includes(q) ||
                (t.description || '').toLowerCase().includes(q) ||
                (t.clients as any)?.name?.toLowerCase().includes(q)
            )
        }
        
        // Sorting
        list.sort((a, b) => {
            if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            if (sortBy === 'name') return a.title.localeCompare(b.title)
            return 0
        })
        
        return list
    }, [templates, searchQuery, priorityFilter, sortBy])

    return (
        <Card className="rounded-[2.5rem] border-border/50 bg-white/70 backdrop-blur-xl shadow-xl shadow-navy/5 overflow-hidden animate-fade-in-up delay-200">
            <div className="p-6 sm:p-8 border-b border-border/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-black text-navy tracking-tight flex items-center gap-2">
                        <RefreshCcw className="h-5 w-5 text-emerald-500" />
                        ניהול תבניות משימות מחזוריות
                    </h2>
                    <p className="text-sm font-bold text-grey mt-1">
                        הגדר משימות אישיות או ללקוחות שיווצרו באופן אוטומטי (יומי, שבועי, וכו')
                    </p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black gap-2 h-10 px-6 shadow-md shadow-emerald-500/20">
                            <Plus className="h-4 w-4" />
                            משימה מחזורית חדשה
                        </Button>
                    </DialogTrigger>
                    <DialogContent dir="rtl" className="rounded-2xl">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-black text-navy">הגדרת משימה מחזורית</DialogTitle>
                            <DialogDescription>צור תבנית למשימה שתיווצר אוטומטית בכל תקופה</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label className="font-bold">כותרת התבנית</Label>
                                <Input 
                                    value={recTitle} 
                                    onChange={e => setRecTitle(e.target.value)} 
                                    placeholder="דוגמה: תשלום ביטוח לאומי" 
                                    className="rounded-xl"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="font-bold">תיאור / הערות (אופציונלי)</Label>
                                <Input 
                                    value={recDescription} 
                                    onChange={e => setRecDescription(e.target.value)} 
                                    placeholder="פרטים נוספים..." 
                                    className="rounded-xl"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="font-bold">תדירות</Label>
                                    <Select value={recFrequency} onValueChange={setRecFrequency}>
                                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                            <SelectItem value="daily">יומי</SelectItem>
                                            <SelectItem value="weekly">שבועי</SelectItem>
                                            <SelectItem value="monthly">חודשי</SelectItem>
                                            <SelectItem value="yearly">שנתי</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-bold">עדיפות</Label>
                                    <Select value={recPriority} onValueChange={setRecPriority}>
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
                                    <Select value={recCategory} onValueChange={setRecCategory}>
                                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                            <SelectItem value="task">משימה כללית</SelectItem>
                                            <SelectItem value="phone_call">שיחת טלפון</SelectItem>
                                            <SelectItem value="meeting">פגישה</SelectItem>
                                            <SelectItem value="document_review">בדיקת מסמכים</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-bold">שיוך</Label>
                                    <Select value={recClientId} onValueChange={setRecClientId}>
                                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                                        <SelectContent className="rounded-xl max-h-60">
                                            <SelectItem value="personal">🔒 אישיות (לא משויך ללקוח)</SelectItem>
                                            {clients.map(c => (
                                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleCreateTemplate} className="rounded-xl w-full h-11 font-black bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 text-white">
                                צור תבנית
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="p-4 sm:p-6 bg-slate-50/50 border-b border-border/40 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="relative flex-1 w-full sm:max-w-xs">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-grey" />
                    <Input 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="חפש משימה מחזורית..."
                        className="pr-10 rounded-xl h-10 bg-white/80 border-border/50"
                    />
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                        <SelectTrigger className="rounded-xl w-32 h-10 border-border/50 bg-white/80">
                            <Filter className="h-4 w-4 ml-2 text-grey" />
                            <SelectValue placeholder="עדיפות" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="all">כל העדיפויות</SelectItem>
                            <SelectItem value="דחוף">דחוף</SelectItem>
                            <SelectItem value="רגיל">רגיל</SelectItem>
                            <SelectItem value="נמוך">נמוך</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="rounded-xl w-36 h-10 border-border/50 bg-white/80">
                            <ArrowDownWideNarrow className="h-4 w-4 ml-2 text-grey" />
                            <SelectValue placeholder="מיון לפי" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="newest">הכי חדש</SelectItem>
                            <SelectItem value="oldest">הכי ישן</SelectItem>
                            <SelectItem value="name">לפי שם (א-ת)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="p-4 sm:p-8">
                {loading ? (
                    <div className="py-20 text-center text-grey animate-pulse font-bold">טוען תבניות...</div>
                ) : filteredAndSortedTemplates.length === 0 ? (
                    <div className="py-20 text-center space-y-4">
                        <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-3xl flex items-center justify-center mx-auto text-emerald-400">
                            <RefreshCcw className="h-8 w-8" />
                        </div>
                        <p className="text-navy font-bold text-lg">אין משימות מחזוריות שעונות על הסינון</p>
                        <p className="text-grey text-sm">נסה לשנות את תנאי החיפוש או הוסף תבנית חדשה.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {filteredAndSortedTemplates.map(t => (
                            <div 
                                key={t.id}
                                className="p-5 rounded-2xl bg-white/60 border border-border/50 hover:border-emerald-300 transition-all flex items-start justify-between group relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 w-1.5 h-full bg-emerald-500" />
                                <div className="flex-1 ml-4 mr-2">
                                    <div className="flex flex-col gap-1 mb-2.5">
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-extrabold text-navy text-lg leading-tight">{t.title}</h4>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-full">
                                                {t.recurrence_rule === 'daily' ? 'יומי' :
                                                 t.recurrence_rule === 'weekly' ? 'שבועי' :
                                                 t.recurrence_rule === 'monthly' ? 'חודשי' : 'שנתי'}
                                            </span>
                                        </div>
                                        {t.description && (
                                            <p className="text-xs text-grey font-medium leading-relaxed max-w-sm">
                                                {t.description}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-4 text-[11px] font-bold text-grey">
                                        {t.client_id ? (
                                            <Link href={`/clients/${t.client_id}`} className="flex items-center gap-1 hover:text-primary transition-colors">
                                                <Users className="h-3.5 w-3.5" />
                                                {(t.clients as any)?.name}
                                            </Link>
                                        ) : (
                                            <span className="flex items-center gap-1 text-indigo-500">
                                                <User className="h-3.5 w-3.5" />
                                                אישי (ליועץ)
                                            </span>
                                        )}
                                        <span className="flex items-center gap-1 bg-slate-100 rounded-md px-1.5 py-0.5">
                                            עדיפות: {t.priority}
                                        </span>
                                    </div>
                                </div>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => handleDelete(t.id)}
                                    className="h-8 w-8 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg p-0 transition-colors"
                                    title="מחק תבנית ממשק זה"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Card>
    )
}
