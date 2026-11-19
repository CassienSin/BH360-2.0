'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { goBack } from '@/lib/goBack'
import { ChevronLeft, Send, Trash2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import toast from 'react-hot-toast'
import Band from '@/components/crafted/Band'
import { AiIcon } from '@/components/icons/BhIcons'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'

const MAX_INPUT_LENGTH = 500

const WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Kumusta! I’m the BarangayHub assistant. I can answer questions about barangay services: clearances, permits, complaints and more. What do you need?',
}

const QUICK_QUESTIONS = [
  'What are the office hours?',
  'How do I get a barangay clearance?',
  'What documents do I need for a permit?',
  'How do I file a complaint?',
]

let messageId = 0
const nextId = () => `msg-${++messageId}-${Date.now()}`

export default function AIAssistant() {
  const router = useRouter()
  const [messages, setMessages] = useState([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const abortRef = useRef(null)

  // Abort any in-flight request on unmount to avoid setState-after-unmount
  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Auto-resize the textarea up to its max height
  const autoResize = useCallback(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [])

  const sendMessage = useCallback(
    async (e, customMessage) => {
      if (e) e.preventDefault()
      if (loading) return

      const text = (customMessage ?? input).trim()
      if (!text) return

      const userMessage = { id: nextId(), role: 'user', content: text }
      const history = [...messages, userMessage]

      setMessages(history)
      setInput('')
      setLoading(true)

      // Reset textarea height after clearing
      if (inputRef.current) inputRef.current.style.height = 'auto'

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const response = await fetch('/api/ai-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          // Strip client-only fields (id) before sending to the API
          body: JSON.stringify({
            messages: history.map(({ role, content }) => ({ role, content })),
          }),
        })

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`)
        }

        const data = await response.json()
        const reply = typeof data?.reply === 'string' && data.reply.trim()
          ? data.reply
          : 'Sorry, I could not generate a response. Please try again.'

        setMessages(prev => [...prev, { id: nextId(), role: 'assistant', content: reply }])
      } catch (err) {
        if (err.name === 'AbortError') return // component unmounted or request cancelled
        setMessages(prev => [
          ...prev,
          { id: nextId(), role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' },
        ])
        toast.error('Failed to get response. Try again!')
      } finally {
        setLoading(false)
        // Return focus to the input so the user can keep typing
        inputRef.current?.focus()
      }
    },
    [input, loading, messages]
  )

  const clearChat = useCallback(() => {
    abortRef.current?.abort()
    setLoading(false)
    setMessages([{ ...WELCOME_MESSAGE, id: nextId(), content: 'Cleared. What else can I help with?' }])
    toast.success('Conversation cleared')
    inputRef.current?.focus()
  }, [])

  const showWelcome = messages.length === 1

  return (
    <div className="relative isolate flex h-dvh flex-col overflow-hidden bg-page">
      {/* Header on the band */}
      <header className="relative px-4 pt-[max(16px,env(safe-area-inset-top,0px))] pb-3 text-white">
        <Band extend={0} fade={56} dots={10} seed={6} />
        <div className="relative z-[1] mx-auto flex max-w-3xl items-center gap-2.5">
          <IconButton kind="onband" label="Go back" onClick={() => goBack(router, '/resident')}>
            <ChevronLeft size={18} strokeWidth={1.9} />
          </IconButton>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[17px] font-extrabold">AI Assistant</h1>
            <p className="flex items-center gap-1.5 truncate text-xs text-white/80">
              <span className="size-[7px] rounded-full bg-[#3DC48A]" aria-hidden="true" />Barangay helper · answers about services
            </p>
          </div>
          {messages.length > 1 && (
            <Button variant="onband" size="sm" onClick={clearChat}><Trash2 aria-hidden="true" />Clear</Button>
          )}
        </div>
      </header>

      {/* Messages */}
      <main className="relative z-[1] flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 pt-2 pb-4" role="log" aria-live="polite" aria-label="Chat messages">
          {messages.map(msg => (
            msg.role === 'user' ? (
              <div key={msg.id} className="flex justify-end">
                <p className="max-w-[80%] rounded-[16px] rounded-br-[6px] bg-[var(--brand-fill)] px-4 py-2.5 text-[15px] leading-[1.5] text-white whitespace-pre-wrap break-words">
                  {msg.content}
                </p>
              </div>
            ) : (
              <div key={msg.id} className="flex items-end gap-2">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-strong" aria-hidden="true">
                  <AiIcon size={18} />
                </span>
                <div className="markdown max-w-[80%] rounded-[16px] rounded-bl-[6px] bg-track px-4 py-2.5 text-[15px] leading-[1.55] text-ink break-words">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            )
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="flex items-end gap-2" role="status">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-strong" aria-hidden="true">
                <AiIcon size={18} />
              </span>
              <p className="rounded-[16px] rounded-bl-[6px] bg-track px-4 py-3 text-sm text-muted-foreground">Thinking…</p>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </main>

      {/* Quick questions, then the composer */}
      <footer className="relative z-[2] border-t border-line bg-surface px-4 pt-3 pb-[max(10px,env(safe-area-inset-bottom,0px))]">
        <div className="mx-auto max-w-3xl">
          {showWelcome && (
            <div className="mb-3 flex gap-2 overflow-x-auto rail-fade [scrollbar-width:none]! [&::-webkit-scrollbar]:hidden" role="group" aria-label="Quick questions">
              {QUICK_QUESTIONS.map(q => (
                <button key={q} type="button" onClick={() => sendMessage(null, q)} disabled={loading}
                  className="h-9 shrink-0 rounded-[9px] border border-line bg-surface px-3 text-[13px] font-bold whitespace-nowrap text-brand-strong outline-none hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong disabled:opacity-60">
                  {q}
                </button>
              ))}
            </div>
          )}
          <form onSubmit={sendMessage} className="flex items-end gap-2">
            <label htmlFor="ai-input" className="sr-only">Message</label>
            <textarea
              ref={inputRef}
              id="ai-input"
              value={input}
              onChange={e => {
                setInput(e.target.value)
                autoResize()
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage(e)
                }
              }}
              rows={1}
              maxLength={MAX_INPUT_LENGTH}
              className="min-h-11 min-w-0 flex-1 resize-none rounded-[10px] border border-transparent bg-track px-4 py-2.5 text-[15px] leading-[1.45] text-ink outline-none [scrollbar-width:none]! placeholder:text-muted-foreground focus:border-brand-strong focus:bg-surface [&::-webkit-scrollbar]:hidden"
              style={{ maxHeight: '120px' }}
              placeholder="Ask about the barangay"
            />
            <Button type="submit" size="icon" className="size-11" disabled={loading || !input.trim()} aria-label="Send message">
              <Send aria-hidden="true" />
            </Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">The assistant can make mistakes. For emergencies, call 911.</p>
        </div>
      </footer>
    </div>
  )
}
