'use client'

import { createContext, useContext, useState, useMemo, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { AgentContext } from '@/lib/ai/types'

interface AgentContextValue {
  context: AgentContext
  isOpen: boolean
  setIsOpen: (open: boolean) => void
}

const AgentCtx = createContext<AgentContextValue>({
  context: { pageUrl: '/' },
  isOpen: false,
  setIsOpen: () => {},
})

interface AgentProviderProps {
  children: React.ReactNode
  fixedClientId?: string
  fixedClientName?: string
  isPortalMode?: boolean
}

export function AgentProvider({ children, fixedClientId, fixedClientName, isPortalMode = false }: AgentProviderProps) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [clientName, setClientName] = useState<string | undefined>(fixedClientName)

  const routeClientId = useMemo(() => {
    if (fixedClientId) return undefined
    const match = pathname?.match(/\/clients\/([0-9a-f-]{36})/i)
    return match?.[1]
  }, [pathname, fixedClientId])

  const clientId = fixedClientId || routeClientId

  useEffect(() => {
    if (fixedClientName) { setClientName(fixedClientName); return }
    if (!routeClientId) { setClientName(undefined); return }
    supabase
      .from('clients').select('name').eq('id', routeClientId).single()
      .then(({ data }) => setClientName(data?.name ?? undefined))
  }, [routeClientId, fixedClientName])

  const context: AgentContext = useMemo(
    () => ({ clientId, clientName, pageUrl: pathname || '/', isPortalMode }),
    [clientId, clientName, pathname, isPortalMode]
  )

  return (
    <AgentCtx.Provider value={{ context, isOpen, setIsOpen }}>
      {children}
    </AgentCtx.Provider>
  )
}

export function useAgentContext() {
  return useContext(AgentCtx)
}
