'use client'

import { useState, useRef, KeyboardEvent, useCallback } from 'react'
import { X, Plus, Send, Square, Paperclip, ChevronDown, ChevronUp, Bookmark, ArrowRight, FileText, Image, Loader2, Trash2, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAgentContext } from './agent-context'
import { useAgent } from './use-agent'
import { AgentMessages } from './agent-messages'
import { QuickPrompts } from './quick-prompts'
import { saveAiResponse, getSavedResponses, deleteSavedResponse } from '@/lib/actions/ai-saved'
import type { AttachedFile } from '@/lib/ai/types'

interface SavedItem {
  id: string
  title: string
  content: string
  client_name: string | null
  context_url: string | null
  created_at: string
}

export function AgentPanel() {
  const { context, isOpen, setIsOpen } = useAgentContext()
  const { messages, isLoading, streamingText, activeTools, sendMessage, clearMessages, stopGeneration } =
    useAgent(context)

  const [input, setInput] = useState('')
  const [isMinimized, setIsMinimized] = useState(false)
  const [showSaved, setShowSaved] = useState(false)
  const [savedItems, setSavedItems] = useState<SavedItem[]>([])
  const [savedLoading, setSavedLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleSend() {
    const text = input.trim()
    if ((!text && !attachedFile) || isLoading) return
    setInput('')
    sendMessage(text, attachedFile || undefined)
    setAttachedFile(null)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  function handleNewSession() {
    clearMessages()
    setInput('')
    setAttachedFile(null)
  }

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { alert('קובץ גדול מדי. מקסימום 10MB'); return }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const base64 = (ev.target?.result as string).split(',')[1]
      setAttachedFile({ name: file.name, mimeType: file.type || 'application/octet-stream', data: base64, size: file.size })
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }, [])

  const handleOpenSaved = useCallback(async () => {
    setShowSaved(true)
    setSavedLoading(true)
    const res = await getSavedResponses(50)
    if (res.success) setSavedItems((res.items || []) as SavedItem[])
    setSavedLoading(false)
  }, [])

  const handleSaveMessage = useCallback(async (content: string) => {
    await saveAiResponse(content, context.clientId, context.clientName, context.pageUrl)
    // Refresh saved list if open
    if (showSaved) {
      const res = await getSavedResponses(50)
      if (res.success) setSavedItems((res.items || []) as SavedItem[])
    }
  }, [context, showSaved])

  const handleDelete = useCallback(async (id: string) => {
    await deleteSavedResponse(id)
    setSavedItems(prev => prev.filter(i => i.id !== id))
  }, [])

  const handleCopySaved = useCallback(async (id: string, content: string) => {
    await navigator.clipboard.writeText(content)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }, [])

  if (!isOpen) return null

  const isEmpty = messages.length === 0 && !streamingText && !isLoading

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setIsOpen(false)} />

      <div
        dir="rtl"
        className={cn(
          'fixed z-50 flex flex-col bg-card border-border shadow-2xl transition-all duration-300',
          'bottom-0 left-0 right-0 rounded-t-2xl border-t md:rounded-none md:border-t-0',
          isMinimized ? 'h-14' : 'h-[85dvh]',
          'md:top-0 md:bottom-0 md:left-0 md:right-auto md:w-[400px] md:border-r md:border-l-0 md:rounded-none',
          isMinimized ? 'md:h-14 md:top-auto md:bottom-0' : 'md:h-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">🤖</span>
            <div>
              <h3 className="text-sm font-bold text-foreground leading-none">עוזר AI</h3>
              {context.clientName && !isMinimized && (
                <p className="text-[11px] text-muted-foreground mt-0.5">לקוח: {context.clientName}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {!isMinimized && messages.length > 0 && (
              <button onClick={handleNewSession} title="שיחה חדשה"
                className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
                <Plus className="h-4 w-4" />
              </button>
            )}
            {!isMinimized && (
              <button onClick={handleOpenSaved} title="תשובות שמורות"
                className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-amber-600 hover:bg-amber-50 transition-all">
                <Bookmark className="h-4 w-4" />
              </button>
            )}
            <button onClick={() => setIsMinimized(v => !v)} title={isMinimized ? 'הרחב' : 'מזער'}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
              {isMinimized ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            <button onClick={() => setIsOpen(false)} title="סגור"
              className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Saved responses panel */}
            {showSaved ? (
              <div className="flex-1 min-h-0 overflow-y-auto">
                {/* Saved header */}
                <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-border sticky top-0 bg-card z-10">
                  <button onClick={() => setShowSaved(false)}
                    className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <Bookmark className="h-4 w-4 text-amber-500 shrink-0" />
                  <span className="text-sm font-bold">תשובות שמורות</span>
                  {savedItems.length > 0 && (
                    <span className="mr-auto text-[11px] font-bold text-muted-foreground">{savedItems.length} פריטים</span>
                  )}
                </div>

                {savedLoading ? (
                  <div className="text-center text-sm text-muted-foreground py-12">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />טוען...
                  </div>
                ) : savedItems.length === 0 ? (
                  <div className="text-center py-16 px-4">
                    <Bookmark className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm font-bold text-muted-foreground">אין תשובות שמורות</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">לחץ על "שמור" מתחת לתשובת הסוכן</p>
                  </div>
                ) : (
                  <div className="p-3 space-y-2">
                    {savedItems.map(item => (
                      <div key={item.id}
                        className="border border-border/50 rounded-xl bg-secondary/30 overflow-hidden">
                        {/* Item header */}
                        <button
                          onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                          className="w-full text-right p-3 flex items-start gap-2 hover:bg-secondary/60 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-foreground leading-snug line-clamp-2">{item.title}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {item.client_name && (
                                <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-md">
                                  {item.client_name}
                                </span>
                              )}
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(item.created_at).toLocaleString('he-IL', {
                                  day: '2-digit', month: '2-digit', year: 'numeric',
                                  hour: '2-digit', minute: '2-digit'
                                })}
                              </span>
                            </div>
                          </div>
                          <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5 transition-transform', expandedId === item.id && 'rotate-180')} />
                        </button>

                        {/* Expanded content */}
                        {expandedId === item.id && (
                          <div className="border-t border-border/30">
                            <div className="px-3 py-2.5 text-sm text-foreground leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto bg-background/50">
                              {item.content}
                            </div>
                            <div className="flex items-center gap-2 px-3 py-2 border-t border-border/30 bg-secondary/20">
                              <button
                                onClick={() => handleCopySaved(item.id, item.content)}
                                className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors"
                              >
                                {copiedId === item.id
                                  ? <><Check className="h-3 w-3 text-emerald-500" />הועתק</>
                                  : <><Copy className="h-3 w-3" />העתק</>
                                }
                              </button>
                              <button
                                onClick={() => handleDelete(item.id)}
                                className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-red-500 transition-colors mr-auto"
                              >
                                <Trash2 className="h-3 w-3" />מחק
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Chat view */
              <div className="flex-1 min-h-0 overflow-y-auto">
                {isEmpty ? (
                  <QuickPrompts
                    clientName={context.clientName}
                    onSelect={(p) => { setInput(p); setTimeout(() => inputRef.current?.focus(), 50) }}
                  />
                ) : (
                  <AgentMessages
                    messages={messages}
                    streamingText={streamingText}
                    activeTools={activeTools}
                    isLoading={isLoading}
                    onSaveMessage={handleSaveMessage}
                  />
                )}
              </div>
            )}

            {/* Input — only in chat view */}
            {!showSaved && (
              <div className="shrink-0 px-3 pb-4 pt-2 border-t border-border">
                {attachedFile && (
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <div className="flex items-center gap-2 bg-secondary/80 rounded-xl px-3 py-1.5 text-xs flex-1 min-w-0">
                      {attachedFile.mimeType.startsWith('image/') ? (
                        <Image className="h-3.5 w-3.5 text-primary shrink-0" />
                      ) : (
                        <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                      )}
                      <span className="truncate font-medium text-foreground">{attachedFile.name}</span>
                      <span className="text-muted-foreground shrink-0">({Math.round(attachedFile.size / 1024)}KB)</span>
                    </div>
                    <button onClick={() => setAttachedFile(null)} className="shrink-0 text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                <div className="flex items-end gap-2 bg-secondary/50 rounded-2xl border border-border px-3 py-2">
                  <input ref={fileInputRef} type="file" accept="image/*,.pdf,.xlsx,.xls,.csv"
                    onChange={handleFileSelect} className="hidden" />
                  <button onClick={() => fileInputRef.current?.click()} title="צרף קובץ" disabled={isLoading}
                    className="shrink-0 h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all disabled:opacity-40">
                    <Paperclip className="h-3.5 w-3.5" />
                  </button>

                  <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={attachedFile ? 'הוסף הוראות לקובץ...' : 'שאל אותי כל דבר...'}
                    rows={1} disabled={isLoading}
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none leading-relaxed max-h-32 overflow-y-auto no-scrollbar disabled:opacity-50"
                    style={{ minHeight: '24px' }}
                    onInput={e => {
                      const el = e.currentTarget
                      el.style.height = 'auto'
                      el.style.height = Math.min(el.scrollHeight, 128) + 'px'
                    }}
                  />

                  {isLoading ? (
                    <button onClick={stopGeneration} title="עצור"
                      className="shrink-0 h-8 w-8 rounded-xl bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all">
                      <Square className="h-3.5 w-3.5 text-white fill-white" />
                    </button>
                  ) : (
                    <button onClick={handleSend} disabled={!input.trim() && !attachedFile} title="שלח"
                      className="shrink-0 h-8 w-8 rounded-xl bg-primary hover:bg-primary/90 flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95">
                      <Send className="h-3.5 w-3.5 text-primary-foreground" />
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground text-center mt-1.5">
                  Enter לשליחה · Shift+Enter לשורה חדשה · 📎 לצירוף קובץ/תמונה/PDF
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
