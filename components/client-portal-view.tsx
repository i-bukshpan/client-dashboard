'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AgentProvider } from '@/components/ai-agent/agent-context'
import { AgentButton } from '@/components/ai-agent/agent-button'
import { AgentPanel } from '@/components/ai-agent/agent-panel'
import { StickyNotes } from '@/components/sticky-notes'
import { Reminders } from '@/components/reminders'
import { ClientCalendar } from '@/components/client-calendar'
import { ClientLinks } from '@/components/client-links'
import { GoogleDriveViewer } from '@/components/google-drive-viewer'
import { BillingPaymentsPublicView } from '@/components/billing-payments-public-view'
import { ClientMeetings } from '@/components/client-meetings'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { ClientSharePermissions, ClientSchema } from '@/lib/supabase'
import { Bot, Sparkles, Phone, Mail, CalendarDays, Table2, RefreshCw } from 'lucide-react'

const BranchTablesTab = dynamic(
  () => import('@/components/branch-tables-tab').then(m => ({ default: m.BranchTablesTab })),
  { loading: () => <LoadingSkeleton /> }
)
const ModuleManager = dynamic(
  () => import('@/components/module-manager').then(m => ({ default: m.ModuleManager })),
  { loading: () => <LoadingSkeleton /> }
)
const SubClientsTab = dynamic(
  () => import('@/components/sub-clients-tab').then(m => ({ default: m.SubClientsTab })),
  { loading: () => <LoadingSkeleton /> }
)
const CredentialsVault = dynamic(
  () => import('@/components/credentials-vault').then(m => ({ default: m.CredentialsVault })),
  { loading: () => <LoadingSkeleton /> }
)

function LoadingSkeleton() {
  return <div className="py-12 text-center text-grey/50 animate-pulse font-bold">⏳ טוען...</div>
}

interface ClientPortalViewProps {
  client: any
  permissions: ClientSharePermissions
  clientSchemas: ClientSchema[]  // Initial schemas; portal reloads internally on change
}

const TAB = "rounded-xl font-black text-sm px-4 py-2 data-[state=active]:bg-violet-600 data-[state=active]:text-white data-[state=active]:shadow-sm whitespace-nowrap"

export function ClientPortalView({ client, permissions, clientSchemas: initialSchemas }: ClientPortalViewProps) {
  const [activeTab, setActiveTab] = useState(
    permissions.show_overview !== false ? 'overview' : 'meetings'
  )

  // Internal schema state so portal can refresh after ModuleManager creates tables
  const [schemas, setSchemas] = useState<ClientSchema[]>(initialSchemas)

  const loadSchemas = useCallback(async () => {
    const { data } = await supabase
      .from('client_schemas')
      .select('*')
      .eq('client_id', client.id)
      .order('created_at', { ascending: true })
    if (data) setSchemas(data)
  }, [client.id])

  // Re-load schemas whenever portal mounts fresh
  useEffect(() => {
    loadSchemas()
  }, [loadSchemas])

  const schemasByBranch = useMemo(() => {
    const map = new Map<string | null, ClientSchema[]>()
    schemas.forEach(schema => {
      const noFilter = !permissions.allowed_modules?.length
      const allowed = noFilter || permissions.allowed_modules.includes(schema.module_name)
      if (allowed) {
        const branch = schema.branch_name || null
        if (!map.has(branch)) map.set(branch, [])
        map.get(branch)!.push(schema)
      }
    })
    return map
  }, [schemas, permissions])

  const branches = useMemo(() =>
    Array.from(schemasByBranch.keys()).sort((a, b) => {
      if (a === null) return -1
      if (b === null) return 1
      return a.localeCompare(b, 'he')
    }), [schemasByBranch])

  return (
    <AgentProvider fixedClientId={client.id} fixedClientName={client.name} isPortalMode>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/15 to-slate-50" dir="rtl">

        {/* Portal Header */}
        <div className="sticky top-0 z-20 bg-white/85 backdrop-blur-xl border-b border-white/50 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center gap-4">
              <div className="h-11 w-11 rounded-2xl bg-violet-100 flex items-center justify-center font-black text-lg text-violet-600 shrink-0">
                {client.name?.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-black text-navy truncate">{client.name}</h1>
                <p className="text-xs font-medium text-grey">פורטל ניהול אישי</p>
              </div>
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black bg-violet-50 text-violet-700 border border-violet-100 shrink-0">
                <Sparkles className="h-3 w-3" />
                ניהול מלא
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">

            {/* Tab bar */}
            <div className="bg-white/80 backdrop-blur-md border border-white/50 rounded-2xl p-1.5 shadow-sm overflow-x-auto">
              <TabsList className="bg-transparent flex gap-1 h-auto w-max min-w-full">
                {permissions.show_overview !== false && (
                  <TabsTrigger value="overview" className={TAB}>סקירה</TabsTrigger>
                )}
                <TabsTrigger value="meetings" className={TAB}>פגישות וסיכומים</TabsTrigger>
                {permissions.show_calendar && (
                  <TabsTrigger value="calendar" className={TAB}>יומן</TabsTrigger>
                )}
                {permissions.show_billing && (
                  <TabsTrigger value="payments" className={TAB}>תשלומים</TabsTrigger>
                )}

                {/* Data table branches */}
                {branches.map(branch => (
                  <TabsTrigger key={branch || 'ראשי'} value={branch || 'ראשי'} className={TAB}>
                    {branch || 'ראשי'}
                  </TabsTrigger>
                ))}

                {/* Table management — always available in portal */}
                <TabsTrigger value="manage-tables" className={TAB}>
                  <span className="flex items-center gap-1.5">
                    <Table2 className="h-3.5 w-3.5" />
                    ניהול טבלאות
                  </span>
                </TabsTrigger>

                {permissions.show_sub_clients && (
                  <TabsTrigger value="sub-clients" className={TAB}>תחומי ניהול</TabsTrigger>
                )}
                {permissions.show_notes && (
                  <TabsTrigger value="notes" className={TAB}>פתקים ומשימות</TabsTrigger>
                )}
                {permissions.show_credentials && (
                  <TabsTrigger value="credentials" className={TAB}>סיסמאות</TabsTrigger>
                )}
                {permissions.show_links && (
                  <TabsTrigger value="links" className={TAB}>קישורים</TabsTrigger>
                )}
              </TabsList>
            </div>

            {/* ── Overview ── */}
            {permissions.show_overview !== false && (
              <TabsContent value="overview" className="animate-fade-in-up">
                <PortalOverview client={client} />
              </TabsContent>
            )}

            {/* ── Meetings & Summaries ── */}
            <TabsContent value="meetings" className="animate-fade-in-up">
              <ClientMeetings client={client} onUpdate={() => {}} />
            </TabsContent>

            {/* ── Calendar ── */}
            {permissions.show_calendar && (
              <TabsContent value="calendar" className="animate-fade-in-up">
                <ClientCalendar
                  clientId={client.id}
                  clientName={client.name}
                  schemas={schemas}
                  readOnly={false}
                />
              </TabsContent>
            )}

            {/* ── Payments ── */}
            {permissions.show_billing && (
              <TabsContent value="payments" className="animate-fade-in-up">
                <BillingPaymentsPublicView clientId={client.id} readOnly={false} />
              </TabsContent>
            )}

            {/* ── Dynamic branch tables (data entry + column editing) ── */}
            {branches.map(branch => (
              <TabsContent key={branch || 'ראשי'} value={branch || 'ראשי'} className="animate-fade-in-up">
                <BranchTablesTab
                  clientId={client.id}
                  schemas={schemasByBranch.get(branch)!}
                  branchName={branch}
                  readOnly={false}
                  activeModule={null}
                  highlightId={null}
                  onSchemasChanged={loadSchemas}
                />
              </TabsContent>
            ))}

            {/* ── Table management (create/import/delete tables) ── */}
            <TabsContent value="manage-tables" className="animate-fade-in-up">
              <PortalTableManager clientId={client.id} onUpdate={loadSchemas} />
            </TabsContent>

            {/* ── Sub-clients ── */}
            {permissions.show_sub_clients && (
              <TabsContent value="sub-clients" className="animate-fade-in-up">
                <SubClientsTab
                  parentClientId={client.id}
                  parentClientName={client.name}
                  readOnly={false}
                  isPublicView={false}
                  isPortalMode={true}
                />
              </TabsContent>
            )}

            {/* ── Notes & Reminders ── */}
            {permissions.show_notes && (
              <TabsContent value="notes" className="animate-fade-in-up">
                <div className="space-y-6">
                  <StickyNotes clientId={client.id} readOnly={false} />
                  <div className="border-t border-border/30 pt-6">
                    <Reminders clientId={client.id} clientName={client.name} readOnly={false} />
                  </div>
                </div>
              </TabsContent>
            )}

            {/* ── Credentials ── */}
            {permissions.show_credentials && (
              <TabsContent value="credentials" className="animate-fade-in-up">
                <CredentialsVault clientId={client.id} readOnly={false} />
              </TabsContent>
            )}

            {/* ── Links ── */}
            {permissions.show_links && (
              <TabsContent value="links" className="animate-fade-in-up">
                <div className="space-y-6">
                  <ClientLinks clientId={client.id} readOnly={false} />
                  <div className="border-t border-border/30 pt-6">
                    <GoogleDriveViewer />
                  </div>
                </div>
              </TabsContent>
            )}
          </Tabs>
        </div>

        {/* Floating AI Agent */}
        <AgentButton />
        <AgentPanel />
      </div>
    </AgentProvider>
  )
}

// ── Portal Table Manager ──────────────────────────────────────────────────
// Wraps ModuleManager in a styled portal container

function PortalTableManager({ clientId, onUpdate }: { clientId: string; onUpdate: () => void }) {
  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="bg-white/70 backdrop-blur-md border border-border/40 rounded-[2.5rem] p-8 shadow-sm">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 rounded-2xl bg-violet-100">
            <Table2 className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h2 className="text-lg font-black text-navy">ניהול טבלאות מידע</h2>
            <p className="text-sm text-grey font-medium mt-0.5">
              צור טבלאות מידע חדשות, ייבא קבצי Excel/CSV, ונהל את מבנה העמודות
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {[
            { icon: '📊', title: 'צור טבלה חדשה', desc: 'הגדר עמודות מותאמות אישית' },
            { icon: '📥', title: 'ייבא CSV / Excel', desc: 'טען נתונים קיימים ישירות' },
            { icon: '🗂️', title: 'תבניות מוכנות', desc: 'בחר מתבניות נפוצות' },
          ].map(item => (
            <div key={item.title} className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50/60 border border-border/30">
              <span className="text-xl">{item.icon}</span>
              <div>
                <p className="font-black text-sm text-navy">{item.title}</p>
                <p className="text-xs text-grey font-medium mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Module manager */}
      <div className="bg-white/70 backdrop-blur-md border border-border/40 rounded-[2.5rem] p-6 shadow-sm">
        <ModuleManager clientId={clientId} onModuleUpdate={onUpdate} />
      </div>
    </div>
  )
}

// ── Portal Overview ────────────────────────────────────────────────────────

function PortalOverview({ client }: { client: any }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Profile card */}
      <div className="bg-white/70 backdrop-blur-md border border-border/40 rounded-[2.5rem] p-8 shadow-sm space-y-5">
        <h2 className="text-lg font-black text-navy">הפרופיל שלי</h2>
        <div className="space-y-3">
          <InfoRow label="שם" value={client.name} />
          {client.email && (
            <InfoRow icon={<Mail className="h-4 w-4 text-grey" />} value={client.email} />
          )}
          {client.phone && (
            <InfoRow icon={<Phone className="h-4 w-4 text-grey" />} value={client.phone} />
          )}
          {client.status && (
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50/70">
              <span className="text-xs font-black text-grey uppercase tracking-widest w-20">סטטוס</span>
              <span className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-black",
                client.status === 'פעיל' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
              )}>{client.status}</span>
            </div>
          )}
          <InfoRow
            icon={<CalendarDays className="h-4 w-4 text-grey" />}
            value={`לקוח מאז ${new Date(client.created_at).toLocaleDateString('he-IL')}`}
            dimmed
          />
        </div>
      </div>

      {/* AI Agent card */}
      <div className="bg-gradient-to-br from-violet-600 to-violet-700 rounded-[2.5rem] p-8 shadow-xl shadow-violet-600/20 text-white">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-2xl bg-white/15">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <h2 className="text-lg font-black">עוזר AI אישי</h2>
        </div>
        <p className="text-white/80 font-medium text-sm leading-relaxed mb-5">
          יש לך עוזר AI חכם שיכול לעזור לנהל את התיק:
        </p>
        <ul className="space-y-2 text-sm text-white/80 mb-6">
          {[
            'סיכום פגישות והכנה לפגישה הבאה',
            'יצירת תזכורות ומשימות',
            'מילוי וניתוח טבלאות מידע',
            'מידע כספי ודוחות',
            'כל שאלה על התיק שלך',
          ].map(item => (
            <li key={item} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-white/60 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2 bg-white/10 rounded-2xl px-4 py-3">
          <Sparkles className="h-4 w-4 text-white/70" />
          <p className="text-xs font-bold text-white/70">
            לחץ על כפתור ה-AI בפינה השמאלית התחתונה כדי להתחיל
          </p>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value, icon, dimmed }: {
  label?: string
  value: string
  icon?: React.ReactNode
  dimmed?: boolean
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50/70">
      {label && <span className="text-xs font-black text-grey uppercase tracking-widest w-20">{label}</span>}
      {icon}
      <span className={cn("font-bold", dimmed ? "text-grey text-sm" : "text-navy")}>{value}</span>
    </div>
  )
}
