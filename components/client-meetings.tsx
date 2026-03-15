'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, Trash2, FileText, CheckCircle2, Sparkles, Loader2, ListChecks, X } from 'lucide-react'
import { supabase, type Client, type MeetingLog } from '@/lib/supabase'
import { createMeetingLog, getMeetingLogs, deleteMeetingLog } from '@/lib/actions/meeting-logs'
import { format } from 'date-fns'
import { generateMeetingPrep, extractTasksFromSummary } from '@/lib/actions/ai-advanced'
import { toast } from 'sonner'

interface ClientMeetingsProps {
    client: Client
    onUpdate: () => void
}

export function ClientMeetings({ client, onUpdate }: ClientMeetingsProps) {
    const [meetingLogs, setMeetingLogs] = useState<MeetingLog[]>([])
    const [logsLoading, setLogsLoading] = useState(true)

    // Meeting Form
    const [meetingDate, setMeetingDate] = useState(format(new Date(), 'yyyy-MM-dd'))
    const [meetingSubject, setMeetingSubject] = useState('')
    const [meetingSummary, setMeetingSummary] = useState('')
    const [meetingActionItems, setMeetingActionItems] = useState('')
    const [meetingDialogOpen, setMeetingDialogOpen] = useState(false)
    const [prepLoading, setPrepLoading] = useState(false)
    const [prepBriefing, setPrepBriefing] = useState<string | null>(null)
    const [extracting, setExtracting] = useState<string | null>(null)

    useEffect(() => {
        loadMeetingLogs()
    }, [client.id])

    const loadMeetingLogs = async () => {
        setLogsLoading(true)
        const result = await getMeetingLogs(client.id)
        if (result.success) {
            setMeetingLogs(result.logs || [])
        }
        setLogsLoading(false)
    }

    const handleGeneratePrep = async () => {
        setPrepLoading(true)
        const res = await generateMeetingPrep(client.id)
        if (res.success) {
            setPrepBriefing(res.text || null)
        } else {
            toast.error('שגיאה ביצירת הכנה לפגישה')
        }
        setPrepLoading(false)
    }

    const handleExtractTasks = async (meetingId: string, summary: string) => {
        if (!summary) return
        setExtracting(meetingId)
        const res = await extractTasksFromSummary(meetingId, summary)
        if (res.success) {
            toast.success(`חולצו ${res.count} משימות בהצלחה!`)
        } else {
            toast.error('שגיאה בחילוץ משימות')
        }
        setExtracting(null)
    }

    const handleCreateMeetingLog = async () => {
        const result = await createMeetingLog({
            client_id: client.id,
            meeting_date: meetingDate,
            subject: meetingSubject,
            summary: meetingSummary,
            action_items: meetingActionItems,
            meeting_type: 'monthly_review'
        })

        if (result.success) {
            setMeetingDialogOpen(false)
            loadMeetingLogs()
            // Reset form
            setMeetingSubject('')
            setMeetingSummary('')
            setMeetingActionItems('')
            onUpdate()
        }
    }

    const handleDeleteMeetingLog = async (id: string) => {
        if (confirm('האם אתה בטוח שברצונך למחוק סיכום פגישה זה?')) {
            const result = await deleteMeetingLog(id)
            if (result.success) {
                loadMeetingLogs()
                onUpdate()
            }
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h3 className="text-xl font-black text-navy tracking-tight flex items-center gap-2">
                        <FileText className="h-5 w-5 text-indigo-500" />
                        סיכומי פגישות
                    </h3>
                    <p className="text-sm font-bold text-grey mt-1">
                        תיעוד היסטוריית הפגישות וההחלטות עם הלקוח
                    </p>
                </div>
                <Dialog open={meetingDialogOpen} onOpenChange={setMeetingDialogOpen}>
                    <DialogTrigger asChild>
                        <Button 
                            className="rounded-xl gap-2 h-10 px-5 font-bold shadow-md shadow-primary/10"
                            onClick={handleGeneratePrep}
                            disabled={prepLoading}
                        >
                            {prepLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                            הכנה לפגישה (AI)
                        </Button>
                        <Button className="rounded-xl gap-2 h-10 px-5 font-bold shadow-md shadow-primary/10">
                            <Plus className="h-4 w-4" />
                            סיכום פגישה חדש
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl rounded-[2.5rem] border-none shadow-2xl p-8" dir="rtl">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-black text-navy px-2">סיכום פגישה עם {client.name}</DialogTitle>
                            <DialogDescription className="px-2">תעד את עיקרי הפגישה והחלטות לביצוע</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-6 py-6 px-2">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="font-bold">תאריך פגישה</Label>
                                    <Input
                                        type="date"
                                        value={meetingDate}
                                        onChange={(e) => setMeetingDate(e.target.value)}
                                        className="rounded-xl border-border/50"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-bold">נושא / כותרת</Label>
                                    <Input
                                        value={meetingSubject}
                                        onChange={(e) => setMeetingSubject(e.target.value)}
                                        placeholder="למשל: פגישת רבעון 1"
                                        className="rounded-xl border-border/50"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="font-bold">סיכום הפגישה</Label>
                                <Textarea
                                    value={meetingSummary}
                                    onChange={(e) => setMeetingSummary(e.target.value)}
                                    placeholder="מה היה בפגישה..."
                                    className="min-h-[150px] rounded-xl border-border/50 resize-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="font-bold font-black text-emerald-600">משימות לביצוע (Action Items)</Label>
                                <Textarea
                                    value={meetingActionItems}
                                    onChange={(e) => setMeetingActionItems(e.target.value)}
                                    placeholder="רשימת מטלות שעלו מהפגישה..."
                                    className="min-h-[100px] rounded-xl border-emerald-100 bg-emerald-50/10 resize-none"
                                />
                            </div>
                        </div>
                        <DialogFooter className="gap-3 px-2">
                            <Button variant="outline" onClick={() => setMeetingDialogOpen(false)} className="rounded-xl border-border/50 h-11 px-8">ביטול</Button>
                            <Button onClick={handleCreateMeetingLog} className="rounded-xl h-11 px-8 shadow-lg shadow-primary/20">שמור סיכום פגישה</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {prepBriefing && (
                <Card className="p-6 bg-primary/5 border-primary/20 rounded-3xl mb-8 relative overflow-hidden animate-in fade-in slide-in-from-top-4">
                    <div className="absolute top-0 right-0 p-2">
                        <Button variant="ghost" size="icon" onClick={() => setPrepBriefing(null)} className="h-6 w-6 rounded-full">
                            <X className="h-3 w-3" />
                        </Button>
                    </div>
                    <div className="flex items-center gap-2 mb-3 text-primary">
                        <Sparkles className="h-5 w-5" />
                        <h4 className="font-bold">הכנה לפגישה (AI)</h4>
                    </div>
                    <div className="text-sm font-medium leading-relaxed text-navy whitespace-pre-wrap">
                        {prepBriefing}
                    </div>
                </Card>
            )}

            {logsLoading ? (
                <div className="py-12 text-center text-grey animate-pulse">טוען סיכומי פגישות...</div>
            ) : meetingLogs.length === 0 ? (
                <Card className="p-12 text-center border-dashed border-border/50 bg-white/40 rounded-[2.5rem] shadow-sm">
                    <div className="w-16 h-16 rounded-3xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-400 mx-auto mb-4">
                        <FileText className="h-8 w-8" />
                    </div>
                    <h4 className="text-lg font-bold text-navy mb-2">אין תיעוד פגישות עדיין</h4>
                    <p className="text-grey mb-6">התחל לתעד את הפגישות שלך עם הלקוח כדי לשמור על מעקב מסודר לאורך זמן</p>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {meetingLogs.map((log) => (
                        <Card key={log.id} className="p-6 bg-white/70 backdrop-blur-xl shadow-xl shadow-navy/5 border-border/50 hover:border-indigo-300 transition-all group rounded-3xl relative overflow-hidden flex flex-col h-full">
                            <div className="absolute top-0 right-0 w-1.5 h-full bg-slate-200 group-hover:bg-indigo-500 transition-colors" />
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <div className="flex items-center gap-3 mb-1.5">
                                        <span className="text-xs font-black text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100/50">
                                            {format(new Date(log.meeting_date), 'dd/MM/yyyy')}
                                        </span>
                                    </div>
                                    <h4 className="text-xl font-black text-navy tracking-tight leading-tight">{log.subject}</h4>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleExtractTasks(log.id, log.summary || '')}
                                        disabled={extracting === log.id || !log.summary}
                                        title="חלץ משימות מהסיכום"
                                        className="h-8 w-8 text-grey hover:text-emerald-500 rounded-lg hover:bg-emerald-50 shrink-0"
                                    >
                                        {extracting === log.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListChecks className="h-4 w-4" />}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDeleteMeetingLog(log.id)}
                                        className="h-8 w-8 text-grey hover:text-rose-500 rounded-lg hover:bg-rose-50 shrink-0"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            <div className="flex-1">
                                {log.summary && (
                                    <div className="mb-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100/50 h-full">
                                        <p className="text-sm text-navy font-medium whitespace-pre-wrap leading-relaxed opacity-80">{log.summary}</p>
                                    </div>
                                )}
                            </div>

                            {log.action_items && (
                                <div className="mt-4 p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/50">
                                    <div className="flex items-center gap-2 mb-2 text-emerald-700 font-black text-xs uppercase tracking-wider">
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                        משימות לביצוע
                                    </div>
                                    <p className="text-sm text-emerald-900 font-bold whitespace-pre-wrap">{log.action_items}</p>
                                </div>
                            )}
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
