'use client'

import { useState, useEffect, useCallback } from 'react'
import {
    Plus,
    Trash2,
    ExternalLink,
    Edit,
    Link as LinkIcon,
    FileSpreadsheet,
    FolderOpen,
    FileText,
    Cloud,
    Globe,
    Loader2,
} from 'lucide-react'
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
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import {
    getClientLinks,
    addClientLink,
    updateClientLink,
    deleteClientLink,
    type ClientLink,
} from '@/lib/actions/client-links'

function detectLinkType(url: string): ClientLink['link_type'] {
    const lower = url.toLowerCase()
    if (lower.includes('docs.google.com/spreadsheets') || lower.includes('sheets.google.com')) return 'google_sheets'
    if (lower.includes('drive.google.com')) return 'google_drive'
    if (lower.includes('docs.google.com/document')) return 'google_docs'
    if (lower.includes('dropbox.com')) return 'dropbox'
    if (lower.includes('onedrive.live.com') || lower.includes('sharepoint.com')) return 'onedrive'
    return 'other'
}


interface ClientLinksProps {
    clientId: string
}

const linkTypeConfig: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
    google_sheets: { label: 'Google Sheets', icon: FileSpreadsheet, color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
    google_drive: { label: 'Google Drive', icon: FolderOpen, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
    google_docs: { label: 'Google Docs', icon: FileText, color: 'text-blue-500', bg: 'bg-blue-50 border-blue-200' },
    dropbox: { label: 'Dropbox', icon: Cloud, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
    onedrive: { label: 'OneDrive', icon: Cloud, color: 'text-sky-600', bg: 'bg-sky-50 border-sky-200' },
    website: { label: 'אתר', icon: Globe, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
    other: { label: 'אחר', icon: LinkIcon, color: 'text-grey', bg: 'bg-grey/5 border-grey/20' },
}

export function ClientLinks({ clientId }: ClientLinksProps) {
    const { showToast } = useToast()
    const [links, setLinks] = useState<ClientLink[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingLink, setEditingLink] = useState<ClientLink | null>(null)
    const [saving, setSaving] = useState(false)

    // Form state
    const [title, setTitle] = useState('')
    const [url, setUrl] = useState('')
    const [linkType, setLinkType] = useState<string>('other')
    const [description, setDescription] = useState('')

    const loadLinks = useCallback(async () => {
        try {
            const result = await getClientLinks(clientId)
            if (result.success && result.links) {
                setLinks(result.links)
            }
        } catch (error) {
            console.error('Error loading links:', error)
        } finally {
            setLoading(false)
        }
    }, [clientId])

    useEffect(() => {
        loadLinks()
    }, [loadLinks])

    const resetForm = () => {
        setTitle('')
        setUrl('')
        setLinkType('other')
        setDescription('')
        setEditingLink(null)
    }

    const openAddDialog = () => {
        resetForm()
        setDialogOpen(true)
    }

    const openEditDialog = (link: ClientLink) => {
        setEditingLink(link)
        setTitle(link.title)
        setUrl(link.url)
        setLinkType(link.link_type)
        setDescription(link.description || '')
        setDialogOpen(true)
    }

    // Auto-detect link type when URL changes
    const handleUrlChange = (newUrl: string) => {
        setUrl(newUrl)
        if (newUrl && !editingLink) {
            const detected = detectLinkType(newUrl)
            setLinkType(detected)
        }
    }

    const handleSave = async () => {
        if (!title.trim() || !url.trim()) {
            showToast('error', 'יש למלא כותרת וקישור')
            return
        }

        // Basic URL validation
        try {
            new URL(url)
        } catch {
            showToast('error', 'הקישור אינו תקין. ודא שהוא מתחיל ב-http:// או https://')
            return
        }

        setSaving(true)
        try {
            if (editingLink) {
                const result = await updateClientLink(editingLink.id, {
                    title: title.trim(),
                    url: url.trim(),
                    link_type: linkType,
                    description: description.trim() || null,
                })
                if (result.success) {
                    showToast('success', 'קישור עודכן בהצלחה')
                    loadLinks()
                } else {
                    showToast('error', result.error || 'שגיאה בעדכון קישור')
                }
            } else {
                const result = await addClientLink(
                    clientId,
                    title.trim(),
                    url.trim(),
                    linkType,
                    description.trim() || undefined
                )
                if (result.success) {
                    showToast('success', 'קישור נוסף בהצלחה')
                    loadLinks()
                } else {
                    showToast('error', result.error || 'שגיאה בהוספת קישור')
                }
            }
            setDialogOpen(false)
            resetForm()
        } catch (error) {
            showToast('error', 'שגיאה בשמירת הקישור')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (linkId: string, linkTitle: string) => {
        if (!confirm(`האם למחוק את הקישור "${linkTitle}"?`)) return

        try {
            const result = await deleteClientLink(linkId)
            if (result.success) {
                setLinks(links.filter(l => l.id !== linkId))
                showToast('success', 'קישור נמחק בהצלחה')
            } else {
                showToast('error', result.error || 'שגיאה במחיקת קישור')
            }
        } catch (error) {
            showToast('error', 'שגיאה במחיקת הקישור')
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-grey" />
                <span className="text-grey mr-2">טוען קישורים...</span>
            </div>
        )
    }

    return (
        <div className="space-y-6" dir="rtl">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/10 rounded-xl text-purple-500">
                        <LinkIcon className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-navy tracking-tight">קישורים ומסמכים</h3>
                        <p className="text-xs font-medium text-grey">ניהול קישורים חיצוניים, תיקיות גוגל דרייב ומסמכים</p>
                    </div>
                </div>
                <Button size="sm" className="gap-2 rounded-xl bg-purple-500 hover:bg-purple-600 shadow-lg shadow-purple-500/20 py-5 px-5 font-bold" onClick={openAddDialog}>
                    <Plus className="h-4 w-4" />
                    הוסף קישור
                </Button>
            </div>

            {links.length === 0 ? (
                <div className="text-center py-16 bg-white/40 backdrop-blur-sm border-2 border-dashed rounded-[2rem] border-grey/20">
                    <div className="w-16 h-16 bg-grey/5 rounded-full flex items-center justify-center mx-auto mb-4">
                        <LinkIcon className="h-8 w-8 text-grey/30" />
                    </div>
                    <p className="text-grey font-bold mb-4">אין קישורים עדיין. הוסף קישורים לגוגל שיטס, תיקיות, ועוד.</p>
                    <Button variant="outline" size="sm" className="gap-2 rounded-xl border-grey/20 font-bold" onClick={openAddDialog}>
                        <Plus className="h-4 w-4" />
                        הוסף קישור ראשון
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {links.map((link) => {
                        const config = linkTypeConfig[link.link_type] || linkTypeConfig.other
                        const Icon = config.icon

                        return (
                            <div
                                key={link.id}
                                className={`group relative rounded-3xl p-5 transition-all duration-300 glass-card hover-lift overflow-hidden border border-border/50 bg-white/60`}
                            >
                                {/* Background glow effect */}
                                <div className={`absolute top-0 right-0 w-24 h-24 -mr-12 -mt-12 rounded-full opacity-10 blur-xl transition-transform duration-500 group-hover:scale-150 ${config.bg.split(' ')[0]}`} />

                                <div className="flex items-start justify-between gap-3 relative z-10">
                                    <div className="flex items-start gap-4 min-w-0 flex-1">
                                        <div className={`p-3 rounded-2xl flex-shrink-0 shadow-sm ring-1 ring-white/50 transition-colors duration-300 ${config.color} ${config.bg}`}>
                                            <Icon className="h-6 w-6" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${config.bg} ${config.color} border border-current/10`}>
                                                    {config.label}
                                                </span>
                                            </div>
                                            <a
                                                href={link.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-base font-black text-navy hover:text-primary flex items-center gap-1 group/link mb-1 leading-tight"
                                            >
                                                <span className="truncate">{link.title}</span>
                                                <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 opacity-0 group-hover/link:opacity-100 transition-all transform -translate-x-1 group-hover/link:translate-x-0" />
                                            </a>
                                            {link.description && (
                                                <p className="text-xs text-grey font-medium line-clamp-2 leading-relaxed">{link.description}</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => openEditDialog(link)}
                                            className="h-8 w-8 rounded-full bg-white/80 shadow-sm border border-border/50 text-grey hover:text-primary transition-colors"
                                            title="ערוך"
                                        >
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDelete(link.id, link.title)}
                                            className="h-8 w-8 rounded-full bg-white/80 shadow-sm border border-border/50 text-rose-500 hover:text-white hover:bg-rose-500 transition-all"
                                            title="מחק"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="mt-4 pt-4 border-t border-border/10 flex items-center justify-between relative z-10">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="text-[10px] font-bold text-grey/60 uppercase tracking-tighter">זמין לצפייה</span>
                                    </div>
                                    <div className="text-[10px] font-mono text-grey/40">
                                        {new URL(link.url).hostname}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Add/Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={(open) => {
                setDialogOpen(open)
                if (!open) resetForm()
            }}>
                <DialogContent dir="rtl">
                    <DialogHeader>
                        <DialogTitle>
                            {editingLink ? 'ערוך קישור' : 'הוסף קישור חדש'}
                        </DialogTitle>
                        <DialogDescription>
                            {editingLink ? 'עדכן את פרטי הקישור' : 'הוסף קישור לתיקייה, Google Sheets, או כל כתובת אחרת'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="link-title">כותרת *</Label>
                            <Input
                                id="link-title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="לדוגמה: דוח הכנסות חודשי"
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="link-url">קישור (URL) *</Label>
                            <Input
                                id="link-url"
                                type="url"
                                value={url}
                                onChange={(e) => handleUrlChange(e.target.value)}
                                placeholder="https://docs.google.com/spreadsheets/..."
                                dir="ltr"
                                className="text-left"
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="link-type">סוג קישור</Label>
                            <Select value={linkType} onValueChange={setLinkType}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="google_sheets">Google Sheets</SelectItem>
                                    <SelectItem value="google_drive">Google Drive</SelectItem>
                                    <SelectItem value="google_docs">Google Docs</SelectItem>
                                    <SelectItem value="dropbox">Dropbox</SelectItem>
                                    <SelectItem value="onedrive">OneDrive</SelectItem>
                                    <SelectItem value="website">אתר</SelectItem>
                                    <SelectItem value="other">אחר</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="link-description">תיאור (אופציונלי)</Label>
                            <Input
                                id="link-description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="תיאור קצר של הקישור"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setDialogOpen(false)
                                resetForm()
                            }}
                            disabled={saving}
                        >
                            ביטול
                        </Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? 'שומר...' : editingLink ? 'שמור שינויים' : 'הוסף קישור'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
