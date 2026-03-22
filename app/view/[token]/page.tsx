'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getClientByShareToken, getClientShareToken } from '@/lib/actions/client-share'
import { supabase, type ClientSchema } from '@/lib/supabase'
import { BillingPaymentsPublicView } from '@/components/billing-payments-public-view'
import { RefreshCw, ArrowRight } from 'lucide-react'

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
        // Load client data
        const result = await getClientByShareToken(token)
        if (!result.success || !result.client) {
          setError(result.error || 'לא ניתן לטעון את המידע')
          return
        }
        setClient(result.client)

        // Load schemas (if visible)
        // We need to fetch schemas only if user has access to at least one module
        // But for now we fetch all and filter in render, or better fetch and filter
        const { data: schemas } = await supabase
          .from('client_schemas')
          .select('*')
          .eq('client_id', result.client.id)

        if (schemas) {
          setClientSchemas(schemas)
        }

        // Set initial active tab based on permissions (avoids flash)
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

        // Fetch parent details if it's a sub-client
        if (result.client.parent_id) {
          const { data: parent } = await supabase
            .from('clients')
            .select('name')
            .eq('id', result.client.parent_id)
            .single()

          if (parent) {
            setParentName(parent.name)
            const shareRes = await getClientShareToken(result.client.parent_id)
            if (shareRes.success && shareRes.token) {
              setParentToken(shareRes.token)
            }
          }
        }

      } catch (err: any) {
        setError(err.message || 'שגיאה בטעינת המידע')
      } finally {
        setLoading(false)
      }
    }

    if (token) {
      loadData()
    }
  }, [token])

  // Permission Logic - Moved up to be before conditional returns
  const permissions = client?.share_permissions || {
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

  const showSubClients = permissions.show_sub_clients ?? true
  const isReadOnly = !permissions.allow_edit

  // Group schemas by branch for tabs (similar to main dashboard)
  const schemasByBranch = new Map<string | null, ClientSchema[]>()
  clientSchemas.forEach(schema => {
    // Check if module is allowed
    if (permissions.allowed_modules.includes(schema.module_name)) {
      const branch = schema.branch_name || null
      if (!schemasByBranch.has(branch)) {
        schemasByBranch.set(branch, [])
      }
      schemasByBranch.get(branch)!.push(schema)
    }
  })

  // Sort branches
  const branches = Array.from(schemasByBranch.keys()).sort((a, b) => {
    if (a === null) return -1
    if (b === null) return 1
    return a.localeCompare(b, 'he')
  })

  // Compute first available tab synchronously (no flash)
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50" dir="rtl">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-grey">טוען נתונים...</p>
        </div>
      </div>
    )
  }

  if (error || !client) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50" dir="rtl">
        <Card className="p-8 max-w-md">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">שגיאה</h1>
            <p className="text-grey mb-4">{error || 'קישור לא תקין או שפג תוקף'}</p>
            <p className="text-sm text-grey">אנא צור קשר עם המנהל לקבלת קישור חדש</p>
          </div>
        </Card>
      </div>
    )
  }


  if (!firstAvailableTab) {
    return (
      <div className="min-h-screen bg-gray-50" dir="rtl">
        <div className="bg-white border-b shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <h1 className="text-3xl font-bold text-navy">{client.name}</h1>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center text-grey">
          אין מידע זמין לצפייה.
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {parentToken && parentName && (
            <div className="mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/view/${parentToken}`)}
                className="gap-2 text-grey hover:text-primary rounded-xl hover:bg-primary/5 px-2 -ml-2"
              >
                <ArrowRight className="h-4 w-4" />
                חזרה ל{parentName}
              </Button>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-navy">{client.name}</h1>
              <p className="text-grey mt-1">צפייה במידע לקוח {isReadOnly && '(מצב צפייה בלבד)'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white p-1 rounded-lg border flex-wrap h-auto">
            {permissions.show_overview && <TabsTrigger value="overview">סקירה כללית</TabsTrigger>}
            {permissions.show_billing && <TabsTrigger value="payments">תשלומים</TabsTrigger>}

            {branches.map((branch) => (
              <TabsTrigger key={branch || 'ראשי'} value={branch || 'ראשי'} className="whitespace-nowrap">
                {branch || 'ראשי'}
              </TabsTrigger>
            ))}

            {showSubClients && <TabsTrigger value="sub-clients">לקוחות משנה</TabsTrigger>}
            {permissions.show_credentials && <TabsTrigger value="credentials">סיסמאות</TabsTrigger>}
            {permissions.show_notes && <TabsTrigger value="notes">פתקים</TabsTrigger>}
            {permissions.show_calendar && <TabsTrigger value="calendar">יומן</TabsTrigger>}
            {permissions.show_links && <TabsTrigger value="links">קישורים</TabsTrigger>}
          </TabsList>

          {permissions.show_overview && (
            <TabsContent value="overview">
              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4">פרטי לקוח</h2>
                <div className="space-y-3">
                  <div>
                    <span className="text-sm text-grey">שם:</span>
                    <span className="mr-2 font-medium">{client.name}</span>
                  </div>
                  {client.email && (
                    <div>
                      <span className="text-sm text-grey">אימייל:</span>
                      <span className="mr-2 font-medium">{client.email}</span>
                    </div>
                  )}
                  {client.phone && (
                    <div>
                      <span className="text-sm text-grey">טלפון:</span>
                      <span className="mr-2 font-medium">{client.phone}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-sm text-grey">סטטוס:</span>
                    <span className="mr-2 font-medium">{client.status || 'פעיל'}</span>
                  </div>
                </div>
              </Card>
            </TabsContent>
          )}

          {permissions.show_billing && (
            <TabsContent value="payments">
              <BillingPaymentsPublicView clientId={client.id} readOnly={isReadOnly} highlightId={highlightRecordId || undefined} />
            </TabsContent>
          )}

          {/* Dynamic tabs for each branch (Modules) */}
          {branches.map((branch) => (
            <TabsContent key={branch || 'ראשי'} value={branch || 'ראשי'}>
              {/* Re-using the same component but passing readOnly */}
              {/* We need to update BranchTablesTab or similar to accept readOnly */}
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
            <TabsContent value="sub-clients">
              <PublicSubClients clientId={client.id} clientName={client.name} readOnly={isReadOnly} />
            </TabsContent>
          )}

          {permissions.show_credentials && (
            <TabsContent value="credentials">
              <PublicCredentials clientId={client.id} readOnly={isReadOnly} />
            </TabsContent>
          )}

          {permissions.show_notes && (
            <TabsContent value="notes">
              <div className="space-y-6">
                <PublicNotes clientId={client.id} readOnly={isReadOnly} />
              </div>
            </TabsContent>
          )}

          {permissions.show_calendar && (
            <TabsContent value="calendar">
              <PublicCalendar clientId={client.id} clientName={client.name} schemas={clientSchemas} readOnly={isReadOnly} />
            </TabsContent>
          )}

          {permissions.show_links && (
            <TabsContent value="links">
              <PublicLinks clientId={client.id} readOnly={isReadOnly} />
            </TabsContent>
          )}

        </Tabs>
      </div>

    </div>
  )
}

// Stub components for public view logic - in real implementation we refactor existing or create new wrappers
// For now I will import existing and update them, or create these wrappers in separate files
// To keep things clean, I'll update this file to import the actual components and I'll need to update them to accept readOnly
import { BranchTablesTab } from '@/components/branch-tables-tab'
import { CredentialsVault } from '@/components/credentials-vault'
import { StickyNotes } from '@/components/sticky-notes'
import { Reminders } from '@/components/reminders'
import { SubClientsTab } from '@/components/sub-clients-tab'
import { ClientCalendar } from '@/components/client-calendar'
import { ClientLinks } from '@/components/client-links'
import { GoogleDriveViewer } from '@/components/google-drive-viewer'

// Wrapper components to adapt props or logic
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
      <div className="border-t pt-6">
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
      <div className="border-t pt-6">
        <GoogleDriveViewer />
      </div>
    </div>
  )
}

