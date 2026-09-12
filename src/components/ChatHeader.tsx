import { Menu, Moon, Sun, Sparkles } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { Theme } from '@/types'

interface ChatHeaderProps {
  title: string | null
  theme: Theme
  onToggleTheme: () => void
  onToggleSidebar: () => void
  sidebarOpen: boolean
}

export function ChatHeader({
  title,
  theme,
  onToggleTheme,
  onToggleSidebar,
  sidebarOpen,
}: ChatHeaderProps) {
  return (
    <header
      className={cn(
        'flex items-center justify-between',
        'px-4 h-14 shrink-0',
        'border-b border-border bg-surface-1/80 backdrop-blur-sm',
        'sticky top-0 z-10',
      )}
    >
      {/* Left: menu toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          aria-expanded={sidebarOpen}
          className="p-2 rounded-xl text-text-muted hover:text-text-primary hover:bg-surface-3 transition-all focus-ring"
        >
          <Menu size={18} />
        </button>

        {/* Title */}
        {title ? (
          <h1 className="text-sm font-medium text-text-primary truncate max-w-[240px] md:max-w-sm">
            {title}
          </h1>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-gradient-brand">
              <Sparkles size={12} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-text-primary">AI Chat</span>
          </div>
        )}
      </div>

      {/* Right: theme toggle */}
      <button
        onClick={onToggleTheme}
        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        className="p-2 rounded-xl text-text-muted hover:text-text-primary hover:bg-surface-3 transition-all focus-ring"
      >
        {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
      </button>
    </header>
  )
}
