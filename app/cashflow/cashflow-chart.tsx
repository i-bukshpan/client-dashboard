'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface ChartEntry {
  month: string
  income: number
  expense: number
}

export default function CashflowChart({ data }: { data: ChartEntry[] }) {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data} barGap={8}>
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
  )
}
