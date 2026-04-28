'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Megaphone, Plus, Trash2, Loader2, Edit3, X, Check, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/use-toast'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Announcement {
  id: string
  title: string
  content: string
  is_active: boolean
  target_employee_id: string | null
  created_at: string
}

interface Employee {
  id: string
  full_name: string
}

export function AdminEmployeeAnnouncements({ announcements: initialAnnouncements, employees }: { announcements: Announcement[], employees: Employee[] }) {
  const [announcements, setAnnouncements] = useState(initialAnnouncements)
  const [isAdding, setIsAdding] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ title: '', content: '', target_employee_id: '' })
  const [newForm, setNewForm] = useState({ title: '', content: '', target_employee_id: 'all' })
  const { toast } = useToast()
  const supabase = createClient()
  const router = useRouter()

  function getEmployeeName(id: string | null) {
    if (!id) return 'כל העובדים'
    return employees.find(e => e.id === id)?.full_name || 'עובד לא ידוע'
  }

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!newForm.title || !newForm.content) return
    setIsLoading(true)

    const insertData: any = { title: newForm.title, content: newForm.content, is_active: true }
    if (newForm.target_employee_id && newForm.target_employee_id !== 'all') {
      insertData.target_employee_id = newForm.target_employee_id
    }

    const { data, error } = await (supabase.from('employee_announcements') as any).insert(insertData).select().single()
    setIsLoading(false)

    if (error) {
      toast({ title: 'שגיאה', description: 'שגיאה ביצירת הודעה', variant: 'destructive' })
    } else {
      toast({ title: 'הצלחה', description: 'הודעה נוצרה בהצלחה' })
      setAnnouncements(prev => [data as Announcement, ...prev])
      setIsAdding(false)
      setNewForm({ title: '', content: '', target_employee_id: 'all' })
    }
  }

  async function handleEdit(id: string) {
    setIsLoading(true)
    const updateData: any = { title: editForm.title, content: editForm.content }
    if (editForm.target_employee_id && editForm.target_employee_id !== 'all') {
      updateData.target_employee_id = editForm.target_employee_id
    } else {
      updateData.target_employee_id = null
    }

    const { data, error } = await (supabase.from('employee_announcements') as any).update(updateData).eq('id', id).select().single()
    setIsLoading(false)

    if (error) {
      toast({ title: 'שגיאה', description: 'שגיאה בעדכון הודעה', variant: 'destructive' })
    } else {
      toast({ title: 'הצלחה', description: 'ההודעה עודכנה' })
      setAnnouncements(prev => prev.map(a => a.id === id ? (data as Announcement) : a))
      setEditingId(null)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('האם אתה בטוח שברצונך למחוק הודעה זו?')) return
    const { error } = await (supabase.from('employee_announcements') as any).delete().eq('id', id)
    if (error) {
      toast({ title: 'שגיאה', description: 'שגיאה במחיקת ההודעה', variant: 'destructive' })
    } else {
      toast({ title: 'נמחק', description: 'ההודעה הוסרה' })
      setAnnouncements(prev => prev.filter(a => a.id !== id))
    }
  }

  async function toggleActive(id: string, current: boolean) {
    const { error } = await (supabase.from('employee_announcements') as any).update({ is_active: !current }).eq('id', id)
    if (!error) {
      setAnnouncements(prev => prev.map(a => a.id === id ? { ...a, is_active: !current } : a))
    }
  }

  function startEdit(ann: Announcement) {
    setEditingId(ann.id)
    setEditForm({
      title: ann.title,
      content: ann.content,
      target_employee_id: ann.target_employee_id || 'all'
    })
  }

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between py-4 border-b border-border/50 bg-muted/20">
        <CardTitle className="text-lg flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-primary" />
          הודעות מערכת לעובדים
          {announcements.length > 0 && (
            <Badge variant="secondary" className="text-xs ml-1">{announcements.length}</Badge>
          )}
        </CardTitle>
        <Button size="sm" onClick={() => { setIsAdding(!isAdding); setEditingId(null) }} variant={isAdding ? 'outline' : 'default'}>
          {isAdding ? <><X className="w-4 h-4 me-1" /> ביטול</> : <><Plus className="w-4 h-4 me-1" /> הודעה חדשה</>}
        </Button>
      </CardHeader>
      <CardContent className="p-4 space-y-4">

        {/* Add Form */}
        {isAdding && (
          <form onSubmit={handleAdd} className="space-y-3 bg-blue-50/50 p-4 rounded-xl border border-blue-100 animate-in fade-in slide-in-from-top-2 duration-300">
            <p className="text-sm font-bold text-blue-800 mb-3">📢 פרסום הודעה חדשה לצוות</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-600">כותרת ההודעה *</Label>
                <Input
                  value={newForm.title}
                  onChange={e => setNewForm({ ...newForm, title: e.target.value })}
                  placeholder="לדוגמה: עדכון מדיניות, שינוי שעות..."
                  required
                  className="bg-white"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-600">למי מיועדת ההודעה?</Label>
                <Select value={newForm.target_employee_id as any} onValueChange={v => setNewForm({ ...newForm, target_employee_id: v as any })}>
                  <SelectTrigger className="bg-white">
                    <SelectValue>
                      {newForm.target_employee_id === 'all' ? (
                        <span className="flex items-center gap-2"><Users className="w-4 h-4 text-blue-500" /> כל העובדים</span>
                      ) : (
                        employees.find(e => e.id === newForm.target_employee_id)?.full_name || 'בחר עובד'
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <span className="flex items-center gap-2"><Users className="w-4 h-4" /> כל העובדים</span>
                    </SelectItem>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-600">תוכן ההודעה *</Label>
              <Textarea
                value={newForm.content}
                onChange={e => setNewForm({ ...newForm, content: e.target.value })}
                placeholder="תוכן ההודעה שיוצג לעובדים בלוח הבקרה שלהם..."
                required
                className="resize-y bg-white min-h-[100px]"
              />
            </div>
            <Button type="submit" disabled={isLoading} className="w-full shadow-md">
              {isLoading && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
              פרסם הודעה עכשיו
            </Button>
          </form>
        )}

        {/* Announcements List */}
        <div className="space-y-3">
          {announcements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Megaphone className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm italic">אין הודעות פעילות לעובדים</p>
            </div>
          ) : (
            announcements.map(ann => (
              <div
                key={ann.id}
                className={`p-4 border rounded-xl bg-white shadow-sm transition-all ${!ann.is_active ? 'opacity-50 grayscale' : ''} ${editingId === ann.id ? 'ring-2 ring-blue-400' : ''}`}
              >
                {editingId === ann.id ? (
                  /* Edit Mode */
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-blue-700 mb-2">✏️ עריכת הודעה</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-500">כותרת</Label>
                        <Input
                          value={editForm.title}
                          onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                          className="bg-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-500">מיועד ל</Label>
                        <Select value={editForm.target_employee_id as any} onValueChange={v => setEditForm({ ...editForm, target_employee_id: v as any })}>
                          <SelectTrigger className="bg-white">
                            <SelectValue>
                              {editForm.target_employee_id === 'all' || !editForm.target_employee_id
                                ? <span className="flex items-center gap-2"><Users className="w-4 h-4 text-blue-500" /> כל העובדים</span>
                                : employees.find(e => e.id === editForm.target_employee_id)?.full_name || 'עובד'
                              }
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">
                              <span className="flex items-center gap-2"><Users className="w-4 h-4" /> כל העובדים</span>
                            </SelectItem>
                            {employees.map(emp => (
                              <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Textarea
                      value={editForm.content}
                      onChange={e => setEditForm({ ...editForm, content: e.target.value })}
                      className="resize-y bg-white min-h-[80px]"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1 gap-1" disabled={isLoading} onClick={() => handleEdit(ann.id)}>
                        {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        שמור שינויים
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                        <X className="w-3 h-3" /> ביטול
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* View Mode */
                  <div className="flex items-start justify-between gap-3 group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-slate-900">{ann.title}</h4>
                        <Badge
                          variant="outline"
                          className={`text-[9px] ${ann.target_employee_id ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}
                        >
                          {ann.target_employee_id ? (
                            <span className="flex items-center gap-1">
                              👤 {getEmployeeName(ann.target_employee_id)}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1"><Users className="w-2.5 h-2.5" /> כל העובדים</span>
                          )}
                        </Badge>
                        {!ann.is_active && (
                          <Badge variant="outline" className="text-[9px] bg-slate-50 text-slate-400 border-slate-200">מושהה</Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{ann.content}</p>
                      <p className="text-[10px] text-muted-foreground mt-2">
                        פורסם ב: {format(new Date(ann.created_at), 'dd/MM/yyyy HH:mm')}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-blue-400 hover:text-blue-700 hover:bg-blue-50"
                        title="ערוך הודעה"
                        onClick={() => startEdit(ann)}
                      >
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 ${ann.is_active ? 'text-amber-400 hover:text-amber-700 hover:bg-amber-50' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
                        title={ann.is_active ? 'השהה הודעה' : 'הפעל הודעה'}
                        onClick={() => toggleActive(ann.id, ann.is_active)}
                      >
                        {ann.is_active ? '⏸' : '▶'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                        title="מחק הודעה"
                        onClick={() => handleDelete(ann.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
