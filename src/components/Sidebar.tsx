import { useEffect, useRef, useState } from 'react'
import {
  Edit2,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  X,
  ChevronLeft,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { groupConversations } from '@/utils/groupConversations'
import type { ConversationSummary } from '@/types'

interface SidebarProps {
  conversations: ConversationSummary[]
  activeConversationId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => Promise<void>
  onRename: (id: string, title: string) => Promise<void>
  isOpen: boolean
  onToggle: () => void
}

// ---------------------------------------------------------------------------
// Individual conversation row
// ---------------------------------------------------------------------------
interface ConvRowProps {
  conv: ConversationSummary
  isActive: boolean
  onSelect: () => void
  onDelete: () => Promise<void>
  onRename: (title: string) => Promise<void>
}

function ConvRow({ conv, isActive, onSelect, onDelete, onRename }: ConvRowProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(conv.title)
  const inputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  // Focus input when editing starts
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  function handleRenameSubmit() {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== conv.title) {
      onRename(trimmed)
    } else {
      setEditValue(conv.title)
    }
    setEditing(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleRenameSubmit()
    if (e.key === 'Escape') {
      setEditValue(conv.title)
      setEditing(false)
    }
  }

  return (
    <div
      className={cn(
        'group relative flex items-center gap-2 rounded-xl px-3 py-2.5 cursor-pointer',
        'transition-all duration-150',
        isActive
          ? 'bg-surface-4 text-text-primary'
          : 'text-text-secondary hover:bg-surface-3 hover:text-text-primary',
      )}
      onClick={() => !editing && onSelect()}
    >
      {/* Icon */}
      <MessageSquare
        size={15}
        className={cn(
          'shrink-0 transition-colors',
          isActive ? 'text-brand' : 'text-text-muted group-hover:text-text-secondary',
        )}
      />

      {/* Title or input */}
      {editing ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleRenameSubmit}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 min-w-0 bg-surface-5 text-text-primary text-sm rounded-lg px-2 py-0.5 outline-none ring-1 ring-brand"
        />
      ) : (
        <span className="flex-1 min-w-0 truncate text-sm leading-5">{conv.title}</span>
      )}

      {/* Action buttons — appear on hover / active */}
      {!editing && (
        <div
          className={cn(
            'flex items-center gap-0.5 shrink-0',
            'opacity-0 group-hover:opacity-100 transition-opacity',
            isActive && 'opacity-100',
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            aria-label="More options"
            onClick={() => setMenuOpen((o) => !o)}
            className="p-1 rounded-lg hover:bg-surface-5 text-text-muted hover:text-text-primary transition-colors focus-ring"
          >
            <MoreHorizontal size={14} />
          </button>
        </div>
      )}

      {/* Dropdown menu */}
      {menuOpen && (
        <div
          ref={menuRef}
          className={cn(
            'absolute right-1 top-full mt-1 z-50 min-w-[140px]',
            'bg-surface-3 border border-border rounded-xl shadow-dropdown',
            'animate-scale-in overflow-hidden',
          )}
        >
          <button
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-text-secondary hover:bg-surface-4 hover:text-text-primary transition-colors"
            onClick={() => {
              setMenuOpen(false)
              setEditing(true)
              setEditValue(conv.title)
            }}
          >
            <Edit2 size={13} />
            Rename
          </button>
          <button
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-red-400 hover:bg-surface-4 hover:text-red-300 transition-colors"
            onClick={async () => {
              setMenuOpen(false)
              await onDelete()
            }}
          >
            <Trash2 size={13} />
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------
export function Sidebar({
  conversations,
  activeConversationId,
  onSelect,
  onNew,
  onDelete,
  onRename,
  isOpen,
  onToggle,
}: SidebarProps) {
  const [search, setSearch] = useState('')

  const filtered = search.trim()
    ? conversations.filter((c) =>
        c.title.toLowerCase().includes(search.toLowerCase()),
      )
    : conversations

  const groups = groupConversations(filtered)

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 backdrop-blur-sm md:hidden animate-fade-in"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          'fixed md:relative inset-y-0 left-0 z-30 flex flex-col',
          'w-[260px] bg-surface-1 border-r border-border',
          'transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          !isOpen && 'md:w-0 md:overflow-hidden md:border-none',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 pb-2">
          {/* Logo + title */}
          <div className="flex items-center gap-2.5 px-1">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-brand shadow-brand">
              <Sparkles size={14} className="text-white" />
            </div>
            <span className="font-semibold text-sm text-text-primary tracking-tight">
              AI Chat
            </span>
          </div>

          {/* Collapse button */}
          <button
            onClick={onToggle}
            aria-label="Close sidebar"
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors focus-ring"
          >
            <ChevronLeft size={16} />
          </button>
        </div>

        {/* New chat button */}
        <div className="px-3 pb-3">
          <button
            onClick={onNew}
            className={cn(
              'flex w-full items-center gap-2.5 px-3 py-2.5 rounded-xl',
              'text-sm font-medium text-text-secondary',
              'border border-border hover:border-border-strong',
              'hover:bg-surface-3 hover:text-text-primary',
              'transition-all duration-150 group focus-ring',
            )}
          >
            <Plus
              size={16}
              className="text-text-muted group-hover:text-brand transition-colors"
            />
            New conversation
          </button>
        </div>

        {/* Search */}
        <div className="px-3 pb-2">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search conversations…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(
                'w-full bg-surface-2 text-text-primary text-sm',
                'pl-8 pr-8 py-2 rounded-xl',
                'border border-border',
                'placeholder:text-text-muted',
                'outline-none focus:ring-1 focus:ring-brand focus:border-brand',
                'transition-all duration-150',
              )}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Conversation list */}
        <nav className="flex-1 overflow-y-auto px-2 pb-2 space-y-4">
          {groups.length === 0 && (
            <div className="px-3 py-8 text-center">
              <MessageSquare
                size={28}
                className="mx-auto text-text-muted mb-3 opacity-40"
              />
              <p className="text-xs text-text-muted">
                {search ? 'No results found' : 'No conversations yet'}
              </p>
            </div>
          )}

          {groups.map((group) => (
            <div key={group.label}>
              <p className="px-3 py-1 text-[11px] font-medium text-text-muted uppercase tracking-widest mb-1">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.conversations.map((conv) => (
                  <ConvRow
                    key={conv.id}
                    conv={conv}
                    isActive={conv.id === activeConversationId}
                    onSelect={() => onSelect(conv.id)}
                    onDelete={() => onDelete(conv.id)}
                    onRename={(title) => onRename(conv.id, title)}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-surface-3 cursor-pointer transition-colors group">
            <div className="w-7 h-7 rounded-full bg-gradient-brand flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-white">U</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text-primary truncate">User</p>
              <p className="text-xs text-text-muted truncate"></p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
