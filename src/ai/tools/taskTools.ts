/**
 * src/ai/tools/taskTools.ts
 *
 * כלים לניהול משימות עובדי המשרד (טבלת tasks, profiles)
 * גישה: admin — כל המשימות | employee — משימות שלו בלבד
 */

import { SchemaType, type FunctionDeclaration } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── getOpenTasks ──────────────────────────────────────────────────────────────

export const getOpenTasksDeclaration: FunctionDeclaration = {
  name: 'getOpenTasks',
  description:
    'מחזיר משימות פתוחות של עובדי המשרד. השתמש כאשר המשתמש שואל "מה המשימות", "מה יש לעשות", "מה הסטטוס".',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      assigned_to_id: {
        type: SchemaType.STRING,
        description: 'UUID של עובד ספציפי. אם לא צוין — מביא את כולן (רק admin)',
      },
      priority: {
        type: SchemaType.STRING,
        description: 'סינון לפי עדיפות: low, medium, high, urgent',
      },
    },
    required: [],
  },
}

export async function getOpenTasks(args: {
  assigned_to_id?: string
  priority?: string
}): Promise<Record<string, unknown>> {
  let query = db
    .from('tasks')
    .select(`
      id, title, description, status, priority, due_date,
      profiles!tasks_assigned_to_fkey(full_name),
      clients(name)
    `)
    .in('status', ['todo', 'in_progress'])
    .order('priority', { ascending: false })
    .order('due_date', { ascending: true })
    .limit(30)

  if (args.assigned_to_id) query = query.eq('assigned_to', args.assigned_to_id)
  if (args.priority) query = query.eq('priority', args.priority)

  const { data, error } = await query
  if (error) return { found: false, error: error.message }

  const priorityLabel: Record<string, string> = { low: 'נמוכה', medium: 'בינונית', high: 'גבוהה', urgent: 'דחוף' }
  const statusLabel: Record<string, string> = { todo: 'לביצוע', in_progress: 'בתהליך', done: 'הושלם' }

  const tasks = (data ?? []).map((t: any) => ({
    id: t.id,
    title: t.title,
    description: t.description || '',
    status: statusLabel[t.status] || t.status,
    priority: priorityLabel[t.priority] || t.priority,
    due_date: t.due_date || 'לא נקבע',
    assigned_to: t.profiles?.full_name || 'לא משויך',
    client: t.clients?.name || null,
  }))

  return { found: true, count: tasks.length, tasks }
}

// ─── createTask ────────────────────────────────────────────────────────────────

export const createTaskDeclaration: FunctionDeclaration = {
  name: 'createTask',
  description:
    'יוצר משימה חדשה לעובד. השתמש כאשר המשתמש אומר "צור משימה", "תן משימה ל", "הוסף מטלה".',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      title: { type: SchemaType.STRING, description: 'כותרת המשימה (חובה)' },
      description: { type: SchemaType.STRING, description: 'תיאור מפורט' },
      assigned_to_name: { type: SchemaType.STRING, description: 'שם העובד שאליו לשייך' },
      priority: {
        type: SchemaType.STRING,
        description: 'עדיפות: low / medium / high / urgent (ברירת מחדל: medium)',
      },
      due_date: { type: SchemaType.STRING, description: 'תאריך יעד בפורמט YYYY-MM-DD' },
    },
    required: ['title'],
  },
}

export async function createTask(args: {
  title?: string
  description?: string
  assigned_to_name?: string
  priority?: string
  due_date?: string
}): Promise<Record<string, unknown>> {
  if (!args.title) return { pending: false, error: 'חסרת כותרת משימה.' }

  const validPriorities = ['low', 'medium', 'high', 'urgent']
  const priority = args.priority && validPriorities.includes(args.priority) ? args.priority : 'medium'

  // חיפוש עובד לפי שם
  let assignedToId: string | null = null
  let employeeName = args.assigned_to_name || null
  if (args.assigned_to_name) {
    const { data: employees } = await db
      .from('profiles')
      .select('id, full_name')
      .ilike('full_name', `%${args.assigned_to_name}%`)
      .limit(1)
    if (employees && employees.length > 0) {
      assignedToId = employees[0].id
      employeeName = employees[0].full_name
    }
  }

  const priorityLabel: Record<string, string> = { low: 'נמוכה', medium: 'בינונית', high: 'גבוהה', urgent: 'דחוף' }

  return {
    pending: true,
    action_type: 'createTask',
    action_params: {
      title: args.title,
      description: args.description || '',
      assigned_to: assignedToId,
      priority,
      due_date: args.due_date || null,
    },
    confirmation_message:
      `האם ליצור משימה "${args.title}"` +
      (employeeName ? ` עבור ${employeeName}` : '') +
      `, עדיפות ${priorityLabel[priority]}` +
      (args.due_date ? `, עד תאריך ${args.due_date}` : '') + '?',
  }
}

export async function executeCreateTask(params: {
  title: string; description?: string; assigned_to?: string | null; priority: string; due_date?: string | null; created_by?: string
}): Promise<Record<string, unknown>> {
  const { error } = await db.from('tasks').insert({
    title: params.title,
    description: params.description || null,
    assigned_to: params.assigned_to || null,
    priority: params.priority,
    due_date: params.due_date || null,
    status: 'todo',
    created_by: params.created_by || null,
  })
  if (error) return { success: false, error: error.message }
  return { success: true, message: `משימה "${params.title}" נוצרה בהצלחה.` }
}

// ─── updateTaskStatus ──────────────────────────────────────────────────────────

export const updateTaskStatusDeclaration: FunctionDeclaration = {
  name: 'updateTaskStatus',
  description:
    'מעדכן סטטוס משימה. השתמש כאשר המשתמש אומר "סיימתי", "הושלם", "עברתי לעבוד על".',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      task_id: { type: SchemaType.STRING, description: 'UUID של המשימה' },
      task_title: { type: SchemaType.STRING, description: 'שם המשימה לחיפוש אם אין UUID' },
      status: {
        type: SchemaType.STRING,
        description: 'סטטוס חדש: todo / in_progress / done',
      },
    },
    required: ['status'],
  },
}

export async function updateTaskStatus(args: {
  task_id?: string
  task_title?: string
  status?: string
}): Promise<Record<string, unknown>> {
  const validStatuses = ['todo', 'in_progress', 'done']
  if (!args.status || !validStatuses.includes(args.status)) {
    return { pending: false, error: 'סטטוס לא תקין. האפשרויות: todo, in_progress, done' }
  }

  let taskId = args.task_id
  let taskTitle = args.task_title || ''

  if (!taskId && args.task_title) {
    const { data } = await db
      .from('tasks')
      .select('id, title')
      .ilike('title', `%${args.task_title}%`)
      .limit(1)
    if (!data || data.length === 0) {
      return { pending: false, error: `לא נמצאה משימה בשם "${args.task_title}".` }
    }
    taskId = data[0].id
    taskTitle = data[0].title
  }

  if (!taskId) return { pending: false, error: 'חסר מזהה משימה.' }

  const statusLabel: Record<string, string> = { todo: 'לביצוע', in_progress: 'בתהליך', done: 'הושלם' }

  return {
    pending: true,
    action_type: 'updateTaskStatus',
    action_params: { task_id: taskId, status: args.status },
    confirmation_message: `האם לעדכן את המשימה "${taskTitle}" לסטטוס "${statusLabel[args.status]}"?`,
  }
}

export async function executeUpdateTaskStatus(params: {
  task_id: string; status: string
}): Promise<Record<string, unknown>> {
  const { error } = await db
    .from('tasks')
    .update({ status: params.status })
    .eq('id', params.task_id)
  if (error) return { success: false, error: error.message }
  return { success: true, message: 'סטטוס המשימה עודכן בהצלחה.' }
}
