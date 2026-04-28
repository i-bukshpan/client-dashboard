'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { StickyNote, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/use-toast'

export function ClientNotes({ clientId, initialNotes }: { clientId: string, initialNotes: string | null }) {
  const [notes, setNotes] = useState(initialNotes || '')
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()

  async function handleSave() {
    setIsSaving(true)
    const { error } = await (supabase.from('clients') as any).update({ notes }).eq('id', clientId)
    setIsSaving(false)

    if (error) {
      toast({ title: 'שגיאה', description: 'שגיאה בשמירת ההערות', variant: 'destructive' })
    } else {
      toast({ title: 'נשמר בהצלחה', description: 'הערות הלקוח עודכנו' })
      setIsEditing(false)
    }
  }

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="py-4 border-b border-border/50 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2">
          <StickyNote className="w-4 h-4 text-primary" />
          הערות לקוח
        </CardTitle>
        {!isEditing ? (
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>ערוך</Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setIsEditing(false); setNotes(initialNotes || '') }} disabled={isSaving}>ביטול</Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="w-3 h-3 me-2 animate-spin" />}
              שמור
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-4">
        {isEditing ? (
          <Textarea 
            value={notes} 
            onChange={(e) => setNotes(e.target.value)} 
            placeholder="כתוב כאן הערות חופשיות לגבי הלקוח..."
            className="min-h-[100px] resize-y"
            dir="auto"
          />
        ) : (
          <div className="text-sm whitespace-pre-wrap text-slate-700 bg-slate-50/50 p-3 rounded-md min-h-[60px]">
            {notes ? notes : <span className="text-muted-foreground italic">אין הערות ללקוח זה...</span>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
