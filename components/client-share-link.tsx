import { useState, useEffect } from 'react'
import { Copy, RefreshCw, Share2, Check, ExternalLink, Settings2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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

interface ClientShareLinkProps {
  clientId: string
  clientName: string
}

const defaultPermissions: ClientSharePermissions = {
  allow_edit: false,
  show_overview: true,
  show_billing: true,
  show_credentials: false,
  show_notes: false,
  allowed_modules: []
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

  const loadShareData = async () => {
    setLoading(true)
    try {
      // Load token and URL
      const result = await getClientShareToken(clientId)
      if (result.success && result.token) {
        const baseUrl = typeof window !== 'undefined'
          ? window.location.origin
          : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const url = `${baseUrl}/view/${result.token}`
        setShareUrl(url)
      } else {
        showToast('error', result.error || 'שגיאה ביצירת קישור שיתוף')
      }

      // Load current permissions
      const { data: client, error } = await supabase
        .from('clients')
        .select('share_permissions')
        .eq('id', clientId)
        .single()

      if (client?.share_permissions) {
        setPermissions(client.share_permissions)
      }

      // Load available schemas (modules)
      const { data: clientSchemas } = await supabase
        .from('client_schemas')
        .select('*')
        .eq('client_id', clientId)

      if (clientSchemas) {
        setSchemas(clientSchemas)
      }

    } catch (error: any) {
      showToast('error', error.message || 'שגיאה בלתי צפויה')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      loadShareData()
    }
  }, [open, clientId])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      showToast('success', 'קישור הועתק ללוח')
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      showToast('error', 'שגיאה בהעתקת קישור')
    }
  }

  const handleRegenerate = async () => {
    if (!confirm('האם אתה בטוח? קישור השיתוף הקודם לא יעבוד יותר.')) {
      return
    }

    setLoading(true)
    try {
      const result = await regenerateClientShareToken(clientId)
      if (result.success && result.token) {
        const baseUrl = typeof window !== 'undefined'
          ? window.location.origin
          : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const url = `${baseUrl}/view/${result.token}`
        setShareUrl(url)
        showToast('success', 'קישור שיתוף חדש נוצר')
      } else {
        showToast('error', result.error || 'שגיאה ביצירת קישור חדש')
      }
    } catch (error: any) {
      showToast('error', error.message || 'שגיאה בלתי צפויה')
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
    } catch (error) {
      showToast('error', 'שגיאה בשמירת הגדרות')
    } finally {
      setSavingPermissions(false)
    }
  }

  const toggleModule = (moduleName: string) => {
    setPermissions(prev => {
      const exists = prev.allowed_modules.includes(moduleName)
      if (exists) {
        return { ...prev, allowed_modules: prev.allowed_modules.filter(m => m !== moduleName) }
      } else {
        return { ...prev, allowed_modules: [...prev.allowed_modules, moduleName] }
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Share2 className="h-4 w-4" />
          שתף עם לקוח
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>הגדרות שיתוף עבור {clientName}</DialogTitle>
          <DialogDescription>
            נהל את המידע שהלקוח יכול לראות והאם הוא יכול לערוך אותו.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="link" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="link" className="flex-1">קישור שיתוף</TabsTrigger>
            <TabsTrigger value="permissions" className="flex-1">הרשאות ותוכן</TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="shareUrl">קישור ללקוח</Label>
              <div className="flex gap-2">
                <Input
                  id="shareUrl"
                  value={shareUrl}
                  readOnly
                  className="font-mono text-sm text-left"
                  dir="ltr"
                  placeholder={loading ? 'טוען...' : ''}
                />
                <Button
                  onClick={handleCopy}
                  disabled={!shareUrl || loading}
                  variant="outline"
                  size="icon"
                >
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
                {shareUrl && (
                  <Button
                    onClick={() => window.open(shareUrl, '_blank')}
                    variant="outline"
                    size="icon"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <Card className="p-4 bg-blue-50 border-blue-200">
              <div className="text-sm text-blue-800">
                <strong>שים לב:</strong> הקישור מאפשר גישה ללא סיסמה. שמור עליו מאובטח.
                אם הקישור דלף, ניתן ליצור חדש בכל עת (הישן יפסיק לעבוד).
              </div>
            </Card>

            <div className="pt-2">
              <Button
                variant="outline"
                onClick={handleRegenerate}
                disabled={loading}
                className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                אפס קישור שיתוף
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="permissions" className="space-y-6 py-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
                <div>
                  <Label className="text-base">מצב עריכה ללקוח</Label>
                  <p className="text-sm text-grey">האם לאפשר ללקוח לערוך נתונים?</p>
                </div>
                <Switch
                  checked={permissions.allow_edit}
                  onCheckedChange={(checked) => setPermissions(prev => ({ ...prev, allow_edit: checked }))}
                />
              </div>

              <div className="space-y-3">
                <h4 className="font-medium text-sm text-grey">מודולים כלליים</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center justify-between p-3 border rounded-md">
                    <Label htmlFor="show_overview" className="cursor-pointer">סקירה כללית</Label>
                    <Switch
                      id="show_overview"
                      checked={permissions.show_overview}
                      onCheckedChange={(checked) => setPermissions(prev => ({ ...prev, show_overview: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-md">
                    <Label htmlFor="show_billing" className="cursor-pointer">תשלומים וחיובים</Label>
                    <Switch
                      id="show_billing"
                      checked={permissions.show_billing}
                      onCheckedChange={(checked) => setPermissions(prev => ({ ...prev, show_billing: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-md">
                    <Label htmlFor="show_credentials" className="cursor-pointer">כספת סיסמאות</Label>
                    <Switch
                      id="show_credentials"
                      checked={permissions.show_credentials}
                      onCheckedChange={(checked) => setPermissions(prev => ({ ...prev, show_credentials: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-md">
                    <Label htmlFor="show_notes" className="cursor-pointer">פתקים ומשימות</Label>
                    <Switch
                      id="show_notes"
                      checked={permissions.show_notes}
                      onCheckedChange={(checked) => setPermissions(prev => ({ ...prev, show_notes: checked }))}
                    />
                  </div>
                </div>
              </div>

              {schemas.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-grey">טבלאות מידע (מודולים)</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {schemas.map(schema => (
                      <div key={schema.id} className="flex items-center justify-between p-3 border rounded-md">
                        <div>
                          <Label htmlFor={`mod_${schema.id}`} className="cursor-pointer font-medium">{schema.module_name}</Label>
                          {schema.branch_name && <p className="text-xs text-grey">{schema.branch_name}</p>}
                        </div>
                        <Switch
                          id={`mod_${schema.id}`}
                          checked={permissions.allowed_modules.includes(schema.module_name)}
                          onCheckedChange={() => toggleModule(schema.module_name)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button onClick={handleSavePermissions} disabled={savingPermissions} className="gap-2">
                <Save className="h-4 w-4" />
                {savingPermissions ? 'שומר...' : 'שמור שינויים'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

