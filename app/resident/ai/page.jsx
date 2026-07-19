'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Send, Bot, Lightbulb, FileText, Bell, MessageCircle, Trash2 } from 'lucide-react'
import Image from 'next/image'
import ReactMarkdown from 'react-markdown'
import toast from 'react-hot-toast'
import AnimatedDots from '@/components/AnimatedDots'

const MAX_INPUT_LENGTH = 500

const WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Magandang araw! 👋 I am the BarangayHub AI Assistant. I can help you with common barangay questions like clearances, permits, complaints, and more. How can I help you today?',
}

const QUICK_QUESTIONS = [
  { icon: FileText, text: 'How do I get a barangay clearance?', color: '#5B54E8', bg: '#f0effe' },
  { icon: Bell, text: 'What documents do I need for a permit?', color: '#f97316', bg: '#fff7ed' },
  { icon: MessageCircle, text: 'How do I file a complaint?', color: '#f43f5e', bg: '#fff1f2' },
  { icon: Lightbulb, text: 'What are the barangay office hours?', color: '#22c55e', bg: '#f0fdf4' },
]

// Stable pseudo-random dots, computed once at module load
let messageId = 0
const nextId = () => `msg-${++messageId}-${Date.now()}`

export default function AIAssistant() {
  const router = useRouter()
  const [scrolled, setScrolled] = useState(false)
  const [messages, setMessages] = useState([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const abortRef = useRef(null)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

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
    setMessages([{ ...WELCOME_MESSAGE, id: nextId(), content: 'Chat cleared! How can I help you today?' }])
    toast.success('Chat cleared!')
    inputRef.current?.focus()
  }, [])

  const showWelcome = messages.length === 1

  return (
    <div className="h-screen flex flex-col relative overflow-hidden bg-brand">
      {/* Animated background */}
      <AnimatedDots />

      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div
          className="absolute top-20 right-20 w-96 h-96 rounded-full opacity-15"
          style={{
            background: 'radial-gradient(circle, #a78bfa 0%, transparent 70%)',
            filter: 'blur(80px)',
            animation: 'float 8s ease-in-out infinite',
          }}
        />
        <div
          className="absolute bottom-20 left-20 w-72 h-72 rounded-full opacity-10"
          style={{ background: 'white', filter: 'blur(60px)', animation: 'floatReverse 10s ease-in-out infinite' }}
        />
      </div>

      {/* Header */}
      <header
        className="fixed top-0 left-0 right-0 z-20 px-4 sm:px-6 py-4 flex items-center gap-3 flex-shrink-0 transition-all duration-300"
        style={{
          background: scrolled ? 'rgba(255,255,255,0.85)' : 'white',
          backdropFilter: scrolled ? 'blur(20px)' : 'none',
          boxShadow: '0 2px 12px rgba(91,84,232,0.08)',
          borderBottom: '1px solid #f0effe',
        }}
      >
        <button
          onClick={() => router.back()}
          aria-label="Go back"
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-gray-100 flex-shrink-0"
        >
          <ArrowLeft size={18} className="text-gray-600" />
        </button>

        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative flex-shrink-0">
            <Image src="/logo.png" alt="BH360 logo" width={32} height={32} className="object-contain" />
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-gray-800 truncate">BH360 AI</h1>
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full hidden sm:inline-flex"
                style={{ background: '#f0fdf4', color: '#16a34a' }}
              >
                Online
              </span>
            </div>
            <p className="text-xs text-gray-400 truncate">Your virtual barangay helper</p>
          </div>
        </div>

        {messages.length > 1 && (
          <button
            onClick={clearChat}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors hover:bg-red-50"
            style={{ color: '#ef4444', border: '1px solid #fecaca' }}
          >
            <Trash2 size={12} /> <span className="hidden sm:inline">Clear</span>
          </button>
        )}
      </header>

      {/* Messages */}
      <main className="flex-1 relative z-10 flex flex-col max-w-3xl w-full mx-auto px-4 py-6 overflow-hidden pt-24">
        <div className="flex-1 space-y-4 overflow-y-auto pb-4 pr-1" role="log" aria-live="polite" aria-label="Chat messages">
          {/* Welcome with quick questions */}
          {showWelcome && (
            <div className="fade-up space-y-5 mb-6">
              <div className="white-card p-6 text-center">
                <div className="relative w-24 h-24 mx-auto mb-4" style={{ animation: 'float 4s ease-in-out infinite' }}>
                  <Image src="/logo.png" alt="" fill sizes="96px" className="object-contain" />
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-1">Hi there! 👋</h2>
                <p className="text-sm text-gray-500">I'm here to help with all your barangay questions. Try one of these:</p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-white opacity-70 px-2 mb-2 flex items-center gap-2">
                  <Lightbulb size={12} /> Quick Questions
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {QUICK_QUESTIONS.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(null, q.text)}
                      disabled={loading}
                      className="white-card text-left p-4 flex items-start gap-3 group disabled:opacity-60"
                    >
                      <div
                        className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110"
                        style={{ background: q.bg }}
                      >
                        <q.icon size={16} style={{ color: q.color }} />
                      </div>
                      <span className="text-sm text-gray-700 leading-snug">{q.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} fade-up`}>
              {msg.role === 'assistant' && (
                <div
                  className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 4px 12px rgba(91,84,232,0.3)' }}
                >
                  <Bot size={15} className="text-white" />
                </div>
              )}

              <div
                className={`max-w-[85%] sm:max-w-md px-4 py-3 rounded-2xl text-sm shadow-sm ${
                  msg.role === 'user' ? 'text-white' : 'bg-white text-gray-800'
                }`}
                style={
                  msg.role === 'user'
                    ? {
                        background: 'linear-gradient(135deg, #5B54E8, #7C75F0)',
                        boxShadow: '0 8px 24px rgba(91,84,232,0.35)',
                        borderTopRightRadius: '6px',
                      }
                    : {
                        boxShadow: '0 4px 16px rgba(91,84,232,0.08)',
                        borderTopLeftRadius: '6px',
                      }
                }
              >
                {msg.role === 'user' ? (
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <div className="markdown leading-relaxed">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                )}
              </div>

              {msg.role === 'user' && (
                <div
                  className="w-9 h-9 rounded-2xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5"
                  style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)' }}
                >
                  You
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="flex gap-2.5 justify-start fade-up">
              <div
                className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)' }}
              >
                <Bot size={15} className="text-white" />
              </div>
              <div
                className="bg-white px-5 py-4 rounded-2xl text-sm flex items-center gap-3"
                style={{ boxShadow: '0 4px 16px rgba(91,84,232,0.08)', borderTopLeftRadius: '6px' }}
              >
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#5B54E8', animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#7C75F0', animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#a78bfa', animationDelay: '300ms' }} />
                </div>
                <span className="text-gray-400 text-xs">Thinking...</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form onSubmit={sendMessage} className="flex-shrink-0 fade-up">
          <div
            className="flex items-end gap-2 rounded-3xl p-2 pl-3"
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.25)',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
            }}
          >
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
              aria-label="Message"
              className="flex-1 bg-transparent border-none outline-none resize-none text-sm text-white py-2.5 placeholder-white/50"
              style={{ maxHeight: '120px' }}
              placeholder="Ask me anything about your barangay..."
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Send message"
              className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-all hover:scale-105 disabled:hover:scale-100"
              style={{
                background: input.trim() ? 'linear-gradient(135deg, #fff, #f5f4ff)' : 'rgba(255,255,255,0.3)',
                color: '#5B54E8',
                boxShadow: input.trim() ? '0 4px 16px rgba(255,255,255,0.4)' : 'none',
              }}
            >
              <Send size={16} />
            </button>
          </div>

          {/* Footer hint */}
          <div className="flex items-center justify-end mt-2 px-2">
            <p className="text-xs text-purple-200 opacity-60 hidden sm:block">
              {input.length}/{MAX_INPUT_LENGTH} · Press{' '}
              <kbd className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: 'rgba(255,255,255,0.15)' }}>
                Enter
              </kbd>{' '}
              to send
            </p>
          </div>
        </form>
      </main>
    </div>
  )
}