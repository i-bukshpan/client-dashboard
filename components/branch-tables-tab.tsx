import { useState, useEffect } from 'react'
import { ModuleDataTab } from './module-data-tab'
import { BranchDashboard } from './branch-dashboard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { ClientSchema } from '@/lib/supabase'
import { CalendarLinkButton } from './client-calendar'

interface BranchTablesTabProps {
  clientId: string
  schemas: ClientSchema[]
  branchName: string | null // null = ראשי
  readOnly?: boolean
  activeModule?: string | null
  highlightId?: string | null
  onSchemasChanged?: () => void
}

export function BranchTablesTab({ clientId, schemas, branchName, readOnly = false, activeModule, highlightId, onSchemasChanged }: BranchTablesTabProps) {
  const [currentTab, setCurrentTab] = useState('dashboard')

  // Update current tab when activeModule prop changes
  useEffect(() => {
    if (activeModule) {
      setCurrentTab(activeModule)
    }
  }, [activeModule])

  if (schemas.length === 0 && readOnly) {
    return (
      <div className="p-6 text-center text-grey">
        <p>אין טבלאות בתחום זה</p>
      </div>
    )
  }

  return (
    <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
      <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4 bg-white/40 backdrop-blur-md p-2 rounded-[2rem] border border-border/50">
        <TabsList className="bg-transparent h-auto gap-1 p-0 flex-nowrap overflow-x-auto no-scrollbar">
          <TabsTrigger
            value="dashboard"
            className="rounded-xl px-5 py-2 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm text-grey font-bold transition-all"
          >
            דשבורד
          </TabsTrigger>
          {schemas.map((schema) => (
            <TabsTrigger
              key={schema.id}
              value={schema.module_name}
              className="rounded-xl px-5 py-2 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm text-grey font-bold transition-all"
            >
              {schema.module_name}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      <TabsContent value="dashboard">
        <BranchDashboard clientId={clientId} branchName={branchName} schemas={schemas} readOnly={readOnly} />
      </TabsContent>
      {schemas.map((schema) => (
        <TabsContent key={schema.id} value={schema.module_name}>
          {!readOnly && (
            <div className="flex justify-end mb-3">
              <CalendarLinkButton clientId={clientId} schema={schema} allSchemas={schemas} />
            </div>
          )}
          <ModuleDataTab
            clientId={clientId}
            moduleType={schema.module_name}
            branchName={schema.branch_name || undefined}
            readOnly={readOnly}
            highlightId={activeModule === schema.module_name ? highlightId : undefined}
          />
        </TabsContent>
      ))}
    </Tabs>
  )
}
