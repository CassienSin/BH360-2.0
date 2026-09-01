'use client'
import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { notify } from '@/components/Toast'
import { showNotification } from '@/lib/notifications'

/**
 * Tells you when the other party replies on a support ticket.
 *
 * The ticket detail pages already subscribe to their own conversation, so
 * chat is live once you have that ticket open. Nothing watched from the
 * dashboard, though, so a reply arriving while you were anywhere else in
 * the app was silent — the resident who filed the ticket had to think to go
 * back and look.
 *
 * No realtime filter here on purpose. Postgres-changes filters only compare
 * a column on the row itself, and "messages on tickets I am part of" is a
 * join. RLS already answers exactly that question — the read policy scopes
 * ticket_messages to the ticket's author and the officials of its barangay
 * — and realtime enforces it per subscriber, so an unfiltered subscription
 * delivers each person precisely their own conversations and nothing else.
 *
 * Returns the replies seen this session so a dashboard can list them in the
 * notification bell alongside everything else.
 */

const MAX_TRACKED = 20

export function useTicketMessageAlerts({ profile, ticketHref, onOpen, enabled = true }) {
  const supabase = useMemo(() => createClient(), [])
  const [messages, setMessages] = useState([])

  const clearForTicket = useCallback((ticketId) => {
    setMessages(prev => prev.filter(m => m.data?.ticket_id !== ticketId))
  }, [])

  useEffect(() => {
    const userId = profile?.id
    if (!enabled || !userId) return

    const channel = supabase
      .channel(`ticket-messages-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'ticket_messages',
      }, async (payload) => {
        const row = payload.new
        // Your own message coming back to you is not news.
        if (!row || row.sender_id === userId) return

        // The realtime payload carries ids, not names. One small read turns
        // "someone replied" into "Kap. Reyes replied on Streetlight out".
        const { data, error } = await supabase
          .from('ticket_messages')
          .select('id, message, created_at, ticket_id, sender_id, profiles(full_name, role), tickets(title)')
          .eq('id', row.id)
          .single()

        if (error) {
          console.error('Could not load the new ticket message:', error)
          return
        }

        const sender = data.profiles?.full_name || 'Someone'
        const ticketTitle = data.tickets?.title || 'your ticket'
        const href = ticketHref(data.ticket_id)

        setMessages(prev => {
          if (prev.some(m => m.id === data.id)) return prev
          return [{
            id: data.id,
            type: 'ticket-message',
            icon: '💬',
            color: '#f0effe',
            title: `${sender} replied`,
            subtitle: `${ticketTitle} — ${data.message.slice(0, 60)}${data.message.length > 60 ? '…' : ''}`,
            created_at: data.created_at,
            data,
          }, ...prev].slice(0, MAX_TRACKED)
        })

        notify.info({
          kind: 'New reply',
          title: `${sender} replied`,
          body: data.message.slice(0, 90) + (data.message.length > 90 ? '…' : ''),
          id: `ticket-message-${data.id}`,
          action: { label: 'Open', onClick: () => onOpen(data.ticket_id) },
        })

        // Reaches them with the tab in the background, which the toast
        // cannot. showNotification declines when the tab is already in
        // front, so the two do not double up.
        showNotification(`💬 ${sender} replied`, {
          body: `${ticketTitle}\n${data.message.slice(0, 120)}`,
          tag: `ticket-${data.ticket_id}`,
          data: { url: href },
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile?.id, enabled, supabase, ticketHref, onOpen])

  return { messages, clearForTicket }
}
