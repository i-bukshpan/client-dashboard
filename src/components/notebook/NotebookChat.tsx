'use client'

/**
 * NotebookChat — The primary conversational AI layer for Nehemiah OS v3 Notebook.
 *
 * Full-width chat with:
 * - 2 Conversation Modes:
 *     * מצב מורחב (Expanded Mode): In-depth analysis, comprehensive summaries, full cards & tables.
 *     * מצב קצר (Brief Mode): Concise executive summaries, bottom-line focus, 2-4 bullet points.
 * - Autonomous Info Cards, Data Tables & Progress Charts rendering.
 * - Instant "שמור לסטודיו 📌" button on every generated card, table, or summary for future reference.
 * - Real-time live synchronization with StudioPanel via custom events and local storage fallback.
 * - Easy Client vs. General Mode Selector (dropdown with search & instant navigation).
 * - Multi-Session Chat History per client / global with "+ שיחה חדשה" button.
 * - Slide-over History Drawer to view, restore, and manage past conversations.
 * - Automatic cloud synchronization with Supabase & fast local caching.
 * - Citation rendering ([מקור: ...] → clickable interactive badges).
 * - Confirmation Gate UI with rich preview cards & execution controls.
 * - Tool execution feedback with live status indicators.
 * - Hebrew voice input (Speech-to-Text with useVoiceInput hook).
 * - Quick prompt chips contextual to mode.
 * - Auto-execution of queued prompts triggered from SourcesPanel.
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import {
  Bot,
  Send,
  Mic,
  MicOff,
  Sparkles,
  RefreshCw,
  Loader2,
  Cpu,
  CheckCircle2,
  User,
  Layers,
  Mail,
  Calendar,
  DollarSign,
  Table,
  Table2,
  ClipboardCheck,
  Plus,
  History,
  Trash2,
  ChevronDown,
  Check,
  Search,
  Globe,
  Building2,
  X,
  MessageSquare,
  Clock,
  BookmarkPlus,
  Copy,
  Zap,
  BookOpen,
  BarChart3,
  Maximize2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Sun,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { useVoiceInput } from '@/hooks/useVoiceInput'
import { CitationText, type Citation } from '@/components/notebook/CitationBadge'
import { ArtifactVisualRenderer } from '@/components/notebook/ArtifactVisualRenderer'
import {
  fetchClientChatHistoryAction,
  saveClientChatMessagesAction,
} from '@/app/workspace/actions/chat-history'
import { saveStudioArtifactAction } from '@/app/workspace/actions/artifacts'
import type { ArtifactType, StudioArtifact } from '@/components/notebook/StudioPanel'
import { DailyBriefModal } from '@/components/notebook/DailyBriefModal'
import { AgentTasksModal } from '@/components/notebook/AgentTasksModal'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ChatSession {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messages: any[]
}

interface NotebookChatProps {
  clientId?: string
  clientName?: string
  clients?: Array<{ id: string; name: string }>
  mode: 'client' | 'global'
  queuedPrompt?: string | null
  onClearQueuedPrompt?: () => void
  onCitationClick?: (citation: Citation) => void
  showSources?: boolean
  onToggleSources?: () => void
  showStudio?: boolean
  onToggleStudio?: () => void
}

type DetailMode = 'expanded' | 'brief'

// ── Quick Prompt Chips & Categories ───────────────────────────────────────────

export type PromptCategory = 'all' | 'finance' | 'ops' | 'tasks' | 'emails' | 'strategy'

export interface QuickPromptItem {
  icon: React.ElementType
  label: string
  prompt: string
  category: 'finance' | 'ops' | 'tasks' | 'emails' | 'strategy'
}

export const CATEGORY_TABS: Array<{ id: PromptCategory; label: string }> = [
  { id: 'all', label: 'הכל ✨' },
  { id: 'finance', label: 'פיננסי 💰' },
  { id: 'ops', label: 'תפעולי 📅' },
  { id: 'tasks', label: 'משימות 📋' },
  { id: 'emails', label: 'מיילים ✉️' },
  { id: 'strategy', label: 'אסטרטגיה 🎯' },
]

export const SMART_QUICK_ACTIONS = [
  { icon: '📊', label: 'סכם דשבורד לקוח מלא', prompt: 'סכם לי את הדשבורד של הלקוח עם כל הווידג\'טים, כרטיסי ה-KPI ונתוני האמת מהגיליון.' },
  { icon: '🤖', label: 'תזמן בדיקת בוקר יומית', prompt: 'תזמן לסוכן משימה יומית קבועה לעבור כל בוקר ב-08:00 על המיילים הדחופים ולסכם אותם במחברת.' },
  { icon: '📊', label: 'הפק דוח KPI פיננסי מלא עם תרשים', prompt: 'הפק דוח KPI פיננסי מלא עם כרטיס מדדים, תרשים עמודות chart:bar וטבלת הכנסות והוצאות מפורטת.' },
  { icon: '📅', label: 'הצג סדר יום ופגישות קרובות', prompt: 'הצג לי את סדר היום, פגישות מתוכננות ואירועים דחופים ביומן בכרטיס אג\'נדה מעוצב.' },
  { icon: '📋', label: 'סכם משימות ושגרות עבודה', prompt: 'סכם את כל המשימות הפתוחות והשגרות שדורשות ביצוע היום והשבוע בתוכנית פעולה.' },
  { icon: '✉️', label: 'סריקת מיילים וזיהוי דחופים', prompt: 'סרוק מיילים אחרונים, זהה הודעות שלא נענו וסכם מה דורש מענה דחוף.' },
  { icon: '📈', label: 'השוואת הכנסות מול הוצאות', prompt: 'הצג השוואה מדויקת של הכנסות מול הוצאות בטבלה ותרשים יחסים ויזואלי chart:bar.' },
  { icon: '📑', label: 'הפק סיכום מנהלים שבועי', prompt: 'הפק סיכום מנהלים תמציתי ומקיף עבור כל הפעילות העסקית, ההישגים והיעדים.' },
  { icon: '🔍', label: 'סריקת פערים וחריגות', prompt: 'בצע סריקה לאיתור חריגות, משימות בעיכוב, או מקורות מידע שאינם מסונכרנים.' },
  { icon: '⚡', label: 'תוכנית פעולה מואצת להיום', prompt: 'בנה תוכנית פעולה ממוקדת של 3-5 יעדים קריטיים להשלמה היום בפורמט checklist.' },
]

const CLIENT_QUICK_PROMPTS: QuickPromptItem[] = [
  { icon: BarChart3,      label: 'סיכום דשבורד חי',    prompt: 'סכם לי את הדשבורד של הלקוח עם כל המדדים, התרשימים ונתוני האמת מהגיליון.', category: 'finance' },
  { icon: DollarSign,     label: 'כרטיס KPI ותרשים',  prompt: 'הפק כרטיס KPI פיננסי מעוצב עם מדדי מפתח ותרשים עמודות chart:bar של הכנסות, הוצאות ורווח מהגיליון.', category: 'finance' },
  { icon: Table,          label: 'ניתוח גיליון בטבלה', prompt: 'נתח לי את הגיליון הראשי — הכנסות, הוצאות ותזרים בטבלה מפורטת עם כרטיס מדדים.', category: 'finance' },
  { icon: ClipboardCheck, label: 'משימות ושגרות',      prompt: 'אילו משימות ושגרות קבועות מגיעות היום או השבוע עבור הלקוח הזה? הצג כתוכנית עבודה.', category: 'tasks' },
  { icon: Mail,           label: 'מיילים אחרונים',    prompt: 'סרוק את המיילים האחרונים של הלקוח וסכם מה דורש מענה מיידי.', category: 'emails' },
  { icon: Calendar,       label: 'פגישות קרובות',     prompt: 'מה הפגישות הקרובות עם הלקוח הזה ביומן?', category: 'ops' },
  { icon: Layers,         label: 'סטטוס מקורות 360°', prompt: 'הצג לי סיכום מצב של כל המקורות והנתונים המחוברים של הלקוח בכרטיס מסודר.', category: 'ops' },
  { icon: Sparkles,       label: 'יעדי צמיחה ואסטרטגיה', prompt: 'מהם יעדי הצמיחה המוגדרים ללקוח ומה מצב העמידה בהם נכון להיום?', category: 'strategy' },
]

const GLOBAL_QUICK_PROMPTS: QuickPromptItem[] = [
  { icon: DollarSign,     label: 'כספי סוכנות ותרשים', prompt: 'הצג כרטיס מדדים פיננסי רוחבי של פעילות הסוכנות וההכנסות החודשיות עם תרשים עמודות chart:bar.', category: 'finance' },
  { icon: Building2,      label: 'טבלת כל הלקוחות',   prompt: 'הצג טבלה מסודרת של כל הלקוחות במערכת עם סטטוס, מייל וקישורים.', category: 'ops' },
  { icon: ClipboardCheck, label: 'כלל המשימות',       prompt: 'הצג את כל משימות ושגרות העבודה הפתוחות בכלל המשרד להיום ולשבוע.', category: 'tasks' },
  { icon: Calendar,       label: 'סדר יום ביומן',     prompt: 'הצג לי את סדר היום והפגישות המתוכננות להיום ביומן בכרטיס אג\'נדה.', category: 'ops' },
  { icon: Mail,           label: 'מיילים דחופים',     prompt: 'בדוק מיילים חדשים שלא נקראו וסכם מה דורש התייחסות דחופה.', category: 'emails' },
  { icon: Sparkles,       label: 'סקירה עסקית רוחבית', prompt: 'סכם את הפעילות העסקית המרכזית, פערים עיקריים ויעדים להמשך השבוע.', category: 'strategy' },
]

// ── Tool Labels ────────────────────────────────────────────────────────────────

const TOOL_LABELS: Record<string, string> = {
  get_client_overview: 'סיכום לקוח 360°',
  list_all_clients: 'שליפת רשימת לקוחות',
  create_new_client: 'הוספת לקוח חדש',
  update_client_details: 'עדכון פרטי לקוח',
  lookup_client_sheet: 'קריאת גיליון',
  inspect_client_spreadsheet: 'ניתוח גיליון מעמיק',
  create_client_spreadsheet: 'יצירת גיליון חדש',
  append_data_to_client_sheet: 'הזנת נתונים',
  update_client_sheet_range: 'עדכון תאים',
  create_client_drive_folder: 'יצירת תיקיית Drive',
  check_unread_emails: 'סריקת מיילים',
  search_emails: 'חיפוש מיילים',
  send_email: 'שליחת אימייל',
  reply_to_email: 'מענה לאימייל',
  trash_email_thread: 'מחיקת שרשור',
  label_email_thread: 'סיווג תווית',
  get_workspace_tasks: 'שליפת משימות',
  create_or_update_workspace_task: 'יצירה/עדכון משימה',
  delete_workspace_task: 'מחיקת משימה',
  get_daily_operational_agenda: 'סדר יום תפעולי',
  get_client_ecosystem_overview: 'אקוסיסטם לקוח',
  record_client_goal: 'הגדרת יעד צמיחה',
  get_agency_finance_summary: 'כספי הסוכנות',
  get_calendar_overview: 'סריקת יומן',
  create_calendar_event: 'קביעת פגישה',
  get_notebook_sources_status: 'סטטוס מקורות',
  save_to_studio: 'שמירה לסטודיו 📌',
  get_client_dashboard_overview: 'ניתוח דשבורד לקוח 📊',
  schedule_agent_task: 'תזמון משימת סוכן 🤖',
  list_agent_scheduled_tasks: 'בדיקת משימות סוכן 📋',
  manage_agent_scheduled_task: 'ניהול משימת סוכן ⚙️',
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatSessionDate(isoString: string): string {
  try {
    const d = new Date(isoString)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const isYesterday = d.toDateString() === yesterday.toDateString()

    const timeStr = d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
    if (isToday) return `היום ב-${timeStr}`
    if (isYesterday) return `אתמול ב-${timeStr}`
    return `${d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })} ב-${timeStr}`
  } catch {
    return ''
  }
}

function extractSessionTitle(msgs: any[], fallback: string = 'שיחה חדשה'): string {
  for (const m of msgs) {
    if (m.role === 'user') {
      let text = ''
      if (typeof m.content === 'string') text = m.content
      else if (Array.isArray(m.parts)) {
        text = m.parts
          .filter((p: any) => p && p.type === 'text')
          .map((p: any) => p.text || '')
          .join(' ')
      }
      text = text.trim()
      if (text) {
        return text.length > 34 ? `${text.slice(0, 34)}...` : text
      }
    }
  }
  return fallback
}

function createWelcomeMessage(mode: 'client' | 'global', clientName?: string) {
  const welcomeText = mode === 'client' && clientName
    ? `שלום נחמיה! אני מוכן לעבוד על תיק הלקוח **${clientName}**. כל המקורות המחוברים זמינים לי — שאל כל שאלה ואני אחפש, אנתח, אציג כרטיסי מידע וטבלאות עם ציטוטים מדויקים.`
    : 'שלום נחמיה! אני הסוכן הגלובלי שלך. כל הלקוחות, הגיליונות, המיילים והיומן מחוברים אליי. שאל כל שאלה ואציג סיכומים, כרטיסים וטבלאות עם מקורות.'
  return {
    id: `welcome_${Date.now()}`,
    role: 'assistant',
    parts: [{ type: 'text', text: welcomeText }],
  }
}

// ── Main NotebookChat Component ────────────────────────────────────────────────

export function NotebookChat({
  clientId,
  clientName,
  clients = [],
  mode,
  queuedPrompt,
  onClearQueuedPrompt,
  onCitationClick,
  showSources,
  onToggleSources,
  showStudio,
  onToggleStudio,
}: NotebookChatProps) {
  const router = useRouter()
  const [input, setInput] = useState('')
  const [clientFilterSearch, setClientFilterSearch] = useState('')
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [savedArtifactIds, setSavedArtifactIds] = useState<Set<string>>(new Set())

  // Modals for Morning Brief and Autonomous Agent Tasks
  const [showDailyBriefModal, setShowDailyBriefModal] = useState(false)
  const [showAgentTasksModal, setShowAgentTasksModal] = useState(false)

  // 2 Conversation Modes: Expanded vs. Brief
  const [detailMode, setDetailMode] = useState<DetailMode>('expanded')

  // Load detail mode preference from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('nehemiah_notebook_detail_mode')
      if (saved === 'expanded' || saved === 'brief') {
        setDetailMode(saved as DetailMode)
      }
    } catch {}
  }, [])

  const handleDetailModeChange = (newMode: DetailMode) => {
    setDetailMode(newMode)
    try {
      localStorage.setItem('nehemiah_notebook_detail_mode', newMode)
    } catch {}
    toast.info(
      newMode === 'expanded'
        ? 'עברת למצב שיחה מורחב ומעמיק 📖'
        : 'עברת למצב שיחה קצר ותמציתי ⚡'
    )
  }

  // Multi-session state
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string>('')
  const isSwitchingSessionRef = useRef(false)
  const isInitialLoadDoneRef = useRef(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const storageKey = useMemo(() => {
    return clientId
      ? `nehemiah_v3_chat_sessions_${clientId}`
      : 'nehemiah_v3_chat_sessions_global'
  }, [clientId])

  const activeSessionKey = useMemo(() => `${storageKey}_active`, [storageKey])

  // Chat transport — routes to global chat API with clientId, mode & detailMode
  const transport = useMemo(() => {
    const params = new URLSearchParams()
    if (clientId) params.set('clientId', clientId)
    params.set('mode', mode)
    params.set('detailMode', detailMode)
    const queryString = params.toString()
    return new DefaultChatTransport({
      api: `/api/workspace/global-chat${queryString ? `?${queryString}` : ''}`,
    })
  }, [clientId, mode, detailMode])

  const { messages, setMessages, sendMessage, status, error } = useChat({
    transport,
    onError: (err) => {
      toast.error(`שגיאת AI: ${err.message}`)
    },
  })

  const isLoading = status === 'streaming' || status === 'submitted'

  // ── 1. Load Sessions on Mount or Mode/Client change ──────────────────────────
  useEffect(() => {
    isInitialLoadDoneRef.current = false

    async function initSessions() {
      let loadedSessions: ChatSession[] = []
      try {
        const raw = localStorage.getItem(storageKey)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed) && parsed.length > 0) {
            loadedSessions = parsed
          }
        }
      } catch {
        // ignore storage parse error
      }

      // If no local sessions exist for this client, check Supabase history
      if (loadedSessions.length === 0 && clientId) {
        try {
          const cloudRes = await fetchClientChatHistoryAction(clientId)
          if (cloudRes.success && cloudRes.messages && cloudRes.messages.length > 0) {
            const title = extractSessionTitle(cloudRes.messages, 'שיחה קודמת')
            const reconstructedSession: ChatSession = {
              id: `sess_cloud_${Date.now()}`,
              title,
              createdAt: cloudRes.messages[0]?.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              messages: cloudRes.messages,
            }
            loadedSessions = [reconstructedSession]
          }
        } catch (e) {
          console.warn('[NotebookChat] Cloud history fetch failed:', e)
        }
      }

      // If still empty, create default welcome session
      if (loadedSessions.length === 0) {
        const welcome = createWelcomeMessage(mode, clientName)
        const defaultSession: ChatSession = {
          id: `sess_${Date.now()}`,
          title: 'שיחה חדשה',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: [welcome],
        }
        loadedSessions = [defaultSession]
      }

      // Determine active session
      const savedActiveId = localStorage.getItem(activeSessionKey)
      const targetSession =
        loadedSessions.find((s) => s.id === savedActiveId) || loadedSessions[0]

      setSessions(loadedSessions)
      setActiveSessionId(targetSession.id)
      isSwitchingSessionRef.current = true
      setMessages(targetSession.messages as any)
      localStorage.setItem(storageKey, JSON.stringify(loadedSessions))
      localStorage.setItem(activeSessionKey, targetSession.id)
      isInitialLoadDoneRef.current = true
    }

    initSessions()
  }, [storageKey, activeSessionKey, clientId, mode, clientName, setMessages])

  // ── 2. Sync Active Session Messages ──────────────────────────────────────────
  useEffect(() => {
    if (!isInitialLoadDoneRef.current || !activeSessionId) return

    if (isSwitchingSessionRef.current) {
      isSwitchingSessionRef.current = false
      return
    }

    if (messages.length === 0) return

    setSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === activeSessionId)
      if (idx === -1) return prev

      const current = prev[idx]
      let title = current.title
      if (title === 'שיחה חדשה' || !title) {
        title = extractSessionTitle(messages, 'שיחה חדשה')
      }

      const updatedSession: ChatSession = {
        ...current,
        title,
        updatedAt: new Date().toISOString(),
        messages: messages as any[],
      }

      const next = [...prev]
      next[idx] = updatedSession

      try {
        localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {}

      return next
    })

    // Cloud synchronization for client mode when streaming finishes
    if (!isLoading && clientId) {
      saveClientChatMessagesAction(clientId, messages).catch((err) => {
        console.warn('[NotebookChat] Cloud sync error:', err)
      })
    }
  }, [messages, activeSessionId, storageKey, isLoading, clientId])

  // ── 3. Handle Queued Prompts from SourcesPanel ───────────────────────────────
  useEffect(() => {
    if (queuedPrompt && queuedPrompt.trim()) {
      const promptText = queuedPrompt.trim()
      onClearQueuedPrompt?.()
      handleSend(promptText)
      toast.info('נשלחה שאילתת מקור לסוכן')
    }
  }, [queuedPrompt, onClearQueuedPrompt]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 4. Save to Studio Action Handler ─────────────────────────────────────────
  const handleSaveArtifactToStudio = useCallback(
    async (rawTitle: string, artifactType: ArtifactType, contentMd: string) => {
      try {
        const cleanTitle =
          rawTitle
            .replace(/^[#\s*:\-–—\p{Extended_Pictographic}\uFE0F]+/u, '')
            .replace(/[\uD800-\uDFFF\uFFFD]/g, '')
            .trim() ||
          (artifactType === 'table'
            ? 'טבלת נתונים'
            : artifactType === 'action_plan'
            ? 'תוכנית פעולה'
            : 'כרטיס מדדים')

        const newId = typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c: any) =>
              (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
            )

        const newArtifact: StudioArtifact = {
          id: newId,
          type: artifactType,
          title: cleanTitle,
          contentMd,
          preview: contentMd.slice(0, 160),
          createdAt: new Date().toISOString(),
          isPinned: false,
        }

        // 1. Store in localStorage for instant offline/resilient persistence
        const localKey = `nehemiah_v3_local_artifacts_${clientId || 'global'}`
        try {
          const stored = localStorage.getItem(localKey)
          const parsed = stored ? JSON.parse(stored) : []
          const next = [newArtifact, ...parsed]
          localStorage.setItem(localKey, JSON.stringify(next))
        } catch {}

        // 2. Dispatch custom event so StudioPanel updates INSTANTLY
        window.dispatchEvent(
          new CustomEvent('nehemiah_artifact_saved', { detail: newArtifact })
        )

        // 3. Sync to Supabase via server action with matching UUID
        saveStudioArtifactAction({
          id: newId,
          clientId: clientId || null,
          artifactType,
          title: cleanTitle,
          contentMd,
        }).catch((err) => {
          console.warn('[NotebookChat] Supabase save notice:', err)
        })

        setSavedArtifactIds((prev) => new Set([...prev, cleanTitle]))
        toast.success(`התוצר "${cleanTitle}" נשמר בסטודיו בהצלחה! 📌`)
      } catch (err: any) {
        toast.error(`שגיאה בשמירה: ${err.message}`)
      }
    },
    [clientId]
  )

  // ── 5. Multi-session Handlers ────────────────────────────────────────────────

  // Start new chat session
  const handleNewChat = useCallback(() => {
    const newId = `sess_${Date.now()}`
    const welcome = createWelcomeMessage(mode, clientName)
    const newSession: ChatSession = {
      id: newId,
      title: 'שיחה חדשה',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [welcome],
    }

    setSessions((prev) => {
      const next = [newSession, ...prev]
      try {
        localStorage.setItem(storageKey, JSON.stringify(next))
        localStorage.setItem(activeSessionKey, newId)
      } catch {}
      return next
    })

    setActiveSessionId(newId)
    isSwitchingSessionRef.current = true
    setMessages([welcome] as any)
    setIsHistoryOpen(false)
    toast.success('נפתחה שיחה חדשה')
  }, [mode, clientName, storageKey, activeSessionKey, setMessages])

  // Switch to an existing session
  const handleSelectSession = useCallback(
    (sessionId: string) => {
      if (sessionId === activeSessionId) {
        setIsHistoryOpen(false)
        return
      }

      const target = sessions.find((s) => s.id === sessionId)
      if (!target) return

      setActiveSessionId(sessionId)
      isSwitchingSessionRef.current = true
      setMessages(target.messages as any)
      try {
        localStorage.setItem(activeSessionKey, sessionId)
      } catch {}
      setIsHistoryOpen(false)
      toast.success(`נטענה שיחה: ${target.title}`)
    },
    [activeSessionId, sessions, activeSessionKey, setMessages]
  )

  // Delete a session
  const handleDeleteSession = useCallback(
    (e: React.MouseEvent, sessionId: string) => {
      e.stopPropagation()
      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== sessionId)

        if (sessionId === activeSessionId) {
          if (next.length > 0) {
            const nextActive = next[0]
            setActiveSessionId(nextActive.id)
            isSwitchingSessionRef.current = true
            setMessages(nextActive.messages as any)
            try {
              localStorage.setItem(activeSessionKey, nextActive.id)
            } catch {}
          } else {
            const welcome = createWelcomeMessage(mode, clientName)
            const fresh: ChatSession = {
              id: `sess_${Date.now()}`,
              title: 'שיחה חדשה',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              messages: [welcome],
            }
            next.push(fresh)
            setActiveSessionId(fresh.id)
            isSwitchingSessionRef.current = true
            setMessages([welcome] as any)
            try {
              localStorage.setItem(activeSessionKey, fresh.id)
            } catch {}
          }
        }

        try {
          localStorage.setItem(storageKey, JSON.stringify(next))
        } catch {}
        return next
      })
      toast.info('השיחה נמחקה')
    },
    [activeSessionId, activeSessionKey, storageKey, mode, clientName, setMessages]
  )

  // ── 6. Hebrew Voice Input ────────────────────────────────────────────────────
  const { isListening, isSupported: isVoiceSupported, toggleListening } = useVoiceInput({
    lang: 'he-IL',
    onResult: (transcript) => {
      setInput((prev) => (prev ? `${prev} ${transcript}` : transcript))
    },
    onError: (errMsg) => {
      toast.error(errMsg)
    },
  })

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Send message
  const handleSend = useCallback(
    async (textToSend?: string) => {
      const text = (textToSend ?? input).trim()
      if (!text || isLoading) return
      setInput('')
      try {
        await sendMessage({ text })
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'שגיאה בשליחת בקשה')
      }
    },
    [input, isLoading, sendMessage]
  )

  // Keyboard: Enter to send, Shift+Enter for newline
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [input])

  // Filter clients for dropdown
  const filteredClients = useMemo(() => {
    if (!clientFilterSearch.trim()) return clients
    return clients.filter((c) =>
      c.name.toLowerCase().includes(clientFilterSearch.toLowerCase())
    )
  }, [clients, clientFilterSearch])

  const [selectedPromptCategory, setSelectedPromptCategory] = useState<PromptCategory>('all')

  const baseQuickPrompts = mode === 'client' ? CLIENT_QUICK_PROMPTS : GLOBAL_QUICK_PROMPTS
  const quickPrompts = useMemo(() => {
    if (selectedPromptCategory === 'all') return baseQuickPrompts
    return baseQuickPrompts.filter((p) => p.category === selectedPromptCategory)
  }, [baseQuickPrompts, selectedPromptCategory])

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden relative" dir="rtl">
      {/* ── Top Header with Mode Selector, 2-Mode Detail Toggle & Chat Actions ── */}
      <div className="px-4 py-2.5 border-b border-border/70 bg-card/70 backdrop-blur-md shrink-0 flex items-center justify-between gap-2.5 shadow-xs">
        {/* Right side (in RTL): Panel Toggle (Sources) + Agent Icon + Context & Client Switcher */}
        <div className="flex items-center gap-2 min-w-0">
          {onToggleSources && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onToggleSources}
              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/80 shrink-0 cursor-pointer"
              title={showSources ? 'הסתר פאנל מקורות' : 'הצג פאנל מקורות'}
            >
              {showSources ? (
                <PanelRightClose className="w-4 h-4" />
              ) : (
                <PanelRightOpen className="w-4 h-4 text-indigo-500" />
              )}
            </Button>
          )}

          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0">
            <Bot className="w-4 h-4" />
          </div>

          {/* Mode & Client Dropdown Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 px-2.5 text-xs font-bold border-border/80 hover:border-indigo-400 bg-background/80 hover:bg-muted/80 shadow-2xs transition-all max-w-[170px] sm:max-w-[240px]"
              >
                {mode === 'client' ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                    <span className="truncate text-foreground">
                      {clientName || 'לקוח'}
                    </span>
                  </>
                ) : (
                  <>
                    <Globe className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span className="truncate text-foreground font-bold">
                      שיחה כללית
                    </span>
                  </>
                )}
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="start" className="w-64 p-1.5 space-y-1" dir="rtl">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-[11px] font-bold text-muted-foreground px-2 py-1">
                  בחר הקשר שיחה ומחברת:
                </DropdownMenuLabel>

                <DropdownMenuItem
                  onClick={() => router.push('/workspace/notebook')}
                  className={`flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer text-xs ${
                    mode === 'global' ? 'bg-indigo-50 dark:bg-indigo-950/50 font-bold text-indigo-600' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                      <Globe className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="leading-tight">שיחה כללית (כלל הסוכנות)</p>
                      <p className="text-[10px] text-muted-foreground font-normal">
                        רוחבי לכלל הלקוחות, יומן ומשימות
                      </p>
                    </div>
                  </div>
                  {mode === 'global' && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                </DropdownMenuItem>
              </DropdownMenuGroup>

              <DropdownMenuSeparator />

              <div className="px-2 pt-1 pb-1 flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted-foreground">
                  מחברת לקוח ממוקדת:
                </span>
                <span className="text-[10px] text-muted-foreground/70">
                  {clients.length} לקוחות
                </span>
              </div>

              {clients.length > 5 && (
                <div className="px-1.5 pb-1">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute right-2.5 top-2 text-muted-foreground" />
                    <Input
                      placeholder="חיפוש לקוח..."
                      value={clientFilterSearch}
                      onChange={(e) => setClientFilterSearch(e.target.value)}
                      className="h-7 text-xs pr-8 bg-muted/40 border-border/50"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
              )}

              <div className="max-h-52 overflow-y-auto space-y-0.5">
                {filteredClients.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground text-center py-2">
                    לא נמצאו לקוחות
                  </p>
                ) : (
                  filteredClients.map((c) => {
                    const isSelected = mode === 'client' && clientId === c.id
                    return (
                      <DropdownMenuItem
                        key={c.id}
                        onClick={() => router.push(`/workspace/clients/${c.id}/notebook`)}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer text-xs ${
                          isSelected ? 'bg-emerald-50 dark:bg-emerald-950/40 font-bold text-emerald-700 dark:text-emerald-400' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 text-[10px] font-bold ${
                            isSelected ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground'
                          }`}>
                            {c.name.slice(0, 1)}
                          </div>
                          <span className="truncate">{c.name}</span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                      </DropdownMenuItem>
                    )
                  })
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Center: 2 Conversation Modes Toggle (מורחב / קצר) */}
        <div className="flex items-center bg-muted/70 p-0.5 rounded-lg border border-border/60 text-[11px] font-semibold shrink-0">
          <button
            type="button"
            onClick={() => handleDetailModeChange('expanded')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
              detailMode === 'expanded'
                ? 'bg-indigo-600 text-white shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="מצב מורחב: תשובות מפורטות, ניתוחים עמוקים, כרטיסים וטבלאות מלאות"
          >
            <BookOpen className="w-3 h-3" />
            <span className="hidden sm:inline">מצב מורחב</span>
            <span className="sm:hidden">מורחב</span>
          </button>
          <button
            type="button"
            onClick={() => handleDetailModeChange('brief')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
              detailMode === 'brief'
                ? 'bg-indigo-600 text-white shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="מצב קצר: תמציתי, שורה תחתונה, מספרים קריטיים ו-2-4 נקודות מפתח"
          >
            <Zap className="w-3 h-3" />
            <span className="hidden sm:inline">מצב קצר</span>
            <span className="sm:hidden">קצר</span>
          </button>
        </div>

        {/* Left side (in RTL): Action Buttons: "+ שיחה חדשה", "היסטוריה" + Panel Toggle (Studio) */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowDailyBriefModal(true)}
            className="h-8 gap-1 px-2 sm:px-2.5 text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30 shadow-2xs cursor-pointer"
            title="בריף בוקר יומי (מצב משימות, יומן, דוא״ל והודעות)"
          >
            <Sun className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="hidden xl:inline">בריף בוקר</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowAgentTasksModal(true)}
            className="h-8 gap-1 px-2 sm:px-2.5 text-xs font-semibold bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30 shadow-2xs cursor-pointer"
            title="משימות ושגרות אוטונומיות לסוכן AI"
          >
            <Bot className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
            <span className="hidden xl:inline">משימות סוכן</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleNewChat}
            className="h-8 gap-1 px-2 sm:px-2.5 text-xs font-semibold bg-indigo-50/60 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-800 shadow-2xs cursor-pointer"
            title="התחל שיחה חדשה"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden md:inline">שיחה חדשה</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsHistoryOpen((v) => !v)}
            className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground relative px-2 cursor-pointer"
            title="היסטוריית שיחות שמורות"
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">היסטוריה</span>
            {sessions.length > 0 && (
              <Badge
                variant="secondary"
                className="text-[10px] px-1 py-0 h-4 bg-muted font-bold"
              >
                {sessions.length}
              </Badge>
            )}
          </Button>

          {onToggleStudio && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onToggleStudio}
              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/80 shrink-0 cursor-pointer"
              title={showStudio ? 'הסתר פאנל סטודיו' : 'הצג פאנל סטודיו'}
            >
              {showStudio ? (
                <PanelLeftClose className="w-4 h-4" />
              ) : (
                <PanelLeftOpen className="w-4 h-4 text-violet-500" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* ── Slide-over History Panel ────────────────────────────────────── */}
      {isHistoryOpen && (
        <div
          className="absolute inset-0 z-30 bg-black/40 backdrop-blur-xs flex justify-end"
          onClick={() => setIsHistoryOpen(false)}
        >
          <div
            className="w-80 max-w-[85%] h-full bg-card border-r border-border shadow-2xl flex flex-col animate-in slide-in-from-left duration-200 z-40"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-500" />
                <div>
                  <h3 className="text-xs font-black text-foreground">היסטוריית שיחות</h3>
                  <p className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                    {mode === 'client' ? clientName : 'שיחות כלליות'}
                  </p>
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => setIsHistoryOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-3 border-b border-border/50 bg-muted/10">
              <Button
                size="sm"
                onClick={handleNewChat}
                className="w-full h-8 text-xs font-bold gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                התחל שיחה חדשה
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {sessions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-xs">
                  אין עדיין שיחות שמורות
                </div>
              ) : (
                sessions.map((sess) => {
                  const isActive = sess.id === activeSessionId
                  return (
                    <div
                      key={sess.id}
                      onClick={() => handleSelectSession(sess.id)}
                      className={`group flex items-center justify-between p-2.5 rounded-xl border text-right cursor-pointer transition-all ${
                        isActive
                          ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-900 dark:text-indigo-200 shadow-2xs'
                          : 'bg-card hover:bg-muted/50 border-border/50 text-foreground'
                      }`}
                    >
                      <div className="flex-1 min-w-0 pr-1">
                        <div className="flex items-center gap-1.5">
                          <MessageSquare
                            className={`w-3.5 h-3.5 shrink-0 ${
                              isActive ? 'text-indigo-600' : 'text-muted-foreground'
                            }`}
                          />
                          <p className="text-xs font-bold truncate leading-tight">
                            {sess.title || 'שיחה ללא שם'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                          <Clock className="w-3 h-3 shrink-0 opacity-70" />
                          <span>{formatSessionDate(sess.updatedAt || sess.createdAt)}</span>
                          {sess.messages && (
                            <span>• {sess.messages.length} הודעות</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {isActive ? (
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1.5 py-0 bg-indigo-500/15 text-indigo-600 border-indigo-500/30"
                          >
                            פעיל
                          </Badge>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteSession(e, sess.id)}
                            title="מחק שיחה זו"
                            className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-600 text-muted-foreground transition-opacity"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Chat Messages ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6 space-y-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-xl shadow-indigo-500/25 ring-4 ring-indigo-500/20 animate-pulse">
                <Sparkles className="w-8 h-8" />
              </div>
              <span className="absolute -bottom-1 -left-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-background shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            </div>

            <div className="space-y-1.5 max-w-md">
              <h2 className="text-lg font-black text-foreground tracking-tight">
                {mode === 'client' ? `מחברת עבודה: ${clientName || 'לקוח'}` : 'סוכן עבודה חכם (כלל המערכת)'}
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {mode === 'client'
                  ? `כל המקורות, הגיליונות, המיילים והמסמכים של ${clientName || 'הלקוח'} מחוברים וזמינים לניתוח מעמיק ותרשימים גרפיים.`
                  : 'שאל שאלה רוחבית על לקוחות, גיליונות, סדר יום או משימות, והסוכן יפיק כרטיסים ותרשימים מעוצבים.'}
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Badge variant="outline" className="text-[11px] py-0.5 px-3 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30 font-bold">
                {detailMode === 'expanded' ? '📖 מצב מורחב ומעמיק' : '⚡ תקציר מנהלים קצר'}
              </Badge>
              <Badge variant="outline" className="text-[11px] py-0.5 px-3 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-bold">
                ✨ גרפיקה ותרשימים פעילים
              </Badge>
            </div>
          </div>
        )}

        {messages.map((m) => {
          const isUser = m.role === 'user'

          // Extract text + tool parts
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
          const hasStructuredContent =
            !isUser &&
            rawText.length > 50 &&
            (rawText.includes('|') ||
              rawText.includes('###') ||
              rawText.includes('**') ||
              rawText.includes('₪'))

          return (
            <div key={m.id} className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
              {/* Avatar */}
              <div className="relative shrink-0">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-md transition-all ${
                    isUser
                      ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white'
                      : 'bg-gradient-to-br from-indigo-500 via-purple-600 to-violet-700 text-white ring-2 ring-indigo-500/25 shadow-[0_0_12px_rgba(99,102,241,0.3)]'
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                </div>
                {!isUser && (
                  <span className="absolute -bottom-0.5 -left-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-background shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
                )}
              </div>

              {/* Bubble Container */}
              <div
                className={`max-w-[88%] sm:max-w-[82%] min-w-[120px] ${
                  isUser ? 'mr-auto' : 'ml-auto'
                }`}
              >
                <div
                  className={`rounded-2xl px-4 py-3 shadow-xs ${
                    isUser
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md rounded-tl-sm'
                      : 'bg-gradient-to-b from-card/95 via-card/85 to-background/95 border border-indigo-500/20 dark:border-indigo-500/30 text-foreground rounded-tr-sm shadow-sm backdrop-blur-md'
                  }`}
                >
                  {/* User message vs. Assistant Visual Content */}
                  {rawText && (
                    <div>
                      {isUser ? (
                        <div className="whitespace-pre-wrap leading-relaxed text-sm">
                          {rawText}
                        </div>
                      ) : (
                        <ArtifactVisualRenderer
                          content={rawText}
                          onCitationClick={onCitationClick}
                          onPromptClick={(prompt) => handleSend(prompt)}
                          onSaveArtifact={handleSaveArtifactToStudio}
                          showSaveButtons={true}
                        />
                      )}
                    </div>
                  )}

                  {/* Tool executions feedback */}
                  {toolParts.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/30 space-y-2">
                      {toolParts.map((tool: any, idx: number) => {
                        const rawToolName =
                          tool.toolName ||
                          tool.name ||
                          tool.toolInvocation?.toolName ||
                          'פעולה'
                        const toolName = TOOL_LABELS[rawToolName] || rawToolName
                        const resObj =
                          tool.result || tool.output || tool.toolInvocation?.result
                        const isPendingApproval =
                          resObj &&
                          typeof resObj === 'object' &&
                          resObj.pending &&
                          resObj.confirmationId
                        const isDone =
                          (tool.state === 'result' ||
                            tool.result !== undefined ||
                            tool.output !== undefined ||
                            !isLoading) &&
                          !isPendingApproval

                        return (
                          <div key={idx} className="space-y-1.5">
                            {/* Tool status bar */}
                            <div className="text-[11px] flex items-center gap-1.5 text-muted-foreground bg-muted/60 px-2.5 py-1.5 rounded-lg border border-border/40">
                              <Cpu className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                              <span>
                                פעולה: <strong className="text-foreground">{toolName}</strong>
                              </span>
                              {isPendingApproval ? (
                                <span className="text-amber-500 mr-auto font-bold text-[10px] bg-amber-500/10 px-1.5 py-0.5 rounded">
                                  ⏳ ממתין לאישורך
                                </span>
                              ) : isDone ? (
                                <span className="text-emerald-500 mr-auto font-bold flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> הושלם
                                </span>
                              ) : (
                                <span className="text-amber-500 mr-auto font-bold animate-pulse">
                                  מעבד...
                                </span>
                              )}
                            </div>

                            {/* Confirmation Gate Card */}
                            {isPendingApproval && (
                              <div className="p-3.5 bg-amber-500/8 border border-amber-500/25 rounded-xl space-y-2.5 text-right">
                                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-xs">
                                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                                  <span>אישור מפורש נדרש:</span>
                                </div>
                                <p className="text-xs text-foreground font-medium leading-relaxed">
                                  {resObj.confirmationMessage || 'האם לאשר את הפעולה הזו?'}
                                </p>
                                <div className="flex items-center gap-2 pt-1">
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="h-7 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1 cursor-pointer"
                                    onClick={() => {
                                      handleSend(
                                        `מאשר לבצע: ${
                                          resObj.confirmationMessage || toolName
                                        } [confirmationId: ${resObj.confirmationId}]`
                                      )
                                    }}
                                    disabled={isLoading}
                                  >
                                    <CheckCircle2 className="w-3 h-3" />
                                    אשר ובצע
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-3 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                                    onClick={() => handleSend('בטל את הפעולה')}
                                    disabled={isLoading}
                                  >
                                    ✕ בטל
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Assistant Message Action Footer: "שמור לסטודיו", "העתק" */}
                  {hasStructuredContent && (
                    <div className="mt-3 pt-2.5 border-t border-border/40 flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const inferredTitle =
                              rawText.match(/^###?\s+(.+)/m)?.[1]?.trim() ||
                              rawText.match(/\*\*([^*]+)\*\*/)?.[1]?.trim() ||
                              'סיכום שיחה'
                            const inferredType: ArtifactType = rawText.includes('| ---')
                              ? 'table'
                              : rawText.includes('### 📊') || rawText.includes('כרטיס')
                              ? 'card'
                              : rawText.includes('- [ ]') || rawText.includes('תוכנית')
                              ? 'action_plan'
                              : 'brief'
                            handleSaveArtifactToStudio(inferredTitle, inferredType, rawText)
                          }}
                          className="h-6 px-2.5 text-[10px] font-bold gap-1 bg-violet-500/10 hover:bg-violet-500/20 text-violet-700 dark:text-violet-300 border-violet-500/30 cursor-pointer shadow-2xs"
                        >
                          <BookmarkPlus className="w-3 h-3" />
                          <span>שמור לסטודיו 📌</span>
                        </Button>

                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const inferredTitle =
                              rawText.match(/^###?\s+(.+)/m)?.[1]?.trim() ||
                              rawText.match(/\*\*([^*]+)\*\*/)?.[1]?.trim() ||
                              'תצוגה מורחבת'
                            const cleanInferredTitle =
                              inferredTitle
                                .replace(/^[#\s*:\-–—\p{Extended_Pictographic}\uFE0F]+/u, '')
                                .replace(/[\uD800-\uDFFF\uFFFD]/g, '')
                                .trim() || 'תצוגה מורחבת'
                            const inferredType: ArtifactType = rawText.includes('| ---')
                              ? 'table'
                              : rawText.includes('### 📊') || rawText.includes('כרטיס')
                              ? 'card'
                              : rawText.includes('- [ ]') || rawText.includes('תוכנית')
                              ? 'action_plan'
                              : 'brief'
                            const previewArtifact: StudioArtifact = {
                              id: typeof crypto !== 'undefined' && crypto.randomUUID
                                ? crypto.randomUUID()
                                : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c: any) =>
                                    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
                                  ),
                              type: inferredType,
                              title: cleanInferredTitle,
                              contentMd: rawText,
                              createdAt: new Date().toISOString(),
                              isPinned: false,
                            }
                            window.dispatchEvent(
                              new CustomEvent('nehemiah_open_artifact_modal', {
                                detail: previewArtifact,
                              })
                            )
                          }}
                          className="h-6 px-2 text-[10px] font-bold gap-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-500/30 cursor-pointer shadow-2xs"
                          title="פתח בחלון קופץ רחב במסך גדול לתצוגה נוחה"
                        >
                          <Maximize2 className="w-3 h-3" />
                          <span>חלון רחב ⛶</span>
                        </Button>

                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(rawText)
                            toast.success('התוכן הועתק ללוח!')
                          }}
                          className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
                          title="העתק תוכן"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>

                      <span className="text-[10px] text-muted-foreground/70">
                        {detailMode === 'expanded' ? 'ניתוח מורחב 📖' : 'תקציר מנהלים ⚡'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2 text-muted-foreground text-xs bg-card border border-border/40 px-4 py-2.5 rounded-2xl rounded-tr-sm shadow-xs">
              <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
              <span>
                {detailMode === 'expanded'
                  ? 'הסוכן מנתח לעומק, מכין טבלאות וכרטיסי נתונים...'
                  : 'הסוכן מעבד תקציר מנהלים ממוקד שורה תחתונה...'}
              </span>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 text-xs">
            שגיאה: {error.message}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Category Tabs & Quick Prompts ───────────────────────────────── */}
      <div className="border-t border-border/40 bg-muted/15 shrink-0 px-3 py-2 space-y-1.5">
        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-0.5">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedPromptCategory(tab.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedPromptCategory === tab.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Quick Prompts for active category */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none py-0.5">
          {quickPrompts.map((item, idx) => {
            const Icon = item.icon
            return (
              <button
                key={idx}
                onClick={() => handleSend(item.prompt)}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-card/90 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/40 text-[11px] font-semibold text-muted-foreground border border-border/50 whitespace-nowrap transition-all cursor-pointer disabled:opacity-50 shadow-2xs hover:border-indigo-300 dark:hover:border-indigo-800"
              >
                <Icon className="w-3.5 h-3.5 text-indigo-500" />
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Input Area ────────────────────────────────────────────────── */}
      <div className="p-3 border-t border-border/70 bg-gradient-to-t from-background via-card/85 to-card/60 backdrop-blur-xl shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSend()
          }}
          className="flex items-end gap-2 bg-muted/50 rounded-2xl p-2 border border-border/60 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all shadow-sm"
        >
          {/* Quick Actions Dropdown Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 px-2 rounded-xl text-xs font-bold gap-1 text-indigo-700 dark:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 shrink-0 cursor-pointer shadow-2xs"
                title="פעולות ניהול מהירות לסוכן"
              >
                <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <span className="hidden md:inline">פעולות מהירות</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72 p-1.5 space-y-1">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-[11px] font-bold text-muted-foreground px-2 py-1 flex items-center justify-between">
                  <span>פעולות ניהול חכמות לסוכן</span>
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {SMART_QUICK_ACTIONS.map((action, aIdx) => (
                  <DropdownMenuItem
                    key={aIdx}
                    onClick={() => handleSend(action.prompt)}
                    className="flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer text-xs hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
                  >
                    <span className="text-base shrink-0">{action.icon}</span>
                    <span className="font-semibold text-foreground leading-tight">{action.label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Hebrew Voice Input */}
          {isVoiceSupported && (
            <div className="relative shrink-0">
              {isListening && (
                <span className="absolute inset-0 rounded-lg bg-red-500/30 animate-ping pointer-events-none" />
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={toggleListening}
                className={`relative h-9 w-9 rounded-xl shrink-0 transition-all ${
                  isListening
                    ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30 border border-red-500/50'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
                title={isListening ? 'עצור הקלטה' : 'הקלטה קולית בעברית'}
              >
                {isListening ? (
                  <MicOff className="w-4 h-4 text-red-500 animate-pulse" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </Button>
            </div>
          )}

          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isListening
                ? 'מאזין לך בעברית...'
                : detailMode === 'brief'
                ? 'שאל שאלה (מצב קצר — תשובה תמציתית וממוקדת שורה תחתונה)...'
                : mode === 'client'
                ? `שאל על ${clientName || 'הלקוח'} (מצב מורחב — ניתוח מלא, טבלאות וסיכומים רחבים)...`
                : 'שאל שאלה חוצת-לקוחות (מצב מורחב — ניתוח רוחבי ומקיף)...'
            }
            className="border-0 shadow-none focus-visible:ring-0 text-sm bg-transparent px-2 resize-none min-h-[36px] max-h-[120px]"
            disabled={isLoading}
            rows={1}
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

      {/* ── Daily Morning Brief Modal ────────────────────────────────── */}
      <DailyBriefModal
        open={showDailyBriefModal}
        onOpenChange={setShowDailyBriefModal}
        autoTriggerMorning={true}
      />

      {/* ── Autonomous Agent Scheduled Tasks Modal ──────────────────── */}
      <AgentTasksModal
        open={showAgentTasksModal}
        onOpenChange={setShowAgentTasksModal}
        clients={clients}
      />
    </div>
  )
}
