// -------------------------------------------------------------------------
// Core domain types — mirror the backend Pydantic schemas
// -------------------------------------------------------------------------

export type MessageRole = 'user' | 'assistant' | 'system'

export interface Message {
  id: string
  role: MessageRole
  content: string
  created_at: string // ISO 8601
}

export interface ConversationSummary {
  id: string
  title: string
  created_at: string
  updated_at: string
  message_count: number
  last_message_preview: string | null
}

export interface ConversationDetail {
  id: string
  title: string
  created_at: string
  updated_at: string
  system_prompt: string | null
  messages: Message[]
}

// -------------------------------------------------------------------------
// API request / response shapes
// -------------------------------------------------------------------------

export interface ChatRequest {
  message: string
  conversation_id?: string
  system_prompt?: string
  model?: string
}

export interface ChatResponse {
  message: Message
  conversation_id: string
  model: string
}

export interface StreamChunk {
  content: string
  done: boolean
  conversation_id?: string
  model?: string
  error?: string
}

export interface ConversationCreate {
  title?: string
  system_prompt?: string
}

// -------------------------------------------------------------------------
// UI-only types
// -------------------------------------------------------------------------

export type Theme = 'dark' | 'light'

export type MessageFeedback = 'up' | 'down' | null

/** Enriched message for display — adds UI state on top of the domain model */
export interface UIMessage extends Message {
  streaming?: boolean
  error?: boolean
  feedback?: MessageFeedback
}

export interface ConversationGroup {
  label: string
  conversations: ConversationSummary[]
}

export type SendStatus = 'idle' | 'sending' | 'streaming' | 'error'

export interface ChatState {
  conversations: ConversationSummary[]
  activeConversationId: string | null
  messages: UIMessage[]
  sendStatus: SendStatus
  error: string | null
  streamingContent: string
}
