'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts'
import type { Income, Expense } from '@/types/database'
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns'
import { he } from 'date-fns/locale'

interface Props {
  income: Income[]
  expenses: Expense[]
}

export function FinanceCharts({ income, expenses }: Props) {
  // Generate last 6 months data
  const data = Array.from({ length: 6 }).map((_, i) => {
    const monthDate = subMonths(new Date(), 5 - i)
    const start = startOfMonth(monthDate)
    const end = endOfMonth(monthDate)

    const monthlyIncome = income
      .filter((r) => {
        const d = new Date(r.date)
        return isWithinInterval(d, { start, end })
      })
      .reduce((s, r) => s + Number(r.amount), 0)

    const monthlyExpenses = expenses
      .filter((r) => {
        const d = new Date(r.date)
        return isWithinInterval(d, { start, end })
      })
      .reduce((s, r) => s + Number(r.amount), 0)

    return {
      name: format(monthDate, 'MMM', { locale: he }),
      הכנסות: monthlyIncome,
      הוצאות: monthlyExpenses,
      רווח: monthlyIncome - monthlyExpenses,
    }
  })

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">הכנסות מול הוצאות</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => `₪${v / 1000}k`}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  formatter={(v) => `₪${Number(v).toLocaleString()}`}
                />
                <Legend />
                <Bar dataKey="הכנסות" fill="oklch(0.65 0.18 150)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="הוצאות" fill="oklch(0.58 0.22 25)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">מגמת רווחיות</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => `₪${v / 1000}k`}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  formatter={(v) => `₪${Number(v).toLocaleString()}`}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="רווח"
                  stroke="oklch(0.55 0.22 265)"
                  strokeWidth={3}
                  dot={{ r: 4, fill: 'oklch(0.55 0.22 265)' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}



