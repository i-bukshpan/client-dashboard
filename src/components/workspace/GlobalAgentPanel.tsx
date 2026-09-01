/**
 * src/components/workspace/GlobalAgentPanel.tsx
 *
 * J.A.R.V.I.S Style Global AI Executive Assistant Panel.
 * Accessible from anywhere in the platform via a persistent floating action button or Ctrl+K / Cmd+K.
 * Features:
 * - Slide-out sleek glassmorphism sidebar
 * - Hebrew voice input support (Speech-to-Text)
 * - Quick action prompt chips
 * - Full AI SDK v6 compatibility with DefaultChatTransport
 */

'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import {
  Bot,
  X,
  Send,
  Mic,
  MicOff,
  Sparkles,
  RefreshCw,
  Layers,
  Mail,
  CheckCircle2,
  Calendar,
  DollarSign,
  Maximize2,
  Minimize2,
  Loader2,
  Table,
  Cpu,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useVoiceInput } from '@/hooks/useVoiceInput'

const QUICK_PROMPTS = [
  { icon: Layers, label: 'סטטוס כל הלקוחות', prompt: 'תן לי תמונת מצב מרוכזת על כל הלקוחות הפעילים במערכת והחיבורים שלהם.' },
  { icon: Mail, label: 'מיילים דחופים', prompt: 'סרוק את כל המיילים שלא נקראו וסכם לי מה דורש מענה דחוף היום.' },
  { icon: CheckCircle2, label: 'משימות פתוחות', prompt: 'הצג את כל המשימות הפתוחות במערכת לפי סדר עדיפות.' },
  { icon: DollarSign, label: 'כספי הסוכנות', prompt: 'סכם את תמונת המצב הפיננסית של סוכנות נחמיה לחודש הנוכחי.' },
  { icon: Calendar, label: 'פגישות השבוע', prompt: 'מה הפגישות והאירועים המתוכננים ביומן לשבוע הקרוב?' },
]

const TOOL_LABELS: Record<string, string> = {
  list_all_clients: 'שליפת רשימת לקוחות',
  lookup_client_sheet: 'קריאת גיליון Google Sheets',
  check_unread_emails: 'סריקת אימיילים שלא נקראו',
  search_emails: 'חיפוש אימיילים ב-Gmail',
  get_workspace_tasks: 'שליפת משימות',
  create_or_update_workspace_task: 'יצירה / עדכון משימה',
  get_agency_finance_summary: 'סיכום כספי הסוכנות',
  get_calendar_overview: 'סריקת יומן פגישות',
}

export function GlobalAgentPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const transport = useMemo(() => {
    return new DefaultChatTransport({
      api: '/api/workspace/global-chat',
    })
  }, [])

  const { messages, setMessages, sendMessage, status, error } = useChat({
    transport,
    onError: (err) => {
      toast.error(`שגיאת AI גלובלי: ${err.message}`)
    },
  })

  const isLoading = status === 'streaming' || status === 'submitted'

  // Initial welcome greeting if empty
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text: 'שלום נחמיה! אני העוזר המנהל הגלובלי שלך (J.A.R.V.I.S). אני מחובר לכל הלקוחות, הגליונות, המיילים, המשימות והיומן. איך אפשר לסייע עכשיו?',
            },
          ],
        } as any,
      ])
    }
  }, [messages.length, setMessages])

  // Hebrew Voice Input integration
  const { isListening, isSupported: isVoiceSupported, toggleListening } = useVoiceInput({
    lang: 'he-IL',
    onResult: (transcript) => {
      setInput((prev) => (prev ? `${prev} ${transcript}` : transcript))
    },
    onError: (errMsg) => {
      toast.error(errMsg)
    },
  })

  // Keyboard shortcut listener (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsOpen((prev) => !prev)
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Scroll to bottom on message updates
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isLoading, isOpen])

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend ?? input).trim()
    if (!text || isLoading) return
    setInput('')
    try {
      await sendMessage({ text })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'שגיאה בשליחת בקשה')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {/* Floating Trigger Button in Bottom Left */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-6 z-40 flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700 text-white shadow-xl shadow-indigo-600/30 hover:shadow-indigo-600/50 hover:scale-105 active:scale-95 transition-all duration-200 group border border-white/20 backdrop-blur-md cursor-pointer"
        title="פתח עוזר גלובלי (Ctrl+K)"
      >
        <div className="relative">
          <Bot className="w-5 h-5 group-hover:rotate-12 transition-transform" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
        </div>
        <span className="font-bold text-sm tracking-wide">Nehemiah AI</span>
        <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold bg-white/20 text-white/90 rounded border border-white/20">
          ⌘K
        </kbd>
      </button>

      {/* Backdrop overlay when open */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-background/40 backdrop-blur-xs z-50 transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Slide-out Sidebar Panel */}
      <div
        className={`fixed top-0 left-0 h-full z-50 bg-card/95 backdrop-blur-xl border-r border-border shadow-2xl flex flex-col transition-all duration-300 ease-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } ${isExpanded ? 'w-full sm:w-[720px]' : 'w-full sm:w-[460px]'}`}
        dir="rtl"
      >
        {/* Header */}
        <div className="h-16 px-5 border-b border-border/80 flex items-center justify-between bg-muted/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-black text-foreground text-base tracking-tight">Nehemiah Global AI</h2>
                <Badge variant="outline" className="text-[10px] bg-indigo-500/10 text-indigo-500 border-indigo-500/30">
                  J.A.R.V.I.S
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">עוזר מנהלים בכיר חוצה-מערכות</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setMessages([
                  {
                    id: 'reset',
                    role: 'assistant',
                    parts: [{ type: 'text', text: 'שיחה אופסה. כיצד אוכל לעזור כעת?' }],
                  } as any,
                ])
              }}
              title="איפוס שיחה"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground hidden sm:flex"
              onClick={() => setIsExpanded((prev) => !prev)}
              title={isExpanded ? 'הקטן חלון' : 'הרחב חלון'}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => setIsOpen(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Messages List Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 text-sm">
          {messages.map((m) => {
            const isUser = m.role === 'user'

            // Extract text parts safely
            const textParts: string[] = []
            const toolParts: any[] = []

            if (Array.isArray(m.parts)) {
              for (const p of m.parts) {
                if (p && p.type === 'text' && typeof p.text === 'string') {
                  textParts.push(p.text)
                } else if (p && (p.type === 'tool-invocation' || p.type?.startsWith('tool-'))) {
                  toolParts.push(p)
                }
              }
            } else if (typeof (m as any).content === 'string') {
              textParts.push((m as any).content)
            }

            const rawText = textParts.join('\n')

            return (
              <div
                key={m.id}
                className={`flex flex-col ${isUser ? 'items-start' : 'items-end'}`}
              >
                <div
                  className={`max-w-[90%] rounded-2xl px-4 py-3 shadow-xs ${
                    isUser
                      ? 'bg-indigo-600 text-white rounded-br-xs'
                      : 'bg-muted/80 border border-border/60 text-foreground rounded-bl-xs'
                  }`}
                >
                  {/* Message text */}
                  {rawText && (
                    <div className="whitespace-pre-wrap leading-relaxed">
                      {rawText}
                    </div>
                  )}

                  {/* Tool executions */}
                  {toolParts.length > 0 && (
                    <div className="mt-2.5 pt-2.5 border-t border-border/40 space-y-1.5">
                      {toolParts.map((tool: any, idx: number) => {
                        const rawToolName = tool.toolName || tool.name || tool.toolInvocation?.toolName || 'פעולה'
                        const toolName = TOOL_LABELS[rawToolName] || rawToolName
                        const isDone = tool.state === 'result' || tool.result !== undefined || tool.output !== undefined || !isLoading
                        return (
                          <div
                            key={idx}
                            className="text-[11px] flex items-center gap-1.5 text-muted-foreground bg-background/50 px-2.5 py-1.5 rounded-lg border border-border/40"
                          >
                            <Cpu className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            <span>פעולה: <strong className="text-foreground">{toolName}</strong></span>
                            {isDone ? (
                              <span className="text-emerald-500 mr-auto font-bold">✓ הושלם</span>
                            ) : (
                              <span className="text-amber-500 mr-auto font-bold animate-pulse">מעבד נתונים...</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground text-xs p-2">
              <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
              <span>הסוכן מעבד נתונים חוצי-מערכת...</span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 text-xs">
              שגיאה: {error.message}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts Carousel */}
        <div className="px-4 py-2 border-t border-border/50 bg-background/50 flex gap-1.5 overflow-x-auto scrollbar-none shrink-0">
          {QUICK_PROMPTS.map((item, idx) => {
            const Icon = item.icon
            return (
              <button
                key={idx}
                onClick={() => {
                  setInput(item.prompt)
                  handleSend(item.prompt)
                }}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/60 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/40 text-[11px] font-medium text-muted-foreground border border-border/40 whitespace-nowrap transition-colors cursor-pointer disabled:opacity-50"
              >
                <Icon className="w-3 h-3" />
                {item.label}
              </button>
            )
          })}
        </div>

        {/* Input area */}
        <div className="p-3 border-t border-border bg-card shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSend()
            }}
            className="flex items-center gap-2 bg-muted/60 rounded-xl p-1.5 border border-border/80 focus-within:border-indigo-500 transition-colors"
          >
            {/* Hebrew Voice Input Button */}
            {isVoiceSupported && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={toggleListening}
                className={`h-9 w-9 rounded-lg shrink-0 transition-colors ${
                  isListening
                    ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30 animate-pulse'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
                title={isListening ? 'עצור הקלטה' : 'הקלטה קולית בעברית'}
              >
                {isListening ? <MicOff className="w-4 h-4 text-red-500" /> : <Mic className="w-4 h-4" />}
              </Button>
            )}

            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isListening ? 'מאזין לך בעברית...' : 'שאל שאלה או בקש פעולה חוצת-מערכת...'}
              className="border-0 shadow-none focus-visible:ring-0 text-sm bg-transparent px-2"
              disabled={isLoading}
            />

            <Button
              type="submit"
              size="icon"
              disabled={isLoading || !input?.trim()}
              className="h-9 w-9 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shrink-0 cursor-pointer"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </form>
        </div>
      </div>
    </>
  )
}
