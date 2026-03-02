'use client'

import { useState, useEffect, useMemo } from 'react'
import { Activity, DollarSign, Bell, MessageSquare, FileText, Users, ChevronDown, Filter, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface ActivityItem {
    id: string
    type: 'payment' | 'reminder' | 'message' | 'note'
    title: string
    subtitle: string
    clientName: string
    clientId?: string
    timestamp: string
    date: Date
}

const typeConfig = {
    payment: { icon: DollarSign, label: 'תשלום', color: 'text-emerald', bg: 'bg-emerald-50 dark:bg-emerald-500/10', dot: 'bg-emerald' },
    reminder: { icon: Bell, label: 'תזכורת', color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10', dot: 'bg-amber-500' },
    message: { icon: MessageSquare, label: 'הודעה', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10', dot: 'bg-blue-500' },
    note: { icon: FileText, label: 'הערה', color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-500/10', dot: 'bg-purple-500' },
}

export default function ActivityPage() {
    const [items, setItems] = useState<ActivityItem[]>([])
    const [loading, setLoading] = useState(true)
    const [filterType, setFilterType] = useState<string>('all')

    useEffect(() => { loadActivity() }, [])

    const loadActivity = async () => {
        setLoading(true)
        try {
            const [payments, reminders, messages, notes] = await Promise.all([
                supabase.from('payments').select('id, client_id, amount, payment_date, payment_status, description, clients(name)')
                    .order('payment_date', { ascending: false }).limit(30),
                supabase.from('reminders').select('id, client_id, title, due_date, is_completed, clients(name)')
                    .order('due_date', { ascending: false }).limit(30),
                supabase.from('messages').select('id, client_id, content, created_at, sender, clients(name)')
                    .order('created_at', { ascending: false }).limit(20),
                supabase.from('notes').select('id, client_id, content, created_at, clients(name)')
                    .order('created_at', { ascending: false }).limit(20),
            ])

            const allItems: ActivityItem[] = []

            for (const p of payments.data || []) {
                const cn = (p as any).clients?.name || 'לקוח'
                allItems.push({
                    id: `p-${p.id}`, type: 'payment',
                    title: `₪${p.amount.toLocaleString()} — ${p.payment_status}`,
                    subtitle: p.description || 'תשלום',
                    clientName: cn, clientId: p.client_id,
                    timestamp: new Date(p.payment_date).toLocaleDateString('he-IL'),
                    date: new Date(p.payment_date),
                })
            }

            for (const r of reminders.data || []) {
                const cn = (r as any).clients?.name || 'כללי'
                allItems.push({
                    id: `r-${r.id}`, type: 'reminder',
                    title: r.title,
                    subtitle: r.is_completed ? 'הושלם' : 'פתוח',
                    clientName: cn, clientId: r.client_id,
                    timestamp: new Date(r.due_date).toLocaleDateString('he-IL'),
                    date: new Date(r.due_date),
                })
            }

            for (const m of messages.data || []) {
                const cn = (m as any).clients?.name || 'לקוח'
                allItems.push({
                    id: `m-${m.id}`, type: 'message',
                    title: `${m.sender === 'client' ? 'נכנסת' : 'יוצאת'}: ${(m.content || '').substring(0, 60)}`,
                    subtitle: m.sender === 'client' ? 'הודעה מלקוח' : 'הודעה ללקוח',
                    clientName: cn, clientId: m.client_id,
                    timestamp: new Date(m.created_at).toLocaleDateString('he-IL'),
                    date: new Date(m.created_at),
                })
            }

            for (const n of notes.data || []) {
                const cn = (n as any).clients?.name || 'כללי'
                allItems.push({
                    id: `n-${n.id}`, type: 'note',
                    title: (n.content || '').substring(0, 60),
                    subtitle: 'הערה',
                    clientName: cn, clientId: n.client_id,
                    timestamp: new Date(n.created_at).toLocaleDateString('he-IL'),
                    date: new Date(n.created_at),
                })
            }

            allItems.sort((a, b) => b.date.getTime() - a.date.getTime())
            setItems(allItems)
        } catch (e) { console.error('Activity error:', e) }
        finally { setLoading(false) }
    }

    const filtered = useMemo(() => {
        if (filterType === 'all') return items
        return items.filter(i => i.type === filterType)
    }, [items, filterType])

    // Group by date
    const grouped = useMemo(() => {
        const groups: Record<string, ActivityItem[]> = {}
        for (const item of filtered) {
            const key = item.timestamp
            if (!groups[key]) groups[key] = []
            groups[key].push(item)
        }
        return Object.entries(groups)
    }, [filtered])

    if (loading) {
        return (
            <div className="p-6 sm:p-8">
                <div className="mb-8 animate-pulse">
                    <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded-lg mb-2" />
                    <div className="h-4 w-64 bg-slate-200 dark:bg-slate-700 rounded" />
                </div>
                <div className="space-y-3">
                    {[...Array(6)].map((_, i) => <div key={i} className="h-16 shimmer rounded-xl" />)}
                </div>
            </div>
        )
    }

    return (
        <div className="p-6 sm:p-8" dir="rtl">
            {/* Header */}
            <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in-up">
                <div>
                    <h1 className="text-3xl font-extrabold text-navy tracking-tight mb-2">לוג פעילות</h1>
                    <div className="flex items-center gap-2">
                        <div className="h-1 w-12 bg-purple rounded-full" />
                        <p className="text-grey font-medium">כל הפעולות והאירועים במערכת</p>
                    </div>
                </div>

                {/* Filter */}
                <div className="flex items-center gap-2 flex-wrap">
                    {[
                        { key: 'all', label: 'הכל', icon: Activity },
                        { key: 'payment', label: 'תשלומים', icon: DollarSign },
                        { key: 'reminder', label: 'תזכורות', icon: Bell },
                        { key: 'message', label: 'הודעות', icon: MessageSquare },
                        { key: 'note', label: 'הערות', icon: FileText },
                    ].map(f => (
                        <Button key={f.key} variant="ghost" size="sm"
                            onClick={() => setFilterType(f.key)}
                            className={cn("rounded-xl text-xs gap-1.5 h-9 font-bold transition-all",
                                filterType === f.key ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-white dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 text-grey"
                            )}>
                            <f.icon className="h-3.5 w-3.5" />
                            {f.label}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Timeline */}
            <div className="relative">
                {/* Vertical line */}
                <div className="absolute right-5 top-0 bottom-0 w-px bg-slate-200 dark:bg-slate-700/50" />

                {grouped.map(([date, dateItems]) => (
                    <div key={date} className="mb-8 animate-fade-in-up">
                        {/* Date header */}
                        <div className="relative flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 flex items-center justify-center z-10">
                                <Calendar className="h-4 w-4 text-grey" />
                            </div>
                            <span className="text-sm font-bold text-navy">{date}</span>
                            <span className="text-xs text-grey bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{dateItems.length}</span>
                        </div>

                        {/* Items */}
                        <div className="space-y-2 pr-14">
                            {dateItems.map(item => {
                                const cfg = typeConfig[item.type]
                                const Icon = cfg.icon
                                return (
                                    <Link
                                        key={item.id}
                                        href={item.clientId ? `/clients/${item.clientId}` : '#'}
                                        className="group flex items-start gap-3 p-3.5 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/30 hover:border-primary/30 hover:shadow-sm transition-all"
                                    >
                                        {/* Dot on timeline */}
                                        <div className="absolute right-[17px] mt-4">
                                            <div className={cn("w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900", cfg.dot)} />
                                        </div>

                                        <div className={cn("p-2 rounded-xl shrink-0", cfg.bg, cfg.color)}>
                                            <Icon className="h-4 w-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-navy truncate group-hover:text-primary transition-colors">{item.title}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-xs text-grey">{item.clientName}</span>
                                                <span className="text-[10px] text-grey">{item.subtitle}</span>
                                            </div>
                                        </div>
                                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0", cfg.bg, cfg.color)}>{cfg.label}</span>
                                    </Link>
                                )
                            })}
                        </div>
                    </div>
                ))}

                {filtered.length === 0 && (
                    <div className="glass-card rounded-2xl p-16 text-center animate-fade-in-up">
                        <Activity className="h-16 w-16 text-grey/20 mx-auto mb-4" />
                        <p className="text-grey font-medium">אין פעילות להצגה</p>
                    </div>
                )}
            </div>
        </div>
    )
}
