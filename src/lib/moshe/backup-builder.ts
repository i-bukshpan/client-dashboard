import 'server-only'

import { createClient } from '@supabase/supabase-js'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const MOSHE_BACKUP_TABLES = [
  'moshe_projects',
  'moshe_project_payments',
  'moshe_buyers',
  'moshe_buyer_payments',
  'moshe_transactions',
  'moshe_transaction_categories',
  'moshe_partners',
  'moshe_partner_transactions',
  'moshe_loans',
  'moshe_loan_payments',
  'moshe_loan_receipts',
  'moshe_neighbors',
  'moshe_neighbor_payments',
  'moshe_project_documents',
  'moshe_project_logs',
  'moshe_audit_log',
  'moshe_workers',
  'moshe_worker_project_permissions',
  'moshe_worker_logs',
  'moshe_worker_tasks',
  'moshe_calendar_events',
  'worker_messages',
  'worker_message_replies',
] as const

function fmtILS(n: number): string {
  return '₪' + Number(n || 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })
}

function fmtDate(d?: string | null): string {
  if (!d) return '—'
  try {
    const dt = new Date(d)
    if (isNaN(dt.getTime())) return String(d)
    return dt.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return String(d)
  }
}

function escHtml(val: unknown): string {
  if (val === null || val === undefined) return ''
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const STATUS_HEBREW: Record<string, string> = {
  active: 'פעיל',
  pending: 'ממתין',
  closed: 'סגור',
}

export async function buildMosheOrganizedBackup(createdByEmail?: string) {
  const results = await Promise.all(
    MOSHE_BACKUP_TABLES.map(async (table) => {
      try {
        const { data } = await db.from(table).select('*')
        return { table, rows: data ?? [] }
      } catch {
        return { table, rows: [] }
      }
    })
  )

  const tablesMap: Record<string, any[]> = Object.fromEntries(results.map((r) => [r.table, r.rows]))

  const projects = tablesMap.moshe_projects || []
  const projectPayments = tablesMap.moshe_project_payments || []
  const buyers = tablesMap.moshe_buyers || []
  const buyerPayments = tablesMap.moshe_buyer_payments || []
  const transactions = tablesMap.moshe_transactions || []
  const partners = tablesMap.moshe_partners || []
  const partnerTransactions = tablesMap.moshe_partner_transactions || []
  const loans = tablesMap.moshe_loans || []
  const loanPayments = tablesMap.moshe_loan_payments || []
  const loanReceipts = tablesMap.moshe_loan_receipts || []
  const neighbors = tablesMap.moshe_neighbors || []
  const neighborPayments = tablesMap.moshe_neighbor_payments || []
  const documents = tablesMap.moshe_project_documents || []
  const workers = tablesMap.moshe_workers || []
  const workerTasks = tablesMap.moshe_worker_tasks || []
  const calendarEvents = tablesMap.moshe_calendar_events || []
  const auditLogs = tablesMap.moshe_audit_log || []

  // Organize hierarchically by project
  const organizedProjects = projects.map((proj: any) => {
    const pId = proj.id
    const pp = projectPayments.filter((x: any) => x.project_id === pId)
    const bp = buyerPayments.filter((x: any) => x.project_id === pId)
    const pBuyers = buyers.filter((x: any) => x.project_id === pId)
    const pTx = transactions.filter((x: any) => x.project_id === pId)
    const pPartners = partners.filter((x: any) => x.project_id === pId)
    const pPartnerTx = partnerTransactions.filter((x: any) => x.project_id === pId)
    const pLoans = loans.filter((x: any) => x.project_id === pId)
    const pLoanPayments = loanPayments.filter((x: any) => x.project_id === pId)
    const pLoanReceipts = loanReceipts.filter((x: any) => x.project_id === pId)
    const pNeighbors = neighbors.filter((x: any) => x.project_id === pId)
    const pNeighborPayments = neighborPayments.filter((x: any) => x.project_id === pId)
    const pDocs = documents.filter((x: any) => x.project_id === pId)

    // Project payment schedule vs movements
    const scheduledSupplierPayments = pp
      .filter((x: any) => x.payment_type === 'schedule' || (!x.payment_type && !x.is_paid))
      .map((x: any) => ({
        id: x.id,
        amount: Number(x.amount),
        due_date: x.due_date,
        notes: x.notes || '',
      }))
    const executedSupplierMovements = pp
      .filter((x: any) => x.payment_type === 'movement' || (!x.payment_type && x.is_paid))
      .map((x: any) => ({
        id: x.id,
        amount: Number(x.amount),
        paid_at: x.paid_at,
        due_date: x.due_date,
        notes: x.notes || '',
      }))

    const neighborPaid = pNeighborPayments
      .filter((x: any) => x.is_paid)
      .reduce((s: number, x: any) => s + Number(x.amount), 0)
    const neighborScheduled = pNeighborPayments.reduce((s: number, x: any) => s + Number(x.amount), 0)

    const totalSupplierPaid =
      executedSupplierMovements.reduce((s: number, x: any) => s + x.amount, 0) + neighborPaid
    const totalSupplierScheduled =
      scheduledSupplierPayments.reduce((s: number, x: any) => s + x.amount, 0) + neighborScheduled

    // Buyers enriched
    const enrichedBuyers = pBuyers.map((b: any) => {
      const bPayments = bp.filter((x: any) => x.buyer_id === b.id)
      const bSchedule = bPayments
        .filter((x: any) => x.payment_type === 'schedule' || (!x.payment_type && !x.is_received))
        .map((x: any) => ({
          id: x.id,
          amount: Number(x.amount),
          due_date: x.due_date,
          notes: x.notes || '',
        }))
      const bMovements = bPayments
        .filter((x: any) => x.payment_type === 'movement' || (!x.payment_type && x.is_received))
        .map((x: any) => ({
          id: x.id,
          amount: Number(x.amount),
          received_at: x.received_at,
          notes: x.notes || '',
        }))

      const scheduledSum = bSchedule.reduce((s: number, x: any) => s + x.amount, 0)
      const receivedSum = bMovements.reduce((s: number, x: any) => s + x.amount, 0)
      const contractTotal = Number(b.total_amount) || scheduledSum

      return {
        id: b.id,
        name: b.name,
        phone: b.phone || '',
        email: b.email || '',
        id_number: b.id_number || '',
        unit_description: b.unit_description || '',
        contract_date: b.contract_date || '',
        contract_total: contractTotal,
        scheduled_total: scheduledSum,
        received_actual: receivedSum,
        remaining_balance: scheduledSum - receivedSum,
        notes: b.notes || '',
        schedule_payments: bSchedule,
        actual_movements: bMovements,
      }
    })

    const totalReceivedFromBuyers = bp
      .filter((x: any) => x.payment_type === 'movement' || (!x.payment_type && x.is_received))
      .reduce((s: number, x: any) => s + Number(x.amount), 0)
    const totalExpectedFromBuyers = bp
      .filter((x: any) => x.payment_type === 'schedule' || (!x.payment_type && !x.is_received))
      .reduce((s: number, x: any) => s + Number(x.amount), 0)

    const txIncome = pTx
      .filter((x: any) => x.type === 'income')
      .reduce((s: number, x: any) => s + Number(x.amount), 0)
    const txExpense = pTx
      .filter((x: any) => x.type === 'expense')
      .reduce((s: number, x: any) => s + Number(x.amount), 0)

    // Partners enriched
    const enrichedPartners = pPartners.map((partner: any) => {
      const myTx = pPartnerTx.filter((t: any) => t.partner_id === partner.id)
      const invested = myTx
        .filter((t: any) => t.type === 'investment')
        .reduce((s: number, t: any) => s + Number(t.amount), 0)
      const withdrawn = myTx
        .filter((t: any) => t.type === 'withdrawal')
        .reduce((s: number, t: any) => s + Number(t.amount), 0)
      const expense = myTx
        .filter((t: any) => t.type === 'expense')
        .reduce((s: number, t: any) => s + Number(t.amount), 0)
      return {
        id: partner.id,
        name: partner.name,
        phone: partner.phone || '',
        email: partner.email || '',
        notes: partner.notes || '',
        total_invested: invested,
        total_withdrawn: withdrawn,
        total_expense: expense,
        net_balance: invested - withdrawn - expense,
        transactions: myTx,
      }
    })

    const totalInvested = pPartnerTx
      .filter((x: any) => x.type === 'investment')
      .reduce((s: number, x: any) => s + Number(x.amount), 0)
    const totalWithdrawn = pPartnerTx
      .filter((x: any) => x.type === 'withdrawal')
      .reduce((s: number, x: any) => s + Number(x.amount), 0)
    const ptxExpense = pPartnerTx
      .filter((x: any) => x.type === 'expense')
      .reduce((s: number, x: any) => s + Number(x.amount), 0)

    // Loans enriched
    const enrichedLoans = pLoans.map((loan: any) => {
      const myPayments = pLoanPayments.filter((p: any) => p.loan_id === loan.id)
      const myReceipts = pLoanReceipts.filter((r: any) => r.loan_id === loan.id)
      const principalPaid = myPayments
        .filter((p: any) => p.is_paid && !p.is_interest)
        .reduce((s: number, p: any) => s + Number(p.amount), 0)
      const interestPaid = myPayments
        .filter((p: any) => p.is_paid && p.is_interest)
        .reduce((s: number, p: any) => s + Number(p.amount), 0)
      const receivedAmt = myReceipts
        .filter((r: any) => r.is_received)
        .reduce((s: number, r: any) => s + Number(r.amount), 0)

      return {
        id: loan.id,
        lender: loan.lender,
        arranged_by: loan.arranged_by || '',
        total_amount: Number(loan.total_amount),
        interest_rate: loan.interest_rate,
        received_amount: receivedAmt,
        principal_paid_back: principalPaid,
        interest_paid: interestPaid,
        current_debt_balance: receivedAmt - principalPaid,
        notes: loan.notes || '',
        receipts: myReceipts,
        repayments: myPayments,
      }
    })

    const loanReceivedAmt = pLoanReceipts
      .filter((r: any) => r.is_received)
      .reduce((s: number, r: any) => s + Number(r.amount), 0)
    const loanPaidBack = pLoanPayments
      .filter((p: any) => p.is_paid && !p.is_interest)
      .reduce((s: number, p: any) => s + Number(p.amount), 0)
    const loanInterestPaid = pLoanPayments
      .filter((p: any) => p.is_paid && p.is_interest)
      .reduce((s: number, p: any) => s + Number(p.amount), 0)

    // Neighbors enriched
    const enrichedNeighbors = pNeighbors.map((n: any) => {
      const myPay = pNeighborPayments.filter((p: any) => p.neighbor_id === n.id)
      const paid = myPay
        .filter((p: any) => p.is_paid)
        .reduce((s: number, p: any) => s + Number(p.amount), 0)
      const agreed = Number(n.total_amount) || myPay.reduce((s: number, p: any) => s + Number(p.amount), 0)
      return {
        id: n.id,
        name: n.name,
        phone: n.phone || '',
        email: n.email || '',
        total_agreed: agreed,
        paid_actual: paid,
        remaining: agreed - paid,
        notes: n.notes || '',
        payments: myPay,
      }
    })

    const realBalance =
      totalReceivedFromBuyers +
      txIncome +
      totalInvested +
      loanReceivedAmt -
      (totalSupplierPaid + txExpense + ptxExpense + totalWithdrawn + loanPaidBack)
    const expectedBalance =
      totalExpectedFromBuyers +
      txIncome +
      totalInvested +
      loanReceivedAmt -
      (totalSupplierScheduled + txExpense + ptxExpense + totalWithdrawn + loanPaidBack)

    return {
      id: proj.id,
      name: proj.name,
      status: proj.status,
      status_hebrew: STATUS_HEBREW[proj.status] || proj.status,
      address: proj.address || '',
      contact_name: proj.contact_name || '',
      contact_phone: proj.contact_phone || '',
      start_date: proj.start_date || '',
      total_project_cost: proj.total_project_cost ? Number(proj.total_project_cost) : null,
      notes: proj.notes || '',
      drive_folder_url: proj.drive_folder_url || '',
      kpis: {
        cashInFund: realBalance,
        expectedBalance,
        totalReceivedFromBuyers,
        totalExpectedFromBuyers,
        remainingFromBuyers: totalExpectedFromBuyers - totalReceivedFromBuyers,
        totalSupplierPaid,
        totalSupplierScheduled,
        remainingSupplierPayments: totalSupplierScheduled - totalSupplierPaid,
        txIncome,
        txExpense,
        loanReceivedAmt,
        loanPaidBack,
        loanInterestPaid,
        netLoans: loanReceivedAmt - loanPaidBack,
        totalInvested,
        totalWithdrawn,
        partnerExpenses: ptxExpense,
        netPartnerInvestment: totalInvested - totalWithdrawn - ptxExpense,
      },
      buyers: enrichedBuyers,
      supplier_schedule_payments: scheduledSupplierPayments,
      supplier_actual_movements: executedSupplierMovements,
      general_transactions: pTx,
      loans: enrichedLoans,
      partners: enrichedPartners,
      neighbors: enrichedNeighbors,
      documents: pDocs,
    }
  })

  // Macro summary across active/pending projects
  const activeProjects = organizedProjects.filter((p) => p.status !== 'closed')
  const macroSummary = {
    totalProjectsCount: organizedProjects.length,
    activeProjectsCount: activeProjects.length,
    totalBuyersCount: buyers.length,
    totalCashInFund: activeProjects.reduce((s, p) => s + p.kpis.cashInFund, 0),
    totalReceivedFromBuyers: activeProjects.reduce((s, p) => s + p.kpis.totalReceivedFromBuyers, 0),
    totalExpectedFromBuyers: activeProjects.reduce((s, p) => s + p.kpis.totalExpectedFromBuyers, 0),
    remainingFromBuyers: activeProjects.reduce((s, p) => s + p.kpis.remainingFromBuyers, 0),
    totalSupplierPaid: activeProjects.reduce((s, p) => s + p.kpis.totalSupplierPaid, 0),
    totalSupplierScheduled: activeProjects.reduce((s, p) => s + p.kpis.totalSupplierScheduled, 0),
    remainingSupplierPayments: activeProjects.reduce((s, p) => s + p.kpis.remainingSupplierPayments, 0),
    totalNetLoans: activeProjects.reduce((s, p) => s + p.kpis.netLoans, 0),
    totalNetPartners: activeProjects.reduce((s, p) => s + p.kpis.netPartnerInvestment, 0),
  }

  return {
    created_at: new Date().toISOString(),
    created_by: createdByEmail || 'system',
    macro_summary: macroSummary,
    organized_projects: organizedProjects,
    workers: workers.map((w: any) => ({
      ...w,
      tasks: workerTasks.filter((t: any) => t.worker_id === w.id),
    })),
    calendar_events: calendarEvents,
    recent_audit_log: auditLogs.slice(0, 100),
    tables: tablesMap,
  }
}

export function renderMosheBackupHtml(backup: Awaited<ReturnType<typeof buildMosheOrganizedBackup>>): string {
  const m = backup.macro_summary
  const generatedAt = new Date(backup.created_at).toLocaleString('he-IL')

  const projectsHtml = backup.organized_projects
    .map((p, idx) => {
      const k = p.kpis

      // Buyers rows
      const buyersRows =
        p.buyers.length === 0
          ? `<tr><td colspan="7" class="empty">אין קונים רשומים בפרויקט זה</td></tr>`
          : p.buyers
              .map(
                (b: any) => `
              <tr>
                <td class="bold">${escHtml(b.name)}</td>
                <td>${escHtml(b.unit_description || '—')}</td>
                <td class="num">${escHtml(b.phone || '—')}</td>
                <td class="num">${fmtILS(b.contract_total)}</td>
                <td class="num">${fmtILS(b.scheduled_total)}</td>
                <td class="num green bold">${fmtILS(b.received_actual)}</td>
                <td class="num ${b.remaining_balance > 0 ? 'amber bold' : 'slate'}">${fmtILS(b.remaining_balance)}</td>
              </tr>
              ${
                b.schedule_payments.length > 0 || b.actual_movements.length > 0
                  ? `<tr class="subrow">
                      <td colspan="7">
                        <div class="subgrid">
                          <div>
                            <strong>לוח תשלומים שנקבע לקונה (${b.schedule_payments.length}):</strong>
                            ${
                              b.schedule_payments.length === 0
                                ? '<span>ללא</span>'
                                : `<ul>` +
                                  b.schedule_payments
                                    .map(
                                      (sp: any) =>
                                        `<li><span class="num bold">${fmtILS(sp.amount)}</span> · יעד: ${fmtDate(sp.due_date)} ${sp.notes ? `— ${escHtml(sp.notes)}` : ''}</li>`
                                    )
                                    .join('') +
                                  `</ul>`
                            }
                          </div>
                          <div>
                            <strong>תנועות שהתקבלו בפועל (${b.actual_movements.length}):</strong>
                            ${
                              b.actual_movements.length === 0
                                ? '<span>ללא תנועות</span>'
                                : `<ul>` +
                                  b.actual_movements
                                    .map(
                                      (mv: any) =>
                                        `<li><span class="num green bold">${fmtILS(mv.amount)}</span> · התקבל: ${fmtDate(mv.received_at)} ${mv.notes ? `— ${escHtml(mv.notes)}` : ''}</li>`
                                    )
                                    .join('') +
                                  `</ul>`
                            }
                          </div>
                        </div>
                      </td>
                    </tr>`
                  : ''
              }`
              )
              .join('')

      // Supplier Schedule & Movements
      const supplierSchedRows =
        p.supplier_schedule_payments.length === 0
          ? `<tr><td colspan="3" class="empty">אין תשלומים בלוח הפרויקט</td></tr>`
          : p.supplier_schedule_payments
              .map(
                (sp: any) => `
              <tr>
                <td class="num bold">${fmtILS(sp.amount)}</td>
                <td class="num">${fmtDate(sp.due_date)}</td>
                <td>${escHtml(sp.notes || '—')}</td>
              </tr>`
              )
              .join('')

      const supplierMoveRows =
        p.supplier_actual_movements.length === 0
          ? `<tr><td colspan="3" class="empty">אין תנועות תשלום שבוצעו בפועל</td></tr>`
          : p.supplier_actual_movements
              .map(
                (mv: any) => `
              <tr>
                <td class="num red bold">${fmtILS(mv.amount)}</td>
                <td class="num">${fmtDate(mv.paid_at || mv.due_date)}</td>
                <td>${escHtml(mv.notes || '—')}</td>
              </tr>`
              )
              .join('')

      // Loans
      const loansRows =
        p.loans.length === 0
          ? `<tr><td colspan="6" class="empty">אין הלוואות רשומות בפרויקט זה</td></tr>`
          : p.loans
              .map(
                (l: any) => `
              <tr>
                <td class="bold">${escHtml(l.lender)}</td>
                <td class="num">${fmtILS(l.total_amount)}</td>
                <td class="num">${fmtILS(l.received_amount)}</td>
                <td class="num green">${fmtILS(l.principal_paid_back)}</td>
                <td class="num">${fmtILS(l.interest_paid)}</td>
                <td class="num bold ${l.current_debt_balance > 0 ? 'red' : 'slate'}">${fmtILS(l.current_debt_balance)}</td>
              </tr>`
              )
              .join('')

      // Partners
      const partnersRows =
        p.partners.length === 0
          ? `<tr><td colspan="5" class="empty">אין שותפים רשומים בפרויקט זה</td></tr>`
          : p.partners
              .map(
                (pt: any) => `
              <tr>
                <td class="bold">${escHtml(pt.name)}</td>
                <td class="num">${escHtml(pt.phone || '—')}</td>
                <td class="num green">${fmtILS(pt.total_invested)}</td>
                <td class="num red">${fmtILS(pt.total_withdrawn + pt.total_expense)}</td>
                <td class="num bold">${fmtILS(pt.net_balance)}</td>
              </tr>`
              )
              .join('')

      // Neighbors
      const neighborsRows =
        p.neighbors.length === 0
          ? `<tr><td colspan="5" class="empty">אין הסכמי שכנים בפרויקט זה</td></tr>`
          : p.neighbors
              .map(
                (n: any) => `
              <tr>
                <td class="bold">${escHtml(n.name)}</td>
                <td class="num">${escHtml(n.phone || '—')}</td>
                <td class="num">${fmtILS(n.total_agreed)}</td>
                <td class="num green">${fmtILS(n.paid_actual)}</td>
                <td class="num bold">${fmtILS(n.remaining)}</td>
              </tr>`
              )
              .join('')

      // General Transactions
      const txRows =
        p.general_transactions.length === 0
          ? `<tr><td colspan="5" class="empty">אין תנועות הוצאה/הכנסה כלליות</td></tr>`
          : p.general_transactions
              .map(
                (t: any) => `
              <tr>
                <td>${t.type === 'income' ? '<span class="badge-green">הכנסה</span>' : '<span class="badge-red">הוצאה</span>'}</td>
                <td class="num bold ${t.type === 'income' ? 'green' : 'red'}">${fmtILS(Number(t.amount))}</td>
                <td class="num">${fmtDate(t.date)}</td>
                <td>${escHtml(t.category || 'כללי')}</td>
                <td>${escHtml(t.notes || '—')}</td>
              </tr>`
              )
              .join('')

      return `
        <section class="project-card" id="proj-${idx}">
          <div class="project-header">
            <div>
              <h2>${idx + 1}. ${escHtml(p.name)} <span class="status-badge">${escHtml(p.status_hebrew)}</span></h2>
              <p class="meta">
                ${p.address ? `כתובת: ${escHtml(p.address)} · ` : ''}
                ${p.contact_name ? `איש קשר: ${escHtml(p.contact_name)} (${escHtml(p.contact_phone)}) · ` : ''}
                ${p.total_project_cost ? `תקציב פרויקט: <strong class="num">${fmtILS(p.total_project_cost)}</strong>` : ''}
              </p>
            </div>
          </div>

          <div class="kpi-grid">
            <div class="kpi-box">
              <div class="kpi-label">כסף בקופה (מאזן בפועל)</div>
              <div class="kpi-val num ${k.cashInFund >= 0 ? 'green' : 'red'}">${fmtILS(k.cashInFund)}</div>
            </div>
            <div class="kpi-box">
              <div class="kpi-label">התקבל מקונים (מתוך ${fmtILS(k.totalExpectedFromBuyers)})</div>
              <div class="kpi-val num green">${fmtILS(k.totalReceivedFromBuyers)}</div>
              <div class="kpi-sub num">יתרה לגבייה: ${fmtILS(k.remainingFromBuyers)}</div>
            </div>
            <div class="kpi-box">
              <div class="kpi-label">שולם לספקים ושכנים (מתוך ${fmtILS(k.totalSupplierScheduled)})</div>
              <div class="kpi-val num red">${fmtILS(k.totalSupplierPaid)}</div>
              <div class="kpi-sub num">יתרה לתשלום: ${fmtILS(k.remainingSupplierPayments)}</div>
            </div>
            <div class="kpi-box">
              <div class="kpi-label">הלוואות נטו / שותפים נטו</div>
              <div class="kpi-val num">${fmtILS(k.netLoans)} / ${fmtILS(k.netPartnerInvestment)}</div>
            </div>
          </div>

          <h3>קונים ודיירים (${p.buyers.length})</h3>
          <table>
            <thead>
              <tr>
                <th>שם הקונה</th>
                <th>יחידה / דירה</th>
                <th>טלפון</th>
                <th>סכום חוזה</th>
                <th>נקבע בלוח</th>
                <th>שולם בפועל</th>
                <th>יתרה לתשלום</th>
              </tr>
            </thead>
            <tbody>${buyersRows}</tbody>
          </table>

          <div class="two-col">
            <div>
              <h3>לוח תשלומים שנקבע לפרויקט (${p.supplier_schedule_payments.length})</h3>
              <table>
                <thead><tr><th>סכום</th><th>תאריך יעד</th><th>שלב / הערות</th></tr></thead>
                <tbody>${supplierSchedRows}</tbody>
              </table>
            </div>
            <div>
              <h3>תשלומים שבוצעו בפועל (${p.supplier_actual_movements.length})</h3>
              <table>
                <thead><tr><th>סכום ששולם</th><th>תאריך ביצוע</th><th>אסמכתא / הערות</th></tr></thead>
                <tbody>${supplierMoveRows}</tbody>
              </table>
            </div>
          </div>

          <h3>הלוואות וגמ"חים (${p.loans.length})</h3>
          <table>
            <thead>
              <tr>
                <th>שם המלווה / גמ"ח</th>
                <th>מסגרת הלוואה</th>
                <th>נמשך לקופה</th>
                <th>קרן שנפרעה</th>
                <th>ריבית ששולמה</th>
                <th>יתרת חוב נוכחית</th>
              </tr>
            </thead>
            <tbody>${loansRows}</tbody>
          </table>

          <div class="two-col">
            <div>
              <h3>שותפים והשקעות (${p.partners.length})</h3>
              <table>
                <thead><tr><th>שם שותף</th><th>טלפון</th><th>השקעות</th><th>משיכות/הוצאות</th><th>יתרה נטו</th></tr></thead>
                <tbody>${partnersRows}</tbody>
              </table>
            </div>
            <div>
              <h3>שכנים והסכמי פיצוי (${p.neighbors.length})</h3>
              <table>
                <thead><tr><th>שם שכן</th><th>טלפון</th><th>סכום הסכם</th><th>שולם בפועל</th><th>יתרה</th></tr></thead>
                <tbody>${neighborsRows}</tbody>
              </table>
            </div>
          </div>

          <h3>הוצאות והכנסות כלליות (${p.general_transactions.length})</h3>
          <table>
            <thead>
              <tr><th>סוג</th><th>סכום</th><th>תאריך</th><th>קטגוריה</th><th>תיאור / הערות</th></tr>
            </thead>
            <tbody>${txRows}</tbody>
          </table>
        </section>
      `
    })
    .join('\n')

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>גיבוי מלא ומסודר — פורטל משה פרוש (${generatedAt})</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: #f8fafc;
      color: #0f172a;
      margin: 0;
      padding: 24px;
      line-height: 1.5;
    }
    .container { max-width: 1250px; margin: 0 auto; }
    .top-bar {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #fff;
      padding: 24px 28px;
      border-radius: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 16px;
    }
    .top-bar h1 { margin: 0 0 6px 0; font-size: 24px; font-weight: 900; }
    .top-bar p { margin: 0; color: #cbd5e1; font-size: 13px; }
    .print-btn {
      background: #f59e0b;
      color: #fff;
      border: none;
      padding: 10px 20px;
      border-radius: 10px;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
    }
    .print-btn:hover { background: #d97706; }
    .num { font-variant-numeric: tabular-nums; direction: ltr; display: inline-block; }
    .bold { font-weight: 700; }
    .green { color: #059669; }
    .red { color: #dc2626; }
    .amber { color: #d97706; }
    .slate { color: #64748b; }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px;
      margin-bottom: 20px;
    }
    .kpi-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 14px 16px;
    }
    .kpi-label { font-size: 12px; color: #64748b; font-weight: 700; margin-bottom: 4px; }
    .kpi-val { font-size: 20px; font-weight: 900; }
    .kpi-sub { font-size: 11px; color: #475569; margin-top: 4px; }
    .toc {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 16px 20px;
      margin-bottom: 24px;
    }
    .toc h3 { margin: 0 0 10px 0; font-size: 15px; }
    .toc-links { display: flex; flex-wrap: wrap; gap: 8px; }
    .toc-links a {
      background: #f1f5f9;
      color: #0f172a;
      text-decoration: none;
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
    }
    .toc-links a:hover { background: #fde68a; }
    .project-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 28px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
      page-break-inside: avoid;
    }
    .project-header {
      border-bottom: 2px solid #f59e0b;
      padding-bottom: 12px;
      margin-bottom: 18px;
    }
    .project-header h2 { margin: 0 0 4px 0; font-size: 20px; display: flex; align-items: center; gap: 10px; }
    .status-badge {
      font-size: 12px;
      background: #fef3c7;
      color: #b45309;
      padding: 2px 10px;
      border-radius: 999px;
      font-weight: 700;
    }
    .meta { margin: 0; font-size: 13px; color: #64748b; }
    h3 { font-size: 15px; margin: 20px 0 8px 0; color: #1e293b; border-right: 3px solid #f59e0b; padding-right: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 12px; }
    th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: right; vertical-align: top; }
    th { background: #f1f5f9; font-weight: 700; color: #334155; }
    .empty { text-align: center; color: #94a3b8; font-style: italic; padding: 12px; }
    .subrow td { background: #fcfcfd; padding: 10px 14px; }
    .subgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 12px; }
    .subgrid ul { margin: 4px 0 0 0; padding-right: 18px; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .badge-green { background: #d1fae5; color: #065f46; padding: 2px 8px; border-radius: 6px; font-weight: 700; font-size: 11px; }
    .badge-red { background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 6px; font-weight: 700; font-size: 11px; }
    @media (max-width: 768px) {
      .two-col, .subgrid { grid-template-columns: 1fr; }
    }
    @media print {
      body { background: #fff; padding: 0; }
      .print-btn, .toc { display: none; }
      .project-card { box-shadow: none; border: 1px solid #cbd5e1; page-break-after: always; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="top-bar">
      <div>
        <h1>גיבוי ודוח מערכת מלא — פורטל נדל״ן משה פרוש</h1>
        <p>הופק בתאריך: ${escHtml(generatedAt)} · כולל ${m.totalProjectsCount} פרויקטים (${m.activeProjectsCount} פעילים) ו-${m.totalBuyersCount} קונים</p>
      </div>
      <button class="print-btn" onclick="window.print()">הדפס / שמור כ-PDF</button>
    </div>

    <div class="project-card">
      <h3 style="margin-top:0">סיכום מנהלים כולל (פרויקטים פעילים)</h3>
      <div class="kpi-grid">
        <div class="kpi-box">
          <div class="kpi-label">סה״כ כסף בקופה</div>
          <div class="kpi-val num ${m.totalCashInFund >= 0 ? 'green' : 'red'}">${fmtILS(m.totalCashInFund)}</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-label">סה״כ התקבל מקונים</div>
          <div class="kpi-val num green">${fmtILS(m.totalReceivedFromBuyers)}</div>
          <div class="kpi-sub num">יתרה לגבייה מקונים: ${fmtILS(m.remainingFromBuyers)}</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-label">סה״כ שולם בפועל (ספקים ושכנים)</div>
          <div class="kpi-val num red">${fmtILS(m.totalSupplierPaid)}</div>
          <div class="kpi-sub num">יתרה לתשלום לפי לוח: ${fmtILS(m.remainingSupplierPayments)}</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-label">הלוואות נטו / שותפים נטו</div>
          <div class="kpi-val num">${fmtILS(m.totalNetLoans)} / ${fmtILS(m.totalNetPartners)}</div>
        </div>
      </div>
    </div>

    <div class="toc">
      <h3>ניווט מהיר בין פרויקטים:</h3>
      <div class="toc-links">
        ${backup.organized_projects
          .map((p, idx) => `<a href="#proj-${idx}">${idx + 1}. ${escHtml(p.name)} (${p.buyers.length} קונים)</a>`)
          .join('')}
      </div>
    </div>

    ${projectsHtml}
  </div>
</body>
</html>`
}

function csvCell(val: unknown): string {
  if (val === null || val === undefined) return '""'
  const str = String(val).replace(/"/g, '""')
  return `"${str}"`
}

export function renderMosheBackupCsv(backup: Awaited<ReturnType<typeof buildMosheOrganizedBackup>>): string {
  const lines: string[] = []
  const addRow = (cols: unknown[]) => lines.push(cols.map(csvCell).join(','))

  addRow(['גיבוי מלא ומסודר - פורטל פרויקטים משה פרוש', backup.created_at])
  addRow([])

  // 1. Projects Summary
  addRow(['=== 1. טבלת פרויקטים ומאזן כספי ==='])
  addRow([
    'שם פרויקט',
    'סטטוס',
    'כתובת',
    'איש קשר',
    'טלפון',
    'תקציב פרויקט',
    'כסף בקופה',
    'התקבל מקונים',
    'צפוי מקונים (לוח)',
    'יתרה לגבייה מקונים',
    'שולם לספקים ושכנים',
    'לוח תשלומים לספקים',
    'יתרה לתשלום לספקים',
    'הלוואות נטו',
    'שותפים נטו',
  ])
  for (const p of backup.organized_projects) {
    addRow([
      p.name,
      p.status_hebrew,
      p.address,
      p.contact_name,
      p.contact_phone,
      p.total_project_cost ?? 0,
      p.kpis.cashInFund,
      p.kpis.totalReceivedFromBuyers,
      p.kpis.totalExpectedFromBuyers,
      p.kpis.remainingFromBuyers,
      p.kpis.totalSupplierPaid,
      p.kpis.totalSupplierScheduled,
      p.kpis.remainingSupplierPayments,
      p.kpis.netLoans,
      p.kpis.netPartnerInvestment,
    ])
  }
  addRow([])

  // 2. Buyers Summary
  addRow(['=== 2. טבלת קונים ויתרות לפי פרויקט ==='])
  addRow([
    'שם פרויקט',
    'שם הקונה',
    'דירה / יחידה',
    'טלפון',
    'ת.ז.',
    'תאריך חוזה',
    'סכום חוזה',
    'נקבע בלוח תשלומים',
    'שולם בפועל',
    'יתרה לתשלום',
    'הערות',
  ])
  for (const p of backup.organized_projects) {
    for (const b of p.buyers) {
      addRow([
        p.name,
        b.name,
        b.unit_description,
        b.phone,
        b.id_number,
        b.contract_date,
        b.contract_total,
        b.scheduled_total,
        b.received_actual,
        b.remaining_balance,
        b.notes,
      ])
    }
  }
  addRow([])

  // 3. Buyer Payments Details
  addRow(['=== 3. פירוט כל תשלומי הקונים (לוח תשלומים ותנועות בפועל) ==='])
  addRow(['שם פרויקט', 'שם הקונה', 'סוג רשומה', 'סכום', 'תאריך יעד / קבלה', 'הערות / אסמכתא'])
  for (const p of backup.organized_projects) {
    for (const b of p.buyers) {
      for (const sp of b.schedule_payments) {
        addRow([p.name, b.name, 'לוח תשלומים (מתוכנן)', sp.amount, sp.due_date, sp.notes])
      }
      for (const mv of b.actual_movements) {
        addRow([p.name, b.name, 'תנועה בפועל (התקבל)', mv.amount, mv.received_at, mv.notes])
      }
    }
  }
  addRow([])

  // 4. Project Supplier Payments
  addRow(['=== 4. תשלומי פרויקטים וספקים (לוח תשלומים ותנועות בפועל) ==='])
  addRow(['שם פרויקט', 'סוג רשומה', 'סכום', 'תאריך', 'שלב / אסמכתא / הערות'])
  for (const p of backup.organized_projects) {
    for (const sp of p.supplier_schedule_payments) {
      addRow([p.name, 'לוח תשלומים (מתוכנן)', sp.amount, sp.due_date, sp.notes])
    }
    for (const mv of p.supplier_actual_movements) {
      addRow([p.name, 'תנועה בפועל (שולם)', mv.amount, mv.paid_at || mv.due_date, mv.notes])
    }
  }
  addRow([])

  // 5. Loans
  addRow(['=== 5. הלוואות וגמ"חים ==='])
  addRow(['שם פרויקט', 'שם מלווה / גמ"ח', 'מסגרת אשראי', 'נמשך בפועל', 'קרן שנפרעה', 'ריבית ששולמה', 'יתרת חוב', 'הערות'])
  for (const p of backup.organized_projects) {
    for (const l of p.loans) {
      addRow([
        p.name,
        l.lender,
        l.total_amount,
        l.received_amount,
        l.principal_paid_back,
        l.interest_paid,
        l.current_debt_balance,
        l.notes,
      ])
    }
  }
  addRow([])

  // 6. Partners
  addRow(['=== 6. שותפים והשקעות ==='])
  addRow(['שם פרויקט', 'שם שותף', 'טלפון', 'סה"כ השקעות', 'סה"כ משיכות', 'סה"כ הוצאות', 'יתרה נטו'])
  for (const p of backup.organized_projects) {
    for (const pt of p.partners) {
      addRow([p.name, pt.name, pt.phone, pt.total_invested, pt.total_withdrawn, pt.total_expense, pt.net_balance])
    }
  }
  addRow([])

  // 7. Neighbors
  addRow(['=== 7. שכנים והסכמי פיצוי ==='])
  addRow(['שם פרויקט', 'שם שכן', 'טלפון', 'סכום הסכם', 'שולם בפועל', 'יתרה לתשלום', 'הערות'])
  for (const p of backup.organized_projects) {
    for (const n of p.neighbors) {
      addRow([p.name, n.name, n.phone, n.total_agreed, n.paid_actual, n.remaining, n.notes])
    }
  }
  addRow([])

  // 8. General Transactions
  addRow(['=== 8. הוצאות והכנסות כלליות ==='])
  addRow(['שם פרויקט', 'סוג', 'סכום', 'תאריך', 'קטגוריה', 'הערות'])
  for (const p of backup.organized_projects) {
    for (const tx of p.general_transactions) {
      addRow([p.name, tx.type === 'income' ? 'הכנסה' : 'הוצאה', tx.amount, tx.date, tx.category, tx.notes])
    }
  }

  // Prepend UTF-8 BOM so Microsoft Excel opens Hebrew cleanly
  return '\uFEFF' + lines.join('\r\n')
}
