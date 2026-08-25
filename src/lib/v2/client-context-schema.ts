import { z } from 'zod'

export const clientStakeholderSchema = z.object({
  name: z.string().trim().min(1).max(200),
  role: z.string().trim().min(1).max(200),
  notes: z.string().max(500).optional(),
})

export const sheetMappingSchema = z.object({
  /** Raw movements tabs (e.g. תנועות פרויקטים, תנועות חברה) */
  rawMovementsTabs: z.array(z.string().trim()).default([]).describe('לשוניות של תנועות גולמיות (הכנסות והוצאות)'),
  /** Pre-calculated dashboard and summary tabs (e.g. לוח כללי, לוח פרויקטים) */
  dashboardSummaryTabs: z.array(z.string().trim()).default([]).describe('לשוניות של סיכומים ולוחות מחושבים קיימים (כגון לוח כללי)'),
  /** Dedicated tracking tabs (e.g. הלוואת בעלים, הוצאות קבועות) */
  trackingTabs: z.array(z.string().trim()).default([]).describe('לשוניות מעקב ייעודיות (כגון הלוואת בעלים, הוצאות קבועות)'),
  /** Ignored tabs to skip in automated calculations */
  ignoredTabs: z.array(z.string().trim()).default([]).describe('לשוניות להתעלמות בחישובים ודשבורדים'),
}).describe('מיפוי וסיווג לשוניות הגיליון')

export const clientContextSchema = z.object({
  version: z.number().default(1).describe('גרסת הסכמה, תמיד 1'),
  /** e.g. "real estate", "retail", "accounting", "consulting", "construction" */
  businessType: z.string().trim().min(1).max(200).describe('סוג העסק או התחום'),
  /** 2-3 sentence plain-Hebrew summary of what the business does */
  businessDescription: z.string().trim().min(1).max(1000).describe('תיאור תמציתי בעברית של פעילות העסק'),
  /** Key people: owners, partners, key employees */
  stakeholders: z.array(clientStakeholderSchema).max(20).describe('בעלי עניין, שותפים ובעלים'),
  /** What Nehemiah wants to achieve with this client */
  nehemiahGoals: z.array(z.string().trim().min(1).max(300)).max(20).describe('מטרות ומה נחמיה מבצע עבור הלקוח'),
  /** Current active work phases or projects (e.g. "Project A - execution") */
  activePhases: z.array(z.string().trim().min(1).max(300)).max(20).describe('שלבים ופרויקטים פעילים'),
  /** Key metrics Nehemiah wants to monitor (e.g. "cash flow", "VAT reports") */
  keyMetrics: z.array(z.string().trim().min(1).max(200)).max(20).describe('מדדים מרכזיים למעקב וניטור'),
  /** Explicit classification of spreadsheet tabs */
  sheetMapping: sheetMappingSchema.optional(),
  /** Any extra context or notes */
  notes: z.string().max(2000).optional().describe('הערות נוספות'),
  capturedAt: z.string().describe('תאריך ושעה ISO'),
})

export type SheetMapping = z.infer<typeof sheetMappingSchema>
export type ClientContext = z.infer<typeof clientContextSchema>
export type ClientStakeholder = z.infer<typeof clientStakeholderSchema>

