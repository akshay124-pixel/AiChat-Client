import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUp, Paperclip, Square, Mic, MicOff } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { SendStatus } from '@/types'

// ── Web Speech API type declarations ──────────────────────────────────────────
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string
}
interface SpeechRecognitionInstance extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onstart: ((e: Event) => void) | null
  onend: ((e: Event) => void) | null
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null
}
declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance
  }
}

function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

// ── Props ──────────────────────────────────────────────────────────────────────
interface MessageInputProps {
  onSend: (text: string) => void
  onStop: () => void
  status: SendStatus
  disabled?: boolean
}

const MAX_ROWS = 12
const MIN_ROWS = 1

// ── Component ─────────────────────────────────────────────────────────────────
export function MessageInput({
  onSend,
  onStop,
  status,
  disabled = false,
}: MessageInputProps) {
  const [value, setValue] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [interimText, setInterimText] = useState('')

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const isStreaming = status === 'streaming' || status === 'sending'
  const canSend = value.trim().length > 0 && !isStreaming && !disabled
  const speechSupported = getSpeechRecognition() !== null

  // ── Auto-grow textarea ──────────────────────────────────────────────────────
  const resize = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const lineHeight = parseInt(getComputedStyle(el).lineHeight || '24', 10)
    const maxHeight = lineHeight * MAX_ROWS
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [])

  useEffect(() => { resize() }, [value, resize])

  // Focus on mount
  useEffect(() => { textareaRef.current?.focus() }, [])

  // Cleanup recognition on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
    }
  }, [])

  // ── Send ────────────────────────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || isStreaming) return
    // Stop any active recording before sending
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
    }
    onSend(trimmed)
    setValue('')
    setInterimText('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }, [value, isStreaming, isListening, onSend])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  // ── Voice input ─────────────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition()
    if (!SpeechRecognition) return

    setVoiceError(null)
    setInterimText('')

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.continuous = true       // keep recording until user stops
    recognition.interimResults = true   // show live transcription
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setIsListening(true)
    }

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      let interim = ''
      let finalText = ''

      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript
        if (e.results[i].isFinal) {
          finalText += transcript
        } else {
          interim += transcript
        }
      }

      if (finalText) {
        setValue((prev) => {
          const separator = prev.trim() ? ' ' : ''
          return prev + separator + finalText
        })
        setInterimText('')
      } else {
        setInterimText(interim)
      }
    }

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === 'no-speech') {
        // silence — not a real error
        return
      }
      if (e.error === 'not-allowed') {
        setVoiceError('Microphone access denied. Allow microphone in browser settings.')
      } else if (e.error === 'network') {
        setVoiceError('Network error. Voice recognition requires internet.')
      } else {
        setVoiceError(`Voice error: ${e.error}`)
      }
      setIsListening(false)
      setInterimText('')
    }

    recognition.onend = () => {
      setIsListening(false)
      setInterimText('')
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setIsListening(false)
    setInterimText('')
  }, [])

  const toggleVoice = useCallback(() => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }, [isListening, startListening, stopListening])

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="px-4 pb-4 pt-2">

      {/* Voice error toast */}
      {voiceError && (
        <div className={cn(
          'mx-auto w-full max-w-3xl mb-2',
          'flex items-center justify-between gap-2',
          'px-3 py-2 rounded-xl',
          'bg-red-500/10 border border-red-500/20 text-red-400 text-xs',
          'animate-fade-up',
        )}>
          <span>{voiceError}</span>
          <button
            onClick={() => setVoiceError(null)}
            className="hover:text-red-300 transition-colors ml-2 shrink-0"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* Input card */}
      <div
        className={cn(
          'mx-auto w-full max-w-3xl',
          'bg-surface-2 border rounded-2xl',
          'transition-all duration-200',
          isListening
            ? 'border-brand shadow-input shadow-brand/30'
            : 'border-border focus-within:border-border-strong focus-within:shadow-input',
          disabled && 'opacity-60 pointer-events-none',
        )}
      >
        {/* Live interim transcript bar */}
        {isListening && (
          <div className="px-4 pt-2.5 pb-0 flex items-center gap-2">
            {/* Animated pulse dots */}
            <div className="flex items-center gap-0.5 shrink-0">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
            <span className="text-xs text-brand truncate">
              {interimText || 'Listening…'}
            </span>
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={isListening ? 'Speak now — I\'m listening…' : 'Message AI Chat…'}
          rows={MIN_ROWS}
          aria-label="Message input"
          aria-multiline="true"
          className={cn(
            'w-full resize-none bg-transparent',
            'px-4 pt-3.5 pb-1',
            'text-sm text-text-primary placeholder:text-text-muted',
            'outline-none leading-6',
            'min-h-[52px]',
          )}
        />

        {/* Toolbar row */}
        <div className="flex items-center justify-between px-3 pb-3 pt-1 gap-2">

          {/* Left: attachment + voice */}
          <div className="flex items-center gap-1">
            {/* Attachment — placeholder */}
            <button
              disabled
              title="Attach file (coming soon)"
              aria-label="Attach file (coming soon)"
              className="p-2 rounded-xl text-text-muted opacity-40 cursor-not-allowed transition-colors"
            >
              <Paperclip size={16} />
            </button>

            {/* Voice button — functional */}
            {speechSupported ? (
              <button
                onClick={toggleVoice}
                disabled={disabled || isStreaming}
                title={isListening ? 'Stop recording' : 'Voice input'}
                aria-label={isListening ? 'Stop voice recording' : 'Start voice input'}
                aria-pressed={isListening}
                className={cn(
                  'relative p-2 rounded-xl transition-all duration-200 focus-ring',
                  isListening
                    ? 'text-brand bg-brand/10 hover:bg-brand/20'
                    : 'text-text-muted hover:text-text-primary hover:bg-surface-3',
                  (disabled || isStreaming) && 'opacity-40 cursor-not-allowed',
                )}
              >
                {/* Ripple ring when recording */}
                {isListening && (
                  <>
                    <span className="absolute inset-0 rounded-xl bg-brand/20 animate-ping" />
                    <span className="absolute inset-0 rounded-xl bg-brand/10 animate-pulse" />
                  </>
                )}
                {isListening
                  ? <MicOff size={16} className="relative z-10" />
                  : <Mic size={16} className="relative z-10" />
                }
              </button>
            ) : (
              <button
                disabled
                title="Voice input not supported in this browser"
                aria-label="Voice input not supported"
                className="p-2 rounded-xl text-text-muted opacity-30 cursor-not-allowed"
              >
                <Mic size={16} />
              </button>
            )}
          </div>

          {/* Right: char count + stop/send */}
          <div className="flex items-center gap-2">
            {value.length > 500 && (
              <span className="text-xs text-text-muted tabular-nums">
                {value.length.toLocaleString()}
              </span>
            )}

            {isStreaming ? (
              <button
                onClick={onStop}
                aria-label="Stop generation"
                className={cn(
                  'flex items-center justify-center w-9 h-9 rounded-xl',
                  'bg-surface-4 hover:bg-surface-5',
                  'border border-border hover:border-border-strong',
                  'text-text-primary transition-all duration-150 focus-ring',
                )}
              >
                <Square size={14} fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!canSend}
                aria-label="Send message"
                className={cn(
                  'flex items-center justify-center w-9 h-9 rounded-xl',
                  'transition-all duration-150 focus-ring',
                  canSend
                    ? [
                        'bg-brand hover:bg-brand-hover text-white shadow-brand',
                        'hover:shadow-glow hover:scale-105 active:scale-95',
                      ]
                    : 'bg-surface-3 text-text-muted cursor-not-allowed',
                )}
              >
                <ArrowUp size={16} strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Footer hint */}
      <p className="text-center text-[11px] text-text-muted mt-2 px-4">
        {isListening
          ? 'Click the mic again to stop recording'
          : 'Press Enter to send · Shift+Enter for newline · Mic for voice'}
      </p>
    </div>
  )
}
