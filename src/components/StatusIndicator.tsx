import { cn } from '@/utils/cn'

interface StatusIndicatorProps {
  ollamaConnected: boolean
  model?: string
}

export function StatusIndicator({ ollamaConnected, model }: StatusIndicatorProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-2 border border-border">
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full',
          ollamaConnected ? 'bg-brand animate-pulse' : 'bg-red-500',
        )}
        aria-hidden="true"
      />
      <span className="text-xs text-text-muted">
        {ollamaConnected
          ? model ?? 'Connected'
          : 'Ollama offline'}
      </span>
    </div>
  )
}
