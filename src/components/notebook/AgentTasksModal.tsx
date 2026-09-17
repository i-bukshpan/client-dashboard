'use client'

/**
 * src/components/notebook/AgentTasksModal.tsx
 *
 * High-End Luxury FAANG-Grade Management Modal for Nehemiah's Autonomous AI Agent Tasks & Routines.
 * Features:
 * - Ultra-modern responsive layout with glassmorphism and crisp typography
 * - Instant Quick Presets bar (Morning scan, Calendar audit, Client review, Email reminders)
 * - Beautiful task cards with active glowing status pills, schedule chips, and action toolbars
 * - Full task execution viewer: Inline expansion toggle + Dedicated full-screen report modal
 * - Markdown & Visual Artifact rendering of execution results via ArtifactVisualRenderer
 * - Instant "העתק ללוח" and "שמור לסטודיו 📌" on any execution report
 * - 1-Click "הפעל עכשיו" with live progress spinner and instant refresh
 */

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Bot,
  Calendar,
  Clock,
  Play,
  Pause,
  Trash2,
  Plus,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Mail,
  CalendarDays,
  Search,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Copy,
  BookmarkPlus,
  Building2,
  X,
  Zap,
  ArrowRight,
  ExternalLink,
  Check,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getAgentTasksAction,
  createAgentTaskAction,
  deleteAgentTaskAction,
  toggleAgentTaskAction,
  runAgentTaskNowAction,
} from '@/app/workspace/actions/agent-tasks'
import { saveStudioArtifactAction } from '@/app/workspace/actions/artifacts'
import { ArtifactVisualRenderer } from '@/components/notebook/ArtifactVisualRenderer'
import type { AgentScheduledTask, AgentTaskType, AgentTaskScheduleType } from '@/lib/v2/agent-scheduler'

interface AgentTasksModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clients?: Array<{ id: string; name: string }>
}

const PRESETS: Array<{
  label: string
  icon: React.ElementType
  color: string
  badgeColor: string
  taskType: AgentTaskType
  title: string
  instruction: string
  defaultTime: string
}> = [
  {
    label: 'מעבר בוקר על מיילים ✉️',
    icon: Mail,
    color: 'border-rose-500/30 hover:border-rose-500/60 bg-rose-500/5 hover:bg-rose-500/10 text-rose-700 dark:text-rose-300',
    badgeColor: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
    taskType: 'check_emails',
    title: 'סריקת מיילים דחופים בוקר',
    instruction: 'סרוק את כל המיילים שלא נקראו בתיבת ה-Gmail, זהה הודעות דחופות מלקוחות או בקשות לתשלום ומסמכים, והפק סיכום מנהלים מתומצת של מה שדורש מענה מיידי היום.',
    defaultTime: '08:30',
  },
  {
    label: 'סריקת יומן ופגישות 📅',
    icon: CalendarDays,
    color: 'border-blue-500/30 hover:border-blue-500/60 bg-blue-500/5 hover:bg-blue-500/10 text-blue-700 dark:text-blue-300',
    badgeColor: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
    taskType: 'scan_calendar',
    title: 'סריקת יומן והכנה לפגישות היום',
    instruction: 'בדוק את כל האירועים והפגישות המתוכננים ביומן להיום. ודא לכל פגישה מי הלקוח המשתתף, מה הנושא, ורשום דגשים והכנות מוקדמות נדרשות.',
    defaultTime: '08:45',
  },
  {
    label: 'ביקורת תיק וגיליון לקוח 🔍',
    icon: FileSpreadsheet,
    color: 'border-emerald-500/30 hover:border-emerald-500/60 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    badgeColor: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    taskType: 'audit_client',
    title: 'ביקורת תזרים ויתרות בגיליון',
    instruction: 'קרא את נתוני ה-Google Sheets של הלקוח, בדוק את שורות ההכנסה וההוצאה האחרונות, חשב רווחיות נקייה, והתריע על חריגות או פערי גבייה פתוחים.',
    defaultTime: '09:00',
  },
  {
    label: 'שליחת מייל תזכורת יומית 📨',
    icon: Mail,
    color: 'border-indigo-500/30 hover:border-indigo-500/60 bg-indigo-500/5 hover:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
    badgeColor: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
    taskType: 'send_email',
    title: 'מייל תזכורת ועדכון ללקוח',
    instruction: 'נסח ושלח מייל תזכורת מקצועי ללקוח לגבי העברת מסמכים/חשבוניות חודשיות בהתאם לסטטוס התיק שלו.',
    defaultTime: '09:30',
  },
]

export function AgentTasksModal({ open, onOpenChange, clients = [] }: AgentTasksModalProps) {
  const [tasks, setTasks] = useState<AgentScheduledTask[]>([])
  const [loading, setLoading] = useState(true)
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)

  // Expanded inline tasks state (Set of task IDs)
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set())

  // Full report dialog state
  const [selectedTaskForFullReport, setSelectedTaskForFullReport] = useState<AgentScheduledTask | null>(null)
  const [savingToStudio, setSavingToStudio] = useState(false)

  // Form State
  const [title, setTitle] = useState('')
  const [instruction, setInstruction] = useState('')
  const [scheduleType, setScheduleType] = useState<AgentTaskScheduleType>('daily')
  const [scheduledTime, setScheduledTime] = useState('08:30')
  const [taskType, setTaskType] = useState<AgentTaskType>('custom_prompt')
  const [clientId, setClientId] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  const loadTasks = async () => {
    setLoading(true)
    try {
      const data = await getAgentTasksAction()
      setTasks(data)
    } catch {
      toast.error('שגיאה בטעינת משימות הסוכן')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      loadTasks()
    }
  }, [open])

  const toggleExpand = (taskId: string) => {
    setExpandedTaskIds((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  const handleApplyPreset = (preset: typeof PRESETS[0]) => {
    setTitle(preset.title)
    setInstruction(preset.instruction)
    setTaskType(preset.taskType)
    setScheduledTime(preset.defaultTime)
    setScheduleType('daily')
    setShowCreateForm(true)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !instruction.trim()) {
      toast.error('נא למלא כותרת והוראה לסוכן')
      return
    }

    setSubmitting(true)
    try {
      const res = await createAgentTaskAction({
        title,
        instruction,
        scheduleType,
        scheduledTime,
        taskType,
        clientId: clientId || null,
      })

      if (res.success && res.task) {
        toast.success(`המשימה "${title}" נקבעה בהצלחה לסוכן!`)
        setShowCreateForm(false)
        setTitle('')
        setInstruction('')
        loadTasks()
      } else {
        toast.error(res.error || 'שגיאה ביצירת המשימה')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggle = async (task: AgentScheduledTask) => {
    const newActive = !task.is_active
    try {
      await toggleAgentTaskAction(task.id, newActive)
      toast.success(newActive ? 'המשימה הופעלה' : 'המשימה הושהתה')
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, is_active: newActive } : t))
      )
    } catch {
      toast.error('שגיאה בשינוי סטטוס המשימה')
    }
  }

  const handleDelete = async (taskId: string, taskTitle: string) => {
    if (!confirm(`האם אתה בטוח שברצונך למחוק את משימת הסוכן "${taskTitle}"?`)) return
    try {
      await deleteAgentTaskAction(taskId)
      toast.success('המשימה נמחקה בהצלחה')
      setTasks((prev) => prev.filter((t) => t.id !== taskId))
    } catch {
      toast.error('שגיאה במחיקת המשימה')
    }
  }

  const handleRunNow = async (task: AgentScheduledTask) => {
    setRunningTaskId(task.id)
    toast.info(`הסוכן החל בביצוע משימת "${task.title}"...`, {
      description: 'הסוכן סורק נתונים, מפעיל כלים ומכין דוח פעולה מלא.',
    })

    try {
      const res = await runAgentTaskNowAction(task)
      if (res.success) {
        toast.success(`המשימה "${task.title}" הושלמה בהצלחה!`, {
          description: 'התוצאה המלאה זמינה כעת לצפייה.',
        })
        loadTasks()
        // Automatically open full report modal so Nehemiah can inspect immediately
        const updatedTask = {
          ...task,
          last_run_at: new Date().toISOString(),
          last_run_status: 'success' as const,
          last_run_result: {
            summary: res.summary || 'המשימה הושלמה בהצלחה.',
            executedAt: new Date().toISOString(),
          },
        }
        setSelectedTaskForFullReport(updatedTask)
      } else {
        toast.error(`ביצוע המשימה נכשל: ${res.error}`)
      }
    } catch (err: any) {
      toast.error(`שגיאה בהפעלת משימה: ${err.message}`)
    } finally {
      setRunningTaskId(null)
    }
  }

  const handleCopyText = (text: string) => {
    try {
      navigator.clipboard.writeText(text)
      toast.success('תוצאת המשימה הועתקה ללוח בהצלחה! 📋')
    } catch {
      toast.error('שגיאה בהעתקת הטקסט')
    }
  }

  const handleSaveReportToStudio = async (task: AgentScheduledTask) => {
    if (!task.last_run_result?.summary) return
    setSavingToStudio(true)
    try {
      const res = await saveStudioArtifactAction({
        clientId: task.client_id,
        artifactType: 'action_plan',
        title: `דוח ביצוע סוכן: ${task.title}`,
        contentMd: task.last_run_result.summary,
        metadata: {
          taskId: task.id,
          taskType: task.task_type,
          executedAt: task.last_run_at,
          savedFromTasksModal: true,
        },
      })
      if (res.success) {
        toast.success('הדוח נשמר בהצלחה בסטודיו של המחברת! 📌')
      } else {
        toast.error(res.error || 'שגיאה בשמירה לסטודיו')
      }
    } catch (err: any) {
      toast.error(`שגיאה: ${err.message}`)
    } finally {
      setSavingToStudio(false)
    }
  }

  const activeCount = tasks.filter((t) => t.is_active).length

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-5xl xl:max-w-6xl w-[95vw] h-[88vh] max-h-[850px] p-0 flex flex-col overflow-hidden bg-background/95 backdrop-blur-xl border border-border/80 shadow-2xl rounded-3xl"
          dir="rtl"
        >
          {/* Header */}
          <DialogHeader className="px-6 py-4 border-b border-border/80 bg-muted/30 shrink-0 flex flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30 shrink-0">
                <Bot className="w-5 h-5" />
              </div>
              <div className="text-right">
                <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2.5">
                  <span>משימות ושגרות אוטונומיות לסוכן AI</span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold text-xs border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {activeCount} שגרות פעילות
                  </span>
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  קבע לסוכן משימות קבועות (מיילים, יומן, דוחות, ביקורת לקוח) לביצוע אוטונומי מדויק
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => setShowCreateForm(!showCreateForm)}
                className={`text-xs gap-1.5 h-8.5 px-3.5 rounded-xl font-bold transition-all cursor-pointer shadow-xs ${
                  showCreateForm
                    ? 'bg-muted hover:bg-muted/80 text-foreground border border-border'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20'
                }`}
              >
                {showCreateForm ? (
                  <>
                    <ArrowRight className="w-3.5 h-3.5" />
                    חזרה לרשימת המשימות
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    משימה חדשה לסוכן
                  </>
                )}
              </Button>
            </div>
          </DialogHeader>

          {/* Quick Presets Bar (Always visible on top of tasks view) */}
          {!showCreateForm && (
            <div className="px-6 py-3 border-b border-border/50 bg-muted/15 shrink-0 flex items-center gap-2 overflow-x-auto scrollbar-none">
              <span className="text-[11px] font-bold text-muted-foreground shrink-0 flex items-center gap-1 ml-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                תבניות שגרה מהירות:
              </span>
              <div className="flex items-center gap-2">
                {PRESETS.map((p, idx) => {
                  const Icon = p.icon
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyPreset(p)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-semibold transition-all hover:scale-102 hover:shadow-xs cursor-pointer shrink-0 ${p.color}`}
                      title={`הגדר שגרה: ${p.instruction}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{p.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {showCreateForm ? (
              /* Creation Form */
              <form onSubmit={handleCreate} className="space-y-4 max-w-3xl mx-auto animate-in fade-in zoom-in-95 duration-150">
                <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-900/40 space-y-2.5">
                  <p className="text-xs font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    בחר תבנית מוכנה למילוי אוטומטי מהיר:
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {PRESETS.map((p, idx) => {
                      const Icon = p.icon
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleApplyPreset(p)}
                          className={`flex flex-col items-center text-center p-3 rounded-xl border text-xs font-semibold transition-all hover:scale-102 hover:shadow-xs cursor-pointer ${p.color}`}
                        >
                          <Icon className="w-4 h-4 mb-1" />
                          <span className="leading-tight">{p.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="space-y-3.5 bg-card/90 border border-border/80 p-5 rounded-2xl shadow-xs">
                  <div>
                    <label className="text-xs font-bold text-foreground block mb-1">
                      שם המשימה *
                    </label>
                    <Input
                      placeholder='למשל: "סריקת מיילים מיוסי בכל בוקר"'
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="text-xs h-9.5 bg-background rounded-xl"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-foreground block mb-1">
                      הוראת הביצוע לסוכן (מה עליו לבדוק, לחשב או לבצע?) *
                    </label>
                    <Textarea
                      placeholder="פרט לסוכן בדיוק מה לבדוק, מאילו מקורות (מיילים, גיליון, יומן) ואילו פעולות לנקוט..."
                      value={instruction}
                      onChange={(e) => setInstruction(e.target.value)}
                      rows={3}
                      className="text-xs bg-background resize-none rounded-xl"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div>
                      <label className="text-xs font-bold text-foreground block mb-1">
                        מחזוריות ביצוע
                      </label>
                      <select
                        value={scheduleType}
                        onChange={(e) => setScheduleType(e.target.value as any)}
                        className="w-full h-9.5 rounded-xl border border-input bg-background px-3 text-xs font-medium text-foreground"
                      >
                        <option value="daily">כל יום (יומי) 📅</option>
                        <option value="weekly">פעם בשבוע 🗓️</option>
                        <option value="once">חד-פעמי ⚡</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-foreground block mb-1">
                        שעת הביצוע
                      </label>
                      <Input
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        className="text-xs h-9.5 bg-background rounded-xl"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-foreground block mb-1">
                        שיוך ללקוח (אופציונלי)
                      </label>
                      <select
                        value={clientId}
                        onChange={(e) => setClientId(e.target.value)}
                        className="w-full h-9.5 rounded-xl border border-input bg-background px-3 text-xs font-medium text-foreground"
                      >
                        <option value="">כללי (כלל הסוכנות)</option>
                        {clients.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCreateForm(false)}
                    className="text-xs rounded-xl"
                  >
                    ביטול
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={submitting}
                    className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl px-4 shadow-xs"
                  >
                    {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'שמור וקבע משימה'}
                  </Button>
                </div>
              </form>
            ) : (
              /* Tasks List */
              <div className="space-y-3.5">
                {loading ? (
                  <div className="py-16 flex flex-col items-center justify-center text-muted-foreground gap-3">
                    <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
                    <p className="text-xs font-medium">טוען שגרות ומשימות סוכן...</p>
                  </div>
                ) : tasks.length === 0 ? (
                  <div className="py-16 text-center border border-dashed border-border/80 rounded-3xl p-8 bg-muted/10 space-y-3.5 max-w-lg mx-auto">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center mx-auto shadow-xs">
                      <Bot className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">אין משימות אוטונומיות מתוזמנות כרגע</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        קבע לסוכן משימות קבועות כגון סריקת מיילים בכל בוקר, בדיקת יומן, או מעקב שוטף אחרי תיקי לקוחות.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setShowCreateForm(true)}
                      className="text-xs gap-1.5 bg-indigo-600 text-white font-bold rounded-xl px-4 shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      קבע משימה ראשונה לסוכן
                    </Button>
                  </div>
                ) : (
                  tasks.map((task) => {
                    const isRunning = runningTaskId === task.id
                    const isExpanded = expandedTaskIds.has(task.id)
                    const hasResult = !!task.last_run_result?.summary

                    return (
                      <div
                        key={task.id}
                        className={`p-5 rounded-2xl border transition-all duration-200 space-y-3.5 ${
                          task.is_active
                            ? 'bg-card/95 border-border/80 hover:border-indigo-500/40 shadow-xs hover:shadow-md'
                            : 'bg-muted/15 border-border/50 opacity-75'
                        }`}
                      >
                        {/* Header Row: Title, Badges, Action Toolbar */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/50">
                          <div className="flex items-center gap-3 flex-wrap">
                            <div
                              className={`w-8.5 h-8.5 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                                task.is_active
                                  ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              <Bot className="w-4.5 h-4.5" />
                            </div>

                            <div>
                              <h4 className="text-sm font-bold text-foreground leading-tight">
                                {task.title}
                              </h4>
                              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                {/* Active Pill */}
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                    task.is_active
                                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                                      : 'bg-muted text-muted-foreground border border-border'
                                  }`}
                                >
                                  {task.is_active && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                                  )}
                                  {task.is_active ? 'פעיל' : 'מושהה'}
                                </span>

                                {/* Schedule Pill */}
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                                  <Clock className="w-3 h-3 text-indigo-500" />
                                  {task.schedule_type === 'daily'
                                    ? `כל יום ב-${task.scheduled_time || '08:30'}`
                                    : task.schedule_type === 'weekly'
                                    ? `שבועי ב-${task.scheduled_time || '08:30'}`
                                    : `חד-פעמי (${task.scheduled_time || ''})`}
                                </span>

                                {/* Client Pill */}
                                {task.client_name && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
                                    <Building2 className="w-3 h-3 text-sky-500" />
                                    {task.client_name}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Action Toolbar */}
                          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                            <Button
                              variant="default"
                              size="sm"
                              disabled={isRunning}
                              onClick={() => handleRunNow(task)}
                              className="h-8 text-xs gap-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold shadow-xs px-3 rounded-xl cursor-pointer"
                              title="הפעל משימה זו עכשיו"
                            >
                              {isRunning ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Play className="w-3.5 h-3.5 fill-current" />
                              )}
                              הפעל עכשיו
                            </Button>

                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-xl"
                              onClick={() => handleToggle(task)}
                              title={task.is_active ? 'השהה משימה' : 'הפעל משימה'}
                            >
                              {task.is_active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl"
                              onClick={() => handleDelete(task.id, task.title)}
                              title="מחק משימה זו"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* Instruction Box */}
                        <div className="p-3 rounded-xl bg-muted/30 border border-border/50 text-xs text-muted-foreground leading-relaxed">
                          <span className="font-bold text-foreground ml-1">הוראת ביצוע לסוכן:</span>
                          {task.instruction}
                        </div>

                        {/* Execution Result Box — With Full Expand & Modal Viewer */}
                        {hasResult && (
                          <div className="p-4 rounded-xl bg-gradient-to-br from-muted/50 to-muted/20 border border-border/70 space-y-3">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                <span>תוצאת ביצוע אחרונה</span>
                                <span className="text-[11px] font-normal text-muted-foreground">
                                  ({task.last_run_at ? new Date(task.last_run_at).toLocaleString('he-IL') : ''})
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleCopyText(task.last_run_result.summary)}
                                  className="h-7 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground cursor-pointer rounded-lg"
                                  title="העתק תשובה ללוח"
                                >
                                  <Copy className="w-3 h-3" />
                                  העתק
                                </Button>

                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => toggleExpand(task.id)}
                                  className="h-7 px-2.5 text-[11px] gap-1 font-semibold text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer rounded-lg"
                                >
                                  {isExpanded ? (
                                    <>
                                      <ChevronUp className="w-3 h-3" />
                                      כווץ תצוגה
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown className="w-3 h-3" />
                                      קרא כאן
                                    </>
                                  )}
                                </Button>

                                <Button
                                  size="sm"
                                  onClick={() => setSelectedTaskForFullReport(task)}
                                  className="h-7 px-2.5 text-[11px] gap-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-2xs rounded-lg cursor-pointer"
                                  title="צפה בדוח המלא בחלון מורחב"
                                >
                                  <Maximize2 className="w-3 h-3" />
                                  דוח מלא 👁️
                                </Button>
                              </div>
                            </div>

                            {/* Inline Display */}
                            {isExpanded ? (
                              <div className="p-4 rounded-xl bg-background border border-border/80 text-xs leading-relaxed max-h-[380px] overflow-y-auto shadow-inner">
                                <ArtifactVisualRenderer content={task.last_run_result.summary} />
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                                {task.last_run_result.summary}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Full Task Report Viewer Modal ────────────────────────────────── */}
      {selectedTaskForFullReport && (
        <Dialog
          open={!!selectedTaskForFullReport}
          onOpenChange={(open) => !open && setSelectedTaskForFullReport(null)}
        >
          <DialogContent
            className="max-w-4xl xl:max-w-5xl w-[94vw] h-[85vh] max-h-[850px] p-0 flex flex-col overflow-hidden bg-background/95 backdrop-blur-xl border border-border shadow-2xl rounded-3xl"
            dir="rtl"
          >
            {/* Report Header */}
            <DialogHeader className="px-6 py-4 border-b border-border/80 bg-muted/40 shrink-0 flex flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center shadow-xs shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground">
                    {selectedTaskForFullReport.title} — דוח ביצוע מלא
                  </DialogTitle>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                    <span>
                      הופק לאחרונה ב-{selectedTaskForFullReport.last_run_at ? new Date(selectedTaskForFullReport.last_run_at).toLocaleString('he-IL') : ''}
                    </span>
                    {selectedTaskForFullReport.client_name && (
                      <span className="font-semibold text-foreground">
                        · לקוח: {selectedTaskForFullReport.client_name}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopyText(selectedTaskForFullReport.last_run_result?.summary || '')}
                  className="h-8 gap-1.5 text-xs font-semibold rounded-xl"
                >
                  <Copy className="w-3.5 h-3.5" />
                  העתק דוח
                </Button>

                <Button
                  size="sm"
                  disabled={savingToStudio}
                  onClick={() => handleSaveReportToStudio(selectedTaskForFullReport)}
                  className="h-8 gap-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs"
                >
                  {savingToStudio ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <BookmarkPlus className="w-3.5 h-3.5" />
                  )}
                  שמור לסטודיו 📌
                </Button>
              </div>
            </DialogHeader>

            {/* Report Content Body */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
              <div className="p-4 rounded-2xl bg-muted/30 border border-border/60 text-xs text-muted-foreground leading-relaxed">
                <span className="font-bold text-foreground ml-1">הוראת המשימה:</span>
                {selectedTaskForFullReport.instruction}
              </div>

              <div className="bg-card p-6 rounded-2xl border border-border/80 shadow-xs">
                <ArtifactVisualRenderer
                  content={selectedTaskForFullReport.last_run_result?.summary || 'לא נמצא תוכן לביצוע זה.'}
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
