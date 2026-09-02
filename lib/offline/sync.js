'use client'
import { createClient } from '@/lib/supabase'
import { KINDS, drain, enqueue as enqueueItem } from '@/lib/offline/outbox'

/**
 * Replaying the queue, and telling the UI when it changed.
 *
 * The drain runs here in the page rather than in the service worker. A
 * Background Sync event fires with no Supabase session, so replaying there
 * would mean the worker holding credentials of its own. Not worth it for
 * this: the queue empties the next time someone opens the app with signal,
 * which for a tanod is the same moment they would look anyway.
 */

const listeners = new Set()

export function onOutboxChange(fn) {
  listeners.add(fn)
  // Read once on subscribe, so a caller does not need a second effect that
  // sets state in its own body just to get the starting count.
  try { fn() } catch { /* a bad listener must not break subscribing */ }
  return () => listeners.delete(fn)
}

function announce() {
  for (const fn of listeners) {
    try { fn() } catch { /* one listener must not stop the rest */ }
  }
}

/** Enqueue and tell the banner, so the count is never stale. */
export async function enqueue(kind, payload, opts) {
  const saved = await enqueueItem(kind, payload, opts)
  announce()
  return saved
}

// PostgREST codes that mean this will never succeed, however many times it
// is retried: the row is gone, or the person may not write it.
const PERMANENT = new Set(['23503', '42501', 'PGRST116'])

const permanentOr = (error) => ({
  ok: false,
  permanent: PERMANENT.has(error?.code),
})

function handlers(supabase) {
  const stamp = field => async (payload) => {
    const update = { [field]: new Date().toISOString() }
    // What the device believed the time was when the tanod actually tapped.
    // The database keeps its own clock for acknowledged_at and only accepts
    // this as an annotation — see stamp_incident_response().
    if (field === 'acknowledged_at' && payload.queuedAt) {
      update.acknowledged_offline_at = payload.queuedAt
    }
    const { error } = await supabase.from('incidents').update(update).eq('id', payload.id)
    return error ? permanentOr(error) : { ok: true }
  }

  return {
    [KINDS.ACKNOWLEDGE]: stamp('acknowledged_at'),
    [KINDS.ARRIVE]: stamp('arrived_at'),

    [KINDS.RESOLVE]: async (payload) => {
      const { error } = await supabase.from('incidents').update({
        status: 'resolved',
        resolution_notes: payload.notes,
        resolution_image_url: payload.imageUrl ?? null,
        resolved_at: payload.resolvedAt,
      }).eq('id', payload.id)
      return error ? permanentOr(error) : { ok: true }
    },

    [KINDS.DUTY]: async (payload) => {
      const { error } = await supabase.from('profiles')
        .update({ on_duty: payload.onDuty })
        .eq('id', payload.userId)
      return error ? permanentOr(error) : { ok: true }
    },

    [KINDS.REPORT]: async (payload) => {
      // The id was generated when the report was written, so a replay that
      // already landed conflicts instead of filing the same fire twice.
      const { error } = await supabase.from('incidents')
        .upsert(payload.row, { onConflict: 'id', ignoreDuplicates: true })
      return error ? permanentOr(error) : { ok: true }
    },
  }
}

export async function drainOutbox(userId) {
  const supabase = createClient()
  const result = await drain(handlers(supabase), { userId })
  announce()
  return result
}
