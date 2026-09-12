import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowUp, Paperclip, Square, Mic, MicOff,
  X, FileText, Image, FileCode, File,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import type { SendStatus } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Web Speech API types
// ─────────────────────────────────────────────────────────────────────────────
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string
}
interface SpeechRecognitionInstance extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onstart: ((e: Event) => void) | null
  onend: ((e: Event) => void) | null
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null
}
declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance
  }
}
function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

// ─────────────────────────────────────────────────────────────────────────────
// Attachment types
// ─────────────────────────────────────────────────────────────────────────────
interface AttachedFile {
  id: string
  file: File
  /** For images: base64 data URL for preview */
  previewUrl?: string
  /** Extracted text content (for text/code files) */
  textContent?: string
  /** Reading state */
  status: 'reading' | 'ready' | 'error'
  errorMsg?: string
}

// Accepted MIME types and extensions
const ACCEPTED = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'text/plain', 'text/markdown', 'text/csv',
  'text/javascript', 'text/typescript', 'application/json',
  'text/html', 'text/css', 'text/xml', 'application/xml',
  'text/x-python', 'text/x-java', 'text/x-c', 'text/x-cpp',
].join(',')

const MAX_FILE_SIZE_MB = 10
const MAX_TEXT_CHARS = 30_000   // max chars injected into message context

function getFileIcon(file: File) {
  if (file.type.startsWith('image/')) return Image
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const codeExts = ['js','ts','jsx','tsx','py','java','c','cpp','cs','go','rs','rb','php','sh','json','html','css','xml','yaml','yml','md']
  if (codeExts.includes(ext)) return FileCode
  if (['txt','csv','log'].includes(ext)) return FileText
  return File
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isTextFile(file: File): boolean {
  if (file.type.startsWith('text/')) return true
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return ['json','md','csv','js','ts','jsx','tsx','py','java','c','cpp',
          'cs','go','rs','rb','php','sh','xml','yaml','yml','html','css',
          'txt','log','env','gitignore','dockerfile'].includes(ext)
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────
interface MessageInputProps {
  onSend: (text: string) => void
  onStop: () => void
  status: SendStatus
  disabled?: boolean
}

const MAX_ROWS = 12
const MIN_ROWS = 1

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export function MessageInput({ onSend, onStop, status, disabled = false }: MessageInputProps) {
  const [value, setValue] = useState('')
  const [attachments, setAttachments] = useState<AttachedFile[]>([])
  const [isListening, setIsListening] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [interimText, setInterimText] = useState('')
  const [attachError, setAttachError] = useState<string | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

  const isStreaming = status === 'streaming' || status === 'sending'
  const hasReadyAttachments = attachments.some(a => a.status === 'ready')
  const canSend = (value.trim().length > 0 || hasReadyAttachments) && !isStreaming && !disabled
  const speechSupported = getSpeechRecognition() !== null
  const allReady = attachments.every(a => a.status !== 'reading')

  // ── Auto-grow ───────────────────────────────────────────────────────────────
  const resize = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const lh = parseInt(getComputedStyle(el).lineHeight || '24', 10)
    el.style.height = `${Math.min(el.scrollHeight, lh * MAX_ROWS)}px`
    el.style.overflowY = el.scrollHeight > lh * MAX_ROWS ? 'auto' : 'hidden'
  }, [])

  useEffect(() => { resize() }, [value, resize])
  useEffect(() => { textareaRef.current?.focus() }, [])
  useEffect(() => () => { recognitionRef.current?.abort() }, [])

  // ── File reading ─────────────────────────────────────────────────────────────
  const readFile = useCallback((af: AttachedFile) => {
    const { file } = af
    const reader = new FileReader()

    if (file.type.startsWith('image/')) {
      reader.onload = (e) => {
        setAttachments(prev => prev.map(a =>
          a.id === af.id
            ? { ...a, previewUrl: e.target?.result as string, status: 'ready' }
            : a
        ))
      }
      reader.onerror = () => {
        setAttachments(prev => prev.map(a =>
          a.id === af.id ? { ...a, status: 'error', errorMsg: 'Failed to read image' } : a
        ))
      }
      reader.readAsDataURL(file)
    } else if (isTextFile(file)) {
      reader.onload = (e) => {
        const raw = (e.target?.result as string) ?? ''
        const truncated = raw.length > MAX_TEXT_CHARS ? raw.slice(0, MAX_TEXT_CHARS) + '\n...[truncated]' : raw
        setAttachments(prev => prev.map(a =>
          a.id === af.id ? { ...a, textContent: truncated, status: 'ready' } : a
        ))
      }
      reader.onerror = () => {
        setAttachments(prev => prev.map(a =>
          a.id === af.id ? { ...a, status: 'error', errorMsg: 'Failed to read file' } : a
        ))
      }
      reader.readAsText(file)
    } else {
      // Unsupported type — mark as error
      setAttachments(prev => prev.map(a =>
        a.id === af.id ? { ...a, status: 'error', errorMsg: 'Unsupported file type' } : a
      ))
    }
  }, [])

  // ── File picker ──────────────────────────────────────────────────────────────
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setAttachError(null)

    const newAttachments: AttachedFile[] = []

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setAttachError(`"${file.name}" is too large (max ${MAX_FILE_SIZE_MB} MB)`)
        continue
      }
      const af: AttachedFile = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        status: 'reading',
      }
      newAttachments.push(af)
    }

    if (newAttachments.length) {
      setAttachments(prev => [...prev, ...newAttachments])
      newAttachments.forEach(af => readFile(af))
    }

    // Reset input so the same file can be picked again
    e.target.value = ''
  }, [readFile])

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id))
  }, [])

  // ── Send ──────────────────────────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    if (isStreaming || !allReady) return

    const trimmed = value.trim()
    const readyAttachments = attachments.filter(a => a.status === 'ready')

    if (!trimmed && readyAttachments.length === 0) return

    // Stop voice if active
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
    }

    // Build message: text + file contents injected as context
    let fullMessage = trimmed

    for (const af of readyAttachments) {
      if (af.textContent !== undefined) {
        // Text/code file — inject content
        fullMessage += `\n\n---\n**Attached file: ${af.file.name}**\n\`\`\`\n${af.textContent}\n\`\`\``
      } else if (af.previewUrl) {
        // Image — mention it (actual image AI requires multimodal model)
        fullMessage += `\n\n[Image attached: ${af.file.name} (${formatBytes(af.file.size)})]`
      }
    }

    if (!fullMessage.trim()) return

    onSend(fullMessage)
    setValue('')
    setAttachments([])
    setInterimText('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }, [value, attachments, isStreaming, isListening, allReady, onSend])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  // ── Voice ─────────────────────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    const SR = getSpeechRecognition()
    if (!SR) return
    setVoiceError(null)
    setInterimText('')

    navigator.mediaDevices?.getUserMedia({ audio: true })
      .then(() => {
        const r = new SR()
        r.lang = 'en-US'
        r.continuous = true
        r.interimResults = true
        r.maxAlternatives = 1

        r.onstart = () => { setIsListening(true); setVoiceError(null) }

        r.onresult = (e: SpeechRecognitionEvent) => {
          let interim = '', final = ''
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const t = e.results[i][0].transcript
            if (e.results[i].isFinal) final += t
            else interim += t
          }
          if (final) {
            setValue(prev => prev + (prev.trim() ? ' ' : '') + final)
            setInterimText('')
          } else {
            setInterimText(interim)
          }
        }

        r.onerror = (e: SpeechRecognitionErrorEvent) => {
          if (e.error === 'no-speech') return
          if (e.error === 'network') setVoiceError('Network error. Voice needs internet.')
          else if (e.error !== 'aborted') setVoiceError(`Voice error: ${e.error}`)
          setIsListening(false)
          setInterimText('')
        }

        r.onend = () => { setIsListening(false); setInterimText('') }

        recognitionRef.current = r
        r.start()
      })
      .catch(() => {
        setVoiceError('Microphone blocked. Click 🔒 in address bar → Allow microphone → try again.')
        setIsListening(false)
      })
  }, [])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setIsListening(false)
    setInterimText('')
  }, [])

  const toggleVoice = useCallback(() => {
    setVoiceError(null)
    isListening ? stopListening() : startListening()
  }, [isListening, startListening, stopListening])

  // ── Drag & drop onto the input card ──────────────────────────────────────────
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => setIsDragging(false), [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    setAttachError(null)
    const files = Array.from(e.dataTransfer.files)
    const newAttachments: AttachedFile[] = []
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setAttachError(`"${file.name}" is too large (max ${MAX_FILE_SIZE_MB} MB)`)
        continue
      }
      const af: AttachedFile = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        status: 'reading',
      }
      newAttachments.push(af)
    }
    if (newAttachments.length) {
      setAttachments(prev => [...prev, ...newAttachments])
      newAttachments.forEach(af => readFile(af))
    }
  }, [readFile])

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="px-4 pb-4 pt-2">

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPTED}
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />

      {/* Error toasts */}
      {(voiceError || attachError) && (
        <div className="mx-auto w-full max-w-3xl mb-2 space-y-1">
          {attachError && (
            <div className={cn(
              'flex items-center justify-between gap-2 px-3 py-2 rounded-xl',
              'bg-red-500/10 border border-red-500/20 text-red-400 text-xs animate-fade-up',
            )}>
              <span>{attachError}</span>
              <button onClick={() => setAttachError(null)} className="hover:text-red-300 shrink-0" aria-label="Dismiss">✕</button>
            </div>
          )}
          {voiceError && (
            <div className={cn(
              'flex items-center justify-between gap-2 px-3 py-2 rounded-xl',
              'bg-red-500/10 border border-red-500/20 text-red-400 text-xs animate-fade-up',
            )}>
              <span>{voiceError}</span>
              <button onClick={() => setVoiceError(null)} className="hover:text-red-300 shrink-0" aria-label="Dismiss">✕</button>
            </div>
          )}
        </div>
      )}

      {/* Input card */}
      <div
        className={cn(
          'mx-auto w-full max-w-3xl bg-surface-2 border rounded-2xl',
          'transition-all duration-200',
          isDragging
            ? 'border-brand shadow-input scale-[1.01]'
            : isListening
              ? 'border-brand shadow-input shadow-brand/30'
              : 'border-border focus-within:border-border-strong focus-within:shadow-input',
          disabled && 'opacity-60 pointer-events-none',
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag overlay hint */}
        {isDragging && (
          <div className="px-4 pt-3 pb-0 text-xs text-brand flex items-center gap-2">
            <Paperclip size={12} />
            Drop files to attach
          </div>
        )}

        {/* Voice interim bar */}
        {isListening && (
          <div className="px-4 pt-2.5 pb-0 flex items-center gap-2">
            <div className="flex items-center gap-0.5 shrink-0">
              {[0, 1, 2].map(i => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse"
                  style={{ animationDelay: `${i * 150}ms` }} />
              ))}
            </div>
            <span className="text-xs text-brand truncate">{interimText || 'Listening…'}</span>
          </div>
        )}

        {/* Attachment previews */}
        {attachments.length > 0 && (
          <div className="px-3 pt-3 pb-0 flex flex-wrap gap-2">
            {attachments.map(af => {
              const IconComp = getFileIcon(af.file)
              const isImg = af.file.type.startsWith('image/')
              return (
                <div
                  key={af.id}
                  className={cn(
                    'group relative flex items-center gap-2',
                    'bg-surface-3 border rounded-xl px-2.5 py-1.5',
                    'max-w-[200px] text-xs',
                    af.status === 'error'
                      ? 'border-red-500/30 text-red-400'
                      : af.status === 'reading'
                        ? 'border-border text-text-muted animate-pulse'
                        : 'border-border text-text-secondary',
                  )}
                >
                  {/* Image thumbnail */}
                  {isImg && af.previewUrl ? (
                    <img
                      src={af.previewUrl}
                      alt={af.file.name}
                      className="w-8 h-8 object-cover rounded-lg shrink-0"
                    />
                  ) : (
                    <IconComp
                      size={14}
                      className={cn(
                        'shrink-0',
                        af.status === 'error' ? 'text-red-400' : 'text-brand',
                      )}
                    />
                  )}

                  {/* File name + size */}
                  <div className="min-w-0">
                    <p className="truncate leading-tight font-medium max-w-[110px]">
                      {af.file.name}
                    </p>
                    <p className="text-[10px] text-text-muted">
                      {af.status === 'reading' ? 'Reading…'
                        : af.status === 'error' ? (af.errorMsg ?? 'Error')
                        : formatBytes(af.file.size)}
                    </p>
                  </div>

                  {/* Remove button */}
                  <button
                    onClick={() => removeAttachment(af.id)}
                    aria-label={`Remove ${af.file.name}`}
                    className={cn(
                      'ml-0.5 p-0.5 rounded-full shrink-0',
                      'opacity-0 group-hover:opacity-100 transition-opacity',
                      'hover:bg-surface-5 text-text-muted hover:text-text-primary',
                    )}
                  >
                    <X size={11} />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={
            isDragging ? 'Drop files here…'
              : isListening ? "Speak now — I'm listening…"
              : attachments.length > 0 ? 'Add a message or send the file…'
              : 'Message AI Chat…'
          }
          rows={MIN_ROWS}
          aria-label="Message input"
          aria-multiline="true"
          className={cn(
            'w-full resize-none bg-transparent',
            'px-4 pt-3.5 pb-1',
            'text-sm text-text-primary placeholder:text-text-muted',
            'outline-none leading-6 min-h-[52px]',
          )}
        />

        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 pb-3 pt-1 gap-2">

          {/* Left: attach + voice */}
          <div className="flex items-center gap-1">

            {/* Attach button — FUNCTIONAL */}
            <button
              onClick={() => { setAttachError(null); fileInputRef.current?.click() }}
              disabled={disabled || isStreaming}
              title="Attach file (image, text, code, JSON…)"
              aria-label="Attach file"
              className={cn(
                'p-2 rounded-xl transition-all duration-150 focus-ring',
                attachments.length > 0
                  ? 'text-brand bg-brand/10 hover:bg-brand/20'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface-3',
                (disabled || isStreaming) && 'opacity-40 cursor-not-allowed',
              )}
            >
              <Paperclip size={16} />
              {attachments.length > 0 && (
                <span className="sr-only">{attachments.length} file(s) attached</span>
              )}
            </button>

            {/* Voice button */}
            {speechSupported ? (
              <button
                onClick={toggleVoice}
                disabled={disabled || isStreaming}
                title={isListening ? 'Stop recording' : 'Voice input'}
                aria-label={isListening ? 'Stop voice recording' : 'Start voice input'}
                aria-pressed={isListening}
                className={cn(
                  'relative p-2 rounded-xl transition-all duration-200 focus-ring',
                  isListening
                    ? 'text-brand bg-brand/10 hover:bg-brand/20'
                    : 'text-text-muted hover:text-text-primary hover:bg-surface-3',
                  (disabled || isStreaming) && 'opacity-40 cursor-not-allowed',
                )}
              >
                {isListening && (
                  <>
                    <span className="absolute inset-0 rounded-xl bg-brand/20 animate-ping" />
                    <span className="absolute inset-0 rounded-xl bg-brand/10 animate-pulse" />
                  </>
                )}
                {isListening
                  ? <MicOff size={16} className="relative z-10" />
                  : <Mic size={16} className="relative z-10" />
                }
              </button>
            ) : (
              <button disabled title="Voice not supported in this browser"
                className="p-2 rounded-xl text-text-muted opacity-30 cursor-not-allowed">
                <Mic size={16} />
              </button>
            )}
          </div>

          {/* Right: char count + stop/send */}
          <div className="flex items-center gap-2">
            {value.length > 500 && (
              <span className="text-xs text-text-muted tabular-nums">
                {value.length.toLocaleString()}
              </span>
            )}

            {/* Pending reads indicator */}
            {attachments.some(a => a.status === 'reading') && (
              <span className="text-xs text-text-muted animate-pulse">Reading files…</span>
            )}

            {isStreaming ? (
              <button onClick={onStop} aria-label="Stop generation"
                className={cn(
                  'flex items-center justify-center w-9 h-9 rounded-xl focus-ring',
                  'bg-surface-4 hover:bg-surface-5 border border-border hover:border-border-strong',
                  'text-text-primary transition-all duration-150',
                )}>
                <Square size={14} fill="currentColor" />
              </button>
            ) : (
              <button onClick={handleSend} disabled={!canSend || !allReady}
                aria-label="Send message"
                className={cn(
                  'flex items-center justify-center w-9 h-9 rounded-xl',
                  'transition-all duration-150 focus-ring',
                  canSend && allReady
                    ? 'bg-brand hover:bg-brand-hover text-white shadow-brand hover:shadow-glow hover:scale-105 active:scale-95'
                    : 'bg-surface-3 text-text-muted cursor-not-allowed',
                )}>
                <ArrowUp size={16} strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Footer hint */}
      <p className="text-center text-[11px] text-text-muted mt-2 px-4">
        {isListening
          ? 'Click mic to stop · text will appear above'
          : attachments.length > 0
            ? `${attachments.filter(a => a.status === 'ready').length}/${attachments.length} file(s) ready · Enter to send`
            : 'Enter to send · Shift+Enter for newline · Attach files or drag & drop'}
      </p>
    </div>
  )
}
