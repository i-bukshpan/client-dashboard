import 'server-only'

import { randomUUID } from 'crypto'
import { google } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { addSheetTab, appendRows, formatRange, getSheetData, getSheetRows, getSpreadsheetMeta, updateRange } from '@/lib/google-sheets'
import { getClientFiles, uploadFileToDrive } from '@/lib/google-drive'
import { getClientWorkspaceSettings } from '@/lib/v2/client-settings'
import { listWorkspaceCalendarEvents } from '@/lib/v2/google-calendar'
import { briefResolutionSchema, monthlyBriefResultSchema, reportMonthSchema } from '@/lib/v2/monthly-brief-schema'
import { buildSheetProfile } from '@/lib/v2/sheet-profiler'
import { listWorkspaceTasks } from '@/lib/v2/workspace-tasks'
import { getWorkspaceClient, requireWorkspaceAdmin } from '@/lib/v2/workspace-dal'
import type { MonthlyBriefEvidence, MonthlyBriefMissingInformation, MonthlyBriefRecord, MonthlyBriefResult } from '@/types/monthly-brief'

const BRIEFS_TAB = 'בריפים חודשיים'
const BRIEF_HEADERS = ['מזהה', 'חודש', 'מצב', 'סטטוס נוכחי', 'בוצע החודש', 'פעולות ממתינות', 'מידע חסר', 'תשובות נחמיה', 'סיכום ראיות', 'מזהה Snapshot', 'מזהה מסמך', 'נוצר בתאריך', 'עודכן בתאריך']
const MAX_TABS = 12
const MAX_ROWS_PER_TAB = 50
const MAX_TOTAL_ROWS = 400

function monthPeriod(reportMonth: string) {
  reportMonthSchema.parse(reportMonth)
  const [year, month] = reportMonth.split('-').map(Number)
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 1)
  return { start: start.toISOString(), end: end.toISOString() }
}

function parseDate(value: string): Date | null {
  const direct = new Date(value)
  if (!Number.isNaN(direct.getTime())) return direct
  const local = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})/.exec(value)
  if (!local) return null
  const parsed = new Date(Number(local[3]), Number(local[2]) - 1, Number(local[1]))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function within(value: string | null, period: { start: string; end: string }): boolean {
  if (!value) return false
  const date = parseDate(value)
  return Boolean(date && date >= new Date(period.start) && date < new Date(period.end))
}

function rawRows(raw: string[][]): Record<string, string>[] {
  if (raw.length < 2) return []
  const headers = raw[0].map((value) => value.trim())
  return raw.slice(1).filter((row) => row.some(Boolean)).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? '']).filter(([header]) => header)))
}

function issue(id: string, description: string, question: string, options: string[]): MonthlyBriefMissingInformation { return { id, description, question, options } }

export async function assembleMonthlyBriefEvidence(clientId: string, reportMonth: string): Promise<MonthlyBriefEvidence> {
  await requireWorkspaceAdmin()
  const client = await getWorkspaceClient(clientId)
  const period = monthPeriod(reportMonth)
  const settings = await getClientWorkspaceSettings(clientId)
  const deterministicIssues: MonthlyBriefMissingInformation[] = []
  const sheetRows: Record<string, Record<string, string>[]> = {}
  let totalRows = 0

  if (!client.google_sheet_id) {
    deterministicIssues.push(issue('missing_client_sheet', 'לא מוגדר גיליון לקוח', 'לא מצאתי גיליון נתונים ללקוח. האם להפיק בריף ללא נתוני הגיליון, או להגדיר גיליון קודם?', ['להפיק ללא גיליון', 'להגדיר גיליון קודם']))
  } else {
    const profile = await buildSheetProfile(client.google_sheet_id)
    let tabsWithoutDates = 0
    for (const tab of profile.tabs.filter((item) => item.title !== BRIEFS_TAB).slice(0, MAX_TABS)) {
      if (totalRows >= MAX_TOTAL_ROWS) break
      const raw = await getSheetData(client.google_sheet_id, formatRange(tab.title, 'A1:ZZ301'))
      const rows = rawRows(raw)
      const dateColumns = tab.columns.filter((column) => column.semanticType === 'date' || column.semanticType === 'datetime').map((column) => column.name)
      const relevant = dateColumns.length
        ? rows.filter((row) => dateColumns.some((column) => within(row[column], period)))
        : rows.slice(0, 10)
      if (!dateColumns.length && rows.length) tabsWithoutDates += 1
      const bounded = relevant.slice(0, Math.min(MAX_ROWS_PER_TAB, MAX_TOTAL_ROWS - totalRows))
      if (bounded.length) sheetRows[tab.title] = bounded
      totalRows += bounded.length
    }
    if (!totalRows) deterministicIssues.push(issue('no_month_sheet_rows', `לא נמצאו בגיליון שורות מתוארכות לחודש ${reportMonth}`, `לא מצאתי תנועות או רשומות מתוארכות עבור ${reportMonth}. האם החודש היה ללא פעילות, או שחסרים נתונים?`, ['החודש היה ללא פעילות', 'חסרים נתונים ואעדכן', 'להפיק לפי המידע הקיים']))
    if (tabsWithoutDates > 0 && !totalRows) deterministicIssues.push(issue('ambiguous_sheet_dates', 'קיימות לשוניות ללא עמודת תאריך מזוהה', 'מצאתי נתונים ללא עמודת תאריך ברורה. האם לכלול אותם כבריף החודש או להתעלם מהם?', ['לכלול', 'להתעלם', 'אעדכן עמודת תאריך']))
  }

  const [allTasks, calendarResult, driveFiles] = await Promise.all([
    listWorkspaceTasks(clientId),
    listWorkspaceCalendarEvents({ timeMin: period.start, timeMax: period.end, clientId }),
    client.drive_folder_id ? getClientFiles(client.drive_folder_id) : Promise.resolve([]),
  ])
  const tasks = allTasks.filter((task) => within(task.createdAt, period) || within(task.completedAt, period) || (task.status !== 'completed' && (!task.dueAt || new Date(task.dueAt) < new Date(period.end)))).slice(0, 100).map((task) => ({ id: task.id, title: task.title, status: task.status, priority: task.priority, dueAt: task.dueAt, completedAt: task.completedAt, reminderState: task.reminderState }))
  const calendarEvents = calendarResult.events.slice(0, 100).map((event) => ({ id: event.id, title: event.title, start: event.start, end: event.end, status: event.status }))
  const relevantDriveFiles = driveFiles.filter((file) => within(file.modifiedTime, period) || /מע["״]?מ|vat|דוח|report|invoice|חשבונית/i.test(file.name)).slice(0, 100).map((file) => ({ name: file.name, type: file.mimeType, modifiedAt: file.modifiedTime }))

  if (!tasks.length && !calendarEvents.length && !totalRows) deterministicIssues.push(issue('no_month_activity', 'לא נמצאה פעילות חודשית באף מקור', 'לא מצאתי פעילות בגיליון, במשימות או ביומן. האם זהו חודש ללא פעילות?', ['כן, ללא פעילות', 'לא, חסר מידע', 'להפיק בריף ריק']))
  if (!client.drive_folder_id) deterministicIssues.push(issue('missing_drive_folder', 'לא מוגדרת תיקיית Drive ללקוח', 'לא יכולתי לבדוק מסמכים משום שאין תיקיית Drive. האם להפיק את הבריף ללא מסמכים?', ['להפיק ללא מסמכים', 'להגדיר תיקייה קודם']))
  if (settings.alerts.missingDocuments && totalRows > 0 && !driveFiles.some((file) => /מע["״]?מ|vat/i.test(file.name))) deterministicIssues.push(issue('missing_vat_report', `לא נמצא דוח מע״מ עבור ${reportMonth}`, `מצאתי פעילות כספית עבור ${reportMonth}, אך לא מצאתי דוח מע״מ. האם להשמיט אותו או שתרצה להעלות אותו?`, ['להשמיט מהבריף', 'אעלה את הדוח', 'הדוח אינו נדרש']))

  return { version: 1, clientId, clientName: client.name, reportMonth, period, sheetRows, tasks, calendarEvents, driveFiles: relevantDriveFiles, deterministicIssues: deterministicIssues.slice(0, 10), bounds: { sheetTabs: Object.keys(sheetRows).length, sheetRows: totalRows, tasks: tasks.length, calendarEvents: calendarEvents.length, driveFiles: relevantDriveFiles.length } }
}

function briefFromRow(clientId: string, clientName: string, row: Record<string, string>): MonthlyBriefRecord {
  return {
    id: row['מזהה'], clientId, clientName, reportMonth: row['חודש'], state: row['מצב'] as MonthlyBriefRecord['state'], currentStatus: row['סטטוס נוכחי'],
    completedThisMonth: JSON.parse(row['בוצע החודש'] || '[]'), pendingActions: JSON.parse(row['פעולות ממתינות'] || '[]'), missingInformation: JSON.parse(row['מידע חסר'] || '[]'), resolutions: JSON.parse(row['תשובות נחמיה'] || '[]'), evidenceSummary: JSON.parse(row['סיכום ראיות'] || '{}'),
    snapshotFileId: row['מזהה Snapshot'] || null, documentFileId: row['מזהה מסמך'] || null, generatedAt: row['נוצר בתאריך'], updatedAt: row['עודכן בתאריך'],
  }
}

function briefValues(brief: MonthlyBriefRecord): string[] {
  return [brief.id, brief.reportMonth, brief.state, brief.currentStatus, JSON.stringify(brief.completedThisMonth), JSON.stringify(brief.pendingActions), JSON.stringify(brief.missingInformation), JSON.stringify(brief.resolutions), JSON.stringify(brief.evidenceSummary), brief.snapshotFileId ?? '', brief.documentFileId ?? '', brief.generatedAt, brief.updatedAt]
}

async function ensureBriefTab(spreadsheetId: string): Promise<void> {
  const tabs = await getSpreadsheetMeta(spreadsheetId)
  if (!tabs.some((tab) => tab.title === BRIEFS_TAB)) await addSheetTab(spreadsheetId, { title: BRIEFS_TAB, headers: BRIEF_HEADERS })
}

export async function listMonthlyBriefs(clientId: string): Promise<MonthlyBriefRecord[]> {
  const client = await getWorkspaceClient(clientId)
  if (!client.google_sheet_id) return []
  const tabs = await getSpreadsheetMeta(client.google_sheet_id)
  if (!tabs.some((tab) => tab.title === BRIEFS_TAB)) return []
  return (await getSheetRows(client.google_sheet_id, BRIEFS_TAB)).map((row) => briefFromRow(client.id, client.name, row)).sort((a, b) => b.reportMonth.localeCompare(a.reportMonth))
}

async function saveBrief(brief: MonthlyBriefRecord): Promise<MonthlyBriefRecord> {
  const client = await getWorkspaceClient(brief.clientId)
  if (!client.google_sheet_id) throw new Error('לא מוגדר גיליון ללקוח')
  await ensureBriefTab(client.google_sheet_id)
  const rows = await getSheetRows(client.google_sheet_id, BRIEFS_TAB)
  const index = rows.findIndex((row) => row['מזהה'] === brief.id)
  if (index < 0) await appendRows(client.google_sheet_id, BRIEFS_TAB, [briefValues(brief)])
  else await updateRange(client.google_sheet_id, formatRange(BRIEFS_TAB, `A${index + 2}`), [briefValues(brief)])
  return brief
}

export async function generateMonthlyBrief(clientId: string, reportMonth: string, previous?: MonthlyBriefRecord): Promise<MonthlyBriefRecord> {
  const evidence = await assembleMonthlyBriefEvidence(clientId, reportMonth)
  const resolvedIds = new Set((previous?.resolutions ?? []).filter((resolution) => resolution.decision !== 'will_provide').map((resolution) => resolution.issueId))
  const unresolvedDeterministic = evidence.deterministicIssues.filter((item) => !resolvedIds.has(item.id))
  const evidenceForAi = { ...evidence, deterministicIssues: unresolvedDeterministic }
  const result = await generateObject({
    model: google('gemini-2.5-flash'), schema: monthlyBriefResultSchema,
    system: 'אתה יוצר בריף חודשי אמין בעברית מתוך ראיות מוגבלות. אסור להמציא עובדות. הפלט חייב להיות תמציתי. כל עמימות לא פתורה חייבת להופיע ב-missingInformation כשאלה מפורשת עם 2–3 אפשרויות פעולה.',
    prompt: `צור בריף לחודש ${reportMonth}. בדיקות דטרמיניסטיות לא פתורות חייבות להישאר ב-missingInformation עם אותו id. תשובות נחמיה שכבר התקבלו הן ראיות מחייבות.\nבדיקות:${JSON.stringify(unresolvedDeterministic)}\nתשובות:${JSON.stringify(previous?.resolutions ?? [])}\nראיות:${JSON.stringify(evidenceForAi)}`,
  })
  const byId = new Map(result.object.missingInformation.map((item) => [item.id, item]))
  for (const deterministic of unresolvedDeterministic) if (!byId.has(deterministic.id)) byId.set(deterministic.id, deterministic)
  const output: MonthlyBriefResult = { ...result.object, missingInformation: [...byId.values()].slice(0, 10) }
  const now = new Date().toISOString()
  return saveBrief({ id: previous?.id ?? `brief_${randomUUID()}`, clientId, clientName: evidence.clientName, reportMonth, state: output.missingInformation.length ? 'needs_input' : 'draft', ...output, resolutions: previous?.resolutions ?? [], evidenceSummary: evidence.bounds, snapshotFileId: null, documentFileId: null, generatedAt: previous?.generatedAt ?? now, updatedAt: now })
}

export async function getLatestNeedsInputBrief(clientId: string): Promise<MonthlyBriefRecord | null> {
  return (await listMonthlyBriefs(clientId)).find((brief) => brief.state === 'needs_input') ?? null
}

export async function resolveMonthlyBriefFromChat(clientId: string, answer: string): Promise<{ handled: boolean; brief: MonthlyBriefRecord | null }> {
  const pending = await getLatestNeedsInputBrief(clientId)
  if (!pending) return { handled: false, brief: null }
  const classification = await generateObject({
    model: google('gemini-2.5-flash'), schema: briefResolutionSchema,
    system: 'סווג האם הודעת נחמיה עונה על אחת משאלות הבריף. אל תסמן answersBrief עבור שאלה כללית או נושא אחר. decision=omit כאשר ביקש להשמיט; clarified כאשר סיפק עובדה משלימה; will_provide כאשר אמר שיעלה/יעדכן בעתיד.',
    prompt: `שאלות פתוחות:${JSON.stringify(pending.missingInformation)}\nהודעת נחמיה:${answer}`,
  })
  if (!classification.object.answersBrief || !classification.object.resolutions.length) return { handled: false, brief: pending }
  const answeredAt = new Date().toISOString()
  const incoming = classification.object.resolutions
    .filter((resolution) => pending.missingInformation.some((item) => item.id === resolution.issueId))
    .map((resolution) => ({ ...resolution, answeredAt }))
  if (!incoming.length) return { handled: false, brief: pending }
  const previous = { ...pending, resolutions: [...pending.resolutions.filter((old) => !incoming.some((item) => item.issueId === old.issueId)), ...incoming], updatedAt: answeredAt }
  await saveBrief(previous)
  return { handled: true, brief: await generateMonthlyBrief(clientId, pending.reportMonth, previous) }
}

export async function approveMonthlyBrief(clientId: string, briefId: string): Promise<MonthlyBriefRecord> {
  const client = await getWorkspaceClient(clientId)
  if (!client.drive_folder_id) throw new Error('לא מוגדרת תיקיית Drive ללקוח')
  const brief = (await listMonthlyBriefs(clientId)).find((item) => item.id === briefId)
  if (!brief) throw new Error('הבריף לא נמצא')
  if (brief.missingInformation.length) throw new Error('לא ניתן לאשר בריף עם מידע חסר')
  const markdown = `# בריף חודשי — ${brief.clientName}\n\nחודש: ${brief.reportMonth}\n\n## מצב נוכחי\n${brief.currentStatus}\n\n## מה בוצע החודש\n${brief.completedThisMonth.map((item) => `- ${item}`).join('\n') || '- אין פריטים'}\n\n## פעולות ממתינות\n${brief.pendingActions.map((item) => `- ${item}`).join('\n') || '- אין פריטים'}\n`
  const approved = { ...brief, state: 'approved' as const, updatedAt: new Date().toISOString() }
  const [snapshot, document] = await Promise.all([
    uploadFileToDrive(client.drive_folder_id, `monthly-brief-${brief.reportMonth}-${brief.id}.json`, 'application/json', Buffer.from(JSON.stringify(approved), 'utf8')),
    uploadFileToDrive(client.drive_folder_id, `בריף חודשי-${brief.reportMonth}.md`, 'text/markdown', Buffer.from(markdown, 'utf8')),
  ])
  return saveBrief({ ...approved, snapshotFileId: snapshot.id, documentFileId: document.id })
}
