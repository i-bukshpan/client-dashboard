'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { CheckCircle, XCircle, Loader2, FileText, Image, Bookmark, BookmarkCheck, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/lib/ai/types'

const TOOL_LABELS: Record<string, string> = {
  get_today_summary: 'בודק סיכום יום',
  get_today_meetings: 'מביא פגישות',
  get_upcoming_reminders: 'בודק משימות',
  search_clients: 'מחפש לקוחות',
  get_client_summary: 'מביא פרטי לקוח',
  get_meetings_for_client: 'מביא היסטוריית פגישות',
  get_financial_report: 'מביא דוח כספי',
  get_client_links: 'מביא קישורים',
  read_google_drive_file: 'קורא קובץ Google Drive',
  create_reminder: 'יוצר תזכורת',
  complete_reminder: 'מסמן משימה כהושלמה',
  update_reminder: 'מעדכן משימה',
  get_reminder_details: 'מביא פרטי משימה',
  create_meeting: 'יוצר פגישה',
  generate_meeting_summary: 'מייצר סיכום פגישה',
  update_client_status: 'מעדכן סטטוס לקוח',
  update_client_notes: 'מעדכן הערות לקוח',
  create_payment: 'מוסיף תשלום',
  fill_table_data: 'ממלא טבלת נתונים',
  get_table_schema: 'בודק מבנה טבלה',
}

function renderMarkdown(text: string): React.ReactNode {
  return text.split('\n').map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g)
    const rendered = parts.map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={j}>{part.slice(2, -2)}</strong>
      }
      return part
    })
    return (
      <span key={i}>
        {rendered}
        {i < text.split('\n').length - 1 && <br />}
      </span>
    )
  })
}

interface AgentMessagesProps {
  messages: ChatMessage[]
  streamingText: string
  activeTools: string[]
  isLoading: boolean
  onSaveMessage: (content: string) => Promise<void>
}

function AssistantBubble({
  msg,
  onSave,
}: {
  msg: ChatMessage
  onSave: (content: string) => Promise<void>
}) {
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleSave = useCallback(async () => {
    if (saved || saving) return
    setSaving(true)
    await onSave(msg.content)
    setSaving(false)
    setSaved(true)
  }, [msg.content, onSave, saved, saving])

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(msg.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [msg.content])

  return (
    <div className="group relative ml-auto max-w-[85%]">
      <div className="bg-secondary text-foreground rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm leading-relaxed">
        {renderMarkdown(msg.content)}
      </div>

      {/* Action buttons — appear on hover */}
      <div className="absolute -bottom-7 left-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <button
          onClick={handleCopy}
          title="העתק תשובה"
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-border/50 text-[10px] font-bold text-grey hover:text-navy hover:border-border shadow-sm transition-all"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          {copied ? 'הועתק' : 'העתק'}
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          title={saved ? 'נשמר' : 'שמור תשובה זו'}
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold shadow-sm transition-all',
            saved
              ? 'bg-amber-50 border-amber-200 text-amber-600'
              : 'bg-white border-border/50 text-grey hover:text-amber-600 hover:border-amber-300 hover:bg-amber-50'
          )}
        >
          {saving ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : saved ? (
            <BookmarkCheck className="h-3 w-3" />
          ) : (
            <Bookmark className="h-3 w-3" />
          )}
          {saved ? 'נשמר' : 'שמור'}
        </button>
      </div>
    </div>
  )
}

export function AgentMessages({ messages, streamingText, activeTools, isLoading, onSaveMessage }: AgentMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText, activeTools])

  return (
    <div className="px-4 py-3 space-y-4">
      {messages.map((msg) => (
        <div key={msg.id}>
          {/* Tool calls above assistant messages */}
          {msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {msg.toolCalls.map((tc, i) => (
                <span
                  key={i}
                  className={cn(
                    'inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border',
                    tc.success
                      ? 'bg-green-50 border-green-200 text-green-700'
                      : 'bg-red-50 border-red-200 text-red-700'
                  )}
                >
                  {tc.success ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                  {TOOL_LABELS[tc.toolName] || tc.toolName}
                </span>
              ))}
            </div>
          )}

          {msg.role === 'user' ? (
            <div className="mr-auto max-w-[85%] bg-primary text-primary-foreground rounded-2xl rounded-tr-sm text-sm leading-relaxed">
              {msg.attachedFile && (
                <div className="flex items-center gap-2 px-4 pt-2.5 pb-1 text-xs opacity-80">
                  {msg.attachedFile.mimeType.startsWith('image/') ? (
                    <Image className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="truncate">{msg.attachedFile.name}</span>
                </div>
              )}
              <div className="px-4 py-2.5">{msg.content}</div>
            </div>
          ) : (
            <AssistantBubble msg={msg} onSave={onSaveMessage} />
          )}
        </div>
      ))}

      {/* Active tools */}
      {activeTools.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {activeTools.map((tool) => (
            <span
              key={tool}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border bg-blue-50 border-blue-200 text-blue-700"
            >
              <Loader2 className="h-3 w-3 animate-spin" />
              {TOOL_LABELS[tool] || tool}...
            </span>
          ))}
        </div>
      )}

      {/* Streaming bubble */}
      {streamingText && (
        <div className="ml-auto max-w-[85%] bg-secondary text-foreground rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm leading-relaxed">
          {renderMarkdown(streamingText)}
          <span className="inline-block w-1.5 h-4 bg-primary ml-0.5 animate-pulse rounded-sm" />
        </div>
      )}

      {/* Thinking */}
      {isLoading && !streamingText && activeTools.length === 0 && (
        <div className="ml-auto flex items-center gap-1.5 text-muted-foreground text-xs bg-secondary px-4 py-2.5 rounded-2xl rounded-tl-sm max-w-fit">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>חושב...</span>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
