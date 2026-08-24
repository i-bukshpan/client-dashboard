import 'server-only'

import { getWorkspaceAdminDb, getWorkspaceClient, requireWorkspaceAdmin } from '@/lib/v2/workspace-dal'
import type { ClientWorkspaceSettings } from '@/types/workspace-task'

const DEFAULTS = {
  reminderDefaultMinutes: 30,
  monthlyBriefEnabled: true,
  monthlyBriefDay: 1,
  monthlyBriefIncludeTasks: true,
  monthlyBriefIncludeCalendar: true,
  alerts: { overdueTasks: true, upcomingTasks: true, missingDocuments: false, cashFlow: false },
}

function mapSettings(clientId: string, row: Record<string, unknown> | null): ClientWorkspaceSettings {
  const alerts = (row?.alerts && typeof row.alerts === 'object' ? row.alerts : {}) as Record<string, unknown>
  return {
    clientId,
    reminderDefaultMinutes: Number(row?.reminder_default_minutes ?? DEFAULTS.reminderDefaultMinutes),
    monthlyBriefEnabled: Boolean(row?.monthly_brief_enabled ?? DEFAULTS.monthlyBriefEnabled),
    monthlyBriefDay: Number(row?.monthly_brief_day ?? DEFAULTS.monthlyBriefDay),
    monthlyBriefIncludeTasks: Boolean(row?.monthly_brief_include_tasks ?? DEFAULTS.monthlyBriefIncludeTasks),
    monthlyBriefIncludeCalendar: Boolean(row?.monthly_brief_include_calendar ?? DEFAULTS.monthlyBriefIncludeCalendar),
    alerts: {
      overdueTasks: Boolean(alerts.overdue_tasks ?? DEFAULTS.alerts.overdueTasks),
      upcomingTasks: Boolean(alerts.upcoming_tasks ?? DEFAULTS.alerts.upcomingTasks),
      missingDocuments: Boolean(alerts.missing_documents ?? DEFAULTS.alerts.missingDocuments),
      cashFlow: Boolean(alerts.cash_flow ?? DEFAULTS.alerts.cashFlow),
    },
  }
}

export async function getClientWorkspaceSettings(clientId: string): Promise<ClientWorkspaceSettings> {
  await requireWorkspaceAdmin()
  await getWorkspaceClient(clientId)
  const { data, error } = await getWorkspaceAdminDb().from('v2_client_settings').select('reminder_default_minutes, monthly_brief_enabled, monthly_brief_day, monthly_brief_include_tasks, monthly_brief_include_calendar, alerts').eq('client_id', clientId).maybeSingle()
  if (error) throw new Error(`[client-settings] Query failed: ${error.message}`)
  return mapSettings(clientId, data as Record<string, unknown> | null)
}

export async function saveClientWorkspaceSettings(settings: ClientWorkspaceSettings): Promise<ClientWorkspaceSettings> {
  const session = await requireWorkspaceAdmin()
  await getWorkspaceClient(settings.clientId)
  const { error } = await getWorkspaceAdminDb().from('v2_client_settings').upsert({
    client_id: settings.clientId,
    reminder_default_minutes: settings.reminderDefaultMinutes,
    monthly_brief_enabled: settings.monthlyBriefEnabled,
    monthly_brief_day: settings.monthlyBriefDay,
    monthly_brief_include_tasks: settings.monthlyBriefIncludeTasks,
    monthly_brief_include_calendar: settings.monthlyBriefIncludeCalendar,
    alerts: { overdue_tasks: settings.alerts.overdueTasks, upcoming_tasks: settings.alerts.upcomingTasks, missing_documents: settings.alerts.missingDocuments, cash_flow: settings.alerts.cashFlow },
    updated_by: session.user.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'client_id' })
  if (error) throw new Error(`[client-settings] Update failed: ${error.message}`)
  return settings
}
