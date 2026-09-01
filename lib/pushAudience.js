import { getPriority, getCategoryMeta } from '@/lib/legalBasis'

/**
 * Who a push goes to, and what it says.
 *
 * Pure on purpose: the route does the database reads, these decide. Getting
 * the audience wrong is the expensive kind of bug — sending a resident
 * somebody else's ticket, or pushing people their own messages back — so
 * the rules are worth testing without standing up Supabase.
 */

/** A new incident: the barangay's officials and tanods. */
export function incidentNotification(incident) {
  const meta = getCategoryMeta(incident.category)
  const priority = incident.priority || getPriority(incident.category)
  const label = meta.label || incident.category || 'Incident'

  return {
    title: priority === 'Critical' ? `Critical · ${label}` : `New report · ${label}`,
    body: [incident.title, incident.location].filter(Boolean).join(' — '),
    priority,
    tag: `incident-${incident.id}`,
    url: `/official/incident/${incident.id}`,
    timestamp: incident.created_at,
  }
}

/**
 * A ticket reply goes to the OTHER side of that conversation: a resident
 * writing reaches the barangay's officials, an official writing reaches the
 * resident who opened the ticket.
 *
 * The sender is always dropped. A notification for your own message is
 * noise, and on a second device of your own it is worse than noise.
 */
export function ticketReplyAudience({ ticket, message, sender, officialIds = [] }) {
  const fromCreator = message.sender_id === ticket.created_by

  const recipients = fromCreator
    ? officialIds
    : (ticket.created_by ? [ticket.created_by] : [])

  const name = sender?.full_name
    || (sender?.role === 'official' ? 'The barangay' : 'A resident')

  return {
    userIds: [...new Set(recipients)].filter(id => id && id !== message.sender_id),
    notification: {
      title: `${name} replied`,
      body: [ticket.title, message.message].filter(Boolean).join('\n'),
      priority: 'Normal',
      // One tag per ticket, so a burst of replies collapses into the latest
      // rather than stacking a dozen entries on someone's lock screen.
      tag: `ticket-${ticket.id}`,
      url: `${sender?.role === 'official' ? '/resident' : '/official'}/ticket/${ticket.id}`,
      timestamp: message.created_at,
    },
  }
}
