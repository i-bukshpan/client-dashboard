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

interface AgentProviderProps {
  children: React.ReactNode
  fixedClientId?: string      // Portal mode: override clientId extraction
  fixedClientName?: string    // Portal mode: override clientName lookup
  isPortalMode?: boolean      // Portal mode: restricts AI to single client
}

export function AgentProvider({ children, fixedClientId, fixedClientName, isPortalMode = false }: AgentProviderProps) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [sessionId, setSessionId] = useState<string | undefined>(undefined)
  const [clientName, setClientName] = useState<string | undefined>(fixedClientName)

  // Extract clientId from /clients/[uuid] routes (skipped in portal mode)
  const routeClientId = useMemo(() => {
    if (fixedClientId) return undefined
    const match = pathname?.match(/\/clients\/([0-9a-f-]{36})/i)
    return match?.[1]
  }, [pathname, fixedClientId])

  const clientId = fixedClientId || routeClientId

  // Fetch client name when on a client page (skipped in portal mode)
  useEffect(() => {
    if (fixedClientName) {
      setClientName(fixedClientName)
      return
    }
    if (!routeClientId) {
      setClientName(undefined)
      return
    }
    supabase
      .from('clients')
      .select('name')
      .eq('id', routeClientId)
      .single()
      .then(({ data }) => setClientName(data?.name ?? undefined))
  }, [routeClientId, fixedClientName])

  const context: AgentContext = useMemo(
    () => ({ clientId, clientName, pageUrl: pathname || '/', sessionId, isPortalMode }),
    [clientId, clientName, pathname, sessionId, isPortalMode]
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
