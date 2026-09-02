'use client'
import { OUTBOX, put, all, del } from '@/lib/offline/db'

/**
 * Actions taken with no signal, held until there is some.
 *
 * A tanod in the field is exactly the person who loses signal, and until
 * now tapping "I'm on my way" with no bars produced an error toast and lost
 * the action entirely. The same for a resident filing a report from a dead
 * spot.
 *
 * The queue is deliberately dumb: an ordered list of {kind, payload} that a
 * handler knows how to replay. The logic worth testing — what replays, in
 * what order, and what happens when one fails — is separated from
 * IndexedDB so it can be tested against a plain array.
 */

/** What the queue knows how to replay. Anything else is refused up front. */
export const KINDS = {
  ACKNOWLEDGE: 'incident.acknowledge',
  ARRIVE: 'incident.arrive',
  RESOLVE: 'incident.resolve',
  DUTY: 'profile.duty',
  REPORT: 'incident.report',
}

const KIND_VALUES = new Set(Object.values(KINDS))

/** Human wording for the banner, so it says what is waiting. */
export const KIND_LABEL = {
  [KINDS.ACKNOWLEDGE]: 'an acknowledgement',
  [KINDS.ARRIVE]: 'an arrival',
  [KINDS.RESOLVE]: 'a resolution',
  [KINDS.DUTY]: 'a duty change',
  [KINDS.REPORT]: 'an incident report',
}

export function describe(items = []) {
  if (items.length === 0) return null
  if (items.length === 1) return KIND_LABEL[items[0].kind] || 'an action'
  return `${items.length} actions`
}

export async function enqueue(kind, payload, { userId } = {}) {
  if (!KIND_VALUES.has(kind)) throw new Error(`Unknown outbox kind: ${kind}`)
  const item = { kind, payload, userId, queuedAt: new Date().toISOString() }
  const saved = await put(OUTBOX, item)
  // put() returns null when storage refused. The caller must know, because
  // "we saved it for later" would then be a lie.
  return saved == null ? null : item
}

/** Oldest first — the order they were taken is the order they replay. */
export async function pending(userId) {
  const rows = await all(OUTBOX)
  return rows
    .filter(row => !userId || !row.userId || row.userId === userId)
    .sort((a, b) => a.id - b.id)
}

/**
 * Replay everything waiting.
 *
 * Stops at the first failure rather than pushing past it: the queue is
 * ordered, and an arrival that lands before its own acknowledgement tells
 * the barangay a story that did not happen. A failure leaves that item and
 * everything after it in place for the next attempt.
 *
 * `handlers[kind]` returns { ok } or { ok: false, permanent } — a permanent
 * failure (the incident was deleted, the row is gone) is dropped rather
 * than retried forever.
 */
export async function drain(handlers, { userId } = {}) {
  const items = await pending(userId)
  const result = { sent: 0, dropped: 0, failed: 0, remaining: items.length }

  for (const item of items) {
    const handler = handlers[item.kind]
    if (!handler) {
      // Nothing can ever replay this — a build that no longer knows the
      // kind. Keeping it would block the queue forever.
      await del(OUTBOX, item.id)
      result.dropped += 1
      result.remaining -= 1
      continue
    }

    let outcome
    try {
      outcome = await handler(item.payload, item)
    } catch {
      outcome = { ok: false }
    }

    if (outcome?.ok) {
      await del(OUTBOX, item.id)
      result.sent += 1
      result.remaining -= 1
      continue
    }
    if (outcome?.permanent) {
      await del(OUTBOX, item.id)
      result.dropped += 1
      result.remaining -= 1
      continue
    }

    result.failed += 1
    break
  }

  return result
}

export async function forget(id) {
  await del(OUTBOX, id)
}
