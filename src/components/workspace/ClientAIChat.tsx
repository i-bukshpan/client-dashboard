'use client'

/**
 * ClientAIChat.tsx
 *
 * The AI Agent chat interface for Nehemiah OS v2.
 * Uses useChat from @ai-sdk/react (ai@6 protocol).
 *
 * Features:
 *  - Persistent conversation in localStorage per client
 *  - Rich animated visual feedback for all tool executions (read_sheet_data, update_dashboard_layout, etc.)
 *  - Live step status when agent is processing
 *  - Renders user/assistant messages with Markdown-like formatting
 *  - Auto-scrolls to latest message
 *  - Keyboard: Enter to send, Shift+Enter for newline
 *  - "שיחה חדשה" button to clear history and start fresh
 */

import { useChat } from '@ai-sdk/react'
import { useRouter } from 'next/navigation'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Send,
  Loader2,
  RotateCcw,
  Database,
  FolderSearch,
  TableIcon,
  LayoutGrid,
  Plus,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  User,
} from 'lucide-react'
import { toast } from 'sonner'

import { analyzeAndGenerateDashboardAction } from '@/app/workspace/actions/dashboard-intelligence'

interface ClientAIChatProps {
  clientId: string
  clientName: string
  hasSheet: boolean
  pendingBriefQuestions?: string[]
}

// ── Tool card UI helpers ───────────────────────────────────────────────────────

const TOOL_META: Record<string, { icon: React.ElementType; label: string; actionDesc: string; color: string }> = {
  get_spreadsheet_info: {
    icon: TableIcon,
    label: 'זיהוי לשוניות בגיליון',
    actionDesc: 'סורק את מבנה הגיליון והלשוניות...',
    color: 'emerald',
  },
  read_sheet_data: {
    icon: TableIcon,
    label: 'קריאת נתונים מגיליון',
    actionDesc: 'קורא נתונים ומחשב סיכומים...',
    color: 'emerald',
  },
  append_row: {
    icon: Plus,
    label: 'הוספת שורה לגיליון',
    actionDesc: 'כותב שורה חדשה ל-Google Sheets...',
    color: 'blue',
  },
  create_new_sheet_structure: {
    icon: Database,
    label: 'יצירת גיליון Google Sheets חדש',
    actionDesc: 'בונה קובץ גיליון חדש ב-Google Drive...',
    color: 'indigo',
  },
  update_dashboard_layout: {
    icon: LayoutGrid,
    label: 'בנייה ועדכון דשבורד ויזואלי',
    actionDesc: 'מעצב ווידג\'טים וגרפים ושומר לדשבורד...',
    color: 'violet',
  },
  get_drive_files: {
    icon: FolderSearch,
    label: 'סריקת קבצים ב-Drive',
    actionDesc: 'סורק תיקיות וקבצים ב-Google Drive...',
    color: 'amber',
  },
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

function ToolCallCard({
  toolName,
  args,
  state,
  result,
}: {
  toolName: string
  args: Record<string, unknown>
  state: string
  result?: unknown
}) {
  const meta = TOOL_META[toolName] ?? {
    icon: Database,
    label: toolName,
    actionDesc: 'מעבד פעולה...',
    color: 'slate',
  }
  const [expanded, setExpanded] = useState(false)
  const resultStatus =
    typeof result === 'object' && result !== null && 'success' in result
      ? (result as { success?: unknown }).success
      : undefined

  const isSuccess = Boolean(
    (state === 'output-available' || result !== undefined) &&
    result !== null &&
    resultStatus !== false
  )
  const isError = Boolean(
    state === 'output-error' ||
    ((state === 'output-available' || result !== undefined) &&
      result !== null &&
      resultStatus === false)
  )
  const isRunning = !isSuccess && !isError

  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-50/90 border-emerald-300/80 text-emerald-800 shadow-xs',
    blue: 'bg-blue-50/90 border-blue-300/80 text-blue-800 shadow-xs',
    indigo: 'bg-indigo-50/90 border-indigo-300/80 text-indigo-800 shadow-xs',
    violet: 'bg-violet-50/90 border-violet-300/80 text-violet-800 shadow-xs',
    amber: 'bg-amber-50/90 border-amber-300/80 text-amber-800 shadow-xs',
    slate: 'bg-slate-50/90 border-slate-300/80 text-slate-700 shadow-xs',
  }
  const cls = colorMap[meta.color] ?? colorMap.slate

  return (
    <div className={`rounded-xl border px-3.5 py-3 text-xs my-2 transition-all duration-200 ${cls}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          {isRunning && (
            <div className="w-5 h-5 rounded-full bg-current/10 flex items-center justify-center shrink-0">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-current" />
            </div>
          )}
          {isSuccess && (
            <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            </div>
          )}
          {isError && (
            <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <XCircle className="w-3.5 h-3.5 text-red-600" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight">{meta.label}</span>
              {isRunning && (
                <Badge variant="outline" className="text-[10px] bg-white/60 border-current/30 animate-pulse font-normal">
                  פעולה בביצוע
                </Badge>
              )}
              {isSuccess && (
                <Badge variant="outline" className="text-[10px] bg-emerald-100/80 border-emerald-300 text-emerald-800 font-semibold">
                  ✓ בוצע
                </Badge>
              )}
            </div>

            {isRunning && (
              <p className="text-[11px] opacity-75 mt-0.5 font-normal">
                {meta.actionDesc}
              </p>
            )}

            {isSuccess && asRecord(result).message !== undefined && (
              <p className="text-[11px] font-medium text-emerald-900 mt-0.5">
                {String(asRecord(result).message)}
              </p>
            )}

            {isError && (
              <p className="text-[11px] font-medium text-red-600 mt-0.5">
                {String(asRecord(result).error ?? 'שגיאה בביצוע הפעולה')}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="opacity-60 hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-black/5 shrink-0"
          title="הצג פרטים טכניים"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <div className="mt-2.5 pt-2.5 border-t border-current/20 space-y-2">
          {args && Object.keys(args).length > 0 && (
            <div>
              <p className="opacity-70 text-[10px] font-bold mb-1">פרמטרים שנשלחו:</p>
              <pre className="text-[10px] font-mono opacity-85 whitespace-pre-wrap break-all bg-black/5 p-2 rounded-lg">
                {JSON.stringify(args, null, 2)}
              </pre>
            </div>
          )}
          {result !== undefined && (
            <div>
              <p className="opacity-70 text-[10px] font-bold mb-1">תוצאת הכלי:</p>
              <pre className="text-[10px] font-mono opacity-85 whitespace-pre-wrap break-all max-h-48 overflow-auto bg-black/5 p-2 rounded-lg">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Message bubble ─────────────────────────────────────────────────────────────

function MessageBubble({
  message,
  onApplyDashboard,
  isBuildingDashboard,
}: {
  message: UIMessage
  onApplyDashboard?: () => void
  isBuildingDashboard?: boolean
}) {
  const isUser = message.role === 'user'

  const textParts: string[] = []
  const toolParts: Array<{ toolName: string; args: Record<string, unknown>; state: string; result?: unknown }> = []

  if (message.parts && Array.isArray(message.parts)) {
    for (const part of message.parts) {
      const rawPart = asRecord(part)
      if (part.type === 'text') {
        textParts.push(part.text)
      } else if (part.type === 'tool-invocation' || rawPart.toolInvocation) {
        const inv = rawPart.toolInvocation ? asRecord(rawPart.toolInvocation) : rawPart
        toolParts.push({
          toolName: String(inv.toolName ?? rawPart.toolName ?? 'tool'),
          args: asRecord(inv.args ?? rawPart.args ?? inv.input),
          state: String(inv.state ?? (inv.result !== undefined ? 'output-available' : 'input-available')),
          result: inv.result ?? inv.output,
        })
      } else if (typeof part.type === 'string' && part.type.startsWith('tool-')) {
        const toolName = String(rawPart.toolName ?? part.type.replace('tool-', ''))
        toolParts.push({
          toolName,
          args: asRecord(rawPart.input ?? rawPart.args),
          state: String(rawPart.state ?? (rawPart.output !== undefined || rawPart.result !== undefined ? 'output-available' : 'input-available')),
          result: rawPart.output ?? rawPart.result,
        })
      } else if (part.type === 'dynamic-tool') {
        toolParts.push({
          toolName: String(rawPart.toolName ?? 'dynamic-tool'),
          args: asRecord(rawPart.input ?? rawPart.args),
          state: String(rawPart.state ?? 'input-available'),
          result: rawPart.output ?? rawPart.result,
        })
      }
    }
  }

  const combinedText = textParts.join(' ')
  const hasExecutedDashboard = toolParts.some(
    (tp) =>
      tp.toolName === 'update_dashboard_layout' &&
      (tp.state === 'output-available' || tp.result !== undefined) &&
      asRecord(tp.result).success !== false
  )
  const isDashboardProposal =
    !isUser &&
    !hasExecutedDashboard &&
    (combinedText.includes('הנה הווידג\'טים') ||
      combinedText.includes('update_dashboard_layout') ||
      combinedText.includes('בניית הדשבורד'))

  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
          isUser
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-md shadow-indigo-500/20'
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4" />
        ) : (
          <Sparkles className="w-4 h-4" />
        )}
      </div>

      {/* Content */}
      <div className={`flex-1 max-w-[85%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        {/* Tool cards (shown on assistant messages) */}
        {!isUser && toolParts.map((tp, i) => (
          <ToolCallCard
            key={i}
            toolName={tp.toolName}
            args={tp.args}
            state={tp.state}
            result={tp.result}
          />
        ))}

        {/* Text bubble */}
        {textParts.length > 0 && textParts.some((t) => t.trim()) && (
          <div
            className={`
              rounded-2xl px-4 py-3 text-sm leading-relaxed
              ${isUser
                ? 'bg-indigo-600 text-white rounded-tr-sm shadow-xs'
                : 'bg-card border border-border/70 text-foreground rounded-tl-sm shadow-sm'
              }
            `}
            dir="auto"
          >
            {textParts.map((text, i) => (
              <span key={i} className="whitespace-pre-wrap">{text}</span>
            ))}

            {/* If dashboard was executed by the AI tool, show live confirmation */}
            {hasExecutedDashboard && (
              <div className="mt-3 pt-2.5 border-t border-emerald-200/60 flex items-center justify-between gap-2 text-emerald-800 bg-emerald-50/70 px-3 py-2 rounded-xl">
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>הדשבורד המותאם עודכן ונשמר בהצלחה!</span>
                </div>
                <span className="text-[11px] font-medium text-emerald-700">עבור ללשונית Dashboard לצפייה</span>
              </div>
            )}

            {/* Quick Action Button inside bubble if dashboard proposal was made but not executed */}
            {isDashboardProposal && onApplyDashboard && (
              <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs text-violet-700 font-semibold">
                  <LayoutGrid className="w-4 h-4" />
                  <span>החל הגדרות דשבורד אלו מיידית:</span>
                </div>
                <Button
                  size="sm"
                  onClick={onApplyDashboard}
                  disabled={isBuildingDashboard}
                  className="h-7 text-xs bg-violet-600 hover:bg-violet-700 text-white font-bold gap-1 shadow-xs"
                >
                  {isBuildingDashboard ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  החל דשבורד עכשיו
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function ClientAIChat({ clientId, clientName, hasSheet, pendingBriefQuestions = [] }: ClientAIChatProps) {
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [input, setInput] = useState('')
  const hasGreetedRef = useRef(false)
  const isHydratedRef = useRef(false)
  const briefPromptRef = useRef('')
  const wasLoadingRef = useRef(false)

  const storageKey = `nehemiah_workspace_chat_${clientId}`

  const transport = useMemo(() => {
    return new DefaultChatTransport({
      api: `/api/clients/${clientId}/chat`,
    })
  }, [clientId])

  const { messages, setMessages, sendMessage, status, error } = useChat({
    transport,
    onError: (err) => {
      toast.error(`שגיאת AI: ${err.message}`)
    },
  })

  const isLoading = status === 'streaming' || status === 'submitted'

  useEffect(() => {
    if (isLoading) wasLoadingRef.current = true
    else if (wasLoadingRef.current) { wasLoadingRef.current = false; router.refresh() }
  }, [isLoading, router])

  // 1. Restore persistent messages from localStorage on initial mount
  useEffect(() => {
    if (isHydratedRef.current) return
    isHydratedRef.current = true

    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed)
          hasGreetedRef.current = true
          return
        }
      }
    } catch {
      // ignore
    }

    // If no saved conversation, trigger fresh greeting once
    if (!hasGreetedRef.current && messages.length === 0) {
      hasGreetedRef.current = true
      sendMessage({
        text: `היי, התחל שיחה וספר לי מה הסטטוס של הלקוח ${clientName}`,
      }).catch(() => null)
    }
  }, [storageKey, setMessages, messages.length, sendMessage, clientName])

  useEffect(() => {
    if (!pendingBriefQuestions.length) return
    const signature = pendingBriefQuestions.join('|')
    if (briefPromptRef.current === signature) return
    briefPromptRef.current = signature
    const text = `נחמיה, כדי להשלים את הבריף החודשי אני צריך ממך תשובות קצרות:\n${pendingBriefQuestions.map((question, index) => `${index + 1}. ${question}`).join('\n')}\nענה כאן, ואני אחדש אוטומטית את יצירת הבריף.`
    setMessages((current) => {
      const alreadyShown = current.some((message) => message.parts?.some((part) => part.type === 'text' && part.text.includes(pendingBriefQuestions[0])))
      return alreadyShown ? current : [...current, { id: crypto.randomUUID(), role: 'assistant', parts: [{ type: 'text', text }] } as UIMessage]
    })
  }, [pendingBriefQuestions, setMessages])

  // 2. Persist messages to localStorage when updated
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(messages))
      } catch {
        // ignore
      }
    }
  }, [messages, storageKey])

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isLoading])

  // Send message handler
  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    const textToSend = input.trim()
    setInput('')
    try {
      await sendMessage({ text: textToSend })
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'שגיאה בשליחת הודעה')
    }
  }

  // Reset conversation handler
  const handleReset = useCallback(() => {
    try {
      localStorage.removeItem(storageKey)
    } catch {
      // ignore
    }
    setMessages([])
    hasGreetedRef.current = true
    sendMessage({
      text: `היי, התחל שיחה חדשה וספר לי מה הסטטוס של הלקוח ${clientName}`,
    }).catch(() => null)
    toast.success('השיחה אופסה בהצלחה')
  }, [storageKey, setMessages, sendMessage, clientName])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const [isBuildingDashboard, setIsBuildingDashboard] = useState(false)

  // Direct Auto-Dashboard Trigger
  const handleGenerateDashboard = async () => {
    setIsBuildingDashboard(true)
    const toastId = toast.loading('בונה ומחיל את הדשבורד החכם על בסיס הגיליון...')
    try {
      const res = await analyzeAndGenerateDashboardAction(clientId)
      if ('error' in res) {
        toast.error(res.error, { id: toastId })
      } else {
        toast.success(`✅ הדשבורד נבנה בהצלחה עם ${res.widgetCount} ווידג'טים! עבור ללשונית Dashboard לצפייה.`, {
          id: toastId,
          duration: 5000,
        })
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'שגיאה ביצירת דשבורד', { id: toastId })
    } finally {
      setIsBuildingDashboard(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/60 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">נחמיה AI</p>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`} />
              <p className="text-[10px] text-muted-foreground font-medium">
                {isLoading ? 'מבצע פעולות ומעבד נתונים...' : 'מוכן לסייע'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasSheet && (
            <Button
              variant="outline"
              size="sm"
              disabled={isBuildingDashboard}
              onClick={handleGenerateDashboard}
              className="h-7 px-2.5 text-xs gap-1.5 border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 font-semibold shadow-xs"
              title="בנה דשבורד חכם מלא בלחיצה אחת"
            >
              {isBuildingDashboard ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-violet-600" />
              )}
              החל דשבורד
            </Button>
          )}
          {messages.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-red-600 hover:border-red-200"
              onClick={handleReset}
              title="נקה היסטוריית שיחה והתחל מחדש"
            >
              <RotateCcw className="w-3 h-3" />
              שיחה חדשה
            </Button>
          )}
        </div>
      </div>

      {/* Messages list */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
      >
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center py-10">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-indigo-500" />
            </div>
            <p className="font-bold text-foreground">היועץ שלך מתחבר...</p>
            <p className="text-sm text-muted-foreground mt-1">
              {hasSheet ? 'מוכן לניתוח נתונים' : 'מוכן לבניית מבנה הגיליון'}
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            onApplyDashboard={handleGenerateDashboard}
            isBuildingDashboard={isBuildingDashboard}
          />
        ))}

        {/* Live Active Processing Indicator */}
        {isLoading && (
          <div className="flex gap-2.5 items-start">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-sm">
              <Sparkles className="w-4 h-4 text-white animate-spin [animation-duration:3s]" />
            </div>
            <div className="bg-gradient-to-r from-indigo-50 via-violet-50 to-purple-50 border border-indigo-200/80 rounded-2xl rounded-tl-sm px-4 py-3 shadow-xs flex items-center gap-3">
              <Loader2 className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
              <div>
                <p className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                  נחמיה AI מעבד נתונים
                  <span className="flex gap-0.5">
                    <span className="inline-block w-1 h-1 bg-indigo-600 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="inline-block w-1 h-1 bg-indigo-600 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="inline-block w-1 h-1 bg-indigo-600 rounded-full animate-bounce [animation-delay:300ms]" />
                  </span>
                </p>
                <p className="text-[10px] text-indigo-700/80 mt-0.5">
                  מבצע קריאות ל-Google Workspace ו-Supabase בזמן אמת
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50 border border-red-200">
            <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-medium text-red-700">{error.message}</p>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-border bg-card/60 backdrop-blur-sm p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSend()
          }}
          className="flex gap-2 items-end"
        >
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="שאל כל שאלה על הלקוח או בקש פעולה..."
            dir="auto"
            rows={1}
            disabled={isLoading}
            className="flex-1 resize-none min-h-[40px] max-h-[120px] text-sm"
            style={{ height: 'auto' }}
          />
          <Button
            type="submit"
            size="sm"
            disabled={!input.trim() || isLoading}
            className="h-10 w-10 p-0 shrink-0 bg-indigo-600 hover:bg-indigo-700"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </form>
        <p className="text-[10px] text-muted-foreground/60 text-center mt-2">
          Enter לשליחה · Shift+Enter לשורה חדשה
        </p>
      </div>
    </div>
  )
}
