import { useCallback, useState } from 'react'
import { Check, Copy, Terminal } from 'lucide-react'
import { cn } from '@/utils/cn'

interface CodeBlockProps {
  language?: string
  children: string
}

export function CodeBlock({ language, children }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(children)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard not available
    }
  }, [children])

  const displayLang = language?.replace(/^language-/, '') || 'code'

  return (
    <div className="my-4 rounded-xl overflow-hidden border border-border/60 bg-surface-2 group/code">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-surface-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Terminal size={13} className="text-text-muted" />
          <span className="text-xs font-medium text-text-muted font-mono tracking-wide uppercase">
            {displayLang}
          </span>
        </div>

        <button
          onClick={handleCopy}
          aria-label="Copy code"
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs',
            'transition-all duration-150 focus-ring',
            copied
              ? 'bg-brand/20 text-brand'
              : 'text-text-muted hover:text-text-primary hover:bg-surface-5',
          )}
        >
          {copied ? (
            <>
              <Check size={12} />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code content */}
      <pre className="overflow-x-auto p-4 text-sm leading-6 font-mono">
        <code className={language ? `language-${displayLang}` : ''}>{children}</code>
      </pre>
    </div>
  )
}
