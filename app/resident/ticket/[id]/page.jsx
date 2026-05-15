'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ArrowLeft, Send } from 'lucide-react'

export default function TicketChat() {
  const router = useRouter()
  const { id } = useParams()
  const supabase = createClient()
  const [ticket, setTicket] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      const { data: t } = await supabase.from('tickets').select('*').eq('id', id).single()
      setTicket(t)
      const { data: msgs } = await supabase.from('ticket_messages')
        .select('*, profiles(full_name)')
        .eq('ticket_id', id)
        .order('created_at', { ascending: true })
      setMessages(msgs || [])
    }
    load()

    const channel = supabase.channel(`ticket-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ticket_messages', filter: `ticket_id=eq.${id}` },
        async (payload) => {
          const { data } = await supabase.from('ticket_messages')
            .select('*, profiles(full_name)')
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

  const statusColor = {
    open: 'bg-amber-100 text-amber-700',
    in_progress: 'bg-blue-100 text-blue-700',
    closed: 'bg-emerald-100 text-emerald-700',
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-brand">

      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 right-20 w-96 h-96 rounded-full opacity-10"
          style={{background: 'white', filter: 'blur(80px)', animation: 'float 8s ease-in-out infinite'}} />
        <div className="absolute bottom-20 left-20 w-72 h-72 rounded-full opacity-10"
          style={{background: 'white', filter: 'blur(60px)', animation: 'floatReverse 10s ease-in-out infinite'}} />
        <div className="absolute inset-0 opacity-5"
          style={{backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px)', backgroundSize: '60px 60px'}} />
      </div>

      {/* Header */}
      <header className="bg-white relative z-10 px-6 py-4 flex items-center gap-3"
        style={{boxShadow: '0 2px 12px rgba(91,84,232,0.08)', borderBottom: '1px solid #f0effe'}}>
        <button onClick={() => router.back()}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-gray-100 flex-shrink-0">
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-gray-800 truncate">{ticket?.title}</h1>
          <p className="text-xs text-gray-400 truncate">{ticket?.description}</p>
        </div>
        {ticket && (
          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0 ${statusColor[ticket.status]}`}>
            {ticket.status.replace('_', ' ')}
          </span>
        )}
      </header>

      {/* Messages */}
      <main className="flex-1 relative z-10 flex flex-col max-w-2xl w-full mx-auto px-4 py-4 overflow-hidden">
        <div className="flex-1 space-y-3 overflow-y-auto pb-4">
          {messages.length === 0 && (
            <div className="text-center mt-12">
              <div className="glass-card inline-block px-6 py-4">
                <p className="text-white text-sm font-medium">No messages yet</p>
                <p className="text-purple-200 text-xs mt-1">Start the conversation!</p>
              </div>
            </div>
          )}
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl text-sm shadow-sm ${
                msg.sender_id === user?.id
                  ? 'text-white'
                  : 'bg-white text-gray-800'
              }`}
                style={msg.sender_id === user?.id ? {
                  background: 'linear-gradient(135deg, #5B54E8, #7C75F0)',
                  boxShadow: '0 4px 16px rgba(91,84,232,0.3)'
                } : {
                  boxShadow: '0 4px 16px rgba(91,84,232,0.08)'
                }}>
                {msg.sender_id !== user?.id && (
                  <p className="text-xs font-semibold mb-1" style={{color: '#5B54E8'}}>{msg.profiles?.full_name}</p>
                )}
                <p>{msg.message}</p>
                <p className={`text-xs mt-1.5 ${msg.sender_id === user?.id ? 'text-purple-200' : 'text-gray-400'}`}>
                  {new Date(msg.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {ticket?.status !== 'closed' ? (
          <form onSubmit={sendMessage} className="flex gap-2 mt-4">
            <input value={newMessage} onChange={e => setNewMessage(e.target.value)}
              className="flex-1 rounded-2xl px-4 py-3 text-sm outline-none"
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.25)',
                color: 'white',
                backdropFilter: 'blur(10px)',
              }}
              placeholder="Type a message..."
              onFocus={e => e.target.style.background = 'rgba(255,255,255,0.22)'}
              onBlur={e => e.target.style.background = 'rgba(255,255,255,0.15)'}
            />
            <button type="submit" disabled={loading || !newMessage.trim()}
              className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 disabled:opacity-50 transition-all"
              style={{background: 'white', color: '#5B54E8', boxShadow: '0 4px 16px rgba(255,255,255,0.3)'}}>
              <Send size={16} />
            </button>
          </form>
        ) : (
          <div className="mt-4 text-center">
            <div className="glass-card inline-block px-6 py-3">
              <p className="text-purple-200 text-sm">This ticket is closed.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}