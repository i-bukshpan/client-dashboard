'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getClientByShareToken, getClientShareToken } from '@/lib/actions/client-share'
import { supabase, type ClientSchema } from '@/lib/supabase'
import { BillingPaymentsPublicView } from '@/components/billing-payments-public-view'
import { ClientPortalView } from '@/components/client-portal-view'
import { RefreshCw, ArrowRight, Eye, Pencil, Phone, Mail, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function ClientViewPage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string
  const [client, setClient] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [clientSchemas, setClientSchemas] = useState<ClientSchema[]>([])
  const [activeTab, setActiveTab] = useState('overview')
  const [activeModule, setActiveModule] = useState<string | null>(null)
  const [highlightRecordId, setHighlightRecordId] = useState<string | null>(null)
  const [parentToken, setParentToken] = useState<string | null>(null)
  const [parentName, setParentName] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const result = await getClientByShareToken(token)
        if (!result.success || !result.client) {
          setError(result.error || 'לא ניתן לטעון את המידע')
          return
        }
        setClient(result.client)

        const { data: schemas } = await supabase
          .from('client_schemas')
          .select('*')
          .eq('client_id', result.client.id)

        if (schemas) setClientSchemas(schemas)

        const perms = result.client.share_permissions
        if (perms && !perms.show_overview) {
          const allowedSchemas = (schemas || []).filter((s: any) => perms.allowed_modules?.includes(s.module_name))
          const uniqueBranches = Array.from(new Set(allowedSchemas.map((s: any) => s.branch_name || null))) as (string | null)[]
          if (perms.show_billing) setActiveTab('payments')
          else if (uniqueBranches.length > 0) setActiveTab(uniqueBranches[0] || 'ראשי')
          else if (perms.show_sub_clients ?? true) setActiveTab('sub-clients')
          else if (perms.show_credentials) setActiveTab('credentials')
          else if (perms.show_notes) setActiveTab('notes')
          else if (perms.show_calendar) setActiveTab('calendar')
          else if (perms.show_links) setActiveTab('links')
        }

        if (result.client.parent_id) {
          const { data: parent } = await supabase
            .from('clients')
            .select('name')
            .eq('id', result.client.parent_id)
            .single()

          if (parent) {
            setParentName(parent.name)
            const shareRes = await getClientShareToken(result.client.parent_id)
            if (shareRes.success && shareRes.token) setParentToken(shareRes.token)
          }
        }
      } catch (err: any) {
        setError(err.message || 'שגיאה בטעינת המידע')
      } finally {
        setLoading(false)
      }
    }

    if (token) loadData()
  }, [token])

  const permissions = client?.share_permissions || {
    share_enabled: true,
    access_level: 'view' as const,
    allow_edit: false,
    show_overview: true,
    show_billing: true,
    show_credentials: false,
    show_notes: false,
    show_sub_clients: true,
    show_calendar: false,
    show_links: false,
    allowed_modules: []
  }

  // Detect portal mode
  const accessLevel = permissions.access_level || (permissions.allow_edit ? 'edit' : 'view')
  const isPortalMode = accessLevel === 'portal'

  const showSubClients = permissions.show_sub_clients ?? true
  const isReadOnly = accessLevel === 'view'

  const schemasByBranch = new Map<string | null, ClientSchema[]>()
  clientSchemas.forEach(schema => {
    if (permissions.allowed_modules.includes(schema.module_name)) {
      const branch = schema.branch_name || null
      if (!schemasByBranch.has(branch)) schemasByBranch.set(branch, [])
      schemasByBranch.get(branch)!.push(schema)
    }
  })

  const branches = Array.from(schemasByBranch.keys()).sort((a, b) => {
    if (a === null) return -1
    if (b === null) return 1
    return a.localeCompare(b, 'he')
  })

  const firstAvailableTab: string = !permissions.show_overview
    ? permissions.show_billing ? 'payments'
      : branches.length > 0 ? (branches[0] || 'ראשי')
      : showSubClients ? 'sub-clients'
      : permissions.show_credentials ? 'credentials'
      : permissions.show_notes ? 'notes'
      : permissions.show_calendar ? 'calendar'
      : permissions.show_links ? 'links'
      : ''
    : 'overview'

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50" dir="rtl">
        <div className="text-center">
          <div className="w-16 h-16 rounded-3xl bg-white shadow-xl flex items-center justify-center mx-auto mb-6">
            <RefreshCw className="h-7 w-7 animate-spin text-primary" />
          </div>
          <p className="font-bold text-grey">טוען נתונים...</p>
        </div>
      </div>
    )
  }

  if (error || !client) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50" dir="rtl">
        <div className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-[2.5rem] p-10 max-w-md shadow-2xl text-center">
          <div className="w-16 h-16 rounded-3xl bg-rose-50 flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl">🔒</span>
          </div>
          <h1 className="text-xl font-black text-navy mb-3">לא ניתן לגשת</h1>
          <p className="text-grey font-medium mb-2">{error || 'קישור לא תקין או שפג תוקף'}</p>
          <p className="text-sm text-grey/70 font-medium">אנא צור קשר עם המנהל לקבלת קישור עדכני</p>
        </div>
      </div>
    )
  }

  // Portal mode: render full management portal
  if (isPortalMode) {
    return <ClientPortalView client={client} permissions={permissions} clientSchemas={clientSchemas} />
  }

  if (!firstAvailableTab) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50" dir="rtl">
        <ViewHeader client={client} isReadOnly={isReadOnly} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <div className="bg-white/60 backdrop-blur-sm rounded-[2.5rem] border border-border/30 p-16">
            <p className="text-grey font-bold">אין מידע זמין לצפייה.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50" dir="rtl">
      <ViewHeader client={client} isReadOnly={isReadOnly} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="bg-white/80 backdrop-blur-md border border-white/50 rounded-2xl p-1.5 shadow-sm overflow-x-auto">
            <TabsList className="bg-transparent flex gap-1 h-auto w-max min-w-full">
              {permissions.show_overview && <TabsTrigger value="overview" className="rounded-xl font-black text-sm px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm whitespace-nowrap">סקירה כללית</TabsTrigger>}
              {permissions.show_billing && <TabsTrigger value="payments" className="rounded-xl font-black text-sm px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm whitespace-nowrap">תשלומים</TabsTrigger>}
              {branches.map((branch) => (
                <TabsTrigger key={branch || 'ראשי'} value={branch || 'ראשי'} className="rounded-xl font-black text-sm px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm whitespace-nowrap">
                  {branch || 'ראשי'}
                </TabsTrigger>
              ))}
              {showSubClients && <TabsTrigger value="sub-clients" className="rounded-xl font-black text-sm px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm whitespace-nowrap">לקוחות משנה</TabsTrigger>}
              {permissions.show_credentials && <TabsTrigger value="credentials" className="rounded-xl font-black text-sm px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm whitespace-nowrap">סיסמאות</TabsTrigger>}
              {permissions.show_notes && <TabsTrigger value="notes" className="rounded-xl font-black text-sm px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm whitespace-nowrap">פתקים</TabsTrigger>}
              {permissions.show_calendar && <TabsTrigger value="calendar" className="rounded-xl font-black text-sm px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm whitespace-nowrap">יומן</TabsTrigger>}
              {permissions.show_links && <TabsTrigger value="links" className="rounded-xl font-black text-sm px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm whitespace-nowrap">קישורים</TabsTrigger>}
            </TabsList>
          </div>

          {permissions.show_overview && (
            <TabsContent value="overview" className="animate-fade-in-up">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white/70 backdrop-blur-md border border-border/40 rounded-[2.5rem] p-8 shadow-sm space-y-5">
                  <h2 className="text-lg font-black text-navy">פרטי לקוח</h2>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50/70">
                      <span className="text-xs font-black text-grey uppercase tracking-widest w-20">שם</span>
                      <span className="font-bold text-navy">{client.name}</span>
                    </div>
                    {client.email && (
                      <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50/70">
                        <Mail className="h-4 w-4 text-grey" />
                        <span className="font-bold text-navy">{client.email}</span>
                      </div>
                    )}
                    {client.phone && (
                      <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50/70">
                        <Phone className="h-4 w-4 text-grey" />
                        <span className="font-bold text-navy">{client.phone}</span>
                      </div>
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
                    <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50/70">
                      <CalendarDays className="h-4 w-4 text-grey" />
                      <span className="font-bold text-grey text-sm">לקוח מאז {new Date(client.created_at).toLocaleDateString('he-IL')}</span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          )}

          {permissions.show_billing && (
            <TabsContent value="payments" className="animate-fade-in-up">
              <BillingPaymentsPublicView clientId={client.id} readOnly={isReadOnly} highlightId={highlightRecordId || undefined} />
            </TabsContent>
          )}

          {branches.map((branch) => (
            <TabsContent key={branch || 'ראשי'} value={branch || 'ראשי'} className="animate-fade-in-up">
              <PublicBranchTables
                clientId={client.id}
                schemas={schemasByBranch.get(branch)!}
                branchName={branch}
                readOnly={isReadOnly}
                activeModule={activeModule}
                highlightId={highlightRecordId}
              />
            </TabsContent>
          ))}

          {showSubClients && (
            <TabsContent value="sub-clients" className="animate-fade-in-up">
              <PublicSubClients clientId={client.id} clientName={client.name} readOnly={isReadOnly} />
            </TabsContent>
          )}

          {permissions.show_credentials && (
            <TabsContent value="credentials" className="animate-fade-in-up">
              <PublicCredentials clientId={client.id} readOnly={isReadOnly} />
            </TabsContent>
          )}

          {permissions.show_notes && (
            <TabsContent value="notes" className="animate-fade-in-up">
              <PublicNotes clientId={client.id} readOnly={isReadOnly} />
            </TabsContent>
          )}

          {permissions.show_calendar && (
            <TabsContent value="calendar" className="animate-fade-in-up">
              <PublicCalendar clientId={client.id} clientName={client.name} schemas={clientSchemas} readOnly={isReadOnly} />
            </TabsContent>
          )}

          {permissions.show_links && (
            <TabsContent value="links" className="animate-fade-in-up">
              <PublicLinks clientId={client.id} readOnly={isReadOnly} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  )
}

// Header component
function ViewHeader({ client, isReadOnly }: any) {
  const avatarLetter = client?.name?.charAt(0) || '?'
  return (
    <div className="sticky top-0 z-20 bg-white/85 backdrop-blur-xl border-b border-white/50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center gap-4">
          <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center font-black text-lg text-primary shrink-0">
            {avatarLetter}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black text-navy truncate">{client?.name}</h1>
            <p className="text-xs font-medium text-grey">תיק לקוח</p>
          </div>
          <span className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black shrink-0",
            isReadOnly
              ? "bg-blue-50 text-blue-700 border border-blue-100"
              : "bg-emerald-50 text-emerald-700 border border-emerald-100"
          )}>
            {isReadOnly
              ? <><Eye className="h-3 w-3" />צפייה</>
              : <><Pencil className="h-3 w-3" />עריכה</>
            }
          </span>
        </div>
      </div>
    </div>
  )
}

import { BranchTablesTab } from '@/components/branch-tables-tab'
import { CredentialsVault } from '@/components/credentials-vault'
import { StickyNotes } from '@/components/sticky-notes'
import { Reminders } from '@/components/reminders'
import { SubClientsTab } from '@/components/sub-clients-tab'
import { ClientCalendar } from '@/components/client-calendar'
import { ClientLinks } from '@/components/client-links'
import { GoogleDriveViewer } from '@/components/google-drive-viewer'

function PublicBranchTables({ clientId, schemas, branchName, readOnly, activeModule, highlightId }: any) {
  return <BranchTablesTab clientId={clientId} schemas={schemas} branchName={branchName} readOnly={readOnly} activeModule={activeModule} highlightId={highlightId} />
}

function PublicSubClients({ clientId, clientName, readOnly }: any) {
  return <SubClientsTab parentClientId={clientId} parentClientName={clientName} readOnly={readOnly} isPublicView={true} />
}

function PublicCredentials({ clientId, readOnly }: any) {
  return <CredentialsVault clientId={clientId} readOnly={readOnly} />
}

function PublicNotes({ clientId, readOnly }: any) {
  return (
    <div className="space-y-6">
      <StickyNotes clientId={clientId} readOnly={readOnly} />
      <div className="border-t border-border/30 pt-6">
        <Reminders clientId={clientId} clientName="" readOnly={readOnly} />
      </div>
    </div>
  )
}

function PublicCalendar({ clientId, clientName, schemas, readOnly }: any) {
  return <ClientCalendar clientId={clientId} clientName={clientName} schemas={schemas} readOnly={readOnly} />
}

function PublicLinks({ clientId, readOnly }: any) {
  return (
    <div className="space-y-6">
      <ClientLinks clientId={clientId} readOnly={readOnly} />
      <div className="border-t border-border/30 pt-6">
        <GoogleDriveViewer />
      </div>
    </div>
  )
}
