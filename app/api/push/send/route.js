import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase-server'
import { getPriority, getCategoryMeta } from '@/lib/legalBasis'

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

/** Who should hear about this incident, and what the notification says. */
function buildNotification(incident) {
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

  let incident
  try {
    const body = await request.json()
    // Supabase database webhooks post { type, table, record, old_record }.
    incident = body?.record || body?.incident || body
  } catch {
    return Response.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  if (!incident?.id || !incident?.barangay_id) {
    return Response.json({ error: 'Body must include an incident with id and barangay_id.' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Who gets told: the officials and tanods of that barangay. Residents are
  // not pushed other people's incidents — they only ever hear about their
  // own reports, which realtime already covers while they are looking.
  const { data: staff, error: staffError } = await admin
    .from('profiles')
    .select('id')
    .eq('barangay_id', incident.barangay_id)
    .in('role', ['official', 'tanod'])
    .is('deactivated_at', null)

  if (staffError) {
    console.error('push/send: could not load barangay staff:', staffError)
    return Response.json({ error: 'Could not determine recipients.' }, { status: 500 })
  }
  if (!staff?.length) return Response.json({ sent: 0, reason: 'No staff in this barangay.' })

  const { data: subs, error: subsError } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', staff.map(s => s.id))

  if (subsError) {
    console.error('push/send: could not load subscriptions:', subsError)
    return Response.json({ error: 'Could not load subscriptions.' }, { status: 500 })
  }
  if (!subs?.length) return Response.json({ sent: 0, reason: 'No devices registered.' })

  const payload = JSON.stringify(buildNotification(incident))

  const results = await Promise.allSettled(
    subs.map(sub => webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload,
      // Critical reports are worth retrying for a while; the rest are stale
      // within the hour and should not pile up on a phone that was off.
      { TTL: buildNotification(incident).priority === 'Critical' ? 3600 : 600, urgency: 'high' }
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
