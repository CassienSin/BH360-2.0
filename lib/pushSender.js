import webpush from 'web-push'

/**
 * Sending Web Push from the server: VAPID setup, delivery to one person's
 * devices, and removing devices the push service says are gone. Used by
 * /api/push/send (notification rows) and /api/push/test (Settings).
 *
 * Server only: it reads the private VAPID key. Runs on Node, not Edge:
 * web-push signs a VAPID JWT and encrypts the payload with primitives the
 * Edge runtime does not provide.
 */

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:barangayhub360@example.com'

// The push service says the subscription is gone: unsubscribed, expired,
// or the app was uninstalled. Delete it rather than retry it forever.
const DEAD_ENDPOINT_CODES = new Set([404, 410])

let vapidReady = false

export function pushConfigured() {
  return Boolean(VAPID_PUBLIC && VAPID_PRIVATE)
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} admin  service-role client
 * @param {{ id: string, endpoint: string, p256dh: string, auth: string }[]} subs
 * @param {object} payload  what the service worker shows (title, body, url, tag…)
 * @param {{ urgency: 'high'|'normal', ttl: number }} delivery
 * @returns {Promise<{ sent: number, failed: number, removed: number }>}
 */
export async function sendToDevices(admin, subs, payload, { urgency, ttl }) {
  if (!vapidReady) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
    vapidReady = true
  }

  const results = await Promise.allSettled(
    subs.map(sub => webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: ttl, urgency }
    ))
  )

  const dead = []
  let sent = 0
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') { sent += 1; return }
    const status = result.reason?.statusCode
    if (DEAD_ENDPOINT_CODES.has(status)) dead.push(subs[i].id)
    else console.error('push: delivery failed', status, result.reason?.body || result.reason?.message)
  })

  if (dead.length) {
    const { error } = await admin.from('push_subscriptions').delete().in('id', dead)
    if (error) console.error('push: could not clear dead endpoints:', error)
  }

  return { sent, failed: results.length - sent, removed: dead.length }
}
