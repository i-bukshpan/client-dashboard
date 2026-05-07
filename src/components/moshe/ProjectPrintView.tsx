'use client'

import { useRef } from 'react'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'

function fmt(n: number) {
  return '₪' + Number(n).toLocaleString('he-IL', { maximumFractionDigits: 0 })
}

// ─── Shared print styles ───────────────────────────────────────────

const PRINT_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1e293b; padding: 24px; background: white; }
  h1 { font-size: 22px; font-weight: 900; margin-bottom: 4px; }
  h2 { font-size: 14px; font-weight: 700; color: #475569; margin: 20px 0 8px; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; }
  h3 { font-size: 12px; font-weight: 700; color: #64748b; margin: 12px 0 6px; }
  .subtitle { font-size: 12px; color: #64748b; font-weight: 500; margin-bottom: 16px; }
  .meta { font-size: 11px; color: #94a3b8; margin-bottom: 16px; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 20px; }
  .kpis-3 { grid-template-columns: repeat(3, 1fr); }
  .kpi { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center; }
  .kpi-label { font-size: 9px; color: #94a3b8; text-transform: uppercase; font-weight: 700; }
  .kpi-val { font-size: 16px; font-weight: 900; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px; }
  th { background: #f8fafc; text-align: right; padding: 6px 10px; font-size: 10px; color: #94a3b8; text-transform: uppercase; border-bottom: 2px solid #e2e8f0; }
  td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; }
  .total-row { background: #f8fafc; font-weight: 700; }
  .green { color: #059669; } .red { color: #dc2626; } .blue { color: #2563eb; } .purple { color: #7c3aed; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 700; }
  .badge-green { background: #dcfce7; color: #166534; }
  .badge-red { background: #fee2e2; color: #991b1b; }
  .badge-gray { background: #f1f5f9; color: #475569; }
  .badge-purple { background: #f3e8ff; color: #6b21a8; }
  .section-divider { border: none; border-top: 1px solid #e2e8f0; margin: 20px 0; }
  .footer { margin-top: 24px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 12px; }
  @media print { body { padding: 16px; } @page { margin: 10mm; } }
`

function openPrintWindow(title: string, content: string) {
  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) return
  win.document.write(`
    <!DOCTYPE html>
    <html dir="rtl" lang="he">
    <head>
      <meta charset="UTF-8" />
      <title>${title}</title>
      <style>${PRINT_STYLES}</style>
    </head>
    <body>${content}</body>
    </html>
  `)
  win.document.close()
  setTimeout(() => { win.print(); win.close() }, 400)
}

// ─── Types ─────────────────────────────────────────────────────────

interface BuyerPayment { id: string; amount: number; due_date?: string; notes?: string; is_received: boolean }
interface Buyer {
  id: string; name: string; phone?: string; email?: string; unit_description?: string
  total_amount?: number; contract_date?: string; id_number?: string; notes?: string
  payments: BuyerPayment[]
}
interface Payment { id: string; amount: number; due_date?: string; notes?: string; is_paid: boolean }
interface Transaction { id: string; type: 'income' | 'expense'; amount: number; date: string; category?: string; notes?: string }
interface Partner { id: string; name: string; phone?: string; transactions: PartnerTx[] }
interface PartnerTx { id: string; type: 'investment' | 'withdrawal'; amount: number; date: string; notes?: string }
interface Loan { id: string; lender: string; total_amount: number; interest_rate?: number; num_payments: number; payments: LoanPayment[] }
interface LoanPayment { id: string; amount: number; due_date?: string; is_paid: boolean; notes?: string }

interface Props {
  project: any
  payments: Payment[]
  buyers: Buyer[]
  transactions: Transaction[]
  partners: Partner[]
  loans: Loan[]
  realBalance: number
  totalReceived: number
  totalPaid: number
  totalExpected: number
  totalScheduled: number
}

// ─── Full Project Report ───────────────────────────────────────────

export function ProjectPrintButton({
  project, payments, buyers, transactions, partners, loans,
  realBalance, totalReceived, totalPaid, totalExpected, totalScheduled,
}: Props) {
  const today = new Date()
  const STATUS: Record<string, string> = { active: 'פעיל', pending: 'ממתין', closed: 'סגור' }

  function handlePrint() {
    const fmtDate = (d: string | undefined | null) => d ? format(new Date(d), 'dd/MM/yyyy') : 'לא נקבע'

    // KPIs
    let html = `
      <h1>${project.name}</h1>
      <div class="meta">
        ${project.address ? `${project.address} · ` : ''}
        ${project.contact_name ? `${project.contact_name} · ` : ''}
        ${project.contact_phone ? `${project.contact_phone} · ` : ''}
        סטטוס: ${STATUS[project.status] ?? project.status} ·
        הופק: ${format(today, 'dd/MM/yyyy HH:mm', { locale: he })}
      </div>

      <div class="kpis">
        <div class="kpi">
          <div class="kpi-label">מאזן אמיתי</div>
          <div class="kpi-val ${realBalance >= 0 ? 'green' : 'red'}">${fmt(realBalance)}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">הכנסות בפועל</div>
          <div class="kpi-val green">${fmt(totalReceived)}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">הוצאות בפועל</div>
          <div class="kpi-val red">${fmt(totalPaid)}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">תקציב</div>
          <div class="kpi-val">${project.total_project_cost ? fmt(Number(project.total_project_cost)) : '—'}</div>
        </div>
      </div>
    `

    // ── Expense schedule ──
    html += `<h2>לוח תשלומים — הוצאות הפרויקט (${payments.length})</h2>`
    if (payments.length > 0) {
      const paidTotal = payments.filter(p => p.is_paid).reduce((s, p) => s + Number(p.amount), 0)
      const totalAll = payments.reduce((s, p) => s + Number(p.amount), 0)
      html += `
        <table>
          <thead><tr><th>הערות</th><th>תאריך</th><th>סכום</th><th>סטטוס</th></tr></thead>
          <tbody>
            ${payments.map(p => `
              <tr>
                <td>${p.notes ?? '—'}</td>
                <td>${fmtDate(p.due_date)}</td>
                <td class="red">${fmt(Number(p.amount))}</td>
                <td><span class="badge ${p.is_paid ? 'badge-green' : 'badge-gray'}">${p.is_paid ? 'שולם' : 'ממתין'}</span></td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td>סה"כ</td>
              <td></td>
              <td class="red">${fmt(totalAll)}</td>
              <td><span class="green">${fmt(paidTotal)} שולם</span></td>
            </tr>
          </tbody>
        </table>
      `
    } else {
      html += `<p style="color:#94a3b8;font-size:12px;margin-bottom:16px">אין תשלומים</p>`
    }

    // ── Buyers ──
    html += `<h2>קונים (${buyers.length})</h2>`
    buyers.forEach(b => {
      const recv = b.payments.filter(p => p.is_received).reduce((s, p) => s + Number(p.amount), 0)
      const total = b.payments.reduce((s, p) => s + Number(p.amount), 0) || Number(b.total_amount) || 0
      html += `
        <h3>
          ${b.name}
          ${b.unit_description ? ` — ${b.unit_description}` : ''}
          ${b.phone ? ` · ${b.phone}` : ''}
          ${b.contract_date ? ` · חוזה: ${fmtDate(b.contract_date)}` : ''}
          · <span class="green">שולם: ${fmt(recv)}</span>
          ${total > 0 ? ` מתוך ${fmt(total)}` : ''}
        </h3>
      `
      if (b.payments.length > 0) {
        html += `
          <table>
            <thead><tr><th>תאריך</th><th>סכום</th><th>הערות</th><th>סטטוס</th></tr></thead>
            <tbody>
              ${b.payments.map(p => `
                <tr>
                  <td>${fmtDate(p.due_date)}</td>
                  <td class="green">${fmt(Number(p.amount))}</td>
                  <td>${p.notes ?? '—'}</td>
                  <td><span class="badge ${p.is_received ? 'badge-green' : 'badge-gray'}">${p.is_received ? 'התקבל' : 'ממתין'}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `
      }
    })

    // ── Transactions ──
    if (transactions.length > 0) {
      const incomeTotal = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
      const expenseTotal = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
      html += `<h2>תנועות (${transactions.length}) — הכנסות: ${fmt(incomeTotal)} | הוצאות: ${fmt(expenseTotal)}</h2>`
      html += `
        <table>
          <thead><tr><th>תאריך</th><th>סוג</th><th>קטגוריה</th><th>הערות</th><th>סכום</th></tr></thead>
          <tbody>
            ${transactions.map(t => `
              <tr>
                <td>${fmtDate(t.date)}</td>
                <td>${t.type === 'income' ? 'הכנסה' : 'הוצאה'}</td>
                <td>${t.category ?? '—'}</td>
                <td>${t.notes ?? '—'}</td>
                <td class="${t.type === 'income' ? 'green' : 'red'}">${t.type === 'income' ? '+' : '-'}${fmt(Number(t.amount))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `
    }

    // ── Partners ──
    if (partners.length > 0) {
      const totalInvested = partners.reduce((s, p) => s + p.transactions.filter(t => t.type === 'investment').reduce((ss, t) => ss + Number(t.amount), 0), 0)
      const totalWithdrawn = partners.reduce((s, p) => s + p.transactions.filter(t => t.type === 'withdrawal').reduce((ss, t) => ss + Number(t.amount), 0), 0)
      html += `<h2>שותפים (${partners.length}) — השקעות: ${fmt(totalInvested)} | משיכות: ${fmt(totalWithdrawn)} | מאזן: ${fmt(totalInvested - totalWithdrawn)}</h2>`

      partners.forEach(p => {
        const inv = p.transactions.filter(t => t.type === 'investment').reduce((s, t) => s + Number(t.amount), 0)
        const wd = p.transactions.filter(t => t.type === 'withdrawal').reduce((s, t) => s + Number(t.amount), 0)
        html += `
          <h3>
            ${p.name}${p.phone ? ` · ${p.phone}` : ''}
            · <span class="blue">השקעות: ${fmt(inv)}</span>
            · <span class="red">משיכות: ${fmt(wd)}</span>
            · <span class="${(inv - wd) >= 0 ? 'green' : 'red'}">מאזן: ${fmt(inv - wd)}</span>
          </h3>
        `
        if (p.transactions.length > 0) {
          html += `
            <table>
              <thead><tr><th>תאריך</th><th>סוג</th><th>הערות</th><th>סכום</th></tr></thead>
              <tbody>
                ${p.transactions.map(t => `
                  <tr>
                    <td>${fmtDate(t.date)}</td>
                    <td>${t.type === 'investment' ? 'השקעה' : 'משיכה'}</td>
                    <td>${t.notes ?? '—'}</td>
                    <td class="${t.type === 'investment' ? 'blue' : 'red'}">${t.type === 'investment' ? '+' : '-'}${fmt(Number(t.amount))}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `
        }
      })
    }

    // ── Loans ──
    if (loans.length > 0) {
      const totalLoans = loans.reduce((s, l) => s + Number(l.total_amount), 0)
      const totalPaidLoans = loans.reduce((s, l) => s + l.payments.filter(p => p.is_paid).reduce((ss, p) => ss + Number(p.amount), 0), 0)
      html += `<h2>הלוואות (${loans.length}) — סה"כ: ${fmt(totalLoans)} | שולם: ${fmt(totalPaidLoans)} | נותר: ${fmt(totalLoans - totalPaidLoans)}</h2>`

      loans.forEach(l => {
        const paid = l.payments.filter(p => p.is_paid).reduce((s, p) => s + Number(p.amount), 0)
        const remaining = l.payments.filter(p => !p.is_paid).reduce((s, p) => s + Number(p.amount), 0)
        const paidCount = l.payments.filter(p => p.is_paid).length
        html += `
          <h3>
            ${l.lender} — ${fmt(Number(l.total_amount))}
            ${l.interest_rate ? ` · ${l.interest_rate}% ריבית` : ''}
            · <span class="green">${fmt(paid)} שולם</span>
            · <span class="red">${fmt(remaining)} נותר</span>
            · ${paidCount}/${l.num_payments} תשלומים
          </h3>
        `
        if (l.payments.length > 0) {
          html += `
            <table>
              <thead><tr><th>תאריך</th><th>סכום</th><th>הערות</th><th>סטטוס</th></tr></thead>
              <tbody>
                ${l.payments.map(p => `
                  <tr>
                    <td>${fmtDate(p.due_date)}</td>
                    <td class="purple">${fmt(Number(p.amount))}</td>
                    <td>${p.notes ?? '—'}</td>
                    <td><span class="badge ${p.is_paid ? 'badge-green' : 'badge-gray'}">${p.is_paid ? 'שולם' : 'ממתין'}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `
        }
      })
    }

    // Footer
    html += `<div class="footer">דוח פרויקט מלא הופק מתוך פורטל ניהול — משה פרוש · ${format(today, 'dd/MM/yyyy HH:mm', { locale: he })}</div>`

    openPrintWindow(`דוח פרויקט — ${project.name}`, html)
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handlePrint}
      className="gap-1.5 text-xs border-slate-200 hover:border-amber-300 hover:text-amber-600"
    >
      <Printer className="w-3.5 h-3.5" />
      הפק דוח
    </Button>
  )
}

// ─── Buyer-specific Report ─────────────────────────────────────────

interface BuyerReportProps {
  project: any
  buyer: Buyer
}

export function BuyerPrintButton({ project, buyer }: BuyerReportProps) {
  const today = new Date()

  function handlePrint() {
    const fmtDate = (d: string | undefined | null) => d ? format(new Date(d), 'dd/MM/yyyy') : 'לא נקבע'
    const recv = buyer.payments.filter(p => p.is_received).reduce((s, p) => s + Number(p.amount), 0)
    const total = buyer.payments.reduce((s, p) => s + Number(p.amount), 0) || Number(buyer.total_amount) || 0
    const remaining = total - recv
    const pct = total > 0 ? Math.round((recv / total) * 100) : 0

    const sorted = [...buyer.payments].sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0
      if (!a.due_date) return 1
      if (!b.due_date) return -1
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    })

    let html = `
      <h1>דוח קונה — ${buyer.name}</h1>
      <div class="subtitle">פרויקט: ${project.name}${project.address ? ` · ${project.address}` : ''}</div>
      <div class="meta">
        ${buyer.unit_description ? `דירה: ${buyer.unit_description} · ` : ''}
        ${buyer.phone ? `טלפון: ${buyer.phone} · ` : ''}
        ${buyer.email ? `אימייל: ${buyer.email} · ` : ''}
        ${buyer.id_number ? `ת.ז: ${buyer.id_number} · ` : ''}
        ${buyer.contract_date ? `חוזה: ${fmtDate(buyer.contract_date)} · ` : ''}
        הופק: ${format(today, 'dd/MM/yyyy HH:mm', { locale: he })}
      </div>

      <div class="kpis kpis-3">
        <div class="kpi">
          <div class="kpi-label">סה"כ לתשלום</div>
          <div class="kpi-val">${fmt(total)}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">שולם</div>
          <div class="kpi-val green">${fmt(recv)} (${pct}%)</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">יתרה לתשלום</div>
          <div class="kpi-val ${remaining > 0 ? 'red' : 'green'}">${fmt(remaining)}</div>
        </div>
      </div>

      ${buyer.notes ? `<p style="font-size:12px;color:#64748b;margin-bottom:16px">הערות: ${buyer.notes}</p>` : ''}

      <h2>לוח תשלומים (${sorted.length})</h2>
    `

    if (sorted.length > 0) {
      const receivedPayments = sorted.filter(p => p.is_received)
      const pendingPayments = sorted.filter(p => !p.is_received)
      const overduePayments = pendingPayments.filter(p => p.due_date && new Date(p.due_date) < today)

      html += `
        <table>
          <thead><tr><th>#</th><th>תאריך</th><th>סכום</th><th>הערות</th><th>סטטוס</th></tr></thead>
          <tbody>
            ${sorted.map((p, i) => {
              const overdue = !p.is_received && p.due_date && new Date(p.due_date) < today
              return `
                <tr${overdue ? ' style="background:#fef2f2"' : ''}>
                  <td>${i + 1}</td>
                  <td>${fmtDate(p.due_date)}</td>
                  <td class="${p.is_received ? 'green' : ''}">${fmt(Number(p.amount))}</td>
                  <td>${p.notes ?? '—'}</td>
                  <td>
                    <span class="badge ${p.is_received ? 'badge-green' : overdue ? 'badge-red' : 'badge-gray'}">
                      ${p.is_received ? 'התקבל' : overdue ? 'באיחור' : 'ממתין'}
                    </span>
                  </td>
                </tr>
              `
            }).join('')}
            <tr class="total-row">
              <td colspan="2">סה"כ</td>
              <td>${fmt(total)}</td>
              <td></td>
              <td><span class="green">${receivedPayments.length} התקבלו</span> · <span class="${pendingPayments.length > 0 ? 'red' : ''}">${pendingPayments.length} ממתינים</span></td>
            </tr>
          </tbody>
        </table>
      `

      if (overduePayments.length > 0) {
        html += `
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px;margin-bottom:16px;font-size:12px">
            <strong style="color:#dc2626">⚠ ${overduePayments.length} תשלומים באיחור</strong> — 
            סה"כ: <strong class="red">${fmt(overduePayments.reduce((s, p) => s + Number(p.amount), 0))}</strong>
          </div>
        `
      }
    } else {
      html += `<p style="color:#94a3b8;font-size:12px">אין תשלומים</p>`
    }

    html += `<div class="footer">דוח קונה הופק מתוך פורטל ניהול — משה פרוש · ${format(today, 'dd/MM/yyyy HH:mm', { locale: he })}</div>`

    openPrintWindow(`דוח קונה — ${buyer.name} — ${project.name}`, html)
  }

  return (
    <button
      type="button"
      onClick={handlePrint}
      title="הפק דוח קונה"
      className="w-8 h-8 rounded-lg border border-slate-100 flex items-center justify-center text-slate-300 hover:text-blue-500 hover:bg-blue-50 hover:border-blue-200 transition-colors"
    >
      <Printer className="w-3.5 h-3.5" />
    </button>
  )
}
