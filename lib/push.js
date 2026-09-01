'use client'
import { createClient } from '@/lib/supabase'

/**
 * Web Push subscriptions — the part that makes a notification arrive when
 * BH360 is closed.
 *
 * lib/notifications.js shows notifications from inside a Supabase Realtime
 * callback, so it needs a page open to work at all. This registers a durable
 * endpoint with the browser's own push service instead, which the service
 * worker receives with no page running.
 *
 * ONE ROW PER DEVICE. A tanod with a phone and a desk browser has two
 * subscriptions and both should ring. The endpoint is the identity — the
 * same device re-subscribing gets the same endpoint back, so an upsert on it
 * keeps repeated permission grants from piling up duplicates.
 *
 * PLATFORMS. Android Chrome and desktop Chrome/Edge/Firefox work in a normal
 * tab. iOS Safari supports Web Push only for a PWA the user has added to the
 * Home Screen (16.4+), so `pushSupport()` reports that case separately —
 * telling an iPhone user "notifications are unsupported" when the real answer
 * is "install the app first" is a dead end they cannot get out of.
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

/** The VAPID key is base64url text; PushManager wants raw bytes. */
export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output
}

/** Is this browser running as an installed PWA rather than a tab? */
function isStandalone() {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(display-mode: standalone)').matches
    || window.navigator.standalone === true
}

function isIOS() {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/**
 * @returns {{ supported: boolean, reason: string|null, needsInstall: boolean }}
 */
export function pushSupport() {
  if (typeof window === 'undefined') {
    return { supported: false, reason: null, needsInstall: false }
  }
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    // On iOS this is what a Safari TAB reports; the same device works once
    // the app is on the Home Screen.
    if (isIOS() && !isStandalone()) {
      return {
        supported: false,
        needsInstall: true,
        reason: 'On iPhone and iPad, background notifications need BarangayHub added to your Home Screen first.',
      }
    }
    return {
      supported: false,
      needsInstall: false,
      reason: 'This browser cannot receive background notifications.',
    }
  }
  if (!VAPID_PUBLIC_KEY) {
    return {
      supported: false,
      needsInstall: false,
      reason: 'Background notifications are not configured on this deployment.',
    }
  }
  return { supported: true, reason: null, needsInstall: false }
}

/** The subscription for THIS device, if there is one. */
export async function getSubscription() {
  if (!pushSupport().supported) return null
  const registration = await navigator.serviceWorker.ready
  return registration.pushManager.getSubscription()
}

export async function isSubscribed() {
  return Boolean(await getSubscription())
}

/**
 * Subscribe this device and record it. Assumes notification permission has
 * already been granted — requesting it is NotificationBanner's job, because
 * a permission prompt should follow a click the person made on purpose.
 *
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function subscribeToPush() {
  const support = pushSupport()
  if (!support.supported) return { ok: false, error: support.reason }

  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'You need to be signed in.' }

    const registration = await navigator.serviceWorker.ready

    // Reuse the existing endpoint when there is one; re-subscribing would
    // hand back the same value anyway.
    const subscription = await registration.pushManager.getSubscription()
      || await registration.pushManager.subscribe({
        // Required, and enforced: every push must show something. The
        // service worker's push handler always calls showNotification().
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

    const json = subscription.toJSON()
    if (!json.keys?.p256dh || !json.keys?.auth) {
      return { ok: false, error: 'This browser returned an unusable subscription.' }
    }

    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id: user.id,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_agent: navigator.userAgent.slice(0, 500),
      failure_count: 0,
    }, { onConflict: 'endpoint' })

    if (error) {
      console.error('Could not save the push subscription:', error)
      return { ok: false, error: 'Could not register this device. Please try again.' }
    }
    return { ok: true }
  } catch (err) {
    console.error('subscribeToPush failed:', err)
    return { ok: false, error: 'Could not turn on background notifications.' }
  }
}

/** Turn them off for this device only — other devices keep working. */
export async function unsubscribeFromPush() {
  try {
    const subscription = await getSubscription()
    if (!subscription) return { ok: true }

    const endpoint = subscription.endpoint
    await subscription.unsubscribe()

    const supabase = createClient()
    const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
    if (error) console.error('Could not remove the stored subscription:', error)
    return { ok: true }
  } catch (err) {
    console.error('unsubscribeFromPush failed:', err)
    return { ok: false, error: 'Could not turn off background notifications.' }
  }
}

/**
 * The push service can rotate a subscription on its own; sw.js posts a
 * message when that happens so the page can re-register the new endpoint.
 * Without this the stored endpoint quietly goes dead.
 */
export function watchForSubscriptionChange() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return () => {}
  const onMessage = (event) => {
    if (event.data?.type === 'PUSH_SUBSCRIPTION_CHANGED') {
      subscribeToPush().catch(err => console.error('Re-subscribe failed:', err))
    }
  }
  navigator.serviceWorker.addEventListener('message', onMessage)
  return () => navigator.serviceWorker.removeEventListener('message', onMessage)
}
