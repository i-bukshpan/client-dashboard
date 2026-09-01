'use client'

import { useMemo, useState } from 'react'
import { addDays } from 'date-fns'
import { useRouter } from 'next/navigation'
import {
  CalendarPlus,
  Check,
  Clock3,
  LayoutGrid,
  List,
  Loader2,
  Pencil,
  Plus,
  Repeat,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  completeWorkspaceTaskAction,
  convertTaskToCalendarAction,
  createWorkspaceTaskAction,
  deleteWorkspaceTaskAction,
  snoozeWorkspaceTaskAction,
  updateWorkspaceTaskAction,
} from '@/app/workspace/actions/tasks'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type {
  WorkspaceTask,
  WorkspaceTaskPriority,
  WorkspaceTaskRecurrence,
  WorkspaceTaskStatus,
} from '@/types/workspace-task'

interface ClientOption {
  id: string
  name: string
}

const STATUS: Record<WorkspaceTaskStatus, string> = {
  todo: 'לביצוע',
  in_progress: 'בטיפול',
  completed: 'הושלם',
  cancelled: 'בוטל',
}

const PRIORITY: Record<WorkspaceTaskPriority, string> = {
  low: 'נמוכה',
  medium: 'בינונית',
  high: 'גבוהה',
  urgent: 'דחופה',
}

const RECURRENCE_LABELS: Record<WorkspaceTaskRecurrence, string> = {
  none: 'ללא מחזוריות',
  daily: 'יומי (כל יום)',
  weekly: 'שבועי',
  monthly: 'חודשי',
  yearly: 'שנתי',
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'יום ראשון' },
  { value: 1, label: 'יום שני' },
  { value: 2, label: 'יום שלישי' },
  { value: 3, label: 'יום רביעי' },
  { value: 4, label: 'יום חמישי' },
  { value: 5, label: 'יום שישי' },
  { value: 6, label: 'יום שבת' },
]

const REMINDER = {
  overdue: ['באיחור', 'bg-rose-500/15 text-rose-400'],
  due_today: ['היום', 'bg-amber-500/15 text-amber-400'],
  upcoming: ['בקרוב', 'bg-blue-500/15 text-blue-400'],
  snoozed: ['נדחה', 'bg-violet-500/15 text-violet-400'],
  none: ['', ''],
  completed: ['', ''],
} as const

function formatRecurrence(task: WorkspaceTask): string | null {
  if (!task.recurrence || task.recurrence === 'none') return null
  if (task.recurrence === 'daily') return 'כל יום'
  if (task.recurrence === 'weekly') {
    const dayName = DAYS_OF_WEEK.find((d) => d.value === (task.recurrenceDay ?? 0))?.label || 'ראשון'
    return `כל ${dayName}`
  }
  if (task.recurrence === 'monthly') {
    return `כל ${task.recurrenceDay || 1} בחודש`
  }
  if (task.recurrence === 'yearly') return 'שנתי'
  return null
}

function localInput(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export function WorkspaceTaskBoard({
  tasks,
  clients,
  lockedClientId,
  compact = false,
}: {
  tasks: WorkspaceTask[]
  clients: ClientOption[]
  lockedClientId?: string
  compact?: boolean
}) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'all' | 'recurring'>('all')
  const [view, setView] = useState<'board' | 'list'>(compact ? 'list' : 'board')
  const [editor, setEditor] = useState<WorkspaceTask | 'new' | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const recurringTasks = useMemo(
    () => tasks.filter((task) => task.recurrence && task.recurrence !== 'none'),
    [tasks]
  )

  const counts = useMemo(
    () => ({
      overdue: tasks.filter((task) => task.reminderState === 'overdue').length,
      today: tasks.filter((task) => task.reminderState === 'due_today').length,
      upcoming: tasks.filter((task) => task.reminderState === 'upcoming').length,
      recurring: recurringTasks.length,
    }),
    [tasks, recurringTasks]
  )

  async function run(id: string, action: () => Promise<unknown>) {
    setBusyId(id)
    const result = await action()
    setBusyId(null)
    if (result && typeof result === 'object' && 'error' in result && typeof result.error === 'string') {
      toast.error(result.error)
      return
    }
    router.refresh()
  }

  function Card({ task }: { task: WorkspaceTask }) {
    const reminder = REMINDER[task.reminderState]
    const recurrenceText = formatRecurrence(task)

    return (
      <article className="rounded-xl border border-border bg-card p-3 shadow-xs">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-bold">{task.title}</h3>
            {task.clientName && <p className="mt-0.5 text-xs text-indigo-400 font-medium">{task.clientName}</p>}
          </div>
          <Badge variant="outline">{PRIORITY[task.priority]}</Badge>
        </div>

        {task.description && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{task.description}</p>}

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          {task.dueAt && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock3 className="size-3" />
              {new Date(task.dueAt).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}
            </span>
          )}

          {recurrenceText && (
            <span className="flex items-center gap-1 rounded-full bg-indigo-500/15 text-indigo-400 px-2 py-0.5 font-bold text-[11px] border border-indigo-500/30">
              <Repeat className="size-3" />
              {recurrenceText}
            </span>
          )}

          {reminder[0] && (
            <span className={`rounded-full px-2 py-0.5 font-bold ${reminder[1]}`}>
              {reminder[0]}
            </span>
          )}

          {task.calendarEventId && <span className="text-emerald-400">מחובר ליומן</span>}
        </div>

        <div className="mt-3 flex flex-wrap gap-1 border-t border-border/60 pt-2">
          <Button size="xs" variant="ghost" onClick={() => setEditor(task)}>
            <Pencil /> עריכה
          </Button>
          {task.status !== 'completed' && (
            <Button
              size="xs"
              variant="ghost"
              disabled={busyId === task.id}
              onClick={() => run(task.id, () => completeWorkspaceTaskAction(task.id))}
            >
              <Check /> השלמה
            </Button>
          )}
          {task.status !== 'completed' && (
            <Button
              size="xs"
              variant="ghost"
              onClick={() => run(task.id, () => snoozeWorkspaceTaskAction(task.id, addDays(new Date(), 1).toISOString()))}
            >
              <Clock3 /> מחר
            </Button>
          )}
          {task.dueAt && !task.calendarEventId && (
            <Button size="xs" variant="ghost" onClick={() => run(task.id, () => convertTaskToCalendarAction(task.id))}>
              <CalendarPlus /> ליומן
            </Button>
          )}
          <Button
            size="xs"
            variant="ghost"
            className="text-rose-400 hover:text-rose-500 hover:bg-rose-500/10 mr-auto"
            onClick={() => {
              if (confirm('האם למחוק משימה זו?')) {
                run(task.id, () => deleteWorkspaceTaskAction(task.id))
              }
            }}
          >
            <Trash2 className="size-3" />
          </Button>
          {busyId === task.id && <Loader2 className="size-3 animate-spin" />}
        </div>
      </article>
    )
  }

  const columns: Array<{ status: WorkspaceTaskStatus; label: string }> = [
    { status: 'todo', label: 'לביצוע' },
    { status: 'in_progress', label: 'בטיפול' },
    { status: 'completed', label: 'הושלם' },
  ]

  return (
    <div className="space-y-4">
      {/* Top Bar with Filter & Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/20 p-2.5 rounded-2xl border border-border/60">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={activeTab === 'all' ? 'default' : 'ghost'}
            className="rounded-xl font-bold"
            onClick={() => setActiveTab('all')}
          >
            כל המשימות ({tasks.length})
          </Button>
          <Button
            size="sm"
            variant={activeTab === 'recurring' ? 'default' : 'ghost'}
            className="rounded-xl font-bold flex items-center gap-1.5"
            onClick={() => setActiveTab('recurring')}
          >
            <Repeat className="size-3.5" />
            משימות מחזוריות קבועות ({counts.recurring})
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'all' && !compact && (
            <>
              <Button size="sm" variant={view === 'board' ? 'secondary' : 'ghost'} onClick={() => setView('board')}>
                <LayoutGrid />
              </Button>
              <Button size="sm" variant={view === 'list' ? 'secondary' : 'ghost'} onClick={() => setView('list')}>
                <List />
              </Button>
            </>
          )}
          <Button size="sm" onClick={() => setEditor('new')}>
            <Plus /> משימה חדשה
          </Button>
        </div>
      </div>

      {/* Counts Header for regular view */}
      {activeTab === 'all' && (
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-rose-500/15 text-rose-400">{counts.overdue} באיחור</Badge>
          <Badge className="bg-amber-500/15 text-amber-400">{counts.today} להיום</Badge>
          <Badge className="bg-blue-500/15 text-blue-400">{counts.upcoming} בקרוב</Badge>
        </div>
      )}

      {/* Tab 1: All Tasks Board / List */}
      {activeTab === 'all' && (
        view === 'board' ? (
          <div className="grid gap-4 lg:grid-cols-3">
            {columns.map((column) => (
              <section key={column.status} className="rounded-2xl bg-muted/30 p-3">
                <h2 className="mb-3 flex items-center justify-between font-bold">
                  {column.label}
                  <Badge variant="outline">{tasks.filter((task) => task.status === column.status).length}</Badge>
                </h2>
                <div className="space-y-3">
                  {tasks
                    .filter((task) => task.status === column.status)
                    .map((task) => (
                      <Card key={task.id} task={task} />
                    ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="grid gap-3">
            {tasks.map((task) => (
              <Card key={task.id} task={task} />
            ))}
          </div>
        )
      )}

      {/* Tab 2: Dedicated Recurring Tasks Manager */}
      {activeTab === 'recurring' && (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div>
              <h2 className="font-black text-lg flex items-center gap-2">
                <Repeat className="size-5 text-indigo-500" />
                ניהול משימות מחזוריות קבועות
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                משימות אלו מתחדשות אוטומטית בכל מחזור זמן שנקבע (חודשי, שבועי או יומי)
              </p>
            </div>
            <Button size="sm" onClick={() => setEditor('new')} className="flex items-center gap-1">
              <Plus className="size-3.5" /> משימה מחזורית חדשה
            </Button>
          </div>

          {recurringTasks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground space-y-2">
              <Repeat className="size-10 mx-auto text-muted-foreground/40" />
              <p className="font-bold">אין משימות מחזוריות מוגדרות כרגע</p>
              <p className="text-xs">צור משימה עם תדירות חודשית (כגון כל 1 בחודש) או שבועית כדי לנהל אותה כאן.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recurringTasks.map((task) => {
                const recurrenceText = formatRecurrence(task)
                return (
                  <div
                    key={task.id}
                    className="rounded-xl border border-border/80 bg-muted/10 p-3.5 space-y-3 hover:border-indigo-500/40 transition-colors shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-black text-base">{task.title}</h3>
                        {task.clientName && (
                          <p className="text-xs text-indigo-400 font-semibold">{task.clientName}</p>
                        )}
                      </div>
                      <Badge variant="outline">{STATUS[task.status]}</Badge>
                    </div>

                    {task.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
                    )}

                    <div className="rounded-lg bg-indigo-500/10 border border-indigo-500/20 px-3 py-2 flex items-center justify-between text-xs text-indigo-400 font-bold">
                      <span className="flex items-center gap-1.5">
                        <Repeat className="size-3.5" />
                        {recurrenceText}
                      </span>
                      {task.dueAt && (
                        <span className="text-[11px] text-muted-foreground font-normal">
                          יעד: {new Date(task.dueAt).toLocaleDateString('he-IL')}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between border-t border-border/60 pt-2 text-xs">
                      <div className="flex items-center gap-1">
                        <Button size="xs" variant="ghost" onClick={() => setEditor(task)}>
                          <Pencil /> עריכה
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => run(task.id, () => completeWorkspaceTaskAction(task.id))}
                        >
                          <Check /> השלם מחזור
                        </Button>
                      </div>
                      <Button
                        size="xs"
                        variant="ghost"
                        className="text-rose-400 hover:text-rose-500 hover:bg-rose-500/10"
                        onClick={() => {
                          if (confirm('האם למחוק משימה מחזורית זו?')) {
                            run(task.id, () => deleteWorkspaceTaskAction(task.id))
                          }
                        }}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <TaskEditor
        open={Boolean(editor)}
        task={editor === 'new' ? null : editor}
        clients={clients}
        lockedClientId={lockedClientId}
        onClose={() => setEditor(null)}
        onSaved={() => {
          setEditor(null)
          router.refresh()
        }}
      />
    </div>
  )
}

function TaskEditor({
  open,
  task,
  clients,
  lockedClientId,
  onClose,
  onSaved,
}: {
  open: boolean
  task: WorkspaceTask | null
  clients: ClientOption[]
  lockedClientId?: string
  onClose: () => void
  onSaved: () => void
}) {
  const [pending, setPending] = useState(false)
  const [recurrence, setRecurrence] = useState<WorkspaceTaskRecurrence>(task?.recurrence ?? 'none')

  async function save(formData: FormData): Promise<void> {
    setPending(true)
    const due = String(formData.get('dueAt') || '')
    const selectedClientId = String(formData.get('clientId') || '') || null
    const recType = (String(formData.get('recurrence')) as WorkspaceTaskRecurrence) || 'none'
    const recDayRaw = formData.get('recurrenceDay')
    const recDay = recDayRaw !== null && recDayRaw !== '' ? Number(recDayRaw) : null

    const input = {
      title: String(formData.get('title') || ''),
      description: String(formData.get('description') || '') || null,
      clientId: lockedClientId ?? selectedClientId,
      status: String(formData.get('status')) as WorkspaceTaskStatus,
      priority: String(formData.get('priority')) as WorkspaceTaskPriority,
      dueAt: due ? new Date(due).toISOString() : null,
      reminderMinutes: Number(formData.get('reminderMinutes') || 30),
      recurrence: recType,
      recurrenceDay: recDay,
    }

    const result = task
      ? await updateWorkspaceTaskAction(task.id, input)
      : await createWorkspaceTaskAction(input)

    setPending(false)
    if ('error' in result) {
      toast.error(result.error)
      return
    }
    toast.success(task ? 'המשימה עודכנה' : 'המשימה נוצרה')
    onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle>{task ? 'עריכת משימה' : 'משימה חדשה'}</DialogTitle>
        </DialogHeader>
        <form action={save} className="space-y-4">
          <div>
            <Label htmlFor="task-title">כותרת</Label>
            <Input id="task-title" name="title" defaultValue={task?.title} required />
          </div>

          <div>
            <Label htmlFor="task-description">תיאור</Label>
            <Textarea id="task-description" name="description" defaultValue={task?.description ?? ''} />
          </div>

          {!lockedClientId && (
            <div>
              <Label htmlFor="task-client">לקוח</Label>
              <select
                id="task-client"
                name="clientId"
                defaultValue={task?.clientId ?? ''}
                className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="">ללא לקוח (כללי לנחמיה)</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="task-status">סטטוס</Label>
              <select
                id="task-status"
                name="status"
                defaultValue={task?.status ?? 'todo'}
                className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                {Object.entries(STATUS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="task-priority">עדיפות</Label>
              <select
                id="task-priority"
                name="priority"
                defaultValue={task?.priority ?? 'medium'}
                className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                {Object.entries(PRIORITY).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Recurrence Selection */}
          <div className="rounded-xl border border-border/80 bg-muted/20 p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Repeat className="size-4 text-indigo-500" />
              <Label htmlFor="task-recurrence" className="font-bold text-xs">
                מחזוריות משימה
              </Label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <select
                  id="task-recurrence"
                  name="recurrence"
                  value={recurrence}
                  onChange={(e) => setRecurrence(e.target.value as WorkspaceTaskRecurrence)}
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                >
                  {Object.entries(RECURRENCE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {recurrence === 'weekly' && (
                <div>
                  <select
                    name="recurrenceDay"
                    defaultValue={task?.recurrenceDay ?? 0}
                    className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  >
                    {DAYS_OF_WEEK.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {recurrence === 'monthly' && (
                <div>
                  <Input
                    name="recurrenceDay"
                    type="number"
                    min={1}
                    max={31}
                    placeholder="יום בחודש (1-31)"
                    defaultValue={task?.recurrenceDay ?? 1}
                    className="h-9 text-sm"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="task-due">מועד יעד ראשון</Label>
              <Input
                id="task-due"
                name="dueAt"
                type="datetime-local"
                defaultValue={localInput(task?.dueAt ?? null)}
              />
            </div>
            <div>
              <Label htmlFor="task-reminder">תזכורת בדקות</Label>
              <Input
                id="task-reminder"
                name="reminderMinutes"
                type="number"
                min="0"
                max="40320"
                defaultValue={task?.reminderMinutes ?? 30}
              />
            </div>
          </div>

          <Button type="submit" disabled={pending} className="w-full">
            {pending && <Loader2 className="animate-spin" />} שמירה
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
