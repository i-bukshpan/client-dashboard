/**
 * src/ai/tools/workerTools.ts
 *
 * כלים לניהול עובדי משה (moshe_workers, moshe_worker_tasks, moshe_worker_logs)
 * גישה: moshe_admin (כל) | worker (עצמו בלבד)
 */

import { SchemaType, type FunctionDeclaration } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── listWorkers ───────────────────────────────────────────────────────────────

export const listWorkersDeclaration: FunctionDeclaration = {
  name: 'listWorkers',
  description:
    'מחזיר רשימת עובדים פעילים. השתמש כאשר המשתמש שואל "מי העובדים", "רשימת עובדים", "הצג עובדים".',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      active_only: {
        type: SchemaType.BOOLEAN,
        description: 'האם להציג רק עובדים פעילים (ברירת מחדל: true)',
      },
    },
    required: [],
  },
}

export async function listWorkers(args: { active_only?: boolean }): Promise<Record<string, unknown>> {
  const activeOnly = args.active_only !== false // ברירת מחדל true

  let query = db.from('moshe_workers').select('id, name, phone, email, role, is_active')
  if (activeOnly) query = query.eq('is_active', true)

  const { data, error } = await query.order('name', { ascending: true })
  if (error) return { found: false, error: error.message }

  return {
    found: true,
    count: (data ?? []).length,
    workers: (data ?? []).map((w: any) => ({
      id: w.id,
      name: w.name,
      phone: w.phone || null,
      role: w.role || 'worker',
      is_active: w.is_active,
    })),
  }
}

// ─── getWorkerTasksMoshe ───────────────────────────────────────────────────────

export const getWorkerTasksMosheDeclaration: FunctionDeclaration = {
  name: 'getWorkerTasksMoshe',
  description:
    'מחזיר משימות של עובד משה. ' +
    'עובד רואה רק את משימותיו. מנהל יכול לראות של כל עובד. ' +
    'השתמש כאשר המשתמש שואל "מה המשימות שלי", "מה יש לי לעשות", "מה המשימות של עובד X".',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      worker_name: {
        type: SchemaType.STRING,
        description: 'שם העובד (אם לא צוין — מוצגות משימות המשתמש המחובר)',
      },
      worker_id: { type: SchemaType.STRING, description: 'UUID של העובד' },
      include_done: {
        type: SchemaType.BOOLEAN,
        description: 'האם לכלול משימות שהושלמו (ברירת מחדל: false)',
      },
    },
    required: [],
  },
}

export async function getWorkerTasksMoshe(args: {
  worker_name?: string; worker_id?: string; include_done?: boolean
}, contextWorkerId?: string): Promise<Record<string, unknown>> {
  let workerId = args.worker_id || contextWorkerId

  if (!workerId && args.worker_name) {
    const { data: workers } = await db
      .from('moshe_workers')
      .select('id, name')
      .ilike('name', `%${args.worker_name}%`)
      .limit(1)
    if (workers && workers.length > 0) workerId = workers[0].id
  }

  if (!workerId) return { found: false, error: 'לא נמצא עובד.' }

  const includeDone = args.include_done === true

  const { data: worker } = await db
    .from('moshe_workers')
    .select('name')
    .eq('id', workerId)
    .single()

  let query = db
    .from('moshe_worker_tasks')
    .select(`
      id, title, notes, due_date, is_done, done_at, created_at,
      moshe_projects(name)
    `)
    .eq('worker_id', workerId)
    .order('created_at', { ascending: false })
    .limit(30)

  if (!includeDone) query = query.eq('is_done', false)

  const { data: tasks, error } = await query
  if (error) return { found: false, error: error.message }

  return {
    found: true,
    worker_name: worker?.name || 'לא ידוע',
    count: (tasks ?? []).length,
    tasks: (tasks ?? []).map((t: any) => ({
      id: t.id,
      title: t.title,
      notes: t.notes || '',
      due_date: t.due_date || 'לא נקבע',
      is_done: t.is_done,
      done_at: t.done_at || null,
      project: (t.moshe_projects as any)?.name || null,
    })),
  }
}

// ─── completeWorkerTask ────────────────────────────────────────────────────────

export const completeWorkerTaskDeclaration: FunctionDeclaration = {
  name: 'completeWorkerTask',
  description:
    'מסמן משימת עובד כ"הושלמה". ' +
    'השתמש כאשר העובד אומר "סיימתי", "הושלם", "עשיתי את הX".',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      task_id: { type: SchemaType.STRING, description: 'UUID של המשימה' },
      task_title: { type: SchemaType.STRING, description: 'שם המשימה לחיפוש אם אין UUID' },
    },
    required: [],
  },
}

export async function completeWorkerTask(args: {
  task_id?: string; task_title?: string
}, contextWorkerId?: string): Promise<Record<string, unknown>> {
  let taskId = args.task_id
  let taskTitle = args.task_title || ''

  if (!taskId && args.task_title) {
    let searchQuery = db
      .from('moshe_worker_tasks')
      .select('id, title')
      .ilike('title', `%${args.task_title}%`)
      .eq('is_done', false)
    if (contextWorkerId) searchQuery = searchQuery.eq('worker_id', contextWorkerId)

    const { data } = await searchQuery.limit(1)
    if (!data || data.length === 0) {
      return { pending: false, error: `לא נמצאה משימה פתוחה בשם "${args.task_title}".` }
    }
    taskId = data[0].id
    taskTitle = data[0].title
  }

  if (!taskId) return { pending: false, error: 'חסר מזהה משימה.' }

  return {
    pending: true,
    action_type: 'completeWorkerTask',
    action_params: { task_id: taskId },
    confirmation_message: `האם לסמן את המשימה "${taskTitle}" כהושלמה?`,
  }
}

export async function executeCompleteWorkerTask(params: { task_id: string }): Promise<Record<string, unknown>> {
  const { error } = await db
    .from('moshe_worker_tasks')
    .update({ is_done: true, done_at: new Date().toISOString() })
    .eq('id', params.task_id)
  if (error) return { success: false, error: error.message }
  return { success: true, message: 'המשימה סומנה כהושלמה! 💪' }
}

// ─── addWorkerLog ──────────────────────────────────────────────────────────────

export const addWorkerLogDeclaration: FunctionDeclaration = {
  name: 'addWorkerLog',
  description:
    'מוסיף דיווח עבודה יומי של עובד. ' +
    'השתמש כאשר העובד אומר "עבדתי היום על", "דווח", "סיכום יום".',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      note: { type: SchemaType.STRING, description: 'תיאור העבודה שבוצעה (חובה)' },
      project_name: { type: SchemaType.STRING, description: 'שם הפרויקט (אופציונלי)' },
      log_date: { type: SchemaType.STRING, description: 'תאריך YYYY-MM-DD (ברירת מחדל: היום)' },
    },
    required: ['note'],
  },
}

export async function addWorkerLog(args: {
  note?: string; project_name?: string; log_date?: string
}, contextWorkerId?: string): Promise<Record<string, unknown>> {
  if (!args.note?.trim()) return { pending: false, error: 'חסרת תיאור העבודה.' }
  if (!contextWorkerId) return { pending: false, error: 'לא ניתן לזהות את העובד.' }

  let projectId: string | null = null
  let projectName = args.project_name || null

  if (args.project_name) {
    const { data: projects } = await db
      .from('moshe_projects')
      .select('id, name')
      .ilike('name', `%${args.project_name}%`)
      .limit(1)
    if (projects && projects.length > 0) {
      projectId = projects[0].id
      projectName = projects[0].name
    }
  }

  const logDate = args.log_date || new Date().toISOString().split('T')[0]

  return {
    pending: true,
    action_type: 'addWorkerLog',
    action_params: {
      worker_id: contextWorkerId,
      project_id: projectId,
      note: args.note,
      log_date: logDate,
    },
    confirmation_message:
      `האם לשמור דיווח עבודה: "${args.note}"` +
      (projectName ? ` בפרויקט ${projectName}` : '') +
      ` לתאריך ${logDate}?`,
  }
}

export async function executeAddWorkerLog(params: {
  worker_id: string; project_id?: string | null; note: string; log_date: string
}): Promise<Record<string, unknown>> {
  const { error } = await db.from('moshe_worker_logs').insert({
    worker_id: params.worker_id,
    project_id: params.project_id || null,
    note: params.note,
    log_date: params.log_date,
  })
  if (error) return { success: false, error: error.message }
  return { success: true, message: 'דיווח העבודה נשמר בהצלחה. תודה!' }
}
