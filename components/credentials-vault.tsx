'use client'

import { useState, useEffect } from 'react'
import { Copy, Plus, Trash2, Eye, EyeOff, AlertTriangle } from 'lucide-react'
import { encryptPassword, decryptPassword, getSecretKey } from '@/lib/encryption'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { supabase, type ClientCredential } from '@/lib/supabase'

interface CredentialsVaultProps {
  clientId: string
  readOnly?: boolean
}

export function CredentialsVault({ clientId, readOnly = false }: CredentialsVaultProps) {
  const [credentials, setCredentials] = useState<ClientCredential[]>([])
  const [loading, setLoading] = useState(true)
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [serviceName, setServiceName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')

  const loadCredentials = async () => {
    try {
      const { data, error } = await supabase
        .from('client_credentials')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setCredentials(data || [])
    } catch (error) {
      console.error('Error loading credentials:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCredentials()
  }, [clientId])

  const handleAdd = async () => {
    if (!serviceName || !username || !password) return

    try {
      // Encrypt the password before storing
      const secretKey = getSecretKey()
      const encryptedPassword = password ? encryptPassword(password, secretKey) : null

      const { data, error } = await supabase
        .from('client_credentials')
        .insert([{
          client_id: clientId,
          service_name: serviceName,
          username: username || null,
          password: encryptedPassword || null,
          website_url: websiteUrl || null,
        }])
        .select()
        .single()

      if (error) {
        console.error('Supabase error details:', error)
        throw new Error(error.message || 'שגיאה בהוספת פרטי גישה')
      }

      setCredentials([data, ...credentials])
      setServiceName('')
      setUsername('')
      setPassword('')
      setWebsiteUrl('')
      setOpen(false)
    } catch (error) {
      console.error('Error adding credential:', error)
      const errorMessage = error instanceof Error ? error.message : 'שגיאה לא ידועה'
      alert(`שגיאה בהוספת פרטי גישה: ${errorMessage}`)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק פרטי גישה אלה?')) return

    try {
      const { error } = await supabase
        .from('client_credentials')
        .delete()
        .eq('id', id)

      if (error) throw error

      setCredentials(credentials.filter(c => c.id !== id))
    } catch (error) {
      console.error('Error deleting credential:', error)
      alert('שגיאה במחיקת פרטי גישה')
    }
  }

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (error) {
      console.error('Error copying to clipboard:', error)
    }
  }

  const togglePasswordVisibility = (id: string) => {
    setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }))
  }

  if (loading) {
    return <div className="text-center py-8 text-grey">טוען פרטי גישה...</div>
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">סיסמאות</h3>
        {!readOnly && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                הוסף פרטי גישה
              </Button>
            </DialogTrigger>
            <DialogContent dir="rtl">
              <DialogHeader>
                <DialogTitle>הוסף פרטי גישה חדשים</DialogTitle>
                <DialogDescription>
                  הזן את פרטי הגישה לשירות (בנק, אימייל, וכו')
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="serviceName">שם השירות</Label>
                  <Input
                    id="serviceName"
                    value={serviceName}
                    onChange={(e) => setServiceName(e.target.value)}
                    placeholder="לדוגמה: בנק לאומי"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="username">שם משתמש</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="שם משתמש או אימייל"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">סיסמה</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="סיסמה"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="websiteUrl">כתובת אתר (אופציונלי)</Label>
                  <Input
                    id="websiteUrl"
                    type="url"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://example.com"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  ביטול
                </Button>
                <Button onClick={handleAdd}>הוסף</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-yellow-800">
          <strong>אזהרה:</strong> פרטי גישה צריכים להיות מטופלים בזהירות.
          הסיסמאות נשמרות במערכת - ודא שיש לך הרשאות מתאימות.
        </div>
      </div>

      {credentials.length === 0 ? (
        <div className="text-center py-8 text-grey">
          אין פרטי גישה שמורים. הוסף פרטי גישה חדשים להתחיל.
        </div>
      ) : (
        <div className="space-y-3">
          {credentials.map((cred) => (
            <div
              key={cred.id}
              className="border rounded-lg p-4 bg-white hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h4 className="font-semibold text-lg mb-2">{cred.service_name}</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-grey">שם משתמש:</span>
                      <code className="text-sm bg-grey/10 px-2 py-1 rounded flex-1">
                        {cred.username}
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopy(cred.username || '', `${cred.id}-username`)}
                        className="h-8 w-8 p-0"
                      >
                        <Copy className={`h-4 w-4 ${copiedId === `${cred.id}-username` ? 'text-green-600' : ''}`} />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-grey">סיסמה:</span>
                      <code className="text-sm bg-grey/10 px-2 py-1 rounded flex-1">
                        {showPasswords[cred.id]
                          ? (cred.password ? decryptPassword(cred.password, getSecretKey()) : '')
                          : '••••••••'}
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => togglePasswordVisibility(cred.id)}
                        className="h-8 w-8 p-0"
                      >
                        {showPasswords[cred.id] ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const decrypted = cred.password ? decryptPassword(cred.password, getSecretKey()) : ''
                          handleCopy(decrypted, `${cred.id}-password`)
                        }}
                        className="h-8 w-8 p-0"
                      >
                        <Copy className={`h-4 w-4 ${copiedId === `${cred.id}-password` ? 'text-green-600' : ''}`} />
                      </Button>
                    </div>
                  </div>
                </div>
                {!readOnly && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(cred.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
