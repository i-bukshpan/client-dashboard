'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2, Edit, Save, X } from 'lucide-react'
import {
    getValidationRules,
    addValidationRule,
    updateValidationRule,
    deleteValidationRule,
    type ValidationRule,
} from '@/lib/actions/validation'
import { useToast } from '@/components/ui/toast'
import type { ColumnDefinition } from '@/lib/supabase'

interface ValidationManagerProps {
    clientId: string
    moduleName: string
    columns: ColumnDefinition[]
}

export function ValidationManager({ clientId, moduleName, columns }: ValidationManagerProps) {
    const { showToast } = useToast()
    const [rules, setRules] = useState<ValidationRule[]>([])
    const [loading, setLoading] = useState(true)
    const [editingRule, setEditingRule] = useState<string | null>(null)
    const [isAddingNew, setIsAddingNew] = useState(false)
    const [newRule, setNewRule] = useState<Partial<ValidationRule>>({
        client_id: clientId,
        module_name: moduleName,
        field_name: '',
        rule_type: 'required',
        rule_value: '',
        error_message: '',
        is_active: true,
    })

    useEffect(() => {
        loadRules()
    }, [clientId, moduleName])

    const loadRules = async () => {
        setLoading(true)
        const result = await getValidationRules(clientId, moduleName)
        if (result.success && result.rules) {
            setRules(result.rules)
        }
        setLoading(false)
    }

    const handleAddRule = async () => {
        if (!newRule.field_name || !newRule.error_message) {
            showToast('יש למלא שם שדה והודעת שגיאה', 'error')
            return
        }

        const result = await addValidationRule(newRule as Omit<ValidationRule, 'id' | 'created_at'>)
        if (result.success) {
            showToast('כלל נוסף בהצלחה', 'success')
            setIsAddingNew(false)
            setNewRule({
                client_id: clientId,
                module_name: moduleName,
                field_name: '',
                rule_type: 'required',
                rule_value: '',
                error_message: '',
                is_active: true,
            })
            loadRules()
        } else {
            showToast(result.error || 'שגיאה בהוספת כלל', 'error')
        }
    }

    const handleToggleActive = async (ruleId: string, currentStatus: boolean) => {
        const result = await updateValidationRule(ruleId, { is_active: !currentStatus })
        if (result.success) {
            showToast('סטטוס עודכן', 'success')
            loadRules()
        } else {
            showToast(result.error || 'שגיאה בעדכון', 'error')
        }
    }

    const handleDeleteRule = async (ruleId: string) => {
        if (!confirm('למחוק את הכלל?')) return

        const result = await deleteValidationRule(ruleId)
        if (result.success) {
            showToast('כלל נמחק', 'success')
            loadRules()
        } else {
            showToast(result.error || 'שגיאה במחיקה', 'error')
        }
    }

    const getRuleTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            required: 'חובה',
            min: 'מינימום',
            max: 'מקסימום',
            pattern: 'תבנית (Regex)',
            email: 'אימייל',
            phone: 'טלפון',
            url: 'קישור',
            custom: 'מותאם אישית',
        }
        return labels[type] || type
    }

    return (
        <Card className="p-6" dir="rtl">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-semibold text-navy">כללי Validation</h3>
                    <p className="text-sm text-grey">ניהול כללי בדיקה לשדות בטבלה</p>
                </div>
                <Button onClick={() => setIsAddingNew(true)} disabled={isAddingNew}>
                    <Plus className="h-4 w-4 ml-1" />
                    הוסף כלל
                </Button>
            </div>

            {loading ? (
                <div className="text-center py-8 text-grey">טוען...</div>
            ) : (
                <>
                    {/* Add New Rule Form */}
                    {isAddingNew && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <Label>שדה</Label>
                                    <Select value={newRule.field_name} onValueChange={(value) => setNewRule({ ...newRule, field_name: value })}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="בחר שדה" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {columns.map((col) => (
                                                <SelectItem key={col.name} value={col.name}>
                                                    {col.label || col.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label>סוג כלל</Label>
                                    <Select value={newRule.rule_type} onValueChange={(value) => setNewRule({ ...newRule, rule_type: value as any })}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="required">חובה</SelectItem>
                                            <SelectItem value="min">מינימום</SelectItem>
                                            <SelectItem value="max">מקסימום</SelectItem>
                                            <SelectItem value="pattern">תבנית (Regex)</SelectItem>
                                            <SelectItem value="email">אימייל</SelectItem>
                                            <SelectItem value="phone">טלפון</SelectItem>
                                            <SelectItem value="url">קישור</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {(newRule.rule_type === 'min' || newRule.rule_type === 'max' || newRule.rule_type === 'pattern') && (
                                    <div>
                                        <Label>ערך</Label>
                                        <Input
                                            value={newRule.rule_value || ''}
                                            onChange={(e) => setNewRule({ ...newRule, rule_value: e.target.value })}
                                            placeholder={newRule.rule_type === 'pattern' ? '^[0-9]+$' : '0'}
                                        />
                                    </div>
                                )}

                                <div className="col-span-2">
                                    <Label>הודעת שגיאה</Label>
                                    <Input
                                        value={newRule.error_message || ''}
                                        onChange={(e) => setNewRule({ ...newRule, error_message: e.target.value })}
                                        placeholder="לדוגמה: שדה חובה"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <Button onClick={handleAddRule} size="sm">
                                    <Save className="h-4 w-4 ml-1" />
                                    שמור
                                </Button>
                                <Button onClick={() => setIsAddingNew(false)} variant="outline" size="sm">
                                    <X className="h-4 w-4 ml-1" />
                                    ביטול
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Rules Table */}
                    {rules.length === 0 ? (
                        <div className="text-center py-12 text-grey">
                            <p>אין כללי validation עדיין</p>
                            <p className="text-sm mt-2">לחץ על "הוסף כלל" כדי להתחיל</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {rules.map((rule) => (
                                <div
                                    key={rule.id}
                                    className={`flex items-center justify-between p-3 rounded border ${rule.is_active ? 'bg-white border-grey/20' : 'bg-grey/5 border-grey/10'
                                        }`}
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3">
                                            <span className="font-medium text-navy">{rule.field_name}</span>
                                            <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">
                                                {getRuleTypeLabel(rule.rule_type)}
                                            </span>
                                            {rule.rule_value && (
                                                <span className="text-xs text-grey">ערך: {rule.rule_value}</span>
                                            )}
                                            {!rule.is_active && (
                                                <span className="px-2 py-0.5 rounded text-xs bg-grey/20 text-grey">כבוי</span>
                                            )}
                                        </div>
                                        <p className="text-sm text-grey mt-1">{rule.error_message}</p>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleToggleActive(rule.id, rule.is_active)}
                                            className={`text-xs ${rule.is_active ? 'text-green-600' : 'text-grey'}`}
                                        >
                                            {rule.is_active ? 'פעיל' : 'כבוי'}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleDeleteRule(rule.id)}
                                            className="text-red-600 hover:text-red-700"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </Card>
    )
}
