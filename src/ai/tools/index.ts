/**
 * src/ai/tools/index.ts
 *
 * אגרגטור כל הכלים.
 * מייצא:
 *  - allDeclarations — מערך הצהרות לGemini (מסונן לפי הרשאות)
 *  - executeToolCall — ניתוב קריאת כלי למימוש הנכון
 *  - WRITE_TOOLS — סט שמות כלים שדורשים אישור
 */

import type { FunctionDeclaration } from '@google/generative-ai'
import type { UserContext } from '../context'

// ── imports: declarations ──────────────────────────────────────────────────────
import {
  getFinanceSummaryDeclaration, getFinanceSummary,
  addIncomeDeclaration, addIncome, executeAddIncome,
  addExpenseDeclaration, addExpense, executeAddExpense,
} from './financeTools'

import {
  getUpcomingAppointmentsDeclaration, getUpcomingAppointments,
  createAppointmentDeclaration, createAppointment, executeCreateAppointment,
  cancelAppointmentDeclaration, cancelAppointment, executeCancelAppointment,
  updateAppointmentStatusDeclaration, updateAppointmentStatus, executeUpdateAppointmentStatus,
} from './appointmentTools'

import {
  getOpenTasksDeclaration, getOpenTasks,
  createTaskDeclaration, createTask, executeCreateTask,
  updateTaskStatusDeclaration, updateTaskStatus, executeUpdateTaskStatus,
} from './taskTools'

import {
  searchClientsDeclaration, searchClients,
  getClientDetailsDeclaration, getClientDetails,
  createClientDeclaration, createClientTool, executeCreateClient,
} from './clientTools'

import {
  listProjectsDeclaration, listProjects,
  getProjectBalanceDeclaration, getProjectBalance,
  getProjectSummaryDeclaration, getProjectSummary,
  getPendingPaymentsDeclaration, getPendingPayments,
  addProjectPaymentDeclaration, addProjectPayment, executeAddProjectPayment,
  markPaymentPaidDeclaration, markPaymentPaid, executeMarkPaymentPaid,
  addTransactionDeclaration, addTransaction, executeAddTransaction,
  addBuyerDeclaration, addBuyer, executeAddBuyer,
  getOverdueAlertsDeclaration, getOverdueAlerts,
  getPortalActivityLogDeclaration, getPortalActivityLog,
} from './mosheProjectTools'

import {
  listPartnersDeclaration, listPartners,
  getPartnerSummaryDeclaration, getPartnerSummary,
  addPartnerTransactionDeclaration, addPartnerTransaction, executeAddPartnerTransaction,
} from './partnerTools'

import {
  getMosheCalendarEventsDeclaration, getMosheCalendarEvents,
  createMosheCalendarEventDeclaration, createMosheCalendarEvent, executeCreateMosheCalendarEvent,
  cancelMosheCalendarEventDeclaration, cancelMosheCalendarEvent, executeCancelMosheCalendarEvent,
} from './mosheCalendarTools'

import {
  listWorkersDeclaration, listWorkers,
  getWorkerTasksMosheDeclaration, getWorkerTasksMoshe,
  completeWorkerTaskDeclaration, completeWorkerTask, executeCompleteWorkerTask,
  addWorkerLogDeclaration, addWorkerLog, executeAddWorkerLog,
  getWorkerMessagesDeclaration, getWorkerMessages,
  createWorkerMessageDeclaration, createWorkerMessage, executeCreateWorkerMessage,
} from './workerTools'

import {
  getLoansSummaryDeclaration, getLoansSummary,
  getPendingLoanPaymentsDeclaration, getPendingLoanPayments,
  markLoanPaymentPaidDeclaration, markLoanPaymentPaid, executeMarkLoanPaymentPaid,
} from './loanTools'

import {
  createReminderDeclaration, createReminder, executeCreateReminder,
  listMyRemindersDeclaration, listMyReminders,
  deleteReminderDeclaration, deleteReminder, executeDeleteReminder,
} from './reminderTools'

// ── כלי כתיבה שדורשים אישור ───────────────────────────────────────────────────
export const WRITE_TOOLS = new Set([
  'addIncome', 'addExpense',
  'createAppointment', 'cancelAppointment', 'updateAppointmentStatus',
  'createTask', 'updateTaskStatus',
  'createClient',
  'addBuyer', 'addProjectPayment', 'markPaymentPaid', 'addTransaction',
  'addPartnerTransaction',
  'completeWorkerTask', 'addWorkerLog', 'createWorkerMessage',
  'markLoanPaymentPaid',
  'createMosheCalendarEvent', 'cancelMosheCalendarEvent',
  'createReminder', 'deleteReminder',
])

// ── מיפוי שם-כלי → הצהרה ─────────────────────────────────────────────────────
const declarationMap: Record<string, FunctionDeclaration> = {
  getFinanceSummary: getFinanceSummaryDeclaration,
  addIncome: addIncomeDeclaration,
  addExpense: addExpenseDeclaration,
  getUpcomingAppointments: getUpcomingAppointmentsDeclaration,
  createAppointment: createAppointmentDeclaration,
  cancelAppointment: cancelAppointmentDeclaration,
  updateAppointmentStatus: updateAppointmentStatusDeclaration,
  getOpenTasks: getOpenTasksDeclaration,
  createTask: createTaskDeclaration,
  updateTaskStatus: updateTaskStatusDeclaration,
  searchClients: searchClientsDeclaration,
  getClientDetails: getClientDetailsDeclaration,
  createClient: createClientDeclaration,
  listProjects: listProjectsDeclaration,
  getProjectBalance: getProjectBalanceDeclaration,
  getProjectSummary: getProjectSummaryDeclaration,
  getPendingPayments: getPendingPaymentsDeclaration,
  addProjectPayment: addProjectPaymentDeclaration,
  markPaymentPaid: markPaymentPaidDeclaration,
  addTransaction: addTransactionDeclaration,
  addBuyer: addBuyerDeclaration,
  getOverdueAlerts: getOverdueAlertsDeclaration,
  getPortalActivityLog: getPortalActivityLogDeclaration,
  listPartners: listPartnersDeclaration,
  getPartnerSummary: getPartnerSummaryDeclaration,
  addPartnerTransaction: addPartnerTransactionDeclaration,
  getMosheCalendarEvents: getMosheCalendarEventsDeclaration,
  createMosheCalendarEvent: createMosheCalendarEventDeclaration,
  cancelMosheCalendarEvent: cancelMosheCalendarEventDeclaration,
  listWorkers: listWorkersDeclaration,
  getWorkerTasksMoshe: getWorkerTasksMosheDeclaration,
  completeWorkerTask: completeWorkerTaskDeclaration,
  addWorkerLog: addWorkerLogDeclaration,
  getWorkerMessages: getWorkerMessagesDeclaration,
  createWorkerMessage: createWorkerMessageDeclaration,
  getLoansSummary: getLoansSummaryDeclaration,
  getPendingLoanPayments: getPendingLoanPaymentsDeclaration,
  markLoanPaymentPaid: markLoanPaymentPaidDeclaration,
  createReminder: createReminderDeclaration,
  listMyReminders: listMyRemindersDeclaration,
  deleteReminder: deleteReminderDeclaration,
}

/**
 * מחזיר רק את ההצהרות שמותרות לרול המשתמש הנוכחי.
 */
export function getAllowedDeclarations(ctx: UserContext): FunctionDeclaration[] {
  return ctx.allowedTools
    .filter((name) => declarationMap[name])
    .map((name) => declarationMap[name])
}

/**
 * מבצע קריאה לכלי ומחזיר תוצאה.
 * תמיד מעביר את ה-UserContext כדי שכלים יוכלו לסנן לפי הרשאות.
 */
export async function executeToolCall(
  toolName: string,
  args: Record<string, any>,
  ctx: UserContext
): Promise<Record<string, unknown>> {
  // בדיקת הרשאה אחרונה (defense in depth)
  if (!ctx.allowedTools.includes(toolName)) {
    return { error: 'אין לך הרשאה לבצע פעולה זו.' }
  }

  // ── קריאות READ ────────────────────────────────────────────────────────────
  switch (toolName) {
    // Finance
    case 'getFinanceSummary':
      return getFinanceSummary(args)

    // Appointments
    case 'getUpcomingAppointments':
      return getUpcomingAppointments(args)

    // Tasks
    case 'getOpenTasks':
      return getOpenTasks(args)

    // Clients
    case 'searchClients':
      return searchClients(args)
    case 'getClientDetails':
      return getClientDetails(args)

    // Moshe Projects
    case 'listProjects':
      return listProjects(args, ctx.allowedProjectIds)
    case 'getProjectBalance':
      return getProjectBalance(args)
    case 'getProjectSummary':
      return getProjectSummary(args)
    case 'getPendingPayments':
      return getPendingPayments(args)
    case 'getOverdueAlerts':
      return getOverdueAlerts()
    case 'getPortalActivityLog':
      return getPortalActivityLog(args)

    // Partners
    case 'listPartners':
      return listPartners(args, ctx.allowedProjectIds)
    case 'getPartnerSummary':
      return getPartnerSummary(args, ctx.role === 'partner' ? ctx.refId : undefined)

    // Workers
    case 'listWorkers':
      return listWorkers(args)
    case 'getWorkerTasksMoshe':
      return getWorkerTasksMoshe(args, ctx.role === 'worker' ? ctx.refId : undefined)
    case 'getWorkerMessages':
      return getWorkerMessages(args, ctx.role === 'worker' ? ctx.refId : undefined)

    // Loans
    case 'getLoansSummary':
      return getLoansSummary(args)
    case 'getPendingLoanPayments':
      return getPendingLoanPayments(args)

    // Moshe Calendar
    case 'getMosheCalendarEvents':
      return getMosheCalendarEvents(args)

    // ── קריאות WRITE (מחזירות pending לאישור) ─────────────────────────────────
    case 'addIncome':
      return addIncome(args, ctx.refId)
    case 'addExpense':
      return addExpense(args, ctx.refId)
    case 'createAppointment':
      return createAppointment(args)
    case 'cancelAppointment':
      return cancelAppointment(args)
    case 'updateAppointmentStatus':
      return updateAppointmentStatus(args)
    case 'createTask':
      return createTask(args)
    case 'updateTaskStatus':
      return updateTaskStatus(args)
    case 'createClient':
      return createClientTool(args)
    case 'addBuyer':
      return addBuyer(args)
    case 'addProjectPayment':
      return addProjectPayment(args)
    case 'markPaymentPaid':
      return markPaymentPaid(args)
    case 'addTransaction':
      return addTransaction(args)
    case 'addPartnerTransaction':
      return addPartnerTransaction(args)
    case 'completeWorkerTask':
      return completeWorkerTask(args, ctx.role === 'worker' ? ctx.refId : undefined)
    case 'addWorkerLog':
      return addWorkerLog(args, ctx.refId)
    case 'createWorkerMessage':
      return createWorkerMessage(args)
    case 'markLoanPaymentPaid':
      return markLoanPaymentPaid(args)
    case 'createMosheCalendarEvent':
      return createMosheCalendarEvent(args as any)
    case 'cancelMosheCalendarEvent':
      return cancelMosheCalendarEvent(args as any)

    // Reminders
    case 'listMyReminders':
      return listMyReminders(ctx)
    case 'createReminder':
      return createReminder(args as any, { phone: ctx.phone, name: ctx.name })
    case 'deleteReminder':
      return deleteReminder(args as any, { phone: ctx.phone })

    default:
      return { error: `כלי לא מוכר: ${toolName}` }
  }
}

/**
 * מבצע פעולת כתיבה אחרי קבלת אישור מהמשתמש.
 */
export async function executeConfirmedAction(
  actionType: string,
  actionParams: Record<string, any>
): Promise<Record<string, unknown>> {
  switch (actionType) {
    case 'addIncome':             return executeAddIncome(actionParams as any)
    case 'addExpense':            return executeAddExpense(actionParams as any)
    case 'createAppointment':     return executeCreateAppointment(actionParams as any)
    case 'cancelAppointment':     return executeCancelAppointment(actionParams as any)
    case 'updateAppointmentStatus': return executeUpdateAppointmentStatus(actionParams as any)
    case 'createTask':            return executeCreateTask(actionParams as any)
    case 'updateTaskStatus':      return executeUpdateTaskStatus(actionParams as any)
    case 'createClient':          return executeCreateClient(actionParams as any)
    case 'addBuyer':              return executeAddBuyer(actionParams as any)
    case 'addProjectPayment':     return executeAddProjectPayment(actionParams as any)
    case 'markPaymentPaid':       return executeMarkPaymentPaid(actionParams as any)
    case 'addTransaction':        return executeAddTransaction(actionParams as any)
    case 'addPartnerTransaction': return executeAddPartnerTransaction(actionParams as any)
    case 'completeWorkerTask':    return executeCompleteWorkerTask(actionParams as any)
    case 'addWorkerLog':          return executeAddWorkerLog(actionParams as any)
    case 'createWorkerMessage':   return executeCreateWorkerMessage(actionParams as any)
    case 'markLoanPaymentPaid':   return executeMarkLoanPaymentPaid(actionParams as any)
    case 'createMosheCalendarEvent': return executeCreateMosheCalendarEvent(actionParams as any)
    case 'cancelMosheCalendarEvent': return executeCancelMosheCalendarEvent(actionParams as any)
    case 'createReminder':   return executeCreateReminder(actionParams as any)
    case 'deleteReminder':   return executeDeleteReminder(actionParams as any)
    default:
      return { success: false, error: `פעולה לא מוכרת: ${actionType}` }
  }
}
