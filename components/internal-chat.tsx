'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { MessageSquare, Send, Loader2, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  getOrCreateConversation,
  getMessages,
  sendMessage as sendMsg,
  markMessagesRead,
} from '@/lib/actions/internal-chat'
import { supabase } from '@/lib/supabase'

interface InternalChatProps {
  /** The client whose conversation this belongs to (sub-client's ID for group chats) */
  clientId: string
  clientName: string
  /** Who is the current viewer? */
  viewerType: 'advisor' | 'client'
  viewerId: string          // 'advisor' literal OR client.id
  viewerName: string
  /** The other party */
  otherType: 'advisor' | 'client'
  otherId: string
  otherName: string
  /**
   * Optional map of sender_id → display name for group conversations.
   * When provided, sender names are shown above message bubbles.
   * e.g. { 'advisor': 'היועץ', [subClientId]: 'שם לקוח משנה', [parentId]: 'שם לקוח ראשי' }
   */
  senderNames?: Record<string, string>
  className?: string
}

interface Message {
  id: string
  sender_type: string
  sender_id: string
  content: string
  created_at: string
  is_read: boolean
}

export function InternalChat({
  clientId,
  clientName,
  viewerType,
  viewerId,
  viewerName,
  otherType,
  otherId,
  otherName,
  senderNames,
  className,
}: InternalChatProps) {
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const isGroupChat = senderNames && Object.keys(senderNames).length > 2

  // Load or create conversation
  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      const isAdvisorChat = viewerType === 'advisor' || otherType === 'advisor'
      const canonicalOtherType: 'advisor' | 'client' = isAdvisorChat ? 'advisor' : 'client'
      const canonicalOtherId = isAdvisorChat ? 'advisor' : otherId
      const res = await getOrCreateConversation(clientId, canonicalOtherType, canonicalOtherId)
      if (!mounted) return
      if (res.success && res.conversation) {
        setConversationId(res.conversation.id)
        const msgRes = await getMessages(res.conversation.id)
        if (mounted && msgRes.success) setMessages(msgRes.messages as Message[])
        await markMessagesRead(res.conversation.id, viewerType, viewerId)
      }
      setLoading(false)
    }
    load()
    return () => { mounted = false }
  }, [clientId, viewerType, viewerId, otherType, otherId])

  // Realtime subscription
  useEffect(() => {
    if (!conversationId) return
    const channel = supabase
      .channel(`internal_messages_${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'internal_messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          setMessages(prev => {
            if (prev.some(m => m.id === payload.new.id)) return prev
            return [...prev, payload.new as Message]
          })
          if ((payload.new as Message).sender_id !== viewerId) {
            markMessagesRead(conversationId, viewerType, viewerId)
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [conversationId, viewerId, viewerType])

  // Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || !conversationId || sending) return

    setSending(true)
    setInput('')

    // In group chats, recipient is always advisor; in 1-on-1 use normal logic
    const recipientType: 'advisor' | 'client' = viewerType === 'advisor' ? otherType : 'advisor'
    const recipientId = viewerType === 'advisor' ? otherId : 'advisor'

    const res = await sendMsg(conversationId, viewerType, viewerId, recipientType, recipientId, text)
    if (res.success && res.message) {
      setMessages(prev => [...prev, res.message as Message])
    }
    setSending(false)
    inputRef.current?.focus()
  }, [input, conversationId, sending, viewerType, viewerId, otherType, otherId])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function getSenderLabel(msg: Message): string | null {
    if (!senderNames) return null
    return senderNames[msg.sender_id] ?? null
  }

  // Determine if we should show the sender label (avoid repeating consecutive same-sender labels)
  function showSenderLabel(msg: Message, index: number): boolean {
    if (!senderNames) return false
    if (index === 0) return true
    return messages[index - 1].sender_id !== msg.sender_id
  }

  const headerTitle = isGroupChat ? `${clientName} — שיחת קבוצה` : otherName

  return (
    <div className={cn('flex flex-col h-[480px] bg-white/70 backdrop-blur-md border border-border/40 rounded-[2rem] overflow-hidden shadow-sm', className)} dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border/30 bg-white/50 shrink-0">
        <div className={cn(
          'h-9 w-9 rounded-xl flex items-center justify-center font-black',
          isGroupChat ? 'bg-violet-100 text-violet-600' : 'bg-primary/10 text-primary'
        )}>
          {isGroupChat ? <Users className="h-4 w-4" /> : otherName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-navy text-sm truncate">{headerTitle}</p>
          {isGroupChat ? (
            <p className="text-[11px] text-grey font-medium">
              {Object.values(senderNames!).join(' · ')}
            </p>
          ) : (
            <p className="text-[11px] text-grey font-medium">צ'אט פנימי</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className="text-[10px] font-black text-emerald-700">פעיל</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
        {loading ? (
          <div className="flex items-center justify-center h-full text-grey">
            <Loader2 className="h-5 w-5 animate-spin ml-2" />
            <span className="text-sm font-medium">טוען הודעות...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <MessageSquare className="h-7 w-7 text-slate-300" />
            </div>
            <p className="text-sm font-black text-grey">אין הודעות עדיין</p>
            <p className="text-xs text-grey/70 font-medium mt-1">
              {isGroupChat ? 'התחל את השיחה הקבוצתית' : `התחל שיחה עם ${otherName}`}
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isOwn = msg.sender_id === viewerId
            const label = getSenderLabel(msg)
            const showLabel = showSenderLabel(msg, idx)
            const addTopMargin = showLabel && idx > 0

            return (
              <div key={msg.id} className={cn(addTopMargin && 'mt-3')}>
                {/* Sender label */}
                {showLabel && label && !isOwn && (
                  <p className="text-[10px] font-bold text-grey/60 mb-0.5 px-1 text-right">
                    {label}
                  </p>
                )}
                {showLabel && label && isOwn && (
                  <p className="text-[10px] font-bold text-grey/60 mb-0.5 px-1 text-left">
                    {label}
                  </p>
                )}

                <div className={cn('flex', isOwn ? 'justify-start' : 'justify-end')}>
                  <div className={cn(
                    'max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                    isOwn
                      ? 'bg-primary text-white rounded-tr-sm'
                      : 'bg-slate-100 text-navy rounded-tl-sm'
                  )}>
                    <p>{msg.content}</p>
                    <p className={cn('text-[10px] mt-1 opacity-70', isOwn ? 'text-white' : 'text-grey')}>
                      {new Date(msg.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 px-3 pb-3 pt-2 border-t border-border/30">
        <div className="flex items-end gap-2 bg-slate-50/80 rounded-2xl border border-border/40 px-3 py-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="כתוב הודעה..."
            rows={1}
            disabled={sending || !conversationId}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none leading-relaxed max-h-24 overflow-y-auto no-scrollbar disabled:opacity-50"
            style={{ minHeight: '24px' }}
            onInput={e => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = Math.min(el.scrollHeight, 96) + 'px'
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending || !conversationId}
            className="shrink-0 h-8 w-8 rounded-xl bg-primary hover:bg-primary/90 flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
          >
            {sending
              ? <Loader2 className="h-3.5 w-3.5 text-white animate-spin" />
              : <Send className="h-3.5 w-3.5 text-white" />
            }
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-1">Enter לשליחה · Shift+Enter לשורה חדשה</p>
      </div>
    </div>
  )
}
