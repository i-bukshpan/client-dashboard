'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Star, Trash2, Eye } from 'lucide-react'
import { getSavedFilters, deleteSavedFilter, type SavedFilter } from '@/lib/actions/saved-filters'
import { useToast } from '@/components/ui/toast'
import type { FilterGroup } from '@/lib/utils/filter-engine'
import { getFilterDescription } from '@/lib/utils/filter-engine'

interface SavedViewsProps {
    clientId: string
    moduleName: string
    onApply: (filterGroup: FilterGroup) => void
}

export function SavedViews({ clientId, moduleName, onApply }: SavedViewsProps) {
    const { showToast } = useToast()
    const [views, setViews] = useState<SavedFilter[]>([])
    const [loading, setLoading] = useState(true)
    const [activeViewId, setActiveViewId] = useState<string | null>(null)

    useEffect(() => {
        loadViews()
    }, [clientId, moduleName])

    const loadViews = async () => {
        setLoading(true)
        const result = await getSavedFilters(clientId, moduleName)
        if (result.success && result.filters) {
            setViews(result.filters)
        }
        setLoading(false)
    }

    const handleApply = (view: SavedFilter) => {
        onApply(view.filter_config as FilterGroup)
        setActiveViewId(view.id)
        showToast(`סינון הופעל: ${view.name}`, 'success')
    }

    const handleDelete = async (id: string) => {
        if (!confirm('למחוק את ה-view?')) return

        const result = await deleteSavedFilter(id)
        if (result.success) {
            showToast('View נמחק', 'success')
            loadViews()
            if (activeViewId === id) {
                setActiveViewId(null)
            }
        } else {
            showToast('שגיאה במחיקת view', 'error')
        }
    }

    const handleClear = () => {
        onApply({ logic: 'AND', conditions: [] })
        setActiveViewId(null)
        showToast('סינון נוקה', 'success')
    }

    if (loading) {
        return (
            <Card className="p-4">
                <div className="text-center text-grey">טוען views...</div>
            </Card>
        )
    }

    if (views.length === 0) {
        return null
    }

    return (
        <Card className="p-4" dir="rtl">
            <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-navy flex items-center gap-2">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    Saved Views
                </h4>
                {activeViewId && (
                    <Button size="sm" variant="outline" onClick={handleClear}>
                        נקה סינון
                    </Button>
                )}
            </div>

            <div className="space-y-2">
                {views.map((view) => (
                    <div
                        key={view.id}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-all ${activeViewId === view.id
                                ? 'bg-blue-50 border-blue-300'
                                : 'bg-grey/5 border-grey/20 hover:bg-grey/10'
                            }`}
                    >
                        <div className="flex-1">
                            <div className="font-medium text-sm text-navy mb-1">{view.name}</div>
                            {view.description && (
                                <div className="text-xs text-grey mb-1">{view.description}</div>
                            )}
                            <div className="text-xs text-grey">
                                {getFilterDescription(view.filter_config as FilterGroup)}
                            </div>
                        </div>

                        <div className="flex gap-1">
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleApply(view)}
                                className={`h-8 w-8 p-0 ${activeViewId === view.id ? 'text-blue-600' : 'text-grey'
                                    }`}
                                title="החל סינון"
                            >
                                <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete(view.id)}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                title="מחק"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    )
}
