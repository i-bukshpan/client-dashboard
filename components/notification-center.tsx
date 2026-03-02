'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, DollarSign, Calendar, MessageSquare, X, Check, ExternalLink } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface Notification {
    id: string
    type: 'payment' | 'reminder' | 'message'
    title: string
    subtitle: string
    href: string
    time: string
    read: boolean
}

export function NotificationCenter() {
    const [open, setOpen] = useState(false)
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [loading, setLoading] = useState(false)
    const panelRef = useRef<HTMLDivElement>(null)
    const router = useRouter()

    const unreadCount = notifications.filter(n => !n.read).length

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        if (open) document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [open])

    // Load notifications when opened
    useEffect(() => {
        if (!open) return
        loadNotifications()
    }, [open])

    const loadNotifications = async () => {
        setLoading(true)
        try {
            const now = new Date()
            const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

            const [pendingPayments, upcomingReminders, unreadMessages] = await Promise.all([
                supabase.from('payments').select('id, client_id, amount, payment_date, clients(name)')
                    .eq('payment_status', 'ממתין').order('payment_date', { ascending: true }).limit(5),
                supabase.from('reminders').select('id, client_id, title, due_date, clients(name)')
                    .eq('is_completed', false).lte('due_date', weekFromNow.toISOString().split('T')[0])
                    .order('due_date', { ascending: true }).limit(5),
                supabase.from('messages').select('id, client_id, content, created_at, clients(name)')
                    .eq('is_read', false).eq('sender', 'client').order('created_at', { ascending: false }).limit(5),
            ])

            const all: Notification[] = []

            for (const p of pendingPayments.data || []) {
                const clientName = (p as any).clients?.name || 'לקוח'
                all.push({
                    id: `p-${p.id}`, type: 'payment',
                    title: `תשלום ממתין: ₪${p.amount.toLocaleString()}`,
                    subtitle: clientName,
                    href: `/clients/${p.client_id}`,
                    time: new Date(p.payment_date).toLocaleDateString('he-IL'),
                    read: false,
                })
            }

            for (const r of upcomingReminders.data || []) {
                const clientName = (r as any).clients?.name || 'כללי'
                const isOverdue = new Date(r.due_date) < now
                all.push({
                    id: `r-${r.id}`, type: 'reminder',
                    title: `${isOverdue ? '⚠️ ' : ''}${r.title}`,
                    subtitle: `${clientName} • ${new Date(r.due_date).toLocaleDateString('he-IL')}`,
                    href: r.client_id ? `/clients/${r.client_id}` : '/calendar',
                    time: isOverdue ? 'איחור!' : new Date(r.due_date).toLocaleDateString('he-IL'),
                    read: false,
                })
            }

            for (const m of unreadMessages.data || []) {
                const clientName = (m as any).clients?.name || 'לקוח'
                all.push({
                    id: `m-${m.id}`, type: 'message',
                    title: `הודעה חדשה מ${clientName}`,
                    subtitle: (m.content || '').substring(0, 50),
                    href: `/clients/${m.client_id}`,
                    time: new Date(m.created_at).toLocaleDateString('he-IL'),
                    read: false,
                })
            }

            setNotifications(all)
        } catch (e) { console.error('Notification error:', e) }
        finally { setLoading(false) }
    }

    const markAllRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    }

    const typeIcons = {
        payment: DollarSign,
        reminder: Calendar,
        message: MessageSquare,
    }
    const typeColors = {
        payment: 'text-emerald bg-emerald-50 dark:bg-emerald-500/10',
        reminder: 'text-amber-500 bg-amber-50 dark:bg-amber-500/10',
        message: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10',
    }

    return (
        <div className="relative" ref={panelRef}>
            {/* Bell trigger */}
            <button
                onClick={() => setOpen(prev => !prev)}
                className={cn(
                    "relative h-10 w-10 rounded-xl flex items-center justify-center transition-all duration-200",
                    "bg-slate-100/80 hover:bg-slate-200/80 dark:bg-slate-800/80 dark:hover:bg-slate-700/80",
                    "border border-slate-200/50 dark:border-slate-700/50",
                    open && "bg-primary/10 border-primary/30"
                )}
            >
                <Bell className="h-4 w-4 text-grey" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -left-1 h-5 min-w-[20px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                        {unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown panel */}
            {open && (
                <div className="absolute left-0 sm:left-auto sm:right-0 top-14 w-80 sm:w-96 z-50 glass-card rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-2xl overflow-hidden animate-fade-in-up" style={{ animationDuration: '150ms' }} dir="rtl">
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200/50 dark:border-slate-700/30">
                        <h3 className="text-sm font-bold text-navy">התראות</h3>
                        {unreadCount > 0 && (
                            <button onClick={markAllRead} className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                                <Check className="h-3 w-3" /> סמן הכל כנקרא
                            </button>
                        )}
                    </div>

                    {/* List */}
                    <div className="max-h-[50vh] overflow-y-auto custom-scrollbar">
                        {loading && (
                            <div className="p-6 text-center">
                                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                            </div>
                        )}

                        {!loading && notifications.length === 0 && (
                            <div className="p-8 text-center">
                                <Bell className="h-8 w-8 text-grey/20 mx-auto mb-2" />
                                <p className="text-sm text-grey">אין התראות חדשות</p>
                            </div>
                        )}

                        {!loading && notifications.map(n => {
                            const Icon = typeIcons[n.type]
                            const colors = typeColors[n.type]
                            return (
                                <button
                                    key={n.id}
                                    onClick={() => { setOpen(false); router.push(n.href) }}
                                    className={cn(
                                        "w-full flex items-start gap-3 px-5 py-3.5 text-right transition-all hover:bg-slate-50/80 dark:hover:bg-slate-800/50 border-b border-slate-100/50 dark:border-slate-800/30",
                                        !n.read && "bg-primary/[0.03]"
                                    )}
                                >
                                    <div className={cn("p-2 rounded-xl shrink-0 mt-0.5", colors)}>
                                        <Icon className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={cn("text-sm font-semibold text-navy truncate", n.read && "font-normal text-grey")}>{n.title}</p>
                                        <p className="text-xs text-grey truncate mt-0.5">{n.subtitle}</p>
                                    </div>
                                    <span className="text-[10px] text-grey font-medium shrink-0 mt-1">{n.time}</span>
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}
