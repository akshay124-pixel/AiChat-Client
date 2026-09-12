import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowUp,
  Paperclip,
  Square,
  Mic,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import type { SendStatus } from '@/types'

interface MessageInputProps {
  onSend: (text: string) => void
  onStop: () => void
  status: SendStatus
  disabled?: boolean
}

const MAX_ROWS = 12
const MIN_ROWS = 1

export function MessageInput({
  onSend,
  onStop,
  status,
  disabled = false,
}: MessageInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isStreaming = status === 'streaming' || status === 'sending'
  const canSend = value.trim().length > 0 && !isStreaming && !disabled

  // Auto-grow textarea
  const resize = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const lineHeight = parseInt(getComputedStyle(el).lineHeight || '24', 10)
    const maxHeight = lineHeight * MAX_ROWS
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [])

  useEffect(() => {
    resize()
  }, [value, resize])

  // Focus on mount
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const handleSend = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || isStreaming) return
    onSend(trimmed)
    setValue('')
    // Reset height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [value, isStreaming, onSend])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  return (
    <div className="px-4 pb-4 pt-2">
      {/* Input card */}
      <div
        className={cn(
          'mx-auto w-full max-w-3xl',
          'bg-surface-2 border border-border rounded-2xl',
          'transition-all duration-200',
          'focus-within:border-border-strong focus-within:shadow-input',
          disabled && 'opacity-60 pointer-events-none',
        )}
      >
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Message AI Chat…"
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
          {/* Left: attachment button (placeholder) */}
          <div className="flex items-center gap-1">
            <button
              disabled
              title="Attach file (coming soon)"
              aria-label="Attach file (coming soon)"
              className="p-2 rounded-xl text-text-muted opacity-40 cursor-not-allowed transition-colors"
            >
              <Paperclip size={16} />
            </button>
            <button
              disabled
              title="Voice input (coming soon)"
              aria-label="Voice input (coming soon)"
              className="p-2 rounded-xl text-text-muted opacity-40 cursor-not-allowed transition-colors"
            >
              <Mic size={16} />
            </button>
          </div>

          {/* Right: stop or send */}
          <div className="flex items-center gap-2">
            {/* Character hint */}
            {value.length > 500 && (
              <span className="text-xs text-text-muted tabular-nums">
                {value.length.toLocaleString()}
              </span>
            )}

            {isStreaming ? (
              /* Stop button */
              <button
                onClick={onStop}
                aria-label="Stop generation"
                className={cn(
                  'flex items-center justify-center w-9 h-9 rounded-xl',
                  'bg-surface-4 hover:bg-surface-5',
                  'border border-border hover:border-border-strong',
                  'text-text-primary transition-all duration-150',
                  'focus-ring',
                )}
              >
                <Square size={14} fill="currentColor" />
              </button>
            ) : (
              /* Send button */
              <button
                onClick={handleSend}
                disabled={!canSend}
                aria-label="Send message"
                className={cn(
                  'flex items-center justify-center w-9 h-9 rounded-xl',
                  'transition-all duration-150 focus-ring',
                  canSend
                    ? [
                        'bg-brand hover:bg-brand-hover',
                        'text-white shadow-brand',
                        'hover:shadow-glow hover:scale-105 active:scale-95',
                      ]
                    : [
                        'bg-surface-3 text-text-muted',
                        'cursor-not-allowed',
                      ],
                )}
              >
                <ArrowUp size={16} strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      </div>

    
    </div>
  )
}
