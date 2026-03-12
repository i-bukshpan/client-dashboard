'use client'

import { useState, useEffect, useMemo } from 'react'
import { 
  Wallet, TrendingUp, TrendingDown, DollarSign, 
  ArrowRight, Filter, Calendar, Users, AlertCircle,
  CheckCircle2, Clock, BarChart3
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase, type Payment, type Client } from '@/lib/supabase'
import Link from 'next/link'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { he } from 'date-fns/locale'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from 'recharts'

type PaymentWithClient = Payment & { clients: Client | null }

export default function CashflowPage() {
  const [payments, setPayments] = useState<PaymentWithClient[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('6months')

  useEffect(() => {
    loadPayments()
  }, [period])

  const loadPayments = async () => {
    setLoading(true)
    try {
      let startDate: Date
      const now = new Date()
      
      switch (period) {
        case '1month': startDate = subMonths(now, 1); break
        case '3months': startDate = subMonths(now, 3); break
        case '6months': startDate = subMonths(now, 6); break
        case '12months': startDate = subMonths(now, 12); break
        default: startDate = subMonths(now, 6)
      }

      const { data, error } = await supabase
        .from('payments')
        .select('*, clients(*)')
        .gte('payment_date', startDate.toISOString().split('T')[0])
        .order('payment_date', { ascending: true })

      if (!error && data) {
        setPayments(data as PaymentWithClient[])
      }
    } catch (error) {
      console.error('Error loading payments:', error)
    } finally {
      setLoading(false)
    }
  }

  // KPIs
  const kpis = useMemo(() => {
    const paid = payments.filter(p => p.payment_status === 'שולם')
    const pending = payments.filter(p => p.payment_status === 'ממתין')
    
    const totalIncome = paid
      .filter(p => p.payment_type === 'income' || (!p.payment_type && p.amount > 0))
      .reduce((sum, p) => sum + Math.abs(p.amount), 0)
    
    const totalExpense = paid
      .filter(p => p.payment_type === 'expense')
      .reduce((sum, p) => sum + Math.abs(p.amount), 0)

    const pendingTotal = pending.reduce((sum, p) => sum + Math.abs(p.amount), 0)

    return { totalIncome, totalExpense, profit: totalIncome - totalExpense, pendingTotal, pendingCount: pending.length }
  }, [payments])

  // Chart data – monthly breakdown
  const chartData = useMemo(() => {
    const months = new Map<string, { month: string, income: number, expense: number }>()
    
    for (const p of payments) {
      if (p.payment_status !== 'שולם') continue
      const monthKey = format(new Date(p.payment_date), 'yyyy-MM')
      const monthLabel = format(new Date(p.payment_date), 'MMM yy', { locale: he })

      if (!months.has(monthKey)) {
        months.set(monthKey, { month: monthLabel, income: 0, expense: 0 })
      }
      const entry = months.get(monthKey)!

      if (p.payment_type === 'expense') {
        entry.expense += Math.abs(p.amount)
      } else {
        entry.income += Math.abs(p.amount)
      }
    }

    return Array.from(months.values())
  }, [payments])

  // Pending payments grouped by client
  const pendingByClient = useMemo(() => {
    const pending = payments.filter(p => p.payment_status === 'ממתין')
    const grouped = new Map<string, { clientName: string, clientId: string, total: number, count: number }>()

    for (const p of pending) {
      const clientId = p.client_id
      const clientName = p.clients?.name || 'לא משויך'
      if (!grouped.has(clientId)) {
        grouped.set(clientId, { clientName, clientId, total: 0, count: 0 })
      }
      const entry = grouped.get(clientId)!
      entry.total += Math.abs(p.amount)
      entry.count++
    }

    return Array.from(grouped.values()).sort((a, b) => b.total - a.total)
  }, [payments])

  if (loading) {
    return (
      <div className="p-6 md:p-10 space-y-8 animate-pulse" dir="rtl">
        <div className="h-20 bg-grey/10 rounded-3xl w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-grey/10 rounded-3xl" />)}
        </div>
        <div className="h-80 bg-grey/10 rounded-3xl" />
      </div>
    )
  }

  return (
    <div className="p-6 md:p-10 space-y-10 bg-slate-50/50 min-h-screen" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 animate-fade-in-up">
        <div>
          <h1 className="text-4xl font-black text-navy tracking-tight mb-2">כספים</h1>
          <p className="text-grey font-bold flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            תמונה כספית כוללת – הכנסות, הוצאות ותשלומים
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="rounded-xl w-40 h-12 border-border/50 bg-white/50 font-bold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="1month">חודש אחרון</SelectItem>
              <SelectItem value="3months">3 חודשים</SelectItem>
              <SelectItem value="6months">6 חודשים</SelectItem>
              <SelectItem value="12months">שנה</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in-up delay-100">
        <KpiCard icon={TrendingUp} label="סה״כ הכנסות" value={`₪${kpis.totalIncome.toLocaleString()}`} color="emerald" />
        <KpiCard icon={TrendingDown} label="סה״כ הוצאות" value={`₪${kpis.totalExpense.toLocaleString()}`} color="rose" />
        <KpiCard icon={DollarSign} label="רווח נקי" value={`₪${kpis.profit.toLocaleString()}`} color={kpis.profit >= 0 ? 'blue' : 'rose'} />
        <KpiCard icon={AlertCircle} label="ממתינים לגבייה" value={`₪${kpis.pendingTotal.toLocaleString()}`} subtitle={`${kpis.pendingCount} תשלומים`} color="amber" />
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card className="rounded-[2.5rem] border-border/50 bg-white/70 backdrop-blur-xl shadow-xl shadow-navy/5 overflow-hidden p-8 animate-fade-in-up delay-200">
          <h2 className="text-2xl font-black text-navy mb-8 flex items-center gap-3">
            <div className="w-2 h-8 bg-blue-600 rounded-full" />
            הכנסות מול הוצאות
          </h2>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData} barGap={8}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fontWeight: 700, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 12, fontWeight: 700, fill: '#94a3b8' }} tickFormatter={(v) => `₪${(v/1000).toFixed(0)}K`} />
              <Tooltip 
                formatter={(value: number) => `₪${value.toLocaleString()}`}
                contentStyle={{ borderRadius: 16, border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }}
              />
              <Legend />
              <Bar dataKey="income" name="הכנסות" fill="#10b981" radius={[8, 8, 0, 0]} />
              <Bar dataKey="expense" name="הוצאות" fill="#f43f5e" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Pending Payments */}
      <Card className="rounded-[2.5rem] border-border/50 bg-white/70 backdrop-blur-xl shadow-xl shadow-navy/5 overflow-hidden animate-fade-in-up delay-300">
        <div className="p-8 border-b border-border/40 flex items-center justify-between">
          <h2 className="text-2xl font-black text-navy flex items-center gap-3">
            <div className="w-2 h-8 bg-amber-500 rounded-full" />
            תשלומים ממתינים
          </h2>
          <span className="px-4 py-1.5 rounded-full bg-amber-50 text-amber-600 text-xs font-black uppercase tracking-widest">
            {kpis.pendingCount} ממתינים
          </span>
        </div>
        <div className="p-4 sm:p-8">
          {pendingByClient.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <CheckCircle2 className="h-12 w-12 text-emerald-300 mx-auto" />
              <p className="text-navy font-bold text-lg">אין תשלומים ממתינים</p>
              <p className="text-grey text-sm">הכל מסודר! 🎉</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingByClient.map(item => (
                <Link
                  key={item.clientId}
                  href={`/clients/${item.clientId}`}
                  className="flex items-center justify-between p-5 rounded-2xl border border-border/40 bg-white/50 hover:border-amber-300 hover:shadow-md transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-navy group-hover:text-amber-600 transition-colors">{item.clientName}</h4>
                      <p className="text-xs font-bold text-grey">{item.count} תשלומים ממתינים</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xl font-black text-amber-600">₪{item.total.toLocaleString()}</span>
                    <ArrowRight className="h-4 w-4 text-grey opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

function KpiCard({ icon: Icon, label, value, subtitle, color }: any) {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    emerald: 'bg-green-50 text-emerald-600 border-green-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
  }
  return (
    <Card className="p-6 rounded-3xl border-border/40 bg-white/60 backdrop-blur-sm group hover:scale-[1.02] transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-2xl ${colors[color]} shadow-sm`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
      <div className="space-y-1">
        <div className="text-3xl font-black text-navy">{value}</div>
        <div className="text-sm font-bold text-navy/70 tracking-tight">{label}</div>
        {subtitle && <p className="text-[10px] text-grey font-medium uppercase tracking-wider">{subtitle}</p>}
      </div>
    </Card>
  )
}
