import { createClient } from '@/lib/supabase/server'
import { FinanceCharts } from '@/components/finance/FinanceCharts'
import { FinanceTables } from '@/components/finance/FinanceTables'
import { FinanceActions } from '@/components/finance/FinanceActions'
import { DollarSign, TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export const metadata = { title: 'פיננסים | Nehemiah OS' }

export default async function FinancePage() {
  const supabase = await createClient()
  const today = new Date()
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]

  const [{ data: income }, { data: expenses }, { data: clients }] = await Promise.all([
    supabase.from('income').select('*, clients(id, name)').order('date', { ascending: false }),
    supabase.from('expenses').select('*').order('date', { ascending: false }),
    supabase.from('clients').select('id, name').order('name'),
  ])

  // Monthly stats
  const monthlyIncome = income?.filter(r => r.date >= startOfMonth && r.date <= endOfMonth)
    .reduce((s, r) => s + Number(r.amount), 0) ?? 0
  const monthlyExpenses = expenses?.filter(r => r.date >= startOfMonth && r.date <= endOfMonth)
    .reduce((s, r) => s + Number(r.amount), 0) ?? 0
  const monthlyProfit = monthlyIncome - monthlyExpenses

  const stats = [
    { label: 'הכנסות החודש', value: monthlyIncome, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    { label: 'הוצאות החודש', value: monthlyExpenses, icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-100' },
    { label: 'רווח נקי החודש', value: monthlyProfit, icon: Wallet, color: 'text-blue-600', bg: 'bg-blue-100' },
  ]

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shadow-inner">
            <DollarSign className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-bold text-xl">ניהול פיננסי</h2>
            <p className="text-muted-foreground text-sm">מעקב הכנסות, הוצאות ותזרים</p>
          </div>
        </div>
        <FinanceActions clients={clients ?? []} />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-border/50 shadow-sm overflow-hidden">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl ${stat.bg} flex items-center justify-center shrink-0`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
                <p className={`text-xl font-black ${stat.color}`}>
                  ₪{stat.value.toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <FinanceCharts income={income ?? []} expenses={expenses ?? []} />

      {/* History Tables */}
      <FinanceTables income={income ?? []} expenses={expenses ?? []} />
    </div>
  )
}
