'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Send, MessageSquare, Phone, Filter, MessageCircle, ChevronLeft } from 'lucide-react'
import { supabase, type Client, type Payment, type Message } from '@/lib/supabase'
import { sendWhatsAppMessage, formatPhoneForWhatsApp } from '@/lib/whatsapp'
import { cn } from '@/lib/utils'

import { ChatWidget } from '@/components/chat/chat-widget'

export default function CommunicationPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClients, setSelectedClients] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('הכל')
  const [pendingPayments, setPendingPayments] = useState<Array<Payment & { client: Client }>>([])

  // Internal Chat states
  const [selectedChatClientId, setSelectedChatClientId] = useState<string | null>(null)
  const [chats, setChats] = useState<Record<string, { lastMessage: Message | null, unreadCount: number }>>({})
  const [loadingChats, setLoadingChats] = useState(false)

  useEffect(() => {
    loadClients()
    loadPendingPayments()
    loadChatStats()

    // Realtime listener for chat updates
    const channel = supabase
      .channel('communication-chats')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages'
      }, () => {
        loadChatStats()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const loadClients = async () => {
    try {
      const { data, error } = await supabase.from('clients').select('*').order('name')
      if (error) throw error
      setClients(data || [])
    } catch (error) {
      console.error('Error loading clients:', error)
    }
  }

  const loadPendingPayments = async () => {
    try {
      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('*, clients(*)')
        .eq('payment_status', 'ממתין')
        .order('payment_date', { ascending: true })

      if (paymentsError) throw paymentsError

      setPendingPayments((payments || []) as Array<Payment & { client: Client }>)
    } catch (error) {
      console.error('Error loading pending payments:', error)
    }
  }

  const loadChatStats = async () => {
    try {
      setLoadingChats(true)

      // Fetch all unread messages
      const { data: unreadData } = await supabase
        .from('messages')
        .select('client_id')
        .eq('is_read', false)
        .eq('sender_role', 'client')

      // Fetch last message for each client
      // Note: This is a bit complex in Supabase JS without RPC or nested group by
      // We'll fetch all messages from last week and pick the last one per client for simplicity
      const lastWeek = new Date()
      lastWeek.setDate(lastWeek.getDate() - 7)

      const { data: messages } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false })

      const stats: Record<string, { lastMessage: Message | null, unreadCount: number }> = {}

      // Calculate unread counts
      if (unreadData) {
        unreadData.forEach(m => {
          if (!stats[m.client_id]) stats[m.client_id] = { lastMessage: null, unreadCount: 0 }
          stats[m.client_id].unreadCount++
        })
      }

      // Find last messages
      if (messages) {
        messages.forEach(m => {
          if (!stats[m.client_id]) stats[m.client_id] = { lastMessage: null, unreadCount: 0 }
          if (!stats[m.client_id].lastMessage) {
            stats[m.client_id].lastMessage = m
          }
        })
      }

      setChats(stats)
    } catch (error) {
      console.error('Error loading chat stats:', error)
    } finally {
      setLoadingChats(false)
    }
  }

  const filteredClients = clients.filter((client) => {
    if (filterStatus === 'הכל') return true
    return client.status === filterStatus
  })

  const handleSelectAll = () => {
    if (selectedClients.length === filteredClients.length) {
      setSelectedClients([])
    } else {
      setSelectedClients(filteredClients.map(c => c.id))
    }
  }

  const handleToggleClient = (clientId: string) => {
    if (selectedClients.includes(clientId)) {
      setSelectedClients(selectedClients.filter(id => id !== clientId))
    } else {
      setSelectedClients([...selectedClients, clientId])
    }
  }

  const handleSendMessage = () => {
    if (!message.trim()) {
      alert('יש להזין הודעה')
      return
    }

    if (selectedClients.length === 0) {
      alert('יש לבחור לפחות לקוח אחד')
      return
    }

    const clientsToMessage = filteredClients.filter(c => selectedClients.includes(c.id) && c.phone)

    if (clientsToMessage.length === 0) {
      alert('ללקוחות שנבחרו אין מספר טלפון')
      return
    }

    clientsToMessage.forEach((client) => {
      if (client.phone) {
        sendWhatsAppMessage(client.phone, message)
      }
    })

    alert(`נשלחו ${clientsToMessage.length} הודעות`)
    setSelectedClients([])
    setMessage('')
  }

  const handleSendPaymentReminder = (payment: Payment & { client: Client }) => {
    if (!payment.client.phone) {
      alert('ללקוח זה אין מספר טלפון')
      return
    }

    const reminderMessage = `שלום ${payment.client.name},\n\nתזכורת: יש לך תשלום ממתין בסך ₪${payment.amount.toLocaleString()} שמועד פירעונו ב-${new Date(payment.payment_date).toLocaleDateString('he-IL')}.\n\nנחמיה.`

    sendWhatsAppMessage(payment.client.phone, reminderMessage)
  }

  return (
    <div className="p-8" dir="rtl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-navy mb-2">תקשורת מרכזית</h1>
        <p className="text-grey">ניהול שיחות פנימיות ושליחת הודעות WhatsApp</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Internal Chats Hub */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-blue-500" />
              שיחות פנימיות
            </h2>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {loadingChats ? (
              <p className="text-grey text-center py-8">טוען שיחות...</p>
            ) : clients.length === 0 ? (
              <p className="text-grey text-center py-8">אין לקוחות במערכת</p>
            ) : (
              clients
                .map(client => ({
                  ...client,
                  stats: chats[client.id] || { lastMessage: null, unreadCount: 0 }
                }))
                .filter(client => client.stats.lastMessage !== null)
                .sort((a, b) => {
                  const dateA = a.stats.lastMessage ? new Date(a.stats.lastMessage.created_at).getTime() : 0
                  const dateB = b.stats.lastMessage ? new Date(b.stats.lastMessage.created_at).getTime() : 0
                  return dateB - dateA
                })
                .map((client) => (
                  <div
                    key={client.id}
                    onClick={() => setSelectedChatClientId(client.id)}
                    className={cn(
                      "p-4 border rounded-lg cursor-pointer transition-all hover:bg-gray-50",
                      selectedChatClientId === client.id ? "border-blue-500 bg-blue-50/30" : "border-gray-100"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-navy truncate">{client.name}</span>
                          {client.stats.unreadCount > 0 && (
                            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                              {client.stats.unreadCount}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-grey truncate">
                          {client.stats.lastMessage ? (
                            <span className={client.stats.unreadCount > 0 ? "font-medium text-black" : ""}>
                              {client.stats.lastMessage.sender_role === 'admin' ? 'אתה: ' : ''}
                              {client.stats.lastMessage.content}
                            </span>
                          ) : (
                            "אין הודעות עדיין"
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                        <span className="text-[10px] text-gray-400">
                          {client.stats.lastMessage && new Date(client.stats.lastMessage.created_at).toLocaleDateString('he-IL')}
                        </span>
                        <ChevronLeft className="h-4 w-4 text-gray-300" />
                      </div>
                    </div>
                  </div>
                ))
            )}
            {!loadingChats && Object.values(chats).filter(c => c.lastMessage !== null).length === 0 && (
              <div className="text-center py-12 border-2 border-dashed rounded-lg">
                <MessageCircle className="h-12 w-12 text-gray-200 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">אין שיחות פעילות כרגע</p>
                <p className="text-gray-400 text-xs">הודעות פנימיות מהלקוחות יופיעו כאן</p>
              </div>
            )}
          </div>
        </Card>
        {/* Message Composer */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">שלח הודעה</h2>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>בחר לקוחות</Label>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-grey" />
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="הכל">הכל</SelectItem>
                      <SelectItem value="פעיל">פעיל</SelectItem>
                      <SelectItem value="ליד">ליד</SelectItem>
                      <SelectItem value="ארכיון">ארכיון</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border rounded-lg p-4 max-h-[200px] overflow-y-auto">
                <div className="flex items-center gap-2 mb-2 pb-2 border-b">
                  <input
                    type="checkbox"
                    checked={selectedClients.length === filteredClients.length && filteredClients.length > 0}
                    onChange={handleSelectAll}
                    className="cursor-pointer"
                  />
                  <span className="text-sm font-semibold">בחר הכל</span>
                </div>
                <div className="space-y-2">
                  {filteredClients.map((client) => (
                    <div key={client.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedClients.includes(client.id)}
                        onChange={() => handleToggleClient(client.id)}
                        disabled={!client.phone}
                        className="cursor-pointer"
                      />
                      <span className={client.phone ? '' : 'text-grey'}>
                        {client.name} {!client.phone && '(אין טלפון)'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs text-grey mt-2">
                נבחרו: {selectedClients.length} לקוחות
              </p>
            </div>

            <div>
              <Label>הודעה</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="הזן את ההודעה כאן..."
                rows={6}
                className="mt-1"
              />
            </div>

            <Button onClick={handleSendMessage} className="gap-2 w-full bg-green-600 hover:bg-green-700" disabled={selectedClients.length === 0 || !message.trim()}>
              <Send className="h-4 w-4" />
              שלח ל-{selectedClients.length} לקוחות ב-WhatsApp
            </Button>
          </div>
        </Card>

        {/* Pending Payments */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">תשלומים ממתינים</h2>
          <p className="text-sm text-grey mb-4">שלח תזכורות אוטומטיות ללקוחות עם תשלומים ממתינים</p>

          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {pendingPayments.length === 0 ? (
              <p className="text-grey text-center py-8">אין תשלומים ממתינים</p>
            ) : (
              pendingPayments.map((payment) => (
                <div key={payment.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{payment.client.name}</div>
                      <div className="text-sm text-grey">
                        ₪{payment.amount.toLocaleString()} • {new Date(payment.payment_date).toLocaleDateString('he-IL')}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSendPaymentReminder(payment)}
                      disabled={!payment.client.phone}
                      className="gap-2"
                    >
                      <MessageSquare className="h-4 w-4" />
                      שלח תזכורת
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {selectedChatClientId && (
        <ChatWidget
          key={selectedChatClientId}
          clientId={selectedChatClientId}
          clientName={clients.find(c => c.id === selectedChatClientId)?.name || ''}
          senderRole="admin"
          forceOpen={true}
        />
      )}
    </div>
  )
}

