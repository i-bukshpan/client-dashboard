export type ProjectStatus = 'active' | 'pending' | 'closed'
export type TransactionType = 'income' | 'expense'
export type EventType = 'meeting' | 'reminder' | 'other'

export interface MosheProject {
  id: string
  name: string
  address: string | null
  contact_name: string | null
  contact_phone: string | null
  total_project_cost: number | null
  notes: string | null
  status: ProjectStatus
  start_date: string | null
  created_at: string
}

export interface MosheProjectPayment {
  id: string
  project_id: string
  amount: number
  due_date: string | null
  notes: string | null
  is_paid: boolean
  paid_at: string | null
  created_at: string
}

export interface MosheBuyer {
  id: string
  project_id: string
  name: string
  phone: string | null
  email: string | null
  id_number: string | null
  unit_description: string | null
  contract_date: string | null
  total_amount: number | null
  notes: string | null
  created_at: string
}

export interface MosheBuyerPayment {
  id: string
  buyer_id: string
  project_id: string
  amount: number
  due_date: string | null
  notes: string | null
  is_received: boolean
  received_at: string | null
  created_at: string
}

export interface MosheTransaction {
  id: string
  project_id: string
  type: TransactionType
  amount: number
  date: string
  category: string | null
  notes: string | null
  created_at: string
}

export interface MosheCalendarEvent {
  id: string
  title: string
  start_time: string
  end_time: string | null
  notes: string | null
  type: EventType
  created_at: string
}

// Aggregated types for display
export interface ProjectWithStats extends MosheProject {
  total_paid: number        // הוצאות ששולמו בפועל
  total_scheduled: number   // סה"כ לוח תשלומים
  total_received: number    // הכנסות שהתקבלו
  total_expected: number    // סה"כ הכנסות צפויות
  buyers_count: number
}

export interface PaymentRow {
  amount: string
  due_date: string
  notes: string
}
