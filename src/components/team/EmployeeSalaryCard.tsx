'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, DollarSign, TrendingUp, Loader2, History, CreditCard, Edit3, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface Props {
  employeeId: string
  employeeName: string
  baseSalary: number
  bonuses: { id: string; amount: number; reason: string; date: string }[]
  payments: { id: string; amount: number; date: string; notes: string | null }[]
  totalSalary: number
}

import { recordEmployeePayment, addEmployeeBonus, updateEmployeeBonus, deleteEmployeeBonus } from '@/app/(admin)/team/actions'

export function EmployeeSalaryCard({ employeeId, employeeName, baseSalary, bonuses, payments, totalSalary }: Props) {
  const [newBonus, setNewBonus] = useState({ 
    amount: '', 
    reason: '', 
    date: new Date().toISOString().split('T')[0] 
  })
  const [loading, setLoading] = useState(false)
  const [editingBonus, setEditingBonus] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ amount: '', reason: '', date: '' })

  async function addBonus() {
    if (!newBonus.amount || !newBonus.reason) return
    setLoading(true)
    
    const res = await addEmployeeBonus({
      employeeId,
      amount: Number(newBonus.amount),
      reason: newBonus.reason,
      date: newBonus.date
    })

    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success('תוספת נוספה בהצלחה')
      setNewBonus({ 
        amount: '', 
        reason: '', 
        date: new Date().toISOString().split('T')[0] 
      })
      window.location.reload()
    }
    setLoading(false)
  }

  async function updateBonus(id: string) {
    if (!editForm.amount || !editForm.reason) return
    setLoading(true)
    const res = await updateEmployeeBonus(id, {
      amount: Number(editForm.amount),
      reason: editForm.reason,
      date: editForm.date
    })
    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success('תוספת עודכנה')
      setEditingBonus(null)
      window.location.reload()
    }
    setLoading(false)
  }

  async function deleteBonus(id: string) {
    if (!confirm('האם למחוק תוספת זו?')) return
    setLoading(true)
    const res = await deleteEmployeeBonus(id)
    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success('תוספת נמחקה')
      window.location.reload()
    }
    setLoading(false)
  }

  async function handlePay() {
    if (!confirm(`האם אתה בטוח שברצונך לרשום תשלום של ₪${totalSalary.toLocaleString()} לעובד ${employeeName}?`)) return
    
    setLoading(true)
    const res = await recordEmployeePayment({
      employeeId,
      employeeName,
      amount: totalSalary,
      date: new Date().toISOString().split('T')[0]
    })

    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success('התשלום נרשם בהצלחה וסונכרן עם דף הפיננסים')
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
              <div key={b.id} className="flex flex-col bg-muted/30 p-2 rounded-lg border border-border/50 text-sm">
                {editingBonus === b.id ? (
                  <div className="space-y-2 py-2">
                    <Input 
                      size={1} 
                      value={editForm.reason} 
                      onChange={e => setEditForm({ ...editForm, reason: e.target.value })} 
                      placeholder="סיבה"
                    />
                    <div className="flex gap-2">
                      <Input 
                        type="number" 
                        value={editForm.amount} 
                        onChange={e => setEditForm({ ...editForm, amount: e.target.value })} 
                        placeholder="סכום"
                      />
                      <Input 
                        type="date" 
                        value={editForm.date} 
                        onChange={e => setEditForm({ ...editForm, date: e.target.value })} 
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1" onClick={() => updateBonus(b.id)}>שמור</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingBonus(null)}>ביטול</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-900">{b.reason}</span>
                      <span className="text-[10px] text-muted-foreground">{new Date(b.date).toLocaleDateString('he-IL')}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-emerald-600">+₪{Number(b.amount).toLocaleString()}</span>
                      <div className="flex items-center gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-7 w-7 text-muted-foreground hover:text-blue-600"
                          onClick={() => {
                            setEditingBonus(b.id)
                            setEditForm({ amount: String(b.amount), reason: b.reason, date: b.date })
                          }}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-7 w-7 text-muted-foreground hover:text-red-600"
                          onClick={() => deleteBonus(b.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
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
          <Input
            type="date"
            className="w-40"
            dir="ltr"
            value={newBonus.date}
            onChange={(e) => setNewBonus({ ...newBonus, date: e.target.value })}
          />
          <Button size="icon" disabled={loading} onClick={addBonus}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="pt-4 border-t border-border/50">
        <Button 
          className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md font-bold h-11"
          onClick={handlePay}
          disabled={loading}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
          ביצוע תשלום (₪{totalSalary.toLocaleString()})
        </Button>
      </div>

      {payments.length > 0 && (
        <div className="pt-4 border-t border-border/50">
          <div className="flex items-center gap-2 mb-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
            <History className="w-3 h-3" />
            תשלומים אחרונים (מסונכרן עם פיננסים)
          </div>
          <div className="space-y-2">
            {payments.slice(0, 3).map((p) => (
              <div key={p.id} className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
                <span>{new Date(p.date).toLocaleDateString('he-IL')}</span>
                <span className="font-semibold">₪{Number(p.amount).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}



