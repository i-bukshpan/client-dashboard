'use client'

import { useEffect, useRef } from 'react'
import { CheckCircle, XCircle, Loader2, Wrench } from 'lucide-react'
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
  create_meeting: 'יוצר פגישה',
  generate_meeting_summary: 'מייצר סיכום פגישה',
  update_client_status: 'מעדכן סטטוס לקוח',
  update_client_notes: 'מעדכן הערות לקוח',
  create_payment: 'מוסיף תשלום',
}

function renderMarkdown(text: string): React.ReactNode {
  // Split by newline, render basic markdown
  return text.split('\n').map((line, i) => {
    // Bold: **text**
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
}

export function AgentMessages({ messages, streamingText, activeTools, isLoading }: AgentMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText, activeTools])

  return (
    <div className="px-4 py-3 space-y-3">
      {messages.map((msg) => (
        <div key={msg.id}>
          {/* Tool calls shown above assistant messages */}
          {msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {msg.toolCalls.map((tc, i) => (
                <span
                  key={i}
                  className={cn(
                    'inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border',
                    tc.success
                      ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
                      : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
                  )}
                >
                  {tc.success
                    ? <CheckCircle className="h-3 w-3" />
                    : <XCircle className="h-3 w-3" />}
                  {TOOL_LABELS[tc.toolName] || tc.toolName}
                </span>
              ))}
            </div>
          )}

          <div
            className={cn(
              'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
              msg.role === 'user'
                ? 'mr-auto bg-primary text-primary-foreground rounded-tr-sm'
                : 'ml-auto bg-secondary text-foreground rounded-tl-sm'
            )}
          >
            {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
          </div>
        </div>
      ))}

      {/* Active tool indicators */}
      {activeTools.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {activeTools.map((tool) => (
            <span
              key={tool}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400"
            >
              <Loader2 className="h-3 w-3 animate-spin" />
              {TOOL_LABELS[tool] || tool}...
            </span>
          ))}
        </div>
      )}

      {/* Streaming text bubble */}
      {streamingText && (
        <div className="max-w-[85%] ml-auto bg-secondary text-foreground rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm leading-relaxed">
          {renderMarkdown(streamingText)}
          <span className="inline-block w-1.5 h-4 bg-primary ml-0.5 animate-pulse rounded-sm" />
        </div>
      )}

      {/* Thinking indicator when loading but no text yet */}
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
