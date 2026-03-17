import { NextRequest, NextResponse } from 'next/server'
import { agentTools, executeTool } from '@/lib/ai/tools'
import { buildSystemPrompt } from '@/lib/ai/system-prompt'
import { saveChatMessage, createChatSession } from '@/lib/actions/ai-chat'
import type { AgentRequest, GeminiContent } from '@/lib/ai/types'

const GEMINI_MODELS = ['gemini-flash-latest', 'gemini-pro-latest']
const MAX_TOOL_ROUNDS = 5

// Simple in-memory rate limiter (per session, resets on server restart)
const rateLimiter = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(sessionKey: string): boolean {
  const now = Date.now()
  const window = 10 * 60 * 1000 // 10 minutes
  const limit = 30

  const entry = rateLimiter.get(sessionKey)
  if (!entry || now > entry.resetAt) {
    rateLimiter.set(sessionKey, { count: 1, resetAt: now + window })
    return true
  }
  if (entry.count >= limit) return false
  entry.count++
  return true
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'מפתח Gemini API לא מוגדר' }, { status: 500 })
  }

  let body: AgentRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'בקשה לא תקינה' }, { status: 400 })
  }

  const { messages, context, sessionId } = body

  // Rate limit check
  const rateKey = sessionId || request.headers.get('x-forwarded-for') || 'default'
  if (!checkRateLimit(rateKey)) {
    return NextResponse.json({ error: 'יותר מדי בקשות. המתן כמה דקות.' }, { status: 429 })
  }

  // Build conversation history for Gemini
  const history: GeminiContent[] = messages.map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }))

  const systemPrompt = buildSystemPrompt(context)

  // Streaming response
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      // Helper: call Gemini — retries same model on 429/503, skips on 404
      const callGemini = async (contents: GeminiContent[], sp: string) => {
        for (const model of GEMINI_MODELS) {
          for (let attempt = 1; attempt <= 3; attempt++) {
            let res: Response
            try {
              res = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    system_instruction: { parts: [{ text: sp }] },
                    contents,
                    tools: agentTools,
                    generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
                  }),
                }
              )
            } catch (fetchErr) {
              console.error(`Fetch failed for ${model} attempt ${attempt}:`, fetchErr)
              break
            }

            console.log(`Gemini ${model} attempt ${attempt}: ${res.status}`)

            if (res.status === 404) break // model doesn't exist, try next

            if (res.status === 429 || res.status === 503) {
              const delay = attempt * 3000 // 3s, 6s, 9s
              console.warn(`Rate limited on ${model}, waiting ${delay}ms...`)
              await new Promise(r => setTimeout(r, delay))
              continue // retry same model
            }

            return res // success or other error — return to caller
          }
        }
        return null
      }

      try {
        // ── Agentic loop: call Gemini → run tools → repeat ─────────────
        let currentHistory = [...history]
        let finalText = ''
        const allToolCalls: any[] = []

        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const geminiResponse = await callGemini(currentHistory, systemPrompt)

          if (!geminiResponse || !geminiResponse.ok) {
            const status = geminiResponse?.status ?? 0
            const err = geminiResponse ? await geminiResponse.text() : 'כל המודלים עמוסים'
            console.error('Gemini error:', status, err)
            const msg = status === 0
              ? 'שירות Gemini לא זמין כרגע. נסה שוב בעוד כמה שניות.'
              : (status === 429 || status === 503)
              ? 'שירות Gemini עמוס כרגע. נסה שוב בעוד כמה שניות.'
              : `שגיאה מ-Gemini (${status})`
            send({ type: 'error', message: msg })
            controller.close()
            return
          }

          const geminiData = await geminiResponse.json()
          const candidate = geminiData.candidates?.[0]
          const parts = candidate?.content?.parts || []

          // Collect function calls from this round
          const functionCalls = parts.filter((p: any) => p.functionCall)
          const textParts = parts.filter((p: any) => p.text)

          // If there are function calls — execute them
          if (functionCalls.length > 0) {
            // Add model's response (with function calls) to history
            currentHistory.push({ role: 'model', parts })

            // Execute all tools and collect results
            const toolResponseParts: any[] = []

            for (const part of functionCalls) {
              const { name, args } = part.functionCall
              send({ type: 'tool_start', tool: name })

              let result: any
              try {
                result = await executeTool(name, args || {}, context)
              } catch (err: any) {
                result = { error: err.message }
              }

              const success = !result?.error
              send({ type: 'tool_end', tool: name, success })

              allToolCalls.push({ toolName: name, args, result, success })
              toolResponseParts.push({
                functionResponse: {
                  name,
                  response: { result },
                },
              })
            }

            // Add tool results to history and loop again
            currentHistory.push({ role: 'user', parts: toolResponseParts })
            continue
          }

          // No function calls — this is the final text response
          finalText = textParts.map((p: any) => p.text).join('')
          break
        }

        // Stream the final text word by word for smooth UX
        if (finalText) {
          const words = finalText.split(' ')
          for (let i = 0; i < words.length; i++) {
            const chunk = i === 0 ? words[i] : ' ' + words[i]
            send({ type: 'text', delta: chunk })
            // Small delay for streaming effect
            await new Promise(r => setTimeout(r, 15))
          }
        }

        send({ type: 'done', tool_calls: allToolCalls })

        // Save to DB (fire and forget — don't block the stream)
        if (sessionId && finalText) {
          const lastUserMsg = messages[messages.length - 1]
          if (lastUserMsg) {
            saveChatMessage(sessionId, 'user', lastUserMsg.content).catch(console.error)
          }
          saveChatMessage(sessionId, 'assistant', finalText, allToolCalls).catch(console.error)
        }

      } catch (err: any) {
        console.error('Agent stream error:', err)
        send({ type: 'error', message: 'שגיאה פנימית בסוכן' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
