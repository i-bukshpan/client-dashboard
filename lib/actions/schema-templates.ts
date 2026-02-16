'use server'

import { supabase } from '@/lib/supabase'
import type { ColumnDefinition } from '@/lib/supabase'

export interface SchemaTemplate {
  id: string
  name: string
  description: string
  columns: ColumnDefinition[]
  category?: string
}

// Built-in templates
export const BUILT_IN_TEMPLATES: SchemaTemplate[] = [
  {
    id: 'cash_flow',
    name: 'תזרים מזומנים',
    description: 'מעקב אחר הכנסות והוצאות',
    category: 'כספים',
    columns: [
      { name: 'date', type: 'date', label: 'תאריך', required: true },
      { name: 'description', type: 'text', label: 'תיאור', required: true },
      { name: 'income', type: 'number', label: 'הכנסה', required: false },
      { name: 'expense', type: 'number', label: 'הוצאה', required: false },
      { name: 'category', type: 'text', label: 'קטגוריה', required: false },
      { name: 'balance', type: 'calculated', label: 'יתרה', required: false, formula: { expression: 'income - expense' } },
    ],
  },
  {
    id: 'inventory',
    name: 'ניהול מלאי',
    description: 'מעקב אחר מוצרים במלאי',
    category: 'לוגיסטיקה',
    columns: [
      { name: 'product_name', type: 'text', label: 'שם מוצר', required: true },
      { name: 'sku', type: 'text', label: 'קוד מוצר', required: false },
      { name: 'quantity', type: 'number', label: 'כמות', required: true },
      { name: 'unit_price', type: 'number', label: 'מחיר יחידה', required: false },
      { name: 'total_value', type: 'calculated', label: 'ערך כולל', required: false, formula: { expression: 'quantity * unit_price' } },
      { name: 'location', type: 'text', label: 'מיקום', required: false },
      { name: 'last_updated', type: 'date', label: 'עודכן לאחרונה', required: false },
    ],
  },
  {
    id: 'investments',
    name: 'מעקב השקעות',
    description: 'ניהול השקעות ופורטפוליו',
    category: 'כספים',
    columns: [
      { name: 'investment_name', type: 'text', label: 'שם השקעה', required: true },
      { name: 'investment_type', type: 'text', label: 'סוג השקעה', required: false },
      { name: 'amount_invested', type: 'number', label: 'סכום מושקע', required: true },
      { name: 'current_value', type: 'number', label: 'ערך נוכחי', required: false },
      { name: 'profit_loss', type: 'calculated', label: 'רווח/הפסד', required: false, formula: { expression: 'current_value - amount_invested' } },
      { name: 'investment_date', type: 'date', label: 'תאריך השקעה', required: false },
    ],
  },
  {
    id: 'project_management',
    name: 'ניהול פרויקטים',
    description: 'מעקב אחר משימות ופרויקטים',
    category: 'ניהול',
    columns: [
      { name: 'project_name', type: 'text', label: 'שם פרויקט', required: true },
      { name: 'status', type: 'text', label: 'סטטוס', required: false },
      { name: 'start_date', type: 'date', label: 'תאריך התחלה', required: false },
      { name: 'end_date', type: 'date', label: 'תאריך סיום', required: false },
      { name: 'budget', type: 'number', label: 'תקציב', required: false },
      { name: 'spent', type: 'number', label: 'הוצא', required: false },
      { name: 'remaining', type: 'calculated', label: 'נותר', required: false, formula: { expression: 'budget - spent' } },
    ],
  },
  {
    id: 'customer_relations',
    name: 'מעקב לקוחות',
    description: 'ניהול קשרים עם לקוחות',
    category: 'מכירות',
    columns: [
      { name: 'customer_name', type: 'text', label: 'שם לקוח', required: true },
      { name: 'contact_email', type: 'text', label: 'אימייל', required: false },
      { name: 'contact_phone', type: 'text', label: 'טלפון', required: false },
      { name: 'last_contact', type: 'date', label: 'יצירת קשר אחרונה', required: false },
      { name: 'total_orders', type: 'number', label: 'סה"כ הזמנות', required: false },
      { name: 'total_revenue', type: 'number', label: 'סה"כ הכנסות', required: false },
    ],
  },
  {
    id: 'expense_tracking',
    name: 'מעקב הוצאות',
    description: 'פירוט הוצאות לפי קטגוריות',
    category: 'כספים',
    columns: [
      { name: 'date', type: 'date', label: 'תאריך', required: true },
      { name: 'description', type: 'text', label: 'תיאור', required: true },
      { name: 'category', type: 'text', label: 'קטגוריה', required: false },
      { name: 'amount', type: 'number', label: 'סכום', required: true },
      { name: 'payment_method', type: 'text', label: 'אמצעי תשלום', required: false },
      { name: 'receipt_number', type: 'text', label: 'מספר קבלה', required: false },
    ],
  },
]

/**
 * Server Action: Get all available schema templates
 */
export async function getSchemaTemplates(): Promise<{ success: boolean; templates?: SchemaTemplate[]; error?: string }> {
  try {
    // For now, return built-in templates
    // In the future, could also fetch user-created templates from database
    return { success: true, templates: BUILT_IN_TEMPLATES }
  } catch (error: any) {
    console.error('Error fetching templates:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Server Action: Get a specific template by ID
 */
export async function getSchemaTemplate(templateId: string): Promise<{ success: boolean; template?: SchemaTemplate; error?: string }> {
  try {
    const template = BUILT_IN_TEMPLATES.find(t => t.id === templateId)
    if (!template) {
      return { success: false, error: 'Template not found' }
    }
    return { success: true, template }
  } catch (error: any) {
    console.error('Error fetching template:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

