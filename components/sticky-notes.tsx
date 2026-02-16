'use client'

import { useState, useEffect } from 'react'
import { Save, Edit2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { supabase, type Note } from '@/lib/supabase'

interface StickyNotesProps {
  clientId: string
  readOnly?: boolean
}

export function StickyNotes({ clientId, readOnly = false }: StickyNotesProps) {
  const [note, setNote] = useState<Note | null>(null)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadNote = async () => {
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle()

      if (error) throw error

      if (data) {
        setNote(data)
        setContent(data.content)
      } else {
        setNote(null)
        setContent('')
      }
    } catch (error) {
      console.error('Error loading note:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadNote()
  }, [clientId])

  const handleSave = async () => {
    try {
      setSaving(true)

      if (note) {
        // Update existing note
        const { error } = await supabase
          .from('notes')
          .update({ content })
          .eq('id', note.id)

        if (error) throw error
      } else {
        // Create new note
        const { data, error } = await supabase
          .from('notes')
          .insert([{
            client_id: clientId,
            content,
          }])
          .select()
          .single()

        if (error) throw error
        setNote(data)
      }
    } catch (error) {
      console.error('Error saving note:', error)
      alert('שגיאה בשמירת הערה')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-grey">טוען הערות...</div>
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">פתקים</h3>
        {!readOnly && (
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="gap-2"
          >
            {saving ? (
              <>
                <span className="animate-spin">⏳</span>
                שומר...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                שמור
              </>
            )}
          </Button>
        )}
      </div>

      <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4 min-h-[300px]">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="כתוב כאן הערות, מחשבות, או מידע חשוב על הלקוח..."
          className="min-h-[250px] border-0 bg-transparent resize-none focus:ring-0 focus-visible:ring-0 text-base"
          dir="rtl"
          readOnly={readOnly}
        />
      </div>

      {content && (
        <div className="text-sm text-grey">
          {content.length} תווים
        </div>
      )}
    </div>
  )
}

