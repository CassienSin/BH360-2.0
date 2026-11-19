'use client'
import { TicketDetailSkeleton } from '@/components/Skeletons'
import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { loginHref } from '@/lib/loginRedirect'
import { goBack } from '@/lib/goBack'
import { createClient } from '@/lib/supabase'
import { ChevronLeft, Send, CheckCircle, MoreHorizontal, Phone, Loader2, RotateCcw } from 'lucide-react'
import Band from '@/components/crafted/Band'
import PageShell from '@/components/crafted/PageShell'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Avatar } from '@/components/ui/avatar'
import { Notice } from '@/components/ui/notice'
import { Muted, SectionLabel } from '@/components/ui/text'
import toast from 'react-hot-toast'
import ConfirmDialog from '@/components/ConfirmDialog'
import { subscribeWhenSignedIn } from '@/lib/realtime'

const CATEGORY_CONFIG = {
  inquiry: { label: 'Inquiry' },
  request: { label: 'Request' },
  complaint: { label: 'Complaint' },
  feedback: { label: 'Feedback' },
}

const STATUS_CONFIG = {
  open: { label: 'Open' },
  in_progress: { label: 'In progress' },
  closed: { label: 'Closed' },
}

const MESSAGE_SELECT = '*, profiles(full_name, avatar_url, role)'
const MAX_MESSAGE_LENGTH = 1000

// One-tap canned responses — the phrases officials type constantly
const QUICK_REPLIES = [
  'Thank you for reaching out. We are looking into this now.',
  'Please visit the barangay hall during office hours (8AM–5PM) to process this.',
  'Please bring a valid ID and proof of residency.',
  'This has been resolved. Let us know if you need anything else.',
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
          router.replace(loginHref())
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
  const cat = CATEGORY_CONFIG[ticket?.category] || null
  const residentName = ticket?.profiles?.full_name || 'Unknown resident'
  const firstName = residentName.split(' ')[0]
  const opened = ticket ? new Date(ticket.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : ''

  // ---- Loading state ----
  if (pageLoading) return <TicketDetailSkeleton />

  // ---- Not found state ----
  if (notFound) {
    return (
      <PageShell title="Ticket" onBack={() => goBack(router, '/official?section=tickets')}>
        <Card className="px-[18px] py-5">
          <h2 className="text-[15px] font-extrabold text-ink">Ticket not found</h2>
          <Muted className="mt-1">It may have been deleted, or you may not have access to it.</Muted>
          <Button variant="secondary" className="mt-4" onClick={() => goBack(router, '/official?section=tickets')}>Back to tickets</Button>
        </Card>
      </PageShell>
    )
  }

  return (
    <div className="relative isolate flex h-dvh flex-col overflow-hidden bg-page">
      {/* Header on the band: the right pane's head (O04). */}
      <header className="relative px-4 pt-[max(16px,env(safe-area-inset-top,0px))] pb-3 text-white sm:px-7">
        <Band extend={0} fade={56} dots={10} seed={4} />
        <div className="relative z-[1] mx-auto flex max-w-3xl items-center gap-2.5">
          <IconButton kind="onband" label="Back to tickets" onClick={() => goBack(router, '/official?section=tickets')}>
            <ChevronLeft size={18} strokeWidth={1.9} />
          </IconButton>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[17px] font-extrabold sm:text-xl">{ticket?.title}</h1>
            <p className="truncate text-xs text-white/80 sm:text-[13px]">
              {[residentName, cat?.label, sc.label, `opened ${opened}`].filter(Boolean).join(' · ')}
            </p>
          </div>
          <IconButton kind="onband" label="Ticket details" aria-expanded={showDetails} onClick={() => setShowDetails(v => !v)}>
            <MoreHorizontal size={18} strokeWidth={1.9} />
          </IconButton>
          {ticket?.status !== 'closed' ? (
            <Button variant="white" onClick={() => setCloseConfirm(true)} aria-label="Close ticket">
              <CheckCircle aria-hidden="true" /><span className="hidden sm:inline">Close ticket</span>
            </Button>
          ) : (
            <Button variant="onband" onClick={reopenTicket}><RotateCcw aria-hidden="true" />Reopen</Button>
          )}
        </div>
      </header>

      {/* Details (collapsible): what they asked and who they are. */}
      {showDetails && ticket && (
        <div className="relative z-[2] mx-auto w-full max-w-3xl px-4 sm:px-7">
          <Card lift className="grid gap-3 px-[18px] py-3.5 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <div>
              <SectionLabel as="h2" className="mb-1">What they asked</SectionLabel>
              <p className="text-sm leading-[1.55] text-body whitespace-pre-wrap">{ticket.description}</p>
            </div>
            <div className="space-y-1 text-sm">
              <SectionLabel as="h2" className="mb-1">Resident</SectionLabel>
              <p className="font-bold text-ink">{residentName}</p>
              {ticket.profiles?.phone && (
                <a href={`tel:${ticket.profiles.phone}`} className="flex items-center gap-1.5 font-bold text-brand-strong hover:underline">
                  <Phone size={14} aria-hidden="true" />{ticket.profiles.phone}
                </a>
              )}
              {ticket.profiles?.address && <p className="text-body">{ticket.profiles.address}</p>}
            </div>
          </Card>
        </div>
      )}

      {/* Messages */}
      <main className="relative z-[1] flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 pt-2 pb-4 sm:px-7" role="log" aria-live="polite" aria-label="Ticket messages">
          {messages.length === 0 && (
            <Card className="mx-auto mt-8 max-w-xs px-5 py-4 text-center">
              <p className="text-sm font-bold text-ink">No messages yet</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Reply below to start helping {firstName}.</p>
            </Card>
          )}

          {messages.map((msg, i) => {
            const isMe = msg.sender_id === user?.id
            const prevMsg = messages[i - 1]
            const nextMsg = messages[i + 1]
            const showSender = !prevMsg || prevMsg.sender_id !== msg.sender_id
            const lastInRun = !nextMsg || nextMsg.sender_id !== msg.sender_id
            const isResident = msg.profiles?.role === 'resident'
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
                    {lastInRun && <p className="mt-1 text-xs text-muted-foreground">You · {time}</p>}
                  </div>
                ) : (
                  <div className="flex items-end gap-2">
                    <span className="w-8 shrink-0">
                      {lastInRun && <Avatar name={msg.profiles?.full_name} src={msg.profiles?.avatar_url} size="sm" />}
                    </span>
                    <div className="flex min-w-0 max-w-[78%] flex-col items-start">
                      {showSender && !isResident && (
                        <p className="mb-1 text-xs font-bold text-muted-foreground">{msg.profiles?.full_name || 'Unknown user'}</p>
                      )}
                      <p className="rounded-[16px] rounded-bl-[6px] border border-line bg-surface px-4 py-2.5 text-[15px] leading-[1.5] text-ink break-words whitespace-pre-wrap">
                        {msg.message}
                      </p>
                      {lastInRun && <p className="mt-1 text-xs text-muted-foreground">{msg.profiles?.full_name || 'Unknown user'} · {time}</p>}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
      </main>

      {/* Composer: quick replies, then the reply box */}
      <footer className="relative z-[2] border-t border-line bg-surface px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom,0px))] sm:px-7">
        <div className="mx-auto max-w-3xl">
          {ticket?.status !== 'closed' ? (
            <>
              {newMessage === '' && (
                <div className="mb-2.5 flex gap-2 overflow-x-auto rail-fade [scrollbar-width:none]!" role="group" aria-label="Quick replies">
                  {QUICK_REPLIES.map(reply => (
                    <button key={reply} type="button" onClick={() => applyQuickReply(reply)} title={reply}
                      className="h-8 max-w-[260px] shrink-0 truncate rounded-[9px] border border-line bg-surface px-3 text-[13px] font-bold text-brand-strong outline-none hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong">
                      {reply}
                    </button>
                  ))}
                </div>
              )}
              <form onSubmit={sendMessage} className="flex gap-2">
                <label htmlFor="ticket-reply" className="sr-only">Reply to {firstName}</label>
                <input
                  id="ticket-reply"
                  ref={inputRef}
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  maxLength={MAX_MESSAGE_LENGTH}
                  placeholder={`Reply to ${firstName}`}
                  className="h-11 min-w-0 flex-1 rounded-[10px] border border-line bg-surface px-4 text-[15px] text-ink outline-none placeholder:text-muted-foreground focus:border-brand-strong"
                />
                <Button type="submit" className="h-11" disabled={sending || !newMessage.trim()} aria-label="Send message">
                  {sending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
                  <span className="hidden sm:inline">Send</span>
                </Button>
              </form>
            </>
          ) : (
            <Notice tone="ok" title="This ticket is closed.">Reopen it from the top if {firstName} needs more help.</Notice>
          )}
        </div>
      </footer>

      {/* Confirm Close Dialog */}
      <ConfirmDialog
        open={closeConfirm}
        onClose={() => setCloseConfirm(false)}
        onConfirm={closeTicket}
        title="Close this ticket?"
        message={`${firstName} won't be able to send more messages on it. You can reopen it later.`}
        confirmText={closing ? 'Closing…' : 'Close ticket'}
        cancelText="Keep open"
        variant="danger"
      />
    </div>
  )
}
