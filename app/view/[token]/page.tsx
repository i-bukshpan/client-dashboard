'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getClientByShareToken } from '@/lib/actions/client-share'
import { supabase, type ClientSchema } from '@/lib/supabase'
import { BillingPaymentsPublicView } from '@/components/billing-payments-public-view'
import { RefreshCw } from 'lucide-react'
import { ChatWidget } from '@/components/chat/chat-widget'

export default function ClientViewPage() {
  const params = useParams()
  const token = params.token as string
  const [client, setClient] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [clientSchemas, setClientSchemas] = useState<ClientSchema[]>([])
  const [activeTab, setActiveTab] = useState('overview')
  const [activeModule, setActiveModule] = useState<string | null>(null)
  const [highlightRecordId, setHighlightRecordId] = useState<string | null>(null)

  // Define defaultTab state to handle initial load or calculation
  const [defaultTab, setDefaultTab] = useState('overview')

  useEffect(() => {
    const handleChatNavigation = (e: CustomEvent) => {
      if (e.detail) {
        // e.detail = { tab, id, subTab }
        if (e.detail.tab) setActiveTab(e.detail.tab)
        // If there is a subTab (like module name), we need to handle it.
        // For now, if tab is 'module', we expect 'subTab' to be the module name?
        // Actually, the current tabs are keyed by 'branchName' (e.g. 'ראשי').
        // The navData for module is { tab: 'module', subTab: 'ראשי', id: ... }?
        // Let's assume the 'tab' property matches the Tab value directly for simplicity
        // billing -> 'payments'
        // module -> 'branchName'
        // credentials -> 'credentials'

        // Mapping logic:
        let targetTab = e.detail.tab
        if (targetTab === 'billing') targetTab = 'payments'
        if (targetTab === 'module') targetTab = e.detail.subTab || 'ראשי'

        if (e.detail.innerTab) {
          setActiveModule(e.detail.innerTab)
        }

        setActiveTab(targetTab)

        if (e.detail.id) {
          setHighlightRecordId(e.detail.id)
          // clear highlight after 3 seconds
          setTimeout(() => setHighlightRecordId(null), 4000)
        }
      }
    }
    // @ts-ignore
    window.addEventListener('chat-navigation', handleChatNavigation)
    // @ts-ignore
    return () => window.removeEventListener('chat-navigation', handleChatNavigation)
  }, [])

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
    allowed_modules: []
  }

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

  useEffect(() => {
    if (!loading && client) {
      let newDefaultTab = 'overview'
      if (!permissions.show_overview) {
        if (permissions.show_billing) newDefaultTab = 'payments'
        else if (branches.length > 0) newDefaultTab = (branches[0] || 'ראשי')
        else if (permissions.show_credentials) newDefaultTab = 'credentials'
        else if (permissions.show_notes) newDefaultTab = 'notes'
        else newDefaultTab = ''
      }
      setDefaultTab(newDefaultTab)
      // Only set active tab if it's the first load (overview) or if current active is invalid?
      // Actually, if we are loading, activeTab is overview.
      // If we switch from loading to loaded, we should set activeTab to default if needed.
      if (activeTab === 'overview' && newDefaultTab !== 'overview') {
        setActiveTab(newDefaultTab)
      }
    }
  }, [loading, client, JSON.stringify(permissions), branches.length])

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


  if (!defaultTab) {
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

            {permissions.show_credentials && <TabsTrigger value="credentials">סיסמאות</TabsTrigger>}
            {permissions.show_notes && <TabsTrigger value="notes">פתקים</TabsTrigger>}
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

        </Tabs>
      </div>

      {client && <ChatWidget clientId={client.id} clientName={client.name} />}
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

// Wrapper components to adapt props or logic
function PublicBranchTables({ clientId, schemas, branchName, readOnly, activeModule, highlightId }: any) {
  return <BranchTablesTab clientId={clientId} schemas={schemas} branchName={branchName} readOnly={readOnly} activeModule={activeModule} highlightId={highlightId} />
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

