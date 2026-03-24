'use client'

import { useState, useCallback, useRef } from 'react'
import type { ChatMessage, AgentContext, AttachedFile } from '@/lib/ai/types'

export function useAgent(context: AgentContext) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [activeTools, setActiveTools] = useState<string[]>([])
  const abortRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(async (userText: string, attachedFile?: AttachedFile) => {
    if ((!userText.trim() && !attachedFile) || isLoading) return

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userText || (attachedFile ? `📎 ${attachedFile.name}` : ''),
      attachedFile,
      createdAt: new Date(),
    }
    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)
    setStreamingText('')
    setActiveTools([])

    const historyForApi = [...messages, userMsg].map(m => ({
      role: m.role,
      content: m.content,
      ...(m.attachedFile ? { file: m.attachedFile } : {}),
    }))

    abortRef.current = new AbortController()

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: historyForApi, context }),
        signal: abortRef.current.signal,
      })

      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`)

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      const toolCallsForMessage: any[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        for (const line of chunk.split('\n')) {
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
              setMessages(prev => [...prev, {
                id: crypto.randomUUID(), role: 'assistant',
                content: `שגיאה: ${data.message}`, createdAt: new Date(),
              }])
              setStreamingText('')
              setActiveTools([])
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(), role: 'assistant',
        content: 'שגיאה בחיבור לסוכן. נסה שוב.', createdAt: new Date(),
      }])
      setStreamingText('')
      setActiveTools([])
    } finally {
      setIsLoading(false)
    }
  }, [messages, isLoading, context])

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
