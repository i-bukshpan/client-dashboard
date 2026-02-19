'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, CheckCircle2, Clock, MessageCircle, Download, Repeat, Calendar, FileImage, Link2, Search, Filter, TrendingUp, TrendingDown, DollarSign, Table2 } from 'lucide-react'
import { InvoiceUpload, type InvoiceData } from '@/components/invoice-upload'
import { InvoiceBranchBreakdown } from '@/components/invoice-branch-breakdown'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { supabase, type Payment, type Client } from '@/lib/supabase'
import type { ClientSchema, ClientDataRecord } from '@/lib/supabase'
import { sendWhatsAppReminder } from '@/lib/whatsapp'
import { exportPaymentsToCSV } from '@/lib/export'
import { useToast } from '@/components/ui/toast'
import { logAction } from '@/lib/audit-log'
import { generateNextRecurringPayment, getRecurringPayments } from '@/lib/actions/recurring-payments'
import { getClientSchemas } from '@/lib/actions/schema'
import { getRecords } from '@/lib/actions/data-records'
import { getFinancialData, type FinancialItem, type FinancialSummary } from '@/lib/actions/financial'

interface BillingPaymentsProps {
  clientId: string
  clientName?: string
  clientPhone?: string | null
}

export function BillingPayments({ clientId, clientName, clientPhone }: BillingPaymentsProps) {
  const { showToast } = useToast()
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentStatus, setPaymentStatus] = useState('ממתין')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [description, setDescription] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [paymentType, setPaymentType] = useState<'income' | 'expense' | 'subscription' | 'salary' | 'rent' | 'utility' | 'other'>('other')
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'one-time'>('one-time')
  const [nextPaymentDate, setNextPaymentDate] = useState('')
  const [notes, setNotes] = useState('')
  const [category, setCategory] = useState('')
  const [autoGenerateNext, setAutoGenerateNext] = useState(false)
  const [recurringPayments, setRecurringPayments] = useState<Payment[]>([])
  const [invoiceUploadOpen, setInvoiceUploadOpen] = useState(false)
  const [schemas, setSchemas] = useState<ClientSchema[]>([])
  const [linkedModule, setLinkedModule] = useState('')
  const [linkedRecordId, setLinkedRecordId] = useState('')
  const [linkedRecordLabel, setLinkedRecordLabel] = useState('')
  const [linkedRecords, setLinkedRecords] = useState<ClientDataRecord[]>([])
  const [linkedRecordsLoading, setLinkedRecordsLoading] = useState(false)
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const [breakdownData, setBreakdownData] = useState<InvoiceData | null>(null)

  // Financial dashboard state
  const [financialData, setFinancialData] = useState<FinancialSummary | null>(null)
  const [financialLoading, setFinancialLoading] = useState(false)
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')
  const [filterSource, setFilterSource] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [filterSearch, setFilterSearch] = useState('')
  const [extraFilters, setExtraFilters] = useState<Record<string, string>>({})
  const [showFilters, setShowFilters] = useState(false)

  const loadPayments = async () => {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('client_id', clientId)
        .order('payment_date', { ascending: false })

      if (error) throw error
      setPayments(data || [])
    } catch (error) {
      console.error('Error loading payments:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadFinancialData = useCallback(async () => {
    setFinancialLoading(true)
    try {
      const result = await getFinancialData(clientId, {
        type: filterType,
        source_table: filterSource || undefined,
        date_from: filterDateFrom || undefined,
        date_to: filterDateTo || undefined,
        search: filterSearch || undefined,
        extra_filters: Object.keys(extraFilters).length > 0 ? extraFilters : undefined,
      })
      if (result.success && result.data) {
        setFinancialData(result.data)
      }
    } catch (err) {
      console.error('Error loading financial data:', err)
    } finally {
      setFinancialLoading(false)
    }
  }, [clientId, filterType, filterSource, filterDateFrom, filterDateTo, filterSearch, extraFilters])

  useEffect(() => {
    loadPayments()
    loadRecurringPayments()
    loadSchemas()
    loadFinancialData()
  }, [clientId])

  // Reload financial data when filters change
  useEffect(() => {
    loadFinancialData()
  }, [filterType, filterSource, filterDateFrom, filterDateTo, filterSearch, extraFilters])

  const loadSchemas = async () => {
    try {
      const result = await getClientSchemas(clientId)
      if (result.success && result.schemas) {
        setSchemas(result.schemas)
      }
    } catch (err) {
      console.error('Error loading schemas:', err)
    }
  }

  const loadRecurringPayments = async () => {
    try {
      const result = await getRecurringPayments(clientId)
      if (result.success && result.payments) {
        setRecurringPayments(result.payments)
      }
    } catch (error) {
      console.error('Error loading recurring payments:', error)
    }
  }

  const handleAdd = async () => {
    if (!amount || !paymentDate) {
      showToast('error', 'יש למלא סכום ותאריך')
      return
    }

    // Validate recurring payment fields
    if (isRecurring && !nextPaymentDate) {
      showToast('error', 'תשלום חוזר מחייב תאריך תשלום הבא')
      return
    }

    try {
      const paymentData: any = {
        client_id: clientId,
        amount: parseFloat(amount),
        payment_date: paymentDate,
        payment_status: paymentStatus,
        payment_method: paymentMethod || null,
        description: description || null,
        is_recurring: isRecurring,
        payment_type: paymentType,
        frequency: isRecurring ? frequency : 'one-time',
        next_payment_date: isRecurring ? nextPaymentDate : null,
        notes: notes || null,
        category: category || null,
        auto_generate_next: isRecurring && autoGenerateNext,
        linked_module: linkedModule || null,
        linked_record_id: linkedRecordId || null,
        linked_record_label: linkedRecordLabel || null,
      }

      const { data, error } = await supabase
        .from('payments')
        .insert([paymentData])
        .select()
        .single()

      if (error) {
        console.error('Supabase error details:', error)
        throw new Error(error.message || 'שגיאה בהוספת תשלום')
      }

      await logAction(
        'payment.created',
        'payment',
        data.id,
        `תשלום נוסף: ₪${amount}${isRecurring ? ' (חוזר)' : ''}`,
        { clientId, amount: parseFloat(amount), isRecurring }
      )

      setPayments([data, ...payments])
      resetForm()
      setOpen(false)
      showToast('success', 'תשלום נוסף בהצלחה')

      if (isRecurring) {
        loadRecurringPayments()
      }
    } catch (error) {
      console.error('Error adding payment:', error)
      const errorMessage = error instanceof Error ? error.message : 'שגיאה לא ידועה'
      showToast('error', `שגיאה בהוספת תשלום: ${errorMessage}`)
    }
  }

  const resetForm = () => {
    setAmount('')
    setPaymentDate(new Date().toISOString().split('T')[0])
    setPaymentStatus('ממתין')
    setPaymentMethod('')
    setDescription('')
    setIsRecurring(false)
    setPaymentType('other')
    setFrequency('one-time')
    setNextPaymentDate('')
    setNotes('')
    setCategory('')
    setAutoGenerateNext(false)
    setLinkedModule('')
    setLinkedRecordId('')
    setLinkedRecordLabel('')
    setLinkedRecords([])
  }

  const handleInvoiceScan = (data: InvoiceData) => {
    if (data.amount != null) setAmount(String(data.amount))
    if (data.payment_date) setPaymentDate(data.payment_date)
    if (data.payment_method) setPaymentMethod(data.payment_method)
    if (data.description) {
      const desc = data.vendor_name
        ? `${data.description} (${data.vendor_name})`
        : data.description
      setDescription(desc)
    }
    if (data.payment_type && ['income', 'expense', 'subscription', 'salary', 'rent', 'utility', 'other'].includes(data.payment_type)) {
      setPaymentType(data.payment_type as any)
    }
    if (data.category) setCategory(data.category)
    if (data.invoice_number) {
      setNotes(prev => prev ? `${prev}\nמס׳ חשבונית: ${data.invoice_number}` : `מס׳ חשבונית: ${data.invoice_number}`)
    }
    setOpen(true)
  }

  const handleBranchBreakdown = (data: InvoiceData) => {
    setBreakdownData(data)
    setBreakdownOpen(true)
  }

  const loadLinkedRecords = async (moduleName: string) => {
    setLinkedRecordsLoading(true)
    try {
      const result = await getRecords(clientId, moduleName)
      if (result.success && result.records) {
        setLinkedRecords(result.records)
      } else {
        setLinkedRecords([])
      }
    } catch {
      setLinkedRecords([])
    } finally {
      setLinkedRecordsLoading(false)
    }
  }

  const handleLinkedModuleChange = (val: string) => {
    if (val === '__none__') {
      setLinkedModule('')
      setLinkedRecordId('')
      setLinkedRecordLabel('')
      setLinkedRecords([])
      return
    }
    setLinkedModule(val)
    setLinkedRecordId('')
    setLinkedRecordLabel('')
    loadLinkedRecords(val)
  }

  const handleLinkedRecordChange = (recordId: string) => {
    setLinkedRecordId(recordId)
    const record = linkedRecords.find(r => r.id === recordId)
    if (record) {
      const schema = schemas.find(s => s.module_name === linkedModule)
      const firstCol = schema?.columns?.[0]
      const label = firstCol ? (record.data?.[firstCol.name] || record.id) : record.id
      setLinkedRecordLabel(String(label))
    }
  }

  const handleGenerateNextPayment = async (paymentId: string) => {
    try {
      const result = await generateNextRecurringPayment(paymentId)
      if (result.success) {
        showToast('success', 'תשלום הבא נוצר בהצלחה')
        loadPayments()
        loadRecurringPayments()
      } else {
        showToast('error', result.error || 'שגיאה ביצירת תשלום הבא')
      }
    } catch (error: any) {
      showToast('error', error.message || 'שגיאה בלתי צפויה')
    }
  }

  const calculateNextDate = (date: string, freq: string): string => {
    const d = new Date(date)
    switch (freq) {
      case 'daily': d.setDate(d.getDate() + 1); break
      case 'weekly': d.setDate(d.getDate() + 7); break
      case 'monthly': d.setMonth(d.getMonth() + 1); break
      case 'quarterly': d.setMonth(d.getMonth() + 3); break
      case 'yearly': d.setFullYear(d.getFullYear() + 1); break
    }
    return d.toISOString().split('T')[0]
  }

  useEffect(() => {
    if (isRecurring && paymentDate && frequency !== 'one-time') {
      setNextPaymentDate(calculateNextDate(paymentDate, frequency))
    }
  }, [isRecurring, paymentDate, frequency])

  const handleDelete = async (id: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק תשלום זה?')) return

    try {
      const { error } = await supabase
        .from('payments')
        .delete()
        .eq('id', id)

      if (error) throw error

      setPayments(payments.filter(p => p.id !== id))

      // Log action
      await logAction(
        'payment.deleted',
        'payment',
        id,
        'תשלום נמחק',
        { client_id: clientId }
      )

      showToast('success', 'תשלום נמחק בהצלחה')
    } catch (error) {
      console.error('Error deleting payment:', error)
      showToast('error', 'שגיאה במחיקת תשלום')
    }
  }

  const handleToggleStatus = async (payment: Payment) => {
    try {
      const newStatus = payment.payment_status === 'שולם' ? 'ממתין' : 'שולם'
      const { error } = await supabase
        .from('payments')
        .update({ payment_status: newStatus })
        .eq('id', payment.id)

      if (error) throw error

      setPayments(payments.map(p =>
        p.id === payment.id ? { ...p, payment_status: newStatus } : p
      ))

      // Log action
      await logAction(
        'payment.updated',
        'payment',
        payment.id,
        `סטטוס תשלום עודכן ל-${newStatus}`,
        { client_id: clientId, old_status: payment.payment_status, new_status: newStatus }
      )

      showToast('success', `סטטוס עודכן ל-${newStatus}`)
    } catch (error) {
      console.error('Error updating payment status:', error)
      showToast('error', 'שגיאה בעדכון סטטוס תשלום')
    }
  }

  const totalPaid = payments
    .filter(p => p.payment_status === 'שולם')
    .reduce((sum, p) => sum + p.amount, 0)

  const totalPending = payments
    .filter(p => p.payment_status === 'ממתין')
    .reduce((sum, p) => sum + p.amount, 0)

  const totalOwed = totalPending

  const hasFinancialTables = financialData && financialData.available_tables.length > 0

  if (loading) {
    return <div className="text-center py-8 text-grey">טוען תשלומים...</div>
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">תשלומים</h3>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => setInvoiceUploadOpen(true)}
          >
            <FileImage className="h-4 w-4" />
            סריקת חשבונית
          </Button>
          <InvoiceUpload
            open={invoiceUploadOpen}
            onOpenChange={setInvoiceUploadOpen}
            onDataExtracted={handleInvoiceScan}
            onBranchBreakdown={schemas.length > 0 ? handleBranchBreakdown : undefined}
          />
          {breakdownData && (
            <InvoiceBranchBreakdown
              open={breakdownOpen}
              onOpenChange={setBreakdownOpen}
              clientId={clientId}
              invoiceData={breakdownData}
              onComplete={() => {
                setBreakdownOpen(false)
                setBreakdownData(null)
                loadPayments()
              }}
            />
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                הוסף תשלום
              </Button>
            </DialogTrigger>
            <DialogContent dir="rtl">
              <DialogHeader>
                <DialogTitle>הוסף תשלום חדש</DialogTitle>
                <DialogDescription>
                  הזן את פרטי התשלום מהלקוח
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="amount">סכום (₪)</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="paymentDate">תאריך</Label>
                  <Input
                    id="paymentDate"
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="paymentStatus">סטטוס</Label>
                  <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ממתין">ממתין</SelectItem>
                      <SelectItem value="שולם">שולם</SelectItem>
                      <SelectItem value="בוטל">בוטל</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="paymentType">סוג תשלום</Label>
                  <Select value={paymentType} onValueChange={(v: any) => setPaymentType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">הכנסה</SelectItem>
                      <SelectItem value="expense">הוצאה</SelectItem>
                      <SelectItem value="subscription">מנוי</SelectItem>
                      <SelectItem value="salary">משכורת</SelectItem>
                      <SelectItem value="rent">שכר דירה</SelectItem>
                      <SelectItem value="utility">שירותים</SelectItem>
                      <SelectItem value="other">אחר</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="category">קטגוריה (אופציונלי)</Label>
                  <Input
                    id="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="לדוגמה: שכירות, חשמל"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="paymentMethod">אמצעי תשלום (אופציונלי)</Label>
                  <Input
                    id="paymentMethod"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    placeholder="לדוגמה: העברה בנקאית, מזומן"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">תיאור (אופציונלי)</Label>
                  <Input
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="הערות נוספות"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isRecurring"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="isRecurring" className="cursor-pointer">תשלום חוזר</Label>
                </div>
                {isRecurring && (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="frequency">תדירות</Label>
                      <Select value={frequency} onValueChange={(v: any) => setFrequency(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">יומי</SelectItem>
                          <SelectItem value="weekly">שבועי</SelectItem>
                          <SelectItem value="monthly">חודשי</SelectItem>
                          <SelectItem value="quarterly">רבעוני</SelectItem>
                          <SelectItem value="yearly">שנתי</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="nextPaymentDate">תאריך תשלום הבא *</Label>
                      <Input
                        id="nextPaymentDate"
                        type="date"
                        value={nextPaymentDate}
                        onChange={(e) => setNextPaymentDate(e.target.value)}
                        required={isRecurring}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="autoGenerateNext"
                        checked={autoGenerateNext}
                        onChange={(e) => setAutoGenerateNext(e.target.checked)}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="autoGenerateNext" className="cursor-pointer">צור תשלום הבא אוטומטית</Label>
                    </div>
                  </>
                )}
                {/* Table Link section */}
                {schemas.length > 0 && (
                  <div className="border rounded-lg p-3 space-y-3 bg-blue-50/50">
                    <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
                      <Link2 className="h-4 w-4" />
                      שייך לשורה בטבלה (אופציונלי)
                    </div>
                    <div className="grid gap-2">
                      <Select value={linkedModule || '__none__'} onValueChange={handleLinkedModuleChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="בחר טבלה" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">ללא שייוך</SelectItem>
                          {schemas.map(s => (
                            <SelectItem key={s.id} value={s.module_name}>{s.module_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {linkedModule && (
                      <div className="grid gap-2">
                        <Label className="text-sm">בחר שורה</Label>
                        {linkedRecordsLoading ? (
                          <div className="text-xs text-grey">טוען שורות...</div>
                        ) : linkedRecords.length === 0 ? (
                          <div className="text-xs text-grey">אין שורות בטבלה זו</div>
                        ) : (
                          <Select value={linkedRecordId || '__none__'} onValueChange={handleLinkedRecordChange}>
                            <SelectTrigger>
                              <SelectValue placeholder="בחר שורה" />
                            </SelectTrigger>
                            <SelectContent>
                              {linkedRecords.map(record => {
                                const schema = schemas.find(s => s.module_name === linkedModule)
                                const firstCol = schema?.columns?.[0]
                                const label = firstCol ? (record.data?.[firstCol.name] || record.id) : record.id
                                return (
                                  <SelectItem key={record.id} value={record.id}>
                                    {String(label)}
                                  </SelectItem>
                                )
                              })}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <div className="grid gap-2">
                  <Label htmlFor="notes">הערות נוספות (אופציונלי)</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="הערות נוספות על התשלום"
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setOpen(false)
                  resetForm()
                }}>
                  ביטול
                </Button>
                <Button onClick={handleAdd}>הוסף</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Financial Dashboard */}
      {hasFinancialTables ? (
        <>
          {/* Enhanced Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-1 text-sm text-green-700 mb-1">
                <TrendingUp className="h-4 w-4" />
                הכנסות
              </div>
              <div className="text-2xl font-bold text-green-900">
                ₪{(financialData?.total_income || 0).toLocaleString('he-IL')}
              </div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-1 text-sm text-red-700 mb-1">
                <TrendingDown className="h-4 w-4" />
                הוצאות
              </div>
              <div className="text-2xl font-bold text-red-900">
                ₪{(financialData?.total_expenses || 0).toLocaleString('he-IL')}
              </div>
            </div>
            <div className={`border rounded-lg p-4 ${(financialData?.net || 0) >= 0
                ? 'bg-blue-50 border-blue-200'
                : 'bg-orange-50 border-orange-200'
              }`}>
              <div className={`flex items-center gap-1 text-sm mb-1 ${(financialData?.net || 0) >= 0 ? 'text-blue-700' : 'text-orange-700'
                }`}>
                <DollarSign className="h-4 w-4" />
                רווח נקי
              </div>
              <div className={`text-2xl font-bold ${(financialData?.net || 0) >= 0 ? 'text-blue-900' : 'text-orange-900'
                }`}>
                ₪{(financialData?.net || 0).toLocaleString('he-IL')}
              </div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center gap-1 text-sm text-yellow-700 mb-1">
                <Clock className="h-4 w-4" />
                ממתין
              </div>
              <div className="text-2xl font-bold text-yellow-900">
                ₪{(financialData?.pending || 0).toLocaleString('he-IL')}
              </div>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="border rounded-lg p-3 bg-gray-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Filter className="h-4 w-4" />
                סינון נתונים פיננסיים
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowFilters(!showFilters)}>
                {showFilters ? 'הסתר סינון' : 'הצג סינון'}
              </Button>
            </div>
            {showFilters && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div>
                  <Label className="text-xs">סוג</Label>
                  <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">הכל</SelectItem>
                      <SelectItem value="income">הכנסות</SelectItem>
                      <SelectItem value="expense">הוצאות</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">טבלת מקור</Label>
                  <Select value={filterSource || '__all__'} onValueChange={(v) => setFilterSource(v === '__all__' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">כל הטבלאות</SelectItem>
                      {financialData?.available_tables.map(t => (
                        <SelectItem key={t.module_name} value={t.module_name}>
                          {t.module_name} ({t.financial_type === 'income' ? 'הכנסה' : 'הוצאה'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">מתאריך</Label>
                  <Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">עד תאריך</Label>
                  <Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">חיפוש</Label>
                  <div className="relative">
                    <Search className="absolute right-2 top-2.5 h-4 w-4 text-grey" />
                    <Input
                      className="pr-8"
                      placeholder="חפש..."
                      value={filterSearch}
                      onChange={e => setFilterSearch(e.target.value)}
                    />
                  </div>
                </div>
                {/* Dynamic extra filters from table columns */}
                {financialData?.filterable_columns.map(col => (
                  <div key={col.column_name}>
                    <Label className="text-xs">{col.label}</Label>
                    <Select
                      value={extraFilters[col.column_name] || '__all__'}
                      onValueChange={(v) => {
                        setExtraFilters(prev => {
                          const next = { ...prev }
                          if (v === '__all__') delete next[col.column_name]
                          else next[col.column_name] = v
                          return next
                        })
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">הכל</SelectItem>
                        {col.values.map(v => (
                          <SelectItem key={v} value={v}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Financial Items List */}
          {financialData && financialData.items.length > 0 && (
            <div className="mt-4">
              <h4 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Table2 className="h-5 w-5" />
                נתונים פיננסיים מטבלאות ({financialData.items.filter(i => i.source === 'table').length} רשומות)
              </h4>
              <div className="space-y-2">
                {financialData.items
                  .filter(i => i.source === 'table')
                  .map(item => (
                    <div key={item.id} className="border rounded-lg p-3 bg-white hover:shadow-sm transition-shadow flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {item.type === 'income' ? (
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-600" />
                        )}
                        <div>
                          <span className="text-lg font-bold">₪{item.amount.toLocaleString('he-IL')}</span>
                          {item.description && <span className="text-sm text-grey mr-2">— {item.description}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        {item.source_table && (
                          <span className={`px-2 py-1 rounded font-medium ${item.type === 'income'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                            }`}>
                            {item.source_table}
                          </span>
                        )}
                        {item.date && (
                          <span className="text-grey">
                            {new Date(item.date).toLocaleDateString('he-IL')}
                          </span>
                        )}
                        {item.extra_data && Object.entries(item.extra_data).slice(0, 2).map(([k, v]) => (
                          <span key={k} className="px-1.5 py-0.5 rounded bg-gray-100 text-grey">
                            {String(v)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      ) : (
        /* Original simple summary when no financial tables exist */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-sm text-green-700 mb-1">שולם</div>
            <div className="text-2xl font-bold text-green-900">
              ₪{totalPaid.toLocaleString('he-IL')}
            </div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="text-sm text-yellow-700 mb-1">ממתין</div>
            <div className="text-2xl font-bold text-yellow-900">
              ₪{totalPending.toLocaleString('he-IL')}
            </div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-sm text-red-700 mb-1">סך הכל חייב</div>
            <div className="text-2xl font-bold text-red-900">
              ₪{totalOwed.toLocaleString('he-IL')}
            </div>
          </div>
        </div>
      )}

      {/* Recurring Payments Section */}
      {recurringPayments.length > 0 && (
        <div className="mt-6">
          <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Repeat className="h-5 w-5 text-blue-600" />
            תשלומים חוזרים
          </h4>
          <div className="space-y-3">
            {recurringPayments.map((payment) => (
              <div
                key={payment.id}
                className="border rounded-lg p-4 bg-blue-50 border-blue-200"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Repeat className="h-4 w-4 text-blue-600" />
                      <span className="text-lg font-bold">
                        ₪{payment.amount.toLocaleString('he-IL')}
                      </span>
                      <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-700">
                        {payment.payment_type === 'income' ? 'הכנסה' :
                          payment.payment_type === 'expense' ? 'הוצאה' :
                            payment.payment_type || 'אחר'}
                      </span>
                      <span className="px-2 py-1 rounded text-xs bg-grey/20">
                        {payment.frequency === 'monthly' ? 'חודשי' :
                          payment.frequency === 'weekly' ? 'שבועי' :
                            payment.frequency === 'yearly' ? 'שנתי' :
                              payment.frequency || 'אחד-פעמי'}
                      </span>
                    </div>
                    <div className="text-sm text-grey space-y-1">
                      <div>תאריך הבא: {payment.next_payment_date ? new Date(payment.next_payment_date).toLocaleDateString('he-IL') : '-'}</div>
                      {payment.category && <div>קטגוריה: {payment.category}</div>}
                      {payment.description && <div>תיאור: {payment.description}</div>}
                      {payment.notes && <div>הערות: {payment.notes}</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {payment.next_payment_date && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleGenerateNextPayment(payment.id)}
                        className="gap-2"
                        title="צור תשלום הבא"
                      >
                        <Calendar className="h-4 w-4" />
                        צור הבא
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payments List */}
      <div className="mt-6">
        <h4 className="text-lg font-semibold mb-4">כל התשלומים</h4>
        {payments.length === 0 ? (
          <div className="text-center py-8 text-grey">
            אין תשלומים רשומים. הוסף תשלום חדש להתחיל.
          </div>
        ) : (
          <div className="space-y-3">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="border rounded-lg p-4 bg-white hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {payment.payment_status === 'שולם' ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : payment.payment_status === 'בוטל' ? (
                        <Clock className="h-5 w-5 text-red-600" />
                      ) : (
                        <Clock className="h-5 w-5 text-yellow-600" />
                      )}
                      {payment.is_recurring && <Repeat className="h-4 w-4 text-blue-600" />}
                      <span className="text-xl font-bold">
                        ₪{payment.amount.toLocaleString('he-IL')}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs ${payment.payment_status === 'שולם'
                        ? 'bg-green-100 text-green-700'
                        : payment.payment_status === 'בוטל'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-yellow-100 text-yellow-700'
                        }`}>
                        {payment.payment_status}
                      </span>
                      {payment.payment_type && (
                        <span className="px-2 py-1 rounded text-xs bg-grey/20">
                          {payment.payment_type === 'income' ? 'הכנסה' :
                            payment.payment_type === 'expense' ? 'הוצאה' :
                              payment.payment_type}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-grey space-y-1">
                      <div>תאריך: {new Date(payment.payment_date).toLocaleDateString('he-IL')}</div>
                      {payment.next_payment_date && (
                        <div className="text-blue-600">תשלום הבא: {new Date(payment.next_payment_date).toLocaleDateString('he-IL')}</div>
                      )}
                      {payment.category && <div>קטגוריה: {payment.category}</div>}
                      {payment.payment_method && <div>אמצעי תשלום: {payment.payment_method}</div>}
                      {payment.description && <div>תיאור: {payment.description}</div>}
                      {payment.notes && <div>הערות: {payment.notes}</div>}
                      {payment.linked_module && (
                        <div className="flex items-center gap-1 mt-1">
                          <Link2 className="h-3 w-3 text-blue-500" />
                          <span className="text-blue-600">
                            משויך ל: {payment.linked_module}
                            {payment.linked_record_label && ` → ${payment.linked_record_label}`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {payment.payment_status === 'ממתין' && clientPhone && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (clientName && clientPhone) {
                            sendWhatsAppReminder(
                              clientName,
                              payment.amount,
                              payment.payment_date,
                              clientPhone
                            )
                          } else {
                            alert('חסר שם לקוח או מספר טלפון')
                          }
                        }}
                        className="bg-green-50 text-green-700 hover:bg-green-100 border-green-200"
                        title="שלח תזכורת ב-WhatsApp"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleStatus(payment)}
                    >
                      {payment.payment_status === 'שולם' ? 'סמן כממתין' : 'סמן כשולם'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(payment.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

