import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase-server'
import { pushAllowed, pushPayload, recipientAllowed } from '@/lib/notificationTypes'

/**
 * Sends one notification row to its recipient's devices as a Web Push.
 *
 * This is the piece that works with nobody's browser open. The database
 * calls it: one trigger on INSERT into `notifications` (Section 18 of
 * supabase/setup.sql) posts the new row here. The row already names its
 * recipient, so all this does is check their Settings and deliver.
 *
 * Payloads from the older per-table push triggers (incidents,
 * ticket_messages) are acknowledged and ignored: every event they covered
 * now arrives here as a notification row, so handling both would push the
 * same event twice while the old triggers still exist (they are removed by
 * supabase/cleanup-after-notifications.sql after the merge).
 *
 * Runs on Node, not Edge: web-push signs a VAPID JWT and encrypts the
 * payload with primitives the Edge runtime does not provide.
 */

export const runtime = 'nodejs'

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:barangayhub360@example.com'
const WEBHOOK_SECRET = process.env.PUSH_WEBHOOK_SECRET
// Set on a preview only: limits who it can push to. A preview without it
// pushes to nobody (see recipientAllowed).
const ONLY_BARANGAY_IDS = process.env.PUSH_ONLY_BARANGAY_IDS
const DEPLOYMENT = process.env.VERCEL_ENV

// The push service says the subscription is gone: unsubscribed, expired,
// or the app was uninstalled. Delete it rather than retry it forever.
const DEAD_ENDPOINT_CODES = new Set([404, 410])

function configured() {
  return Boolean(VAPID_PUBLIC && VAPID_PRIVATE && WEBHOOK_SECRET)
}

if (configured()) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
}

export async function POST(request) {
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

  let table, type, record
  try {
    const body = await request.json()
    table = body?.table
    type = body?.type
    record = body?.record
  } catch {
    return Response.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  if (table !== 'notifications' || type !== 'INSERT') {
    return Response.json({ sent: 0, ignored: true, reason: 'Only notification rows are pushed.' })
  }
  if (!record?.id || !record?.user_id) {
    return Response.json({ error: 'Body must include a notification row.' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: recipient, error: recipientError } = await admin
    .from('profiles')
    .select('barangay_id, notification_prefs, deactivated_at')
    .eq('id', record.user_id)
    .single()
  if (recipientError) {
    console.error('push/send: could not load the recipient:', recipientError)
    return Response.json({ error: 'Could not load the recipient.' }, { status: 500 })
  }
  if (!recipient || recipient.deactivated_at) {
    return Response.json({ sent: 0, reason: 'Recipient is not active.' })
  }
  if (!recipientAllowed(recipient.barangay_id, ONLY_BARANGAY_IDS, DEPLOYMENT)) {
    return Response.json({ sent: 0, reason: "This deployment does not push to this recipient's barangay." })
  }
  if (!pushAllowed(record.type, recipient.notification_prefs)) {
    return Response.json({ sent: 0, reason: 'Turned off in Settings.' })
  }

  const { data: subs, error: subsError } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', record.user_id)
  if (subsError) {
    console.error('push/send: could not load subscriptions:', subsError)
    return Response.json({ error: 'Could not load subscriptions.' }, { status: 500 })
  }
  if (!subs?.length) return Response.json({ sent: 0, reason: 'No devices registered.' })

  const payload = pushPayload(record)
  // Critical reports are worth retrying for a while; the rest are stale
  // within the hour and should not pile up on a phone that was off.
  const ttl = payload.priority === 'Critical' ? 3600 : 600

  const results = await Promise.allSettled(
    subs.map(sub => webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: ttl, urgency: payload.priority === 'Critical' ? 'high' : 'normal' }
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
