import { useEffect, useRef } from 'react'
import { MessageBubble } from './MessageBubble'
import type { MessageFeedback, UIMessage } from '@/types'

interface MessageListProps {
  messages: UIMessage[]
  onRegenerate: () => void
  onFeedback: (messageId: string, feedback: MessageFeedback) => void
}

export function MessageList({ messages, onRegenerate, onFeedback }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 200

    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [messages])

  // Find the last assistant message index for "regenerate" button
  const lastAssistantIdx = [...messages]
    .map((m, i) => ({ role: m.role, i }))
    .filter((x) => x.role === 'assistant')
    .at(-1)?.i

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-4 py-6 scroll-smooth"
      role="log"
      aria-live="polite"
      aria-label="Conversation messages"
    >
      <div className="mx-auto w-full max-w-3xl space-y-6">
        {messages.map((message, idx) => (
          <MessageBubble
            key={message.id}
            message={message}
            isLast={idx === lastAssistantIdx}
            onRegenerate={
              idx === lastAssistantIdx && !message.streaming
                ? onRegenerate
                : undefined
            }
            onFeedback={(fb) => onFeedback(message.id, fb)}
          />
        ))}

        {/* Scroll anchor */}
        <div ref={bottomRef} aria-hidden="true" />
      </div>
    </div>
  )
}
