'use client'

import { useState } from 'react'
import { Loader2, Save, Settings2 } from 'lucide-react'
import { toast } from 'sonner'
import { saveClientWorkspaceSettingsAction } from '@/app/workspace/actions/tasks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { ClientWorkspaceSettings } from '@/types/workspace-task'

export function ClientSettingsPanel({ initialSettings }: { initialSettings: ClientWorkspaceSettings }) {
  const [settings, setSettings] = useState(initialSettings)
  const [pending, setPending] = useState(false)
  async function save() { setPending(true); const result = await saveClientWorkspaceSettingsAction(settings); setPending(false); if ('error' in result) return toast.error(result.error); toast.success('הגדרות הלקוח נשמרו') }
  function alert(key: keyof ClientWorkspaceSettings['alerts'], value: boolean) { setSettings((current) => ({ ...current, alerts: { ...current.alerts, [key]: value } })) }
  return <div dir="rtl" className="mx-auto max-w-3xl space-y-6 overflow-y-auto p-6"><header className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400"><Settings2 /></span><div><h2 className="font-black">הגדרות לקוח</h2><p className="text-sm text-muted-foreground">ברירות מחדל לתזכורות, בריף חודשי והתראות</p></div></header>
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5"><h3 className="font-bold">תזכורות</h3><div className="max-w-xs"><Label htmlFor="default-reminder">התראה לפני אירוע או משימה (דקות)</Label><Input id="default-reminder" type="number" min="0" max="40320" value={settings.reminderDefaultMinutes} onChange={(event) => setSettings({ ...settings, reminderDefaultMinutes: Number(event.target.value) })} /></div></section>
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5"><div className="flex items-center justify-between"><div><h3 className="font-bold">בריף חודשי</h3><p className="text-xs text-muted-foreground">העדפות שישמשו את Pillar 5</p></div><Switch checked={settings.monthlyBriefEnabled} onCheckedChange={(value) => setSettings({ ...settings, monthlyBriefEnabled: value })} /></div><div className="max-w-xs"><Label htmlFor="brief-day">יום בחודש</Label><Input id="brief-day" type="number" min="1" max="28" value={settings.monthlyBriefDay} onChange={(event) => setSettings({ ...settings, monthlyBriefDay: Number(event.target.value) })} /></div><Toggle label="כלול משימות" checked={settings.monthlyBriefIncludeTasks} onChange={(value) => setSettings({ ...settings, monthlyBriefIncludeTasks: value })} /><Toggle label="כלול אירועי יומן" checked={settings.monthlyBriefIncludeCalendar} onChange={(value) => setSettings({ ...settings, monthlyBriefIncludeCalendar: value })} /></section>
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5"><h3 className="font-bold">התראות פעילות</h3><Toggle label="משימות באיחור" checked={settings.alerts.overdueTasks} onChange={(value) => alert('overdueTasks', value)} /><Toggle label="משימות קרובות" checked={settings.alerts.upcomingTasks} onChange={(value) => alert('upcomingTasks', value)} /><Toggle label="מסמכים חסרים" checked={settings.alerts.missingDocuments} onChange={(value) => alert('missingDocuments', value)} /><Toggle label="חריגות תזרים" checked={settings.alerts.cashFlow} onChange={(value) => alert('cashFlow', value)} /></section>
    <Button onClick={save} disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : <Save />} שמירת הגדרות</Button>
  </div>
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <div className="flex items-center justify-between rounded-xl bg-muted/40 px-4 py-3"><span className="text-sm font-medium">{label}</span><Switch checked={checked} onCheckedChange={onChange} /></div> }
