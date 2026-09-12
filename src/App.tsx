import { useCallback, useEffect, useState } from 'react'
import { useChat } from '@/hooks/useChat'
import { useTheme } from '@/hooks/useTheme'
import { getHealth } from '@/services/api'
import { Sidebar } from '@/components/Sidebar'
import { ChatHeader } from '@/components/ChatHeader'
import { WelcomeScreen } from '@/components/WelcomeScreen'
import { MessageList } from '@/components/MessageList'
import { MessageInput } from '@/components/MessageInput'
import { ErrorBanner } from '@/components/ErrorBanner'
import { StatusIndicator } from '@/components/StatusIndicator'

export default function App() {
  const { theme, toggleTheme } = useTheme()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [ollamaConnected, setOllamaConnected] = useState<boolean | null>(null)
  const [activeModel, setActiveModel] = useState<string | undefined>()

  const {
    conversations,
    activeConversationId,
    messages,
    sendStatus,
    error,
    selectConversation,
    newConversation,
    sendMessage,
    stopGeneration,
    regenerateLastResponse,
    deleteConv,
    renameConv,
    setMessageFeedback,
    clearError,
  } = useChat()

  // ---------------------------------------------------------------------------
  // Health probe on mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false
    async function checkHealth() {
      try {
        const health = await getHealth()
        if (!cancelled) {
          setOllamaConnected(health.services.ollama.status === 'ok')
          setActiveModel(health.services.ollama.active_model)
        }
      } catch {
        if (!cancelled) setOllamaConnected(false)
      }
    }
    checkHealth()
    const interval = setInterval(checkHealth, 30_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Sidebar auto-collapse on mobile
  // ---------------------------------------------------------------------------
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth < 768) {
        setSidebarOpen(false)
      } else {
        setSidebarOpen(true)
      }
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------
  const activeConversation = conversations.find(
    (c) => c.id === activeConversationId,
  )
  const hasMessages = messages.length > 0

  const handleSuggestion = useCallback(
    (prompt: string) => {
      sendMessage(prompt)
    },
    [sendMessage],
  )

  const handleSelectConversation = useCallback(
    async (id: string) => {
      await selectConversation(id)
      // Close sidebar on mobile after selection
      if (window.innerWidth < 768) {
        setSidebarOpen(false)
      }
    },
    [selectConversation],
  )

  return (
    <div
      className="flex h-screen w-screen overflow-hidden bg-surface-0 text-text-primary"
    >
      {/* ------------------------------------------------------------------ */}
      {/* Sidebar                                                             */}
      {/* ------------------------------------------------------------------ */}
      <Sidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelect={handleSelectConversation}
        onNew={newConversation}
        onDelete={deleteConv}
        onRename={renameConv}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((o) => !o)}
      />

      {/* ------------------------------------------------------------------ */}
      {/* Main area                                                           */}
      {/* ------------------------------------------------------------------ */}
      <main className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Header */}
        <ChatHeader
          title={activeConversation?.title ?? null}
          theme={theme}
          onToggleTheme={toggleTheme}
          onToggleSidebar={() => setSidebarOpen((o) => !o)}
          sidebarOpen={sidebarOpen}
        />

        {/* Status row */}
        {ollamaConnected !== null && (
          <div className="flex justify-end px-4 py-1.5 border-b border-border/40">
            <StatusIndicator
              ollamaConnected={ollamaConnected}
              model={activeModel}
            />
          </div>
        )}

        {/* Error banner */}
        {error && (
          <ErrorBanner
            message={error}
            onDismiss={clearError}
          />
        )}

        {/* Chat body */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {!hasMessages ? (
            /* Welcome screen */
            <div className="flex-1 overflow-y-auto">
              <WelcomeScreen onSuggestion={handleSuggestion} />
            </div>
          ) : (
            /* Message list */
            <MessageList
              messages={messages}
              onRegenerate={regenerateLastResponse}
              onFeedback={setMessageFeedback}
            />
          )}

          {/* Input */}
          <MessageInput
            onSend={sendMessage}
            onStop={stopGeneration}
            status={sendStatus}
            disabled={ollamaConnected === false}
          />
        </div>
      </main>
    </div>
  )
}
