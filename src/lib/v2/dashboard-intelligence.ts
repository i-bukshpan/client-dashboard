import 'server-only'

import { google } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { buildSheetProfile } from '@/lib/v2/sheet-profiler'
import { dashboardConfigSchema } from '@/lib/v2/dashboard-schema'
import type { DashboardConfig, DashboardWidget } from '@/types/dashboard'
import type { SheetProfile, SheetTabProfile } from '@/types/sheet-profile'

function deterministicWidgets(profile: SheetProfile): DashboardWidget[] {
  const widgets: DashboardWidget[] = []
  let row = 0
  for (const tab of profile.tabs.filter((item) => item.columns.length > 0)) {
    const date = tab.columns.find((column) => column.semanticType === 'date' || column.semanticType === 'datetime')
    const measure = tab.columns.find((column) => column.semanticType === 'currency')
      ?? tab.columns.find((column) => column.semanticType === 'number')
    const category = tab.columns.find((column) => column.semanticType === 'category')
      ?? tab.columns.find((column) => column.semanticType === 'text' && column.uniqueRatio < 0.6)

    if (measure) {
      widgets.push({ id: `stat-${tab.title}`, type: 'stat_card', title: `סה״כ ${tab.title}`, sheet: tab.title, position: { col: 0, row, w: 1, h: 1 }, aggregation: 'sum', value_column: measure.name, prefix: measure.currency === 'ILS' ? '₪' : undefined, card_color: 'blue' })
    }
    if (date && measure) {
      widgets.push({ id: `timeline-${tab.title}`, type: 'line_chart', title: `${tab.title} לאורך זמן`, sheet: tab.title, position: { col: 1, row, w: 2, h: 2 }, x_column: date.name, y_column: measure.name, date_column: date.name })
    }
    if (category && measure) {
      widgets.push({ id: `distribution-${tab.title}`, type: 'pie_chart', title: `התפלגות ${tab.title}`, sheet: tab.title, position: { col: 3, row, w: 1, h: 2 }, label_column: category.name, value_column: measure.name })
    }
    widgets.push({ id: `table-${tab.title}`, type: 'data_table', title: `פירוט ${tab.title}`, sheet: tab.title, position: { col: 0, row: row + 2, w: 4, h: 2 }, columns: tab.columns.slice(0, 8).map((column) => column.name), max_rows: 20, sort_by: date?.name, sort_order: date ? 'desc' : undefined })
    row += 4
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

export async function proposeDashboardFromSheet(spreadsheetId: string): Promise<{
  profile: SheetProfile
  config: DashboardConfig
  source: 'gemini' | 'deterministic-fallback'
}> {
  const profile = await buildSheetProfile(spreadsheetId)
  try {
    const result = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: dashboardConfigSchema,
      system: 'You design trustworthy Hebrew RTL financial dashboards. Use only supplied tabs and columns. Never invent a field. Prefer a small useful dashboard over low-confidence widgets.',
      prompt: `Build DashboardConfig version 1 from this inferred SheetProfile. Use Hebrew titles. Include source tab names exactly. Respect semantic types. If confidence is low, omit the widget.\n${JSON.stringify(compactProfile(profile))}`,
    })
    assertReferences(result.object, profile)
    return { profile, config: result.object, source: 'gemini' }
  } catch (error: unknown) {
    console.warn('[dashboard-intelligence] Gemini proposal rejected; using deterministic fallback', error)
    const config: DashboardConfig = { version: 1, widgets: deterministicWidgets(profile) }
    assertReferences(config, profile)
    return { profile, config, source: 'deterministic-fallback' }
  }
}
