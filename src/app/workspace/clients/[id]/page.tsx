/**
 * /workspace/clients/[id] — The v2 Client Workspace Page
 *
 * A full-screen split-panel view:
 * - Left sidebar: client profile card + quick stats
 * - Right main area: tabbed view with Drive Explorer, Sheets Viewer,
 *   AI Chat (Phase 3), and Dashboard (Phase 4)
 *
 * This is a Server Component. Heavy data is fetched on the server.
 * Interactive sub-components are 'use client'.
 */

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Mail,
  Phone,
  MapPin,
  Users,
  ArrowLeft,
  FolderOpen,
  TableIcon,
  Bot,
  LayoutGrid,
  ExternalLink,
  CalendarDays,
  ClipboardCheck,
  Settings2,
  FileText,
} from 'lucide-react'
import { DriveExplorer } from '@/components/workspace/DriveExplorer'
import { SheetsViewer } from '@/components/workspace/SheetsViewer'
import { ClientAIChat } from '@/components/workspace/ClientAIChat'
import { DashboardEngine } from '@/components/workspace/DashboardEngine'
import { EditClientModal } from '@/components/workspace/EditClientModal'
import { getSpreadsheetMeta } from '@/lib/google-sheets'
import type { SheetMeta } from '@/lib/google-sheets'
import type { DashboardConfig } from '@/types/dashboard'
import { dashboardConfigSchema } from '@/lib/v2/dashboard-schema'
import { WorkspaceCalendar } from '@/components/workspace/WorkspaceCalendar'
import { WorkspaceTaskBoard } from '@/components/workspace/WorkspaceTaskBoard'
import { ClientSettingsPanel } from '@/components/workspace/ClientSettingsPanel'
import { listWorkspaceTasks } from '@/lib/v2/workspace-tasks'
import { getClientWorkspaceSettings } from '@/lib/v2/client-settings'
import { listMonthlyBriefs } from '@/lib/v2/monthly-brief'
import { MonthlyBriefPanel } from '@/components/workspace/MonthlyBriefPanel'
import { ClientContextCard } from '@/components/workspace/ClientContextCard'
import { clientContextSchema } from '@/lib/v2/client-context-schema'
import {
  getWorkspaceClient,
  WorkspaceAccessError,
} from '@/lib/v2/workspace-dal'

export const dynamic = 'force-dynamic'

// ── Helpers ────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: 'פעיל', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    prospect: { label: 'פוטנציאל', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
    inactive: { label: 'לא פעיל', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
    archived: { label: 'ארכיון', cls: 'bg-red-100 text-red-600 border-red-200' },
  }
  const s = map[status ?? 'active'] ?? map.active
  return (
    <Badge variant="outline" className={`text-[10px] font-bold ${s.cls}`}>
      {s.label}
    </Badge>
  )
}

function WorkspaceStatusRow({
  hasDrive,
  hasSheet,
}: {
  hasDrive: boolean
  hasSheet: boolean
}) {
  return (
    <div className="grid grid-cols-2 gap-2 mt-4">
      <div className={`flex items-center gap-2 p-2.5 rounded-xl border ${hasDrive ? 'bg-amber-50/60 border-amber-200' : 'bg-slate-50 border-dashed border-border'}`}>
        <FolderOpen className={`w-4 h-4 ${hasDrive ? 'text-amber-500' : 'text-muted-foreground/30'}`} />
        <div>
          <p className={`text-[10px] font-bold ${hasDrive ? 'text-amber-700' : 'text-muted-foreground/50'}`}>Drive</p>
          <p className="text-[9px] text-muted-foreground/60">{hasDrive ? 'מחובר' : 'לא הוגדר'}</p>
        </div>
      </div>
      <div className={`flex items-center gap-2 p-2.5 rounded-xl border ${hasSheet ? 'bg-emerald-50/60 border-emerald-200' : 'bg-slate-50 border-dashed border-border'}`}>
        <TableIcon className={`w-4 h-4 ${hasSheet ? 'text-emerald-500' : 'text-muted-foreground/30'}`} />
        <div>
          <p className={`text-[10px] font-bold ${hasSheet ? 'text-emerald-700' : 'text-muted-foreground/50'}`}>Sheets</p>
          <p className="text-[9px] text-muted-foreground/60">{hasSheet ? 'מחובר' : 'לא הוגדר'}</p>
        </div>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function WorkspaceClientPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let c
  try {
    c = await getWorkspaceClient(id)
  } catch (error) {
    if (error instanceof WorkspaceAccessError && ['INVALID_INPUT', 'NOT_FOUND'].includes(error.code)) {
      notFound()
    }
    throw error
  }

  // Fetch sheet tabs (server-side — avoids a client round-trip on mount)
  let sheetTabs: SheetMeta[] = []
  if (c.google_sheet_id) {
    try {
      sheetTabs = await getSpreadsheetMeta(c.google_sheet_id)
    } catch {
      // Graceful fallback — component will show error on load
    }
  }

  const initials = c.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
  const sheetsUrl = c.google_sheet_id
    ? `https://docs.google.com/spreadsheets/d/${c.google_sheet_id}`
    : null
  const driveUrl = c.drive_folder_id
    ? `https://drive.google.com/drive/folders/${c.drive_folder_id}`
    : null
  const dashboardConfigResult = dashboardConfigSchema.safeParse(c.dashboard_config_json)
  const dashboardConfig: DashboardConfig | null = dashboardConfigResult.success
    ? dashboardConfigResult.data
    : null
  const [clientTasks, clientSettings, monthlyBriefs] = await Promise.all([
    listWorkspaceTasks(c.id),
    getClientWorkspaceSettings(c.id),
    listMonthlyBriefs(c.id),
  ])
  const pendingBriefQuestions = monthlyBriefs
    .find((brief) => brief.state === 'needs_input')
    ?.missingInformation.map((item) => item.question) ?? []

  // Parse client context to determine onboarding state
  const clientContextResult = clientContextSchema.safeParse(c.client_context_json)
  const clientContext = clientContextResult.success ? clientContextResult.data : null
  const isOnboarding = !clientContext

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">

      {/* ── Left Sidebar: Client Profile ──────────────────────────────────── */}
      <aside className="w-72 shrink-0 border-l border-border overflow-y-auto bg-card">
        {/* Back link */}
        <div className="px-4 pt-4 pb-2">
          <Link
            href="/workspace/clients"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit"
          >
            <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
            חזרה לרשימה
          </Link>
        </div>

        {/* Avatar + name */}
        <div className="px-5 pt-3 pb-5 text-center border-b border-border/50">
          <div className="relative inline-block mb-3">
            <Avatar className="w-20 h-20 border-4 border-background shadow-xl">
              <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-2xl font-black">
                {initials}
              </AvatarFallback>
            </Avatar>
            {/* Online indicator ring */}
            <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-background shadow" />
          </div>
          <h1 className="font-black text-lg text-foreground leading-tight">{c.name}</h1>
          <div className="mt-1.5 flex items-center justify-center gap-2">
            <StatusBadge status={c.status} />
          </div>
          <div className="mt-3">
            <EditClientModal client={c} />
          </div>
        </div>

        {/* Contact info */}
        <div className="px-5 py-4 space-y-3 border-b border-border/50">
          {c.email && (
            <div className="flex items-center gap-2.5 text-sm text-foreground/80">
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <Mail className="w-3.5 h-3.5 text-blue-500" />
              </div>
              <span className="truncate text-xs" dir="ltr">{c.email}</span>
            </div>
          )}
          {c.phone && (
            <div className="flex items-center gap-2.5 text-sm text-foreground/80">
              <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                <Phone className="w-3.5 h-3.5 text-green-500" />
              </div>
              <span className="text-xs" dir="ltr">{c.phone}</span>
            </div>
          )}
          {c.address && (
            <div className="flex items-center gap-2.5 text-sm text-foreground/80">
              <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                <MapPin className="w-3.5 h-3.5 text-purple-500" />
              </div>
              <span className="text-xs">{c.address}</span>
            </div>
          )}
        </div>

        {/* Advisory info */}
        {(c.portfolio_value || c.advisory_goal || c.risk_level) && (
          <div className="px-5 py-4 border-b border-border/50 space-y-2.5">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              פרופיל ייעוצי
            </p>
            {c.portfolio_value && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">שווי תיק</span>
                <span className="text-xs font-bold text-foreground">
                  ₪{c.portfolio_value.toLocaleString()}
                </span>
              </div>
            )}
            {c.advisory_goal && (
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs text-muted-foreground shrink-0">מטרה</span>
                <span className="text-xs font-medium text-foreground text-right">{c.advisory_goal}</span>
              </div>
            )}
            {c.risk_level && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">סיכון</span>
                <Badge variant="outline" className="text-[10px]">{c.risk_level}</Badge>
              </div>
            )}
          </div>
        )}

        {/* Workspace status */}
        <div className="px-5 py-4 border-b border-border/50">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">
            Google Workspace
          </p>
          <WorkspaceStatusRow
            hasDrive={!!c.drive_folder_id}
            hasSheet={!!c.google_sheet_id}
          />
        </div>

        {/* Client context card (onboarding status) */}
        <div className="px-5 py-4 border-b border-border/50">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">
            פרופיל עסקי
          </p>
          {clientContext ? (
            <ClientContextCard context={clientContext} />
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-indigo-300 bg-indigo-50/40 px-3 py-2.5">
              <div className="w-4 h-4 rounded-full bg-indigo-200 flex items-center justify-center shrink-0">
                <span className="text-[9px] text-indigo-600 font-black">?</span>
              </div>
              <p className="text-[10px] text-indigo-600/80 leading-tight">
                פרופיל עסקי טרם הוגדר — פתח את AI Agent להתחלת האפיון
              </p>
            </div>
          )}
        </div>

        {/* Quick links */}
        <div className="px-5 py-4 space-y-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
            קישורים מהירים
          </p>
          {driveUrl && (
            <a
              href={driveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors group"
            >
              <FolderOpen className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-medium text-amber-700 flex-1">תיקיית Drive</span>
              <ExternalLink className="w-3 h-3 text-amber-400 group-hover:text-amber-600" />
            </a>
          )}
          {sheetsUrl && (
            <a
              href={sheetsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors group"
            >
              <TableIcon className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-medium text-emerald-700 flex-1">גיליון Sheets</span>
              <ExternalLink className="w-3 h-3 text-emerald-400 group-hover:text-emerald-600" />
            </a>
          )}
          <Link
            href={`/admin/crm/${c.id}`}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-border transition-colors group"
          >
            <Users className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-medium text-muted-foreground flex-1">פרופיל CRM ישן</span>
            <ExternalLink className="w-3 h-3 text-muted-foreground/40 group-hover:text-muted-foreground" />
          </Link>
        </div>
      </aside>

      {/* ── Right: Main workspace ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col min-w-0 min-h-0">
        {/* Client name breadcrumb */}
        <div className="px-6 py-3 border-b border-border bg-card/60 backdrop-blur-sm shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Workspace</span>
            <span className="text-muted-foreground/40">/</span>
            <span className="font-bold text-foreground">{c.name}</span>
          </div>
          <Badge variant="outline" className="text-[10px] text-indigo-600 border-indigo-200 bg-indigo-50">
            v2 · Nehemiah OS
          </Badge>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="drive" className="flex-1 overflow-hidden flex flex-col min-h-0 min-w-0">
          <div className="px-6 pt-4 pb-0 border-b border-border bg-background shrink-0 overflow-x-auto scrollbar-thin">
            <TabsList className="h-9 bg-transparent border-0 p-0 gap-1 flex-nowrap w-max min-w-full justify-start">
              <TabsTrigger
                value="drive"
                className="h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-amber-500 data-[state=active]:text-amber-700 data-[state=active]:bg-transparent px-4 text-sm font-semibold text-muted-foreground gap-1.5 rounded-t-sm transition-all whitespace-nowrap shrink-0"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Drive
              </TabsTrigger>
              <TabsTrigger
                value="sheets"
                className="h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:text-emerald-700 data-[state=active]:bg-transparent px-4 text-sm font-semibold text-muted-foreground gap-1.5 rounded-t-sm transition-all whitespace-nowrap shrink-0"
              >
                <TableIcon className="w-3.5 h-3.5" />
                Sheets
                {sheetTabs.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-600 font-bold">
                    {sheetTabs.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="ai"
                className="h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-500 data-[state=active]:text-indigo-700 data-[state=active]:bg-transparent px-4 text-sm font-semibold text-muted-foreground gap-1.5 rounded-t-sm transition-all whitespace-nowrap shrink-0"
              >
                <Bot className="w-3.5 h-3.5" />
                AI Agent
              </TabsTrigger>
              <TabsTrigger
                value="dashboard"
                className="h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-violet-500 data-[state=active]:text-violet-700 data-[state=active]:bg-transparent px-4 text-sm font-semibold text-muted-foreground gap-1.5 rounded-t-sm transition-all whitespace-nowrap shrink-0"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Dashboard
                {dashboardConfig && dashboardConfig.widgets.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-600 font-bold">
                    {dashboardConfig.widgets.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="calendar"
                className="h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:text-blue-700 data-[state=active]:bg-transparent px-4 text-sm font-semibold text-muted-foreground gap-1.5 rounded-t-sm transition-all whitespace-nowrap shrink-0"
              >
                <CalendarDays className="w-3.5 h-3.5" />
                יומן
              </TabsTrigger>
              <TabsTrigger
                value="tasks"
                className="h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-amber-500 data-[state=active]:text-amber-700 data-[state=active]:bg-transparent px-4 text-sm font-semibold text-muted-foreground gap-1.5 rounded-t-sm transition-all whitespace-nowrap shrink-0"
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
                משימות
                {clientTasks.length > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold">{clientTasks.length}</span>}
              </TabsTrigger>
              <TabsTrigger
                value="settings"
                className="h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-slate-500 data-[state=active]:text-slate-700 data-[state=active]:bg-transparent px-4 text-sm font-semibold text-muted-foreground gap-1.5 rounded-t-sm transition-all whitespace-nowrap shrink-0"
              >
                <Settings2 className="w-3.5 h-3.5" />
                הגדרות
              </TabsTrigger>
              <TabsTrigger
                value="monthly-brief"
                className="h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-violet-500 data-[state=active]:text-violet-700 data-[state=active]:bg-transparent px-4 text-sm font-semibold text-muted-foreground gap-1.5 rounded-t-sm transition-all whitespace-nowrap shrink-0"
              >
                <FileText className="w-3.5 h-3.5" />
                בריף חודשי
                {pendingBriefQuestions.length > 0 && <span className="size-2 rounded-full bg-amber-500" />}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Drive tab */}
          <TabsContent value="drive" keepMounted className="flex-1 overflow-hidden p-5 mt-0 data-[state=inactive]:hidden min-h-0">
            <DriveExplorer
              key={c.drive_folder_id ?? 'no-drive'}
              clientId={c.id}
              folderId={c.drive_folder_id}
              folderName={c.name}
              currentSheetId={c.google_sheet_id}
            />
          </TabsContent>

          {/* Sheets tab */}
          <TabsContent value="sheets" keepMounted className="flex-1 overflow-hidden p-5 mt-0 data-[state=inactive]:hidden min-h-0">
            <SheetsViewer
              key={c.google_sheet_id ?? 'no-sheet'}
              clientId={c.id}
              spreadsheetId={c.google_sheet_id}
              tabs={sheetTabs}
            />
          </TabsContent>

          {/* AI Agent tab */}
          <TabsContent value="ai" keepMounted className="flex-1 overflow-hidden mt-0 data-[state=inactive]:hidden min-h-0">
            <ClientAIChat
              clientId={c.id}
              clientName={c.name}
              hasSheet={!!c.google_sheet_id}
              isOnboarding={isOnboarding}
              pendingBriefQuestions={pendingBriefQuestions}
            />
          </TabsContent>

          {/* Dashboard tab */}
          <TabsContent value="dashboard" keepMounted className="flex-1 overflow-y-auto p-5 mt-0 data-[state=inactive]:hidden min-h-0">
            <DashboardEngine
              clientId={c.id}
              clientName={c.name}
              initialConfig={dashboardConfig}
              hasSheet={!!c.google_sheet_id}
            />
          </TabsContent>

          <TabsContent value="calendar" keepMounted className="flex-1 overflow-hidden p-5 mt-0 data-[state=inactive]:hidden min-h-0">
            <WorkspaceCalendar
              clients={[{ id: c.id, name: c.name, email: c.email }]}
              initialClientId={c.id}
              compact
            />
          </TabsContent>

          <TabsContent value="tasks" keepMounted className="flex-1 overflow-y-auto p-5 mt-0 data-[state=inactive]:hidden min-h-0">
            <WorkspaceTaskBoard tasks={clientTasks} clients={[{ id: c.id, name: c.name }]} lockedClientId={c.id} compact />
          </TabsContent>

          <TabsContent value="settings" keepMounted className="flex-1 overflow-y-auto p-5 mt-0 data-[state=inactive]:hidden min-h-0">
            <ClientSettingsPanel initialSettings={clientSettings} />
          </TabsContent>

          <TabsContent value="monthly-brief" keepMounted className="flex-1 overflow-y-auto p-5 mt-0 data-[state=inactive]:hidden min-h-0">
            <MonthlyBriefPanel clientId={c.id} briefs={monthlyBriefs} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
