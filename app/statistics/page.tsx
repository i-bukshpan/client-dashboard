'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Users, DollarSign, Calendar } from 'lucide-react'
import { supabase, type Client, type Payment } from '@/lib/supabase'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts'

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

      // Load clients
      const { data: clientsData } = await supabase
        .from('clients')
        .select('*')

      // Load payments
      const { data: paymentsData } = await supabase
        .from('payments')
        .select('*')
        .eq('payment_status', 'שולם')

      setClients(clientsData || [])
      setPayments(paymentsData || [])
    } catch (error) {
      console.error('Error loading statistics:', error)
    } finally {
      setLoading(false)
    }
  }

  // Calculate statistics
  const totalClients = clients.length
  const activeClients = clients.filter(c => c.status === 'פעיל').length
  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0)
  const pendingPayments = payments.filter(p => p.payment_status === 'ממתין').reduce((sum, p) => sum + p.amount, 0)

  // Monthly revenue chart data
  const monthlyRevenue = payments.reduce((acc, payment) => {
    const month = new Date(payment.payment_date).toLocaleDateString('he-IL', { month: 'short', year: 'numeric' })
    if (!acc[month]) {
      acc[month] = 0
    }
    acc[month] += payment.amount
    return acc
  }, {} as Record<string, number>)

  const monthlyChartData = Object.entries(monthlyRevenue)
    .map(([month, amount]) => ({ month, amount }))
    .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())
    .slice(-12)

  // Client status distribution
  const statusData = [
    { name: 'פעיל', value: clients.filter(c => c.status === 'פעיל').length, color: '#10b981' },
    { name: 'ליד', value: clients.filter(c => c.status === 'ליד').length, color: '#3b82f6' },
    { name: 'ארכיון', value: clients.filter(c => c.status === 'ארכיון').length, color: '#6b7280' },
  ]

  // Payment methods distribution
  const paymentMethods = payments.reduce((acc, payment) => {
    const method = payment.payment_method || 'אחר'
    acc[method] = (acc[method] || 0) + payment.amount
    return acc
  }, {} as Record<string, number>)

  const paymentMethodsData = Object.entries(paymentMethods)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6']

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <p className="text-grey">טוען סטטיסטיקות...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8" dir="rtl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-navy mb-2">דשבורד סטטיסטיקות</h1>
        <p className="text-grey">סקירה כללית של הפעילות העסקית</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-grey/20 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-grey mb-1">סה"כ לקוחות</p>
              <p className="text-2xl font-bold text-navy">{totalClients}</p>
              <p className="text-xs text-grey mt-1">{activeClients} פעילים</p>
            </div>
            <Users className="h-8 w-8 text-navy/20" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-grey/20 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-grey mb-1">סה"כ הכנסות</p>
              <p className="text-2xl font-bold text-emerald">₪{totalRevenue.toLocaleString()}</p>
              <p className="text-xs text-grey mt-1">תשלומים שולמו</p>
            </div>
            <TrendingUp className="h-8 w-8 text-emerald/20" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-grey/20 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-grey mb-1">תשלומים ממתינים</p>
              <p className="text-2xl font-bold text-yellow-600">₪{pendingPayments.toLocaleString()}</p>
              <p className="text-xs text-grey mt-1">עדיין לא שולמו</p>
            </div>
            <TrendingDown className="h-8 w-8 text-yellow-600/20" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-grey/20 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-grey mb-1">ממוצע תשלום</p>
              <p className="text-2xl font-bold text-navy">
                ₪{payments.length > 0 ? Math.round(totalRevenue / payments.length).toLocaleString() : 0}
              </p>
              <p className="text-xs text-grey mt-1">לתשלום</p>
            </div>
            <DollarSign className="h-8 w-8 text-navy/20" />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Monthly Revenue Chart */}
        <div className="bg-white rounded-lg border border-grey/20 p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">הכנסות חודשיות</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value: number) => `₪${value.toLocaleString()}`} />
              <Legend />
              <Bar dataKey="amount" fill="#10b981" name="הכנסות" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Client Status Distribution */}
        <div className="bg-white rounded-lg border border-grey/20 p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">התפלגות לקוחות לפי סטטוס</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Payment Methods */}
      {paymentMethodsData.length > 0 && (
        <div className="bg-white rounded-lg border border-grey/20 p-6 shadow-sm mb-8">
          <h2 className="text-xl font-semibold mb-4">התפלגות אמצעי תשלום</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={paymentMethodsData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value: number) => `₪${value.toLocaleString()}`} />
              <Legend />
              <Bar dataKey="value" fill="#3b82f6" name="סכום" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Revenue Trend */}
      {monthlyChartData.length > 0 && (
        <div className="bg-white rounded-lg border border-grey/20 p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">מגמת הכנסות</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value: number) => `₪${value.toLocaleString()}`} />
              <Legend />
              <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2} name="הכנסות" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

