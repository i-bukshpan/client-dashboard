'use client'

import { useState, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Plus, Trash2, ChevronDown, ChevronUp, Users, TrendingUp, TrendingDown, Phone, Mail, Eye, EyeOff, Pencil, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { createPartner, updatePartner, deletePartner, createPartnerTransaction, deletePartnerTransaction, togglePartnerPortalAccess, invitePortalUser, updatePartnerPermissions } from '@/app/moshe/actions'
import { toast } from 'sonner'
import { PartnerPrintButton } from '@/components/moshe/ProjectPrintView'
import type { MoshePartner, MoshePartnerTransaction, MosheLoan, MosheLoanPayment, MosheTransaction } from '@/types/moshe'

function fmt(n: number) {
  return '₪' + Number(n).toLocaleString('he-IL', { maximumFractionDigits: 0 })
}

interface Props {
  projectId: string
  project?: any
  partners: (MoshePartner & { transactions: MoshePartnerTransaction[] })[]
  loans?: (MosheLoan & { payments: MosheLoanPayment[] })[]
  allTransactions?: MosheTransaction[]
}

const EMPTY_FORM = { name: '', phone: '', email: '', notes: '' }

export function PartnersTab({ projectId, project, partners, loans = [], allTransactions = [] }: Props) {
  const [pending, startTransition] = useTransition()
  const [addOpen, setAddOpen] = useState(false)
  const [editingPartner, setEditingPartner] = useState<string | null>(null)
  const [expandedPartner, setExpandedPartner] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [invitingId, setInvitingId] = useState<string | null>(null)

  async function handleInvite(partnerId: string, email: string) {
    if (!confirm(`לשלוח הזמנה ל-${email}?`)) return
    setInvitingId(partnerId)
    const r = await invitePortalUser(email)
    setInvitingId(null)
    if (r.error) toast.error(r.error)
    else toast.success('הזמנה נשלחה בהצלחה!')
  }

  function openAdd() { setForm(EMPTY_FORM); setAddOpen(true) }
  function openEdit(p: MoshePartner) {
    setForm({ name: p.name, phone: (p as any).phone ?? '', email: (p as any).email ?? '', notes: (p as any).notes ?? '' })
    setEditingPartner(p.id)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('שם השותף נדרש')
    setSaving(true)
    try {
      const r = await createPartner({ project_id: projectId, ...form })
      if (r.error) { toast.error(r.error); return }
      toast.success('שותף נוסף בהצלחה')
      setAddOpen(false)
      setForm(EMPTY_FORM)
    } finally { setSaving(false) }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingPartner || !form.name.trim()) return toast.error('שם נדרש')
    setSaving(true)
    try {
      const r = await updatePartner(editingPartner, form)
      if (r.error) { toast.error(r.error); return }
      toast.success('פרטי שותף עודכנו')
      setEditingPartner(null)
    } finally { setSaving(false) }
  }

  function removePartner(id: string) {
    if (!confirm('האם אתה בטוח שברצונך למחוק שותף זה?')) return
    startTransition(async () => {
      const r = await deletePartner(id, projectId)
      if (r.error) toast.error(r.error)
      else toast.success('שותף נמחק')
    })
  }

  const totalInvested = partners.reduce((s, p) =>
    s + p.transactions.filter(t => t.type === 'investment').reduce((ss, t) => ss + Number(t.amount), 0), 0)
  const totalWithdrawn = partners.reduce((s, p) =>
    s + p.transactions.filter(t => t.type === 'withdrawal').reduce((ss, t) => ss + Number(t.amount), 0), 0)


  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-center">
          <p className="text-[10px] text-indigo-500 font-bold uppercase">סה&quot;כ השקעות שותפים</p>
          <p className="text-lg font-black text-indigo-700 mt-0.5">{fmt(totalInvested)}</p>
        </div>
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 text-center">
          <p className="text-[10px] text-orange-500 font-bold uppercase">סה&quot;כ משיכות</p>
          <p className="text-lg font-black text-orange-600 mt-0.5">{fmt(totalWithdrawn)}</p>
        </div>
        <div className={cn('rounded-xl border p-3 text-center',
          (totalInvested - totalWithdrawn) >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100')}>
          <p className={cn('text-[10px] font-bold uppercase',
            (totalInvested - totalWithdrawn) >= 0 ? 'text-emerald-500' : 'text-red-500')}>מאזן שותפים</p>
          <p className={cn('text-lg font-black mt-0.5',
            (totalInvested - totalWithdrawn) >= 0 ? 'text-emerald-700' : 'text-red-600')}>
            {fmt(totalInvested - totalWithdrawn)}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-slate-700">{partners.length} שותפים בפרויקט</p>
        <Button size="sm" onClick={openAdd}
          className="gap-1.5 h-9 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold">
          <Plus className="w-3.5 h-3.5" /> הוסף שותף
        </Button>
      </div>

      {partners.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-slate-200">
          <Users className="w-10 h-10 text-slate-200 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">אין שותפים עדיין</p>
          <button onClick={openAdd} className="text-indigo-500 text-xs mt-1 hover:underline">+ הוסף שותף ראשון</button>
        </div>
      )}

      <div className="space-y-3">
        {partners.map(partner => {
          const invested  = partner.transactions.filter(t => t.type === 'investment').reduce((s, t) => s + Number(t.amount), 0)
          const withdrawn = partner.transactions.filter(t => t.type === 'withdrawal').reduce((s, t) => s + Number(t.amount), 0)
          const balance = invested - withdrawn
          const isExpanded = expandedPartner === partner.id
          const isDefault = partner.name === 'משה פרוש'

          return (
            <div key={partner.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 flex items-center gap-4">
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0',
                  isDefault ? 'bg-gradient-to-br from-amber-400 to-orange-500' : 'bg-gradient-to-br from-indigo-400 to-purple-500')}>
                  {partner.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-slate-900 text-sm truncate">{partner.name}</p>
                    {isDefault && <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">ברירת מחדל</span>}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-slate-400">
                    {partner.phone && <span className="flex items-center gap-0.5"><Phone className="w-2.5 h-2.5" />{partner.phone}</span>}
                    {partner.email && <span className="flex items-center gap-0.5"><Mail className="w-2.5 h-2.5" />{partner.email}</span>}
                    <span>{partner.transactions.length} תנועות</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className={cn('text-sm font-black', balance >= 0 ? 'text-indigo-700' : 'text-red-600')}>{fmt(balance)}</p>
                  <p className="text-[10px] text-slate-400">מאזן</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => openEdit(partner)}
                    className="w-8 h-8 rounded-lg border border-slate-100 flex items-center justify-center text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 hover:border-indigo-200 transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  {(partner as any).email && (
                    <button
                      onClick={() => handleInvite(partner.id, (partner as any).email)}
                      disabled={invitingId === partner.id}
                      title="שלח הזמנה לפורטל"
                      className="w-8 h-8 rounded-lg border border-slate-100 flex items-center justify-center text-slate-300 hover:text-blue-500 hover:bg-blue-50 hover:border-blue-200 transition-colors disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <PartnerPrintButton
                    project={project ?? { name: '', address: null }}
                    partner={partner as any}
                    allTransactions={allTransactions as any}
                    loans={loans as any}
                  />
                  {(partner as any).email && (
                    <button
                      title={(partner as any).portal_access ? 'בטל גישת פורטל' : 'הפעל גישת פורטל לשותף'}
                      onClick={() => {
                        startTransition(async () => {
                          const r = await togglePartnerPortalAccess(partner.id, !(partner as any).portal_access)
                          if (r.error) toast.error(r.error)
                          else toast.success((partner as any).portal_access ? 'גישת פורטל בוטלה' : 'גישת פורטל הופעלה')
                        })
                      }}
                      disabled={pending}
                      className={cn('w-8 h-8 rounded-lg border flex items-center justify-center transition-colors',
                        (partner as any).portal_access
                          ? 'border-indigo-200 bg-indigo-50 text-indigo-500 hover:bg-red-50 hover:text-red-400 hover:border-red-200'
                          : 'border-slate-100 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 hover:border-indigo-200'
                      )}>
                      {(partner as any).portal_access ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                  )}
                  {!isDefault && (
                    <button onClick={() => removePartner(partner.id)} disabled={pending}
                      className="w-8 h-8 rounded-lg border border-slate-100 flex items-center justify-center text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button onClick={() => setExpandedPartner(v => v === partner.id ? null : partner.id)}
                    className="w-8 h-8 rounded-lg border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="px-5 pb-3">
                <div className="flex gap-2 text-[10px]">
                  <span className="text-indigo-500 font-medium">השקעות: {fmt(invested)}</span>
                  <span className="text-slate-300">|</span>
                  <span className="text-orange-500 font-medium">משיכות: {fmt(withdrawn)}</span>
                </div>
              </div>

              {isExpanded && (
                <>
                  <PartnerTransactionsList partner={partner} projectId={projectId} />
                  {(partner as any).portal_access && (
                    <PartnerPermissionsPanel partner={partner as any} />
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Add / Edit partner sheet */}
      <Sheet open={addOpen || !!editingPartner} onOpenChange={open => { if (!open) { setAddOpen(false); setEditingPartner(null) } }}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto p-0">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10">
            <SheetHeader>
              <SheetTitle className="text-lg font-bold">{editingPartner ? 'עריכת פרטי שותף' : 'הוספת שותף חדש'}</SheetTitle>
            </SheetHeader>
          </div>
          <form onSubmit={editingPartner ? handleEdit : handleAdd} className="p-6 space-y-4">
            <div className="space-y-2">
              <Label className="font-medium text-slate-700">שם השותף <span className="text-red-400">*</span></Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="שם מלא" className="h-10" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="font-medium text-slate-700">טלפון</Label>
                <Input dir="ltr" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="050-0000000" className="h-10" />
              </div>
              <div className="space-y-2">
                <Label className="font-medium text-slate-700">אימייל</Label>
                <Input type="email" dir="ltr" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="mail@example.com" className="h-10" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-medium text-slate-700">הערות</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="h-10" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => { setAddOpen(false); setEditingPartner(null) }} className="flex-1">ביטול</Button>
              <Button type="submit" disabled={saving || !form.name.trim()} className="flex-1 bg-indigo-500 hover:bg-indigo-400 text-white font-bold">
                {saving ? 'שומר...' : editingPartner ? 'שמור שינויים' : 'הוסף שותף'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function PartnerTransactionsList({ partner, projectId }: {
  partner: MoshePartner & { transactions: MoshePartnerTransaction[] }
  projectId: string
}) {
  const [pending, startTransition] = useTransition()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({
    type: 'investment' as 'investment' | 'withdrawal',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  })

  const sorted = [...partner.transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  async function handleAdd() {
    if (!form.amount) return toast.error('סכום נדרש')
    const r = await createPartnerTransaction({ partner_id: partner.id, project_id: projectId, ...form })
    if (r.error) { toast.error(r.error); return }
    toast.success('תנועה נוספה')
    setForm(f => ({ ...f, amount: '', notes: '' }))
    setShowAdd(false)
  }

  function remove(id: string) {
    if (!confirm('האם אתה בטוח שברצונך למחוק תנועה זו?')) return
    startTransition(async () => {
      const r = await deletePartnerTransaction(id, projectId)
      if (r.error) toast.error(r.error)
      else toast.success('תנועה נמחקה')
    })
  }

  const TYPE_LABELS: Record<string, string> = { investment: 'השקעה', withdrawal: 'משיכה' }

  return (
    <div className="border-t border-slate-100">
      <div className="px-4 py-2 bg-slate-50/50 flex items-center justify-between">
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">תנועות כספיות</p>
        <button onClick={() => setShowAdd(v => !v)} className="text-[11px] text-indigo-600 font-bold hover:text-indigo-700 flex items-center gap-1">
          <Plus className="w-3 h-3" /> הוסף תנועה
        </button>
      </div>

      {showAdd && (
        <div className="px-4 py-3 bg-indigo-50/30 border-b border-slate-100 space-y-2">
          <div className="grid grid-cols-[1fr_1fr_1fr_2fr] gap-2 items-end">
            <div>
              <p className="text-[10px] text-slate-400 mb-1">סוג</p>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as any }))}>
                <SelectTrigger className="h-8 text-xs border-slate-200 bg-white">
                  <SelectValue>{TYPE_LABELS[form.type]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="investment">השקעה</SelectItem>
                  <SelectItem value="withdrawal">משיכה</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 mb-1">סכום (₪)</p>
              <Input type="number" dir="ltr" placeholder="0" value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="h-8 text-xs border-slate-200 bg-white" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 mb-1">תאריך</p>
              <Input type="date" value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="h-8 text-xs border-slate-200 bg-white" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 mb-1">הערות</p>
              <Input placeholder="תיאור..." value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="h-8 text-xs border-slate-200 bg-white" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)} className="h-7 text-xs">ביטול</Button>
            <Button size="sm" onClick={handleAdd} className="h-7 text-xs bg-indigo-500 hover:bg-indigo-400 text-white px-3">שמור</Button>
          </div>
        </div>
      )}

      {sorted.length === 0 && !showAdd && (
        <p className="text-center text-xs text-slate-400 py-6">אין תנועות כספיות</p>
      )}

      {sorted.map(t => (
        <div key={t.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-50 last:border-0 group">
          <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', t.type === 'investment' ? 'bg-indigo-100' : 'bg-orange-100')}>
            {t.type === 'investment' ? <TrendingUp className="w-3.5 h-3.5 text-indigo-600" /> : <TrendingDown className="w-3.5 h-3.5 text-orange-500" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-700 truncate">{t.notes || (t.type === 'investment' ? 'השקעה' : 'משיכה')}</p>
            <p className="text-[10px] text-slate-400">{format(new Date(t.date), 'dd/MM/yyyy')}</p>
          </div>
          <p className={cn('font-bold text-xs shrink-0', t.type === 'investment' ? 'text-indigo-700' : 'text-orange-600')}>
            {t.type === 'investment' ? '+' : '-'}{fmt(Number(t.amount))}
          </p>
          <button onClick={() => remove(t.id)} disabled={pending}
            className="w-6 h-6 rounded text-slate-200 hover:text-red-400 hover:bg-red-50 flex items-center justify-center shrink-0">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  )
}

function PartnerPermissionsPanel({ partner }: { partner: any }) {
  const [, startTransition] = useTransition()
  const [perms, setPerms] = useState({
    can_view_payments:     !!partner.can_view_payments,
    can_view_buyers:       !!partner.can_view_buyers,
    can_view_transactions: !!partner.can_view_transactions,
    can_view_loans:        !!partner.can_view_loans,
  })

  function toggle(key: keyof typeof perms) {
    const next = { ...perms, [key]: !perms[key] }
    setPerms(next)
    startTransition(async () => {
      const r = await updatePartnerPermissions(partner.id, next)
      if (r.error) toast.error(r.error)
    })
  }

  return (
    <div className="border-t border-indigo-100 bg-indigo-50/30 px-4 py-3">
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">הרשאות פורטל שותף</p>
        <a
          href={`/moshe/preview/partner/${partner.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-indigo-600 font-bold hover:text-indigo-800 flex items-center gap-1 transition-colors"
        >
          <Eye className="w-3 h-3" /> תצוגה מקדימה
        </a>
      </div>
      <div className="grid grid-cols-2 gap-1">
        {([
          { key: 'can_view_payments',     label: 'לוח תשלומים' },
          { key: 'can_view_buyers',       label: 'קונים' },
          { key: 'can_view_transactions', label: 'הוצאות/הכנסות' },
          { key: 'can_view_loans',        label: 'הלוואות' },
        ] as const).map(({ key, label }) => (
          <label key={key} className="flex items-center gap-2 cursor-pointer py-1 px-2 rounded-lg hover:bg-indigo-100/60 select-none">
            <input
              type="checkbox"
              checked={perms[key]}
              onChange={() => toggle(key)}
              className="w-3.5 h-3.5 accent-indigo-500"
            />
            <span className="text-xs text-slate-700">{label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
