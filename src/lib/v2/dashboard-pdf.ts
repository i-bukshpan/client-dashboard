import 'server-only'

import { readFile } from 'fs/promises'
import path from 'path'
import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import type { DashboardSnapshot } from '@/types/dashboard-snapshot'
import type { DashboardWidget } from '@/types/dashboard'

const PAGE_WIDTH = 842
const PAGE_HEIGHT = 595
const MARGIN = 36

function numberValue(value: unknown): number {
  const cleaned = String(value ?? '').replace(/[^0-9.-]+/g, '')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Robust RTL shaping for Hebrew strings with numbers, English, symbols and parentheses.
 */
function rtl(text: string): string {
  if (!text) return ''
  if (!/[\u0590-\u05FF]/.test(text)) return text

  // 1. Swap parentheses and brackets for correct visual rendering in RTL
  const swapped = text
    .replace(/\(/g, '___OPEN___')
    .replace(/\)/g, '(')
    .replace(/___OPEN___/g, ')')
    .replace(/\[/g, '___OB___')
    .replace(/\]/g, '[')
    .replace(/___OB___/g, ']')

  // 2. Tokenize by Hebrew words, LTR sequences (numbers, English, currency, dates), and spaces/punctuation
  const tokens = swapped.match(
    /[\u0590-\u05FF]+|[0-9.,₪$€%+-]+|[a-zA-Z0-9_-]+|\s+|[^\u0590-\u05FFa-zA-Z0-9\s]+/g
  ) || [swapped]

  // 3. Reverse tokens order for visual line layout
  const reversedTokens = [...tokens].reverse().map((token) => {
    // Reverse individual Hebrew characters
    if (/[\u0590-\u05FF]/.test(token)) {
      return [...token].reverse().join('')
    }
    // Numbers, English, currency, and symbols maintain their natural LTR reading order
    return token
  })

  return reversedTokens.join('')
}

function fit(font: PDFFont, text: string, size: number, maxWidth: number): string {
  let raw = String(text ?? '').trim()
  if (!raw) return ''
  while (raw.length > 3 && font.widthOfTextAtSize(rtl(raw), size) > maxWidth) {
    raw = `${raw.slice(0, -4)}...`
  }
  return rtl(raw)
}

function statValue(widget: DashboardWidget, rows: Record<string, string>[]): string {
  // Check if multiple columns are summed
  const columnsToSum = widget.value_columns && widget.value_columns.length > 0
    ? widget.value_columns
    : widget.value_column
    ? [widget.value_column]
    : widget.y_column
    ? [widget.y_column]
    : []

  if (widget.aggregation === 'count' || columnsToSum.length === 0) {
    return `${widget.prefix ?? ''}${rows.length.toLocaleString('he-IL')}${widget.suffix ?? ''}`
  }

  let totalSum = 0
  for (const col of columnsToSum) {
    const colValues = rows.map((r) => numberValue(r[col]))
    totalSum += colValues.reduce((sum, item) => sum + item, 0)
  }

  const finalValue =
    widget.aggregation === 'avg'
      ? totalSum / Math.max(rows.length, 1)
      : totalSum

  const formattedNum = Math.round(finalValue).toLocaleString('he-IL')
  return `${widget.prefix ?? '₪'}${formattedNum}${widget.suffix ?? ''}`
}

function addPage(document: PDFDocument, font: PDFFont, snapshot: DashboardSnapshot, pageNumber: number): PDFPage {
  const page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT])

  // Page background: Clean Executive Light
  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    color: rgb(0.97, 0.98, 1),
  })

  // Header Banner Bar
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 60,
    width: PAGE_WIDTH,
    height: 60,
    color: rgb(0.08, 0.1, 0.18),
  })

  // App Logo/Badge
  const logoText = 'Nehemiah OS v2 · Executive Dashboard Report'
  page.drawText(logoText, {
    x: MARGIN,
    y: PAGE_HEIGHT - 36,
    size: 9,
    font,
    color: rgb(0.6, 0.7, 0.95),
  })

  // Snapshot Title (Right Aligned in Hebrew)
  const titleRtl = fit(font, snapshot.title, 16, 500)
  const titleWidth = font.widthOfTextAtSize(titleRtl, 16)
  page.drawText(titleRtl, {
    x: PAGE_WIDTH - MARGIN - titleWidth,
    y: PAGE_HEIGHT - 38,
    size: 16,
    font,
    color: rgb(1, 1, 1),
  })

  // Footer Date and Page Number
  const dateStr = new Date(snapshot.generatedAt).toLocaleDateString('he-IL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const dateRtl = rtl(`הופק בתאריך: ${dateStr}`)
  const dateWidth = font.widthOfTextAtSize(dateRtl, 8)

  page.drawText(dateRtl, {
    x: PAGE_WIDTH - MARGIN - dateWidth,
    y: 16,
    size: 8,
    font,
    color: rgb(0.45, 0.48, 0.58),
  })

  page.drawText(`עמוד ${pageNumber}`, {
    x: MARGIN,
    y: 16,
    size: 8,
    font,
    color: rgb(0.45, 0.48, 0.58),
  })

  return page
}

function drawWidget(
  page: PDFPage,
  font: PDFFont,
  widget: DashboardWidget,
  snapshot: DashboardSnapshot,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const rows = snapshot.data[widget.sheet] ?? []

  // Card background with rounded look and subtle border
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.85, 0.88, 0.93),
    borderWidth: 1,
  })

  // Card Header: Right-Aligned Title
  const titleRtl = fit(font, widget.title, 11, width - 110)
  const titleWidth = font.widthOfTextAtSize(titleRtl, 11)
  page.drawText(titleRtl, {
    x: x + width - 12 - titleWidth,
    y: y + height - 20,
    size: 11,
    font,
    color: rgb(0.09, 0.12, 0.2),
  })

  // Sheet source badge on Left
  const sheetRtl = fit(font, `גיליון: ${widget.sheet}`, 8, 90)
  page.drawText(sheetRtl, {
    x: x + 12,
    y: y + height - 19,
    size: 8,
    font,
    color: rgb(0.55, 0.58, 0.68),
  })

  // Divider line under title
  page.drawLine({
    start: { x: x + 10, y: y + height - 26 },
    end: { x: x + width - 10, y: y + height - 26 },
    color: rgb(0.92, 0.94, 0.97),
    thickness: 0.8,
  })

  // 1. STAT CARD WIDGET
  if (widget.type === 'stat_card') {
    const valText = statValue(widget, rows)
    const valRtl = fit(font, valText, 22, width - 24)
    const valWidth = font.widthOfTextAtSize(valRtl, 22)

    page.drawText(valRtl, {
      x: x + width - 12 - valWidth,
      y: y + 26,
      size: 22,
      font,
      color: rgb(0.3, 0.25, 0.85),
    })

    const countRtl = rtl(`${rows.length} שורות נתונים`)
    page.drawText(countRtl, {
      x: x + 12,
      y: y + 14,
      size: 8,
      font,
      color: rgb(0.55, 0.58, 0.68),
    })
    return
  }

  // 2. DATA TABLE WIDGET
  if (widget.type === 'data_table') {
    const columns = (widget.columns?.length ? widget.columns : Object.keys(rows[0] ?? {})).slice(0, 4)
    const colCount = Math.max(columns.length, 1)
    const colWidth = (width - 20) / colCount
    const rowHeight = 15

    // Table Header Row Background
    page.drawRectangle({
      x: x + 10,
      y: y + height - 44,
      width: width - 20,
      height: 16,
      color: rgb(0.95, 0.96, 0.98),
    })

    // Column Headers (RTL ordering from Right to Left)
    columns.forEach((col, index) => {
      const colRtl = fit(font, col, 8, colWidth - 6)
      const colX = x + width - 10 - (index + 1) * colWidth + 4
      page.drawText(colRtl, {
        x: colX,
        y: y + height - 40,
        size: 8,
        font,
        color: rgb(0.2, 0.24, 0.35),
      })
    })

    // Rows
    const maxRowsToDraw = Math.min(rows.length, Math.floor((height - 52) / rowHeight))
    for (let rIdx = 0; rIdx < maxRowsToDraw; rIdx++) {
      const row = rows[rIdx]
      const rowY = y + height - 58 - rIdx * rowHeight

      if (rIdx % 2 === 1) {
        page.drawRectangle({
          x: x + 10,
          y: rowY - 2,
          width: width - 20,
          height: rowHeight,
          color: rgb(0.98, 0.985, 0.995),
        })
      }

      columns.forEach((col, cIdx) => {
        const cellText = String(row[col] ?? '')
        const cellRtl = fit(font, cellText, 7.5, colWidth - 6)
        const cellX = x + width - 10 - (cIdx + 1) * colWidth + 4
        page.drawText(cellRtl, {
          x: cellX,
          y: rowY + 2,
          size: 7.5,
          font,
          color: rgb(0.25, 0.28, 0.38),
        })
      })
    }
    return
  }

  // 3. BAR / LINE / PIE CHART WIDGET
  const labelCol = widget.label_column ?? widget.x_column ?? ''
  const valCol = widget.value_column ?? widget.y_column ?? ''
  const items = rows.slice(0, 6).map((row) => ({
    label: String(row[labelCol] ?? ''),
    value: numberValue(row[valCol]),
  }))

  const maxVal = Math.max(...items.map((item) => Math.abs(item.value)), 1)
  const chartHeight = height - 38
  const barSlot = chartHeight / Math.max(items.length, 1)

  items.forEach((item, index) => {
    const barY = y + height - 42 - index * barSlot
    const labelRtl = fit(font, item.label || `פריט ${index + 1}`, 8, 90)
    const labelWidth = font.widthOfTextAtSize(labelRtl, 8)

    // Label on the RIGHT side
    page.drawText(labelRtl, {
      x: x + width - 12 - labelWidth,
      y: barY + 2,
      size: 8,
      font,
      color: rgb(0.2, 0.24, 0.35),
    })

    // Value on the LEFT side
    const valStr = `₪${Math.round(item.value).toLocaleString('he-IL')}`
    page.drawText(valStr, {
      x: x + 12,
      y: barY + 2,
      size: 7.5,
      font,
      color: rgb(0.45, 0.48, 0.58),
    })

    // Bar in the MIDDLE (RTL: expands from right towards left)
    const availableBarWidth = width - 190
    const barWidth = Math.max((Math.abs(item.value) / maxVal) * availableBarWidth, 4)
    const barRight = x + width - 105

    // Bar background track
    page.drawRectangle({
      x: barRight - availableBarWidth,
      y: barY + 1,
      width: availableBarWidth,
      height: 7,
      color: rgb(0.93, 0.94, 0.97),
    })

    // Active Bar
    page.drawRectangle({
      x: barRight - barWidth,
      y: barY + 1,
      width: barWidth,
      height: 7,
      color: rgb(0.35, 0.3, 0.88),
    })
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
    if (slot >= 6) {
      pageNumber += 1
      page = addPage(document, font, snapshot, pageNumber)
      slot = 0
    }

    const col = slot % 2
    const row = Math.floor(slot / 2)

    // 2-column grid layout per page
    const cardWidth = (PAGE_WIDTH - MARGIN * 2 - 20) / 2
    const cardHeight = 145
    const cardX = MARGIN + col * (cardWidth + 20)
    const cardY = PAGE_HEIGHT - 80 - (row + 1) * cardHeight - row * 15

    drawWidget(page, font, widget, snapshot, cardX, cardY, cardWidth, cardHeight)
    slot += 1
  }

  return Buffer.from(await document.save())
}
