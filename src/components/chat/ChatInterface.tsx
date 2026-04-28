'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Send, Hash, User, Search, MessageSquare } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

interface Props {
  initialConversations: any[]
  allEmployees?: any[]
  currentUserId: string
  isAdmin: boolean
}

export function ChatInterface({ initialConversations, allEmployees, currentUserId, isAdmin }: Props) {
  const [conversations, setConversations] = useState(initialConversations)
  const [selectedConv, setSelectedConv] = useState<any | null>(initialConversations[0] || null)
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const scrollRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // Generate virtual conversations for employees who don't have one yet
  const displayList = isAdmin ? (allEmployees || []).map(emp => {
    const existing = conversations.find(c => c.employee_id === emp.id)
    if (existing) return existing
    return {
      id: `new-${emp.id}`,
      employee_id: emp.id,
      admin_id: currentUserId,
      profiles: emp,
      isVirtual: true
    }
  }) : conversations

  // Fetch unread counts
  useEffect(() => {
    const fetchUnread = async () => {
      // Fetch messages not sent by current user
      const { data: messagesData } = await (supabase.from('chat_messages') as any)
        .select('id, conversation_id')
        .neq('sender_id', currentUserId)

      // Fetch read receipts for current user
      const { data: receiptsData } = await (supabase.from('chat_read_receipts') as any)
        .select('message_id')
        .eq('user_id', currentUserId)

      const readMessageIds = new Set(receiptsData?.map((r: any) => r.message_id) || [])
      const counts: Record<string, number> = {}
      
      messagesData?.forEach((msg: any) => {
        if (!readMessageIds.has(msg.id)) {
          counts[msg.conversation_id] = (counts[msg.conversation_id] || 0) + 1
        }
      })
      setUnreadCounts(counts)
    }
    fetchUnread()
  }, [messages, currentUserId])

  // Mark as read when selecting or receiving messages
  useEffect(() => {
    if (!selectedConv || selectedConv.isVirtual) return

    const markAsRead = async () => {
      // Find all messages in this conversation not sent by me
      const { data: messages } = await (supabase.from('chat_messages') as any)
        .select('id')
        .eq('conversation_id', selectedConv.id)
        .neq('sender_id', currentUserId)

      if (!messages || messages.length === 0) return

      // Find which ones are already read
      const { data: readReceipts } = await (supabase.from('chat_read_receipts') as any)
        .select('message_id')
        .eq('user_id', currentUserId)
        .in('message_id', messages.map((m: any) => m.id))

      const readIds = new Set(readReceipts?.map((r: any) => r.message_id) || [])
      const unreadIds = (messages as any[]).filter(m => !readIds.has(m.id)).map(m => m.id)

      if (unreadIds.length > 0) {
        const receipts = unreadIds.map(id => ({
          message_id: id,
          user_id: currentUserId
        }))
        await (supabase.from('chat_read_receipts') as any).upsert(receipts, { onConflict: 'message_id,user_id' })
        
        // Update local count
        setUnreadCounts(prev => ({ ...prev, [selectedConv.id]: 0 }))
      }
    }
    markAsRead()
  }, [selectedConv, messages, currentUserId])

  // Load messages for selected conversation
  useEffect(() => {
    if (!selectedConv || selectedConv.isVirtual) {
      setMessages([])
      return
    }
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', selectedConv.id)
        .order('created_at', { ascending: true })
      setMessages(data || [])
    }
    fetchMessages()

    const channel = supabase
      .channel(`chat:${selectedConv.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${selectedConv.id}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedConv])

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !selectedConv) return

    let conversationId = selectedConv.id

    // Create conversation if virtual
    if (selectedConv.isVirtual) {
      const { data: newConv, error: convError } = await (supabase.from('conversations') as any)
        .insert({
          admin_id: currentUserId,
          employee_id: selectedConv.employee_id
        })
        .select()
        .single()

      if (convError) {
        console.error('Error creating conversation:', convError)
        return
      }
      conversationId = newConv.id
      const fullConv = { ...newConv, profiles: selectedConv.profiles }
      setConversations(prev => [...prev, fullConv])
      setSelectedConv(fullConv)
    }

    const { error } = await (supabase.from('chat_messages') as any).insert({
      conversation_id: conversationId,
      sender_id: currentUserId,
      content: newMessage,
    })

    if (!error) setNewMessage('')
  }

  return (
    <div className="flex h-full">
      {/* Conversation List (Sidebar) */}
      <div className={cn("w-64 border-l border-border/50 flex flex-col bg-muted/20", !isAdmin && "hidden")}>
        <div className="p-4 border-b border-border/50 bg-white/50">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pr-9 h-9 text-xs border-slate-200 focus:ring-primary/20" placeholder="חיפוש עובד..." />
          </div>
        </div>
        <ScrollArea className="flex-1">
          {displayList.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setSelectedConv(conv)}
              className={cn(
                "w-full p-4 flex items-center gap-3 hover:bg-white transition-all text-right border-b border-border/10",
                selectedConv?.id === conv.id && "bg-white dark:bg-slate-900 border-l-4 border-l-primary shadow-sm"
              )}
            >
              <Avatar className="w-10 h-10 border border-slate-100 shadow-sm">
                <AvatarImage src={conv.profiles?.avatar_url} />
                <AvatarFallback className="bg-primary/10 text-primary font-bold">
                  {conv.profiles?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate text-slate-900">{conv.profiles?.full_name}</p>
                <p className="text-[10px] text-muted-foreground truncate italic mt-0.5">
                  {conv.isVirtual ? 'התחל שיחה חדשה' : 'צפה בשיחה'}
                </p>
              </div>
              {unreadCounts[conv.id] > 0 && (
                <div className="w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                  {unreadCounts[conv.id]}
                </div>
              )}
            </button>
          ))}
        </ScrollArea>
      </div>

      {/* Chat Window */}
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-950">
        {!selectedConv ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground opacity-50 p-8 text-center">
            <MessageSquare className="w-12 h-12 mb-4" />
            <p>בחר עובד מהרשימה כדי להתחיל שיחה</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="p-4 border-b border-border/50 flex items-center justify-between bg-card/50 backdrop-blur-sm sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={selectedConv.profiles?.avatar_url} />
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                    {selectedConv.profiles?.full_name?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-bold text-sm leading-none">{selectedConv.profiles?.full_name}</p>
                  <p className="text-[10px] text-emerald-500 font-medium mt-1">• מחובר</p>
                </div>
              </div>
            </div>

            {/* Message Area */}
            <div className="flex-1 p-4 overflow-y-auto" ref={scrollRef}>
              <div className="space-y-4">
                {messages.map((msg) => {
                  const isOwn = msg.sender_id === currentUserId
                  return (
                    <div key={msg.id} className={cn("flex flex-col", isOwn ? "items-start" : "items-end")}>
                      <div className={cn(
                        "max-w-[80%] p-3 shadow-sm",
                        isOwn ? "chat-bubble-sent" : "chat-bubble-received"
                      )}>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">
                          {msg.content.split(' ').map((word: string, i: number) => {
                            if (word.startsWith('#')) {
                              return <span key={i} className="font-bold underline decoration-white/30 cursor-pointer">{word} </span>
                            }
                            return word + ' '
                          })}
                        </p>
                      </div>
                      <span className="text-[9px] text-muted-foreground mt-1 px-1">
                        {format(new Date(msg.created_at), 'HH:mm')}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-border/50 bg-card/30">
              <form onSubmit={sendMessage} className="flex gap-2 bg-white dark:bg-slate-900 border border-border/50 rounded-2xl p-1 shadow-sm focus-within:ring-2 ring-primary/20 transition-all">
                <Input
                  className="border-none focus-visible:ring-0 shadow-none bg-transparent"
                  placeholder="הקלד הודעה... (השתמש ב-# למשימות/לקוחות)"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                />
                <Button type="submit" size="icon" className="rounded-xl shrink-0 w-10 h-10">
                  <Send className="w-4 h-4 rotate-180" />
                </Button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  )
}



