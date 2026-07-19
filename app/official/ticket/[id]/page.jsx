'use client'
import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ArrowLeft, Send, X, User, Clock, CheckCircle, AlertCircle, Sparkles, MapPin, Phone, Loader2, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmDialog from '@/components/ConfirmDialog'
import { TICKET_CATEGORY_CONFIG as CATEGORY_CONFIG } from '@/lib/incident-config'

const STATUS_CONFIG = {
  open: { color: '#f59e0b', bg: '#fef3c7', label: 'Open', icon: AlertCircle, desc: 'Awaiting response' },
  in_progress: { color: '#3b82f6', bg: '#dbeafe', label: 'In Progress', icon: Clock, desc: 'Being handled' },
  closed: { color: '#22c55e', bg: '#dcfce7', label: 'Closed', icon: CheckCircle, desc: 'Resolved' },
}

const MESSAGE_SELECT = '*, profiles(full_name, avatar_url, role)'
const MAX_MESSAGE_LENGTH = 1000

// One-tap canned responses — the phrases officials type constantly
const QUICK_REPLIES = [
  'Thank you for reaching out. We are looking into this now.',
  'Please visit the barangay hall during office hours (8AM–5PM) to process this.',
  'Please bring a valid ID and proof of residency.',
  'This has been resolved. Let us know if you need anything else!',
]

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

export default function OfficialTicketChat() {
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
  const [closeConfirm, setCloseConfirm] = useState(false)
  const [closing, setClosing] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

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
          supabase.from('tickets')
            .select('*, profiles!tickets_created_by_fkey(full_name, avatar_url, phone, address)')
            .eq('id', id)
            .single(),
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
        setMessages(msgs || [])

        // Auto-claim: opening an 'open' ticket marks it in progress under this official
        if (t.status === 'open') {
          const { error: claimError } = await supabase
            .from('tickets')
            .update({ status: 'in_progress', handled_by: user.id })
            .eq('id', id)
            .eq('status', 'open') // guard: don't clobber if another official claimed it first
          if (!claimError && !cancelled) {
            setTicket(prev => ({ ...prev, status: 'in_progress', handled_by: user.id }))
          }
        }
      } catch (err) {
        console.error('Failed to load ticket:', err)
        if (!cancelled) toast.error('Failed to load ticket. Please refresh.')
      } finally {
        if (!cancelled) setPageLoading(false)
      }
    }
    load()

    const channel = supabase.channel(`official-ticket-${id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ticket_messages', filter: `ticket_id=eq.${id}` },
        async (payload) => {
          const { data, error } = await supabase.from('ticket_messages')
            .select(MESSAGE_SELECT)
            .eq('id', payload.new.id)
            .single()
          if (error || !data) return
          setMessages(prev => (prev.some(m => m.id === data.id) ? prev : [...prev, data]))
        })
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tickets', filter: `id=eq.${id}` },
        (payload) => {
          // Keep in sync if another official closes/reopens/claims this ticket
          setTicket(prev => (prev ? { ...prev, ...payload.new } : prev))
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
    setNewMessage('')

    const { error } = await supabase.from('ticket_messages').insert({
      ticket_id: id,
      sender_id: user.id,
      message: text,
    })

    setSending(false)

    if (error) {
      setNewMessage(text) // restore the draft
      toast.error('Failed to send message. Please try again.')
    }
    inputRef.current?.focus()
  }, [newMessage, sending, user, id, supabase])

  async function closeTicket() {
    if (closing) return
    setClosing(true)
    try {
      const { error } = await supabase.from('tickets').update({ status: 'closed' }).eq('id', id)
      if (error) throw error
      setTicket(prev => ({ ...prev, status: 'closed' }))
      toast.success('Ticket closed successfully!')
    } catch (err) {
      console.error('Failed to close ticket:', err)
      toast.error('Failed to close ticket. Please try again.')
    } finally {
      setClosing(false)
      setCloseConfirm(false)
    }
  }

  async function reopenTicket() {
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ status: 'in_progress', handled_by: user?.id })
        .eq('id', id)
      if (error) throw error
      setTicket(prev => ({ ...prev, status: 'in_progress', handled_by: user?.id }))
      toast.success('Ticket reopened.')
    } catch (err) {
      console.error('Failed to reopen ticket:', err)
      toast.error('Failed to reopen ticket. Please try again.')
    }
  }

  function applyQuickReply(text) {
    setNewMessage(text)
    inputRef.current?.focus()
  }

  const sc = STATUS_CONFIG[ticket?.status] || STATUS_CONFIG.open
  const StatusIcon = sc.icon
  const cat = CATEGORY_CONFIG[ticket?.category] || null
  const CategoryIcon = cat?.icon

  // ---- Loading state ----
  if (pageLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-brand relative overflow-hidden">
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
          className="w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0 overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 4px 12px rgba(91,84,232,0.3)' }}
        >
          {ticket?.profiles?.avatar_url ? (
            <img src={ticket.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            ticket?.profiles?.full_name?.[0]?.toUpperCase() || '?'
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-sm sm:text-base font-bold text-gray-800 truncate" style={{ letterSpacing: '-0.3px' }}>
            {ticket?.title}
          </h1>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <p className="text-[11px] sm:text-xs text-gray-400 truncate">
              <span className="text-gray-500 font-semibold">{ticket?.profiles?.full_name || 'Unknown resident'}</span>
            </p>
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

        {ticket?.status !== 'closed' && (
          <button
            onClick={() => setCloseConfirm(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-4 py-2 rounded-xl text-xs font-bold text-white transition-all hover:scale-105 flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 4px 12px rgba(239,68,68,0.3)' }}
            title="Close Ticket"
          >
            <X size={13} />
            <span className="hidden sm:inline">Close</span>
          </button>
        )}
      </header>

      {/* Details panel (collapsible) */}
      {showDetails && ticket && (
        <div className="bg-white relative z-10 px-4 sm:px-6 py-3 fade-up" style={{ borderBottom: '1px solid #f0effe' }}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Original Description</p>
          <p className="text-sm text-gray-700 leading-relaxed">{ticket.description}</p>

          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Resident Info</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs">
                <User size={11} className="text-gray-400 flex-shrink-0" />
                <span className="font-semibold text-gray-700">{ticket.profiles?.full_name || 'Unknown resident'}</span>
              </div>
              {ticket.profiles?.phone && (
                <a href={`tel:${ticket.profiles.phone}`} className="flex items-center gap-2 text-xs hover:underline" style={{ color: '#5B54E8' }}>
                  <Phone size={11} className="text-gray-400 flex-shrink-0" />
                  <span>{ticket.profiles.phone}</span>
                </a>
              )}
              {ticket.profiles?.address && (
                <div className="flex items-start gap-2 text-xs">
                  <MapPin size={11} className="text-gray-400 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">{ticket.profiles.address}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Clock size={11} />
              Created {new Date(ticket.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            <span>·</span>
            <span>{sc.desc}</span>
          </div>
        </div>
      )}

      {/* Messages */}
      <main className="flex-1 relative z-10 flex flex-col max-w-2xl w-full mx-auto px-3 sm:px-4 py-4 overflow-hidden">
        <div className="flex-1 space-y-3 overflow-y-auto pb-4 px-1" role="log" aria-live="polite" aria-label="Ticket messages">
          {messages.length === 0 && (
            <div className="text-center mt-12">
              <div className="glass-card inline-block px-6 py-4">
                <div
                  className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.2)' }}
                >
                  <Send size={20} className="text-white" />
                </div>
                <p className="text-white text-sm font-bold">No messages yet</p>
                <p className="text-purple-200 text-xs mt-1">Reply to start helping the resident!</p>
              </div>
            </div>
          )}

          {messages.map((msg, i) => {
            const isMe = msg.sender_id === user?.id
            const prevMsg = messages[i - 1]
            const showSender = !prevMsg || prevMsg.sender_id !== msg.sender_id
            const isResident = msg.profiles?.role === 'resident'
            const showDaySeparator = !prevMsg || dayLabel(prevMsg.created_at) !== dayLabel(msg.created_at)

            return (
              <div key={msg.id}>
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
                  {!isMe && showSender && (
                    <div
                      className="w-7 h-7 rounded-xl flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 overflow-hidden mb-1"
                      style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)' }}
                    >
                      {msg.profiles?.avatar_url ? (
                        <img src={msg.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        msg.profiles?.full_name?.[0]?.toUpperCase() || '?'
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
                      <p className="text-[10px] font-bold mb-1 flex items-center gap-1" style={{ color: '#5B54E8' }}>
                        {msg.profiles?.full_name || 'Unknown user'}
                        {isResident && (
                          <span className="text-[9px] px-1 py-0.5 rounded-md font-bold" style={{ background: '#f0effe', color: '#5B54E8' }}>
                            Resident
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
          <div className="mt-3 sticky bottom-0 space-y-2">
            {/* Quick replies — one tap for the phrases officials type all day */}
            {newMessage === '' && (
              <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {QUICK_REPLIES.map((reply, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => applyQuickReply(reply)}
                    className="flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold text-white transition-all hover:scale-105 max-w-[240px] truncate"
                    style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', backdropFilter: 'blur(10px)' }}
                    title={reply}
                  >
                    {reply}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={sendMessage} className="flex gap-2">
              <input
                ref={inputRef}
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                maxLength={MAX_MESSAGE_LENGTH}
                aria-label="Reply to resident"
                className="flex-1 rounded-2xl px-4 py-3 text-sm outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.25)',
                  color: 'white',
                  backdropFilter: 'blur(10px)',
                }}
                placeholder="Reply to resident..."
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
          </div>
        ) : (
          <div className="mt-4">
            <div className="glass-card px-6 py-3 flex items-center justify-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <CheckCircle size={14} className="text-white opacity-80" />
                <p className="text-white text-sm font-semibold">This ticket is closed</p>
              </div>
              <button
                onClick={reopenTicket}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all hover:scale-105"
                style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}
              >
                <RotateCcw size={11} /> Reopen
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Confirm Close Dialog */}
      <ConfirmDialog
        open={closeConfirm}
        onClose={() => setCloseConfirm(false)}
        onConfirm={closeTicket}
        title="Close this ticket?"
        message="Are you sure you want to close this ticket? The resident will no longer be able to send messages."
        confirmText={closing ? 'Closing...' : 'Yes, Close Ticket'}
        cancelText="Keep Open"
        variant="danger"
      />
    </div>
  )
}