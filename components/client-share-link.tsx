import { useState, useEffect, useCallback } from 'react'
import { Copy, RefreshCw, Share2, Check, ExternalLink, Save, Eye, Pencil, Link2, Users, ChevronDown, ChevronUp, ToggleRight, ShieldOff, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { getClientShareToken, regenerateClientShareToken, updateClientSharePermissions } from '@/lib/actions/client-share'
import { useToast } from '@/components/ui/toast'
import { supabase, type ClientSharePermissions, type ClientSchema } from '@/lib/supabase'
import { cn } from '@/lib/utils'

interface ClientShareLinkProps {
  clientId: string
  clientName: string
}

const defaultPermissions: ClientSharePermissions = {
  share_enabled: true,
  allow_edit: false,
  show_overview: true,
  show_billing: true,
  show_credentials: false,
  show_notes: false,
  show_sub_clients: true,
  show_calendar: false,
  show_links: false,
  allowed_modules: []
}

const defaultSubClientPermissions: ClientSharePermissions = {
  share_enabled: true,
  allow_edit: false,
  show_overview: true,
  show_billing: false,
  show_credentials: false,
  show_notes: false,
  show_sub_clients: false,
  show_calendar: true,
  show_links: false,
  allowed_modules: []
}

interface SubClientInfo {
  id: string
  name: string
  status?: string | null
  share_token?: string | null
  share_permissions?: ClientSharePermissions | null
  shareUrl?: string
  expanded?: boolean
  copyState?: 'idle' | 'copied'
  generating?: boolean
}

export function ClientShareLink({ clientId, clientName }: ClientShareLinkProps) {
  const { showToast } = useToast()
  const [open, setOpen] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [permissions, setPermissions] = useState<ClientSharePermissions>(defaultPermissions)
  const [schemas, setSchemas] = useState<ClientSchema[]>([])
  const [savingPermissions, setSavingPermissions] = useState(false)
  const [subClients, setSubClients] = useState<SubClientInfo[]>([])
  const [subClientsLoading, setSubClientsLoading] = useState(false)

  const loadShareData = async () => {
    setLoading(true)
    try {
      const result = await getClientShareToken(clientId)
      if (result.success && result.token) {
        const baseUrl = typeof window !== 'undefined'
          ? window.location.origin
          : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        setShareUrl(`${baseUrl}/view/${result.token}`)
      }

      const { data: client } = await supabase
        .from('clients')
        .select('share_permissions')
        .eq('id', clientId)
        .single()

      if (client?.share_permissions) {
        setPermissions({ ...defaultPermissions, ...client.share_permissions })
      }

      const { data: clientSchemas } = await supabase
        .from('client_schemas')
        .select('*')
        .eq('client_id', clientId)

      if (clientSchemas) setSchemas(clientSchemas)

    } catch (error: any) {
      showToast('error', error.message || 'שגיאה בלתי צפויה')
    } finally {
      setLoading(false)
    }
  }

  const loadSubClients = useCallback(async () => {
    setSubClientsLoading(true)
    try {
      const { data } = await supabase
        .from('clients')
        .select('id, name, status, share_token, share_permissions')
        .eq('parent_id', clientId)
        .order('created_at', { ascending: true })

      if (data) {
        const base = typeof window !== 'undefined' ? window.location.origin : ''
        setSubClients(data.map(sc => ({
          ...sc,
          shareUrl: sc.share_token ? `${base}/view/${sc.share_token}` : '',
          expanded: false,
          copyState: 'idle' as const,
          generating: false,
        })))
      }
    } catch {}
    setSubClientsLoading(false)
  }, [clientId])

  useEffect(() => {
    if (open) {
      loadShareData()
      loadSubClients()
    }
  }, [open, clientId])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      showToast('success', 'קישור הועתק ללוח')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      showToast('error', 'שגיאה בהעתקת קישור')
    }
  }

  const handleRegenerate = async () => {
    if (!confirm('האם אתה בטוח? הקישור הישן יפסיק לעבוד.')) return
    setLoading(true)
    try {
      const result = await regenerateClientShareToken(clientId)
      if (result.success && result.token) {
        const base = typeof window !== 'undefined' ? window.location.origin : ''
        setShareUrl(`${base}/view/${result.token}`)
        showToast('success', 'קישור שיתוף חדש נוצר')
      } else {
        showToast('error', result.error || 'שגיאה ביצירת קישור חדש')
      }
    } catch (error: any) {
      showToast('error', error.message || 'שגיאה')
    } finally {
      setLoading(false)
    }
  }

  const handleSavePermissions = async () => {
    setSavingPermissions(true)
    try {
      const result = await updateClientSharePermissions(clientId, permissions)
      if (result.success) {
        showToast('success', 'הגדרות שיתוף נשמרו')
      } else {
        showToast('error', result.error || 'שגיאה בשמירת הגדרות')
      }
    } catch {
      showToast('error', 'שגיאה בשמירת הגדרות')
    } finally {
      setSavingPermissions(false)
    }
  }

  const toggleModule = (moduleName: string) => {
    setPermissions(prev => {
      const exists = prev.allowed_modules.includes(moduleName)
      return {
        ...prev,
        allowed_modules: exists
          ? prev.allowed_modules.filter(m => m !== moduleName)
          : [...prev.allowed_modules, moduleName]
      }
    })
  }

  const isShareEnabled = permissions.share_enabled !== false

  // Sub-client helpers
  const handleGenerateSubClientLink = async (subClientId: string) => {
    setSubClients(prev => prev.map(sc => sc.id === subClientId ? { ...sc, generating: true } : sc))
    try {
      const result = await getClientShareToken(subClientId)
      if (result.success && result.token) {
        const base = typeof window !== 'undefined' ? window.location.origin : ''
        const url = `${base}/view/${result.token}`
        setSubClients(prev => prev.map(sc =>
          sc.id === subClientId ? { ...sc, shareUrl: url, share_token: result.token, generating: false } : sc
        ))
      }
    } catch {}
    setSubClients(prev => prev.map(sc => sc.id === subClientId ? { ...sc, generating: false } : sc))
  }

  const handleCopySubClientLink = async (subClient: SubClientInfo) => {
    let url = subClient.shareUrl
    if (!url) {
      await handleGenerateSubClientLink(subClient.id)
      const updated = subClients.find(sc => sc.id === subClient.id)
      url = updated?.shareUrl || ''
    }
    if (url) {
      await navigator.clipboard.writeText(url)
      setSubClients(prev => prev.map(sc => sc.id === subClient.id ? { ...sc, copyState: 'copied' } : sc))
      setTimeout(() => setSubClients(prev => prev.map(sc => sc.id === subClient.id ? { ...sc, copyState: 'idle' } : sc)), 2000)
      showToast('success', `קישור עבור ${subClient.name} הועתק`)
    }
  }

  const handleToggleSubClientSharing = async (subClient: SubClientInfo) => {
    const currentPerms: ClientSharePermissions = subClient.share_permissions
      ? { ...defaultSubClientPermissions, ...subClient.share_permissions }
      : { ...defaultSubClientPermissions }

    const newEnabled = currentPerms.share_enabled === false ? true : false
    const newPerms = { ...currentPerms, share_enabled: newEnabled }

    setSubClients(prev => prev.map(sc =>
      sc.id === subClient.id ? { ...sc, share_permissions: newPerms } : sc
    ))

    if (newEnabled && !subClient.shareUrl) {
      await handleGenerateSubClientLink(subClient.id)
    }

    await updateClientSharePermissions(subClient.id, newPerms)
  }

  const handleUpdateSubClientPermissions = async (subClientId: string, newPerms: ClientSharePermissions) => {
    setSubClients(prev => prev.map(sc =>
      sc.id === subClientId ? { ...sc, share_permissions: newPerms } : sc
    ))
    await updateClientSharePermissions(subClientId, newPerms)
  }

  const toggleSubClientExpanded = (subClientId: string) => {
    setSubClients(prev => prev.map(sc =>
      sc.id === subClientId ? { ...sc, expanded: !sc.expanded } : sc
    ))
  }

  const permissionSections = [
    { key: 'show_overview', label: 'סקירה כללית', icon: '📋' },
    { key: 'show_billing', label: 'תשלומים וחיובים', icon: '💳' },
    { key: 'show_calendar', label: 'יומן ופגישות', icon: '📅' },
    { key: 'show_notes', label: 'פתקים ומשימות', icon: '📝' },
    { key: 'show_sub_clients', label: 'לקוחות משנה', icon: '👥' },
    { key: 'show_credentials', label: 'כספת סיסמאות', icon: '🔐' },
    { key: 'show_links', label: 'קישורים וגוגל דרייב', icon: '🔗' },
  ] as const

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 rounded-xl border-border/50 hover:bg-primary/5 hover:text-primary hover:border-primary/30 font-bold transition-all">
          <Share2 className="h-4 w-4" />
          שתף עם לקוח
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-[2rem] border-none shadow-2xl p-0">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-xl border-b border-border/30 px-8 pt-8 pb-6 rounded-t-[2rem]">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-primary/10">
              <Share2 className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-xl font-black text-navy">הגדרות שיתוף</DialogTitle>
              <p className="text-sm text-grey font-medium mt-0.5">{clientName}</p>
            </div>
          </div>

          {/* Master toggle */}
          <div className={cn(
            "mt-5 flex items-center justify-between p-4 rounded-2xl border-2 transition-all",
            isShareEnabled
              ? "bg-emerald-50/60 border-emerald-200"
              : "bg-slate-50 border-slate-200"
          )}>
            <div className="flex items-center gap-3">
              {isShareEnabled
                ? <ToggleRight className="h-5 w-5 text-emerald-600" />
                : <ShieldOff className="h-5 w-5 text-slate-400" />
              }
              <div>
                <p className={cn("font-black text-sm", isShareEnabled ? "text-emerald-800" : "text-slate-600")}>
                  {isShareEnabled ? 'שיתוף פעיל' : 'שיתוף מושבת'}
                </p>
                <p className="text-xs text-grey font-medium">
                  {isShareEnabled ? 'הלקוח יכול לגשת לקישור' : 'הקישור חסום — הלקוח לא יוכל לגשת'}
                </p>
              </div>
            </div>
            <Switch
              checked={isShareEnabled}
              onCheckedChange={(checked) => setPermissions(prev => ({ ...prev, share_enabled: checked }))}
            />
          </div>
        </div>

        <div className="px-8 pb-8 space-y-6 mt-6">
          {isShareEnabled && (
            <>
              {/* Access mode */}
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-widest text-grey">סוג גישה</h3>
                <div className="grid grid-cols-3 gap-2.5">
                  {/* View only */}
                  <button
                    onClick={() => setPermissions(prev => ({ ...prev, access_level: 'view', allow_edit: false }))}
                    className={cn(
                      "flex flex-col items-center gap-2 p-3.5 rounded-2xl border-2 transition-all text-center",
                      (permissions.access_level === 'view' || (!permissions.access_level && !permissions.allow_edit))
                        ? "border-blue-400 bg-blue-50 shadow-sm shadow-blue-100"
                        : "border-border/40 bg-slate-50/50 hover:border-border/60"
                    )}
                  >
                    <Eye className={cn("h-4 w-4", (permissions.access_level === 'view' || (!permissions.access_level && !permissions.allow_edit)) ? "text-blue-600" : "text-grey")} />
                    <div>
                      <p className={cn("font-black text-xs", (permissions.access_level === 'view' || (!permissions.access_level && !permissions.allow_edit)) ? "text-blue-800" : "text-slate-600")}>צפייה</p>
                      <p className="text-[9px] text-grey mt-0.5 font-medium leading-tight">קריאה בלבד</p>
                    </div>
                  </button>

                  {/* Edit */}
                  <button
                    onClick={() => setPermissions(prev => ({ ...prev, access_level: 'edit', allow_edit: true }))}
                    className={cn(
                      "flex flex-col items-center gap-2 p-3.5 rounded-2xl border-2 transition-all text-center",
                      (permissions.access_level === 'edit' || (!permissions.access_level && permissions.allow_edit))
                        ? "border-emerald-400 bg-emerald-50 shadow-sm shadow-emerald-100"
                        : "border-border/40 bg-slate-50/50 hover:border-border/60"
                    )}
                  >
                    <Pencil className={cn("h-4 w-4", (permissions.access_level === 'edit' || (!permissions.access_level && permissions.allow_edit)) ? "text-emerald-600" : "text-grey")} />
                    <div>
                      <p className={cn("font-black text-xs", (permissions.access_level === 'edit' || (!permissions.access_level && permissions.allow_edit)) ? "text-emerald-800" : "text-slate-600")}>עריכה</p>
                      <p className="text-[9px] text-grey mt-0.5 font-medium leading-tight">הוספה ועריכה</p>
                    </div>
                  </button>

                  {/* Portal */}
                  <button
                    onClick={() => setPermissions(prev => ({ ...prev, access_level: 'portal', allow_edit: true }))}
                    className={cn(
                      "flex flex-col items-center gap-2 p-3.5 rounded-2xl border-2 transition-all text-center",
                      permissions.access_level === 'portal'
                        ? "border-violet-400 bg-violet-50 shadow-sm shadow-violet-100"
                        : "border-border/40 bg-slate-50/50 hover:border-border/60"
                    )}
                  >
                    <Sparkles className={cn("h-4 w-4", permissions.access_level === 'portal' ? "text-violet-600" : "text-grey")} />
                    <div>
                      <p className={cn("font-black text-xs", permissions.access_level === 'portal' ? "text-violet-800" : "text-slate-600")}>פורטל</p>
                      <p className="text-[9px] text-grey mt-0.5 font-medium leading-tight">ניהול מלא + AI</p>
                    </div>
                  </button>
                </div>

                {permissions.access_level === 'portal' && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-violet-50 border border-violet-200">
                    <Sparkles className="h-4 w-4 text-violet-600 shrink-0 mt-0.5" />
                    <p className="text-xs font-medium text-violet-700 leading-relaxed">
                      הלקוח יקבל גישה לניהול מלא של התיק שלו כולל סוכן AI אישי, ניהול פגישות, פתקים, טבלאות ועוד.
                    </p>
                  </div>
                )}
              </div>

              {/* Share link */}
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-widest text-grey">קישור שיתוף</h3>
                <div className="flex gap-2">
                  <Input
                    value={shareUrl}
                    readOnly
                    className="font-mono text-sm text-left flex-1 rounded-xl border-border/40 bg-slate-50/50 h-10"
                    dir="ltr"
                    placeholder={loading ? 'טוען...' : ''}
                  />
                  <Button onClick={handleCopy} disabled={!shareUrl || loading} variant="outline" size="icon" className="rounded-xl h-10 w-10 border-border/40">
                    {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  {shareUrl && (
                    <Button onClick={() => window.open(shareUrl, '_blank')} variant="outline" size="icon" className="rounded-xl h-10 w-10 border-border/40">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <button
                  onClick={handleRegenerate}
                  disabled={loading}
                  className="flex items-center gap-1.5 text-xs font-bold text-rose-500 hover:text-rose-600 transition-colors"
                >
                  <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
                  אפס קישור (הישן יפסיק לעבוד)
                </button>
              </div>

              {/* Tabs: content + sub-clients */}
              <Tabs defaultValue="content" className="w-full">
                <TabsList className="w-full bg-slate-100/80 rounded-2xl p-1 h-11">
                  <TabsTrigger value="content" className="flex-1 rounded-xl font-black text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    תוכן וסעיפים
                  </TabsTrigger>
                  <TabsTrigger value="subclient" className="flex-1 rounded-xl font-black text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm gap-2">
                    <Users className="h-3.5 w-3.5" />
                    לקוחות משנה
                    {subClients.length > 0 && (
                      <span className="bg-primary/10 text-primary text-[10px] font-black px-1.5 py-0.5 rounded-full">
                        {subClients.length}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>

                {/* Content tab */}
                <TabsContent value="content" className="space-y-4 mt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {permissionSections.map(({ key, label, icon }) => (
                      <div key={key} className={cn(
                        "flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer",
                        permissions[key]
                          ? "bg-primary/5 border-primary/20"
                          : "bg-slate-50/50 border-border/30 hover:border-border/50"
                      )} onClick={() => setPermissions(prev => ({ ...prev, [key]: !prev[key] }))}>
                        <div className="flex items-center gap-2.5">
                          <span className="text-base">{icon}</span>
                          <Label className="cursor-pointer font-bold text-sm">{label}</Label>
                        </div>
                        <Switch
                          checked={!!permissions[key]}
                          onCheckedChange={(checked) => setPermissions(prev => ({ ...prev, [key]: checked }))}
                          onClick={e => e.stopPropagation()}
                        />
                      </div>
                    ))}
                  </div>

                  {schemas.length > 0 && (
                    <div className="space-y-2.5">
                      <h4 className="text-xs font-black uppercase tracking-widest text-grey">טבלאות מידע</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {schemas.map(schema => (
                          <div key={schema.id} className={cn(
                            "flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer",
                            permissions.allowed_modules.includes(schema.module_name)
                              ? "bg-primary/5 border-primary/20"
                              : "bg-slate-50/50 border-border/30 hover:border-border/50"
                          )} onClick={() => toggleModule(schema.module_name)}>
                            <div>
                              <Label className="cursor-pointer font-bold text-sm">{schema.module_name}</Label>
                              {schema.branch_name && <p className="text-[10px] text-grey font-medium">{schema.branch_name}</p>}
                            </div>
                            <Switch
                              checked={permissions.allowed_modules.includes(schema.module_name)}
                              onCheckedChange={() => toggleModule(schema.module_name)}
                              onClick={e => e.stopPropagation()}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* Sub-clients tab */}
                <TabsContent value="subclient" className="mt-4">
                  {subClientsLoading ? (
                    <div className="flex items-center justify-center py-10 text-grey font-bold text-sm">
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      טוען לקוחות משנה...
                    </div>
                  ) : subClients.length === 0 ? (
                    <div className="text-center py-10 text-grey font-bold text-sm">
                      <Users className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                      אין לקוחות משנה
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-grey">
                        צור קישור ייחודי לכל לקוח משנה ושלוט במה שהוא יכול לראות
                      </p>
                      {subClients.map(sc => {
                        const scPerms: ClientSharePermissions = sc.share_permissions
                          ? { ...defaultSubClientPermissions, ...sc.share_permissions }
                          : { ...defaultSubClientPermissions }
                        const scEnabled = scPerms.share_enabled !== false

                        return (
                          <div key={sc.id} className="border border-border/40 rounded-2xl overflow-hidden">
                            {/* Sub-client header row */}
                            <div className={cn(
                              "flex items-center gap-3 p-4 transition-colors",
                              scEnabled ? "bg-white" : "bg-slate-50/70"
                            )}>
                              <div className={cn(
                                "h-9 w-9 rounded-xl flex items-center justify-center font-black text-sm transition-colors",
                                scEnabled ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-400"
                              )}>
                                {sc.name.charAt(0)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={cn("font-black text-sm", scEnabled ? "text-navy" : "text-slate-400")}>{sc.name}</p>
                                <p className="text-[10px] text-grey font-medium">
                                  {scEnabled ? (scPerms.allow_edit ? 'גישת עריכה' : 'גישת צפייה') : 'שיתוף מושבת'}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {/* Copy link */}
                                {scEnabled && (
                                  <>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8 rounded-xl"
                                      disabled={sc.generating}
                                      onClick={() => handleCopySubClientLink(sc)}
                                      title="העתק קישור"
                                    >
                                      {sc.copyState === 'copied'
                                        ? <Check className="h-3.5 w-3.5 text-emerald-600" />
                                        : sc.generating
                                          ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                          : <Link2 className="h-3.5 w-3.5 text-grey" />
                                      }
                                    </Button>
                                    {sc.shareUrl && (
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8 rounded-xl"
                                        onClick={() => window.open(sc.shareUrl, '_blank')}
                                        title="פתח קישור"
                                      >
                                        <ExternalLink className="h-3.5 w-3.5 text-grey" />
                                      </Button>
                                    )}
                                  </>
                                )}
                                {/* Toggle enable */}
                                <Switch
                                  checked={scEnabled}
                                  onCheckedChange={() => handleToggleSubClientSharing(sc)}
                                />
                                {/* Expand permissions */}
                                {scEnabled && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 rounded-xl"
                                    onClick={() => toggleSubClientExpanded(sc.id)}
                                  >
                                    {sc.expanded
                                      ? <ChevronUp className="h-3.5 w-3.5 text-grey" />
                                      : <ChevronDown className="h-3.5 w-3.5 text-grey" />
                                    }
                                  </Button>
                                )}
                              </div>
                            </div>

                            {/* Expanded permissions */}
                            {sc.expanded && scEnabled && (
                              <div className="border-t border-border/30 p-4 bg-slate-50/50 space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    onClick={() => handleUpdateSubClientPermissions(sc.id, { ...scPerms, allow_edit: false })}
                                    className={cn(
                                      "flex items-center gap-2 p-2.5 rounded-xl border text-xs font-black transition-all",
                                      !scPerms.allow_edit ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white border-border/40 text-grey hover:border-border/60"
                                    )}
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                    צפייה בלבד
                                  </button>
                                  <button
                                    onClick={() => handleUpdateSubClientPermissions(sc.id, { ...scPerms, allow_edit: true })}
                                    className={cn(
                                      "flex items-center gap-2 p-2.5 rounded-xl border text-xs font-black transition-all",
                                      scPerms.allow_edit ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-white border-border/40 text-grey hover:border-border/60"
                                    )}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                    עריכה
                                  </button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  {permissionSections.filter(s => s.key !== 'show_sub_clients').map(({ key, label, icon }) => (
                                    <div key={key} className={cn(
                                      "flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer",
                                      scPerms[key]
                                        ? "bg-primary/5 border-primary/20"
                                        : "bg-white border-border/30"
                                    )} onClick={() => handleUpdateSubClientPermissions(sc.id, { ...scPerms, [key]: !scPerms[key] })}>
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-xs">{icon}</span>
                                        <span className="text-xs font-bold">{label}</span>
                                      </div>
                                      <Switch
                                        checked={!!scPerms[key]}
                                        onCheckedChange={(checked) => handleUpdateSubClientPermissions(sc.id, { ...scPerms, [key]: checked })}
                                        onClick={e => e.stopPropagation()}
                                        className="scale-75"
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}

          {/* Save */}
          <div className="flex justify-end pt-2 border-t border-border/20">
            <Button
              onClick={handleSavePermissions}
              disabled={savingPermissions}
              className="gap-2 rounded-2xl bg-primary hover:bg-primary/90 font-black px-8 h-11 shadow-lg shadow-primary/20"
            >
              <Save className="h-4 w-4" />
              {savingPermissions ? 'שומר...' : 'שמור הגדרות'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
