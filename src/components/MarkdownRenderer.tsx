import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import type { Components } from 'react-markdown'
import { CodeBlock } from './CodeBlock'

interface MarkdownRendererProps {
  content: string
  streaming?: boolean
}

const components: Components = {
  // Override code rendering to use our custom CodeBlock for fenced blocks
  code({ className, children, ...props }) {
    void props // used for future extensibility
    const match = /language-(\w+)/.exec(className ?? '')

    // Multi-line or fenced code → custom CodeBlock
    const content = String(children).replace(/\n$/, '')
    if (match || content.includes('\n')) {
      return <CodeBlock language={match?.[1]}>{content}</CodeBlock>
    }

    // Inline code
    return (
      <code
        className="bg-surface-4 text-brand px-1.5 py-0.5 rounded text-[0.85em] font-mono"
        {...props}
      >
        {children}
      </code>
    )
  },

  // Open links in new tab
  a({ children, href, ...props }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-brand hover:text-brand-light underline underline-offset-2 transition-colors"
        {...props}
      >
        {children}
      </a>
    )
  },

  // Styled table wrapper
  table({ children }) {
    return (
      <div className="overflow-x-auto my-4 rounded-xl border border-border">
        <table className="w-full text-sm border-collapse">{children}</table>
      </div>
    )
  },

  th({ children }) {
    return (
      <th className="text-left font-semibold text-text-primary px-3 py-2 bg-surface-3 border-b border-border">
        {children}
      </th>
    )
  },

  td({ children }) {
    return (
      <td className="px-3 py-2 text-text-secondary border-t border-border/50">
        {children}
      </td>
    )
  },

  blockquote({ children }) {
    return (
      <blockquote className="border-l-2 border-brand pl-4 text-text-secondary italic my-4">
        {children}
      </blockquote>
    )
  },
}

export function MarkdownRenderer({ content, streaming }: MarkdownRendererProps) {
  return (
    <div className={`prose-chat${streaming ? ' typing-cursor' : ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
