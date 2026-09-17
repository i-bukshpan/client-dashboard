import 'server-only'

import {
  getWorkspaceAdminDb,
  requireWorkspaceAdmin,
  parseWorkspaceClientId,
  type WorkspaceClientRecord,
} from '@/lib/v2/workspace-dal'

// ── Types ──────────────────────────────────────────────────────────────────────

export type NotebookSourceType =
  | 'sheet'
  | 'drive_folder'
  | 'gmail'
  | 'calendar'
  | 'document'
  | 'recording'
  | 'vault'

export type NotebookSourceStatus = 'connected' | 'syncing' | 'error' | 'not_configured'

export interface NotebookSource {
  id: string
  type: NotebookSourceType
  label: string
  status: NotebookSourceStatus
  lastSync?: string | null
  url?: string | null
  promptSuggestion?: string | null
  meta?: Record<string, unknown>
}

// ── Client Notebook Sources ────────────────────────────────────────────────────

/**
 * Aggregates all connected data sources for a specific client's notebook.
 * Returns a unified list with type, label, sync status, direct links, and prompt suggestions.
 */
export async function getClientNotebookSources(
  clientId: string
): Promise<{ client: WorkspaceClientRecord; sources: NotebookSource[] }> {
  await requireWorkspaceAdmin()
  const validId = parseWorkspaceClientId(clientId)
  const db = getWorkspaceAdminDb()

  // Fetch client record
  const { data: client, error: clientError } = await db
    .from('clients')
    .select('*')
    .eq('id', validId)
    .single()
  if (clientError || !client) {
    throw new Error(`לקוח לא נמצא: ${clientError?.message ?? validId}`)
  }

  // Parallel fetch all source data
  const [assetsResult, docsResult, vaultResult, recordingsResult] = await Promise.allSettled([
    db
      .from('v2_client_assets')
      .select('id, asset_type, asset_id, name, category, is_primary, updated_at')
      .eq('client_id', validId)
      .order('is_primary', { ascending: false }),
    db
      .from('v2_client_documents')
      .select('id, file_name, file_type, ocr_status, mime_type, created_at, updated_at')
      .eq('client_id', validId)
      .order('created_at', { ascending: false }),
    db
      .from('v2_client_vault_items')
      .select('id')
      .eq('client_id', validId),
    db
      .from('v3_client_recordings')
      .select('id, file_name, transcript_status, created_at')
      .eq('client_id', validId)
      .order('created_at', { ascending: false }),
  ])

  const assets = assetsResult.status === 'fulfilled' ? (assetsResult.value.data ?? []) : []
  const docs = docsResult.status === 'fulfilled' ? (docsResult.value.data ?? []) : []
  const vaultCount = vaultResult.status === 'fulfilled' ? (vaultResult.value.data?.length ?? 0) : 0
  const recordings = recordingsResult.status === 'fulfilled' ? (recordingsResult.value.data ?? []) : []

  const sources: NotebookSource[] = []

  // ── 1. Google Sheets ───────────────────────────────────────────────────────
  if (client.google_sheet_id) {
    sources.push({
      id: `sheet-primary-${client.id}`,
      type: 'sheet',
      label: 'גיליון ראשי',
      status: 'connected',
      url: `https://docs.google.com/spreadsheets/d/${client.google_sheet_id}`,
      promptSuggestion: `נתח לי את נתוני הגיליון הראשי של ${client.name} — הכנסות, הוצאות ותזרים.`,
      meta: { sheetId: client.google_sheet_id, isPrimary: true },
    })
  }
  // Additional sheet assets
  for (const asset of assets) {
    if (asset.asset_type === 'sheet' && asset.asset_id !== client.google_sheet_id) {
      sources.push({
        id: `sheet-${asset.id}`,
        type: 'sheet',
        label: asset.name,
        status: 'connected',
        lastSync: asset.updated_at,
        url: asset.asset_id ? `https://docs.google.com/spreadsheets/d/${asset.asset_id}` : null,
        promptSuggestion: `בדוק את הגיליון "${asset.name}" של ${client.name} וסכם את הנתונים העיקריים.`,
        meta: { sheetId: asset.asset_id, category: asset.category },
      })
    }
  }

  // ── 2. Google Drive ────────────────────────────────────────────────────────
  if (client.drive_folder_id) {
    sources.push({
      id: `drive-primary-${client.id}`,
      type: 'drive_folder',
      label: 'תיקיית Drive ראשית',
      status: 'connected',
      url: `https://drive.google.com/drive/folders/${client.drive_folder_id}`,
      promptSuggestion: `אילו קבצים ומסמכים קיימים בתיקיית ה-Drive של ${client.name}?`,
      meta: { folderId: client.drive_folder_id, isPrimary: true },
    })
  }
  for (const asset of assets) {
    if (asset.asset_type === 'drive_folder' && asset.asset_id !== client.drive_folder_id) {
      sources.push({
        id: `drive-${asset.id}`,
        type: 'drive_folder',
        label: asset.name,
        status: 'connected',
        lastSync: asset.updated_at,
        url: asset.asset_id ? `https://drive.google.com/drive/folders/${asset.asset_id}` : null,
        promptSuggestion: `מה קיים בתיקייה "${asset.name}" של ${client.name}?`,
        meta: { folderId: asset.asset_id, category: asset.category },
      })
    }
  }

  // ── 3. Gmail ───────────────────────────────────────────────────────────────
  sources.push({
    id: `gmail-${client.id}`,
    type: 'gmail',
    label: client.gmail_label
      ? `Gmail — ${client.gmail_label}`
      : client.email
        ? `Gmail — ${client.email}`
        : 'Gmail',
    status: client.gmail_label || client.email ? 'connected' : 'not_configured',
    url: client.email
      ? `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(client.email)}`
      : 'https://mail.google.com',
    promptSuggestion: `סרוק את המיילים האחרונים של ${client.name} וסכם מה דורש מענה או טיפול.`,
    meta: {
      gmailLabel: client.gmail_label,
      email: client.email,
    },
  })

  // ── 4. Calendar ────────────────────────────────────────────────────────────
  sources.push({
    id: `calendar-${client.id}`,
    type: 'calendar',
    label: 'יומן Google',
    status: 'connected',
    url: 'https://calendar.google.com',
    promptSuggestion: `מה הפגישות הקרובות שנקבעו ביומן עבור ${client.name}?`,
  })

  // ── 5. Documents ───────────────────────────────────────────────────────────
  if (docs.length > 0) {
    const doneCount = docs.filter((d: any) => d.ocr_status === 'done').length
    const pendingCount = docs.filter((d: any) => d.ocr_status === 'pending' || d.ocr_status === 'processing').length
    sources.push({
      id: `documents-${client.id}`,
      type: 'document',
      label: `מסמכים (${docs.length})`,
      status: pendingCount > 0 ? 'syncing' : 'connected',
      lastSync: docs[0]?.updated_at ?? docs[0]?.created_at,
      promptSuggestion: `סכם לי את המידע והממצאים מתוך המסמכים שהועלו עבור ${client.name}.`,
      meta: { total: docs.length, indexed: doneCount, pending: pendingCount },
    })
  }

  // ── 6. Audio Recordings ───────────────────────────────────────────────────
  if (recordings.length > 0) {
    const doneCount = recordings.filter((r: any) => r.transcript_status === 'done').length
    const pendingCount = recordings.filter((r: any) => r.transcript_status === 'pending' || r.transcript_status === 'processing').length
    sources.push({
      id: `recordings-${client.id}`,
      type: 'recording',
      label: `הקלטות פגישות (${recordings.length})`,
      status: pendingCount > 0 ? 'syncing' : 'connected',
      lastSync: recordings[0]?.created_at,
      promptSuggestion: `הצג את תמלול ההקלטות של ${client.name} וסכם החלטות ומשימות שנקבעו.`,
      meta: { total: recordings.length, transcribed: doneCount, pending: pendingCount },
    })
  }

  // ── 7. Vault ───────────────────────────────────────────────────────────────
  sources.push({
    id: `vault-${client.id}`,
    type: 'vault',
    label: `כספת מאובטחת${vaultCount > 0 ? ` (${vaultCount})` : ''}`,
    status: vaultCount > 0 ? 'connected' : 'not_configured',
    promptSuggestion: `מה סטטוס שירותי הכספת והפרטים המאובטחים של ${client.name}?`,
    meta: { count: vaultCount },
  })

  // ── 8. Full Dashboard Cockpit Link ─────────────────────────────────────────
  sources.push({
    id: `dashboard-${client.id}`,
    type: 'document',
    label: 'דשבורד ראשי (v2 Cockpit)',
    status: 'connected',
    url: `/workspace/clients/${client.id}`,
    promptSuggestion: `תן לי תמונת מצב אקוסיסטם 360 מעודכנת של ${client.name}.`,
    meta: { isDashboardLink: true },
  })

  return { client: client as WorkspaceClientRecord, sources }
}

// ── Global Notebook Sources ────────────────────────────────────────────────────

/**
 * Returns sources for the global (agency-level) notebook.
 */
export async function getGlobalNotebookSources(): Promise<NotebookSource[]> {
  await requireWorkspaceAdmin()
  const db = getWorkspaceAdminDb()

  const { data: clients } = await db
    .from('clients')
    .select('id, name, status')
    .neq('status', 'archived')
    .order('name')

  const sources: NotebookSource[] = []

  sources.push({
    id: 'global-clients',
    type: 'sheet',
    label: `לקוחות המשרד (${clients?.length ?? 0})`,
    status: 'connected',
    url: '/workspace/clients',
    promptSuggestion: 'כמה לקוחות פעילים יש לנו ומה תמונת המצב הכללית של כולם?',
    meta: { clientCount: clients?.length ?? 0 },
  })

  sources.push({
    id: 'global-gmail',
    type: 'gmail',
    label: 'Gmail — כל התיבה',
    status: 'connected',
    url: 'https://mail.google.com',
    promptSuggestion: 'סרוק את כל המיילים שלא נקראו בכל התיבה וסכם הודעות דחופות.',
  })

  sources.push({
    id: 'global-calendar',
    type: 'calendar',
    label: 'יומן Google (כללי)',
    status: 'connected',
    url: 'https://calendar.google.com',
    promptSuggestion: 'מה הפגישות וסדר היום לכל השבוע הקרוב?',
  })

  sources.push({
    id: 'global-tasks',
    type: 'document',
    label: 'משימות ושגרות הסוכנות',
    status: 'connected',
    url: '/workspace/tasks',
    promptSuggestion: 'איזה משימות ושגרות פתוחות קיימות היום ברחבי כל הסוכנות?',
  })

  return sources
}
