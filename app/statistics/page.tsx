'use client'

import { useState, useEffect, useMemo } from 'react'
import { TrendingUp, TrendingDown, Users, DollarSign, Calendar, ArrowUpDown } from 'lucide-react'
import { supabase, type Client, type Payment } from '@/lib/supabase'
import dynamic from 'next/dynamic'

// ── Code splitting: lazy-load heavy Recharts components ──
const LazyBarChart = dynamic(
  () => import('recharts').then(mod => {
    const { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } = mod
    return {
      default: ({ data, dataKey, fill, name }: { data: any[]; dataKey: string; fill: string; name: string }) => (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
            <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
            <Tooltip
              formatter={(value: number) => `₪${value.toLocaleString()}`}
              contentStyle={{
                background: 'var(--surface-1)',
                border: '1px solid var(--glass-border)',
                borderRadius: '12px',
                boxShadow: 'var(--glass-shadow)',
                color: 'var(--text-primary)',
              }}
            />
            <Legend />
            <Bar dataKey={dataKey} fill={fill} name={name} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )
    }
  }),
  {
    ssr: false,
    loading: () => <div className="h-[300px] shimmer rounded-xl" />,
  }
)

const LazyPieChart = dynamic(
  () => import('recharts').then(mod => {
    const { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } = mod
    return {
      default: ({ data }: { data: Array<{ name: string; value: number; color: string }> }) => (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }: any) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={90}
              innerRadius={50}
              fill="#8884d8"
              dataKey="value"
              strokeWidth={2}
              stroke="var(--surface-1)"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: 'var(--surface-1)',
                border: '1px solid var(--glass-border)',
                borderRadius: '12px',
                boxShadow: 'var(--glass-shadow)',
                color: 'var(--text-primary)',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      )
    }
  }),
  {
    ssr: false,
    loading: () => <div className="h-[300px] shimmer rounded-xl" />,
  }
)

const LazyLineChart = dynamic(
  () => import('recharts').then(mod => {
    const { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } = mod
    return {
      default: ({ data }: { data: any[] }) => (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
            <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
            <Tooltip
              formatter={(value: number) => `₪${value.toLocaleString()}`}
              contentStyle={{
                background: 'var(--surface-1)',
                border: '1px solid var(--glass-border)',
                borderRadius: '12px',
                boxShadow: 'var(--glass-shadow)',
                color: 'var(--text-primary)',
              }}
            />
            <Legend />
            <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={3} name="הכנסות" dot={{ r: 4, fill: '#10b981', stroke: 'var(--surface-1)', strokeWidth: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      )
    }
  }),
  {
    ssr: false,
    loading: () => <div className="h-[300px] shimmer rounded-xl" />,
  }
)

export default function StatisticsPage() {
  const [loading, setLoading] = useState(true)
  const [clients, setClients] = useState<Client[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'quarter' | 'year'>('month')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)

      const [clientsResult, paymentsResult] = await Promise.all([
        supabase.from('clients').select('*'),
        supabase.from('payments').select('*').eq('payment_status', 'שולם'),
      ])

      setClients(clientsResult.data || [])
      setPayments(paymentsResult.data || [])
    } catch (error) {
      console.error('Error loading statistics:', error)
    } finally {
      setLoading(false)
    }
  }

  const stats = useMemo(() => {
    const totalClients = clients.length
    const activeClients = clients.filter(c => c.status === 'פעיל').length
    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0)
    const avgPayment = payments.length > 0 ? Math.round(totalRevenue / payments.length) : 0

    const monthlyRevenue = payments.reduce((acc, payment) => {
      const month = new Date(payment.payment_date).toLocaleDateString('he-IL', { month: 'short', year: 'numeric' })
      acc[month] = (acc[month] || 0) + payment.amount
      return acc
    }, {} as Record<string, number>)

    const monthlyChartData = Object.entries(monthlyRevenue)
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())
      .slice(-12)

    const statusData = [
      { name: 'פעיל', value: clients.filter(c => c.status === 'פעיל').length, color: '#10b981' },
      { name: 'ליד', value: clients.filter(c => c.status === 'ליד').length, color: '#3b82f6' },
      { name: 'ארכיון', value: clients.filter(c => c.status === 'ארכיון').length, color: '#64748b' },
    ]

    const paymentMethods = payments.reduce((acc, payment) => {
      const method = payment.payment_method || 'אחר'
      acc[method] = (acc[method] || 0) + payment.amount
      return acc
    }, {} as Record<string, number>)

    const paymentMethodsData = Object.entries(paymentMethods)
      .map(([name, value]) => ({ name, value, month: name }))
      .sort((a, b) => b.value - a.value)

    return {
      totalClients,
      activeClients,
      totalRevenue,
      avgPayment,
      monthlyChartData,
      statusData,
      paymentMethodsData,
    }
  }, [clients, payments])

  if (loading) {
    return (
      <div className="p-8">
        <div className="mb-8 animate-pulse">
          <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded-lg mb-2" />
          <div className="h-4 w-64 bg-slate-200 dark:bg-slate-700 rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 shimmer rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-[380px] shimmer rounded-2xl" />
          <div className="h-[380px] shimmer rounded-2xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 sm:p-8" dir="rtl">
      <div className="mb-10 animate-fade-in-up">
        <h1 className="text-3xl font-extrabold text-navy tracking-tight mb-2">דשבורד סטטיסטיקות</h1>
        <div className="flex items-center gap-2">
          <div className="h-1 w-12 bg-emerald rounded-full" />
          <p className="text-grey font-medium">סקירה כללית של הפעילות העסקית</p>
        </div>
      </div>

      {/* Summary Cards — Glassmorphism */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <div className="glass-card hover-lift rounded-2xl p-6 animate-fade-in-up delay-100 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 dark:bg-blue-400/5 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-150" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <span className="text-xs font-bold text-grey">סה"כ</span>
            </div>
            <p className="text-3xl font-extrabold text-navy">{stats.totalClients}</p>
            <p className="text-sm text-grey mt-1">{stats.activeClients} לקוחות פעילים</p>
          </div>
        </div>

        <div className="glass-card hover-lift rounded-2xl p-6 animate-fade-in-up delay-200 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald/5 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-150" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald">
                <TrendingUp className="h-5 w-5" />
              </div>
              <span className="text-xs font-bold text-grey">הכנסות</span>
            </div>
            <p className="text-3xl font-extrabold text-emerald">₪{stats.totalRevenue.toLocaleString()}</p>
            <p className="text-sm text-grey mt-1">תשלומים שנקלטו</p>
          </div>
        </div>

        <div className="glass-card hover-lift rounded-2xl p-6 animate-fade-in-up delay-300 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber/5 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-150" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600">
                <ArrowUpDown className="h-5 w-5" />
              </div>
              <span className="text-xs font-bold text-grey">ממוצע</span>
            </div>
            <p className="text-3xl font-extrabold text-navy">₪{stats.avgPayment.toLocaleString()}</p>
            <p className="text-sm text-grey mt-1">לכל תשלום</p>
          </div>
        </div>

        <div className="glass-card hover-lift rounded-2xl p-6 animate-fade-in-up delay-400 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple/5 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-150" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-600">
                <DollarSign className="h-5 w-5" />
              </div>
              <span className="text-xs font-bold text-grey">מס' תשלומים</span>
            </div>
            <p className="text-3xl font-extrabold text-navy">{payments.length}</p>
            <p className="text-sm text-grey mt-1">סה"כ שנרשמו</p>
          </div>
        </div>
      </div>

      {/* Charts — Glassmorphism */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="glass-card rounded-2xl p-6 animate-fade-in-up delay-500">
          <h2 className="text-lg font-bold text-navy mb-6">הכנסות חודשיות</h2>
          <LazyBarChart data={stats.monthlyChartData} dataKey="amount" fill="#10b981" name="הכנסות" />
        </div>

        <div className="glass-card rounded-2xl p-6 animate-fade-in-up delay-500">
          <h2 className="text-lg font-bold text-navy mb-6">התפלגות לקוחות לפי סטטוס</h2>
          <LazyPieChart data={stats.statusData} />
        </div>
      </div>

      {stats.paymentMethodsData.length > 0 && (
        <div className="glass-card rounded-2xl p-6 mb-8 animate-fade-in-up">
          <h2 className="text-lg font-bold text-navy mb-6">התפלגות אמצעי תשלום</h2>
          <LazyBarChart data={stats.paymentMethodsData} dataKey="value" fill="#3b82f6" name="סכום" />
        </div>
      )}

      {stats.monthlyChartData.length > 0 && (
        <div className="glass-card rounded-2xl p-6 animate-fade-in-up">
          <h2 className="text-lg font-bold text-navy mb-6">מגמת הכנסות</h2>
          <LazyLineChart data={stats.monthlyChartData} />
        </div>
      )}
    </div>
  )
}
