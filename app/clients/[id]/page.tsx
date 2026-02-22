'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowRight, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { supabase, type Client } from '@/lib/supabase'
import { EditClientDialog } from '@/components/edit-client-dialog'
import { CredentialsVault } from '@/components/credentials-vault'
import { BillingPayments } from '@/components/billing-payments'
import { ClientShareLink } from '@/components/client-share-link'
import { ClientLinks } from '@/components/client-links'
import { StickyNotes } from '@/components/sticky-notes'
import { Reminders } from '@/components/reminders'
import { ModuleManager } from '@/components/module-manager'
import { ModuleDataTab } from '@/components/module-data-tab'
import { BranchTablesTab } from '@/components/branch-tables-tab'
import { SubClientsTab } from '@/components/sub-clients-tab'
import { getClientSchemas } from '@/lib/actions/schema'
import type { ClientSchema } from '@/lib/supabase'
import { ChatWidget } from '@/components/chat/chat-widget'
import { Timeline } from '@/components/timeline'

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

      // Check if this client has children
      const { count } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('parent_id', data.id)
      setChildCount(count || 0)

      // Check if this client has a parent
      if (data.parent_id) {
        const { data: parent } = await supabase
          .from('clients')
          .select('*')
          .eq('id', data.parent_id)
          .single()
        setParentClient(parent || null)
      } else {
        setParentClient(null)
      }
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
    <div className="p-6 sm:p-10 bg-slate-50/50 min-h-screen" dir="rtl">
      {/* Premium Breadcrumbs */}
      <div className="mb-8 flex items-center gap-2 text-sm animate-fade-in-up">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/')}
          className="gap-2 text-grey hover:text-primary rounded-xl hover:bg-primary/5 px-3"
        >
          <ArrowRight className="h-4 w-4" />
          לוח בקרה
        </Button>
        {parentClient && (
          <>
            <div className="h-4 w-px bg-border/50 rotate-12 mx-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/clients/${parentClient.id}`)}
              className="gap-2 text-grey hover:text-primary rounded-xl hover:bg-primary/5 px-3"
            >
              {parentClient.name}
            </Button>
          </>
        )}
        <div className="h-4 w-px bg-border/50 rotate-12 mx-1" />
        <span className="font-bold text-navy px-3">{client.name}</span>
      </div>

      {/* Glassmorphism Header & Quick Stats */}
      <div className="mb-10 animate-fade-in-up delay-100">
        <div className="bg-white/70 backdrop-blur-xl border border-border/50 rounded-[2.5rem] p-6 sm:p-8 shadow-xl shadow-navy/5 flex flex-col lg:flex-row items-center justify-between gap-8 relative overflow-hidden group">
          {/* Decorative background element */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl transition-transform duration-1000 group-hover:scale-110" />

          <div className="flex flex-col sm:flex-row items-center gap-6 relative z-10 flex-1 w-full lg:w-auto">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white text-3xl font-black shadow-lg shadow-primary/20 shrink-0 transform -rotate-3 group-hover:rotate-0 transition-transform duration-500">
              {client.name.charAt(0)}
            </div>

            <div className="text-center sm:text-right flex-1">
              <div className="flex items-center justify-center sm:justify-start gap-4 mb-2 flex-wrap">
                <h1 className="text-4xl font-black text-navy tracking-tight">{client.name}</h1>
                {!client.parent_id && (
                  <ClientShareLink clientId={client.id} clientName={client.name} />
                )}
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-sm font-bold">
                <div className="flex items-center gap-2 py-1.5 px-3 rounded-full bg-slate-100/80 border border-slate-200/50 text-slate-600 shadow-xs">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  ID: <span className="font-mono text-xs opacity-70">{client.id.substring(0, 8)}</span>
                </div>
                {client.status && (
                  <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${client.status === 'פעיל' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                    client.status === 'ליד' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                      'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}>
                    {client.status}
                  </span>
                )}
                {childCount > 0 && (
                  <div className="px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-xs">
                    👥 {childCount} לקוחות משנה
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch gap-3 w-full lg:w-auto relative z-10">
            <div className="flex flex-col gap-2 bg-slate-50/80 rounded-3xl p-4 border border-slate-200/50 flex-1 min-w-[200px] hover:bg-white transition-colors duration-300">
              <div className="flex items-center justify-between gap-10">
                <span className="text-[10px] font-black text-grey uppercase tracking-widest">פרטי התקשרות</span>
                <div className="w-8 h-8 rounded-xl bg-white shadow-sm flex items-center justify-center"><Phone className="h-4 w-4 text-primary" /></div>
              </div>
              <div className="space-y-1">
                {client.email && <p className="text-xs font-bold text-navy truncate">{client.email}</p>}
                {client.phone && <p className="text-sm font-black text-primary tracking-tight" dir="ltr">{client.phone}</p>}
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 shrink-0">
              <EditClientDialog client={client} onUpdate={handleClientUpdate} />
            </div>
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
          <Tabs defaultValue={defaultTab} className="w-full animate-fade-in-up delay-200">
            {/* Main Categories Navigation */}
            <div className="bg-white/50 backdrop-blur-md border border-border/50 p-2 rounded-[2rem] mb-6 shadow-sm overflow-hidden auto-cols-auto gap-2 grid grid-cols-2 md:grid-cols-4 w-full">
              <TabsList className="bg-transparent h-auto p-0 flex gap-2 w-full col-span-2 md:col-span-4 justify-start overflow-x-auto no-scrollbar pb-1">

                {/* Entities Category */}
                <div className="flex items-center bg-slate-100/50 rounded-2xl p-1 gap-1 border border-slate-200/50 shrink-0">
                  <div className="px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400 rotate-180" style={{ writingMode: 'vertical-rl' }}>ישויות ומידע</div>
                  {branches.map((branch) => (
                    <TabsTrigger
                      key={branch || 'ראשי'}
                      value={branch || 'ראשי'}
                      className="rounded-xl px-5 py-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md text-grey font-bold transition-all text-sm"
                    >
                      {branch || 'ראשי'}
                    </TabsTrigger>
                  ))}
                  {!client.parent_id && (
                    <TabsTrigger
                      value="sub-clients"
                      className="rounded-xl px-5 py-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md text-grey font-bold transition-all text-sm"
                    >
                      משנה{childCount > 0 ? ` (${childCount})` : ''}
                    </TabsTrigger>
                  )}
                </div>

                {/* Financial Category */}
                <div className="flex items-center bg-emerald-50/50 rounded-2xl p-1 gap-1 border border-emerald-100/50 shrink-0">
                  <div className="px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-600/50 rotate-180" style={{ writingMode: 'vertical-rl' }}>כספים</div>
                  <TabsTrigger
                    value="billing"
                    className="rounded-xl px-5 py-2 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-md text-slate-500 font-bold transition-all text-sm"
                  >
                    תשלומים ויעדים
                  </TabsTrigger>
                </div>

                {/* Resources Category */}
                <div className="flex items-center bg-purple-50/50 rounded-2xl p-1 gap-1 border border-purple-100/50 shrink-0">
                  <div className="px-3 py-1 text-[10px] font-black uppercase tracking-widest text-purple-600/50 rotate-180" style={{ writingMode: 'vertical-rl' }}>משאבים</div>
                  <TabsTrigger
                    value="notes"
                    className="rounded-xl px-5 py-2 data-[state=active]:bg-amber-600 data-[state=active]:text-white data-[state=active]:shadow-md text-slate-500 font-bold transition-all text-sm"
                  >
                    פעילות ופתקים
                  </TabsTrigger>
                  <TabsTrigger
                    value="links"
                    className="rounded-xl px-5 py-2 data-[state=active]:bg-purple-500 data-[state=active]:text-white data-[state=active]:shadow-md text-grey font-bold transition-all text-sm"
                  >
                    קישורים
                  </TabsTrigger>
                  <TabsTrigger
                    value="credentials"
                    className="rounded-xl px-5 py-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md text-grey font-bold transition-all text-sm"
                  >
                    סיסמאות
                  </TabsTrigger>
                </div>

                {/* Settings Category */}
                <div className="flex items-center bg-slate-800/5 rounded-2xl p-1 gap-1 border border-slate-800/10 shrink-0">
                  <TabsTrigger
                    value="settings"
                    className="rounded-xl px-5 py-2 data-[state=active]:bg-slate-700 data-[state=active]:text-white data-[state=active]:shadow-md text-grey font-bold transition-all text-sm"
                  >
                    הגדרות מודולים
                  </TabsTrigger>
                </div>

              </TabsList>
            </div>

            {/* Dynamic tabs for each branch */}
            {branches.map((branch) => (
              <TabsContent key={branch || 'ראשי'} value={branch || 'ראשי'} className="mt-0 outline-none">
                <BranchTablesTab
                  clientId={clientId}
                  schemas={schemasByBranch.get(branch)!}
                  branchName={branch}
                  onSchemasChanged={loadSchemas}
                />
              </TabsContent>
            ))}

            {!client.parent_id && (
              <TabsContent value="sub-clients" className="mt-0 outline-none">
                <SubClientsTab parentClientId={clientId} parentClientName={client.name} />
              </TabsContent>
            )}

            <TabsContent value="billing" className="mt-0 outline-none">
              <BillingPayments
                clientId={clientId}
                clientName={client.name}
                clientPhone={client.phone}
              />
            </TabsContent>

            <TabsContent value="notes" className="mt-0 outline-none">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <StickyNotes clientId={clientId} />
                  <div className="bg-white/40 backdrop-blur-md rounded-[2.5rem] border border-border/50 p-6 shadow-sm">
                    <Reminders clientId={clientId} clientName={client.name} />
                  </div>
                </div>
                <div className="bg-white/40 backdrop-blur-md rounded-[2.5rem] border border-border/50 p-6 shadow-sm">
                  <h3 className="text-xl font-black text-navy tracking-tight mb-6">ציר זמן פעילות</h3>
                  <div className="max-h-[600px] overflow-y-auto pr-2 no-scrollbar">
                    <Timeline clientId={clientId} />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="links" className="mt-0 outline-none">
              <ClientLinks clientId={clientId} />
            </TabsContent>

            <TabsContent value="credentials" className="mt-0 outline-none">
              <CredentialsVault clientId={clientId} />
            </TabsContent>

            <TabsContent value="settings" className="mt-0 outline-none">
              <ModuleManager clientId={clientId} onModuleUpdate={handleModuleUpdate} />
            </TabsContent>
          </Tabs>
        )
      })()}

      <ChatWidget
        clientId={client.parent_id || client.id}
        clientName={parentClient?.name || client.name}
        senderRole='admin'
      />
    </div>
  )
}

