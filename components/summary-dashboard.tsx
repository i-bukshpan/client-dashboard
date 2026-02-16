'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, Save } from 'lucide-react'
import { getClientSchemas } from '@/lib/actions/schema'
import { getAggregatedValue } from '@/lib/actions/aggregations'
import type { ClientSchema } from '@/lib/supabase'
import { useToast } from '@/components/ui/toast'

interface KPICard {
  id: string
  label: string
  target_module_name: string
  target_column_key: string
  operation: 'SUM' | 'AVERAGE' | 'COUNT' | 'MIN' | 'MAX'
  value?: number
}

interface SummaryDashboardProps {
  clientId: string
}

export function SummaryDashboard({ clientId }: SummaryDashboardProps) {
  const { showToast } = useToast()
  const [availableModules, setAvailableModules] = useState<ClientSchema[]>([])
  const [kpiCards, setKpiCards] = useState<KPICard[]>([])
  const [loading, setLoading] = useState(true)
  const [calculating, setCalculating] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  
  // New KPI form state
  const [newKPILabel, setNewKPILabel] = useState('')
  const [newKPIModule, setNewKPIModule] = useState('')
  const [newKPIColumn, setNewKPIColumn] = useState('')
  const [newKPIOperation, setNewKPIOperation] = useState<'SUM' | 'AVERAGE' | 'COUNT' | 'MIN' | 'MAX'>('SUM')

  useEffect(() => {
    loadModules()
    loadKPIs()
  }, [clientId])

  const loadModules = async () => {
    try {
      const result = await getClientSchemas(clientId)
      if (result.success && result.schemas) {
        setAvailableModules(result.schemas)
      }
    } catch (error) {
      console.error('Error loading modules:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadKPIs = async () => {
    // TODO: Load saved KPIs from database or local storage
    // For now, using empty array
    setKpiCards([])
    calculateKPIs([])
  }

  const calculateKPIs = async (cards: KPICard[]) => {
    setCalculating(true)
    try {
      const updated = await Promise.all(
        cards.map(async (card) => {
          const result = await getAggregatedValue(
            clientId,
            card.target_module_name,
            card.target_column_key,
            card.operation
          )
          return {
            ...card,
            value: result.success ? result.value : 0,
          }
        })
      )
      setKpiCards(updated)
    } catch (error) {
      console.error('Error calculating KPIs:', error)
    } finally {
      setCalculating(false)
    }
  }

  const handleAddKPI = () => {
    if (!newKPILabel || !newKPIModule || !newKPIColumn) {
      showToast('error', 'יש למלא את כל השדות')
      return
    }

    const selectedModule = availableModules.find(m => m.module_name === newKPIModule)
    const selectedColumn = selectedModule?.columns.find(c => c.name === newKPIColumn)
    
    if (!selectedColumn) {
      showToast('error', 'עמודה לא נמצאה')
      return
    }

    const newCard: KPICard = {
      id: Date.now().toString(),
      label: newKPILabel,
      target_module_name: newKPIModule,
      target_column_key: newKPIColumn,
      operation: newKPIOperation,
    }

    const updated = [...kpiCards, newCard]
    setKpiCards(updated)
    calculateKPIs(updated)
    setShowAddDialog(false)
    setNewKPILabel('')
    setNewKPIModule('')
    setNewKPIColumn('')
    setNewKPIOperation('SUM')
    showToast('success', 'כרטיס KPI נוסף בהצלחה')
  }

  const handleRemoveKPI = (id: string) => {
    const updated = kpiCards.filter(card => card.id !== id)
    setKpiCards(updated)
    showToast('success', 'כרטיס KPI נמחק')
  }

  const handleRefresh = () => {
    calculateKPIs(kpiCards)
    showToast('success', 'הערכים עודכנו')
  }

  const selectedModuleSchema = availableModules.find(m => m.module_name === newKPIModule)
  const availableColumns = selectedModuleSchema?.columns.filter(c => c.type === 'number') || []

  if (loading) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">
          <p className="text-grey">טוען דשבורד...</p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">דשבורד סיכום</h2>
          <p className="text-sm text-grey mt-1">
            כרטיסי KPI עם חישובים מטבלאות שונות
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleRefresh} variant="outline" disabled={calculating}>
            רענן
          </Button>
          <Button onClick={() => setShowAddDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            הוסף KPI
          </Button>
        </div>
      </div>

      {kpiCards.length === 0 ? (
        <Card className="p-8">
          <div className="text-center">
            <p className="text-grey mb-4">אין כרטיסי KPI מוגדרים</p>
            <Button onClick={() => setShowAddDialog(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              הוסף KPI ראשון
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {kpiCards.map((card) => (
            <Card key={card.id} className="p-6 relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveKPI(card.id)}
                className="absolute top-2 left-2 text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <div className="pr-8">
                <h3 className="text-lg font-semibold mb-2">{card.label}</h3>
                <div className="text-3xl font-bold text-emerald mb-2">
                  {calculating && card.value === undefined ? (
                    <span className="text-grey">מחשב...</span>
                  ) : (
                    `₪${(card.value || 0).toLocaleString('he-IL')}`
                  )}
                </div>
                <div className="text-sm text-grey">
                  {card.operation === 'SUM' ? 'סכום' : 
                   card.operation === 'AVERAGE' ? 'ממוצע' :
                   card.operation === 'COUNT' ? 'מונה' :
                   card.operation === 'MIN' ? 'מינימום' : 'מקסימום'} של {card.target_module_name}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add KPI Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>הוסף כרטיס KPI חדש</DialogTitle>
            <DialogDescription>
              בחר טבלה ועמודה לחישוב
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>תווית (שם הכרטיס)</Label>
              <Input
                value={newKPILabel}
                onChange={(e) => setNewKPILabel(e.target.value)}
                placeholder="לדוגמה: סה&quot;כ הכנסות מהאולם"
              />
            </div>
            <div>
              <Label>טבלה מקור</Label>
              <Select value={newKPIModule} onValueChange={setNewKPIModule}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר טבלה" />
                </SelectTrigger>
                <SelectContent>
                  {availableModules.map((module) => (
                    <SelectItem key={module.id} value={module.module_name}>
                      {module.module_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>עמודה לחישוב</Label>
              <Select 
                value={newKPIColumn} 
                onValueChange={setNewKPIColumn}
                disabled={!newKPIModule || availableColumns.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר עמודה" />
                </SelectTrigger>
                <SelectContent>
                  {availableColumns.map((col) => (
                    <SelectItem key={col.name} value={col.name}>
                      {col.label} ({col.name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>פעולה</Label>
              <Select value={newKPIOperation} onValueChange={(value: any) => setNewKPIOperation(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SUM">סכום</SelectItem>
                  <SelectItem value="AVERAGE">ממוצע</SelectItem>
                  <SelectItem value="COUNT">מונה</SelectItem>
                  <SelectItem value="MIN">מינימום</SelectItem>
                  <SelectItem value="MAX">מקסימום</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              ביטול
            </Button>
            <Button onClick={handleAddKPI} disabled={!newKPILabel || !newKPIModule || !newKPIColumn}>
              הוסף
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

