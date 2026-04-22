'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, DollarSign, TrendingUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface Props {
  employeeId: string
  baseSalary: number
  bonuses: { id: string; amount: number; reason: string; date: string }[]
  totalSalary: number
}

export function EmployeeSalaryCard({ employeeId, baseSalary, bonuses, totalSalary }: Props) {
  const [newBonus, setNewBonus] = useState({ amount: '', reason: '' })
  const [loading, setLoading] = useState(false)

  async function addBonus() {
    if (!newBonus.amount || !newBonus.reason) return
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await (supabase.from('employee_bonuses') as any).insert({
      employee_id: employeeId,
      amount: Number(newBonus.amount),
      reason: newBonus.reason,
      date: new Date().toISOString().split('T')[0],
      created_by: user!.id,
    })

    if (error) {
      toast.error('שגיאה בהוספת תוספת')
    } else {
      toast.success('תוספת נוספה בהצלחה')
      setNewBonus({ amount: '', reason: '' })
      window.location.reload()
    }
    setLoading(false)
  }

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">משכורת בסיס</p>
          <p className="text-lg font-bold">₪{baseSalary.toLocaleString()}</p>
        </div>
        <div className="text-left">
          <p className="text-xs text-muted-foreground">סה״כ לתשלום (חודש זה)</p>
          <p className="text-2xl font-black text-blue-600">₪{totalSalary.toLocaleString()}</p>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">תוספות ובונוסים</p>
        <div className="space-y-2">
          {bonuses.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">אין תוספות לחודש זה</p>
          ) : (
            bonuses.map((b) => (
              <div key={b.id} className="flex items-center justify-between bg-muted/30 p-2 rounded-lg border border-border/50 text-sm">
                <span>{b.reason}</span>
                <span className="font-bold text-emerald-600">+₪{Number(b.amount).toLocaleString()}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="pt-4 border-t border-border/50">
        <p className="text-xs font-bold text-muted-foreground mb-3">הוספת תוספת/בונוס</p>
        <div className="flex gap-2">
          <Input
            placeholder="סיבה"
            className="flex-1"
            value={newBonus.reason}
            onChange={(e) => setNewBonus({ ...newBonus, reason: e.target.value })}
          />
          <Input
            type="number"
            placeholder="סכום"
            className="w-24"
            dir="ltr"
            value={newBonus.amount}
            onChange={(e) => setNewBonus({ ...newBonus, amount: e.target.value })}
          />
          <Button size="icon" disabled={loading} onClick={addBonus}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}


