import { createAdminClient } from '@/lib/supabase-server'
import { pushAllowed, pushPayload, pushDelivery, recipientAllowed } from '@/lib/notificationTypes'
import { pushConfigured, sendToDevices } from '@/lib/pushSender'

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
 * How urgently each type is pushed, and for how long the push service
 * keeps trying, is per type: PUSH_DELIVERY in lib/notificationTypes.js.
 *
 * Runs on Node, not Edge (lib/pushSender.js says why).
 */

export const runtime = 'nodejs'

const WEBHOOK_SECRET = process.env.PUSH_WEBHOOK_SECRET
// Set on a preview only: limits who it can push to. A preview without it
// pushes to nobody (see recipientAllowed).
const ONLY_BARANGAY_IDS = process.env.PUSH_ONLY_BARANGAY_IDS
const DEPLOYMENT = process.env.VERCEL_ENV

function configured() {
  return Boolean(pushConfigured() && WEBHOOK_SECRET)
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

  const result = await sendToDevices(admin, subs, pushPayload(record), pushDelivery(record))
  return Response.json(result)
}
