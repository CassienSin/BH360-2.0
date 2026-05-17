'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ArrowLeft, Send, X, User, Clock, CheckCircle, AlertCircle, Tag, Sparkles, FileQuestion, FileText, AlertCircle as AlertIcon, Star, MapPin, Phone, Mail } from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmDialog from '@/components/ConfirmDialog'

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

export default function OfficialTicketChat() {
  const router = useRouter()
  const { id } = useParams()
  const supabase = createClient()
  const [ticket, setTicket] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [closeConfirm, setCloseConfirm] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      const { data: t } = await supabase.from('tickets')
        .select('*, profiles!tickets_created_by_fkey(full_name, avatar_url, phone, address)')
        .eq('id', id).single()
      setTicket(t)

      const { data: msgs } = await supabase.from('ticket_messages')
        .select('*, profiles(full_name, avatar_url, role)')
        .eq('ticket_id', id)
        .order('created_at', { ascending: true })
      setMessages(msgs || [])

      if (t?.status === 'open') {
        await supabase.from('tickets').update({
          status: 'in_progress',
          handled_by: user.id
        }).eq('id', id)
        setTicket(prev => ({ ...prev, status: 'in_progress' }))
      }
    }
    load()

    const channel = supabase.channel(`official-ticket-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ticket_messages', filter: `ticket_id=eq.${id}` },
        async (payload) => {
          const { data } = await supabase.from('ticket_messages')
            .select('*, profiles(full_name, avatar_url, role)')
            .eq('id', payload.new.id).single()
          setMessages(prev => [...prev, data])
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

  async function closeTicket() {
    await supabase.from('tickets').update({ status: 'closed' }).eq('id', id)
    setTicket(prev => ({ ...prev, status: 'closed' }))
    toast.success('Ticket closed successfully!')
    setCloseConfirm(false)
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

        {/* Avatar */}
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0 overflow-hidden"
          style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 4px 12px rgba(91,84,232,0.3)'}}>
          {ticket?.profiles?.avatar_url ? (
            <img src={ticket.profiles.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            ticket?.profiles?.full_name?.[0]?.toUpperCase() || '?'
          )}
        </div>

        {/* Title & info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-sm sm:text-base font-bold text-gray-800 truncate" style={{letterSpacing: '-0.3px'}}>
              {ticket?.title || 'Loading...'}
            </h1>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <p className="text-[11px] sm:text-xs text-gray-400 truncate">
              <span className="text-gray-500 font-semibold">{ticket?.profiles?.full_name}</span>
            </p>
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

        {/* Details toggle */}
        <button onClick={() => setShowDetails(!showDetails)}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors flex-shrink-0"
          title="Ticket details">
          <Sparkles size={14} />
        </button>

        {/* Close button */}
        {ticket?.status !== 'closed' && (
          <button onClick={() => setCloseConfirm(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-4 py-2 rounded-xl text-xs font-bold text-white transition-all hover:scale-105 flex-shrink-0"
            style={{background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 4px 12px rgba(239,68,68,0.3)'}}
            title="Close Ticket">
            <X size={13} />
            <span className="hidden sm:inline">Close</span>
          </button>
        )}
      </header>

      {/* Details panel (collapsible) */}
      {showDetails && ticket && (
        <div className="bg-white relative z-10 px-4 sm:px-6 py-3 fade-up"
          style={{borderBottom: '1px solid #f0effe'}}>

          {/* Original Description */}
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Original Description</p>
          <p className="text-sm text-gray-700 leading-relaxed">{ticket.description}</p>

          {/* Resident contact info */}
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Resident Info</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs">
                <User size={11} className="text-gray-400 flex-shrink-0" />
                <span className="font-semibold text-gray-700">{ticket.profiles?.full_name}</span>
              </div>
              {ticket.profiles?.phone && (
                <a href={`tel:${ticket.profiles.phone}`} className="flex items-center gap-2 text-xs hover:underline" style={{color: '#5B54E8'}}>
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
        <div className="flex-1 space-y-3 overflow-y-auto pb-4 px-1">
          {messages.length === 0 && (
            <div className="text-center mt-12">
              <div className="glass-card inline-block px-6 py-4">
                <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                  style={{background: 'rgba(255,255,255,0.2)'}}>
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

            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} items-end gap-2`}>
                {/* Avatar (only for resident messages) */}
                {!isMe && showSender && (
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 overflow-hidden mb-1"
                    style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)'}}>
                    {msg.profiles?.avatar_url ? (
                      <img src={msg.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      msg.profiles?.full_name?.[0]?.toUpperCase() || '?'
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
                    <p className="text-[10px] font-bold mb-1 flex items-center gap-1" style={{color: '#5B54E8'}}>
                      {msg.profiles?.full_name}
                      {isResident && <span className="text-[9px] px-1 py-0.5 rounded-md font-bold" style={{background: '#f0effe', color: '#5B54E8'}}>Resident</span>}
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
            <button type="submit" disabled={loading || !newMessage.trim()}
              className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 disabled:opacity-50 transition-all hover:scale-105"
              style={{background: 'white', color: '#5B54E8', boxShadow: '0 8px 24px rgba(255,255,255,0.3)'}}>
              <Send size={16} />
            </button>
          </form>
        ) : (
          <div className="mt-4">
            <div className="glass-card px-6 py-3 text-center flex items-center justify-center gap-2">
              <CheckCircle size={14} className="text-white opacity-80" />
              <p className="text-white text-sm font-semibold">This ticket is closed</p>
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
        confirmText="Yes, Close Ticket"
        cancelText="Keep Open"
        variant="danger"
      />
    </div>
  )
}