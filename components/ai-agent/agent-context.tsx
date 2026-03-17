'use client'

import { createContext, useContext, useState, useMemo, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { AgentContext } from '@/lib/ai/types'

interface AgentContextValue {
  context: AgentContext
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  sessionId: string | undefined
  setSessionId: (id: string | undefined) => void
}

const AgentCtx = createContext<AgentContextValue>({
  context: { pageUrl: '/' },
  isOpen: false,
  setIsOpen: () => {},
  sessionId: undefined,
  setSessionId: () => {},
})

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [sessionId, setSessionId] = useState<string | undefined>(undefined)
  const [clientName, setClientName] = useState<string | undefined>(undefined)

  // Extract clientId from /clients/[uuid] routes
  const clientId = useMemo(() => {
    const match = pathname?.match(/\/clients\/([0-9a-f-]{36})/i)
    return match?.[1]
  }, [pathname])

  // Fetch client name when on a client page
  useEffect(() => {
    if (!clientId) {
      setClientName(undefined)
      return
    }
    supabase
      .from('clients')
      .select('name')
      .eq('id', clientId)
      .single()
      .then(({ data }) => setClientName(data?.name ?? undefined))
  }, [clientId])

  const context: AgentContext = useMemo(
    () => ({ clientId, clientName, pageUrl: pathname || '/', sessionId }),
    [clientId, clientName, pathname, sessionId]
  )

  return (
    <AgentCtx.Provider value={{ context, isOpen, setIsOpen, sessionId, setSessionId }}>
      {children}
    </AgentCtx.Provider>
  )
}

export function useAgentContext() {
  return useContext(AgentCtx)
}
