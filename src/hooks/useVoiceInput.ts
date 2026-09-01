/**
 * src/hooks/useVoiceInput.ts
 *
 * Custom React hook for browser-native Speech-to-Text input.
 * Uses the Web Speech API (webkitSpeechRecognition / SpeechRecognition).
 *
 * Optimized for Hebrew (he-IL) by default.
 * Supported in Chrome, Edge, and Safari (desktop & mobile).
 *
 * Usage:
 *   const { isListening, isSupported, toggleListening } = useVoiceInput({
 *     onResult: (transcript) => setInput(prev => prev + ' ' + transcript),
 *   })
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface UseVoiceInputOptions {
  /** BCP-47 language tag. Default: 'he-IL' */
  lang?: string
  /** Keep listening after each result. Default: false (stops after one utterance) */
  continuous?: boolean
  /** Called with the final transcribed text */
  onResult: (transcript: string) => void
  /** Called on error (e.g., mic denied, not supported) */
  onError?: (error: string) => void
}

interface UseVoiceInputReturn {
  /** Whether the microphone is actively capturing */
  isListening: boolean
  /** Whether the browser supports Speech Recognition */
  isSupported: boolean
  /** Start capturing voice */
  startListening: () => void
  /** Stop capturing voice */
  stopListening: () => void
  /** Toggle between start and stop */
  toggleListening: () => void
}

// Detect the SpeechRecognition API (vendor-prefixed in Chrome/Edge)
function getSpeechRecognitionConstructor(): (new () => SpeechRecognition) | null {
  if (typeof window === 'undefined') return null
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  return SR ?? null
}

export function useVoiceInput(options: UseVoiceInputOptions): UseVoiceInputReturn {
  const { lang = 'he-IL', continuous = false, onResult, onError } = options
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const isSupported = typeof window !== 'undefined' && !!getSpeechRecognitionConstructor()

  // Stable callback refs to avoid re-creating the recognition instance
  const onResultRef = useRef(onResult)
  const onErrorRef = useRef(onError)
  useEffect(() => { onResultRef.current = onResult }, [onResult])
  useEffect(() => { onErrorRef.current = onError }, [onError])

  const startListening = useCallback(() => {
    const SRConstructor = getSpeechRecognitionConstructor()
    if (!SRConstructor) {
      onErrorRef.current?.('הדפדפן שלך לא תומך בזיהוי קולי. נסה Chrome או Edge.')
      return
    }

    // Stop any existing instance
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch { /* ignore */ }
    }

    const recognition = new SRConstructor()
    recognition.lang = lang
    recognition.continuous = continuous
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setIsListening(true)
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const lastResult = event.results[event.results.length - 1]
      if (lastResult?.isFinal) {
        const transcript = lastResult[0]?.transcript?.trim()
        if (transcript) {
          onResultRef.current(transcript)
        }
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setIsListening(false)
      const errorMessages: Record<string, string> = {
        'not-allowed': 'גישה למיקרופון נדחתה. יש לאפשר גישה בהגדרות הדפדפן.',
        'no-speech': 'לא זוהה דיבור. נסה שוב.',
        'audio-capture': 'לא נמצא מיקרופון. חבר מיקרופון ונסה שוב.',
        'network': 'שגיאת רשת בזיהוי הקולי. בדוק את חיבור האינטרנט.',
        'aborted': '', // User-initiated abort — no error to show
        'service-not-allowed': 'שירות זיהוי קולי אינו זמין כעת.',
      }
      const message = errorMessages[event.error] ?? `שגיאה בזיהוי קולי: ${event.error}`
      if (message) onErrorRef.current?.(message)
    }

    recognition.onend = () => {
      setIsListening(false)
      recognitionRef.current = null
    }

    recognitionRef.current = recognition

    try {
      recognition.start()
    } catch (err) {
      setIsListening(false)
      onErrorRef.current?.('לא ניתן להפעיל זיהוי קולי. נסה לרענן את הדף.')
    }
  }, [lang, continuous])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch { /* ignore */ }
      recognitionRef.current = null
    }
    setIsListening(false)
  }, [])

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }, [isListening, startListening, stopListening])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort() } catch { /* ignore */ }
      }
    }
  }, [])

  return {
    isListening,
    isSupported,
    startListening,
    stopListening,
    toggleListening,
  }
}
