'use client'

import { useState, useCallback, useRef } from 'react'
import { createChatSession } from '@/lib/actions/ai-chat'
import type { ChatMessage, AgentContext } from '@/lib/ai/types'

export function useAgent(context: AgentContext, sessionId?: string, setSessionId?: (id: string) => void) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [activeTools, setActiveTools] = useState<string[]>([])
  const abortRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(async (userText: string) => {
    if (!userText.trim() || isLoading) return

    // Add user message immediately
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userText,
      createdAt: new Date(),
    }
    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)
    setStreamingText('')
    setActiveTools([])

    // Ensure we have a session
    let currentSessionId = sessionId
    if (!currentSessionId) {
      const res = await createChatSession(context.clientId, context.pageUrl)
      if (res.success && res.session) {
        currentSessionId = res.session.id
        setSessionId?.(res.session.id)
      }
    }

    // Build messages history for API
    const historyForApi = [...messages, userMsg].map(m => ({
      role: m.role,
      content: m.content,
    }))

    abortRef.current = new AbortController()

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: historyForApi,
          context,
          sessionId: currentSessionId,
        }),
        signal: abortRef.current.signal,
      })

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      const toolCallsForMessage: any[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))

            if (data.type === 'text') {
              accumulated += data.delta
              setStreamingText(accumulated)
            } else if (data.type === 'tool_start') {
              setActiveTools(prev => [...prev, data.tool])
            } else if (data.type === 'tool_end') {
              setActiveTools(prev => prev.filter(t => t !== data.tool))
              toolCallsForMessage.push({ toolName: data.tool, success: data.success })
            } else if (data.type === 'done') {
              // Finalize assistant message
              const assistantMsg: ChatMessage = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: accumulated,
                toolCalls: data.tool_calls || toolCallsForMessage,
                createdAt: new Date(),
              }
              setMessages(prev => [...prev, assistantMsg])
              setStreamingText('')
              setActiveTools([])
            } else if (data.type === 'error') {
              const errMsg: ChatMessage = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: `שגיאה: ${data.message}`,
                createdAt: new Date(),
              }
              setMessages(prev => [...prev, errMsg])
              setStreamingText('')
              setActiveTools([])
            }
          } catch {
            // ignore parse errors for incomplete chunks
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return
      const errMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'שגיאה בחיבור לסוכן. נסה שוב.',
        createdAt: new Date(),
      }
      setMessages(prev => [...prev, errMsg])
      setStreamingText('')
      setActiveTools([])
    } finally {
      setIsLoading(false)
    }
  }, [messages, isLoading, context, sessionId, setSessionId])

  const clearMessages = useCallback(() => {
    abortRef.current?.abort()
    setMessages([])
    setStreamingText('')
    setActiveTools([])
    setIsLoading(false)
  }, [])

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort()
    setIsLoading(false)
    setStreamingText('')
    setActiveTools([])
  }, [])

  return { messages, isLoading, streamingText, activeTools, sendMessage, clearMessages, stopGeneration }
}
