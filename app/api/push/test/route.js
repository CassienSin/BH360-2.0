import { createAdminClient, getAuthenticatedUser } from '@/lib/supabase-server'
import { recipientAllowed, testPushPayload, TEST_PUSH } from '@/lib/notificationTypes'
import { pushConfigured, sendToDevices } from '@/lib/pushSender'

/**
 * Settings → "Send test notification".
 *
 * Pushes one notification to the signed-in person's own devices, at high
 * urgency, so they can check that their phone shows notifications with the
 * app closed. It can reach nobody else: the recipient is the session's
 * user, never something in the request.
 *
 * A preview deployment keeps its usual limit (PUSH_ONLY_BARANGAY_IDS, and
 * nobody when that is unset), so it still never pushes outside the test
 * barangay.
 */

export const runtime = 'nodejs'

export async function POST() {
  if (!pushConfigured()) {
    return Response.json({ error: 'Push is not configured on this deployment.' }, { status: 503 })
  }

  const { user } = await getAuthenticatedUser()
  if (!user) return Response.json({ error: 'Sign in to send a test notification.' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('barangay_id, deactivated_at')
    .eq('id', user.id)
    .single()
  if (profileError || !profile) {
    console.error('push/test: could not load the profile:', profileError)
    return Response.json({ error: 'Could not load your account.' }, { status: 500 })
  }
  if (profile.deactivated_at) {
    return Response.json({ error: 'This account is deactivated.' }, { status: 403 })
  }
  if (!recipientAllowed(profile.barangay_id, process.env.PUSH_ONLY_BARANGAY_IDS, process.env.VERCEL_ENV)) {
    return Response.json({ error: "This test deployment doesn't send notifications to your barangay." }, { status: 403 })
  }

  const { data: subs, error: subsError } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', user.id)
  if (subsError) {
    console.error('push/test: could not load devices:', subsError)
    return Response.json({ error: 'Could not load your devices.' }, { status: 500 })
  }
  if (!subs?.length) return Response.json({ sent: 0, reason: 'No devices are registered for notifications yet.' })

  const result = await sendToDevices(admin, subs, testPushPayload(), TEST_PUSH)
  return Response.json(result)
}
