import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase-server'
import { incidentNotification, ticketReplyAudience } from '@/lib/pushAudience'

/**
 * Sends a Web Push for a new incident.
 *
 * This is the piece that works with nobody's browser open. It is called on
 * INSERT into `incidents` by a database trigger (Section 16 of
 * supabase/setup.sql, or an equivalent Supabase Database Webhook), so the
 * caller is the database itself rather than any page.
 *
 * Runs on Node, not Edge: web-push signs a VAPID JWT and encrypts the
 * payload with primitives the Edge runtime does not provide.
 */
export const runtime = 'nodejs'

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:barangayhub360@example.com'
const WEBHOOK_SECRET = process.env.PUSH_WEBHOOK_SECRET

// Endpoints that answer with these are gone for good — the browser was
// uninstalled, the profile wiped, permission revoked. Deleting them keeps
// the table from filling with addresses nothing will ever reach.
const DEAD_ENDPOINT_CODES = new Set([404, 410])

function configured() {
  return Boolean(VAPID_PUBLIC && VAPID_PRIVATE && WEBHOOK_SECRET)
}

if (configured()) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
}

/**
 * Who hears about a new incident: the officials and tanods of that
 * barangay. Residents are not pushed other people's incidents — they only
 * ever hear about their own reports, which realtime already covers while
 * they are looking.
 */
async function forIncident(admin, incident) {
  if (!incident.barangay_id) {
    return { error: 'Body must include an incident with id and barangay_id.' }
  }

  const { data: staff, error } = await admin
    .from('profiles')
    .select('id')
    .eq('barangay_id', incident.barangay_id)
    .in('role', ['official', 'tanod'])
    .is('deactivated_at', null)

  if (error) return { error: 'Could not determine recipients.', cause: error }
  return {
    userIds: (staff || []).map(s => s.id),
    notification: incidentNotification(incident),
  }
}

/** Who hears about a ticket reply: the other side of that conversation. */
async function forTicketMessage(admin, message) {
  if (!message.ticket_id) {
    return { error: 'Body must include a ticket message with id and ticket_id.' }
  }

  const { data: ticket, error: ticketError } = await admin
    .from('tickets')
    .select('id, title, created_by, barangay_id')
    .eq('id', message.ticket_id)
    .single()

  if (ticketError) return { error: 'Could not load the ticket.', cause: ticketError }

  let officialIds = []
  if (message.sender_id === ticket.created_by) {
    const { data: officials, error } = await admin
      .from('profiles')
      .select('id')
      .eq('barangay_id', ticket.barangay_id)
      .eq('role', 'official')
      .is('deactivated_at', null)
    if (error) return { error: 'Could not determine recipients.', cause: error }
    officialIds = (officials || []).map(o => o.id)
  }

  const { data: sender } = await admin
    .from('profiles')
    .select('full_name, role')
    .eq('id', message.sender_id)
    .single()

  return ticketReplyAudience({ ticket, message, sender, officialIds })
}

// Which table a webhook fired on decides who hears about it.
const RESOLVERS = {
  incidents: forIncident,
  ticket_messages: forTicketMessage,
}

export async function POST(request) {
  // A missing secret must not mean "anyone may fire pushes at every device
  // in the barangay", so this refuses rather than defaulting open.
  if (!configured()) {
    console.error(
      '[config] /api/push/send is disabled: NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY ' +
      'and PUSH_WEBHOOK_SECRET must all be set. Generate keys with `npx web-push generate-vapid-keys`.'
    )
    return Response.json({ error: 'Push is not configured on this deployment.' }, { status: 503 })
  }

  if (request.headers.get('x-push-secret') !== WEBHOOK_SECRET) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  let table, record
  try {
    const body = await request.json()
    // Supabase database webhooks post { type, table, record, old_record }.
    // The SQL trigger in Section 16 of setup.sql sends the same shape.
    record = body?.record || body?.incident || body
    table = body?.table || 'incidents'
  } catch {
    return Response.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  if (!record?.id) {
    return Response.json({ error: 'Body must include a record with an id.' }, { status: 400 })
  }

  const admin = createAdminClient()

  const resolver = RESOLVERS[table]
  if (!resolver) {
    // A webhook pointed at a table nothing here knows how to address. Say
    // so plainly rather than silently sending nobody anything.
    return Response.json({ error: `No push is defined for table "${table}".` }, { status: 400 })
  }

  const { userIds, notification, error, cause } = await resolver(admin, record)
  if (error) {
    if (cause) console.error('push/send:', error, cause)
    return Response.json({ error }, { status: cause ? 500 : 400 })
  }
  if (!userIds.length) return Response.json({ sent: 0, reason: 'Nobody to notify.' })

  const { data: subs, error: subsError } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', userIds)

  if (subsError) {
    console.error('push/send: could not load subscriptions:', subsError)
    return Response.json({ error: 'Could not load subscriptions.' }, { status: 500 })
  }
  if (!subs?.length) return Response.json({ sent: 0, reason: 'No devices registered.' })

  const payload = JSON.stringify(notification)
  // Critical reports are worth retrying for a while; the rest are stale
  // within the hour and should not pile up on a phone that was off.
  const ttl = notification.priority === 'Critical' ? 3600 : 600

  const results = await Promise.allSettled(
    subs.map(sub => webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload,
      { TTL: ttl, urgency: 'high' }
    ))
  )

  const dead = []
  let sent = 0
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') { sent += 1; return }
    const status = result.reason?.statusCode
    if (DEAD_ENDPOINT_CODES.has(status)) dead.push(subs[i].id)
    else console.error('push/send: delivery failed', status, result.reason?.body || result.reason?.message)
  })

  if (dead.length) {
    const { error } = await admin.from('push_subscriptions').delete().in('id', dead)
    if (error) console.error('push/send: could not clear dead endpoints:', error)
  }

  return Response.json({ sent, failed: results.length - sent, removed: dead.length })
}
