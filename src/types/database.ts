// ── v2: Dashboard Config Types ───────────────────────────────────────────────

/** All widget types the dashboard engine can render. */
export type WidgetType =
  | 'bar_chart'
  | 'line_chart'
  | 'pie_chart'
  | 'stat_card'
  | 'data_table'

/** Grid position and size for a widget (CSS grid coordinates). */
export interface WidgetPosition {
  /** Zero-based column start index */
  col: number
  /** Zero-based row start index */
  row: number
  /** Number of columns to span (1-4) */
  w: number
  /** Number of rows to span (1-4) */
  h: number
}

/** A single dashboard widget definition. */
export interface DashboardWidget {
  /** Unique identifier for this widget (used as React key and for updates) */
  id: string
  /** The type of visualization to render */
  type: WidgetType
  /** Human-readable title displayed above the widget */
  title: string
  /** Name of the Google Sheet tab this widget reads data from */
  sheet: string
  /** Grid position/size */
  position: WidgetPosition
  /** Tailwind color token or hex color for the widget accent */
  color?: string

  // ── Chart-specific fields (relevant to bar/line/pie charts) ───────────────
  /** Column name to use for the X-axis (bar/line charts) */
  x_column?: string
  /** Column name to use for the Y-axis / value (bar/line/stat cards) */
  y_column?: string
  /** Column name to use for pie chart labels */
  label_column?: string
  /** Column name to use for pie chart values */
  value_column?: string

  // ── Stat card-specific fields ─────────────────────────────────────────────
  /** Lucide icon name for stat cards (e.g. 'trending-up', 'dollar-sign') */
  icon?: string
  /** Semantic color for stat cards: 'green' | 'red' | 'blue' | 'amber' */
  card_color?: 'green' | 'red' | 'blue' | 'amber' | 'purple'

  // ── Data table-specific fields ────────────────────────────────────────────
  /** Ordered list of column names to display (all columns if omitted) */
  columns?: string[]
  /** Maximum number of rows to show */
  max_rows?: number
}

/** Root dashboard configuration object stored in clients.dashboard_config_json */
export interface DashboardConfig {
  /** Schema version for forward-compatibility */
  version: 1
  /** Ordered list of widgets to render */
  widgets: DashboardWidget[]
}

// ── Core DB types ─────────────────────────────────────────────────────────────

export type Role = 'admin' | 'employee'
export type TaskStatus = 'todo' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type AppointmentStatus = 'scheduled' | 'done' | 'cancelled'
export type TransactionType = 'income' | 'expense'

export interface Profile {
  id: string
  full_name: string
  role: Role
  avatar_url: string | null
  email: string
  salary_base: number
  created_at: string
}

export interface Client {
  id: string
  name: string
  email: string | null
  phone: string | null
  id_number: string | null
  address: string | null
  notes: string | null
  drive_folder_id: string | null
  user_id: string | null
  birth_date: string | null
  portfolio_value: number | null
  client_since: string | null
  meeting_frequency: string | null
  risk_level: string | null
  advisory_goal: string | null
  advisory_track: string | null
  status: string | null
  // ── v2: Google Workspace fields ──────────────────────────────────────────
  /** ID of the client's Google Spreadsheet. null = not yet set up. */
  google_sheet_id: string | null
  /** Dynamic dashboard layout config. Empty object = no dashboard yet. */
  dashboard_config_json: DashboardConfig | Record<string, never>
  created_by: string
  created_at: string
}

export interface Appointment {
  id: string
  client_id: string | null
  employee_id: string | null
  start_time: string
  end_time: string
  title: string
  status: AppointmentStatus
  notes: string | null
  clients?: Pick<Client, 'id' | 'name'>
  profiles?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'>
}

export interface MeetingSummary {
  id: string
  appointment_id: string
  notes: string
  action_items: ActionItem[]
  created_at: string
}

export interface ActionItem {
  title: string
  priority: TaskPriority
  due_date?: string
  assign_to?: string
}

export interface Task {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  due_date: string | null
  assigned_to: string | null
  client_id: string | null
  archived: boolean | null
  created_by: string
  created_at: string
  clients?: Pick<Client, 'id' | 'name'>
  profiles?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'>
}

export interface TaskUpdate {
  id: string
  task_id: string
  user_id: string
  content: string
  created_at: string
  profiles?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'>
}

export interface Income {
  id: string
  amount: number
  category: string
  date: string
  client_id: string | null
  notes: string | null
  created_by: string
  clients?: Pick<Client, 'id' | 'name'>
}

export interface Expense {
  id: string
  amount: number
  category: string
  date: string
  notes: string | null
  created_by: string
}

export interface ChatMessage {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
  metadata: Record<string, unknown> | null
  profiles?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'>
}

export interface Conversation {
  id: string
  admin_id: string
  employee_id: string
  created_at: string
  profiles?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'>
}

export interface EmployeeBonus {
  id: string
  employee_id: string
  amount: number
  reason: string
  date: string
  created_by: string
}

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Partial<Omit<Profile, 'never'>>
        Update: Partial<Omit<Profile, 'never'>>
        Relationships: []
      }
      clients: {
        Row: Client
        Insert: Partial<Omit<Client, 'never'>>
        Update: Partial<Omit<Client, 'never'>>
        Relationships: []
      }
      appointments: {
        Row: Appointment
        Insert: Partial<Omit<Appointment, 'clients' | 'profiles'>>
        Update: Partial<Omit<Appointment, 'clients' | 'profiles'>>
        Relationships: []
      }
      meeting_summaries: {
        Row: MeetingSummary
        Insert: Partial<Omit<MeetingSummary, 'never'>>
        Update: Partial<Omit<MeetingSummary, 'never'>>
        Relationships: []
      }
      tasks: {
        Row: Task
        Insert: Partial<Omit<Task, 'clients' | 'profiles'>>
        Update: Partial<Omit<Task, 'clients' | 'profiles'>>
        Relationships: []
      }
      task_updates: {
        Row: TaskUpdate
        Insert: Partial<Omit<TaskUpdate, 'profiles'>>
        Update: Partial<Omit<TaskUpdate, 'profiles'>>
        Relationships: []
      }
      income: {
        Row: Income
        Insert: Partial<Omit<Income, 'clients'>>
        Update: Partial<Omit<Income, 'clients'>>
        Relationships: []
      }
      expenses: {
        Row: Expense
        Insert: Partial<Omit<Expense, 'never'>>
        Update: Partial<Omit<Expense, 'never'>>
        Relationships: []
      }
      chat_messages: {
        Row: ChatMessage
        Insert: Partial<Omit<ChatMessage, 'profiles'>>
        Update: Partial<Omit<ChatMessage, 'profiles'>>
        Relationships: []
      }
      conversations: {
        Row: Conversation
        Insert: Partial<Omit<Conversation, 'profiles'>>
        Update: Partial<Omit<Conversation, 'profiles'>>
        Relationships: []
      }
      employee_bonuses: {
        Row: EmployeeBonus
        Insert: Partial<Omit<EmployeeBonus, 'never'>>
        Update: Partial<Omit<EmployeeBonus, 'never'>>
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
