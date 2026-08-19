import { createAdminClient } from '@/lib/supabase-server'

/**
 * Per-user rate limiting for the routes that cost money.
 *
 * The counter lives in Postgres, not in this process. Both AI routes run on
 * Vercel, where each request lands in whatever serverless instance happens
 * to be warm — a Map in module scope is therefore per-instance and resets on
 * every cold start, so it counts some fraction of the real traffic and
 * enforces nothing. The route handlers used to rely on exactly that.
 *
 * record_ai_call() checks and records in a single statement, so two requests
 * arriving together cannot both read "under the limit" and both proceed.
 *
 * FAILS CLOSED. If the counter cannot be reached we refuse the call rather
 * than wave it through: the entire point is protecting a budget, and an
 * unreachable database means the rest of the app is down anyway.
 */
export const AI_LIMITS = {
  // A real conversation is a dozen questions; 40 an hour is generous and
  // still bounds the daily spend per account.
  'ai-chat': { limit: 40, windowSeconds: 3600, label: 'assistant messages' },
  // Sonnet over 30 days of incidents. Officials get a fresh report whenever
  // they need one, but not in a loop.
  'ai-analytics': { limit: 10, windowSeconds: 3600, label: 'analytics reports' },
}

/**
 * @returns {{ allowed: boolean, used: number, limit: number,
 *             retryAfterSeconds: number, message: string|null }}
 */
export async function consumeAiQuota(userId, route) {
  const config = AI_LIMITS[route]
  if (!config) throw new Error(`No rate limit configured for route: ${route}`)

  let row = null
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('record_ai_call', {
      p_user_id: userId,
      p_route: route,
      p_limit: config.limit,
      p_window_seconds: config.windowSeconds,
    })
    if (error) throw error
    row = Array.isArray(data) ? data[0] : data
  } catch (err) {
    console.error(`Rate limit check failed for ${route}:`, err)
    return {
      allowed: false,
      used: 0,
      limit: config.limit,
      retryAfterSeconds: 60,
      message: 'The service is temporarily unavailable. Please try again in a moment.',
    }
  }

  if (!row) {
    return {
      allowed: false, used: 0, limit: config.limit, retryAfterSeconds: 60,
      message: 'The service is temporarily unavailable. Please try again in a moment.',
    }
  }

  const resetsAt = row.resets_at ? new Date(row.resets_at).getTime() : Date.now() + config.windowSeconds * 1000
  const retryAfterSeconds = Math.max(1, Math.ceil((resetsAt - Date.now()) / 1000))

  if (!row.allowed) {
    const minutes = Math.ceil(retryAfterSeconds / 60)
    return {
      allowed: false,
      used: row.used ?? config.limit,
      limit: config.limit,
      retryAfterSeconds,
      message: `You have used all ${config.limit} ${config.label} for this hour. `
             + `Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
    }
  }

  return { allowed: true, used: row.used ?? 0, limit: config.limit, retryAfterSeconds, message: null }
}
