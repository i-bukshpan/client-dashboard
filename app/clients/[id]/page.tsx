'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { supabase, type Client } from '@/lib/supabase'
import { EditClientDialog } from '@/components/edit-client-dialog'
import { CredentialsVault } from '@/components/credentials-vault'
import { BillingPayments } from '@/components/billing-payments'
import { ClientShareLink } from '@/components/client-share-link'
import { StickyNotes } from '@/components/sticky-notes'
import { Reminders } from '@/components/reminders'
import { ModuleManager } from '@/components/module-manager'
import { ModuleDataTab } from '@/components/module-data-tab'
import { BranchTablesTab } from '@/components/branch-tables-tab'
import { getClientSchemas } from '@/lib/actions/schema'
import type { ClientSchema } from '@/lib/supabase'
import { ChatWidget } from '@/components/chat/chat-widget'

export default function ClientDetailPage() {
  const params = useParams()
  const router = useRouter()
  const clientId = params.id as string

  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [clientSchemas, setClientSchemas] = useState<ClientSchema[]>([])
  const [schemasLoading, setSchemasLoading] = useState(true)

  const loadClient = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single()

      if (error) {
        throw error
      }

      if (!data) {
        throw new Error('Client not found')
      }

      setClient(data)
    } catch (error) {
      console.error('Error loading client:', error)
      setError('שגיאה בטעינת נתוני הלקוח')
    } finally {
      setLoading(false)
    }
  }, [clientId])

  const loadSchemas = useCallback(async () => {
    setSchemasLoading(true)
    try {
      const result = await getClientSchemas(clientId)
      if (result.success && result.schemas) {
        setClientSchemas(result.schemas)
      } else {
        setClientSchemas([])
      }
    } catch (error) {
      console.error('Error loading schemas:', error)
      setClientSchemas([])
    } finally {
      setSchemasLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    loadClient()
    loadSchemas()
  }, [loadClient, loadSchemas])

  const handleModuleUpdate = () => {
    loadSchemas()
  }

  const handleClientUpdate = async () => {
    await loadClient()
    await loadSchemas()
  }

  if (!client) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <p className="text-grey">טוען נתוני לקוח...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.push('/')} className="gap-2">
          <ArrowRight className="h-4 w-4" />
          חזרה ללוח הבקרה
        </Button>
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-navy mb-2">{client.name}</h1>
            <ClientShareLink clientId={client.id} clientName={client.name} />
            <div className="flex items-center gap-4 text-sm text-grey flex-wrap">
              {client.email && <span>אימייל: {client.email}</span>}
              {client.phone && <span>• טלפון: {client.phone}</span>}
              {client.status && (
                <span className={`px-2 py-1 rounded text-xs font-medium ${client.status === 'פעיל' ? 'bg-green-100 text-green-700' :
                  client.status === 'ליד' ? 'bg-blue-100 text-blue-700' :
                    'bg-grey/20 text-grey'
                  }`}>
                  {client.status}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <EditClientDialog client={client} onUpdate={handleClientUpdate} />
          </div>
        </div>

      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="mr-3 flex-1">
              <h3 className="text-sm font-semibold text-red-800 mb-1">שגיאה בטעינת הנתונים</h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="flex-shrink-0 text-red-400 hover:text-red-600"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {loading || schemasLoading ? (
        <div className="text-center py-12">
          <p className="text-grey">טוען נתונים...</p>
        </div>
      ) : (() => {
        // Group schemas by branch_name
        const schemasByBranch = new Map<string | null, ClientSchema[]>()
        clientSchemas.forEach(schema => {
          const branch = schema.branch_name || null
          if (!schemasByBranch.has(branch)) {
            schemasByBranch.set(branch, [])
          }
          schemasByBranch.get(branch)!.push(schema)
        })

        // Sort branches: null (ראשי) first, then alphabetically
        const branches = Array.from(schemasByBranch.keys()).sort((a, b) => {
          if (a === null) return -1
          if (b === null) return 1
          return a.localeCompare(b, 'he')
        })

        const defaultTab = branches.length > 0
          ? (branches[0] === null ? 'ראשי' : branches[0])
          : 'settings'

        return (
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="flex w-full overflow-x-auto gap-1">
              {branches.map((branch) => (
                <TabsTrigger key={branch || 'ראשי'} value={branch || 'ראשי'} className="whitespace-nowrap">
                  {branch || 'ראשי'}
                </TabsTrigger>
              ))}
              <TabsTrigger value="credentials">סיסמאות</TabsTrigger>
              <TabsTrigger value="billing">תשלומים</TabsTrigger>
              <TabsTrigger value="notes">פתקים</TabsTrigger>
              <TabsTrigger value="settings">הגדרות</TabsTrigger>
            </TabsList>

            {/* Dynamic tabs for each branch */}
            {branches.map((branch) => (
              <TabsContent key={branch || 'ראשי'} value={branch || 'ראשי'}>
                <BranchTablesTab
                  clientId={clientId}
                  schemas={schemasByBranch.get(branch)!}
                  branchName={branch}
                />
              </TabsContent>
            ))}

            <TabsContent value="credentials">
              <CredentialsVault clientId={clientId} />
            </TabsContent>
            <TabsContent value="billing">
              <BillingPayments
                clientId={clientId}
                clientName={client.name}
                clientPhone={client.phone}
              />
            </TabsContent>
            <TabsContent value="notes">
              <div className="space-y-6">
                <StickyNotes clientId={clientId} />
                <div className="border-t pt-6">
                  <Reminders clientId={clientId} clientName={client.name} />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="settings">
              <ModuleManager clientId={clientId} onModuleUpdate={handleModuleUpdate} />
            </TabsContent>
          </Tabs>
        )
      })()}

      <ChatWidget clientId={client.id} clientName={client.name} senderRole='admin' />
    </div>
  )
}

