'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts'
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns'
import { he } from 'date-fns/locale'
import { useMemo } from 'react'

function fmt(n: number) {
  if (Math.abs(n) >= 1_000_000) return '₪' + (n / 1_000_000).toFixed(1) + 'M'
  if (Math.abs(n) >= 1_000) return '₪' + Math.round(n / 1_000) + 'K'
  return '₪' + n
}

interface Props {
  projPayments: any[]
  buyerPayments: any[]
  transactions: any[]
  months?: number
}

export function CashFlowChart({ projPayments, buyerPayments, transactions, months = 8 }: Props) {
  const data = useMemo(() => {
    const today = new Date()
    return Array.from({ length: months }, (_, i) => {
      const monthDate = subMonths(today, months - 1 - i)
      const start = startOfMonth(monthDate)
      const end = endOfMonth(monthDate)
      const inRange = (dateStr: string | null) =>
        dateStr ? isWithinInterval(new Date(dateStr), { start, end }) : false

      const income =
        buyerPayments
          .filter((p: any) => p.is_received && inRange(p.received_at ?? p.due_date))
          .reduce((s: number, p: any) => s + Number(p.amount), 0) +
        transactions
          .filter((t: any) => t.type === 'income' && inRange(t.date))
          .reduce((s: number, t: any) => s + Number(t.amount), 0)

      const expense =
        projPayments
          .filter((p: any) => p.is_paid && inRange(p.paid_at ?? p.due_date))
          .reduce((s: number, p: any) => s + Number(p.amount), 0) +
        transactions
          .filter((t: any) => t.type === 'expense' && inRange(t.date))
          .reduce((s: number, t: any) => s + Number(t.amount), 0)

      return {
        month: format(monthDate, 'MMM yy', { locale: he }),
        הכנסות: income,
        הוצאות: expense,
        מאזן: income - expense,
      }
    })
  }, [projPayments, buyerPayments, transactions, months])

  const hasData = data.some(d => d.הכנסות > 0 || d.הוצאות > 0)

  if (!hasData) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">גרף תזרים — 8 חודשים</p>
        <div className="h-32 flex items-center justify-center">
          <p className="text-sm text-slate-400">אין נתונים לתצוגה</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">גרף תזרים — 8 חודשים אחרונים (ביצוע בפועל)</p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={v => fmt(v)}
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            width={55}
          />
          <Tooltip
            formatter={(value: any, name: any) => [
              '₪' + Number(value).toLocaleString('he-IL', { maximumFractionDigits: 0 }),
              name,
            ]}
            labelStyle={{ fontWeight: 'bold', color: '#1e293b' }}
            contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: 12 }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          <ReferenceLine y={0} stroke="#e2e8f0" />
          <Line type="monotone" dataKey="הכנסות" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4, fill: '#10b981' }} activeDot={{ r: 6 }} />
          <Line type="monotone" dataKey="הוצאות" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 4, fill: '#ef4444' }} activeDot={{ r: 6 }} />
          <Line type="monotone" dataKey="מאזן" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3, fill: '#3b82f6' }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
