'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, Trash2, BarChart3, PieChart, Save } from 'lucide-react'
import { getRecords } from '@/lib/actions/data-records'
import { getClientSchemas } from '@/lib/actions/schema'
import type { ClientDataRecord, ClientSchema, ColumnDefinition } from '@/lib/supabase'
import { useToast } from '@/components/ui/toast'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface ChartConfig {
  id: string
  name: string
  type: 'bar' | 'line' | 'pie'
  moduleName: string
  xAxisColumn: string
  yAxisColumn: string
  aggregation: 'SUM' | 'AVERAGE' | 'COUNT'
  groupBy?: string
}

interface ChartBuilderProps {
  clientId: string
  moduleName?: string
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4']

export function ChartBuilder({ clientId, moduleName }: ChartBuilderProps) {
  const { showToast } = useToast()
  const [availableModules, setAvailableModules] = useState<ClientSchema[]>([])
  const [charts, setCharts] = useState<ChartConfig[]>([])
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [chartData, setChartData] = useState<Record<string, any[]>>({})
  const [loading, setLoading] = useState(true)

  // New chart form state
  const [newChartName, setNewChartName] = useState('')
  const [newChartType, setNewChartType] = useState<'bar' | 'line' | 'pie'>('bar')
  const [newChartModule, setNewChartModule] = useState('')
  const [newChartXAxis, setNewChartXAxis] = useState('')
  const [newChartYAxis, setNewChartYAxis] = useState('')
  const [newChartAggregation, setNewChartAggregation] = useState<'SUM' | 'AVERAGE' | 'COUNT'>('SUM')

  useEffect(() => {
    loadModules()
    loadCharts()
  }, [clientId])

  const loadModules = async () => {
    try {
      const result = await getClientSchemas(clientId)
      if (result.success && result.schemas) {
        setAvailableModules(result.schemas)
        if (moduleName) {
          const module = result.schemas.find(m => m.module_name === moduleName)
          if (module) {
            setNewChartModule(moduleName)
          }
        }
      }
    } catch (error) {
      console.error('Error loading modules:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCharts = async () => {
    // TODO: Load saved charts from database or local storage
    // For now, using empty array
    setCharts([])
  }

  const loadChartData = async (chart: ChartConfig) => {
    try {
      const result = await getRecords(clientId, chart.moduleName)
      if (!result.success || !result.records) return

      const records = result.records
      const selectedModule = availableModules.find(m => m.module_name === chart.moduleName)
      if (!selectedModule) return

      // Group data by xAxisColumn
      const grouped: Record<string, number[]> = {}
      records.forEach(record => {
        const xValue = String(record.data[chart.xAxisColumn] || '')
        const yValue = record.data[chart.yAxisColumn]
        
        if (xValue && yValue !== null && yValue !== undefined) {
          if (!grouped[xValue]) {
            grouped[xValue] = []
          }
          const numValue = typeof yValue === 'number' ? yValue : parseFloat(String(yValue))
          if (!isNaN(numValue)) {
            grouped[xValue].push(numValue)
          }
        }
      })

      // Aggregate values
      const data = Object.entries(grouped).map(([name, values]) => {
        let aggregated = 0
        switch (chart.aggregation) {
          case 'SUM':
            aggregated = values.reduce((sum, val) => sum + val, 0)
            break
          case 'AVERAGE':
            aggregated = values.reduce((sum, val) => sum + val, 0) / values.length
            break
          case 'COUNT':
            aggregated = values.length
            break
        }

        return {
          name: name.length > 20 ? name.substring(0, 20) + '...' : name,
          value: Math.round(aggregated * 100) / 100,
        }
      })

      setChartData(prev => ({ ...prev, [chart.id]: data }))
    } catch (error) {
      console.error('Error loading chart data:', error)
    }
  }

  useEffect(() => {
    charts.forEach(chart => {
      if (!chartData[chart.id]) {
        loadChartData(chart)
      }
    })
  }, [charts, availableModules])

  const handleAddChart = () => {
    if (!newChartName || !newChartModule || !newChartXAxis || !newChartYAxis) {
      showToast('error', 'יש למלא את כל השדות')
      return
    }

    const newChart: ChartConfig = {
      id: Date.now().toString(),
      name: newChartName,
      type: newChartType,
      moduleName: newChartModule,
      xAxisColumn: newChartXAxis,
      yAxisColumn: newChartYAxis,
      aggregation: newChartAggregation,
    }

    const updated = [...charts, newChart]
    setCharts(updated)
    loadChartData(newChart)
    setShowAddDialog(false)
    setNewChartName('')
    setNewChartModule(moduleName || '')
    setNewChartXAxis('')
    setNewChartYAxis('')
    setNewChartAggregation('SUM')
    setNewChartType('bar')
    showToast('success', 'גרף נוסף בהצלחה')
  }

  const handleRemoveChart = (id: string) => {
    setCharts(charts.filter(c => c.id !== id))
    setChartData(prev => {
      const updated = { ...prev }
      delete updated[id]
      return updated
    })
    showToast('success', 'גרף נמחק')
  }

  const selectedModuleSchema = availableModules.find(m => m.module_name === newChartModule)
  const availableColumns = selectedModuleSchema?.columns || []

  if (loading) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">
          <p className="text-grey">טוען בונה גרפים...</p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">בונה גרפים</h2>
          <p className="text-sm text-grey mt-1">
            צור גרפים וויזואליים מנתוני הטבלאות
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          הוסף גרף
        </Button>
      </div>

      {charts.length === 0 ? (
        <Card className="p-8">
          <div className="text-center">
            <p className="text-grey mb-4">אין גרפים מוגדרים</p>
            <Button onClick={() => setShowAddDialog(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              הוסף גרף ראשון
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {charts.map((chart) => {
            const data = chartData[chart.id] || []
            
            return (
              <Card key={chart.id} className="p-6 relative">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveChart(chart.id)}
                  className="absolute top-2 left-2 text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <div className="pr-8 mb-4">
                  <h3 className="text-lg font-semibold mb-1">{chart.name}</h3>
                  <p className="text-sm text-grey">
                    {chart.type === 'bar' ? 'עמודות' : chart.type === 'line' ? 'קו' : 'עוגה'} • {chart.moduleName}
                  </p>
                </div>
                
                {data.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-grey">
                    אין נתונים להצגה
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    {chart.type === 'bar' ? (
                      <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="value" fill="#10b981" />
                      </BarChart>
                    ) : chart.type === 'line' ? (
                      <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} />
                      </LineChart>
                    ) : (
                      <RechartsPieChart>
                        <Pie
                          data={data}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </RechartsPieChart>
                    )}
                  </ResponsiveContainer>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Add Chart Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>הוסף גרף חדש</DialogTitle>
            <DialogDescription>
              בחר טבלה ועמודות ליצירת גרף
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>שם הגרף</Label>
              <Input
                value={newChartName}
                onChange={(e) => setNewChartName(e.target.value)}
                placeholder="לדוגמה: הכנסות חודשיות"
              />
            </div>
            <div>
              <Label>סוג גרף</Label>
              <Select value={newChartType} onValueChange={(value: any) => setNewChartType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bar">עמודות</SelectItem>
                  <SelectItem value="line">קו</SelectItem>
                  <SelectItem value="pie">עוגה</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>טבלה מקור</Label>
              <Select value={newChartModule} onValueChange={setNewChartModule}>
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
              <Label>עמודת X (קטגוריה)</Label>
              <Select 
                value={newChartXAxis} 
                onValueChange={setNewChartXAxis}
                disabled={!newChartModule || availableColumns.length === 0}
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
              <Label>עמודת Y (ערך)</Label>
              <Select 
                value={newChartYAxis} 
                onValueChange={setNewChartYAxis}
                disabled={!newChartModule || availableColumns.filter(c => c.type === 'number').length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר עמודה מספרית" />
                </SelectTrigger>
                <SelectContent>
                  {availableColumns.filter(c => c.type === 'number').map((col) => (
                    <SelectItem key={col.name} value={col.name}>
                      {col.label} ({col.name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>אגרגציה</Label>
              <Select value={newChartAggregation} onValueChange={(value: any) => setNewChartAggregation(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SUM">סכום</SelectItem>
                  <SelectItem value="AVERAGE">ממוצע</SelectItem>
                  <SelectItem value="COUNT">מונה</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              ביטול
            </Button>
            <Button onClick={handleAddChart} disabled={!newChartName || !newChartModule || !newChartXAxis || !newChartYAxis}>
              הוסף
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

