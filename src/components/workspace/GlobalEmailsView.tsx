'use client'

/**
 * src/components/workspace/GlobalEmailsView.tsx
 *
 * Full-scale global Gmail client for Nehemiah OS Workspace v2.
 * Allows Nehemiah to manage his entire Gmail inbox, sent mail, starred items,
 * custom folders, unread tracking, thread reading, and inline replying.
 */

import { useState, useEffect, useTransition, useCallback } from 'react'
import Link from 'next/link'
import {
  Mail,
  Inbox,
  Send,
  Star,
  FileText,
  Trash2,
  Tag,
  RefreshCw,
  Search,
  Plus,
  Loader2,
  Paperclip,
  CornerUpRight,
  ChevronDown,
  ChevronUp,
  Lock,
  Users,
  ExternalLink,
  Check,
  AlertCircle,
  Folder,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  getGlobalEmailsAction,
  getEmailThreadAction,
  markEmailThreadReadAction,
  replyToEmailAction,
  sendClientEmailAction,
  getAvailableGmailLabelsAction,
} from '@/app/workspace/actions/emails'
import type {
  ClientEmailThreadHeader,
  ClientEmailThreadFull,
  GmailLabelItem,
} from '@/lib/google-gmail'

interface Props {
  clients?: Array<{ id: string; name: string; email: string | null; gmail_label: string | null }>
}

type MailFolder = 'INBOX' | 'UNREAD' | 'STARRED' | 'SENT' | 'DRAFT' | 'ALL'

export function GlobalEmailsView({ clients = [] }: Props) {
  const [selectedFolder, setSelectedFolder] = useState<MailFolder>('INBOX')
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null)
  const [threads, setThreads] = useState<ClientEmailThreadHeader[]>([])
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [activeThread, setActiveThread] = useState<ClientEmailThreadFull | null>(null)
  const [loadingList, setLoadingList] = useState(true)
  const [loadingThread, setLoadingThread] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  // Filters & Search
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Labels
  const [labels, setLabels] = useState<GmailLabelItem[]>([])

  // Re-Auth / Error state
  const [authError, setAuthError] = useState<string | null>(null)

  // Reply state
  const [replyText, setReplyText] = useState('')
  const [isReplying, setIsReplying] = useState(false)

  // New Email Modal state
  const [newEmailOpen, setNewEmailOpen] = useState(false)
  const [newEmailTo, setNewEmailTo] = useState('')
  const [newEmailSubject, setNewEmailSubject] = useState('')
  const [newEmailBody, setNewEmailBody] = useState('')
  const [isSendingNew, setIsSendingNew] = useState(false)

  // Message collapsing
  const [collapsedMessages, setCollapsedMessages] = useState<Record<string, boolean>>({})

  // ── Load Labels ──────────────────────────────────────────────────────────────

  const loadLabels = useCallback(async () => {
    const res = await getAvailableGmailLabelsAction()
    if (res.data) {
      setLabels(res.data)
    }
  }, [])

  useEffect(() => {
    loadLabels()
  }, [loadLabels])

  // ── Fetch Email List ──────────────────────────────────────────────────────────

  const loadEmails = useCallback(async () => {
    setLoadingList(true)
    setAuthError(null)

    const folderParam = selectedLabel ? undefined : selectedFolder === 'UNREAD' ? 'INBOX' : selectedFolder
    const isUnreadFilter = unreadOnly || selectedFolder === 'UNREAD'

    const res = await getGlobalEmailsAction({
      folder: folderParam,
      labelName: selectedLabel || undefined,
      unreadOnly: isUnreadFilter,
      query: searchQuery.trim() || undefined,
    })

    setLoadingList(false)

    if (res.isAuthError) {
      setAuthError(res.error || 'נדרש חיבור מחדש לחשבון Gmail')
      return
    }

    if (res.error) {
      toast.error(res.error)
      return
    }

    if (res.data) {
      setThreads(res.data.threads)
      setUnreadCount(res.data.unreadCount)

      // Auto-select first thread if nothing selected or previous selection gone
      if (res.data.threads.length > 0) {
        if (!selectedThreadId || !res.data.threads.some((t) => t.threadId === selectedThreadId)) {
          setSelectedThreadId(res.data.threads[0].threadId)
        }
      } else {
        setSelectedThreadId(null)
        setActiveThread(null)
      }
    }
  }, [selectedFolder, selectedLabel, unreadOnly, searchQuery, selectedThreadId])

  useEffect(() => {
    loadEmails()
  }, [loadEmails])

  // ── Fetch Full Thread ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!selectedThreadId) {
      setActiveThread(null)
      return
    }

    let isMounted = true
    setLoadingThread(true)

    // Using dummy clientId or first client for admin context
    getEmailThreadAction(clients[0]?.id || 'admin', selectedThreadId).then((res) => {
      if (!isMounted) return
      setLoadingThread(false)

      if (res.isAuthError) {
        setAuthError(res.error || 'נדרש חיבור מחדש לחשבון Gmail')
        return
      }

      if (res.error) {
        toast.error(res.error)
        return
      }

      if (res.data) {
        setActiveThread(res.data)
        if (res.data.isUnread) {
          markEmailThreadReadAction(clients[0]?.id || 'admin', selectedThreadId, true)
          setThreads((prev) =>
            prev.map((t) => (t.threadId === selectedThreadId ? { ...t, isUnread: false } : t))
          )
          setUnreadCount((c) => Math.max(0, c - 1))
        }
      }
    })

    return () => {
      isMounted = false
    }
  }, [selectedThreadId, clients])

  // ── Handlers ─────────────────────────────────────────────────────────────────

  async function handleSendReply() {
    if (!activeThread || !replyText.trim()) return

    const lastMsg = activeThread.messages[activeThread.messages.length - 1]
    const recipient = lastMsg.from.email || ''
    const subject = activeThread.subject

    setIsReplying(true)
    const res = await replyToEmailAction(clients[0]?.id || 'admin', {
      threadId: activeThread.threadId,
      to: recipient,
      subject,
      bodyText: replyText.trim(),
      inReplyToHeader: lastMsg.messageIdHeader,
    })
    setIsReplying(false)

    if (res.isAuthError) {
      setAuthError(res.error || 'טוקן Gmail פג תוקף')
      return
    }

    if (res.error) {
      toast.error(res.error)
      return
    }

    toast.success('המענה נשלח בהצלחה!')
    setReplyText('')

    if (selectedThreadId) {
      const updated = await getEmailThreadAction(clients[0]?.id || 'admin', selectedThreadId)
      if (updated.data) setActiveThread(updated.data)
    }
  }

  async function handleSendNewEmail() {
    if (!newEmailTo.trim() || !newEmailSubject.trim() || !newEmailBody.trim()) {
      toast.error('נא למלא את כל השדות')
      return
    }

    setIsSendingNew(true)
    const res = await sendClientEmailAction(clients[0]?.id || 'admin', {
      to: newEmailTo.trim(),
      subject: newEmailSubject.trim(),
      bodyText: newEmailBody.trim(),
    })
    setIsSendingNew(false)

    if (res.isAuthError) {
      setAuthError(res.error || 'טוקן Gmail פג תוקף')
      return
    }

    if (res.error) {
      toast.error(res.error)
      return
    }

    toast.success('המייל נשלח בהצלחה!')
    setNewEmailOpen(false)
    setNewEmailTo('')
    setNewEmailSubject('')
    setNewEmailBody('')
    loadEmails()
  }

  async function toggleThreadRead(threadId: string, currentUnread: boolean) {
    const nextRead = currentUnread
    await markEmailThreadReadAction(clients[0]?.id || 'admin', threadId, nextRead)
    setThreads((prev) =>
      prev.map((t) => (t.threadId === threadId ? { ...t, isUnread: !nextRead } : t))
    )
    if (activeThread && activeThread.threadId === threadId) {
      setActiveThread({ ...activeThread, isUnread: !nextRead })
    }
    setUnreadCount((c) => (nextRead ? Math.max(0, c - 1) : c + 1))
    toast.success(nextRead ? 'סומן כנקרא' : 'סומן כלא נקרא')
  }

  function formatEmailDate(dateStr: string) {
    try {
      const d = new Date(dateStr)
      const now = new Date()
      if (d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
      }
      const yesterday = new Date(now)
      yesterday.setDate(now.getDate() - 1)
      if (d.toDateString() === yesterday.toDateString()) {
        return 'אתמול'
      }
      return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })
    } catch {
      return dateStr
    }
  }

  const reconnectUrl = `/api/google/auth?returnUrl=${encodeURIComponent('/workspace/emails')}`

  // Matching client helper
  function findClientForThread(thread: ClientEmailThreadHeader) {
    return clients.find((c) => {
      if (c.gmail_label && thread.labels.includes(c.gmail_label)) return true
      if (c.email && (thread.from.email.toLowerCase() === c.email.toLowerCase() || thread.to.some((t) => t.toLowerCase().includes(c.email!.toLowerCase())))) return true
      return false
    })
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div dir="rtl" className="flex flex-col h-[calc(100vh-3.5rem)] bg-background overflow-hidden">
      {/* ── Top Header ─────────────────────────────────────────────────────── */}
      <header className="h-14 border-b border-border bg-card/80 backdrop-blur-sm px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-red-600 flex items-center justify-center shadow-lg shadow-red-600/30 text-white shrink-0">
            <Mail className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base font-black text-foreground leading-none">
              דוא״ל נחמיה (Gmail)
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              תיבת דואר מרכזית, מעקב הודעות שלא נקראו ושליחה מהירה
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadEmails}
            disabled={loadingList}
            className="h-8 gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingList ? 'animate-spin' : ''}`} />
            רענן
          </Button>

          <Button
            size="sm"
            onClick={() => setNewEmailOpen(true)}
            className="h-8 gap-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            הודעה חדשה
          </Button>
        </div>
      </header>

      {/* ── Re-Auth Banner ─────────────────────────────────────────────────── */}
      {authError && (
        <div className="m-4 p-4 rounded-2xl border border-red-500/30 bg-red-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-600 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-red-950 dark:text-red-200">
                נדרש חיבור מחדש לחשבון ה-Gmail
              </p>
              <p className="text-xs text-red-800/80 dark:text-red-300/80 mt-0.5">
                {authError}
              </p>
            </div>
          </div>

          <a
            href={reconnectUrl}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-md shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            חבר מחדש את Gmail
          </a>
        </div>
      )}

      {/* ── Main 3-Column Split View ───────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* ── Column 1: Mailbox Folders & Labels Sidebar ──────────────────── */}
        <aside className="w-56 border-l border-border bg-card/60 flex flex-col shrink-0 overflow-y-auto p-3 space-y-4">
          {/* System Folders */}
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase px-2 mb-1.5">
              תיבות ראשיות
            </p>

            <button
              onClick={() => {
                setSelectedFolder('INBOX')
                setSelectedLabel(null)
                setUnreadOnly(false)
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                selectedFolder === 'INBOX' && !selectedLabel && !unreadOnly
                  ? 'bg-red-600 text-white font-bold'
                  : 'text-foreground hover:bg-accent'
              }`}
            >
              <div className="flex items-center gap-2">
                <Inbox className="w-4 h-4" />
                <span>דואר נכנס</span>
              </div>
            </button>

            <button
              onClick={() => {
                setSelectedFolder('UNREAD')
                setSelectedLabel(null)
                setUnreadOnly(true)
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                selectedFolder === 'UNREAD' || unreadOnly
                  ? 'bg-red-600 text-white font-bold'
                  : 'text-foreground hover:bg-accent'
              }`}
            >
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-red-400" />
                <span>שלא נקראו</span>
              </div>
              {unreadCount > 0 && (
                <span className="text-[10px] bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 font-bold px-1.5 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setSelectedFolder('STARRED')
                setSelectedLabel(null)
                setUnreadOnly(false)
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                selectedFolder === 'STARRED' && !selectedLabel
                  ? 'bg-red-600 text-white font-bold'
                  : 'text-foreground hover:bg-accent'
              }`}
            >
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400" />
                <span>מסומנים בכוכב</span>
              </div>
            </button>

            <button
              onClick={() => {
                setSelectedFolder('SENT')
                setSelectedLabel(null)
                setUnreadOnly(false)
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                selectedFolder === 'SENT' && !selectedLabel
                  ? 'bg-red-600 text-white font-bold'
                  : 'text-foreground hover:bg-accent'
              }`}
            >
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4" />
                <span>דואר שנשלח</span>
              </div>
            </button>

            <button
              onClick={() => {
                setSelectedFolder('ALL')
                setSelectedLabel(null)
                setUnreadOnly(false)
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                selectedFolder === 'ALL' && !selectedLabel
                  ? 'bg-red-600 text-white font-bold'
                  : 'text-foreground hover:bg-accent'
              }`}
            >
              <div className="flex items-center gap-2">
                <Folder className="w-4 h-4" />
                <span>כל הדואר</span>
              </div>
            </button>
          </div>

          {/* User Labels */}
          <div className="space-y-1 border-t border-border pt-3">
            <p className="text-[10px] font-bold text-muted-foreground uppercase px-2 mb-1.5 flex items-center justify-between">
              <span>תוויות ולקוחות</span>
              <Tag className="w-3 h-3 opacity-60" />
            </p>

            {labels
              .filter((l) => l.type === 'user')
              .map((l) => {
                const isSelected = selectedLabel === l.name
                const matchedClient = clients.find((c) => c.gmail_label === l.name)

                return (
                  <button
                    key={l.id}
                    onClick={() => {
                      setSelectedLabel(l.name)
                      setUnreadOnly(false)
                    }}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs transition-colors ${
                      isSelected
                        ? 'bg-red-600 text-white font-bold shadow-xs'
                        : 'text-foreground hover:bg-accent'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Tag className="w-3.5 h-3.5 shrink-0 opacity-70" />
                      <span className="truncate">{l.name}</span>
                    </div>
                    {matchedClient && (
                      <span className="text-[9px] bg-red-100 text-red-700 font-bold px-1.5 py-0.2 rounded shrink-0">
                        לקוח
                      </span>
                    )}
                  </button>
                )
              })}
          </div>
        </aside>

        {/* ── Column 2: Threads List ────────────────────────────────────────── */}
        <div className="w-80 lg:w-96 border-l border-border flex flex-col bg-card shrink-0 min-w-0">
          {/* Search bar */}
          <div className="p-3 border-b border-border space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-muted-foreground" />
              <Input
                placeholder="חיפוש בכל המיילים..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pr-8 text-xs bg-background"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span className="font-bold truncate">
                {selectedLabel ? `תווית: ${selectedLabel}` : selectedFolder}
              </span>
              <span>{threads.length} שיחות</span>
            </div>
          </div>

          {/* List items */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/40">
            {loadingList ? (
              <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin text-red-500" />
                <span className="text-xs">טוען הודעות מ-Gmail...</span>
              </div>
            ) : threads.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-60 p-6 text-center text-muted-foreground gap-2">
                <Inbox className="w-10 h-10 opacity-30" />
                <p className="text-sm font-bold text-foreground">אין מיילים בתיקייה זו</p>
              </div>
            ) : (
              threads.map((t) => {
                const isSelected = selectedThreadId === t.threadId
                const matchedClient = findClientForThread(t)

                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedThreadId(t.threadId)}
                    className={`p-3 cursor-pointer transition-all border-r-4 ${
                      isSelected
                        ? 'bg-accent/80 border-red-500'
                        : 'border-transparent hover:bg-muted/50'
                    } ${t.isUnread ? 'bg-red-500/5' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {t.isUnread && (
                          <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                        )}
                        <span
                          className={`text-xs truncate ${
                            t.isUnread ? 'font-black text-foreground' : 'font-semibold text-foreground/80'
                          }`}
                        >
                          {t.from.name || t.from.email}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatEmailDate(t.date)}
                      </span>
                    </div>

                    <p
                      className={`text-xs truncate mb-1 ${
                        t.isUnread ? 'font-bold text-foreground' : 'text-foreground/90'
                      }`}
                    >
                      {t.subject || '(ללא נושא)'}
                    </p>

                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                      {t.snippet}
                    </p>

                    <div className="flex items-center justify-between gap-2 mt-2">
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        {matchedClient && (
                          <span className="text-[9px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold px-1.5 py-0.2 rounded-md truncate max-w-[120px]">
                            {matchedClient.name}
                          </span>
                        )}
                        {t.messageCount > 1 && (
                          <span className="text-[10px] bg-muted px-1.5 py-0.2 rounded text-muted-foreground font-bold shrink-0">
                            {t.messageCount}
                          </span>
                        )}
                      </div>
                      {t.hasAttachments && (
                        <Paperclip className="w-3 h-3 text-muted-foreground shrink-0" />
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* ── Column 3: Full Thread Reader ─────────────────────────────────── */}
        <div className="flex-1 flex flex-col bg-background overflow-hidden min-w-0">
          {!selectedThreadId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3 p-6 text-center">
              <Mail className="w-12 h-12 opacity-20" />
              <div>
                <p className="text-base font-bold text-foreground">בחר התכתבות לקריאה</p>
                <p className="text-xs text-muted-foreground mt-1">
                  הקש על אחד המיילים ברשימה לצפייה בשיחה המלאה ובגוף ההודעות
                </p>
              </div>
            </div>
          ) : loadingThread ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-red-500" />
              <span className="text-xs">טוען את השיחה...</span>
            </div>
          ) : !activeThread ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              שגיאה בטעינת השיחה
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
              {/* Thread Header */}
              <div className="p-4 border-b border-border bg-card shrink-0 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-black text-foreground truncate">
                    {activeThread.subject || '(ללא נושא)'}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">
                      {activeThread.messages.length} הודעות
                    </span>
                    {activeThread.labels.map((l) => (
                      <Badge key={l} variant="outline" className="text-[10px] py-0">
                        {l}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleThreadRead(activeThread.threadId, !activeThread.isUnread)}
                    className="h-8 text-xs"
                  >
                    {activeThread.isUnread ? 'סמן כנקרא' : 'סמן כלא נקרא'}
                  </Button>
                </div>
              </div>

              {/* Messages list */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {activeThread.messages.map((msg, index) => {
                  const isCollapsed =
                    collapsedMessages[msg.id] ??
                    (index < activeThread.messages.length - 1 && activeThread.messages.length > 2)

                  return (
                    <div
                      key={msg.id}
                      className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden"
                    >
                      {/* Message header */}
                      <div
                        onClick={() =>
                          setCollapsedMessages((prev) => ({ ...prev, [msg.id]: !isCollapsed }))
                        }
                        className="p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-rose-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                            {msg.from.name ? msg.from.name[0].toUpperCase() : 'M'}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-foreground truncate">
                                {msg.from.name || msg.from.email}
                              </span>
                              <span className="text-[11px] text-muted-foreground truncate" dir="ltr">
                                &lt;{msg.from.email}&gt;
                              </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                              אל: {msg.to.join(', ')}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] text-muted-foreground">
                            {new Date(msg.date).toLocaleString('he-IL', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </span>
                          {isCollapsed ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>

                      {/* Body */}
                      {!isCollapsed && (
                        <div className="px-5 pb-5 pt-1 border-t border-border/50 space-y-4">
                          {msg.bodyHtml ? (
                            <div
                              className="prose prose-sm dark:prose-invert max-w-none text-xs text-foreground/90 overflow-x-auto leading-relaxed"
                              dangerouslySetInnerHTML={{ __html: msg.bodyHtml }}
                            />
                          ) : (
                            <div className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed font-sans">
                              {msg.bodyText || msg.snippet}
                            </div>
                          )}

                          {msg.attachments.length > 0 && (
                            <div className="pt-3 border-t border-border/50">
                              <p className="text-[11px] font-bold text-muted-foreground mb-2 flex items-center gap-1.5">
                                <Paperclip className="w-3.5 h-3.5" />
                                קבצים מצורפים ({msg.attachments.length}):
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {msg.attachments.map((att) => (
                                  <div
                                    key={att.id}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border bg-muted/40 text-xs font-medium text-foreground"
                                  >
                                    <Paperclip className="w-3 h-3 text-red-500" />
                                    <span className="truncate max-w-[180px]">{att.filename}</span>
                                    <span className="text-[10px] text-muted-foreground">
                                      ({Math.round(att.size / 1024)} KB)
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Inline Quick Reply */}
                <div className="rounded-2xl border border-red-500/30 bg-card p-4 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <CornerUpRight className="w-4 h-4 text-red-500" />
                      מענה מהיר בשרשור
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      שולח ל:{' '}
                      {activeThread.messages[activeThread.messages.length - 1].from.email}
                    </span>
                  </div>

                  <Textarea
                    placeholder="כתוב את תגובתך כאן..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={4}
                    className="text-xs resize-none bg-background focus-visible:ring-red-500"
                  />

                  <div className="flex items-center justify-between">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setReplyText('')}
                      disabled={!replyText.trim() || isReplying}
                      className="text-xs text-muted-foreground h-8"
                    >
                      נקה
                    </Button>

                    <Button
                      size="sm"
                      onClick={handleSendReply}
                      disabled={!replyText.trim() || isReplying}
                      className="h-8 gap-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-xs"
                    >
                      {isReplying ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      שלח מענה
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── New Email Compose Dialog ───────────────────────────────────────── */}
      <Dialog open={newEmailOpen} onOpenChange={setNewEmailOpen}>
        <DialogContent dir="rtl" className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Mail className="w-5 h-5 text-red-500" />
              הודעת אימייל חדשה
            </DialogTitle>
            <DialogDescription className="text-xs">
              שליחת מייל ישירות מחשבון ה-Gmail שלך
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">
                אל (כתובת נמען):
              </label>
              <Input
                placeholder="recipient@example.com"
                value={newEmailTo}
                onChange={(e) => setNewEmailTo(e.target.value)}
                className="text-xs"
                dir="ltr"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">
                נושא:
              </label>
              <Input
                placeholder="נושא ההודעה..."
                value={newEmailSubject}
                onChange={(e) => setNewEmailSubject(e.target.value)}
                className="text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">
                תוכן ההודעה:
              </label>
              <Textarea
                placeholder="כתוב את הודעתך כאן..."
                value={newEmailBody}
                onChange={(e) => setNewEmailBody(e.target.value)}
                rows={6}
                className="text-xs resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setNewEmailOpen(false)}
              disabled={isSendingNew}
              className="text-xs"
            >
              ביטול
            </Button>
            <Button
              size="sm"
              onClick={handleSendNewEmail}
              disabled={isSendingNew || !newEmailTo.trim() || !newEmailSubject.trim() || !newEmailBody.trim()}
              className="text-xs font-bold bg-red-600 hover:bg-red-700 text-white gap-1.5"
            >
              {isSendingNew ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              שלח מייל
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
