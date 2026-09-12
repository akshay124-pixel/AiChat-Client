import { AlertTriangle, X } from 'lucide-react'
import { cn } from '@/utils/cn'

interface ErrorBannerProps {
  message: string
  onDismiss: () => void
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className={cn(
        'mx-4 mb-2 flex items-start gap-3 rounded-xl px-4 py-3',
        'bg-red-500/10 border border-red-500/20 text-red-400',
        'animate-fade-up text-sm',
      )}
    >
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <p className="flex-1 leading-relaxed">{message}</p>
      <button
        onClick={onDismiss}
        aria-label="Dismiss error"
        className="p-0.5 rounded-lg hover:bg-red-500/10 transition-colors focus-ring shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  )
}
