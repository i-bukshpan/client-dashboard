import { mkdir, writeFile } from 'fs/promises'
import { renderDashboardPdf } from '../src/lib/v2/dashboard-pdf'
import type { DashboardSnapshot } from '../src/types/dashboard-snapshot'

const snapshot: DashboardSnapshot = {
  version: 1,
  clientId: '00000000-0000-0000-0000-000000000000',
  clientName: 'לקוח לדוגמה',
  title: 'דשבורד - לקוח לדוגמה',
  generatedAt: new Date().toISOString(),
  sourceSpreadsheetId: 'qa',
  profile: { version: 1, spreadsheetId: 'qa', analyzedAt: new Date().toISOString(), tabs: [], currencies: ['ILS'], confidence: 0.92, ambiguities: [] },
  config: {
    version: 1,
    widgets: [
      { id: 'income', type: 'stat_card', title: 'סה״כ הכנסות', sheet: 'תנועות', position: { col: 0, row: 0, w: 1, h: 1 }, aggregation: 'sum', value_column: 'סכום', prefix: '₪' },
      { id: 'trend', type: 'bar_chart', title: 'הכנסות לפי חודש', sheet: 'תנועות', position: { col: 1, row: 0, w: 2, h: 2 }, x_column: 'חודש', y_column: 'סכום' },
      { id: 'table', type: 'data_table', title: 'תנועות אחרונות', sheet: 'תנועות', position: { col: 0, row: 2, w: 4, h: 2 }, columns: ['תאריך', 'קטגוריה', 'סכום'], max_rows: 10 },
    ],
  },
  data: {
    'תנועות': [
      { 'תאריך': '01/08/2026', 'חודש': 'אוגוסט', 'קטגוריה': 'ייעוץ', 'סכום': '₪12,500' },
      { 'תאריך': '11/08/2026', 'חודש': 'אוגוסט', 'קטגוריה': 'ליווי', 'סכום': '₪8,400' },
      { 'תאריך': '03/07/2026', 'חודש': 'יולי', 'קטגוריה': 'ייעוץ', 'סכום': '₪9,750' },
    ],
  },
}

async function main() {
  await mkdir('output/pdf', { recursive: true })
  await writeFile('output/pdf/dashboard-snapshot-sample.pdf', await renderDashboardPdf(snapshot))
}

void main()
