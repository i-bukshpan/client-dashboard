'use client'

import { useState } from 'react'
import { Loader2, Save, Settings2, RotateCcw, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { saveClientWorkspaceSettingsAction } from '@/app/workspace/actions/tasks'
import { resetClientAgentDataAction } from '@/app/workspace/actions/dashboard-intelligence'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { ClientWorkspaceSettings } from '@/types/workspace-task'

export function ClientSettingsPanel({ initialSettings }: { initialSettings: ClientWorkspaceSettings }) {
  const router = useRouter()
  const [settings, setSettings] = useState(initialSettings)
  const [pending, setPending] = useState(false)
  const [resetPending, setResetPending] = useState(false)

  async function save() {
    setPending(true)
    const result = await saveClientWorkspaceSettingsAction(settings)
    setPending(false)
    if ('error' in result) return toast.error(result.error)
    toast.success('הגדרות הלקוח נשמרו')
  }

  function alert(key: keyof ClientWorkspaceSettings['alerts'], value: boolean) {
    setSettings((current) => ({ ...current, alerts: { ...current.alerts, [key]: value } }))
  }

  async function handleResetAgent() {
    if (!window.confirm('האם אתה בטוח שברצונך לאפס את נתוני הסוכן, היסטוריית השיחה, הפרופיל העסקי והדשבורד של לקוח זה?')) return
    setResetPending(true)
    try {
      const result = await resetClientAgentDataAction(settings.clientId, { resetDashboard: true, resetBriefs: true, resetContext: true })
      if ('error' in result) throw new Error(result.error)

      // Clean local storage chat key
      try {
        localStorage.removeItem(`nehemiah_workspace_chat_${settings.clientId}`)
      } catch {
        // ignore
      }

      toast.success('נתוני הסוכן, הפרופיל העסקי, השיחה והדשבורד אופסו בהצלחה!')
      router.refresh()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'איפוס נתוני הסוכן נכשל')
    } finally {
      setResetPending(false)
    }
  }

  async function handleResetContextOnly() {
    if (!window.confirm('האם לאפס את הפרופיל העסקי של הלקוח? השיחה והדשבורד יישמרו, אך שלב האפיון יתחיל מחדש.')) return
    setResetPending(true)
    try {
      const result = await resetClientAgentDataAction(settings.clientId, { resetDashboard: false, resetBriefs: false, resetContext: true })
      if ('error' in result) throw new Error(result.error)
      try { localStorage.removeItem(`nehemiah_workspace_chat_${settings.clientId}`) } catch { /* ignore */ }
      toast.success('הפרופיל העסקי אופס. שלב האפיון יתחיל מחדש בצ\'אט.')
      router.refresh()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'איפוס הפרופיל נכשל')
    } finally {
      setResetPending(false)
    }
  }

  return (
    <div dir="rtl" className="mx-auto max-w-3xl space-y-6 overflow-y-auto p-6">
      <header className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400">
          <Settings2 />
        </span>
        <div>
          <h2 className="font-black text-lg">הגדרות לקוח</h2>
          <p className="text-sm text-muted-foreground">ברירות מחדל לתזכורות, בריף חודשי והתראות</p>
        </div>
      </header>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <h3 className="font-bold text-foreground">תזכורות</h3>
        <div className="max-w-xs">
          <Label htmlFor="default-reminder">התראה לפני אירוע או משימה (דקות)</Label>
          <Input
            id="default-reminder"
            type="number"
            min="0"
            max="40320"
            value={settings.reminderDefaultMinutes}
            onChange={(event) => setSettings({ ...settings, reminderDefaultMinutes: Number(event.target.value) })}
          />
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-foreground">בריף חודשי</h3>
            <p className="text-xs text-muted-foreground">העדפות שישמשו את Pillar 5</p>
          </div>
          <Switch
            checked={settings.monthlyBriefEnabled}
            onCheckedChange={(value) => setSettings({ ...settings, monthlyBriefEnabled: value })}
          />
        </div>
        <div className="max-w-xs">
          <Label htmlFor="brief-day">יום בחודש</Label>
          <Input
            id="brief-day"
            type="number"
            min="1"
            max="28"
            value={settings.monthlyBriefDay}
            onChange={(event) => setSettings({ ...settings, monthlyBriefDay: Number(event.target.value) })}
          />
        </div>
        <Toggle
          label="כלול משימות"
          checked={settings.monthlyBriefIncludeTasks}
          onChange={(value) => setSettings({ ...settings, monthlyBriefIncludeTasks: value })}
        />
        <Toggle
          label="כלול אירועי יומן"
          checked={settings.monthlyBriefIncludeCalendar}
          onChange={(value) => setSettings({ ...settings, monthlyBriefIncludeCalendar: value })}
        />
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <h3 className="font-bold text-foreground">התראות פעילות</h3>
        <Toggle
          label="משימות באיחור"
          checked={settings.alerts.overdueTasks}
          onChange={(value) => alert('overdueTasks', value)}
        />
        <Toggle
          label="משימות קרובות"
          checked={settings.alerts.upcomingTasks}
          onChange={(value) => alert('upcomingTasks', value)}
        />
        <Toggle
          label="מסמכים חסרים"
          checked={settings.alerts.missingDocuments}
          onChange={(value) => alert('missingDocuments', value)}
        />
        <Toggle
          label="חריגות תזרים"
          checked={settings.alerts.cashFlow}
          onChange={(value) => alert('cashFlow', value)}
        />
      </section>

      {/* Reset Agent & Dashboard Section */}
      <section className="space-y-3 rounded-2xl border border-rose-500/30 bg-rose-500/5 p-5">
        <h3 className="font-bold text-foreground flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-rose-500" />
          איפוס נתוני סוכן AI
        </h3>

        <div className="flex items-start justify-between gap-3 py-2 border-t border-rose-200/40">
          <div>
            <p className="text-xs font-bold text-foreground">איפוס פרופיל עסקי בלבד</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              מאפס רק את שלב האפיון — השיחה והדשבורד נשמרים
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetContextOnly}
            disabled={resetPending}
            className="gap-1.5 font-bold shrink-0 border-rose-300 text-rose-600 hover:bg-rose-50"
          >
            {resetPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            איפוס אפיון
          </Button>
        </div>

        <div className="flex items-start justify-between gap-3 py-2 border-t border-rose-200/40">
          <div>
            <p className="text-xs font-bold text-foreground">איפוס מלא של כל נתוני הסוכן</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              מוחק היסטוריית שיחה, פרופיל עסקי, בריף ודשבורד — התחלה מאפס
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleResetAgent}
            disabled={resetPending}
            className="gap-1.5 font-bold shrink-0 shadow-xs"
          >
            {resetPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            איפוס מלא
          </Button>
        </div>
      </section>

      <div className="pt-2">
        <Button onClick={save} disabled={pending} className="gap-2">
          {pending ? <Loader2 className="animate-spin" /> : <Save />} שמירת הגדרות
        </Button>
      </div>
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-muted/40 px-4 py-3">
      <span className="text-sm font-medium">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}
