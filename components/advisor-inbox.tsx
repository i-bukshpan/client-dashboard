'use client'

import { useState, useEffect } from 'react'
import { MessageSquare, Loader2, Clock, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getAdvisorConversations } from '@/lib/actions/internal-chat'
import { InternalChat } from '@/components/internal-chat'

interface ClientInfo {
  id: string
  name: string
  email: string | null
  parent_id?: string | null
}

interface Conversation {
  id: string
  client_id: string
  last_message: string | null
  last_message_at: string | null
  unread_count: number
  clients: ClientInfo | null
  parentClient: { id: string; name: string } | null
}

export function AdvisorInbox() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Conversation | null>(null)

  useEffect(() => {
    getAdvisorConversations().then(res => {
      if (res.success) setConversations((res.conversations || []) as Conversation[])
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-3 text-grey">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="font-bold">טוען שיחות...</span>
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="text-center py-24 bg-white/30 backdrop-blur-sm rounded-[3rem] border-2 border-dashed border-border/50">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <MessageSquare className="h-10 w-10 text-slate-300" />
        </div>
        <p className="text-navy font-black text-xl mb-2">אין שיחות עדיין</p>
        <p className="text-grey font-medium text-sm">כאשר לקוחות ישלחו הודעות, הן יופיעו כאן</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start" dir="rtl">
      {/* Conversations list */}
      <div className="lg:col-span-1 space-y-2">
        <h2 className="text-sm font-black text-grey uppercase tracking-widest px-1 mb-3">שיחות</h2>
        {conversations.map(conv => {
          const clientName = conv.clients?.name || 'לקוח לא ידוע'
          const isSubClient = !!conv.parentClient
          const isSelected = selected?.id === conv.id
          return (
            <button
              key={conv.id}
              onClick={() => setSelected(conv)}
              className={cn(
                'w-full text-right p-4 rounded-2xl border transition-all duration-200 group',
                isSelected
                  ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                  : 'bg-white/70 border-border/40 hover:border-primary/30 hover:bg-white/90 backdrop-blur-sm'
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  'h-10 w-10 rounded-xl flex items-center justify-center font-black text-lg shrink-0 transition-colors',
                  isSelected
                    ? 'bg-white/20 text-white'
                    : isSubClient ? 'bg-violet-100 text-violet-600' : 'bg-primary/10 text-primary'
                )}>
                  {isSubClient ? <Users className="h-4 w-4" /> : clientName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className={cn('font-black text-sm truncate', isSelected ? 'text-white' : 'text-navy')}>
                      {clientName}
                    </span>
                    {isSubClient && (
                      <span className={cn(
                        'text-[9px] font-black px-1.5 py-0.5 rounded-md',
                        isSelected ? 'bg-white/20 text-white' : 'bg-violet-100 text-violet-600'
                      )}>
                        לקוח משנה
                      </span>
                    )}
                    {conv.unread_count > 0 && !isSelected && (
                      <span className="shrink-0 h-5 min-w-5 px-1.5 rounded-full bg-primary text-white text-[10px] font-black flex items-center justify-center">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                  {isSubClient && conv.parentClient && (
                    <p className={cn('text-[10px] font-bold mb-0.5', isSelected ? 'text-white/70' : 'text-violet-500')}>
                      תחת {conv.parentClient.name}
                    </p>
                  )}
                  {conv.last_message && (
                    <p className={cn('text-xs truncate font-medium', isSelected ? 'text-white/75' : 'text-grey')}>
                      {conv.last_message}
                    </p>
                  )}
                  {conv.last_message_at && (
                    <p className={cn('text-[10px] mt-1 flex items-center gap-1', isSelected ? 'text-white/60' : 'text-grey/60')}>
                      <Clock className="h-3 w-3" />
                      {new Date(conv.last_message_at).toLocaleString('he-IL', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Chat panel */}
      <div className="lg:col-span-2">
        {selected && selected.clients ? (
          <div className="sticky top-24">
            <h2 className="text-sm font-black text-grey uppercase tracking-widest px-1 mb-3">
              {selected.parentClient
                ? `שיחה קבוצתית — ${selected.clients.name} + ${selected.parentClient.name}`
                : `שיחה עם ${selected.clients.name}`}
            </h2>
            <InternalChat
              clientId={selected.client_id}
              clientName={selected.clients.name}
              viewerType="advisor"
              viewerId="advisor"
              viewerName="היועץ"
              otherType="client"
              otherId={selected.client_id}
              otherName={selected.clients.name}
              senderNames={selected.parentClient ? {
                'advisor': 'אני (היועץ)',
                [selected.client_id]: selected.clients.name + ' (לקוח משנה)',
                [selected.parentClient.id]: selected.parentClient.name + ' (לקוח ראשי)',
              } : undefined}
              className="h-[600px]"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 bg-white/50 backdrop-blur-sm rounded-[2.5rem] border border-dashed border-border/50">
            <MessageSquare className="h-10 w-10 text-slate-200 mb-4" />
            <p className="text-grey font-bold text-sm">בחר שיחה מהרשימה</p>
          </div>
        )}
      </div>
    </div>
  )
}
