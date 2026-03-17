'use client'

import { useState, useRef, KeyboardEvent } from 'react'
import { X, Plus, Send, Square } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAgentContext } from './agent-context'
import { useAgent } from './use-agent'
import { AgentMessages } from './agent-messages'
import { QuickPrompts } from './quick-prompts'

export function AgentPanel() {
  const { context, isOpen, setIsOpen, sessionId, setSessionId } = useAgentContext()
  const { messages, isLoading, streamingText, activeTools, sendMessage, clearMessages, stopGeneration } =
    useAgent(context, sessionId, setSessionId)

  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  function handleSend() {
    const text = input.trim()
    if (!text || isLoading) return
    setInput('')
    sendMessage(text)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleNewSession() {
    clearMessages()
    setSessionId(undefined)
    setInput('')
  }

  if (!isOpen) return null

  const isEmpty = messages.length === 0 && !streamingText && !isLoading

  return (
    <>
      {/* Backdrop on mobile */}
      <div
        className="fixed inset-0 z-40 bg-black/40 md:hidden"
        onClick={() => setIsOpen(false)}
      />

      {/* Panel */}
      <div
        dir="rtl"
        className={cn(
          'fixed z-50 flex flex-col bg-card border-border shadow-2xl transition-all duration-300',
          // Mobile: bottom sheet
          'bottom-0 left-0 right-0 h-[85dvh] rounded-t-2xl border-t md:rounded-none md:border-t-0',
          // Desktop: side panel
          'md:top-0 md:bottom-0 md:left-0 md:right-auto md:w-[400px] md:h-full md:border-r md:border-l-0 md:rounded-none'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">🤖</span>
            <div>
              <h3 className="text-sm font-bold text-foreground leading-none">עוזר AI</h3>
              {context.clientName && (
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  לקוח: {context.clientName}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={handleNewSession}
                title="שיחה חדשה"
                className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => setIsOpen(false)}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Messages or Quick Prompts */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {isEmpty ? (
            <QuickPrompts
              clientName={context.clientName}
              onSelect={(p) => {
                setInput(p)
                setTimeout(() => inputRef.current?.focus(), 50)
              }}
            />
          ) : (
            <AgentMessages
              messages={messages}
              streamingText={streamingText}
              activeTools={activeTools}
              isLoading={isLoading}
            />
          )}
        </div>

        {/* Input */}
        <div className="shrink-0 px-3 pb-4 pt-2 border-t border-border">
          <div className="flex items-end gap-2 bg-secondary/50 rounded-2xl border border-border px-3 py-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="שאל אותי כל דבר..."
              rows={1}
              disabled={isLoading}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none leading-relaxed max-h-32 overflow-y-auto no-scrollbar disabled:opacity-50"
              style={{ minHeight: '24px' }}
              onInput={(e) => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = Math.min(el.scrollHeight, 128) + 'px'
              }}
            />

            {isLoading ? (
              <button
                onClick={stopGeneration}
                title="עצור"
                className="shrink-0 h-8 w-8 rounded-xl bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all"
              >
                <Square className="h-3.5 w-3.5 text-white fill-white" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                title="שלח"
                className="shrink-0 h-8 w-8 rounded-xl bg-primary hover:bg-primary/90 flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
              >
                <Send className="h-3.5 w-3.5 text-primary-foreground" />
              </button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-1.5">
            Enter לשליחה · Shift+Enter לשורה חדשה
          </p>
        </div>
      </div>
    </>
  )
}
