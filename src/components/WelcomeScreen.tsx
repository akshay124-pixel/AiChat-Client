import { Sparkles } from 'lucide-react'
import { cn } from '@/utils/cn'

interface Suggestion {
  icon: string
  label: string
  prompt: string
}

const SUGGESTIONS: Suggestion[] = [
  {
    icon: '🧠',
    label: 'Explain a concept',
    prompt: 'Explain how large language models work in simple terms.',
  },
  {
    icon: '💻',
    label: 'Write code',
    prompt: 'Write a Python function that validates an email address using regex.',
  },
  {
    icon: '🐛',
    label: 'Debug code',
    prompt: "I have a bug in my code. Here's the error message and the relevant snippet:",
  },
  {
    icon: '📝',
    label: 'Summarize text',
    prompt: 'Summarize the following text in 3 bullet points:\n\n',
  },
  {
    icon: '💡',
    label: 'Brainstorm ideas',
    prompt: 'Give me 10 creative ideas for a side project that uses AI.',
  },
  {
    icon: '🌐',
    label: 'Translate text',
    prompt: 'Translate the following text to Spanish:\n\n',
  },
]

interface WelcomeScreenProps {
  onSuggestion: (prompt: string) => void
}

export function WelcomeScreen({ onSuggestion }: WelcomeScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 animate-fade-up">
      {/* Logo mark */}
      <div className="relative mb-6">
        <div
          className={cn(
            'w-16 h-16 rounded-2xl flex items-center justify-center',
            'bg-gradient-brand shadow-glow',
            'animate-glow-pulse',
          )}
        >
          <Sparkles size={28} className="text-white" />
        </div>
        {/* Decorative rings */}
        <div className="absolute inset-0 rounded-2xl bg-brand/20 scale-110 animate-ping" style={{ animationDuration: '3s' }} />
      </div>

      {/* Headline */}
      <h1 className="text-3xl font-bold text-text-primary mb-2 text-center tracking-tight">
        How can I help you{' '}
        <span className="text-gradient-brand">today?</span>
      </h1>
      <p className="text-text-secondary text-sm text-center mb-10 max-w-sm">
        Powered by Qwen3 4B via Ollama. Ask me anything — I'm here to help.
      </p>

      {/* Suggestion cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full max-w-2xl">
        {SUGGESTIONS.map((s, i) => (
          <button
            key={s.label}
            onClick={() => onSuggestion(s.prompt)}
            style={{ animationDelay: `${i * 60}ms` }}
            className={cn(
              'group flex flex-col gap-2 text-left',
              'bg-surface-2 hover:bg-surface-3',
              'border border-border hover:border-border-strong',
              'rounded-2xl px-4 py-4',
              'transition-all duration-200',
              'hover:shadow-card hover:-translate-y-0.5',
              'animate-fade-up focus-ring',
            )}
          >
            <span className="text-xl">{s.icon}</span>
            <div>
              <p className="text-sm font-medium text-text-primary group-hover:text-brand transition-colors">
                {s.label}
              </p>
              <p className="text-xs text-text-muted mt-0.5 line-clamp-2 leading-relaxed">
                {s.prompt.length > 60 ? s.prompt.slice(0, 57) + '…' : s.prompt}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Bottom hint */}
      <p className="mt-10 text-xs text-text-muted text-center">
        Press{' '}
        <kbd className="px-1.5 py-0.5 rounded bg-surface-3 border border-border text-text-secondary font-mono">
          Enter
        </kbd>{' '}
        to send &nbsp;·&nbsp;{' '}
        <kbd className="px-1.5 py-0.5 rounded bg-surface-3 border border-border text-text-secondary font-mono">
          Shift+Enter
        </kbd>{' '}
        for newline
      </p>
    </div>
  )
}
