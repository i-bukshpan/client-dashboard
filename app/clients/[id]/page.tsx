'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowRight, Phone, Mail, Calendar, Clock,
  Plus, ExternalLink, Copy, CheckCircle2, Link2, Lock, Folder, LayoutDashboard, Settings, FileText, Database, PiggyBank, Key, BarChart3, HardDrive, History, CalendarDays, MessageSquare
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { supabase, type Client } from '@/lib/supabase'
import { EditClientDialog } from '@/components/edit-client-dialog'
import { ClientShareLink } from '@/components/client-share-link'
import { ClientLinks } from '@/components/client-links'
import { StickyNotes } from '@/components/sticky-notes'
import { Reminders } from '@/components/reminders'
import { getClientSchemas } from '@/lib/actions/schema'
import type { ClientSchema } from '@/lib/supabase'
import { AdvisorInternalTab } from '@/components/advisor-internal-tab'
import { ClientMeetings } from '@/components/client-meetings'
import { CreateMeetingDialog } from '@/components/create-meeting-dialog'
import { CreateTaskDialog } from '@/components/create-task-dialog'
import { CreatePaymentDialog } from '@/components/create-payment-dialog'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'
import { UnifiedTimeline } from '@/components/unified-timeline'
import { ClientAnalytics } from '@/components/client-analytics'
import { GoogleDriveViewer } from '@/components/google-drive-viewer'
import { ErrorBoundary } from '@/components/error-boundary'
import { ClientCalendar } from '@/components/client-calendar'
import { InternalChat } from '@/components/internal-chat'

const BillingPayments = dynamic(() => import('@/components/billing-payments').then(m => ({ default: m.BillingPayments })), {
  loading: () => <LoadingSkeleton />,
})
const ModuleManager = dynamic(() => import('@/components/module-manager').then(m => ({ default: m.ModuleManager })), {
  loading: () => <LoadingSkeleton />,
})
const BranchTablesTab = dynamic(() => import('@/components/branch-tables-tab').then(m => ({ default: m.BranchTablesTab })), {
  loading: () => <LoadingSkeleton />,
})
const SubClientsTab = dynamic(() => import('@/components/sub-clients-tab').then(m => ({ default: m.SubClientsTab })), {
  loading: () => <LoadingSkeleton />,
})
const CredentialsVault = dynamic(() => import('@/components/credentials-vault').then(m => ({ default: m.CredentialsVault })), {
  loading: () => <LoadingSkeleton />,
})

function LoadingSkeleton() {
  return <div className="py-12 text-center text-grey/50 animate-pulse font-bold">⏳ טוען...</div>
}

export default function ClientDetailPage() {
  const params = useParams()
  const router = useRouter()
  const clientId = params.id as string

  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [clientSchemas, setClientSchemas] = useState<ClientSchema[]>([])
  const [schemasLoading, setSchemasLoading] = useState(true)
  const [childCount, setChildCount] = useState(0)
  const [parentClient, setParentClient] = useState<Client | null>(null)
  const [activeTab, setActiveTab] = useState('overview')

  const loadClient = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase.from('clients').select('*').eq('id', clientId).single()
      if (error) throw error
      if (!data) throw new Error('Client not found')
      setClient(data)
      const { count } = await supabase.from('clients').select('*', { count: 'exact', head: true }).eq('parent_id', data.id)
      setChildCount(count || 0)
      if (data.parent_id) {
        const { data: parent } = await supabase.from('clients').select('*').eq('id', data.parent_id).single()
        setParentClient(parent || null)
      } else { setParentClient(null) }
    } catch (err) {
      console.error('Error loading client:', err)
      setError('שגיאה בטעינת נתוני הלקוח')
    } finally { setLoading(false) }
  }, [clientId])

  const loadSchemas = useCallback(async () => {
    setSchemasLoading(true)
    try {
      const result = await getClientSchemas(clientId)
      setClientSchemas(result.success && result.schemas ? result.schemas : [])
    } catch { setClientSchemas([]) }
    finally { setSchemasLoading(false) }
  }, [clientId])

  useEffect(() => { Promise.all([loadClient(), loadSchemas()]) }, [loadClient, loadSchemas])

  const handleModuleUpdate = () => loadSchemas()
  const handleClientUpdate = async () => { await loadClient(); await loadSchemas() }

  // Track recently viewed
  useEffect(() => {
    if (!client) return
    const stored = localStorage.getItem('recentlyViewedClients')
    let list: any[] = []
    try { list = stored ? JSON.parse(stored) : [] } catch {}
    const newList = [
      { id: client.id, name: client.name, lastViewed: Date.now() },
      ...list.filter((c: any) => c.id !== client.id)
    ].slice(0, 10)
    localStorage.setItem('recentlyViewedClients', JSON.stringify(newList))
  }, [client])

  if (loading || !client) {
    return (
      <div className="p-8 space-y-6 animate-pulse" dir="rtl">
        <div className="h-6 w-48 bg-grey/10 rounded-lg" />
        <div className="h-32 bg-grey/10 rounded-3xl" />
        <div className="h-12 w-80 bg-grey/10 rounded-xl" />
        <div className="h-64 bg-grey/10 rounded-3xl" />
      </div>
    )
  }

  const schemasByBranch = new Map<string | null, ClientSchema[]>()
  clientSchemas.forEach(s => {
    const b = s.branch_name || null
    if (!schemasByBranch.has(b)) schemasByBranch.set(b, [])
    schemasByBranch.get(b)!.push(s)
  })
  const branches = Array.from(schemasByBranch.keys()).sort((a, b) => {
    if (a === null) return -1; if (b === null) return 1; return a.localeCompare(b, 'he')
  })

  const statusColor = client.status === 'פעיל' ? 'emerald' : client.status === 'ליד' ? 'blue' : 'slate'
  const statusColors: Record<string, string> = {
    emerald: 'bg-emerald-500 text-white', blue: 'bg-blue-500 text-white', slate: 'bg-slate-400 text-white'
  }

  return (
    <div className="min-h-screen bg-slate-50/50 flex overflow-hidden" dir="rtl">
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-500">
      {/* Compact Breadcrumbs */}
      <div className="px-6 sm:px-10 pt-6 pb-2 flex items-center gap-1.5 text-xs font-bold text-grey">
        <button onClick={() => router.push('/')} className="hover:text-primary transition-colors">היום שלי</button>
        <ArrowRight className="h-3 w-3 rotate-180" />
        <button onClick={() => router.push('/clients')} className="hover:text-primary transition-colors">לקוחות</button>
        {parentClient && (<>
          <ArrowRight className="h-3 w-3 rotate-180" />
          <button onClick={() => router.push(`/clients/${parentClient.id}`)} className="hover:text-primary transition-colors">{parentClient.name}</button>
        </>)}
        <ArrowRight className="h-3 w-3 rotate-180" />
        <span className="text-navy">{client.name}</span>
      </div>

      {/* Client Header */}
      <div className="px-6 sm:px-10 pb-6">
        <div className="bg-white border border-border/40 rounded-3xl p-6 shadow-lg shadow-navy/5 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-l from-blue-50/50 via-transparent to-transparent pointer-events-none" />
          
          <div className="relative flex flex-col md:flex-row items-start md:items-center gap-5">
            {/* Avatar */}
            <div className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-lg shrink-0",
              `bg-${statusColor}-600`
            )} style={{ backgroundColor: statusColor === 'emerald' ? '#059669' : statusColor === 'blue' ? '#2563eb' : '#64748b' }}>
              {client.name.charAt(0)}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <h1 className="text-2xl font-black text-navy tracking-tight">{client.name}</h1>
                <span className={cn("px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider", statusColors[statusColor])}>
                  {client.status}
                </span>
                {childCount > 0 && (
                  <span className="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-600 text-[10px] font-black">📂 {childCount} ענפים</span>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-grey font-medium flex-wrap">
                {client.phone && (
                  <a href={`tel:${client.phone}`} className="flex items-center gap-1.5 hover:text-primary transition-colors">
                    <Phone className="h-3.5 w-3.5" /><span dir="ltr">{client.phone}</span>
                  </a>
                )}
                {client.email && (
                  <a href={`mailto:${client.email}`} className="flex items-center gap-1.5 hover:text-primary transition-colors">
                    <Mail className="h-3.5 w-3.5" />{client.email}
                  </a>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <CreateMeetingDialog clientId={clientId} clientName={client.name} onCreated={handleClientUpdate} trigger={
                <Button size="sm" className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white h-9 px-3 gap-1.5 text-xs font-bold shadow-md shadow-blue-500/20">
                  <Calendar className="h-3.5 w-3.5" />פגישה
                </Button>
              } />
              <CreateTaskDialog clientId={clientId} clientName={client.name} onCreated={handleClientUpdate} trigger={
                <Button size="sm" variant="outline" className="rounded-xl h-9 px-3 gap-1.5 text-xs font-bold border-border/50">
                  <Clock className="h-3.5 w-3.5" />משימה
                </Button>
              } />
              <CreatePaymentDialog clientId={clientId} clientName={client.name} onCreated={handleClientUpdate} trigger={
                <Button size="sm" variant="outline" className="rounded-xl h-9 px-3 gap-1.5 text-xs font-bold border-border/50">
                  <Plus className="h-3.5 w-3.5" />תשלום
                </Button>
              } />
              <EditClientDialog client={client} onUpdate={handleClientUpdate} />
              {!client.parent_id && <ClientShareLink clientId={client.id} clientName={client.name} />}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-6 sm:mx-10 mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
          <span className="text-red-600 font-bold text-sm flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 font-bold text-sm">✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="px-6 sm:px-10 pb-10">
        <ErrorBoundary>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Tab Bar Navigation */}
          <div className="mb-8 relative">
            <div className="overflow-x-auto no-scrollbar">
              <div className="p-1.5 bg-white border border-border/40 rounded-2xl shadow-sm w-max min-w-full">
                <TabsList className="bg-transparent h-auto p-0 flex gap-0.5 rounded-xl w-max">
                  <TabButton value="overview" label="סקירה" icon={<LayoutDashboard className="h-4 w-4" />} active={activeTab} />
                  <TabButton value="meetings" label="פגישות" icon={<FileText className="h-4 w-4" />} active={activeTab} />
                  <TabButton value="data" label="נתונים" icon={<Database className="h-4 w-4" />} active={activeTab} />
                  <TabButton value="finance" label="כספים" icon={<PiggyBank className="h-4 w-4" />} active={activeTab} />
                  <TabButton value="analytics" label="אנליטיקה" icon={<BarChart3 className="h-4 w-4" />} active={activeTab} />
                  <TabButton value="calendar" label="יומן" icon={<CalendarDays className="h-4 w-4" />} active={activeTab} />
                  <TabButton value="credentials" label="גישות" icon={<Key className="h-4 w-4" />} active={activeTab} />
                  <TabButton value="chat" label="צ'אט" icon={<MessageSquare className="h-4 w-4" />} active={activeTab} />
                  <TabButton value="settings" label="הגדרות" icon={<Settings className="h-4 w-4" />} active={activeTab} />
                </TabsList>
              </div>
            </div>
            {/* fade hints */}
            <div className="pointer-events-none absolute top-0 left-0 h-full w-10 bg-gradient-to-r from-slate-50/50 to-transparent rounded-r-2xl" />
            <div className="pointer-events-none absolute top-0 right-0 h-full w-10 bg-gradient-to-l from-slate-50/50 to-transparent rounded-l-2xl" />
          </div>

          {/* ══ Tab 1: Overview ══ */}
          <TabsContent value="overview" className="mt-0 outline-none animate-fade-in-up">
            <Tabs defaultValue="status" className="w-full">
              <div className="mb-6 border-b border-border/40">
                <TabsList className="bg-transparent h-auto p-0 gap-6 w-full justify-start overflow-x-auto no-scrollbar">
                  <SubTabButton value="status" label="סטטוס פנימי" />
                  <SubTabButton value="reminders" label="משימות פתוחות" />
                  <SubTabButton value="notes" label="פתקים" />
                  <SubTabButton value="timeline" label="ציר זמן מאוחד" />
                </TabsList>
              </div>
              <TabsContent value="status" className="mt-0 outline-none">
                <div className="max-w-5xl mx-auto">
                  <AdvisorInternalTab client={client} onUpdate={handleClientUpdate} />
                </div>
              </TabsContent>
              <TabsContent value="reminders" className="mt-0 outline-none">
                <div className="max-w-5xl mx-auto min-h-[500px]">
                  <SectionCard title="תזכורות / משימות פתוחות" color="amber" icon={<Clock className="h-4 w-4" />}>
                    <Reminders clientId={clientId} clientName={client.name} clientEmail={client.email || undefined} />
                  </SectionCard>
                </div>
              </TabsContent>
              <TabsContent value="notes" className="mt-0 outline-none">
                <div className="max-w-5xl mx-auto">
                  <StickyNotes clientId={clientId} />
                </div>
              </TabsContent>
              <TabsContent value="timeline" className="mt-0 outline-none">
                <div className="max-w-5xl mx-auto min-h-[500px]">
                  <SectionCard title="פעילות וציר זמן" color="indigo" icon={<History className="h-4 w-4" />}>
                     <UnifiedTimeline clientId={clientId} />
                  </SectionCard>
                </div>
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* ══ Tab 2: Meetings & Logs ══ */}
          <TabsContent value="meetings" className="mt-0 outline-none animate-fade-in-up">
             <ClientMeetings client={client} onUpdate={handleClientUpdate} includeSubClients={childCount > 0} />
          </TabsContent>

          {/* ══ Tab 3: Data & Modules ══ */}
          <TabsContent value="data" className="mt-0 outline-none animate-fade-in-up">
            <Tabs defaultValue={!client.parent_id ? "subclients" : (branches[0] || "empty")} className="w-full">
              <div className="mb-6 border-b border-border/40">
                <TabsList className="bg-transparent h-auto p-0 gap-6 w-full justify-start overflow-x-auto no-scrollbar">
                  {!client.parent_id && (
                    <SubTabButton value="subclients" label={`תחומי פעילות (${childCount})`} />
                  )}
                  {branches.length === 0 && client.parent_id && (
                    <SubTabButton value="empty" label="טבלאות מידע" />
                  )}
                  {branches.map(branch => (
                    <SubTabButton key={branch || 'main'} value={branch || 'main'} label={branches.length > 1 ? (branch || 'ראשי') : 'טבלאות מידע'} />
                  ))}
                </TabsList>
              </div>

              {!client.parent_id && (
                <TabsContent value="subclients" className="mt-0 outline-none">
                  <div className="max-w-6xl mx-auto">
                    <SectionCard title="תחומי הפעילות של הלקוח" color="purple">
                      <SubClientsTab parentClientId={clientId} parentClientName={client.name} />
                    </SectionCard>
                  </div>
                </TabsContent>
              )}

              {branches.length === 0 ? (
                <TabsContent value="empty" className="mt-0 outline-none">
                  <div className="py-12 text-center bg-white/40 border border-dashed border-border/50 rounded-3xl max-w-5xl mx-auto">
                      <Database className="h-10 w-10 text-slate-300 mx-auto mb-4" />
                      <h4 className="text-lg font-bold text-navy mb-2">אין נתונים עדיין</h4>
                      <p className="text-sm text-grey px-4">אין טבלאות נתונים שמשויכות ללקוח זה. עבור להגדרות הלקוח כדי להפעיל עבורו מודולי נתונים.</p>
                  </div>
                </TabsContent>
              ) : (
                branches.map(branch => (
                  <TabsContent key={branch || 'main'} value={branch || 'main'} className="mt-0 outline-none">
                    <div className="max-w-full mx-auto">
                      <SectionCard title={branches.length > 1 ? (branch || 'ראשי') : 'טבלאות מידע'} color="indigo" icon={<Folder className="h-4 w-4" />}>
                        <BranchTablesTab clientId={clientId} schemas={schemasByBranch.get(branch)!} branchName={branch} onSchemasChanged={loadSchemas} />
                      </SectionCard>
                    </div>
                  </TabsContent>
                ))
              )}
            </Tabs>
          </TabsContent>

          {/* ══ Tab 4: Finance ══ */}
          <TabsContent value="finance" className="mt-0 outline-none animate-fade-in-up">
            <div className="bg-white/40 border border-border/50 rounded-3xl overflow-hidden shadow-sm">
                 <BillingPayments clientId={clientId} clientName={client.name} clientPhone={client.phone} />
            </div>
          </TabsContent>

          {/* ══ Tab 5: Analytics & Insights ══ */}
          <TabsContent value="analytics" className="mt-0 outline-none animate-fade-in-up">
            <div className="max-w-5xl mx-auto">
              <ClientAnalytics clientId={clientId} />
            </div>
          </TabsContent>

          {/* ══ Tab: Calendar ══ */}
          <TabsContent value="calendar" className="mt-0 outline-none animate-fade-in-up">
            <div className="max-w-5xl mx-auto">
              <SectionCard title="לוח שנה" color="blue" icon={<CalendarDays className="h-4 w-4" />}>
                {!schemasLoading && (
                  <ClientCalendar clientId={clientId} clientName={client.name} schemas={clientSchemas} />
                )}
                {schemasLoading && (
                  <div className="h-64 animate-pulse bg-slate-100 rounded-2xl" />
                )}
              </SectionCard>
            </div>
          </TabsContent>

          {/* ══ Tab 5: Credentials & Links ══ */}
          <TabsContent value="credentials" className="mt-0 outline-none animate-fade-in-up">
            <Tabs defaultValue="vault" className="w-full">
              <div className="mb-6 border-b border-border/40">
                <TabsList className="bg-transparent h-auto p-0 gap-6 w-full justify-start overflow-x-auto no-scrollbar">
                  <SubTabButton value="vault" label="כספת סיסמאות" />
                  <SubTabButton value="links" label="קישורים מהירים" />
                  <SubTabButton value="drive" label="Google Drive" />
                </TabsList>
              </div>
              <TabsContent value="vault" className="mt-0 outline-none">
                <div className="max-w-5xl mx-auto">
                  <SectionCard title="כספת סיסמאות" color="slate" icon={<Lock className="h-4 w-4" />}>
                    <CredentialsVault clientId={clientId} />
                  </SectionCard>
                </div>
              </TabsContent>
              <TabsContent value="links" className="mt-0 outline-none">
                <div className="max-w-5xl mx-auto">
                  <SectionCard title="קישורים מהירים" color="blue" icon={<Link2 className="h-4 w-4" />}>
                    <ClientLinks clientId={clientId} />
                  </SectionCard>
                </div>
              </TabsContent>
              <TabsContent value="drive" className="mt-0 outline-none">
                <div className="max-w-5xl mx-auto">
                  <SectionCard title="Google Drive" color="indigo" icon={<HardDrive className="h-4 w-4" />}>
                    <GoogleDriveViewer />
                  </SectionCard>
                </div>
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* ══ Tab: Chat ══ */}
          <TabsContent value="chat" className="mt-0 outline-none animate-fade-in-up">
            <div className="max-w-2xl mx-auto">
              <SectionCard title={`צ'אט עם ${client.name}`} color="blue" icon={<MessageSquare className="h-4 w-4" />}>
                <InternalChat
                  clientId={clientId}
                  clientName={client.name}
                  viewerType="advisor"
                  viewerId="advisor"
                  viewerName="יועץ"
                  otherType="client"
                  otherId={clientId}
                  otherName={client.name}
                />
              </SectionCard>
            </div>
          </TabsContent>

          {/* ══ Tab 6: Settings ══ */}
          <TabsContent value="settings" className="mt-0 outline-none animate-fade-in-up">
            <div className="max-w-2xl">
                <SectionCard title="הגדרות מודולים ונתונים" color="slate" icon={<Settings className="h-4 w-4" />}>
                  <p className="text-sm text-grey mb-6">בחר אילו טבלאות ומידע תרצה לנהל תחת תיק הלקוח הזה.</p>
                  <ModuleManager clientId={clientId} onModuleUpdate={handleModuleUpdate} />
                </SectionCard>
            </div>
          </TabsContent>

        </Tabs>
        </ErrorBoundary>
      </div>

      </div>
    </div>
  )
}


/* ── Sub-components ── */

function TabButton({ value, label, icon, active }: { value: string; label: string; icon: React.ReactNode; active: string }) {
  const isActive = active === value
  return (
    <TabsTrigger
      value={value}
      className={cn(
        "rounded-xl px-3 sm:px-5 py-2.5 font-bold text-xs sm:text-sm transition-all focus:ring-0 focus:outline-none flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0",
        isActive
          ? "bg-navy text-white shadow-md shadow-navy/20"
          : "text-grey hover:text-navy hover:bg-slate-50 data-[state=active]:bg-navy data-[state=active]:text-white"
      )}
    >
      {icon}
      {label}
    </TabsTrigger>
  )
}

function SubTabButton({ value, label }: { value: string; label: string }) {
  return (
    <TabsTrigger
      value={value}
      className="rounded-none border-b-2 border-transparent px-2 py-2 font-bold text-sm text-grey transition-all hover:text-navy data-[state=active]:border-primary data-[state=active]:text-primary focus:ring-0 focus:outline-none"
    >
      {label}
    </TabsTrigger>
  )
}

function SectionCard({ title, color, icon, children }: { title: string; color: string; icon?: React.ReactNode; children: React.ReactNode }) {
  const colorsMap: Record<string, string> = {
    indigo: 'bg-indigo-500', purple: 'bg-purple-500', blue: 'bg-blue-500',
    amber: 'bg-amber-500', slate: 'bg-slate-400', emerald: 'bg-emerald-500'
  }
  return (
    <div className="bg-white border border-border/40 rounded-3xl overflow-hidden shadow-sm h-full flex flex-col">
      <div className="px-5 py-4 border-b border-border/30 flex items-center gap-3 bg-slate-50/50">
        <div className={cn("w-1.5 h-6 rounded-full shrink-0", colorsMap[color] || 'bg-slate-400')} />
        {icon && <div className={cn("text-slate-400 shrink-0")}>{icon}</div>}
        <h3 className="text-base font-black text-navy">{title}</h3>
      </div>
      <div className="p-5 flex-1 flex flex-col">{children}</div>
    </div>
  )
}
