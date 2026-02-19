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
        <div className="space-y-4" dir="rtl">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <LinkIcon className="h-5 w-5" />
                    קישורים
                </h3>
                <Button size="sm" className="gap-2" onClick={openAddDialog}>
                    <Plus className="h-4 w-4" />
                    הוסף קישור
                </Button>
            </div>

            {links.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg border-grey/20">
                    <LinkIcon className="h-10 w-10 mx-auto mb-3 text-grey/40" />
                    <p className="text-grey text-sm">אין קישורים. הוסף קישורים לגוגל שיטס, תיקיות, ועוד.</p>
                    <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={openAddDialog}>
                        <Plus className="h-4 w-4" />
                        הוסף קישור ראשון
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {links.map((link) => {
                        const config = linkTypeConfig[link.link_type] || linkTypeConfig.other
                        const Icon = config.icon

                        return (
                            <div
                                key={link.id}
                                className={`group border rounded-lg p-4 transition-all hover:shadow-md ${config.bg}`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3 min-w-0 flex-1">
                                        <div className={`mt-0.5 flex-shrink-0 ${config.color}`}>
                                            <Icon className="h-5 w-5" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <a
                                                href={link.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-sm font-semibold text-navy hover:text-blue-600 flex items-center gap-1 group/link"
                                            >
                                                <span className="truncate">{link.title}</span>
                                                <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                                            </a>
                                            <span className="text-xs text-grey">{config.label}</span>
                                            {link.description && (
                                                <p className="text-xs text-grey mt-1 line-clamp-2">{link.description}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => openEditDialog(link)}
                                            className="h-7 w-7 p-0"
                                            title="ערוך"
                                        >
                                            <Edit className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDelete(link.id, link.title)}
                                            className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                            title="מחק"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
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
