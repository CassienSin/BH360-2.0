'use client'
import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ArrowLeft, Send, Clock, CheckCircle, AlertCircle, Sparkles, Shield, FileQuestion, FileText, AlertCircle as AlertIcon, Star, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

const DOTS = Array.from({ length: 15 }, (_, i) => ({
  size: ((i * 7) % 6) + 3,
  left: (i * 17 + 13) % 100,
  top: (i * 23 + 7) % 100,
  duration: ((i * 3) % 6) + 4,
  delay: (i * 0.7) % 4,
}))

const AnimatedDots = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
    {DOTS.map((dot, i) => (
      <div
        key={i}
        style={{
          position: 'absolute',
          width: `${dot.size}px`,
          height: `${dot.size}px`,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.4)',
          left: `${dot.left}%`,
          top: `${dot.top}%`,
          animation: `float ${dot.duration}s ease-in-out infinite`,
          animationDelay: `${dot.delay}s`,
          filter: 'blur(0.5px)',
        }}
      />
    ))}
  </div>
)

const CATEGORY_CONFIG = {
  inquiry: { label: 'Inquiry', icon: FileQuestion, color: '#3b82f6', bg: '#eff6ff' },
  request: { label: 'Request', icon: FileText, color: '#5B54E8', bg: '#f0effe' },
  complaint: { label: 'Complaint', icon: AlertIcon, color: '#f97316', bg: '#fff7ed' },
  feedback: { label: 'Feedback', icon: Star, color: '#22c55e', bg: '#f0fdf4' },
}

const STATUS_CONFIG = {
  open: { color: '#f59e0b', bg: '#fef3c7', label: 'Open', icon: AlertCircle, desc: 'Awaiting response' },
  in_progress: { color: '#3b82f6', bg: '#dbeafe', label: 'In Progress', icon: Clock, desc: 'Being handled' },
  closed: { color: '#22c55e', bg: '#dcfce7', label: 'Closed', icon: CheckCircle, desc: 'Resolved' },
}

const MESSAGE_SELECT = '*, profiles(full_name, avatar_url, role)'
const MAX_MESSAGE_LENGTH = 1000

/** "Today", "Yesterday", or a formatted date — for day separators between messages. */
function dayLabel(dateStr) {
  const date = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  if (sameDay(date, today)) return 'Today'
  if (sameDay(date, yesterday)) return 'Yesterday'
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function TicketChat() {
  const router = useRouter()
  const { id } = useParams()
  const supabase = useMemo(() => createClient(), [])

  const [ticket, setTicket] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [user, setUser] = useState(null)
  const [sending, setSending] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  // Track previous status ourselves — payload.old from realtime is unreliable
  // unless the table has REPLICA IDENTITY FULL
  const statusRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
          router.push('/login')
          return
        }
        if (cancelled) return
        setUser(user)

        const [{ data: t, error: ticketError }, { data: msgs }] = await Promise.all([
          supabase.from('tickets').select('*').eq('id', id).single(),
          supabase.from('ticket_messages')
            .select(MESSAGE_SELECT)
            .eq('ticket_id', id)
            .order('created_at', { ascending: true }),
        ])

        if (cancelled) return
        if (ticketError || !t) {
          setNotFound(true)
          return
        }
        setTicket(t)
        statusRef.current = t.status
        setMessages(msgs || [])
      } catch (err) {
        console.error('Failed to load ticket:', err)
        if (!cancelled) toast.error('Failed to load ticket. Please refresh.')
      } finally {
        if (!cancelled) setPageLoading(false)
      }
    }
    load()

    const channel = supabase.channel(`ticket-${id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ticket_messages', filter: `ticket_id=eq.${id}` },
        async (payload) => {
          const { data, error } = await supabase.from('ticket_messages')
            .select(MESSAGE_SELECT)
            .eq('id', payload.new.id)
            .single()
          if (error || !data) return
          // Dedupe — realtime can occasionally redeliver
          setMessages(prev => (prev.some(m => m.id === data.id) ? prev : [...prev, data]))
        })
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tickets', filter: `id=eq.${id}` },
        (payload) => {
          const prevStatus = statusRef.current
          const nextStatus = payload.new.status
          setTicket(prev => ({ ...prev, ...payload.new }))
          if (nextStatus !== prevStatus) {
            if (nextStatus === 'closed') {
              toast.success('Your ticket has been resolved! ✅', { duration: 5000 })
            } else if (nextStatus === 'in_progress') {
              toast.success('An official is now handling your ticket! 🛡️', { duration: 5000 })
            }
          }
          statusRef.current = nextStatus
        })
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [id, supabase, router])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async (e) => {
    e.preventDefault()
    const text = newMessage.trim()
    if (!text || sending || !user) return

    setSending(true)
    setNewMessage('') // clear immediately so the UI feels snappy

    const { error } = await supabase.from('ticket_messages').insert({
      ticket_id: id,
      sender_id: user.id,
      message: text,
    })

    setSending(false)

    if (error) {
      // Restore the draft so the user doesn't lose what they typed
      setNewMessage(text)
      toast.error('Failed to send message. Please try again.')
    }
    inputRef.current?.focus()
  }, [newMessage, sending, user, id, supabase])

  const sc = STATUS_CONFIG[ticket?.status] || STATUS_CONFIG.open
  const StatusIcon = sc.icon
  const cat = CATEGORY_CONFIG[ticket?.category] || null
  const CategoryIcon = cat?.icon

  // ---- Loading state ----
  if (pageLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-brand relative overflow-hidden">
        <AnimatedDots />
        <div className="glass-card px-8 py-6 flex flex-col items-center gap-3 relative z-10">
          <Loader2 size={24} className="animate-spin text-white" />
          <p className="text-white text-sm font-semibold">Loading ticket...</p>
        </div>
      </div>
    )
  }

  // ---- Not found state ----
  if (notFound) {
    return (
      <div className="h-screen flex items-center justify-center bg-brand relative overflow-hidden px-4">
        <AnimatedDots />
        <div className="glass-card px-8 py-6 flex flex-col items-center gap-3 text-center relative z-10">
          <AlertCircle size={28} className="text-white opacity-90" />
          <p className="text-white text-sm font-bold">Ticket not found</p>
          <p className="text-purple-200 text-xs">It may have been deleted, or you may not have access to it.</p>
          <button
            onClick={() => router.back()}
            className="mt-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105"
            style={{ background: 'white', color: '#5B54E8' }}
          >
            Go back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col relative overflow-hidden bg-brand">
      <AnimatedDots />

      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div
          className="absolute top-20 right-20 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'white', filter: 'blur(80px)', animation: 'float 8s ease-in-out infinite' }}
        />
        <div
          className="absolute bottom-20 left-20 w-72 h-72 rounded-full opacity-10"
          style={{ background: 'white', filter: 'blur(60px)', animation: 'floatReverse 10s ease-in-out infinite' }}
        />
        <div
          className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px)', backgroundSize: '60px 60px' }}
        />
      </div>

      {/* Header */}
      <header
        className="bg-white relative z-20 px-3 sm:px-6 py-3 flex items-center gap-2 sm:gap-3 sticky top-0"
        style={{ boxShadow: '0 4px 16px rgba(91,84,232,0.08)', borderBottom: '1px solid #f0effe' }}
      >
        <button
          onClick={() => router.back()}
          aria-label="Go back"
          className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors flex-shrink-0"
        >
          <ArrowLeft size={18} />
        </button>

        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 4px 12px rgba(91,84,232,0.3)' }}
        >
          {cat ? <CategoryIcon size={16} className="text-white" /> : <FileText size={16} className="text-white" />}
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-sm sm:text-base font-bold text-gray-800 truncate" style={{ letterSpacing: '-0.3px' }}>
            {ticket?.title}
          </h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            {ticket && (
              <span
                className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5 flex-shrink-0"
                style={{ background: sc.bg, color: sc.color }}
              >
                <StatusIcon size={9} />
                <span>{sc.label}</span>
              </span>
            )}
            {cat && (
              <span
                className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5 flex-shrink-0"
                style={{ background: cat.bg, color: cat.color }}
              >
                <CategoryIcon size={9} />
                <span className="hidden sm:inline">{cat.label}</span>
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => setShowDetails(v => !v)}
          aria-label="Toggle ticket details"
          aria-expanded={showDetails}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors flex-shrink-0"
          title="Ticket details"
        >
          <Sparkles size={14} />
        </button>
      </header>

      {/* Details panel (collapsible) */}
      {showDetails && ticket && (
        <div className="bg-white relative z-10 px-4 sm:px-6 py-3 fade-up" style={{ borderBottom: '1px solid #f0effe' }}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Description</p>
          <p className="text-sm text-gray-700 leading-relaxed">{ticket.description}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Clock size={11} />
              Created {new Date(ticket.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            <span>·</span>
            <span>{sc.desc}</span>
          </div>
        </div>
      )}

      {/* Status banner */}
      {ticket?.status === 'in_progress' && (
        <div className="relative z-10 px-4 py-2 fade-up">
          <div
            className="max-w-2xl mx-auto rounded-xl px-3 py-2 flex items-center gap-2"
            style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', backdropFilter: 'blur(10px)' }}
          >
            <Shield size={12} className="text-white flex-shrink-0" />
            <p className="text-xs text-white">A barangay official is handling your ticket</p>
          </div>
        </div>
      )}

      {/* Messages */}
      <main className="flex-1 relative z-10 flex flex-col max-w-2xl w-full mx-auto px-3 sm:px-4 py-4 overflow-hidden">
        <div className="flex-1 space-y-3 overflow-y-auto pb-4 px-1" role="log" aria-live="polite" aria-label="Ticket messages">
          {messages.length === 0 && (
            <div className="text-center mt-12">
              <div className="glass-card inline-block px-6 py-5 text-center">
                <div
                  className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.2)' }}
                >
                  <Send size={20} className="text-white" />
                </div>
                <p className="text-white text-sm font-bold">No messages yet</p>
                <p className="text-purple-200 text-xs mt-1">Send a message to start the conversation!</p>
              </div>
            </div>
          )}

          {messages.map((msg, i) => {
            const isMe = msg.sender_id === user?.id
            const prevMsg = messages[i - 1]
            const showSender = !prevMsg || prevMsg.sender_id !== msg.sender_id
            const isOfficial = msg.profiles?.role === 'official'
            const showDaySeparator = !prevMsg || dayLabel(prevMsg.created_at) !== dayLabel(msg.created_at)

            return (
              <div key={msg.id}>
                {/* Day separator */}
                {showDaySeparator && (
                  <div className="flex items-center justify-center my-4">
                    <span
                      className="text-[10px] font-bold px-3 py-1 rounded-full text-white"
                      style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)' }}
                    >
                      {dayLabel(msg.created_at)}
                    </span>
                  </div>
                )}

                <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} items-end gap-2`}>
                  {/* Avatar (only for others' first message in a run) */}
                  {!isMe && showSender && (
                    <div className="relative flex-shrink-0 mb-1">
                      <div
                        className="w-7 h-7 rounded-xl flex items-center justify-center text-[10px] font-bold text-white overflow-hidden"
                        style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}
                      >
                        {msg.profiles?.avatar_url ? (
                          <img src={msg.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          msg.profiles?.full_name?.[0]?.toUpperCase() || '?'
                        )}
                      </div>
                      {isOfficial && (
                        <div
                          className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full flex items-center justify-center"
                          style={{ background: 'white', border: '2px solid white' }}
                        >
                          <Shield size={6} className="text-orange-500" />
                        </div>
                      )}
                    </div>
                  )}
                  {!isMe && !showSender && <div className="w-7 flex-shrink-0" />}

                  <div
                    className={`max-w-[75%] sm:max-w-md px-4 py-2.5 rounded-2xl text-sm ${
                      isMe ? 'text-white rounded-br-md' : 'bg-white text-gray-800 rounded-bl-md'
                    }`}
                    style={
                      isMe
                        ? { background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 4px 16px rgba(91,84,232,0.3)' }
                        : { boxShadow: '0 4px 16px rgba(91,84,232,0.08)' }
                    }
                  >
                    {!isMe && showSender && (
                      <p className="text-[10px] font-bold mb-1 flex items-center gap-1" style={{ color: isOfficial ? '#f97316' : '#5B54E8' }}>
                        {msg.profiles?.full_name || 'Unknown user'}
                        {isOfficial && (
                          <span className="text-[9px] px-1 py-0.5 rounded-md font-bold" style={{ background: '#fff7ed', color: '#f97316' }}>
                            Official
                          </span>
                        )}
                      </p>
                    )}
                    <p className="leading-relaxed break-words whitespace-pre-wrap">{msg.message}</p>
                    <p className={`text-[10px] mt-1 ${isMe ? 'text-purple-200' : 'text-gray-400'}`}>
                      {new Date(msg.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {ticket?.status !== 'closed' ? (
          <form onSubmit={sendMessage} className="flex gap-2 mt-3 sticky bottom-0">
            <input
              ref={inputRef}
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              maxLength={MAX_MESSAGE_LENGTH}
              aria-label="Message"
              className="flex-1 rounded-2xl px-4 py-3 text-sm outline-none transition-all"
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.25)',
                color: 'white',
                backdropFilter: 'blur(10px)',
              }}
              placeholder="Type a message..."
              onFocus={e => {
                e.target.style.background = 'rgba(255,255,255,0.25)'
                e.target.style.borderColor = 'rgba(255,255,255,0.4)'
              }}
              onBlur={e => {
                e.target.style.background = 'rgba(255,255,255,0.15)'
                e.target.style.borderColor = 'rgba(255,255,255,0.25)'
              }}
            />
            <button
              type="submit"
              disabled={sending || !newMessage.trim()}
              aria-label="Send message"
              className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 disabled:opacity-50 transition-all hover:scale-105"
              style={{ background: 'white', color: '#5B54E8', boxShadow: '0 8px 24px rgba(255,255,255,0.3)' }}
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </form>
        ) : (
          <div className="mt-4">
            <div className="glass-card px-6 py-4 text-center flex flex-col items-center gap-2">
              <CheckCircle size={24} className="text-white opacity-90" />
              <p className="text-white text-sm font-bold">This ticket has been resolved!</p>
              <p className="text-purple-200 text-xs">Thank you for using our support system</p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}