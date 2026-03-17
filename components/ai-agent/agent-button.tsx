'use client'

import { Bot } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAgentContext } from './agent-context'

export function AgentButton() {
  const { isOpen, setIsOpen } = useAgentContext()

  return (
    <button
      onClick={() => setIsOpen(!isOpen)}
      title="פתח עוזר AI"
      aria-label="פתח עוזר AI"
      className={cn(
        'fixed z-40 flex items-center justify-center rounded-full shadow-lg transition-all duration-300 active:scale-95',
        // Mobile: above bottom nav (bottom nav is h-16 = 4rem)
        'bottom-20 left-4 h-12 w-12',
        // Desktop
        'md:bottom-8 md:left-6 md:h-13 md:w-13',
        isOpen
          ? 'bg-secondary text-foreground border border-border scale-95'
          : 'bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-110'
      )}
    >
      <Bot className="h-5 w-5" />
    </button>
  )
}
