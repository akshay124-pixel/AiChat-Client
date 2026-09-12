import { useCallback, useState } from 'react'
import {
  Check,
  Copy,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  AlertCircle,
  Sparkles,
  User,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { MarkdownRenderer } from './MarkdownRenderer'
import type { UIMessage, MessageFeedback } from '@/types'

interface MessageBubbleProps {
  message: UIMessage
  isLast: boolean
  onRegenerate?: () => void
  onFeedback?: (feedback: MessageFeedback) => void
}

// ---------------------------------------------------------------------------
// Typing indicator (three animated dots)
// ---------------------------------------------------------------------------
function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 py-2 px-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-text-muted animate-pulse-dot"
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Copy button
// ---------------------------------------------------------------------------
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }, [text])

  return (
    <button
      onClick={handleCopy}
      aria-label="Copy message"
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs',
        'transition-all duration-150 focus-ring',
        copied
          ? 'text-brand bg-brand/10'
          : 'text-text-muted hover:text-text-secondary hover:bg-surface-3',
      )}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Message bubble
// ---------------------------------------------------------------------------
export function MessageBubble({
  message,
  isLast,
  onRegenerate,
  onFeedback,
}: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'
  const isEmpty = !message.content.trim()

  return (
    <div
      className={cn(
        'group flex gap-4 w-full message-appear',
        isUser ? 'flex-row-reverse' : 'flex-row',
      )}
    >
      {/* Avatar */}
      <div className="shrink-0 mt-0.5">
        {isUser ? (
          <div
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center',
              'bg-surface-4 border border-border',
            )}
          >
            <User size={15} className="text-text-secondary" />
          </div>
        ) : (
          <div
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center',
              'bg-gradient-brand shadow-brand',
            )}
          >
            <Sparkles size={14} className="text-white" />
          </div>
        )}
      </div>

      {/* Content column */}
      <div className={cn('flex flex-col gap-2 min-w-0', isUser ? 'items-end' : 'items-start', 'flex-1 max-w-[85%]')}>
        {/* Bubble */}
        <div
          className={cn(
            'rounded-2xl px-4 py-3 text-sm leading-relaxed',
            isUser
              ? [
                  'bg-surface-4 text-text-primary',
                  'rounded-tr-sm border border-border',
                ]
              : [
                  'bg-transparent text-text-primary w-full',
                  message.error && 'bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3',
                ],
          )}
        >
          {/* Error state */}
          {message.error ? (
            <div className="flex items-start gap-2.5 text-red-400">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span className="text-sm">{message.content || 'An error occurred. Please try again.'}</span>
            </div>
          ) : isUser ? (
            // User message — plain whitespace-preserved text
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          ) : isEmpty && message.streaming ? (
            // Streaming but no content yet
            <TypingIndicator />
          ) : (
            // Assistant markdown
            <MarkdownRenderer
              content={message.content}
              streaming={message.streaming}
            />
          )}
        </div>

        {/* Action row — only for assistant messages */}
        {isAssistant && !isEmpty && !message.streaming && (
          <div
            className={cn(
              'flex items-center gap-1',
              'opacity-0 group-hover:opacity-100 transition-opacity duration-150',
            )}
          >
            <CopyButton text={message.content} />

            {/* Regenerate — only on the last assistant message */}
            {isLast && onRegenerate && (
              <button
                onClick={onRegenerate}
                aria-label="Regenerate response"
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs text-text-muted hover:text-text-secondary hover:bg-surface-3 transition-all duration-150 focus-ring"
              >
                <RefreshCw size={13} />
                <span className="hidden sm:inline">Regenerate</span>
              </button>
            )}

            {/* Feedback */}
            {onFeedback && (
              <div className="flex items-center gap-0.5 ml-1">
                <button
                  onClick={() =>
                    onFeedback(message.feedback === 'up' ? null : 'up')
                  }
                  aria-label="Thumbs up"
                  aria-pressed={message.feedback === 'up'}
                  className={cn(
                    'p-1.5 rounded-lg transition-all duration-150 focus-ring',
                    message.feedback === 'up'
                      ? 'text-brand bg-brand/10'
                      : 'text-text-muted hover:text-text-secondary hover:bg-surface-3',
                  )}
                >
                  <ThumbsUp size={13} />
                </button>
                <button
                  onClick={() =>
                    onFeedback(message.feedback === 'down' ? null : 'down')
                  }
                  aria-label="Thumbs down"
                  aria-pressed={message.feedback === 'down'}
                  className={cn(
                    'p-1.5 rounded-lg transition-all duration-150 focus-ring',
                    message.feedback === 'down'
                      ? 'text-red-400 bg-red-400/10'
                      : 'text-text-muted hover:text-text-secondary hover:bg-surface-3',
                  )}
                >
                  <ThumbsDown size={13} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
