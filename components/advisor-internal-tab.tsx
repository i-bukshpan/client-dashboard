'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { updateAdvisorFields, updateClientDriveFolder } from '@/lib/actions/clients'
import { HardDrive, Save, UserCog } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { type Client } from '@/lib/supabase'

interface AdvisorInternalTabProps {
    client: Client
    onUpdate: () => void
}

export function AdvisorInternalTab({ client, onUpdate }: AdvisorInternalTabProps) {
    const [advisorStatus, setAdvisorStatus] = useState(client.advisor_status || 'onboarding')
    const [internalNotes, setInternalNotes] = useState(client.internal_notes || '')
    const [driveFolderId, setDriveFolderId] = useState(client.google_drive_folder_id || '')
    const [isSaving, setIsSaving] = useState(false)

    const handleSaveAdvisorFields = async () => {
        setIsSaving(true)
        // Update standard fields
        const res1 = await updateAdvisorFields(client.id, advisorStatus, internalNotes)
        
        // Update drive folder
        const res2 = await updateClientDriveFolder(client.id, driveFolderId)
        
        if (res1.success && res2.success) {
            onUpdate()
        }
        setIsSaving(false)
    }

    return (
        <Card className="p-6 bg-white border-border/50 shadow-sm rounded-3xl h-full flex flex-col">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
                    <UserCog className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-black text-navy tracking-tight">סטטוס עבודה פנימי</h3>
            </div>

            <div className="space-y-6 flex-1 flex flex-col">
                <div className="space-y-2">
                    <Label className="font-bold text-grey">שלב בתהליך</Label>
                    <Select value={advisorStatus} onValueChange={setAdvisorStatus}>
                        <SelectTrigger className="rounded-xl border-border/50 bg-slate-50/50 h-11">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="onboarding">קליטה (Onboarding)</SelectItem>
                            <SelectItem value="data_collection">איסוף נתונים</SelectItem>
                            <SelectItem value="analysis">ניתוח ובניית תוכנית</SelectItem>
                            <SelectItem value="implementation">ליווי בביצוע</SelectItem>
                            <SelectItem value="active_management">ניהול שוטף</SelectItem>
                            <SelectItem value="on_hold">בהמתנה / הקפאה</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label className="font-bold text-grey flex items-center gap-2">
                        <HardDrive className="h-3.5 w-3.5" />
                        מזהה תיקיית Google Drive
                    </Label>
                    <Input 
                        value={driveFolderId}
                        onChange={(e) => setDriveFolderId(e.target.value)}
                        placeholder="הכנס את ה-ID של התיקייה מה-URL ב-Drive"
                        className="rounded-xl border-border/50 bg-slate-50/50 h-11 pr-4"
                    />
                    <p className="text-[10px] text-muted-foreground">הדבק כאן את הקוד שמופיע בסוף הכתובת כשאתה בתוך התיקייה ב-Drive.</p>
                </div>

                <div className="space-y-2 flex-1 flex flex-col">
                    <Label className="font-bold text-grey">הערות אסטרטגיות (פנימי ליועץ בלבד)</Label>
                    <Textarea
                        value={internalNotes}
                        onChange={(e) => setInternalNotes(e.target.value)}
                        placeholder="כתוב כאן דברים שהלקוח לא צריך לראות..."
                        className="flex-1 min-h-[250px] rounded-2xl border-border/50 bg-slate-50/50 resize-none p-4"
                    />
                </div>

                <Button
                    onClick={handleSaveAdvisorFields}
                    disabled={isSaving}
                    className="w-full rounded-xl gap-2 h-12 font-bold shadow-lg shadow-indigo-500/10"
                >
                    <Save className="h-4 w-4" />
                    {isSaving ? 'שומר...' : 'שמור שינויים פנימיים'}
                </Button>
            </div>
        </Card>
    )
}
