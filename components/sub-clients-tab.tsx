'use client'

import { useState, useEffect, useCallback } from 'react'
import { Users, TrendingUp, TrendingDown, Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ClientCard } from './client-card'
import { supabase, type Client, type Payment } from '@/lib/supabase'
import { useToast } from '@/components/ui/toast'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { deleteClient } from '@/lib/actions/clients'

interface SubClientsTabProps {
    parentClientId: string
    parentClientName: string
}

interface SubClientWithData extends Client {
    currentBalance: number
    monthlyIncome: number
    monthlyExpense: number
}

export function SubClientsTab({ parentClientId, parentClientName }: SubClientsTabProps) {
    const { showToast } = useToast()
    const [subClients, setSubClients] = useState<SubClientWithData[]>([])
    const [loading, setLoading] = useState(true)
    const [addOpen, setAddOpen] = useState(false)
    const [newName, setNewName] = useState('')
    const [newEmail, setNewEmail] = useState('')
    const [newPhone, setNewPhone] = useState('')
    const [addLoading, setAddLoading] = useState(false)

    const loadSubClients = useCallback(async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('clients')
                .select('*')
                .eq('parent_id', parentClientId)
                .order('created_at', { ascending: false })

            if (error) throw error
            if (!data || data.length === 0) {
                setSubClients([])
                return
            }

            // Load financial data
            const clientIds = data.map(c => c.id)
            const now = new Date()
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

            const { data: allPayments } = await supabase
                .from('payments')
                .select('client_id, amount, payment_status, payment_date, payment_type')
                .in('client_id', clientIds)

            const statsMap: Record<string, { balance: number; income: number; expense: number }> = {}
            if (allPayments) {
                for (const p of allPayments) {
                    if (!statsMap[p.client_id]) statsMap[p.client_id] = { balance: 0, income: 0, expense: 0 }
                    const s = statsMap[p.client_id]
                    if (p.payment_status === 'שולם') {
                        const isIncome = !p.payment_type || p.payment_type === 'income'
                        const isExpense = p.payment_type === 'expense' || p.payment_type === 'rent' || p.payment_type === 'utility' || p.payment_type === 'salary'
                        if (isIncome) s.balance += p.amount
                        if (isExpense) s.balance -= p.amount
                        if (p.payment_date >= startOfMonth && p.payment_date <= endOfMonth) {
                            if (isIncome) s.income += p.amount
                            if (isExpense) s.expense += p.amount
                        }
                    }
                }
            }

            setSubClients(data.map(client => ({
                ...client,
                currentBalance: statsMap[client.id]?.balance || 0,
                monthlyIncome: statsMap[client.id]?.income || 0,
                monthlyExpense: statsMap[client.id]?.expense || 0,
            })))
        } catch (error) {
            console.error('Error loading sub-clients:', error)
        } finally {
            setLoading(false)
        }
    }, [parentClientId])

    useEffect(() => {
        loadSubClients()
    }, [loadSubClients])

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newName.trim()) return
        setAddLoading(true)
        try {
            const { data, error } = await supabase
                .from('clients')
                .insert([{
                    name: newName.trim(),
                    email: newEmail || null,
                    phone: newPhone || null,
                    status: 'פעיל',
                    parent_id: parentClientId,
                }])
                .select()
                .single()

            if (error) throw error
            showToast('success', `לקוח משנה "${newName}" נוסף בהצלחה`)
            setNewName('')
            setNewEmail('')
            setNewPhone('')
            setAddOpen(false)
            loadSubClients()
        } catch (error) {
            console.error('Error adding sub-client:', error)
            showToast('error', 'שגיאה בהוספת לקוח משנה')
        } finally {
            setAddLoading(false)
        }
    }

    const handleDelete = async (clientId: string, clientName: string) => {
        if (!confirm(`האם למחוק את לקוח המשנה "${clientName}"? כל הנתונים שלו יימחקו.`)) return
        const result = await deleteClient(clientId)
        if (result.success) {
            showToast('success', `לקוח משנה "${clientName}" נמחק`)
            loadSubClients()
        } else {
            showToast('error', result.error || 'שגיאה במחיקה')
        }
    }

    // Aggregate KPIs
    const totalBalance = subClients.reduce((s, c) => s + c.currentBalance, 0)
    const totalIncome = subClients.reduce((s, c) => s + c.monthlyIncome, 0)
    const totalExpense = subClients.reduce((s, c) => s + c.monthlyExpense, 0)

    return (
        <div className="space-y-6">
            {/* Summary KPIs */}
            {subClients.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-lg border p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-2 rounded-lg bg-indigo-50">
                                <Users className="h-5 w-5 text-indigo-600" />
                            </div>
                            <span className="text-sm text-grey">לקוחות משנה</span>
                        </div>
                        <div className="text-2xl font-bold text-navy">{subClients.length}</div>
                    </div>
                    <div className="bg-white rounded-lg border p-4 shadow-sm">
                        <div className="text-sm text-grey mb-1">יתרה כוללת</div>
                        <div className={`text-2xl font-bold ${totalBalance >= 0 ? 'text-navy' : 'text-red-500'}`}>
                            ₪{totalBalance.toLocaleString()}
                        </div>
                    </div>
                    <div className="bg-white rounded-lg border p-4 shadow-sm">
                        <div className="flex items-center gap-1 text-sm text-grey mb-1">
                            <TrendingUp className="h-4 w-4 text-emerald" />
                            הכנסות חודשי
                        </div>
                        <div className="text-2xl font-bold text-emerald">₪{totalIncome.toLocaleString()}</div>
                    </div>
                    <div className="bg-white rounded-lg border p-4 shadow-sm">
                        <div className="flex items-center gap-1 text-sm text-grey mb-1">
                            <TrendingDown className="h-4 w-4 text-red-500" />
                            הוצאות חודשי
                        </div>
                        <div className="text-2xl font-bold text-red-500">₪{totalExpense.toLocaleString()}</div>
                    </div>
                </div>
            )}

            {/* Action bar */}
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-navy">
                    לקוחות משנה של {parentClientName}
                </h3>
                <Button className="gap-2" onClick={() => setAddOpen(true)}>
                    <Plus className="h-4 w-4" />
                    הוסף לקוח משנה
                </Button>
            </div>

            {/* Sub-client list */}
            {loading ? (
                <div className="flex items-center justify-center py-12 gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-grey" />
                    <span className="text-grey">טוען לקוחות משנה...</span>
                </div>
            ) : subClients.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg border">
                    <Users className="h-12 w-12 mx-auto text-grey/30 mb-3" />
                    <p className="text-grey mb-4">אין עדיין לקוחות משנה</p>
                    <Button variant="outline" className="gap-2" onClick={() => setAddOpen(true)}>
                        <Plus className="h-4 w-4" />
                        הוסף לקוח משנה ראשון
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {subClients.map(client => (
                        <ClientCard
                            key={client.id}
                            id={client.id}
                            name={client.name}
                            currentBalance={client.currentBalance}
                            monthlyIncome={client.monthlyIncome}
                            monthlyExpense={client.monthlyExpense}
                            status={client.status}
                            phone={client.phone}
                            email={client.email}
                            onDelete={handleDelete}
                        />
                    ))}
                </div>
            )}

            {/* Add sub-client dialog */}
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogContent dir="rtl" className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>הוסף לקוח משנה</DialogTitle>
                        <DialogDescription>
                            הוסף לקוח משנה תחת {parentClientName}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAdd}>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="sub-name">שם הלקוח</Label>
                                <Input
                                    id="sub-name"
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    placeholder="לדוגמה: סניף תל אביב"
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="sub-email">אימייל (אופציונלי)</Label>
                                <Input
                                    id="sub-email"
                                    type="email"
                                    value={newEmail}
                                    onChange={e => setNewEmail(e.target.value)}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="sub-phone">טלפון (אופציונלי)</Label>
                                <Input
                                    id="sub-phone"
                                    type="tel"
                                    value={newPhone}
                                    onChange={e => setNewPhone(e.target.value)}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setAddOpen(false)} disabled={addLoading}>
                                ביטול
                            </Button>
                            <Button type="submit" disabled={addLoading}>
                                {addLoading ? 'מוסיף...' : 'הוסף'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
