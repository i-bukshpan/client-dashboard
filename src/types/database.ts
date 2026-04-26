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

// Supabase Database generic type (simplified)
export type Database = {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> }
      clients: { Row: Client; Insert: Partial<Client>; Update: Partial<Client> }
      appointments: { Row: Appointment; Insert: Partial<Appointment>; Update: Partial<Appointment> }
      meeting_summaries: { Row: MeetingSummary; Insert: Partial<MeetingSummary>; Update: Partial<MeetingSummary> }
      tasks: { Row: Task; Insert: Partial<Task>; Update: Partial<Task> }
      income: { Row: Income; Insert: Partial<Income>; Update: Partial<Income> }
      expenses: { Row: Expense; Insert: Partial<Expense>; Update: Partial<Expense> }
      chat_messages: { Row: ChatMessage; Insert: Partial<ChatMessage>; Update: Partial<ChatMessage> }
      conversations: { Row: Conversation; Insert: Partial<Conversation>; Update: Partial<Conversation> }
      employee_bonuses: { Row: EmployeeBonus; Insert: Partial<EmployeeBonus>; Update: Partial<EmployeeBonus> }
    }
  }
}

