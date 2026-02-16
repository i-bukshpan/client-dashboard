'use client'

import { useState, useEffect } from 'react'
import { supabase, type Client, type Payment, type Reminder, type Note } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  DollarSign,
  Calendar,
  StickyNote,
  Bell,
  Filter,
  Download
} from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/components/ui/toast'
import { formatPhoneForWhatsApp, sendWhatsAppReminder } from '@/lib/whatsapp'
import { exportPaymentsToCSV } from '@/lib/export'
import { exportRemindersToCSV } from '@/lib/export-reminders'

export default function AdminManagePage() {
  const [clients, setClients] = useState<Client[]>([])
  const [payments, setPayments] = useState<(Payment & { client?: Client })[]>([])
  const [reminders, setReminders] = useState<(Reminder & { client?: Client })[]>([])
  const [notes, setNotes] = useState<(Note & { client?: Client })[]>([])
  const [loading, setLoading] = useState(true)
  
  // Search and filters
  const [searchQuery, setSearchQuery] = useState('')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('הכל')
  const [reminderFilter, setReminderFilter] = useState<string>('הכל') // כל/פעיל/הושלם
  
  // Dialog states
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)
  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null)
  
  // Payment form
  const [paymentClientId, setPaymentClientId] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentStatus, setPaymentStatus] = useState('ממתין')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [paymentDescription, setPaymentDescription] = useState('')
  
  // Reminder form
  const [reminderClientId, setReminderClientId] = useState('')
  const [reminderTitle, setReminderTitle] = useState('')
  const [reminderDescription, setReminderDescription] = useState('')
  const [reminderDueDate, setReminderDueDate] = useState('')
  const [reminderPriority, setReminderPriority] = useState('רגיל')
  const [reminderType, setReminderType] = useState('משימה')


  useEffect(() => {
    loadAllData()
  }, [])

  const loadAllData = async () => {
    setLoading(true)
    try {
      // Load clients
      const { data: clientsData } = await supabase
        .from('clients')
        .select('*')
        .order('name', { ascending: true })
      setClients(clientsData || [])

      // Load payments with client info
      const { data: paymentsData } = await supabase
        .from('payments')
        .select('*')
        .order('payment_date', { ascending: false })
      
      if (paymentsData) {
        const paymentsWithClients = await Promise.all(
          paymentsData.map(async (payment) => {
            const { data: client } = await supabase
              .from('clients')
              .select('*')
              .eq('id', payment.client_id)
              .single()
            return { ...payment, client: client || undefined }
          })
        )
        setPayments(paymentsWithClients)
      }

      // Load reminders with client info
      const { data: remindersData } = await supabase
        .from('reminders')
        .select('*')
        .order('due_date', { ascending: true })
      
      if (remindersData) {
        const remindersWithClients = await Promise.all(
          remindersData.map(async (reminder) => {
            if (!reminder.client_id) return { ...reminder, client: undefined }
            const { data: client } = await supabase
              .from('clients')
              .select('*')
              .eq('id', reminder.client_id)
              .single()
            return { ...reminder, client: client || undefined }
          })
        )
        setReminders(remindersWithClients)
      }

      // Load notes with client info
      const { data: notesData } = await supabase
        .from('notes')
        .select('*')
        .order('updated_at', { ascending: false })
      
      if (notesData) {
        const notesWithClients = await Promise.all(
          notesData.map(async (note) => {
            const { data: client } = await supabase
              .from('clients')
              .select('*')
              .eq('id', note.client_id)
              .single()
            return { ...note, client: client || undefined }
          })
        )
        setNotes(notesWithClients)
      }
    } catch (error) {
      console.error('Error loading data:', error)
      showToast('error', 'שגיאה בטעינת הנתונים')
    } finally {
      setLoading(false)
    }
  }

  const handleAddPayment = async () => {
    if (!paymentClientId || !paymentAmount) {
      showToast('error', 'יש למלא שם לקוח וסכום')
      return
    }

    try {
      const { error } = await supabase
        .from('payments')
        .insert({
          client_id: paymentClientId,
          amount: parseFloat(paymentAmount),
          payment_date: paymentDate,
          payment_status: paymentStatus,
          payment_method: paymentMethod || null,
          description: paymentDescription || null,
        })

      if (error) throw error

      showToast('success', 'תשלום נוסף בהצלחה')

      setPaymentDialogOpen(false)
      resetPaymentForm()
      loadAllData()
    } catch (error) {
      console.error('Error adding payment:', error)
      showToast('error', error instanceof Error ? error.message : 'שגיאה בהוספת תשלום')
    }
  }

  const handleUpdatePayment = async () => {
    if (!selectedPayment || !paymentClientId || !paymentAmount) return

    try {
      const { error } = await supabase
        .from('payments')
        .update({
          client_id: paymentClientId,
          amount: parseFloat(paymentAmount),
          payment_date: paymentDate,
          payment_status: paymentStatus,
          payment_method: paymentMethod || null,
          description: paymentDescription || null,
        })
        .eq('id', selectedPayment.id)

      if (error) throw error

      showToast('success', 'תשלום עודכן בהצלחה')

      setPaymentDialogOpen(false)
      setSelectedPayment(null)
      resetPaymentForm()
      loadAllData()
    } catch (error) {
      console.error('Error updating payment:', error)
      showToast('error', error instanceof Error ? error.message : 'שגיאה בעדכון תשלום')
    }
  }

  const handleDeletePayment = async (id: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק תשלום זה?')) return

    try {
      const { error } = await supabase
        .from('payments')
        .delete()
        .eq('id', id)

      if (error) throw error

      showToast('success', 'תשלום נמחק בהצלחה')

      loadAllData()
    } catch (error) {
      console.error('Error deleting payment:', error)
      showToast('error', error instanceof Error ? error.message : 'שגיאה במחיקת תשלום')
    }
  }

  const handleAddReminder = async () => {
    if (!reminderClientId || !reminderTitle || !reminderDueDate) {
      showToast('error', 'יש למלא שם לקוח, כותרת ותאריך יעד')
      return
    }

    try {
      const { error } = await supabase
        .from('reminders')
        .insert({
          client_id: reminderClientId || null,
          title: reminderTitle,
          description: reminderDescription || null,
          due_date: reminderDueDate,
          priority: reminderPriority,
          reminder_type: reminderType,
          is_completed: false,
        })

      if (error) throw error

      showToast('success', 'תזכורת נוספה בהצלחה')

      setReminderDialogOpen(false)
      resetReminderForm()
      loadAllData()
    } catch (error) {
      console.error('Error adding reminder:', error)
      showToast('error', error instanceof Error ? error.message : 'שגיאה בהוספת תזכורת')
    }
  }

  const handleUpdateReminder = async () => {
    if (!selectedReminder || !reminderTitle || !reminderDueDate) return

    try {
      const { error } = await supabase
        .from('reminders')
        .update({
          client_id: reminderClientId || null,
          title: reminderTitle,
          description: reminderDescription || null,
          due_date: reminderDueDate,
          priority: reminderPriority,
          reminder_type: reminderType,
        })
        .eq('id', selectedReminder.id)

      if (error) throw error

      showToast('success', 'תזכורת עודכנה בהצלחה')

      setReminderDialogOpen(false)
      setSelectedReminder(null)
      resetReminderForm()
      loadAllData()
    } catch (error) {
      console.error('Error updating reminder:', error)
      showToast('error', error instanceof Error ? error.message : 'שגיאה בעדכון תזכורת')
    }
  }

  const handleToggleReminderComplete = async (reminder: Reminder) => {
    try {
      const { error } = await supabase
        .from('reminders')
        .update({ is_completed: !reminder.is_completed })
        .eq('id', reminder.id)

      if (error) throw error

      loadAllData()
    } catch (error) {
      console.error('Error toggling reminder:', error)
      showToast('error', 'שגיאה בעדכון תזכורת')
    }
  }

  const handleDeleteReminder = async (id: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק תזכורת זו?')) return

    try {
      const { error } = await supabase
        .from('reminders')
        .delete()
        .eq('id', id)

      if (error) throw error

      showToast('success', 'תזכורת נמחקה בהצלחה')

      loadAllData()
    } catch (error) {
      console.error('Error deleting reminder:', error)
      showToast('error', error instanceof Error ? error.message : 'שגיאה במחיקת תזכורת')
    }
  }

  const resetPaymentForm = () => {
    setPaymentClientId('')
    setPaymentAmount('')
    setPaymentDate(new Date().toISOString().split('T')[0])
    setPaymentStatus('ממתין')
    setPaymentMethod('')
    setPaymentDescription('')
    setSelectedPayment(null)
  }

  const resetReminderForm = () => {
    setReminderClientId('')
    setReminderTitle('')
    setReminderDescription('')
    setReminderDueDate('')
    setReminderPriority('רגיל')
    setReminderType('משימה')
    setSelectedReminder(null)
  }

  const openPaymentDialog = (payment?: Payment) => {
    if (payment) {
      setSelectedPayment(payment)
      setPaymentClientId(payment.client_id)
      setPaymentAmount(payment.amount.toString())
      setPaymentDate(payment.payment_date)
      setPaymentStatus(payment.payment_status)
      setPaymentMethod(payment.payment_method || '')
      setPaymentDescription(payment.description || '')
    } else {
      resetPaymentForm()
    }
    setPaymentDialogOpen(true)
  }

  const openReminderDialog = (reminder?: Reminder) => {
    if (reminder) {
      setSelectedReminder(reminder)
      setReminderClientId(reminder.client_id || '')
      setReminderTitle(reminder.title)
      setReminderDescription(reminder.description || '')
      setReminderDueDate(reminder.due_date.split('T')[0])
      setReminderPriority(reminder.priority)
      setReminderType(reminder.reminder_type || 'משימה')
    } else {
      resetReminderForm()
    }
    setReminderDialogOpen(true)
  }

  // Filter functions
  const filteredPayments = payments.filter(payment => {
    const matchesSearch = !searchQuery || 
      payment.client?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.amount.toString().includes(searchQuery)
    const matchesStatus = paymentStatusFilter === 'הכל' || payment.payment_status === paymentStatusFilter
    return matchesSearch && matchesStatus
  })

  const filteredReminders = reminders.filter(reminder => {
    const matchesSearch = !searchQuery ||
      reminder.client?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reminder.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reminder.description?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = reminderFilter === 'הכל' ||
      (reminderFilter === 'פעיל' && !reminder.is_completed) ||
      (reminderFilter === 'הושלם' && reminder.is_completed)
    return matchesSearch && matchesFilter
  })

  const filteredNotes = notes.filter(note => {
    return !searchQuery ||
      note.client?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase())
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">טוען נתונים...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">ניהול מרכזי</h1>
      </div>

      {/* Search */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-grey h-4 w-4" />
            <Input
              type="text"
              placeholder="חפש לפי שם לקוח, תיאור, סכום..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10"
            />
          </div>
        </div>
      </Card>

      <Tabs defaultValue="payments" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="payments" className="gap-2">
            <DollarSign className="h-4 w-4" />
            תשלומים ({filteredPayments.length})
          </TabsTrigger>
          <TabsTrigger value="reminders" className="gap-2">
            <Bell className="h-4 w-4" />
            תזכורות ({filteredReminders.length})
          </TabsTrigger>
          <TabsTrigger value="notes" className="gap-2">
            <StickyNote className="h-4 w-4" />
            הערות ({filteredNotes.length})
          </TabsTrigger>
        </TabsList>

        {/* Payments Tab */}
        <TabsContent value="payments" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="הכל">הכל</SelectItem>
                  <SelectItem value="שולם">שולם</SelectItem>
                  <SelectItem value="ממתין">ממתין</SelectItem>
                  <SelectItem value="בוטל">בוטל</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={() => exportPaymentsToCSV(filteredPayments.map(p => ({
                  ...p,
                  client_id: p.client_id
                })) as Payment[], 'כל התשלומים')}
                variant="outline"
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                ייצא CSV
              </Button>
            </div>
            <Button onClick={() => openPaymentDialog()} className="gap-2">
              <Plus className="h-4 w-4" />
              הוסף תשלום
            </Button>
          </div>

          <div className="grid gap-4">
            {filteredPayments.map((payment) => (
              <Card key={payment.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Link href={`/clients/${payment.client_id}`} className="font-semibold text-blue-600 hover:underline">
                        {payment.client?.name || 'לקוח לא ידוע'}
                      </Link>
                      <span className={`px-2 py-1 rounded text-xs ${
                        payment.payment_status === 'שולם' ? 'bg-emerald-100 text-emerald-700' :
                        payment.payment_status === 'ממתין' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {payment.payment_status}
                      </span>
                    </div>
                    <div className="text-lg font-bold text-grey mb-1">
                      ₪{payment.amount.toLocaleString()}
                    </div>
                    <div className="text-sm text-grey space-y-1">
                      <div>תאריך: {new Date(payment.payment_date).toLocaleDateString('he-IL')}</div>
                      {payment.payment_method && <div>אמצעי תשלום: {payment.payment_method}</div>}
                      {payment.description && <div>תיאור: {payment.description}</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {payment.payment_status === 'ממתין' && payment.client?.phone && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => sendWhatsAppReminder(
                          payment.client!.name,
                          payment.amount,
                          payment.payment_date,
                          payment.client!.phone!
                        )}
                        className="gap-2"
                      >
                        WhatsApp
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openPaymentDialog(payment)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeletePayment(payment.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {filteredPayments.length === 0 && (
            <Card className="p-8 text-center text-grey">
              לא נמצאו תשלומים
            </Card>
          )}
        </TabsContent>

        {/* Reminders Tab */}
        <TabsContent value="reminders" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Select value={reminderFilter} onValueChange={setReminderFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="הכל">הכל</SelectItem>
                  <SelectItem value="פעיל">פעיל בלבד</SelectItem>
                  <SelectItem value="הושלם">הושלם בלבד</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={() => exportRemindersToCSV(filteredReminders.map(r => ({
                  ...r,
                  client_id: r.client_id || ''
                })) as Reminder[], 'כל התזכורות')}
                variant="outline"
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                ייצא CSV
              </Button>
            </div>
            <Button onClick={() => openReminderDialog()} className="gap-2">
              <Plus className="h-4 w-4" />
              הוסף תזכורת
            </Button>
          </div>

          <div className="grid gap-4">
            {filteredReminders.map((reminder) => {
              const dueDate = new Date(reminder.due_date)
              const isOverdue = !reminder.is_completed && dueDate < new Date()
              const isDueSoon = !reminder.is_completed && dueDate <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

              return (
                <Card key={reminder.id} className={`p-4 ${isOverdue ? 'border-red-300 bg-red-50' : isDueSoon ? 'border-yellow-300 bg-yellow-50' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <button
                          onClick={() => handleToggleReminderComplete(reminder)}
                          className="flex-shrink-0"
                        >
                          {reminder.is_completed ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                          ) : (
                            <XCircle className="h-5 w-5 text-grey" />
                          )}
                        </button>
                        {reminder.client_id ? (
                          <Link href={`/clients/${reminder.client_id}`} className="font-semibold text-blue-600 hover:underline">
                            {reminder.client?.name || 'לקוח לא ידוע'}
                          </Link>
                        ) : (
                          <span className="font-semibold">תזכורת כללית</span>
                        )}
                        <span className={`px-2 py-1 rounded text-xs ${
                          reminder.priority === 'דחוף' ? 'bg-red-100 text-red-700' :
                          reminder.priority === 'רגיל' ? 'bg-blue-100 text-blue-700' :
                          'bg-grey-100 text-grey-700'
                        }`}>
                          {reminder.priority}
                        </span>
                        {reminder.reminder_type && (
                          <span className="px-2 py-1 rounded text-xs bg-grey-100 text-grey-700">
                            {reminder.reminder_type}
                          </span>
                        )}
                      </div>
                      <div className={`font-semibold mb-1 ${reminder.is_completed ? 'line-through text-grey' : ''}`}>
                        {reminder.title}
                      </div>
                      {reminder.description && (
                        <div className="text-sm text-grey mb-2">{reminder.description}</div>
                      )}
                      <div className="text-sm text-grey">
                        תאריך יעד: {dueDate.toLocaleDateString('he-IL')}
                        {isOverdue && !reminder.is_completed && (
                          <span className="text-red-600 font-semibold mr-2"> (איחור!)</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openReminderDialog(reminder)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteReminder(reminder.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>

          {filteredReminders.length === 0 && (
            <Card className="p-8 text-center text-grey">
              לא נמצאו תזכורות
            </Card>
          )}
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes" className="space-y-4">
          <div className="grid gap-4">
            {filteredNotes.map((note) => (
              <Card key={note.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Link href={`/clients/${note.client_id}`} className="font-semibold text-blue-600 hover:underline">
                        {note.client?.name || 'לקוח לא ידוע'}
                      </Link>
                      <span className="text-xs text-grey">
                        {new Date(note.updated_at).toLocaleDateString('he-IL')}
                      </span>
                    </div>
                    <div className="text-sm whitespace-pre-wrap">{note.content}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {filteredNotes.length === 0 && (
            <Card className="p-8 text-center text-grey">
              לא נמצאו הערות
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{selectedPayment ? 'ערוך תשלום' : 'הוסף תשלום חדש'}</DialogTitle>
            <DialogDescription>
              {selectedPayment ? 'ערוך את פרטי התשלום' : 'הוסף תשלום חדש ללקוח'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="payment-client">לקוח *</Label>
              <Select value={paymentClientId} onValueChange={setPaymentClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר לקוח" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(client => (
                    <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="payment-amount">סכום (₪) *</Label>
              <Input
                id="payment-amount"
                type="number"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="payment-date">תאריך *</Label>
              <Input
                id="payment-date"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="payment-status">סטטוס *</Label>
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="שולם">שולם</SelectItem>
                  <SelectItem value="ממתין">ממתין</SelectItem>
                  <SelectItem value="בוטל">בוטל</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="payment-method">אמצעי תשלום</Label>
              <Input
                id="payment-method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                placeholder="העברה, מזומן, צ'ק"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="payment-description">תיאור</Label>
              <Textarea
                id="payment-description"
                value={paymentDescription}
                onChange={(e) => setPaymentDescription(e.target.value)}
                placeholder="הערות נוספות"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
              ביטול
            </Button>
            <Button onClick={selectedPayment ? handleUpdatePayment : handleAddPayment}>
              {selectedPayment ? 'עדכן' : 'הוסף'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reminder Dialog */}
      <Dialog open={reminderDialogOpen} onOpenChange={setReminderDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{selectedReminder ? 'ערוך תזכורת' : 'הוסף תזכורת חדשה'}</DialogTitle>
            <DialogDescription>
              {selectedReminder ? 'ערוך את פרטי התזכורת' : 'הוסף תזכורת חדשה'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="reminder-client">לקוח (אופציונלי)</Label>
              <Select value={reminderClientId} onValueChange={setReminderClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר לקוח (אופציונלי)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">תזכורת כללית</SelectItem>
                  {clients.map(client => (
                    <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reminder-title">כותרת *</Label>
              <Input
                id="reminder-title"
                value={reminderTitle}
                onChange={(e) => setReminderTitle(e.target.value)}
                placeholder="כותרת התזכורת"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reminder-description">תיאור</Label>
              <Textarea
                id="reminder-description"
                value={reminderDescription}
                onChange={(e) => setReminderDescription(e.target.value)}
                placeholder="פרטים נוספים"
                rows={3}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reminder-due-date">תאריך יעד *</Label>
              <Input
                id="reminder-due-date"
                type="date"
                value={reminderDueDate}
                onChange={(e) => setReminderDueDate(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="reminder-priority">עדיפות</Label>
                <Select value={reminderPriority} onValueChange={setReminderPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="דחוף">דחוף</SelectItem>
                    <SelectItem value="רגיל">רגיל</SelectItem>
                    <SelectItem value="נמוך">נמוך</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="reminder-type">סוג תזכורת</Label>
                <Select value={reminderType} onValueChange={setReminderType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="משימה">משימה</SelectItem>
                    <SelectItem value="פירעון צ'ק">פירעון צ'ק</SelectItem>
                    <SelectItem value="דוח רבעוני">דוח רבעוני</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReminderDialogOpen(false)}>
              ביטול
            </Button>
            <Button onClick={selectedReminder ? handleUpdateReminder : handleAddReminder}>
              {selectedReminder ? 'עדכן' : 'הוסף'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

