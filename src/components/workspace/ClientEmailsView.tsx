'use client'

/**
 * src/components/workspace/ClientEmailsView.tsx
 *
 * Full-featured Gmail correspondence client inside Nehemiah OS Workspace v2.
 * Features:
 * - Master-Detail RTL layout for email threads and message reading
 * - Inline Quick Reply & Compose new email dialog
 * - Unread email tracking & toggle filter
 * - Dynamic Label switching & autocomplete from Gmail
 * - Seamless Re-Authentication banner & flow when OAuth tokens expire
 */

import { useState, useEffect, useTransition, useCallback } from 'react'
import {
  Mail,
  RefreshCw,
  Search,
  Tag,
  Paperclip,
  Send,
  CornerUpRight,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  Plus,
  Loader2,
  Check,
  ChevronDown,
  ChevronUp,
  Inbox,
  Sparkles,
  Lock,
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  getClientEmailsAction,
  getEmailThreadAction,
  markEmailThreadReadAction,
  replyToEmailAction,
  sendClientEmailAction,
  getAvailableGmailLabelsAction,
  updateClientGmailLabelAction,
} from '@/app/workspace/actions/emails'
import type {
  ClientEmailThreadHeader,
  ClientEmailThreadFull,
  GmailLabelItem,
} from '@/lib/google-gmail'

interface Props {
  clientId: string
  clientName: string
  clientEmail: string | null
  initialGmailLabel: string | null
}

export function ClientEmailsView({
  clientId,
  clientName,
  clientEmail,
  initialGmailLabel,
}: Props) {
  const [threads, setThreads] = useState<ClientEmailThreadHeader[]>([])
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [activeThread, setActiveThread] = useState<ClientEmailThreadFull | null>(null)
  const [loadingList, setLoadingList] = useState(true)
  const [loadingThread, setLoadingThread] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  // Filters
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Label management
  const [gmailLabel, setGmailLabel] = useState<string | null>(initialGmailLabel)
  const [availableLabels, setAvailableLabels] = useState<GmailLabelItem[]>([])
  const [labelPopoverOpen, setLabelPopoverOpen] = useState(false)
  const [customLabelInput, setCustomLabelInput] = useState('')

  // Re-Auth / Error state
  const [authError, setAuthError] = useState<string | null>(null)

  // Reply Composer state
  const [replyText, setReplyText] = useState('')
  const [isReplying, setIsReplying] = useState(false)

  // New Email Modal state
  const [newEmailOpen, setNewEmailOpen] = useState(false)
  const [newEmailTo, setNewEmailTo] = useState(clientEmail || '')
  const [newEmailSubject, setNewEmailSubject] = useState('')
  const [newEmailBody, setNewEmailBody] = useState('')
  const [isSendingNew, setIsSendingNew] = useState(false)

  // Collapsed messages in thread
  const [collapsedMessages, setCollapsedMessages] = useState<Record<string, boolean>>({})

  const [isPending, startTransition] = useTransition()

  // ── Fetch Email List ──────────────────────────────────────────────────────────

  const loadEmails = useCallback(async () => {
    setLoadingList(true)
    setAuthError(null)

    const res = await getClientEmailsAction(clientId, {
      unreadOnly,
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
      // Do NOT auto-select first thread so it does not mark as read automatically
      if (res.data.threads.length === 0) {
        setSelectedThreadId(null)
        setActiveThread(null)
      } else if (selectedThreadId && !res.data.threads.some((t) => t.threadId === selectedThreadId)) {
        setSelectedThreadId(null)
        setActiveThread(null)
      }
    }
  }, [clientId, unreadOnly, searchQuery, selectedThreadId])

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

    getEmailThreadAction(clientId, selectedThreadId).then((res) => {
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
        // Mark as read locally and remotely
        if (res.data.isUnread) {
          markEmailThreadReadAction(clientId, selectedThreadId, true)
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
  }, [clientId, selectedThreadId])

  // ── Load Gmail Labels for dropdown ───────────────────────────────────────────

  function loadLabels() {
    getAvailableGmailLabelsAction().then((res) => {
      if (res.data) {
        setAvailableLabels(res.data)
      }
    })
  }

  // ── Handlers ─────────────────────────────────────────────────────────────────

  async function handleSaveLabel(newLabel: string | null) {
    startTransition(async () => {
      const res = await updateClientGmailLabelAction(clientId, newLabel)
      if (res.error) {
        toast.error(res.error)
      } else {
        setGmailLabel(res.data?.gmailLabel ?? null)
        setLabelPopoverOpen(false)
        toast.success(newLabel ? `תווית Gmail עודכנה ל: "${newLabel}"` : 'התווית הוסרה (חיפוש לפי כתובת מייל)')
        loadEmails()
      }
    })
  }

  async function handleSendReply() {
    if (!activeThread || !replyText.trim()) return

    const lastMsg = activeThread.messages[activeThread.messages.length - 1]
    const recipient = lastMsg.from.email || clientEmail || ''
    const subject = activeThread.subject

    setIsReplying(true)
    const res = await replyToEmailAction(clientId, {
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

    // Refresh active thread
    if (selectedThreadId) {
      const updated = await getEmailThreadAction(clientId, selectedThreadId)
      if (updated.data) setActiveThread(updated.data)
    }
  }

  async function handleSendNewEmail() {
    if (!newEmailTo.trim() || !newEmailSubject.trim() || !newEmailBody.trim()) {
      toast.error('נא למלא את כל השדות')
      return
    }

    setIsSendingNew(true)
    const res = await sendClientEmailAction(clientId, {
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
    setNewEmailSubject('')
    setNewEmailBody('')
    loadEmails()
  }

  async function toggleThreadRead(threadId: string, currentUnread: boolean) {
    const nextRead = currentUnread // if currently unread, mark as read
    await markEmailThreadReadAction(clientId, threadId, nextRead)
    setThreads((prev) =>
      prev.map((t) => (t.threadId === threadId ? { ...t, isUnread: !nextRead } : t))
    )
    if (activeThread && activeThread.threadId === threadId) {
      setActiveThread({ ...activeThread, isUnread: !nextRead })
    }
    setUnreadCount((c) => (nextRead ? Math.max(0, c - 1) : c + 1))
    toast.success(nextRead ? 'סומן כנקרא' : 'סומן כלא נקרא')
  }

  const reconnectUrl = `/api/google/auth?returnUrl=${encodeURIComponent(
    `/workspace/clients/${clientId}`
  )}`

  // Format date helper
  function formatEmailDate(dateStr: string) {
    try {
      const d = new Date(dateStr)
      const now = new Date()
      const isToday = d.toDateString() === now.toDateString()
      if (isToday) {
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

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div dir="rtl" className="flex flex-col h-full bg-background overflow-hidden">
      {/* ── Top Bar: Label info & Controls ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-border bg-card/60 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-600 flex items-center justify-center shrink-0">
            <Mail className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground truncate">
                התכתבויות Gmail
              </span>
              {unreadCount > 0 && (
                <Badge className="bg-red-500 hover:bg-red-600 text-white text-[10px] px-1.5 py-0 h-4">
                  {unreadCount} שלא נקראו
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
              <span>תווית מסונכרנת:</span>
              <Popover open={labelPopoverOpen} onOpenChange={setLabelPopoverOpen}>
                <PopoverTrigger asChild>
                  <button
                    onClick={loadLabels}
                    className="inline-flex items-center gap-1 font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400 px-2 py-0.5 rounded-md transition-colors"
                  >
                    <Tag className="w-3 h-3" />
                    {gmailLabel || (clientEmail ? `כתובת מייל (${clientEmail})` : 'לא הוגדרה תווית')}
                    <ChevronDown className="w-2.5 h-2.5 opacity-60" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-80 p-3 space-y-3">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-foreground">שיוך תווית Gmail ללקוח</p>
                    <p className="text-[11px] text-muted-foreground">
                      בחר תווית קיימת מחשבון ה-Gmail שלך או הקלד שם תווית ידנית.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex gap-1.5">
                      <Input
                        placeholder="הקלד תווית חדשה..."
                        value={customLabelInput}
                        onChange={(e) => setCustomLabelInput(e.target.value)}
                        className="h-8 text-xs"
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          if (customLabelInput.trim()) {
                            handleSaveLabel(customLabelInput.trim())
                            setCustomLabelInput('')
                          }
                        }}
                        disabled={!customLabelInput.trim() || isPending}
                        className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white shrink-0"
                      >
                        הגדר
                      </Button>
                    </div>

                    <div className="max-h-48 overflow-y-auto space-y-1 pt-1 border-t border-border">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">
                        תוויות זמינות ב-Gmail:
                      </p>
                      {availableLabels.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground py-2 text-center">
                          טוען תוויות מ-Gmail...
                        </p>
                      ) : (
                        availableLabels
                          .filter((l) => l.type === 'user')
                          .map((l) => (
                            <button
                              key={l.id}
                              onClick={() => handleSaveLabel(l.name)}
                              className={`w-full flex items-center justify-between text-right px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                                gmailLabel === l.name
                                  ? 'bg-red-500/10 text-red-600 font-bold'
                                  : 'hover:bg-accent text-foreground'
                              }`}
                            >
                              <span className="truncate">{l.name}</span>
                              {gmailLabel === l.name && <Check className="w-3.5 h-3.5 text-red-600" />}
                            </button>
                          ))
                      )}
                    </div>

                    {gmailLabel && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSaveLabel(null)}
                        disabled={isPending}
                        className="w-full text-xs text-muted-foreground hover:text-destructive h-7"
                      >
                        הסר שיוך תווית (חיפוש לפי כתובת לקוח)
                      </Button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
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
            מייל חדש
          </Button>
        </div>
      </div>

      {/* ── Re-Authentication Banner (if token expired/scope missing) ──────── */}
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

      {/* ── Main Split View ────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left/Right RTL: Threads List */}
        <div className="w-full sm:w-80 lg:w-96 border-l border-border flex flex-col bg-card shrink-0">
          {/* Search & Filter pills */}
          <div className="p-3 border-b border-border/60 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-muted-foreground" />
              <Input
                placeholder="חיפוש במיילים..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pr-8 text-xs bg-background"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setUnreadOnly(false)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  !unreadOnly
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                הכל ({threads.length})
              </button>
              <button
                onClick={() => setUnreadOnly(true)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  unreadOnly
                    ? 'bg-red-600 text-white'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                שלא נקראו
                {unreadCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-red-500/20 text-red-600 text-[10px] flex items-center justify-center font-bold">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* List items */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/40">
            {loadingList ? (
              <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin text-red-500" />
                <span className="text-xs">טוען הודעות מ-Gmail...</span>
              </div>
            ) : !gmailLabel ? (
              <div className="flex flex-col items-center justify-center h-64 p-6 text-center text-muted-foreground gap-2">
                <Tag className="w-10 h-10 opacity-30 text-amber-500" />
                <p className="text-sm font-bold text-foreground">לא הוגדרה תווית ייעודית</p>
                <p className="text-xs max-w-xs text-muted-foreground">
                  כדי להציג מיילים של הלקוח, יש להגדיר תווית Gmail ייעודית (למשל: {clientName}).
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setLabelPopoverOpen(true)}
                  className="mt-2 text-xs font-semibold gap-1.5 border-amber-300 hover:bg-amber-50 text-amber-900 dark:text-amber-200"
                >
                  <Tag className="w-3.5 h-3.5" />
                  הגדר תווית Gmail עכשיו
                </Button>
              </div>
            ) : threads.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-60 p-6 text-center text-muted-foreground gap-2">
                <Inbox className="w-10 h-10 opacity-30" />
                <p className="text-sm font-bold text-foreground">אין מיילים להצגה</p>
                <p className="text-xs max-w-xs">
                  לא נמצאו התכתבויות תחת התווית &quot;{gmailLabel}&quot;.
                </p>
              </div>
            ) : (
              threads.map((t) => {
                const isSelected = selectedThreadId === t.threadId
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedThreadId(t.threadId)}
                    className={`p-3 cursor-pointer transition-all border-r-4 ${
                      isSelected
                        ? 'bg-accent/70 border-red-500'
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

                    <div className="flex items-center gap-2 mt-2">
                      {t.messageCount > 1 && (
                        <span className="text-[10px] bg-muted px-1.5 py-0.2 rounded text-muted-foreground font-bold">
                          {t.messageCount} הודעות
                        </span>
                      )}
                      {t.hasAttachments && (
                        <Paperclip className="w-3 h-3 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* ── Selected Thread Detail View ──────────────────────────────────── */}
        <div className="flex-1 flex flex-col bg-background overflow-hidden min-w-0">
          {!selectedThreadId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3 p-6 text-center">
              <Mail className="w-12 h-12 opacity-20" />
              <div>
                <p className="text-base font-bold text-foreground">בחר התכתבות לקריאה</p>
                <p className="text-xs text-muted-foreground mt-1">
                  הקש על אחד המיילים ברשימה מימין לצפייה בשרשור המלא ובגוף ההודעות
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
                      {activeThread.messages.length} הודעות בשרשור
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

              {/* Messages list (Chronological) */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {activeThread.messages.map((msg, index) => {
                  const isCollapsed = collapsedMessages[msg.id] ?? (index < activeThread.messages.length - 1 && activeThread.messages.length > 2)

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

                      {/* Message body (expanded) */}
                      {!isCollapsed && (
                        <div className="px-5 pb-5 pt-1 border-t border-border/50 space-y-4">
                          {/* Body Content */}
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

                          {/* Attachments */}
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

                {/* ── Inline Reply Composer ────────────────────────────────── */}
                <div className="rounded-2xl border border-red-500/30 bg-card p-4 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <CornerUpRight className="w-4 h-4 text-red-500" />
                      מענה מהיר בשרשור
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      שולח ל:{' '}
                      {activeThread.messages[activeThread.messages.length - 1].from.email || clientEmail}
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
              מייל חדש ללקוח ({clientName})
            </DialogTitle>
            <DialogDescription className="text-xs">
              שליחת הודעת אימייל ישירות מחשבון ה-Gmail שלך
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">
                אל (כתובת נמען):
              </label>
              <Input
                placeholder="client@example.com"
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
