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
  const [identityNumber, setIdentityNumber] = useState('')
  const [additionalInfo, setAdditionalInfo] = useState('')
  const [selectedCredential, setSelectedCredential] = useState<ClientCredential | null>(null)
  const [isEditing, setIsEditing] = useState(false)

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
          identity_number: identityNumber || null,
          additional_info: additionalInfo || null,
        }])
        .select()
        .single()

      if (error) throw error

      setCredentials([data, ...credentials])
      resetForm()
      setOpen(false)
    } catch (error) {
      console.error('Error adding credential:', error)
      alert('שגיאה בהוספת פרטי גישה')
    }
  }

  const handleUpdate = async () => {
    if (!selectedCredential || !serviceName) return

    try {
      const secretKey = getSecretKey()
      // Only re-encrypt if password field is filled (assume if not changed it's already encrypted in DB, 
      // but wait - we decrypt for display in the form usually? No, let's see.)
      const encryptedPassword = password ? encryptPassword(password, secretKey) : selectedCredential.password

      const { data, error } = await supabase
        .from('client_credentials')
        .update({
          service_name: serviceName,
          username: username || null,
          password: encryptedPassword || null,
          website_url: websiteUrl || null,
          identity_number: identityNumber || null,
          additional_info: additionalInfo || null,
        })
        .eq('id', selectedCredential.id)
        .select()
        .single()

      if (error) throw error

      setCredentials(credentials.map(c => c.id === data.id ? data : c))
      resetForm()
      setOpen(false)
    } catch (error) {
      console.error('Error updating credential:', error)
      alert('שגיאה בעדכון פרטי גישה')
    }
  }

  const resetForm = () => {
    setServiceName('')
    setUsername('')
    setPassword('')
    setWebsiteUrl('')
    setIdentityNumber('')
    setAdditionalInfo('')
    setSelectedCredential(null)
    setIsEditing(false)
  }

  const openEditDialog = (cred: ClientCredential) => {
    setSelectedCredential(cred)
    setServiceName(cred.service_name)
    setUsername(cred.username || '')
    // We don't populate password for security, or we could decrypt it.
    // User requested edit, usually they want to fix a typo in username/website or update password.
    setPassword(cred.password ? decryptPassword(cred.password, getSecretKey()) : '')
    setWebsiteUrl(cred.website_url || '')
    setIdentityNumber(cred.identity_number || '')
    setAdditionalInfo(cred.additional_info || '')
    setIsEditing(true)
    setOpen(true)
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
          <Dialog open={open} onOpenChange={(val) => {
            if (!val) resetForm()
            setOpen(val)
          }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                הוסף פרטי גישה
              </Button>
            </DialogTrigger>
            <DialogContent dir="rtl" className="max-w-md">
              <DialogHeader>
                <DialogTitle>{isEditing ? 'ערוך פרטי גישה' : 'הוסף פרטי גישה חדשים'}</DialogTitle>
                <DialogDescription>
                  {isEditing ? 'עדכן את פרטי הגישה לשירות' : 'הזן את פרטי הגישה לשירות (בנק, אימייל, וכו\')'}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
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
                    <Label htmlFor="websiteUrl">כתובת אתר</Label>
                    <Input
                      id="websiteUrl"
                      type="url"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      placeholder="https://icon.com"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="username">שם משתמש</Label>
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="אימייל / כינוי"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="identityNumber">מספר זהות / ח.פ</Label>
                    <Input
                      id="identityNumber"
                      value={identityNumber}
                      onChange={(e) => setIdentityNumber(e.target.value)}
                      placeholder="מספרי זהות (אופציונלי)"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">סיסמה</Label>
                  <Input
                    id="password"
                    type="text" // Shown in clear in dialog for easier entry as requested or keep as password? 
                    // Let's keep as password but maybe toggleable? Simple for now.
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="סיסמה"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="additionalInfo">מידע נוסף / הערות</Label>
                  <Input
                    id="additionalInfo"
                    value={additionalInfo}
                    onChange={(e) => setAdditionalInfo(e.target.value)}
                    placeholder="קוד סודי, שאלות אבטחה וכו'"
                  />
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => {
                  setOpen(false)
                  resetForm()
                }}>
                  ביטול
                </Button>
                <Button onClick={isEditing ? handleUpdate : handleAdd}>
                  {isEditing ? 'עדכן שינויים' : 'הוסף'}
                </Button>
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
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-xl text-navy">{cred.service_name}</h4>
                    <div className="flex items-center gap-2">
                      {cred.website_url && (
                        <Button
                          size="sm"
                          variant="outline"
                          asChild
                          className="h-7 text-[10px] font-bold px-3 rounded-full border-blue-200 text-blue-600 hover:bg-blue-50"
                        >
                          <a href={cred.website_url} target="_blank" rel="noopener noreferrer">
                            פתיחת אתר
                          </a>
                        </Button>
                      )}
                      {!readOnly && (
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditDialog(cred)}
                            className="h-8 w-8 p-0 text-grey hover:text-navy hover:bg-slate-100"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(cred.id)}
                            className="h-8 w-8 p-0 text-rose-400 hover:text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                    {/* Username */}
                    <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl group/item">
                      <div className="flex-1 overflow-hidden">
                        <span className="text-[10px] font-bold text-grey uppercase tracking-tight block mb-0.5">שם משתמש</span>
                        <div className="font-mono text-sm truncate text-navy">{cred.username || '—'}</div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopy(cred.username || '', `${cred.id}-username`)}
                        className="h-8 w-8 p-0 opacity-0 group-hover/item:opacity-100 transition-opacity"
                      >
                        <Copy className={`h-4 w-4 ${copiedId === `${cred.id}-username` ? 'text-green-600' : ''}`} />
                      </Button>
                    </div>

                    {/* Password */}
                    <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl group/item">
                      <div className="flex-1 overflow-hidden">
                        <span className="text-[10px] font-bold text-grey uppercase tracking-tight block mb-0.5">סיסמה</span>
                        <div className="font-mono text-sm text-navy">
                          {showPasswords[cred.id]
                            ? (cred.password ? decryptPassword(cred.password, getSecretKey()) : '')
                            : '••••••••'}
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => togglePasswordVisibility(cred.id)}
                          className="h-8 w-8 p-0"
                        >
                          {showPasswords[cred.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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

                    {/* Identity Number */}
                    {cred.identity_number && (
                      <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl group/item">
                        <div className="flex-1 overflow-hidden">
                          <span className="text-[10px] font-bold text-grey uppercase tracking-tight block mb-0.5">תעודת זהות / ח.פ</span>
                          <div className="font-mono text-sm text-navy">{cred.identity_number}</div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCopy(cred.identity_number || '', `${cred.id}-id`)}
                          className="h-8 w-8 p-0 opacity-0 group-hover/item:opacity-100 transition-opacity"
                        >
                          <Copy className={`h-4 w-4 ${copiedId === `${cred.id}-id` ? 'text-green-600' : ''}`} />
                        </Button>
                      </div>
                    )}

                    {/* Additional Info */}
                    {cred.additional_info && (
                      <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl md:col-span-2">
                        <div className="flex-1">
                          <span className="text-[10px] font-bold text-grey uppercase tracking-tight block mb-0.5">מידע נוסף / הערות</span>
                          <div className="text-sm text-navy italic">{cred.additional_info}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
