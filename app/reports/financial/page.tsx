'use client'

import { useState, useEffect, useMemo } from 'react'
import { FileText, Download, Calendar, TrendingUp, TrendingDown, ArrowUpDown, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase, type Payment } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import dynamic from 'next/dynamic'

const LazyBarChart = dynamic(
    () => import('recharts').then(mod => {
        const { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } = mod
        return {
            default: ({ data }: { data: any[] }) => (
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="label" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                        <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                        <Tooltip formatter={(v: number) => `₪${v.toLocaleString()}`}
                            contentStyle={{ background: 'var(--surface-1)', border: '1px solid var(--glass-border)', borderRadius: '12px', color: 'var(--text-primary)' }} />
                        <Bar dataKey="income" fill="#10b981" name="הכנסות" radius={[6, 6, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            )
        }
    }),
    { ssr: false, loading: () => <div className="h-[300px] shimmer rounded-xl" /> }
)

type Period = 'month' | 'quarter' | 'year'

export default function FinancialReportsPage() {
    const [payments, setPayments] = useState<Payment[]>([])
    const [clients, setClients] = useState<Array<{ id: string; name: string; status: string }>>([])
    const [loading, setLoading] = useState(true)
    const [period, setPeriod] = useState<Period>('month')
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())

    useEffect(() => { loadData() }, [])

    const loadData = async () => {
        setLoading(true)
        try {
            const [p, c] = await Promise.all([
                supabase.from('payments').select('*').eq('payment_status', 'שולם').order('payment_date', { ascending: false }),
                supabase.from('clients').select('id, name, status'),
            ])
            setPayments(p.data || [])
            setClients((c.data || []) as Array<{ id: string; name: string; status: string }>)
        } catch (e) { console.error(e) }
        finally { setLoading(false) }
    }

    const monthNames = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']

    const report = useMemo(() => {
        let startDate: Date, endDate: Date, label: string, prevStart: Date, prevEnd: Date

        if (period === 'month') {
            startDate = new Date(selectedYear, selectedMonth, 1)
            endDate = new Date(selectedYear, selectedMonth + 1, 0)
            label = `${monthNames[selectedMonth]} ${selectedYear}`
            prevStart = new Date(selectedYear, selectedMonth - 1, 1)
            prevEnd = new Date(selectedYear, selectedMonth, 0)
        } else if (period === 'quarter') {
            const q = Math.floor(selectedMonth / 3)
            startDate = new Date(selectedYear, q * 3, 1)
            endDate = new Date(selectedYear, q * 3 + 3, 0)
            label = `רבעון ${q + 1} / ${selectedYear}`
            prevStart = new Date(selectedYear, q * 3 - 3, 1)
            prevEnd = new Date(selectedYear, q * 3, 0)
        } else {
            startDate = new Date(selectedYear, 0, 1)
            endDate = new Date(selectedYear, 11, 31)
            label = `שנת ${selectedYear}`
            prevStart = new Date(selectedYear - 1, 0, 1)
            prevEnd = new Date(selectedYear - 1, 11, 31)
        }

        const currentPayments = payments.filter(p => {
            const d = new Date(p.payment_date)
            return d >= startDate && d <= endDate
        })

        const prevPayments = payments.filter(p => {
            const d = new Date(p.payment_date)
            return d >= prevStart && d <= prevEnd
        })

        const totalIncome = currentPayments.reduce((s, p) => s + p.amount, 0)
        const prevIncome = prevPayments.reduce((s, p) => s + p.amount, 0)
        const changePercent = prevIncome > 0 ? ((totalIncome - prevIncome) / prevIncome * 100) : 0
        const avgPayment = currentPayments.length > 0 ? Math.round(totalIncome / currentPayments.length) : 0

        // By method
        const byMethod: Record<string, number> = {}
        for (const p of currentPayments) {
            const m = p.payment_method || 'אחר'
            byMethod[m] = (byMethod[m] || 0) + p.amount
        }

        // By client (top 10)
        const byClient: Record<string, { name: string; total: number }> = {}
        const clientMap = new Map(clients.map(c => [c.id, c.name]))
        for (const p of currentPayments) {
            const name = clientMap.get(p.client_id) || 'לא ידוע'
            if (!byClient[p.client_id]) byClient[p.client_id] = { name, total: 0 }
            byClient[p.client_id].total += p.amount
        }
        const topClients = Object.values(byClient).sort((a, b) => b.total - a.total).slice(0, 10)

        // Monthly breakdown for chart
        const monthlyData: Record<string, number> = {}
        for (const p of currentPayments) {
            const d = new Date(p.payment_date)
            const key = `${d.getMonth() + 1}/${d.getFullYear()}`
            monthlyData[key] = (monthlyData[key] || 0) + p.amount
        }
        const chartData = Object.entries(monthlyData).map(([label, income]) => ({ label, income }))

        return { label, totalIncome, prevIncome, changePercent, avgPayment, paymentCount: currentPayments.length, byMethod, topClients, chartData }
    }, [payments, clients, period, selectedYear, selectedMonth])

    if (loading) {
        return (
            <div className="p-6 sm:p-8">
                <div className="mb-8 animate-pulse">
                    <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded-lg mb-2" />
                    <div className="h-4 w-64 bg-slate-200 dark:bg-slate-700 rounded" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    {[...Array(3)].map((_, i) => <div key={i} className="h-32 shimmer rounded-2xl" />)}
                </div>
            </div>
        )
    }

    return (
        <div className="p-6 sm:p-8" dir="rtl">
            {/* Header */}
            <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in-up">
                <div>
                    <h1 className="text-3xl font-extrabold text-navy tracking-tight mb-2">דוחות פיננסיים</h1>
                    <div className="flex items-center gap-2">
                        <div className="h-1 w-12 bg-emerald rounded-full" />
                        <p className="text-grey font-medium">ניתוח הכנסות ותשלומים</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {(['month', 'quarter', 'year'] as Period[]).map(p => (
                        <Button key={p} variant="ghost" size="sm"
                            onClick={() => setPeriod(p)}
                            className={cn("rounded-xl text-xs font-bold h-9",
                                period === p ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-white dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50")}>
                            {p === 'month' ? 'חודשי' : p === 'quarter' ? 'רבעוני' : 'שנתי'}
                        </Button>
                    ))}

                    <select value={selectedYear} onChange={e => setSelectedYear(+e.target.value)}
                        className="h-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 px-3 text-xs font-bold text-navy outline-none">
                        {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>

                    {period === 'month' && (
                        <select value={selectedMonth} onChange={e => setSelectedMonth(+e.target.value)}
                            className="h-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 px-3 text-xs font-bold text-navy outline-none">
                            {monthNames.map((name, i) => <option key={i} value={i}>{name}</option>)}
                        </select>
                    )}

                    <Button variant="ghost" size="sm" onClick={() => window.print()} className="rounded-xl text-xs gap-1.5 h-9 bg-white dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 text-grey">
                        <Printer className="h-3.5 w-3.5" /> הדפסה
                    </Button>
                </div>
            </div>

            {/* Period label */}
            <div className="glass-card rounded-2xl p-4 mb-6 animate-fade-in-up delay-100">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                        <FileText className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-navy">{report.label}</h2>
                        <p className="text-xs text-grey">{report.paymentCount} תשלומים נקלטו</p>
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div className="glass-card hover-lift rounded-2xl p-6 animate-fade-in-up delay-200">
                    <div className="flex items-center justify-between mb-3">
                        <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald">
                            <TrendingUp className="h-5 w-5" />
                        </div>
                        <span className="text-xs font-bold text-grey">הכנסות</span>
                    </div>
                    <p className="text-3xl font-extrabold text-emerald">₪{report.totalIncome.toLocaleString()}</p>
                    {report.changePercent !== 0 && (
                        <p className={cn("text-xs font-bold mt-1", report.changePercent > 0 ? "text-emerald" : "text-red-500")}>
                            {report.changePercent > 0 ? '+' : ''}{report.changePercent.toFixed(1)}% מהתקופה הקודמת
                        </p>
                    )}
                </div>

                <div className="glass-card hover-lift rounded-2xl p-6 animate-fade-in-up delay-300">
                    <div className="flex items-center justify-between mb-3">
                        <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-primary">
                            <ArrowUpDown className="h-5 w-5" />
                        </div>
                        <span className="text-xs font-bold text-grey">ממוצע</span>
                    </div>
                    <p className="text-3xl font-extrabold text-navy">₪{report.avgPayment.toLocaleString()}</p>
                    <p className="text-xs text-grey mt-1">לכל תשלום</p>
                </div>

                <div className="glass-card hover-lift rounded-2xl p-6 animate-fade-in-up delay-400">
                    <div className="flex items-center justify-between mb-3">
                        <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600">
                            <Calendar className="h-5 w-5" />
                        </div>
                        <span className="text-xs font-bold text-grey">תקופה קודמת</span>
                    </div>
                    <p className="text-3xl font-extrabold text-navy">₪{report.prevIncome.toLocaleString()}</p>
                    <p className="text-xs text-grey mt-1">להשוואה</p>
                </div>
            </div>

            {/* Chart */}
            {report.chartData.length > 0 && (
                <div className="glass-card rounded-2xl p-6 mb-8 animate-fade-in-up delay-500">
                    <h3 className="text-lg font-bold text-navy mb-6">פירוט הכנסות</h3>
                    <LazyBarChart data={report.chartData} />
                </div>
            )}

            {/* Two-column: Top Clients + Payment Methods */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Top Clients */}
                <div className="glass-card rounded-2xl p-6 animate-fade-in-up">
                    <h3 className="text-lg font-bold text-navy mb-4">Top 10 לקוחות</h3>
                    <div className="space-y-2">
                        {report.topClients.length === 0 && <p className="text-sm text-grey text-center py-4">אין נתונים</p>}
                        {report.topClients.map((c, i) => (
                            <div key={i} className="flex items-center justify-between py-2.5 px-3 rounded-xl border border-slate-100 dark:border-slate-700/30 bg-white dark:bg-slate-800/30">
                                <div className="flex items-center gap-3">
                                    <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">{i + 1}</span>
                                    <span className="font-semibold text-sm text-navy">{c.name}</span>
                                </div>
                                <span className="font-bold text-sm text-emerald">₪{c.total.toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* By Method */}
                <div className="glass-card rounded-2xl p-6 animate-fade-in-up">
                    <h3 className="text-lg font-bold text-navy mb-4">לפי אמצעי תשלום</h3>
                    <div className="space-y-3">
                        {Object.entries(report.byMethod).length === 0 && <p className="text-sm text-grey text-center py-4">אין נתונים</p>}
                        {Object.entries(report.byMethod).sort((a, b) => b[1] - a[1]).map(([method, amount]) => {
                            const pct = (amount / report.totalIncome) * 100
                            return (
                                <div key={method}>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-sm font-medium text-navy">{method}</span>
                                        <span className="text-sm font-bold text-grey">₪{amount.toLocaleString()} ({pct.toFixed(0)}%)</span>
                                    </div>
                                    <div className="w-full bg-slate-200/60 dark:bg-slate-700/50 rounded-full h-2 overflow-hidden">
                                        <div className="h-2 rounded-full bg-gradient-to-r from-primary to-blue-400 transition-all duration-500" style={{ width: `${pct}%` }} />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    )
}
