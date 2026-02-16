'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { DynamicDataTable } from '@/components/dynamic-data-table'
import { getSchema } from '@/lib/actions/schema'
import { getRecords } from '@/lib/actions/data-records'
import type { ClientDataRecord, ColumnDefinition } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { ViewManager } from './view-manager'
import type { CustomView } from '@/lib/actions/views'
import { RealtimeSubscriber } from './realtime-subscriber'

interface ModuleDataTabProps {
  clientId: string
  moduleType: string
  branchName?: string
  readOnly?: boolean
  highlightId?: string | null
}

export function ModuleDataTab({ clientId, moduleType, branchName, readOnly = false, highlightId }: ModuleDataTabProps) {
  const [records, setRecords] = useState<ClientDataRecord[]>([])
  const [columns, setColumns] = useState<ColumnDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [currentView, setCurrentView] = useState<CustomView | null>(null)
  const [currentViewConfig, setCurrentViewConfig] = useState<{
    visible_columns: string[]
    column_order: string[]
    filters: Record<string, any>
    sort_by?: string
    sort_direction?: 'asc' | 'desc'
  } | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // Load schema
      const schemaResult = await getSchema(clientId, moduleType, branchName || null)
      if (schemaResult.success && schemaResult.schema) {
        setColumns(schemaResult.schema.columns)
      } else {
        setColumns([])
      }

      // Load records
      const recordsResult = await getRecords(clientId, moduleType)
      if (recordsResult.success && recordsResult.records) {
        setRecords(recordsResult.records)
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }, [clientId, moduleType, branchName])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleRealtimeChange = useCallback((payload: {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE'
    record?: ClientDataRecord
    oldRecord?: ClientDataRecord
  }) => {
    if (payload.eventType === 'INSERT' && payload.record) {
      // Add new record to the list
      setRecords(prev => [payload.record!, ...prev])
    } else if (payload.eventType === 'UPDATE' && payload.record) {
      // Update existing record
      setRecords(prev =>
        prev.map(r => (r.id === payload.record!.id ? payload.record! : r))
      )
    } else if (payload.eventType === 'DELETE' && payload.oldRecord) {
      // Remove deleted record
      setRecords(prev => prev.filter(r => r.id !== payload.oldRecord!.id))
    }
  }, [])

  const availableColumns = useMemo(() => columns.map(col => col.name), [columns])

  const handleViewChange = useCallback((view: CustomView | null) => {
    setCurrentView(view)
  }, [])

  if (loading) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">
          <p className="text-grey">טוען נתונים...</p>
        </div>
      </Card>
    )
  }

  if (columns.length === 0) {
    return (
      <Card className="p-8">
        <div className="text-center">
          <p className="text-grey mb-2 font-medium">אין סכמה מוגדרת לטבלה זו</p>
          <p className="text-sm text-grey">
            אנא עבור לטאב "הגדרות" כדי להגדיר את מבנה הטבלה
          </p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Real-time subscription */}
      <RealtimeSubscriber
        clientId={clientId}
        moduleType={moduleType}
        onRecordChange={handleRealtimeChange}
      />

      <ViewManager
        clientId={clientId}
        moduleName={moduleType}
        availableColumns={availableColumns}
        currentView={currentView || undefined}
        currentConfig={currentViewConfig || undefined}
        onViewChange={handleViewChange}
      />
      <DynamicDataTable
        clientId={clientId}
        moduleType={moduleType}
        records={records}
        columns={columns}
        onRecordUpdate={loadData}
        customView={currentView}
        onViewConfigChange={setCurrentViewConfig}
        readOnly={readOnly}
        highlightId={highlightId}
        branchName={branchName}
      />
    </div>
  )
}

