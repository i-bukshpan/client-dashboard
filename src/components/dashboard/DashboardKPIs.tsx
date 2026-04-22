'use client'

import { Card, CardContent } from '@/components/ui/card'
import { TrendingUp, TrendingDown, DollarSign, CheckSquare } from 'lucide-react'

interface DashboardKPIsProps {
  monthlyIncome: number
  monthlyExpenses: number
  pendingTasks: number
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(n)
}

export function DashboardKPIs({ monthlyIncome, monthlyExpenses, pendingTasks }: DashboardKPIsProps) {
  const profit = monthlyIncome - monthlyExpenses
  const profitPercent = monthlyIncome > 0 ? ((profit / monthlyIncome) * 100).toFixed(0) : '0'

  const kpis = [
    {
      label: 'הכנסות חודשיות',
      value: formatCurrency(monthlyIncome),
      icon: DollarSign,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
      trend: '+12% מחודש שעבר',
      trendUp: true,
    },
    {
      label: 'הוצאות חודשיות',
      value: formatCurrency(monthlyExpenses),
      icon: TrendingDown,
      color: 'text-red-500',
      bg: 'bg-red-500/10',
      trend: '-5% מחודש שעבר',
      trendUp: false,
    },
    {
      label: 'רווח נקי',
      value: formatCurrency(profit),
      icon: TrendingUp,
      color: profit >= 0 ? 'text-blue-500' : 'text-red-500',
      bg: profit >= 0 ? 'bg-blue-500/10' : 'bg-red-500/10',
      trend: `${profitPercent}% מרווחיות`,
      trendUp: profit >= 0,
    },
    {
      label: 'משימות פתוחות',
      value: pendingTasks.toString(),
      icon: CheckSquare,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
      trend: 'ממתינות לטיפול',
      trendUp: null,
    },
  ]

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      {kpis.map((kpi) => (
        <Card key={kpi.label} className="kpi-card border-border/50 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted-foreground text-xs font-medium mb-1">{kpi.label}</p>
                <p className="text-2xl font-black text-foreground">{kpi.value}</p>
                <div className="flex items-center gap-1 mt-2">
                  {kpi.trendUp !== null && (
                    kpi.trendUp
                      ? <TrendingUp className="w-3 h-3 text-emerald-500" />
                      : <TrendingDown className="w-3 h-3 text-red-500" />
                  )}
                  <p className="text-xs text-muted-foreground">{kpi.trend}</p>
                </div>
              </div>
              <div className={`w-10 h-10 rounded-xl ${kpi.bg} flex items-center justify-center`}>
                <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}


