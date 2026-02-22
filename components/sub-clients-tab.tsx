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
    readOnly?: boolean
    isPublicView?: boolean
}

interface SubClientWithData extends Client {
    currentBalance: number
    monthlyIncome: number
    monthlyExpense: number
}

import { getFinancialData } from '@/lib/actions/financial'
import { getClientShareToken } from '@/lib/actions/client-share'
import { useRouter } from 'next/navigation'

export function SubClientsTab({ parentClientId, parentClientName, readOnly = false, isPublicView = false }: SubClientsTabProps) {
    const { showToast } = useToast()
    const router = useRouter()
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

            const now = new Date()
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

            const financialDataPromises = data.map(async (client) => {
                const res = await getFinancialData(client.id)
                let currentBalance = 0
                let monthlyIncome = 0
                let monthlyExpense = 0

                if (res.success && res.data) {
                    res.data.items.forEach(item => {
                        const isIncome = item.type === 'income'
                        const isExpense = item.type === 'expense'
                        const isPaid = item.source === 'table' || item.status === 'שולם'

                        if (isPaid) {
                            if (isIncome) currentBalance += item.amount
                            if (isExpense) currentBalance -= item.amount

                            if (item.date >= startOfMonth && item.date <= endOfMonth) {
                                if (isIncome) monthlyIncome += item.amount
                                if (isExpense) monthlyExpense += item.amount
                            }
                        }
                    })
                }

                return {
                    ...client,
                    currentBalance,
                    monthlyIncome,
                    monthlyExpense
                }
            })

            const subClientsWithStats = await Promise.all(financialDataPromises)
            setSubClients(subClientsWithStats)
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
        <div className="space-y-10 animate-fade-in-up">
            {/* Bento-grid Summary KPIs */}
            {subClients.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="bg-blue-600 p-6 rounded-[2.5rem] text-white shadow-xl shadow-blue-600/20 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl transition-transform duration-700 group-hover:scale-150" />
                        <div className="relative z-10 flex flex-col h-full justify-between">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 rounded-xl bg-white/20">
                                    <Users className="h-5 w-5 text-white" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest opacity-70">לקוחות משנה</span>
                            </div>
                            <div className="text-4xl font-black">{subClients.length}</div>
                        </div>
                    </div>

                    <div className="bg-white/70 backdrop-blur-xl border border-border/50 p-6 rounded-[2.5rem] shadow-sm relative overflow-hidden group hover-lift">
                        <div className="relative z-10">
                            <span className="text-[10px] font-black uppercase tracking-widest text-grey">יתרה כוללת</span>
                            <div className={`text-3xl font-black mt-2 ${totalBalance >= 0 ? 'text-navy' : 'text-rose-500'}`} dir="ltr">
                                ₪{totalBalance.toLocaleString()}
                            </div>
                        </div>
                    </div>

                    <div className="bg-emerald-600 p-6 rounded-[2.5rem] text-white shadow-xl shadow-emerald-600/20 relative overflow-hidden group">
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full -ml-16 -mb-16 blur-2xl transition-transform duration-700 group-hover:scale-150" />
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-1">
                                <TrendingUp className="h-4 w-4 text-white/70" />
                                <span className="text-[10px] font-black uppercase tracking-widest opacity-70">הכנסות חודשי</span>
                            </div>
                            <div className="text-3xl font-black" dir="ltr">₪{totalIncome.toLocaleString()}</div>
                        </div>
                    </div>

                    <div className="bg-rose-600 p-6 rounded-[2.5rem] text-white shadow-xl shadow-rose-600/20 relative overflow-hidden group">
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full -ml-16 -mb-16 blur-2xl transition-transform duration-700 group-hover:scale-150" />
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-1">
                                <TrendingDown className="h-4 w-4 text-white/70" />
                                <span className="text-[10px] font-black uppercase tracking-widest opacity-70">הוצאות חודשי</span>
                            </div>
                            <div className="text-3xl font-black" dir="ltr">₪{totalExpense.toLocaleString()}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Action bar */}
            <div className="flex items-center justify-between flex-wrap gap-4 bg-white/40 backdrop-blur-md p-6 rounded-[2rem] border border-border/50 shadow-sm">
                <div>
                    <h3 className="text-xl font-black text-navy tracking-tight">
                        לקוחות משנה של <span className="text-primary">{parentClientName}</span>
                    </h3>
                    <p className="text-xs font-medium text-grey mt-1">ניהול ומעקב אחר סניפים או לקוחות תחת {parentClientName}</p>
                </div>
                {!readOnly && (
                    <Button
                        className="gap-2 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black px-6 h-12 shadow-lg shadow-primary/20"
                        onClick={() => setAddOpen(true)}
                    >
                        <Plus className="h-5 w-5" />
                        הוסף לקוח משנה
                    </Button>
                )}
            </div>

            {/* Sub-client list */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4 bg-white/30 backdrop-blur-sm rounded-[3rem] border border-dashed border-border/50">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                    <span className="text-grey font-bold">טוען לקוחות משנה...</span>
                </div>
            ) : subClients.length === 0 ? (
                <div className="text-center py-24 bg-white/30 backdrop-blur-sm rounded-[3rem] border-2 border-dashed border-border/50">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Users className="h-10 w-10 text-slate-300" />
                    </div>
                    <p className="text-navy font-black text-xl mb-6">אין עדיין לקוחות משנה</p>
                    {!readOnly && (
                        <Button
                            variant="outline"
                            className="gap-2 rounded-2xl border-primary/30 text-primary font-black hover:bg-primary/5 px-8 h-12"
                            onClick={() => setAddOpen(true)}
                        >
                            <Plus className="h-5 w-5" />
                            הוסף לקוח משנה ראשון
                        </Button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
                            onDelete={readOnly ? undefined : handleDelete}
                            readOnly={readOnly}
                            isPublicView={isPublicView}
                            onCardClick={isPublicView ? async (id, name) => {
                                try {
                                    showToast('success', `טוען קישור צפייה עבור ${name}...`)
                                    const res = await getClientShareToken(id)
                                    if (res.success && res.token) {
                                        router.push(`/view/${res.token}`)
                                    } else {
                                        showToast('error', 'לא ניתן ליצור או לטעון קישור שיתוף ציבורי עבור לקוח זה')
                                    }
                                } catch (e) {
                                    showToast('error', 'שגיאה במעבר לפרופיל לקוח משנה')
                                }
                            } : undefined}
                        />
                    ))}
                </div>
            )}

            {/* Add sub-client dialog */}
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogContent dir="rtl" className="max-w-md rounded-[2.5rem] border-none shadow-2xl p-8 overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-2xl" />

                    <DialogHeader className="relative z-10 text-right">
                        <DialogTitle className="text-2xl font-black text-navy">הוסף לקוח משנה</DialogTitle>
                        <DialogDescription className="font-bold text-grey">
                            פתח סניף או לקוח חדש תחת {parentClientName}
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleAdd} className="space-y-6 relative z-10 mt-4">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="sub-name" className="text-xs font-black uppercase tracking-widest text-grey mr-1">שם הלקוח / סניף</Label>
                                <Input
                                    id="sub-name"
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    placeholder="לדוגמה: סניף תל אביב"
                                    required
                                    className="rounded-2xl border-border/40 bg-slate-50/50 h-12 px-4 focus:bg-white transition-all font-bold"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="sub-email" className="text-xs font-black uppercase tracking-widest text-grey mr-1">אימייל (אופציונלי)</Label>
                                <Input
                                    id="sub-email"
                                    type="email"
                                    value={newEmail}
                                    onChange={e => setNewEmail(e.target.value)}
                                    className="rounded-2xl border-border/40 bg-slate-50/50 h-12 px-4 focus:bg-white transition-all font-bold"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="sub-phone" className="text-xs font-black uppercase tracking-widest text-grey mr-1">טלפון (אופציונלי)</Label>
                                <Input
                                    id="sub-phone"
                                    type="tel"
                                    value={newPhone}
                                    onChange={e => setNewPhone(e.target.value)}
                                    className="rounded-2xl border-border/40 bg-slate-50/50 h-12 px-4 focus:bg-white transition-all font-bold"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setAddOpen(false)}
                                disabled={addLoading}
                                className="flex-1 rounded-2xl font-black text-grey h-12"
                            >
                                ביטול
                            </Button>
                            <Button
                                type="submit"
                                disabled={addLoading}
                                className="flex-2 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black h-12 px-8 shadow-lg shadow-primary/20"
                            >
                                {addLoading ? 'מוסיף...' : 'צור לקוח'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
