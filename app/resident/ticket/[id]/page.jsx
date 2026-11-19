'use client'
import { TicketDetailSkeleton } from '@/components/Skeletons'
import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { loginHref } from '@/lib/loginRedirect'
import { goBack } from '@/lib/goBack'
import { createClient } from '@/lib/supabase'
import { ChevronLeft, MoreHorizontal, Send, Loader2 } from 'lucide-react'
import Band from '@/components/crafted/Band'
import PageShell from '@/components/crafted/PageShell'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Avatar } from '@/components/ui/avatar'
import { Tag } from '@/components/ui/tag'
import { Notice } from '@/components/ui/notice'
import { SectionLabel, Muted } from '@/components/ui/text'
import toast from 'react-hot-toast'
import { subscribeWhenSignedIn } from '@/lib/realtime'

const CATEGORY_CONFIG = {
  inquiry: { label: 'Inquiry' },
  request: { label: 'Request' },
  complaint: { label: 'Complaint' },
  feedback: { label: 'Feedback' },
}

const STATUS_CONFIG = {
  open: { label: 'Open', desc: 'Waiting for an official' },
  in_progress: { label: 'In progress', desc: 'An official is handling it' },
  closed: { label: 'Closed', desc: 'Resolved' },
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

  // While this conversation is open its notifications are read: the replies
  // are right here. Runs on open and again as each new message arrives (the
  // service worker also skips the push while this page is on screen).
  useEffect(() => {
    if (!id) return
    supabase.from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('entity_table', 'tickets')
      .eq('entity_id', id)
      .is('read_at', null)
      .then(({ error }) => { if (error) console.error('Could not mark ticket notifications read:', error) })
  }, [id, messages.length, supabase])
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
          router.replace(loginHref())
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
    const leaveChannel = subscribeWhenSignedIn(supabase, channel)

    return () => {
      cancelled = true
      leaveChannel()
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
  const cat = CATEGORY_CONFIG[ticket?.category] || null
  // Who answers: the first official in the thread.
  const handler = messages.find(m => m.profiles?.role === 'official' && m.sender_id !== user?.id)?.profiles?.full_name

  // ---- Loading state ----
  if (pageLoading) return <TicketDetailSkeleton variant="resident" />

  // ---- Not found state ----
  if (notFound) {
    return (
      <PageShell title="Ticket not found" onBack={() => goBack(router, '/resident?section=tickets')}>
        <Card lift className="px-[18px] py-5">
          <Muted>It may have been deleted, or you may not have access to it.</Muted>
          <Button className="mt-3" onClick={() => goBack(router, '/resident?section=tickets')}>Back to my tickets</Button>
        </Card>
      </PageShell>
    )
  }

  return (
    <div className="relative isolate flex h-dvh flex-col overflow-hidden bg-page">
      {/* Header on the band */}
      <header className="relative px-4 pt-[max(16px,env(safe-area-inset-top,0px))] pb-3 text-white">
        <Band extend={0} fade={56} dots={10} seed={4} />
        <div className="relative z-[1] mx-auto flex max-w-2xl items-center gap-2.5">
          <IconButton kind="onband" label="Go back" onClick={() => goBack(router, '/resident?section=tickets')}>
            <ChevronLeft size={18} strokeWidth={1.9} />
          </IconButton>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[17px] font-extrabold">{ticket?.title}</h1>
            <p className="truncate text-xs text-white/80">
              {['Ticket', sc.label.toLowerCase(), cat?.label, handler].filter(Boolean).join(' · ')}
            </p>
          </div>
          <IconButton kind="onband" label="Ticket details" aria-expanded={showDetails} onClick={() => setShowDetails(v => !v)}>
            <MoreHorizontal size={18} strokeWidth={1.9} />
          </IconButton>
        </div>
      </header>

      {/* Details (collapsible) */}
      {showDetails && ticket && (
        <div className="relative z-[2] mx-auto w-full max-w-2xl px-4">
          <Card lift className="px-[18px] py-3.5">
            <SectionLabel as="h2" className="mb-1">What you asked</SectionLabel>
            <p className="text-sm leading-[1.55] text-body whitespace-pre-wrap">{ticket.description}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Opened {new Date(ticket.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })} · {sc.desc}
            </p>
          </Card>
        </div>
      )}

      {/* Messages */}
      <main className="relative z-[1] flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-2xl flex-col gap-3 px-4 pt-2 pb-4" role="log" aria-live="polite" aria-label="Ticket messages">
          {messages.length === 0 && (
            <Card className="mx-auto mt-8 max-w-xs px-5 py-4 text-center">
              <p className="text-sm font-bold text-ink">No messages yet</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Write below and an official will answer here.</p>
            </Card>
          )}

          {messages.map((msg, i) => {
            const isMe = msg.sender_id === user?.id
            const prevMsg = messages[i - 1]
            const nextMsg = messages[i + 1]
            const showSender = !prevMsg || prevMsg.sender_id !== msg.sender_id
            const lastInRun = !nextMsg || nextMsg.sender_id !== msg.sender_id
            const isOfficial = msg.profiles?.role === 'official'
            const showDaySeparator = !prevMsg || dayLabel(prevMsg.created_at) !== dayLabel(msg.created_at)
            const time = new Date(msg.created_at).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })

            return (
              <div key={msg.id}>
                {showDaySeparator && (
                  <div className="my-2 flex justify-center">
                    <span className="rounded-full border border-line bg-surface px-3 py-1 text-[11px] font-bold tracking-[0.06em] text-muted-foreground uppercase">
                      {dayLabel(msg.created_at)}
                    </span>
                  </div>
                )}

                {isMe ? (
                  <div className="flex flex-col items-end">
                    <p className="max-w-[78%] rounded-[16px] rounded-br-[6px] bg-[var(--brand-fill)] px-4 py-2.5 text-[15px] leading-[1.5] text-white break-words whitespace-pre-wrap">
                      {msg.message}
                    </p>
                    {lastInRun && <p className="mt-1 text-xs text-muted-foreground">{time}</p>}
                  </div>
                ) : (
                  <div className="flex items-end gap-2">
                    <span className="w-8 shrink-0">
                      {lastInRun && <Avatar name={msg.profiles?.full_name} src={msg.profiles?.avatar_url} size="sm" />}
                    </span>
                    <div className="flex min-w-0 max-w-[78%] flex-col items-start">
                      {showSender && (
                        <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                          {msg.profiles?.full_name || 'Unknown user'}
                          {isOfficial && <Tag tone="brand" className="h-[18px] px-1.5 text-[10px]">Official</Tag>}
                        </p>
                      )}
                      <p className="rounded-[16px] rounded-bl-[6px] border border-line bg-surface px-4 py-2.5 text-[15px] leading-[1.5] text-ink break-words whitespace-pre-wrap">
                        {msg.message}
                      </p>
                      {lastInRun && <p className="mt-1 text-xs text-muted-foreground">{time}</p>}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
      </main>

      {/* Composer */}
      <footer className="relative z-[2] border-t border-line bg-surface px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom,0px))]">
        <div className="mx-auto max-w-2xl">
          {ticket?.status !== 'closed' ? (
            <form onSubmit={sendMessage} className="flex gap-2">
              <label htmlFor="ticket-message" className="sr-only">Message</label>
              <input
                id="ticket-message"
                ref={inputRef}
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                maxLength={MAX_MESSAGE_LENGTH}
                placeholder="Write a message"
                className="h-11 min-w-0 flex-1 rounded-[10px] border border-transparent bg-track px-4 text-[15px] text-ink outline-none placeholder:text-muted-foreground focus:border-brand-strong focus:bg-surface"
              />
              <Button type="submit" size="icon" className="size-11" disabled={sending || !newMessage.trim()} aria-label="Send message">
                {sending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
              </Button>
            </form>
          ) : (
            <Notice tone="ok" title="This ticket is closed.">Open a new ticket if you need the barangay again.</Notice>
          )}
        </div>
      </footer>
    </div>
  )
}
