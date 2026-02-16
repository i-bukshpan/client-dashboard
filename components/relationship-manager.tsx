'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, Trash2, Edit, ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/toast'

interface Relationship {
    id: string
    client_id: string
    source_module: string
    target_module: string
    source_key: string
    target_key: string
    relationship_type: '1:1' | '1:N' | 'N:M'
    cascade_delete: boolean
    display_in_source: boolean
    aggregate_function?: 'COUNT' | 'SUM' | 'AVG' | null
    aggregate_field?: string | null
    aggregate_label?: string | null
}

interface RelationshipManagerProps {
    clientId: string
    currentModule?: string
}

export function RelationshipManager({ clientId, currentModule }: RelationshipManagerProps) {
    const { showToast } = useToast()
    const [relationships, setRelationships] = useState<Relationship[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [formData, setFormData] = useState<Partial<Relationship>>({
        source_module: currentModule || '',
        target_module: '',
        source_key: 'id',
        target_key: 'id',
        relationship_type: '1:N',
        cascade_delete: false,
        display_in_source: true,
    })

    useEffect(() => {
        loadRelationships()
    }, [clientId])

    const loadRelationships = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('table_relationships')
                .select('*')
                .eq('client_id', clientId)
                .order('created_at', { ascending: false })

            if (error) throw error
            setRelationships(data || [])
        } catch (error: any) {
            showToast('שגיאה בטעינת קשרים', 'error')
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        if (!formData.source_module || !formData.target_module || !formData.source_key || !formData.target_key) {
            showToast('יש למלא את כל השדות הנדרשים', 'error')
            return
        }

        try {
            if (editingId) {
                const { error } = await supabase
                    .from('table_relationships')
                    .update(formData)
                    .eq('id', editingId)

                if (error) throw error
                showToast('הקשר עודכן בהצלחה', 'success')
            } else {
                const { error } = await supabase
                    .from('table_relationships')
                    .insert({
                        ...formData,
                        client_id: clientId,
                    })

                if (error) throw error
                showToast('הקשר נוסף בהצלחה', 'success')
            }

            setDialogOpen(false)
            setEditingId(null)
            setFormData({
                source_module: currentModule || '',
                target_module: '',
                source_key: 'id',
                target_key: 'id',
                relationship_type: '1:N',
                cascade_delete: false,
                display_in_source: true,
            })
            loadRelationships()
        } catch (error: any) {
            showToast('שגיאה בשמירת הקשר', 'error')
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('למחוק את הקשר?')) return

        try {
            const { error } = await supabase.from('table_relationships').delete().eq('id', id)
            if (error) throw error
            showToast('הקשר נמחק', 'success')
            loadRelationships()
        } catch (error: any) {
            showToast('שגיאה במחיקת הקשר', 'error')
        }
    }

    const handleEdit = (relationship: Relationship) => {
        setFormData(relationship)
        setEditingId(relationship.id)
        setDialogOpen(true)
    }

    const getRelationshipTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            '1:1': 'אחד לאחד (1:1)',
            '1:N': 'אחד לרבים (1:N)',
            'N:M': 'רבים לרבים (N:M)',
        }
        return labels[type] || type
    }

    return (
        <Card className="p-6" dir="rtl">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-semibold text-navy">ניהול קשרים בין טבלאות</h3>
                    <p className="text-sm text-grey">הגדר קשרים לצפייה בנתונים מקושרים</p>
                </div>
                <Button onClick={() => setDialogOpen(true)}>
                    <Plus className="h-4 w-4 ml-1" />
                    הוסף קשר
                </Button>
            </div>

            {loading ? (
                <div className="text-center py-8 text-grey">טוען...</div>
            ) : relationships.length === 0 ? (
                <div className="text-center py-12 text-grey">
                    <p>אין קשרים מוגדרים</p>
                    <p className="text-sm mt-2">לחץ על "הוסף קשר" להתחיל</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {relationships.map((rel) => (
                        <div key={rel.id} className="flex items-center justify-between p-4 bg-grey/5 rounded-lg border">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="font-medium text-navy px-3 py-1 bg-blue-100 rounded">
                                        {rel.source_module}
                                    </span>
                                    <ArrowRight className="h-4 w-4 text-grey" />
                                    <span className="font-medium text-navy px-3 py-1 bg-green-100 rounded">
                                        {rel.target_module}
                                    </span>
                                    <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">
                                        {getRelationshipTypeLabel(rel.relationship_type)}
                                    </span>
                                </div>
                                <div className="text-sm text-grey">
                                    <span className="font-mono">{rel.source_key}</span>
                                    {' → '}
                                    <span className="font-mono">{rel.target_key}</span>
                                </div>
                                {rel.aggregate_function && (
                                    <div className="text-xs text-blue-600 mt-1">
                                        Aggregate: {rel.aggregate_function}({rel.aggregate_field}) as {rel.aggregate_label}
                                    </div>
                                )}
                                {rel.cascade_delete && (
                                    <span className="text-xs text-red-600 mt-1 inline-block">⚠️ Cascade Delete מופעל</span>
                                )}
                            </div>

                            <div className="flex gap-2">
                                <Button size="sm" variant="ghost" onClick={() => handleEdit(rel)}>
                                    <Edit className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => handleDelete(rel.id)} className="text-red-600">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add/Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-md" dir="rtl">
                    <DialogHeader>
                        <DialogTitle>{editingId ? 'ערוך קשר' : 'הוסף קשר חדש'}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>טבלת מקור</Label>
                                <Input
                                    value={formData.source_module || ''}
                                    onChange={(e) => setFormData({ ...formData, source_module: e.target.value })}
                                    placeholder="לדוגמה: clients"
                                />
                            </div>
                            <div>
                                <Label>טבלת יעד</Label>
                                <Input
                                    value={formData.target_module || ''}
                                    onChange={(e) => setFormData({ ...formData, target_module: e.target.value })}
                                    placeholder="לדוגמה: payments"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>מפתח במקור</Label>
                                <Input
                                    value={formData.source_key || ''}
                                    onChange={(e) => setFormData({ ...formData, source_key: e.target.value })}
                                    placeholder="לדוגמה: id"
                                />
                            </div>
                            <div>
                                <Label>מפתח ביעד</Label>
                                <Input
                                    value={formData.target_key || ''}
                                    onChange={(e) => setFormData({ ...formData, target_key: e.target.value })}
                                    placeholder="לדוגמה: client_id"
                                />
                            </div>
                        </div>

                        <div>
                            <Label>סוג קשר</Label>
                            <Select
                                value={formData.relationship_type}
                                onValueChange={(value) => setFormData({ ...formData, relationship_type: value as any })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1:1">אחד לאחד (1:1)</SelectItem>
                                    <SelectItem value="1:N">אחד לרבים (1:N)</SelectItem>
                                    <SelectItem value="N:M">רבים לרבים (N:M)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={formData.display_in_source || false}
                                    onChange={(e) => setFormData({ ...formData, display_in_source: e.target.checked })}
                                />
                                הצג ב-UI
                            </Label>

                            <Label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={formData.cascade_delete || false}
                                    onChange={(e) => setFormData({ ...formData, cascade_delete: e.target.checked })}
                                />
                                <span className="text-red-600">Cascade Delete (מחיקה אוטומטית)</span>
                            </Label>
                        </div>

                        {/* Aggregate options */}
                        <div className="border-t pt-4">
                            <Label className="mb-2 block">Aggregate (אופציונלי)</Label>
                            <div className="grid grid-cols-3 gap-2">
                                <Select
                                    value={formData.aggregate_function || 'none'}
                                    onValueChange={(value) =>
                                        setFormData({
                                            ...formData,
                                            aggregate_function: value === 'none' ? null : (value as any),
                                        })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="פונקציה" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">ללא</SelectItem>
                                        <SelectItem value="COUNT">COUNT</SelectItem>
                                        <SelectItem value="SUM">SUM</SelectItem>
                                        <SelectItem value="AVG">AVG</SelectItem>
                                    </SelectContent>
                                </Select>

                                <Input
                                    placeholder="שדה"
                                    value={formData.aggregate_field || ''}
                                    onChange={(e) => setFormData({ ...formData, aggregate_field: e.target.value })}
                                    disabled={!formData.aggregate_function}
                                />

                                <Input
                                    placeholder="תווית"
                                    value={formData.aggregate_label || ''}
                                    onChange={(e) => setFormData({ ...formData, aggregate_label: e.target.value })}
                                    disabled={!formData.aggregate_function}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <Button onClick={handleSave}>שמור</Button>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                            ביטול
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </Card>
    )
}
