/**
 * useChat — core state management hook for the chat UI.
 *
 * Manages: messages, streaming, conversation lifecycle, errors.
 * The UI layer never touches the API service directly.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  deleteConversation,
  getConversation,
  listConversations,
  renameConversation,
  sendChatStream,
} from '@/services/api'
import type {
  ConversationSummary,
  SendStatus,
  UIMessage,
} from '@/types'

// ---------------------------------------------------------------------------
// Tiny ID generator — uses crypto.randomUUID when available
// ---------------------------------------------------------------------------
function newId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// ---------------------------------------------------------------------------

export interface UseChatReturn {
  // state
  conversations: ConversationSummary[]
  activeConversationId: string | null
  messages: UIMessage[]
  sendStatus: SendStatus
  error: string | null
  streamingMessageId: string | null

  // actions
  selectConversation: (id: string) => Promise<void>
  newConversation: () => void
  sendMessage: (text: string) => void
  stopGeneration: () => void
  regenerateLastResponse: () => void
  deleteConv: (id: string) => Promise<void>
  renameConv: (id: string, title: string) => Promise<void>
  setMessageFeedback: (messageId: string, feedback: 'up' | 'down' | null) => void
  loadConversations: () => Promise<void>
  clearError: () => void
}

export function useChat(): UseChatReturn {
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [sendStatus, setSendStatus] = useState<SendStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)

  // Keep a ref to the active conversation ID for use inside callbacks
  const activeIdRef = useRef<string | null>(null)
  activeIdRef.current = activeConversationId

  // AbortController for the current stream
  const abortRef = useRef<AbortController | null>(null)

  // Buffer for streaming text to reduce re-renders
  const streamBufferRef = useRef<string>('')
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ---------------------------------------------------------------------------
  // Internal stream cleanup helper
  // ---------------------------------------------------------------------------
  const cleanup = useCallback(() => {
    if (flushTimerRef.current) {
      clearInterval(flushTimerRef.current)
      flushTimerRef.current = null
    }
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Load conversations list
  // ---------------------------------------------------------------------------
  const loadConversations = useCallback(async () => {
    try {
      const list = await listConversations()
      setConversations(list)
    } catch {
      // Non-fatal — sidebar just stays empty
    }
  }, [])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  // ---------------------------------------------------------------------------
  // Select conversation
  // ---------------------------------------------------------------------------
  const selectConversation = useCallback(
    async (id: string) => {
      if (id === activeIdRef.current) return
      cleanup()
      try {
        const detail = await getConversation(id)
        setActiveConversationId(id)
        setMessages(
          detail.messages.map((m) => ({
            ...m,
            streaming: false,
            error: false,
            feedback: null,
          })),
        )
        setError(null)
        setSendStatus('idle')
      } catch {
        setError('Failed to load conversation.')
      }
    },
    [cleanup],
  )

  // ---------------------------------------------------------------------------
  // New conversation
  // ---------------------------------------------------------------------------
  const newConversation = useCallback(() => {
    cleanup()
    setActiveConversationId(null)
    setMessages([])
    setError(null)
    setSendStatus('idle')
  }, [cleanup])

  // ---------------------------------------------------------------------------
  // Send message
  // ---------------------------------------------------------------------------
  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || sendStatus === 'streaming') return

      setError(null)
      setSendStatus('sending')

      // Optimistically add user message
      const userMsg: UIMessage = {
        id: newId(),
        role: 'user',
        content: trimmed,
        created_at: new Date().toISOString(),
        streaming: false,
        error: false,
        feedback: null,
      }
      setMessages((prev) => [...prev, userMsg])

      // Placeholder for assistant response
      const assistantMsgId = newId()
      const assistantPlaceholder: UIMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        created_at: new Date().toISOString(),
        streaming: true,
        error: false,
        feedback: null,
      }
      setMessages((prev) => [...prev, assistantPlaceholder])
      setStreamingMessageId(assistantMsgId)
      streamBufferRef.current = ''

      // Start flushing buffer to state at ~60fps
      if (flushTimerRef.current) clearInterval(flushTimerRef.current)
      flushTimerRef.current = setInterval(() => {
        const buf = streamBufferRef.current
        if (buf) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, content: buf, streaming: true }
                : m,
            ),
          )
        }
      }, 16)

      const conversationId = activeIdRef.current ?? undefined

      setSendStatus('streaming')

      const controller = sendChatStream(
        { message: trimmed, conversation_id: conversationId },
        (chunk) => {
          // Capture conversation ID from first event
          if (chunk.conversation_id && !activeIdRef.current) {
            setActiveConversationId(chunk.conversation_id)
            activeIdRef.current = chunk.conversation_id
          }
          if (chunk.content) {
            streamBufferRef.current += chunk.content
          }
        },
        (errMsg) => {
          cleanup()
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    content: errMsg,
                    streaming: false,
                    error: true,
                  }
                : m,
            ),
          )
          setSendStatus('error')
          setError(errMsg)
          setStreamingMessageId(null)
        },
        () => {
          cleanup()
          // Flush final buffer
          const finalContent = streamBufferRef.current
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, content: finalContent, streaming: false, error: false }
                : m,
            ),
          )
          setSendStatus('idle')
          setStreamingMessageId(null)
          // Refresh conversation list to pick up updated title/preview
          loadConversations()
        },
      )

      abortRef.current = controller
    },
    [sendStatus, cleanup, loadConversations],
  )

  // ---------------------------------------------------------------------------
  // Stop generation
  // ---------------------------------------------------------------------------
  const stopGeneration = useCallback(() => {
    const sid = streamingMessageId
    cleanup()
    if (sid) {
      const finalContent = streamBufferRef.current
      setMessages((prev) =>
        prev.map((m) =>
          m.id === sid
            ? { ...m, content: finalContent || '*(generation stopped)*', streaming: false }
            : m,
        ),
      )
    }
    setSendStatus('idle')
    setStreamingMessageId(null)
    loadConversations()
  }, [streamingMessageId, cleanup, loadConversations])

  // ---------------------------------------------------------------------------
  // Regenerate last response
  // ---------------------------------------------------------------------------
  const regenerateLastResponse = useCallback(() => {
    if (sendStatus === 'streaming') return

    setMessages((prev) => {
      const lastUserIdx = [...prev].reverse().findIndex((m) => m.role === 'user')
      if (lastUserIdx === -1) return prev
      const idx = prev.length - 1 - lastUserIdx
      const trimmed = prev.slice(0, idx + 1)
      const lastUserMsg = prev[idx]
      setTimeout(() => sendMessage(lastUserMsg.content), 0)
      return trimmed
    })
  }, [sendStatus, sendMessage])

  // ---------------------------------------------------------------------------
  // Delete conversation
  // ---------------------------------------------------------------------------
  const deleteConv = useCallback(
    async (id: string) => {
      await deleteConversation(id)
      setConversations((prev) => prev.filter((c) => c.id !== id))
      if (activeIdRef.current === id) {
        setActiveConversationId(null)
        setMessages([])
      }
    },
    [],
  )

  // ---------------------------------------------------------------------------
  // Rename conversation
  // ---------------------------------------------------------------------------
  const renameConv = useCallback(async (id: string, title: string) => {
    const updated = await renameConversation(id, title)
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, title: updated.title, updated_at: updated.updated_at }
          : c,
      ),
    )
  }, [])

  // ---------------------------------------------------------------------------
  // Message feedback
  // ---------------------------------------------------------------------------
  const setMessageFeedback = useCallback(
    (messageId: string, feedback: 'up' | 'down' | null) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, feedback } : m)),
      )
    },
    [],
  )

  // ---------------------------------------------------------------------------
  // Cleanup on unmount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  return {
    conversations,
    activeConversationId,
    messages,
    sendStatus,
    error,
    streamingMessageId,
    selectConversation,
    newConversation,
    sendMessage,
    stopGeneration,
    regenerateLastResponse,
    deleteConv,
    renameConv,
    setMessageFeedback,
    loadConversations,
    clearError: () => setError(null),
  }
}
