import 'server-only'

import { getSheetRows, getSpreadsheetMeta } from '@/lib/google-sheets'
import type {
  SheetColumnProfile,
  SheetProfile,
  SheetSemanticType,
  SheetTabProfile,
  SheetTabRole,
} from '@/types/sheet-profile'

const DATE_PATTERNS = [
  { name: 'yyyy-MM-dd', re: /^\d{4}-\d{2}-\d{2}$/ },
  { name: 'dd/MM/yyyy', re: /^\d{1,2}\/\d{1,2}\/\d{2,4}$/ },
  { name: 'dd.MM.yyyy', re: /^\d{1,2}\.\d{1,2}\.\d{2,4}$/ },
]

function normalizedNumber(value: string): number | null {
  const negative = /^\s*\(.*\)\s*$/.test(value)
  const cleaned = value.replace(/[₪$€£,%()\s,]/g, '')
  if (!cleaned || !/^-?\d+(\.\d+)?$/.test(cleaned)) return null
  const result = Number(cleaned)
  return Number.isFinite(result) ? (negative ? -result : result) : null
}

function currencyOf(values: string[], header: string): string | null {
  const joined = `${header} ${values.join(' ')}`.toLowerCase()
  if (/₪|ש["״']?ח|ils|nis/.test(joined)) return 'ILS'
  if (/\$|usd|דולר/.test(joined)) return 'USD'
  if (/€|eur|אירו/.test(joined)) return 'EUR'
  if (/£|gbp/.test(joined)) return 'GBP'
  return null
}

function inferColumn(name: string, rawValues: string[]): SheetColumnProfile {
  const values = rawValues.map((value) => value.trim()).filter(Boolean).slice(0, 200)
  if (values.length === 0) {
    return { name, semanticType: 'empty', confidence: 1, nullable: true, uniqueRatio: 0, sampleValues: [], currency: null, dateFormats: [] }
  }

  const lowerName = name.toLowerCase()
  const dateFormats = DATE_PATTERNS.filter(({ re }) => values.some((value) => re.test(value))).map(({ name: formatName }) => formatName)
  const dateRatio = values.filter((value) => DATE_PATTERNS.some(({ re }) => re.test(value)) && !Number.isNaN(Date.parse(value.split('/').reverse().join('-')))).length / values.length
  const datetimeRatio = values.filter((value) => /[tT ]\d{1,2}:\d{2}/.test(value) && !Number.isNaN(Date.parse(value))).length / values.length
  const numberRatio = values.filter((value) => normalizedNumber(value) !== null).length / values.length
  const percentageRatio = values.filter((value) => /%/.test(value)).length / values.length
  const booleanRatio = values.filter((value) => /^(true|false|yes|no|כן|לא)$/i.test(value)).length / values.length
  const uniqueRatio = new Set(values).size / values.length
  const currency = currencyOf(values, name)

  let semanticType: SheetSemanticType = 'text'
  let confidence = 0.65
  if (datetimeRatio >= 0.7) [semanticType, confidence] = ['datetime', datetimeRatio]
  else if (dateRatio >= 0.7 || (/תאריך|date|חודש|month/.test(lowerName) && dateRatio >= 0.4)) [semanticType, confidence] = ['date', Math.max(dateRatio, 0.75)]
  else if (percentageRatio >= 0.5) [semanticType, confidence] = ['percentage', Math.max(percentageRatio, numberRatio)]
  else if (currency && numberRatio >= 0.6) [semanticType, confidence] = ['currency', Math.max(numberRatio, 0.8)]
  else if (numberRatio >= 0.8) [semanticType, confidence] = ['number', numberRatio]
  else if (booleanRatio >= 0.8) [semanticType, confidence] = ['boolean', booleanRatio]
  else if (/id|מזהה|מספר לקוח|ת.ז/.test(lowerName) || uniqueRatio > 0.95) [semanticType, confidence] = ['identifier', Math.max(uniqueRatio, 0.75)]
  else if (uniqueRatio <= 0.4 || /סוג|קטגור|סטטוס|type|category|status/.test(lowerName)) [semanticType, confidence] = ['category', Math.max(1 - uniqueRatio, 0.72)]

  return {
    name,
    semanticType,
    confidence: Number(Math.min(confidence, 1).toFixed(2)),
    nullable: rawValues.some((value) => !value.trim()),
    uniqueRatio: Number(uniqueRatio.toFixed(2)),
    sampleValues: [...new Set(values)].slice(0, 5),
    currency,
    dateFormats,
  }
}

function inferRole(columns: SheetColumnProfile[]): { role: SheetTabRole; confidence: number } {
  const types = new Set(columns.map((column) => column.semanticType))
  if ((types.has('date') || types.has('datetime')) && (types.has('currency') || types.has('number'))) return { role: 'transactions', confidence: 0.9 }
  if (columns.length <= 8 && (types.has('currency') || types.has('number'))) return { role: 'summary', confidence: 0.75 }
  if (types.has('date') || types.has('datetime')) return { role: 'timeline', confidence: 0.72 }
  if (columns.some((column) => column.semanticType === 'identifier') && columns.length >= 2) return { role: 'master_data', confidence: 0.72 }
  return { role: 'unknown', confidence: 0.5 }
}

export async function buildSheetProfile(spreadsheetId: string): Promise<SheetProfile> {
  const metadata = await getSpreadsheetMeta(spreadsheetId)
  const tabs: SheetTabProfile[] = []
  const ambiguities: string[] = []

  for (const tab of metadata) {
    const rows = (await getSheetRows(spreadsheetId, tab.title)).slice(0, 200)
    const headers = rows[0] ? Object.keys(rows[0]) : []
    const columns = headers.map((header) => inferColumn(header, rows.map((row) => row[header] ?? '')))
    const { role, confidence } = inferRole(columns)
    const findings: string[] = []
    if (columns.length === 0) findings.push('הלשונית ריקה או ללא שורת כותרת')
    for (const column of columns.filter((item) => item.confidence < 0.7)) {
      const finding = `העמודה "${column.name}" בלשונית "${tab.title}" אינה חד-משמעית`
      findings.push(finding)
      ambiguities.push(finding)
    }
    tabs.push({ title: tab.title, role, roleConfidence: confidence, rowCount: rows.length, columns, findings })
  }

  const confidences = tabs.flatMap((tab) => [tab.roleConfidence, ...tab.columns.map((column) => column.confidence)])
  const currencies = [...new Set(tabs.flatMap((tab) => tab.columns.map((column) => column.currency).filter((value): value is string => Boolean(value))))]
  return {
    version: 1,
    spreadsheetId,
    analyzedAt: new Date().toISOString(),
    tabs,
    currencies,
    confidence: confidences.length ? Number((confidences.reduce((sum, value) => sum + value, 0) / confidences.length).toFixed(2)) : 0,
    ambiguities,
  }
}
