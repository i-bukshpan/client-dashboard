'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Plus, Trash2 } from 'lucide-react'

export interface PaymentRow {
  amount: string
  due_date: string
  notes: string
}

interface Props {
  rows: PaymentRow[]
  onChange: (rows: PaymentRow[]) => void
  label?: string
  colorClass?: string
}

export function PaymentScheduleForm({ rows, onChange, label = 'לוח תשלומים', colorClass = 'border-red-200 bg-red-50/30' }: Props) {
  function addRow() {
    onChange([...rows, { amount: '', due_date: '', notes: '' }])
  }

  function removeRow(i: number) {
    onChange(rows.filter((_, idx) => idx !== i))
  }

  function update(i: number, field: keyof PaymentRow, value: string) {
    const next = [...rows]
    next[i] = { ...next[i], [field]: value }
    onChange(next)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-slate-700 font-bold">{label}</Label>
        <Button type="button" variant="ghost" size="sm" onClick={addRow}
          className="text-xs gap-1.5 h-8 text-slate-500 hover:text-slate-800">
          <Plus className="w-3.5 h-3.5" /> הוסף שורה
        </Button>
      </div>

      {rows.length === 0 && (
        <button type="button" onClick={addRow}
          className={`w-full border-2 border-dashed rounded-xl p-4 text-xs text-slate-400 hover:text-slate-600 hover:border-slate-300 transition-colors ${colorClass}`}>
          + הוסף תשלום ראשון
        </button>
      )}

      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className={`p-3 rounded-xl border ${colorClass} space-y-2`}>
            {/* Amount + Date + Delete */}
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
              <div className="space-y-1">
                {i === 0 && <Label className="text-[10px] text-slate-400">סכום (₪)</Label>}
                <Input
                  type="number"
                  placeholder="0"
                  dir="ltr"
                  value={row.amount}
                  onChange={e => update(i, 'amount', e.target.value)}
                  className="h-9 text-sm border-slate-200 bg-white w-full"
                />
              </div>
              <div className="space-y-1">
                {i === 0 && <Label className="text-[10px] text-slate-400">תאריך (אופציונלי)</Label>}
                <Input
                  type="date"
                  value={row.due_date}
                  onChange={e => update(i, 'due_date', e.target.value)}
                  className="h-9 text-sm border-slate-200 bg-white w-full"
                />
              </div>
              <Button type="button" variant="ghost" size="icon"
                onClick={() => removeRow(i)}
                className={`h-9 w-9 shrink-0 text-slate-300 hover:text-red-400 hover:bg-red-50 ${i === 0 ? 'mt-5' : ''}`}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
            {/* Notes full width */}
            <Input
              placeholder="תיאור התשלום..."
              value={row.notes}
              onChange={e => update(i, 'notes', e.target.value)}
              className="h-9 text-sm border-slate-200 bg-white w-full"
            />
          </div>
        ))}
      </div>

      {rows.length > 0 && (
        <div className="flex justify-between items-center text-xs text-slate-500 pt-1">
          <span>{rows.length} שורות</span>
          <span className="font-bold text-slate-700">
            סה"כ: ₪{rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}
          </span>
        </div>
      )}
    </div>
  )
}
