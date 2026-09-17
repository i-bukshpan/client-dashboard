'use client'

/**
 * src/components/notebook/DailyBriefModal.tsx
 *
 * Daily Executive Brief Popup Modal for Nehemiah OS v3 Notebook.
 * - Auto-opens on Nehemiah's first visit of the day in the morning.
 * - Can be opened anytime via the header "🌅 בריף בוקר" button.
 * - Provides full operational morning overview: tasks, routines, emails, calendar, alerts, audio and WhatsApp export.
 */

import React, { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Sun, Sparkles, X, CheckCircle } from 'lucide-react'
import { GlobalDailyBriefView } from '@/components/workspace/GlobalDailyBriefView'

interface DailyBriefModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  autoTriggerMorning?: boolean
}

export function DailyBriefModal({
  open,
  onOpenChange,
  autoTriggerMorning = true,
}: DailyBriefModalProps) {
  // Check if morning brief has already been shown today
  useEffect(() => {
    if (!autoTriggerMorning) return
    try {
      const todayStr = new Date().toISOString().slice(0, 10)
      const storageKey = `nehemiah_daily_brief_seen_${todayStr}`
      const hasSeenToday = localStorage.getItem(storageKey)

      if (!hasSeenToday) {
        // Open modal automatically for the morning brief
        onOpenChange(true)
        localStorage.setItem(storageKey, 'true')
      }
    } catch (e) {
      console.warn('[DailyBriefModal] localStorage check failed:', e)
    }
  }, [autoTriggerMorning, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-6xl xl:max-w-7xl w-[95vw] h-[90vh] max-h-[900px] p-0 flex flex-col overflow-hidden bg-background/95 backdrop-blur-xl border border-border/80 shadow-2xl rounded-3xl"
        dir="rtl"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>הבריף הניהולי היומי</DialogTitle>
        </DialogHeader>

        {/* Content area wrapping the full brief view */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <GlobalDailyBriefView />
        </div>
      </DialogContent>
    </Dialog>
  )
}
