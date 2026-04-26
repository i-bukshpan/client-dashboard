'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BadgeDollarSign, TrendingUp, History, Wallet } from 'lucide-react'

interface Props {
  salaryBase: number
  bonuses: { id: string; amount: number; reason: string; date: string }[]
  payments: { id: string; amount: number; date: string; notes: string | null }[]
}

export function EmployeeSalaryView({ salaryBase, bonuses, payments }: Props) {
  const currentMonthBonuses = bonuses.reduce((s, b) => s + Number(b.amount), 0)
  const totalThisMonth = salaryBase + currentMonthBonuses

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-border/50 bg-blue-50/30">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center">
              <BadgeDollarSign className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">שכר בסיס קבוע</p>
              <p className="text-2xl font-black text-slate-900">₪{salaryBase.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-emerald-50/30">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">סה״כ לחודש הנוכחי</p>
              <p className="text-2xl font-black text-emerald-700">₪{totalThisMonth.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bonuses List */}
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between py-4">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              בונוסים ותוספות (חודש נוכחי)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {bonuses.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground italic">
                אין תוספות רשומות לחודש זה
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {bonuses.map((b) => (
                  <div key={b.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div>
                      <p className="font-bold text-sm text-slate-900">{b.reason}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(b.date).toLocaleDateString('he-IL')}</p>
                    </div>
                    <span className="font-black text-emerald-600">+₪{Number(b.amount).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payments List */}
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between py-4">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <History className="w-4 h-4 text-blue-600" />
              תשלומים שבוצעו
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {payments.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground italic">
                טרם נרשמו תשלומים
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {payments.map((p) => (
                  <div key={p.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                        <Wallet className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-bold text-sm text-slate-900">תשלום משכורת</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(p.date).toLocaleDateString('he-IL')}</p>
                      </div>
                    </div>
                    <span className="font-black text-slate-900">₪{Number(p.amount).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
