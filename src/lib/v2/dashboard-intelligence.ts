import 'server-only'

import { google } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { buildSheetProfile } from '@/lib/v2/sheet-profiler'
import { dashboardConfigSchema } from '@/lib/v2/dashboard-schema'
import type { DashboardConfig, DashboardWidget } from '@/types/dashboard'
import type { SheetProfile, SheetTabProfile } from '@/types/sheet-profile'
import type { ClientContext } from '@/lib/v2/client-context-schema'

function deterministicWidgets(profile: SheetProfile, context?: ClientContext | null): DashboardWidget[] {
  const widgets: DashboardWidget[] = []
  const tabsList = ['ראשי', 'פעילות', 'הוצאות', 'מעקבים']

  // Identify summary, transaction, and tracking tabs
  const summaryTabs = profile.tabs.filter(
    (t) => t.role === 'summary' || t.role === 'master_data' || (context?.sheetMapping?.dashboardSummaryTabs?.includes(t.title))
  )
  const transactionTabs = profile.tabs.filter(
    (t) => t.role === 'transactions' || (context?.sheetMapping?.rawMovementsTabs?.includes(t.title))
  )
  const trackingTabs = profile.tabs.filter(
    (t) => (context?.sheetMapping?.trackingTabs?.includes(t.title)) || /הלווא|מעקב|ספקים|קבועות/.test(t.title)
  )

  // 1. Tab "ראשי" - Overview Stat Cards & High-Level Trend
  let statCol = 0
  for (const tab of (summaryTabs.length > 0 ? summaryTabs : profile.tabs).slice(0, 2)) {
    const currencyCol = tab.columns.find((c) => c.semanticType === 'currency' || /הכנס|רווח|חוזה|סה"?כ|סכום/i.test(c.name))
    if (currencyCol && statCol < 4) {
      widgets.push({
        id: `stat-overview-${tab.title}-${currencyCol.name}`,
        type: 'stat_card',
        title: `${currencyCol.name} (${tab.title})`,
        sheet: tab.title,
        tab: 'ראשי',
        position: { col: statCol, row: 0, w: 1, h: 1 },
        aggregation: 'sum',
        value_column: currencyCol.name,
        prefix: currencyCol.currency === 'ILS' ? '₪' : undefined,
        card_color: statCol === 0 ? 'green' : statCol === 1 ? 'blue' : statCol === 2 ? 'purple' : 'amber',
      })
      statCol++
    }
  }

  // Trend chart on "ראשי"
  const mainTxTab = transactionTabs[0] || profile.tabs.find((t) => t.columns.some((c) => c.semanticType === 'date'))
  if (mainTxTab) {
    const dateCol = mainTxTab.columns.find((c) => c.semanticType === 'date' || c.semanticType === 'datetime')
    const measureCol = mainTxTab.columns.find((c) => c.semanticType === 'currency' || c.semanticType === 'number')
    if (dateCol && measureCol) {
      widgets.push({
        id: `trend-main-${mainTxTab.title}`,
        type: 'line_chart',
        title: `מגמת תנועות כספיות (${mainTxTab.title})`,
        sheet: mainTxTab.title,
        tab: 'ראשי',
        position: { col: 0, row: 1, w: 2, h: 2 },
        x_column: dateCol.name,
        y_column: measureCol.name,
        date_column: dateCol.name,
      })
    }
  }

  // Summary table on "ראשי"
  const mainSummaryTab = summaryTabs[0] || profile.tabs[0]
  if (mainSummaryTab && mainSummaryTab.columns.length > 0) {
    widgets.push({
      id: `table-main-${mainSummaryTab.title}`,
      type: 'data_table',
      title: `סיכום נתונים מובילים (${mainSummaryTab.title})`,
      sheet: mainSummaryTab.title,
      tab: 'ראשי',
      position: { col: 2, row: 1, w: 2, h: 2 },
      columns: mainSummaryTab.columns.slice(0, 7).map((c) => c.name),
      max_rows: 15,
    })
  }

  // 2. Tab "פעילות" (Projects / Operations)
  for (const tab of summaryTabs.slice(0, 2)) {
    const labelCol = tab.columns.find((c) => c.semanticType === 'category' || c.semanticType === 'text' || /שם|פרויקט|לקוח|פריט/i.test(c.name))
    const valCol = tab.columns.find((c) => c.semanticType === 'currency' || c.semanticType === 'number' || /רווח|הכנס|סכום/i.test(c.name))

    if (labelCol && valCol) {
      widgets.push({
        id: `bar-activity-${tab.title}`,
        type: 'bar_chart',
        title: `התפלגות ורווחיות לפי ${labelCol.name} (${tab.title})`,
        sheet: tab.title,
        tab: 'פעילות',
        position: { col: 0, row: 0, w: 4, h: 2 },
        x_column: labelCol.name,
        y_column: valCol.name,
      })
    }

    widgets.push({
      id: `table-activity-${tab.title}`,
      type: 'data_table',
      title: `פירוט פעילות (${tab.title})`,
      sheet: tab.title,
      tab: 'פעילות',
      position: { col: 0, row: 2, w: 4, h: 2 },
      columns: tab.columns.slice(0, 8).map((c) => c.name),
      max_rows: 25,
    })
  }

  // 3. Tab "הוצאות" (Expenses & Cash Flow)
  for (const tab of transactionTabs.slice(0, 2)) {
    const amountCol = tab.columns.find((c) => c.semanticType === 'currency' || c.semanticType === 'number')
    if (amountCol) {
      widgets.push({
        id: `stat-expenses-${tab.title}`,
        type: 'stat_card',
        title: `סה״כ תנועות ${tab.title}`,
        sheet: tab.title,
        tab: 'הוצאות',
        position: { col: 0, row: 0, w: 2, h: 1 },
        aggregation: 'sum',
        value_column: amountCol.name,
        prefix: '₪',
        card_color: 'red',
      })
    }
    widgets.push({
      id: `table-expenses-${tab.title}`,
      type: 'data_table',
      title: `פירוט תנועות ${tab.title}`,
      sheet: tab.title,
      tab: 'הוצאות',
      position: { col: 0, row: 1, w: 4, h: 2 },
      columns: tab.columns.slice(0, 8).map((c) => c.name),
      max_rows: 20,
    })
  }

  // 4. Tab "מעקבים" (Tracking / Loans / Partners)
  for (const tab of trackingTabs.slice(0, 2)) {
    const valCol = tab.columns.find((c) => c.semanticType === 'currency' || c.semanticType === 'number')
    const labelCol = tab.columns.find((c) => c.semanticType === 'category' || c.semanticType === 'text')
    if (valCol) {
      widgets.push({
        id: `stat-tracking-${tab.title}`,
        type: 'stat_card',
        title: `סה״כ ${tab.title}`,
        sheet: tab.title,
        tab: 'מעקבים',
        position: { col: 0, row: 0, w: 2, h: 1 },
        aggregation: 'sum',
        value_column: valCol.name,
        prefix: '₪',
        card_color: 'purple',
      })
      if (labelCol) {
        widgets.push({
          id: `pie-tracking-${tab.title}`,
          type: 'pie_chart',
          title: `התפלגות ${tab.title}`,
          sheet: tab.title,
          tab: 'מעקבים',
          position: { col: 0, row: 1, w: 2, h: 2 },
          label_column: labelCol.name,
          value_column: valCol.name,
        })
      }
    }
    widgets.push({
      id: `table-tracking-${tab.title}`,
      type: 'data_table',
      title: `מעקב ${tab.title}`,
      sheet: tab.title,
      tab: 'מעקבים',
      position: { col: labelCol ? 2 : 0, row: 1, w: labelCol ? 2 : 4, h: 2 },
      columns: tab.columns.slice(0, 6).map((c) => c.name),
      max_rows: 20,
    })
  }

  return widgets.slice(0, 30)
}

function assertReferences(config: DashboardConfig, profile: SheetProfile): void {
  const tabs = new Map(profile.tabs.map((tab) => [tab.title, new Set(tab.columns.map((column) => column.name))]))
  for (const widget of config.widgets) {
    const columns = tabs.get(widget.sheet)
    if (!columns) throw new Error(`Unknown sheet in dashboard proposal: ${widget.sheet}`)
    const references = [widget.x_column, widget.y_column, widget.label_column, widget.value_column, widget.date_column, widget.sort_by, ...(widget.columns ?? [])].filter((value): value is string => Boolean(value))
    for (const reference of references) {
      if (!columns.has(reference)) throw new Error(`Unknown column "${reference}" in sheet "${widget.sheet}"`)
    }
  }
}

function compactProfile(profile: SheetProfile) {
  return {
    currencies: profile.currencies,
    confidence: profile.confidence,
    ambiguities: profile.ambiguities,
    tabs: profile.tabs.map((tab: SheetTabProfile) => ({
      title: tab.title,
      role: tab.role,
      rowCount: tab.rowCount,
      columns: tab.columns.map((column) => ({
        name: column.name,
        semanticType: column.semanticType,
        confidence: column.confidence,
        currency: column.currency,
      })),
    })),
  }
}

export async function proposeDashboardFromSheet(
  spreadsheetId: string,
  context?: ClientContext | null
): Promise<{
  profile: SheetProfile
  config: DashboardConfig
  source: 'gemini' | 'deterministic-fallback'
}> {
  const profile = await buildSheetProfile(spreadsheetId)
  const contextDesc = context ? `
CLIENT BUSINESS CONTEXT:
- Business Type: ${context.businessType}
- Description: ${context.businessDescription}
- Goals: ${context.nehemiahGoals?.join(', ')}
- Key Metrics: ${context.keyMetrics?.join(', ')}
- Sheet Mapping: ${JSON.stringify(context.sheetMapping ?? {})}
` : ''

  try {
    const result = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: dashboardConfigSchema,
      system: `You are an elite financial dashboard architect for Hebrew RTL enterprise accounting & advisory.

CRITICAL ARCHITECTURE GUIDELINES FOR ALL CLIENTS:
1. MULTI-TAB ORGANIZATION:
   - Organize all widgets into structured sub-tabs using the 'tab' property:
     * 'ראשי' (Executive Overview): Top stat cards (Total Incomes, Total Expenses, Net Profit/Margin), monthly cash flow trend line chart, and top summary table.
     * 'פעילות' or 'פרויקטים' (Operations/Projects): Bar chart comparing project/department profitability, and structured data table sorted by profit.
     * 'הוצאות' (Expenses & Cash Flow): Fixed & overhead expenses breakdown, and transaction logs.
     * 'שותפים ומעקבים' or 'מעקבים' (Loans & Trackers): Owner loans, partner distributions, or specific trackers.

2. HIGH SIGNAL OVER ZERO-VALUE NOISE:
   - Prioritize reading high-level KPI cards and summary tables from structured summary tabs (e.g. dashboardSummaryTabs or role='summary'/'master_data') rather than arbitrary columns that evaluate to 0.
   - For Bar Charts: Ensure x_column (name/category) and y_column (numeric currency) are distinct and meaningful.
   - Set position properly on 4-column grid (col: 0-3, w: 1-4, h: 1-2). Stat cards: w=1, h=1 on row 0.
   - Use exact tab and column names from the sheet profile. Never invent a column.`,
      prompt: `Build DashboardConfig version 1 from this inferred SheetProfile and Client Context:\n${contextDesc}\n${JSON.stringify(compactProfile(profile))}`,
    })
    assertReferences(result.object, profile)
    return { profile, config: result.object, source: 'gemini' }
  } catch (error: unknown) {
    console.warn('[dashboard-intelligence] Gemini proposal rejected; using deterministic fallback', error)
    const config: DashboardConfig = { version: 1, widgets: deterministicWidgets(profile, context) }
    assertReferences(config, profile)
    return { profile, config, source: 'deterministic-fallback' }
  }
}

