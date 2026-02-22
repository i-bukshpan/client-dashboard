import { useState, useEffect } from 'react'
import { ModuleDataTab } from './module-data-tab'
import { BranchDashboard } from './branch-dashboard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { FileImage } from 'lucide-react'
import { InvoiceUpload, type InvoiceData } from './invoice-upload'
import { InvoiceBranchBreakdown } from './invoice-branch-breakdown'
import { addScannedInvoice } from '@/lib/actions/invoice-scan'
import { useToast } from '@/components/ui/toast'
import type { ClientSchema } from '@/lib/supabase'

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
  const { showToast } = useToast()
  const [currentTab, setCurrentTab] = useState('dashboard')
  const [invoiceUploadOpen, setInvoiceUploadOpen] = useState(false)
  const [branchBreakdownOpen, setBranchBreakdownOpen] = useState(false)
  const [breakdownData, setBreakdownData] = useState<InvoiceData | null>(null)

  // Update current tab when activeModule prop changes
  useEffect(() => {
    if (activeModule) {
      setCurrentTab(activeModule)
    }
  }, [activeModule])

  const handleInvoiceScan = async (data: InvoiceData) => {
    try {
      const result = await addScannedInvoice(clientId, data, branchName)
      if (result.success) {
        showToast('success', 'חשבונית נסרקה ונוספה בהצלחה')
        // Switch to the invoices tab
        setCurrentTab('חשבוניות')
        // Notify parent to reload schemas (to show new invoices module if created)
        onSchemasChanged?.()
      } else {
        showToast('error', result.error || 'שגיאה בשמירת החשבונית')
      }
    } catch (error) {
      showToast('error', 'שגיאה בלתי צפויה בשמירת החשבונית')
    }
  }

  const handleBranchBreakdown = (data: InvoiceData) => {
    setBreakdownData(data)
    setBranchBreakdownOpen(true)
  }

  const handleBreakdownComplete = () => {
    onSchemasChanged?.()
  }

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
        {!readOnly && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-2 flex-shrink-0 rounded-xl border-border/50 font-bold hover:bg-white hover:text-primary transition-all pr-4 pl-5 h-10"
              onClick={() => setInvoiceUploadOpen(true)}
            >
              <div className="p-1 bg-primary/10 rounded-lg text-primary"><FileImage className="h-4 w-4" /></div>
              סריקת חשבונית
            </Button>
            <InvoiceUpload
              open={invoiceUploadOpen}
              onOpenChange={setInvoiceUploadOpen}
              onDataExtracted={handleInvoiceScan}
              onBranchBreakdown={handleBranchBreakdown}
            />
            {breakdownData && (
              <InvoiceBranchBreakdown
                open={branchBreakdownOpen}
                onOpenChange={setBranchBreakdownOpen}
                invoiceData={breakdownData}
                clientId={clientId}
                branchName={branchName}
                schemas={schemas}
                onComplete={handleBreakdownComplete}
              />
            )}
          </div>
        )}
      </div>
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
