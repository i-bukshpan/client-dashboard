'use client'

import { useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AIAgentSidebar } from '@/components/ai-agent-sidebar'
import { cn } from '@/lib/utils'

export function GlobalAIAccess() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 left-6 z-[60] h-14 w-14 rounded-2xl shadow-2xl flex items-center justify-center transition-all duration-500 scale-100 active:scale-90",
          isOpen 
            ? "bg-rose-500 text-white rotate-90" 
            : "bg-gradient-to-br from-primary to-indigo-600 text-white hover:shadow-primary/30"
        )}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6 animate-pulse" />}
      </button>

      {/* Global Sidebar Overlay */}
      {isOpen && (
        <div className="fixed inset-y-0 left-0 w-96 z-50 animate-in slide-in-from-left duration-300 shadow-2xl">
          <AIAgentSidebar 
            clientId="dashboard" 
            clientName="עוזר אישי (דשבורד)" 
            onClose={() => setIsOpen(false)} 
          />
        </div>
      )}

      {/* Backdrop for mobile/tablet */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-navy/20 backdrop-blur-sm z-40 md:hidden" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  )
}
