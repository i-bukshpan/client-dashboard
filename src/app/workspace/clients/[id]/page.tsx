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
  CalendarClock,
  TrendingUp,
  Layers,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { DriveExplorer } from '@/components/workspace/DriveExplorer'
import { SheetsViewer } from '@/components/workspace/SheetsViewer'
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
import type { ClientWorkspaceSettings } from '@/types/workspace-task'
import { getClientWorkspaceSettings } from '@/lib/v2/client-settings'
import { listMonthlyBriefs } from '@/lib/v2/monthly-brief'
import { MonthlyBriefPanel } from '@/components/workspace/MonthlyBriefPanel'
import { ClientContextCard } from '@/components/workspace/ClientContextCard'
import { ClientEmailsView } from '@/components/workspace/ClientEmailsView'
import {
  ClientProfileSidebar,
  ClientProfileMobileTrigger,
} from '@/components/workspace/ClientProfileSidebar'
import { ClientAssetsManager } from '@/components/workspace/ClientAssetsManager'
import { ClientRoutinesPanel } from '@/components/workspace/ClientRoutinesPanel'
import { ClientGoalsPanel } from '@/components/workspace/ClientGoalsPanel'
import { ClientVaultCard } from '@/components/workspace/ClientVaultCard'
import { ClientOperationsCockpit } from '@/components/workspace/ClientOperationsCockpit'
import { ClientReportsCockpit } from '@/components/workspace/ClientReportsCockpit'
import {
  listClientAssets,
  listClientVaultItems,
  listClientRoutines,
  listClientGoals,
} from '@/lib/v2/client-ecosystem-dal'
import { clientContextSchema } from '@/lib/v2/client-context-schema'
import {
  getWorkspaceClient,
  WorkspaceAccessError,
} from '@/lib/v2/workspace-dal'

export const dynamic = 'force-dynamic'

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
  const [
    clientTasksResult,
    clientSettingsResult,
    monthlyBriefsResult,
    clientAssetsResult,
    clientVaultResult,
    clientRoutinesResult,
    clientGoalsResult,
  ] = await Promise.allSettled([
    listWorkspaceTasks(c.id),
    getClientWorkspaceSettings(c.id),
    listMonthlyBriefs(c.id),
    listClientAssets(c.id),
    listClientVaultItems(c.id),
    listClientRoutines(c.id),
    listClientGoals(c.id),
  ])
  const clientTasks = clientTasksResult.status === 'fulfilled' ? clientTasksResult.value : []
  const clientAssets = clientAssetsResult.status === 'fulfilled' ? clientAssetsResult.value : []
  const clientVaultItems = clientVaultResult.status === 'fulfilled' ? clientVaultResult.value : []
  const clientRoutines = clientRoutinesResult.status === 'fulfilled' ? clientRoutinesResult.value : []
  const clientGoals = clientGoalsResult.status === 'fulfilled' ? clientGoalsResult.value : []
  const defaultSettings: ClientWorkspaceSettings = {
    clientId: c.id,
    reminderDefaultMinutes: 30,
    monthlyBriefEnabled: true,
    monthlyBriefDay: 1,
    monthlyBriefIncludeTasks: true,
    monthlyBriefIncludeCalendar: true,
    alerts: { overdueTasks: true, upcomingTasks: true, missingDocuments: false, cashFlow: false },
  }
  const clientSettings = clientSettingsResult.status === 'fulfilled' ? clientSettingsResult.value : defaultSettings
  const monthlyBriefs = monthlyBriefsResult.status === 'fulfilled' ? monthlyBriefsResult.value : []
  const pendingBriefQuestions = monthlyBriefs
    .find((brief) => brief.state === 'needs_input')
    ?.missingInformation.map((item) => item.question) ?? []

  // Parse client context to determine onboarding state
  const clientContextResult = clientContextSchema.safeParse(c.client_context_json)
  const clientContext = clientContextResult.success ? clientContextResult.data : null
  const isOnboarding = !clientContext

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">

      {/* ── Client Profile Sidebar (Desktop & Mobile Drawer) ───────────────── */}
      <ClientProfileSidebar client={c} clientContext={clientContext} />

      {/* ── Right: Main workspace ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col min-w-0 min-h-0">
        {/* Client name breadcrumb + actions */}
        <div className="px-6 py-3 border-b border-border bg-card/60 backdrop-blur-sm shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Workspace</span>
            <span className="text-muted-foreground/40">/</span>
            <span className="font-bold text-foreground">{c.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <ClientProfileMobileTrigger client={c} clientContext={clientContext} />
            
            {/* Settings Dialog */}
            <Dialog>
              <DialogTrigger
                className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                title="הגדרות תיק לקוח"
              >
                <Settings2 className="w-4 h-4" />
              </DialogTrigger>
              <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto" dir="rtl">
                <DialogHeader>
                  <DialogTitle className="text-base font-bold flex items-center gap-2">
                    <Settings2 className="w-4 h-4 text-indigo-500" />
                    הגדרות תיק לקוח
                  </DialogTitle>
                </DialogHeader>
                <ClientSettingsPanel initialSettings={clientSettings} initialGmailLabel={c.gmail_label} />
              </DialogContent>
            </Dialog>

            <Badge variant="outline" className="text-[10px] text-indigo-600 border-indigo-200 bg-indigo-50">
              v2 · Nehemiah OS
            </Badge>
          </div>
        </div>

        {/* Streamlined Tabs (Zero Redundancy, Fits 100% On Screen) */}
        <Tabs defaultValue="routines" className="flex-1 overflow-hidden flex flex-col min-h-0 min-w-0">
          <div className="px-6 pt-3 pb-0 border-b border-border bg-background shrink-0">
            <TabsList className="h-10 bg-transparent border-0 p-0 gap-2 flex-wrap sm:flex-nowrap justify-start">
              <TabsTrigger
                value="routines"
                className="h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-700 data-[state=active]:bg-transparent px-3.5 text-xs sm:text-sm font-bold text-muted-foreground gap-1.5 transition-all"
              >
                <CalendarClock className="w-4 h-4 text-indigo-500" />
                <span>שגרות ומשימות</span>
                {clientRoutines.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-700 font-bold">
                    {clientRoutines.length}
                  </span>
                )}
              </TabsTrigger>

              <TabsTrigger
                value="goals"
                className="h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-700 data-[state=active]:bg-transparent px-3.5 text-xs sm:text-sm font-bold text-muted-foreground gap-1.5 transition-all"
              >
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <span>יעדי צמיחה</span>
                {clientGoals.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-700 font-bold">
                    {clientGoals.length}
                  </span>
                )}
              </TabsTrigger>

              <TabsTrigger
                value="assets"
                className="h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-amber-600 data-[state=active]:text-amber-700 data-[state=active]:bg-transparent px-3.5 text-xs sm:text-sm font-bold text-muted-foreground gap-1.5 transition-all"
              >
                <Layers className="w-4 h-4 text-amber-500" />
                <span>נכסים וגיליונות</span>
                {clientAssets.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-700 font-bold">
                    {clientAssets.length}
                  </span>
                )}
              </TabsTrigger>

              <TabsTrigger
                value="vault"
                className="h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-rose-600 data-[state=active]:text-rose-700 data-[state=active]:bg-transparent px-3.5 text-xs sm:text-sm font-bold text-muted-foreground gap-1.5 transition-all"
              >
                <ShieldCheck className="w-4 h-4 text-rose-500" />
                <span>כספת פרטי גישה</span>
                {clientVaultItems.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-700 font-bold">
                    {clientVaultItems.length}
                  </span>
                )}
              </TabsTrigger>

              <TabsTrigger
                value="dashboard"
                className="h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-violet-600 data-[state=active]:text-violet-700 data-[state=active]:bg-transparent px-3.5 text-xs sm:text-sm font-bold text-muted-foreground gap-1.5 transition-all"
              >
                <LayoutGrid className="w-4 h-4 text-violet-500" />
                <span>דשבורד ודוחות</span>
              </TabsTrigger>

              <TabsTrigger
                value="emails"
                className="h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-red-600 data-[state=active]:text-red-700 data-[state=active]:bg-transparent px-3.5 text-xs sm:text-sm font-bold text-muted-foreground gap-1.5 transition-all"
              >
                <Mail className="w-4 h-4 text-red-500" />
                <span>אימייל</span>
                {c.gmail_label && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-red-100 text-red-600 font-bold max-w-[80px] truncate">
                    {c.gmail_label}
                  </span>
                )}
              </TabsTrigger>

              <TabsTrigger
                value="calendar"
                className="h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 data-[state=active]:bg-transparent px-3.5 text-xs sm:text-sm font-bold text-muted-foreground gap-1.5 transition-all"
              >
                <CalendarDays className="w-4 h-4 text-blue-500" />
                <span>יומן פגישות</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* 1. Routines & Tasks Unified Cockpit */}
          <TabsContent value="routines" keepMounted className="flex-1 overflow-hidden mt-0 data-[state=inactive]:hidden min-h-0 flex flex-col">
            <ClientOperationsCockpit
              clientId={c.id}
              clientName={c.name}
              initialRoutines={clientRoutines}
              tasks={clientTasks}
            />
          </TabsContent>

          {/* 2. Growth Goals */}
          <TabsContent value="goals" keepMounted className="flex-1 overflow-y-auto p-5 mt-0 data-[state=inactive]:hidden min-h-0">
            <ClientGoalsPanel
              clientId={c.id}
              clientName={c.name}
              initialGoals={clientGoals}
            />
          </TabsContent>

          {/* 3. Assets & Multi-Sheets */}
          <TabsContent value="assets" keepMounted className="flex-1 overflow-y-auto p-5 mt-0 data-[state=inactive]:hidden min-h-0">
            <ClientAssetsManager
              clientId={c.id}
              clientName={c.name}
              initialAssets={clientAssets}
              defaultSheetId={c.google_sheet_id}
              defaultDriveFolderId={c.drive_folder_id}
            />
          </TabsContent>

          {/* 4. Vault (Encrypted Credentials) */}
          <TabsContent value="vault" keepMounted className="flex-1 overflow-y-auto p-5 mt-0 data-[state=inactive]:hidden min-h-0">
            <ClientVaultCard
              clientId={c.id}
              clientName={c.name}
              initialItems={clientVaultItems}
            />
          </TabsContent>

          {/* 5. Dashboard & Monthly Brief Unified Cockpit */}
          <TabsContent value="dashboard" keepMounted className="flex-1 overflow-hidden mt-0 data-[state=inactive]:hidden min-h-0 flex flex-col">
            <ClientReportsCockpit
              clientId={c.id}
              clientName={c.name}
              initialConfig={dashboardConfig}
              hasSheet={!!c.google_sheet_id}
              briefs={monthlyBriefs}
              pendingBriefQuestions={pendingBriefQuestions}
            />
          </TabsContent>

          {/* 6. Emails */}
          <TabsContent value="emails" keepMounted className="flex-1 overflow-hidden mt-0 data-[state=inactive]:hidden min-h-0">
            <ClientEmailsView
              clientId={c.id}
              clientName={c.name}
              clientEmail={c.email}
              initialGmailLabel={c.gmail_label}
            />
          </TabsContent>

          {/* 7. Calendar */}
          <TabsContent value="calendar" keepMounted className="flex-1 overflow-hidden p-5 mt-0 data-[state=inactive]:hidden min-h-0">
            <WorkspaceCalendar
              clients={[{ id: c.id, name: c.name, email: c.email }]}
              initialClientId={c.id}
              compact
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
