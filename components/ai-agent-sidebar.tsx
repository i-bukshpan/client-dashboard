'use client'

import { useState, useEffect, useRef } from 'react'
import { Send, Bot, User, X, MessageSquare, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { createAIChatSession, getAIChatMessages, sendAIMessage, getAIChatSessions } from '@/lib/actions/ai-agent'
import { cn } from '@/lib/utils'
import { useChat } from 'ai/react'

interface AIAgentSidebarProps {
  clientId: string
  clientName: string
  onClose?: () => void
}

export function AIAgentSidebar({ clientId, clientName, onClose }: AIAgentSidebarProps) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessions, setSessions] = useState<any[]>([])
  const [historyMessages, setHistoryMessages] = useState<any[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  const { messages: aiMessages, input: aiInput, handleInputChange, handleSubmit, isLoading, setMessages } = useChat({
    api: '/api/chat',
    body: { clientId },
    onFinish: async (message: any) => {
      if (sessionId) {
        await sendAIMessage(sessionId, 'assistant', message.content)
      }
    }
  })

  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    loadSessions()
  }, [clientId])

  const loadSessions = async () => {
    const res = await getAIChatSessions(clientId)
    if (res.success && res.data) {
      setSessions(res.data)
      if (res.data.length > 0) {
        setSessionId(res.data[0].id)
        loadMessages(res.data[0].id)
      } else {
        createNewSession()
      }
    }
  }

  const createNewSession = async () => {
    const res = await createAIChatSession(clientId, `שיחה על ${clientName}`)
    if (res.success && res.data) {
      setSessionId(res.data.id)
      setSessions([res.data, ...sessions])
      setMessages([])
    }
  }

  const loadMessages = async (id: string) => {
    const res = await getAIChatMessages(id)
    if (res.success && res.data) {
      setMessages(res.data.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: new Date(m.created_at)
      })))
    }
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [aiMessages])

  const handleSendFull = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!aiInput.trim() || !sessionId || isLoading) return
    
    // Save user message to DB
    await sendAIMessage(sessionId, 'user', aiInput)
    
    // Trigger AI
    handleSubmit(e)
  }

  return (
    <Card className="flex flex-col h-full border-l rounded-none shadow-xl bg-background/95 backdrop-blur-md">
      <div className="p-4 border-b flex items-center justify-between bg-primary/5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold">סוכן AI: {clientName}</h3>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Beta Assistant</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar" ref={scrollRef}>
        <div className="space-y-4">
          {aiMessages.length === 0 && !isLoading && (
            <div className="text-center py-12 space-y-3 opacity-50">
              <Bot className="h-12 w-12 mx-auto text-primary/30" />
              <p className="text-xs font-medium">איך אני יכול לעזור לך עם המידע של {clientName}?</p>
            </div>
          )}
          {aiMessages.map((msg: any, i: number) => (
            <div key={msg.id || i} className={cn(
              "flex gap-3 max-w-[85%]",
              msg.role === 'user' ? "mr-auto flex-row-reverse" : "ml-auto"
            )}>
              <div className={cn(
                "w-8 h-8 rounded-lg shrink-0 flex items-center justify-center",
                msg.role === 'user' ? "bg-secondary" : "bg-primary/10"
              )}>
                {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4 text-primary" />}
              </div>
              <div className={cn(
                "p-3 rounded-2xl text-sm leading-relaxed",
                msg.role === 'user' ? "bg-secondary text-secondary-foreground rounded-tr-none" : "bg-card border border-border rounded-tl-none shadow-sm"
              )}>
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && aiMessages[aiMessages.length - 1]?.role === 'user' && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Loader2 className="h-4 w-4 text-primary animate-spin" />
              </div>
              <div className="p-3 rounded-2xl bg-card border border-border rounded-tl-none animate-pulse text-sm text-muted-foreground">
                חושב...
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 border-t bg-card/50">
        <form 
          ref={formRef}
          onSubmit={handleSendFull}
          className="relative"
        >
          <Input 
            value={aiInput}
            onChange={handleInputChange}
            placeholder="שאל אותי משהו..."
            className="pl-12 pr-4 h-11 bg-background border-border shadow-inner rounded-xl"
            disabled={isLoading}
          />
          <Button 
            type="submit" 
            size="icon" 
            disabled={!aiInput.trim() || isLoading}
            className="absolute left-1.5 top-1.5 h-8 w-8 rounded-lg bg-primary hover:bg-primary/90 shadow-sm"
          >
            <Send className="h-4 w-4 text-primary-foreground" />
          </Button>
        </form>
        <p className="text-[9px] text-center text-muted-foreground mt-3 uppercase font-bold tracking-tighter">
          Powered by Google Gemini & Linkנט Vector Search
        </p>
      </div>
    </Card>
  )
}
