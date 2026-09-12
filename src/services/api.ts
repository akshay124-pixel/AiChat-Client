/// <reference types="vite/client" />
/**
 * API service layer.
 *
 * All communication with the FastAPI backend goes through this module.
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  Deployment targets                                             │
 * │                                                                 │
 * │  Vercel (frontend)  →  VITE_API_BASE_URL = https://api.you.com │
 * │  Local dev          →  VITE_API_BASE_URL = http://localhost:8000│
 * │                        (or leave empty to use Vite dev proxy)  │
 * └─────────────────────────────────────────────────────────────────┘
 */

import type {
  ChatRequest,
  ChatResponse,
  ConversationCreate,
  ConversationDetail,
  ConversationSummary,
  Message,
  StreamChunk,
} from '@/types'

// Remove trailing slash so path concatenation is always clean
const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// ---------------------------------------------------------------------------
// Generic JSON request helper
// ---------------------------------------------------------------------------

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`
  let response: Response

  try {
    response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...init?.headers,
      },
      ...init,
    })
  } catch {
    throw new ApiError(0, 'Network error — cannot reach the server.')
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status}`
    try {
      const body = (await response.json()) as { detail?: string }
      if (body.detail) detail = body.detail
    } catch {
      // ignore JSON parse error on error response
    }
    throw new ApiError(response.status, detail)
  }

  // 204 No Content
  if (response.status === 204) return undefined as T

  return response.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export interface HealthResponse {
  status: 'ok' | 'degraded'
  services: {
    api: string
    ollama: {
      status: string
      base_url: string
      version: string | null
      active_model: string
      available_models: string[]
    }
  }
}

export async function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/api/health')
}

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

export async function listConversations(): Promise<ConversationSummary[]> {
  return request<ConversationSummary[]>('/api/conversations')
}

export async function createConversation(
  payload: ConversationCreate = {},
): Promise<ConversationDetail> {
  return request<ConversationDetail>('/api/conversations', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getConversation(id: string): Promise<ConversationDetail> {
  return request<ConversationDetail>(`/api/conversations/${id}`)
}

export async function deleteConversation(id: string): Promise<void> {
  return request<void>(`/api/conversations/${id}`, { method: 'DELETE' })
}

export async function renameConversation(
  id: string,
  title: string,
): Promise<ConversationDetail> {
  return request<ConversationDetail>(`/api/conversations/${id}/title`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  })
}

export async function addMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
): Promise<Message> {
  return request<Message>(`/api/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ role, content }),
  })
}

// ---------------------------------------------------------------------------
// Chat (non-streaming)
// ---------------------------------------------------------------------------

export async function sendChat(payload: ChatRequest): Promise<ChatResponse> {
  return request<ChatResponse>('/api/chat', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

// ---------------------------------------------------------------------------
// Chat (streaming via Server-Sent Events)
// ---------------------------------------------------------------------------

export type StreamCallback = (chunk: StreamChunk) => void
export type ErrorCallback = (error: string) => void

/**
 * Opens a streaming POST to /api/chat/stream.
 * Calls onChunk for every token chunk, onError on failure, onDone when complete.
 *
 * @returns AbortController — call .abort() to cancel mid-stream.
 */
export function sendChatStream(
  payload: ChatRequest,
  onChunk: StreamCallback,
  onError: ErrorCallback,
  onDone: () => void,
): AbortController {
  const controller = new AbortController()
  const url = `${BASE_URL}/api/chat/stream`

  // Track whether onDone has already been called to avoid double-firing
  let doneCalled = false
  function callDoneOnce() {
    if (!doneCalled) {
      doneCalled = true
      onDone()
    }
  }

  ;(async () => {
    let response: Response

    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        callDoneOnce()
        return
      }
      onError('Network error — cannot reach the server.')
      callDoneOnce()
      return
    }

    if (!response.ok) {
      let detail = `Server error (${response.status})`
      try {
        const body = (await response.json()) as { detail?: string }
        if (body.detail) detail = body.detail
      } catch {
        // ignore
      }
      onError(detail)
      callDoneOnce()
      return
    }

    if (!response.body) {
      onError('No response body from server.')
      callDoneOnce()
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (!raw) continue

          let chunk: StreamChunk
          try {
            chunk = JSON.parse(raw) as StreamChunk
          } catch {
            continue // malformed JSON — skip silently
          }

          if (chunk.error) {
            onError(chunk.error)
            callDoneOnce()
            return
          }

          onChunk(chunk)

          if (chunk.done) {
            callDoneOnce()
            return
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        onError('Stream interrupted unexpectedly.')
      }
    } finally {
      reader.releaseLock()
      callDoneOnce()
    }
  })()

  return controller
}
