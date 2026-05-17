'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ArrowLeft, Send, Clock, CheckCircle, AlertCircle, Tag, Sparkles, Shield, FileQuestion, FileText, AlertCircle as AlertIcon, Star } from 'lucide-react'
import toast from 'react-hot-toast'

const dots = [...Array(15)].map((_, i) => ({
  size: (((i * 7) % 6) + 3),
  left: ((i * 17 + 13) % 100),
  top: ((i * 23 + 7) % 100),
  duration: ((i * 3) % 6) + 4,
  delay: (i * 0.7) % 4,
}))

const AnimatedDots = () => (
  <div className="absolute inset-0" style={{overflow: 'hidden', pointerEvents: 'none'}}>
    {dots.map((dot, i) => (
      <div key={i} style={{
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
      }} />
    ))}
  </div>
)

const categoryConfig = {
  inquiry: { label: 'Inquiry', icon: FileQuestion, color: '#3b82f6', bg: '#eff6ff' },
  request: { label: 'Request', icon: FileText, color: '#5B54E8', bg: '#f0effe' },
  complaint: { label: 'Complaint', icon: AlertIcon, color: '#f97316', bg: '#fff7ed' },
  feedback: { label: 'Feedback', icon: Star, color: '#22c55e', bg: '#f0fdf4' },
}

const statusConfig = {
  open: { color: '#f59e0b', bg: '#fef3c7', label: 'Open', icon: AlertCircle, desc: 'Awaiting response' },
  in_progress: { color: '#3b82f6', bg: '#dbeafe', label: 'In Progress', icon: Clock, desc: 'Being handled' },
  closed: { color: '#22c55e', bg: '#dcfce7', label: 'Closed', icon: CheckCircle, desc: 'Resolved' },
}

export default function TicketChat() {
  const router = useRouter()
  const { id } = useParams()
  const supabase = createClient()
  const [ticket, setTicket] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      const { data: t } = await supabase.from('tickets').select('*').eq('id', id).single()
      setTicket(t)
      const { data: msgs } = await supabase.from('ticket_messages')
        .select('*, profiles(full_name, avatar_url, role)')
        .eq('ticket_id', id)
        .order('created_at', { ascending: true })
      setMessages(msgs || [])
    }
    load()

    const channel = supabase.channel(`ticket-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ticket_messages', filter: `ticket_id=eq.${id}` },
        async (payload) => {
          const { data } = await supabase.from('ticket_messages')
            .select('*, profiles(full_name, avatar_url, role)')
            .eq('id', payload.new.id).single()
          setMessages(prev => [...prev, data])
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tickets', filter: `id=eq.${id}` },
        (payload) => {
          setTicket(prev => ({ ...prev, ...payload.new }))
          if (payload.new.status === 'closed') {
            toast.success('Your ticket has been resolved! ✅', { duration: 5000 })
          } else if (payload.new.status === 'in_progress' && payload.old?.status === 'open') {
            toast.success('An official is now handling your ticket! 🛡️', { duration: 5000 })
          }
        })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(e) {
    e.preventDefault()
    if (!newMessage.trim()) return
    setLoading(true)
    await supabase.from('ticket_messages').insert({
      ticket_id: id,
      sender_id: user.id,
      message: newMessage.trim()
    })
    setNewMessage('')
    setLoading(false)
  }

  const sc = statusConfig[ticket?.status] || statusConfig.open
  const StatusIcon = sc.icon
  const cat = categoryConfig[ticket?.category] || null
  const CategoryIcon = cat?.icon

  return (
    <div className="min-h-screen h-screen flex flex-col relative overflow-hidden bg-brand">

      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 right-20 w-96 h-96 rounded-full opacity-10"
          style={{background: 'white', filter: 'blur(80px)', animation: 'float 8s ease-in-out infinite'}} />
        <div className="absolute bottom-20 left-20 w-72 h-72 rounded-full opacity-10"
          style={{background: 'white', filter: 'blur(60px)', animation: 'floatReverse 10s ease-in-out infinite'}} />
        <div className="absolute inset-0 opacity-5"
          style={{backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px)', backgroundSize: '60px 60px'}} />
      </div>

      {/* Premium Header */}
      <header className="bg-white relative z-20 px-3 sm:px-6 py-3 flex items-center gap-2 sm:gap-3 sticky top-0"
        style={{boxShadow: '0 4px 16px rgba(91,84,232,0.08)', borderBottom: '1px solid #f0effe'}}>

        {/* Back button */}
        <button onClick={() => router.back()}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors flex-shrink-0">
          <ArrowLeft size={18} />
        </button>

        {/* Ticket icon */}
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 4px 12px rgba(91,84,232,0.3)'}}>
          {cat ? (
            <CategoryIcon size={16} className="text-white" />
          ) : (
            <FileText size={16} className="text-white" />
          )}
        </div>

        {/* Title & info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-sm sm:text-base font-bold text-gray-800 truncate" style={{letterSpacing: '-0.3px'}}>
              {ticket?.title || 'Loading...'}
            </h1>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {ticket && (
              <span className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5 flex-shrink-0"
                style={{background: sc.bg, color: sc.color}}>
                <StatusIcon size={9} />
                <span>{sc.label}</span>
              </span>
            )}
            {cat && (
              <span className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5 flex-shrink-0"
                style={{background: cat.bg, color: cat.color}}>
                <CategoryIcon size={9} />
                <span className="hidden sm:inline">{cat.label}</span>
              </span>
            )}
          </div>
        </div>

        {/* Info toggle */}
        <button onClick={() => setShowDetails(!showDetails)}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors flex-shrink-0"
          title="Ticket details">
          <Sparkles size={14} />
        </button>
      </header>

      {/* Details panel (collapsible) */}
      {showDetails && ticket && (
        <div className="bg-white relative z-10 px-4 sm:px-6 py-3 fade-up"
          style={{borderBottom: '1px solid #f0effe'}}>
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

      {/* Status banner for status changes */}
      {ticket?.status === 'in_progress' && (
        <div className="relative z-10 px-4 py-2 fade-up">
          <div className="max-w-2xl mx-auto rounded-xl px-3 py-2 flex items-center gap-2"
            style={{background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', backdropFilter: 'blur(10px)'}}>
            <Shield size={12} className="text-white flex-shrink-0" />
            <p className="text-xs text-white">A barangay official is handling your ticket</p>
          </div>
        </div>
      )}

      {/* Messages */}
      <main className="flex-1 relative z-10 flex flex-col max-w-2xl w-full mx-auto px-3 sm:px-4 py-4 overflow-hidden">
        <div className="flex-1 space-y-3 overflow-y-auto pb-4 px-1">
          {messages.length === 0 && (
            <div className="text-center mt-12">
              <div className="glass-card inline-block px-6 py-5 text-center">
                <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                  style={{background: 'rgba(255,255,255,0.2)'}}>
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

            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} items-end gap-2`}>
                {/* Avatar (only for official messages) */}
                {!isMe && showSender && (
                  <div className="relative flex-shrink-0 mb-1">
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center text-[10px] font-bold text-white overflow-hidden"
                      style={{background: 'linear-gradient(135deg, #f97316, #ea580c)'}}>
                      {msg.profiles?.avatar_url ? (
                        <img src={msg.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        msg.profiles?.full_name?.[0]?.toUpperCase() || '?'
                      )}
                    </div>
                    {isOfficial && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full flex items-center justify-center"
                        style={{background: 'white', border: '2px solid white'}}>
                        <Shield size={6} className="text-orange-500" />
                      </div>
                    )}
                  </div>
                )}
                {!isMe && !showSender && <div className="w-7 flex-shrink-0" />}

                <div className={`max-w-[75%] sm:max-w-md px-4 py-2.5 rounded-2xl text-sm ${
                  isMe ? 'text-white rounded-br-md' : 'bg-white text-gray-800 rounded-bl-md'
                }`}
                  style={isMe ? {
                    background: 'linear-gradient(135deg, #5B54E8, #7C75F0)',
                    boxShadow: '0 4px 16px rgba(91,84,232,0.3)'
                  } : {
                    boxShadow: '0 4px 16px rgba(91,84,232,0.08)'
                  }}>
                  {!isMe && showSender && (
                    <p className="text-[10px] font-bold mb-1 flex items-center gap-1" style={{color: isOfficial ? '#f97316' : '#5B54E8'}}>
                      {msg.profiles?.full_name}
                      {isOfficial && <span className="text-[9px] px-1 py-0.5 rounded-md font-bold" style={{background: '#fff7ed', color: '#f97316'}}>Official</span>}
                    </p>
                  )}
                  <p className="leading-relaxed break-words">{msg.message}</p>
                  <p className={`text-[10px] mt-1 ${isMe ? 'text-purple-200' : 'text-gray-400'}`}>
                    {new Date(msg.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {ticket?.status !== 'closed' ? (
          <form onSubmit={sendMessage} className="flex gap-2 mt-3 sticky bottom-0">
            <input value={newMessage} onChange={e => setNewMessage(e.target.value)}
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
            <button type="submit" disabled={loading || !newMessage.trim()}
              className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 disabled:opacity-50 transition-all hover:scale-105"
              style={{background: 'white', color: '#5B54E8', boxShadow: '0 8px 24px rgba(255,255,255,0.3)'}}>
              <Send size={16} />
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