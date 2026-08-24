import 'server-only'

import { readFile } from 'fs/promises'
import path from 'path'
import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import type { DashboardSnapshot } from '@/types/dashboard-snapshot'
import type { DashboardWidget } from '@/types/dashboard'

const PAGE_WIDTH = 842
const PAGE_HEIGHT = 595
const MARGIN = 42

function numberValue(value: unknown): number {
  const cleaned = String(value ?? '').replace(/[^0-9.-]+/g, '')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

function rtl(value: string): string {
  if (!/[\u0590-\u05FF]/.test(value)) return value
  return (value.match(/[\u0590-\u05FF]+|[^\u0590-\u05FF]+/g) ?? [value])
    .reverse()
    .map((part) => /[\u0590-\u05FF]/.test(part) ? [...part].reverse().join('') : part)
    .join('')
}

function fit(font: PDFFont, text: string, size: number, width: number): string {
  let result = text
  while (result.length > 3 && font.widthOfTextAtSize(rtl(result), size) > width) result = `${result.slice(0, -4)}...`
  return rtl(result)
}

function statValue(widget: DashboardWidget, rows: Record<string, string>[]): string {
  const column = widget.value_column ?? widget.y_column
  if (widget.aggregation === 'count' || !column) return String(rows.length)
  const values = rows.map((row) => numberValue(row[column]))
  const value = widget.aggregation === 'avg'
    ? values.reduce((sum, item) => sum + item, 0) / Math.max(values.length, 1)
    : values.reduce((sum, item) => sum + item, 0)
  return `${widget.prefix ?? ''}${Math.round(value).toLocaleString('he-IL')}${widget.suffix ?? ''}`
}

function addPage(document: PDFDocument, font: PDFFont, snapshot: DashboardSnapshot, pageNumber: number) {
  const page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: rgb(0.035, 0.047, 0.075) })
  page.drawText(fit(font, snapshot.title, 19, 500), { x: PAGE_WIDTH - MARGIN - 500, y: PAGE_HEIGHT - 38, size: 19, font, color: rgb(0.94, 0.95, 1) })
  page.drawText(`${pageNumber}`, { x: MARGIN, y: 22, size: 9, font, color: rgb(0.55, 0.58, 0.68) })
  page.drawText(new Date(snapshot.generatedAt).toLocaleDateString('he-IL'), { x: PAGE_WIDTH - 130, y: 22, size: 9, font, color: rgb(0.55, 0.58, 0.68) })
  return page
}

function drawWidget(page: PDFPage, font: PDFFont, widget: DashboardWidget, snapshot: DashboardSnapshot, x: number, y: number, width: number, height: number) {
  const rows = snapshot.data[widget.sheet] ?? []
  page.drawRectangle({ x, y, width, height, color: rgb(0.075, 0.09, 0.135), borderColor: rgb(0.18, 0.2, 0.29), borderWidth: 1 })
  page.drawText(fit(font, widget.title, 12, width - 20), { x: x + 10, y: y + height - 20, size: 12, font, color: rgb(0.88, 0.89, 0.96) })
  if (widget.type === 'stat_card') {
    page.drawText(fit(font, statValue(widget, rows), 22, width - 20), { x: x + 10, y: y + 24, size: 22, font, color: rgb(0.39, 0.55, 1) })
    return
  }
  if (widget.type === 'data_table') {
    const columns = (widget.columns?.length ? widget.columns : Object.keys(rows[0] ?? {})).slice(0, 5)
    const rowHeight = 16
    columns.forEach((column, index) => page.drawText(fit(font, column, 8, width / columns.length - 8), { x: x + 8 + index * (width / columns.length), y: y + height - 38, size: 8, font, color: rgb(0.58, 0.65, 0.82) }))
    rows.slice(0, Math.max(1, Math.floor((height - 48) / rowHeight))).forEach((row, rowIndex) => columns.forEach((column, columnIndex) => page.drawText(fit(font, row[column] ?? '', 7, width / columns.length - 8), { x: x + 8 + columnIndex * (width / columns.length), y: y + height - 54 - rowIndex * rowHeight, size: 7, font, color: rgb(0.78, 0.8, 0.87) })))
    return
  }
  const valueColumn = widget.y_column ?? widget.value_column
  const labelColumn = widget.x_column ?? widget.label_column
  const items = rows.slice(0, 8).map((row) => ({ label: row[labelColumn ?? ''] ?? '', value: numberValue(row[valueColumn ?? '']) }))
  const max = Math.max(...items.map((item) => Math.abs(item.value)), 1)
  items.forEach((item, index) => {
    const barWidth = (Math.abs(item.value) / max) * (width - 120)
    const barY = y + height - 48 - index * 17
    page.drawText(fit(font, item.label, 7, 85), { x: x + 8, y: barY, size: 7, font, color: rgb(0.75, 0.78, 0.86) })
    page.drawRectangle({ x: x + 100, y: barY - 1, width: barWidth, height: 8, color: rgb(0.35, 0.43, 0.92) })
  })
}

export async function renderDashboardPdf(snapshot: DashboardSnapshot): Promise<Buffer> {
  const document = await PDFDocument.create()
  document.registerFontkit(fontkit)
  const fontPath = path.join(process.cwd(), 'node_modules', 'dejavu-fonts-ttf', 'ttf', 'DejaVuSans.ttf')
  const font = await document.embedFont(await readFile(fontPath), { subset: true })
  let page = addPage(document, font, snapshot, 1)
  let pageNumber = 1
  let slot = 0
  for (const widget of snapshot.config.widgets) {
    if (slot >= 6) { pageNumber += 1; page = addPage(document, font, snapshot, pageNumber); slot = 0 }
    const col = slot % 2
    const row = Math.floor(slot / 2)
    drawWidget(page, font, widget, snapshot, MARGIN + col * 382, PAGE_HEIGHT - 235 - row * 155, 360, 135)
    slot += 1
  }
  return Buffer.from(await document.save())
}
