import { useState, useEffect } from 'react'
import { ModuleDataTab } from './module-data-tab'
import { BranchDashboard } from './branch-dashboard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { ClientSchema } from '@/lib/supabase'

interface BranchTablesTabProps {
  clientId: string
  schemas: ClientSchema[]
  branchName: string | null // null = ראשי
  readOnly?: boolean
  activeModule?: string | null
  highlightId?: string | null
}

export function BranchTablesTab({ clientId, schemas, branchName, readOnly = false, activeModule, highlightId }: BranchTablesTabProps) {
  const [currentTab, setCurrentTab] = useState('dashboard')

  // Update current tab when activeModule prop changes
  useEffect(() => {
    if (activeModule) {
      setCurrentTab(activeModule)
    }
  }, [activeModule])
  if (schemas.length === 0) {
    return (
      <div className="p-6 text-center text-grey">
        <p>אין טבלאות בתחום זה</p>
      </div>
    )
  }

  return (
    <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
      <TabsList className="flex w-full overflow-x-auto gap-1 mb-4">
        <TabsTrigger value="dashboard" className="whitespace-nowrap">
          דשבורד
        </TabsTrigger>
        {schemas.map((schema) => (
          <TabsTrigger key={schema.id} value={schema.module_name} className="whitespace-nowrap">
            {schema.module_name}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="dashboard">
        <BranchDashboard clientId={clientId} branchName={branchName} schemas={schemas} readOnly={readOnly} />
      </TabsContent>
      {schemas.map((schema) => (
        <TabsContent key={schema.id} value={schema.module_name}>
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
