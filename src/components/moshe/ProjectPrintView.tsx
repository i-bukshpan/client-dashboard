'use client'

import { useRef } from 'react'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'

function fmt(n: number) {
  return '₪' + Number(n).toLocaleString('he-IL', { maximumFractionDigits: 0 })
}

interface Buyer {
  id: string; name: string; phone?: string; unit_description?: string
  total_amount?: number; contract_date?: string
  payments: { id: string; amount: number; due_date?: string; is_received: boolean }[]
}

interface Payment {
  id: string; amount: number; due_date?: string; notes?: string; is_paid: boolean
}

interface Props {
  project: any
  payments: Payment[]
  buyers: Buyer[]
  realBalance: number
  totalReceived: number
  totalPaid: number
  totalExpected: number
  totalScheduled: number
}

export function ProjectPrintButton({ project, payments, buyers, realBalance, totalReceived, totalPaid, totalExpected, totalScheduled }: Props) {
  const printRef = useRef<HTMLDivElement>(null)

  function handlePrint() {
    const content = printRef.current?.innerHTML
    if (!content) return
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) return
    win.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="UTF-8" />
        <title>דוח פרויקט — ${project.name}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1e293b; padding: 24px; background: white; }
          h1 { font-size: 22px; font-weight: 900; margin-bottom: 4px; }
          h2 { font-size: 14px; font-weight: 700; color: #475569; margin: 20px 0 8px; border-bottom: 2px solid #f1f5f9; padding-bottom: 4px; }
          h3 { font-size: 12px; font-weight: 700; color: #64748b; margin: 12px 0 6px; }
          .meta { font-size: 11px; color: #94a3b8; margin-bottom: 16px; }
          .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 20px; }
          .kpi { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center; }
          .kpi-label { font-size: 9px; color: #94a3b8; text-transform: uppercase; font-weight: 700; }
          .kpi-val { font-size: 16px; font-weight: 900; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px; }
          th { background: #f8fafc; text-align: right; padding: 6px 10px; font-size: 10px; color: #94a3b8; text-transform: uppercase; border-bottom: 2px solid #e2e8f0; }
          td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; }
          .green { color: #059669; } .red { color: #dc2626; } .blue { color: #2563eb; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 700; }
          .badge-green { background: #dcfce7; color: #166534; }
          .badge-red { background: #fee2e2; color: #991b1b; }
          .badge-gray { background: #f1f5f9; color: #475569; }
          .footer { margin-top: 24px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 12px; }
          @media print { body { padding: 16px; } }
        </style>
      </head>
      <body>${content}</body>
      </html>
    `)
    win.document.close()
    setTimeout(() => { win.print(); win.close() }, 400)
  }

  const today = new Date()
  const STATUS: Record<string, string> = { active: 'פעיל', pending: 'ממתין', closed: 'סגור' }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={handlePrint}
        className="gap-1.5 text-xs border-slate-200 hover:border-amber-300 hover:text-amber-600"
      >
        <Printer className="w-3.5 h-3.5" />
        הפק דוח
      </Button>

      {/* Hidden print content */}
      <div ref={printRef} style={{ display: 'none' }}>
        <h1>{project.name}</h1>
        <div className="meta">
          {project.address && <span>{project.address} · </span>}
          {project.contact_name && <span>{project.contact_name} · </span>}
          {project.contact_phone && <span>{project.contact_phone} · </span>}
          <span>סטטוס: {STATUS[project.status] ?? project.status} · </span>
          <span>הופק: {format(today, 'dd/MM/yyyy', { locale: he })}</span>
        </div>

        <div className="kpis">
          <div className="kpi">
            <div className="kpi-label">מאזן אמיתי</div>
            <div className={`kpi-val ${realBalance >= 0 ? 'green' : 'red'}`}>{fmt(realBalance)}</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">הכנסות בפועל</div>
            <div className="kpi-val green">{fmt(totalReceived)}</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">הוצאות בפועל</div>
            <div className="kpi-val red">{fmt(totalPaid)}</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">תקציב</div>
            <div className="kpi-val">{project.total_project_cost ? fmt(Number(project.total_project_cost)) : '—'}</div>
          </div>
        </div>

        {/* Expense schedule */}
        <h2>לוח תשלומים — הוצאות הפרויקט</h2>
        <table>
          <thead><tr>
            <th>הערות</th><th>תאריך</th><th>סכום</th><th>סטטוס</th>
          </tr></thead>
          <tbody>
            {payments.map(p => (
              <tr key={p.id}>
                <td>{p.notes ?? '—'}</td>
                <td>{p.due_date ? format(new Date(p.due_date), 'dd/MM/yyyy') : 'לא נקבע'}</td>
                <td className="red">{fmt(Number(p.amount))}</td>
                <td><span className={`badge ${p.is_paid ? 'badge-green' : 'badge-gray'}`}>{p.is_paid ? 'שולם' : 'ממתין'}</span></td>
              </tr>
            ))}
            <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
              <td colSpan={2}>סה"כ</td>
              <td className="red">{fmt(payments.reduce((s, p) => s + Number(p.amount), 0))}</td>
              <td></td>
            </tr>
          </tbody>
        </table>

        {/* Buyers */}
        <h2>קונים ({buyers.length})</h2>
        {buyers.map(b => {
          const totalPaid = b.payments.filter(p => p.is_received).reduce((s, p) => s + Number(p.amount), 0)
          const total = b.payments.reduce((s, p) => s + Number(p.amount), 0) || Number(b.total_amount) || 0
          return (
            <div key={b.id}>
              <h3>
                {b.name}
                {b.unit_description && ` — ${b.unit_description}`}
                {b.phone && ` · ${b.phone}`}
                {b.contract_date && ` · חוזה: ${format(new Date(b.contract_date), 'dd/MM/yyyy')}`}
                {' · '}
                <span className="green">שולם: {fmt(totalPaid)}</span>
                {total > 0 && <span> מתוך {fmt(total)}</span>}
              </h3>
              {b.payments.length > 0 && (
                <table>
                  <thead><tr><th>תאריך</th><th>סכום</th><th>הערות</th><th>סטטוס</th></tr></thead>
                  <tbody>
                    {b.payments.map(p => (
                      <tr key={p.id}>
                        <td>{p.due_date ? format(new Date(p.due_date), 'dd/MM/yyyy') : 'לא נקבע'}</td>
                        <td className="green">{fmt(Number(p.amount))}</td>
                        <td>{(p as any).notes ?? '—'}</td>
                        <td><span className={`badge ${p.is_received ? 'badge-green' : 'badge-gray'}`}>{p.is_received ? 'התקבל' : 'ממתין'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )
        })}

        <div className="footer">
          דוח הופק מתוך פורטל ניהול — משה פרוש · {format(today, 'dd/MM/yyyy HH:mm', { locale: he })}
        </div>
      </div>
    </>
  )
}
