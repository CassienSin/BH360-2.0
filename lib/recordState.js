/**
 * Whether a record is still live, and what colour that makes it.
 *
 * The card designs turn on one question — is this still going? A live
 * record gets the full card, a progress tracker and the top of the list; a
 * finished one collapses to a row, because its journey is over and the only
 * thing left to do with it is find it again.
 *
 * Four different lists ask that question of four different vocabularies
 * (incidents say resolved, tickets say closed, documents say released,
 * blotter cases say settled), so it is answered in one place.
 */

// Anything not listed here is treated as live. Erring that way means a
// status nobody anticipated shows up as a full card at the top of the list
// rather than being quietly filed away as finished.
const SETTLED = new Set([
  'resolved', 'closed',            // incidents, tickets
  'released', 'denied',            // document requests
  'settled', 'certified', 'withdrawn', 'dismissed', // blotter / KP
])

// Statuses that mean somebody has picked it up, as opposed to it still
// sitting in a queue.
const IN_HAND = new Set([
  'assigned', 'in_progress', 'processing', 'ready',
  'mediation', 'conciliation', 'pangkat', 'summoned',
])

export function isSettled(status) {
  return SETTLED.has(String(status || '').toLowerCase())
}

/**
 * amber = waiting on the barangay, blue = someone is on it,
 * emerald = done. The rail, and nothing else, carries this.
 */
export function toneFor(status, { breached = false } = {}) {
  const s = String(status || '').toLowerCase()
  if (breached && !isSettled(s)) return 'overdue'
  if (isSettled(s)) return s === 'denied' ? 'closed' : 'done'
  if (IN_HAND.has(s)) return 'active'
  return 'waiting'
}

export const TONE_RAIL = {
  waiting: '#f59e0b',
  active: '#3b82f6',
  done: '#10b981',
  closed: '#9ca3af',
  overdue: '#dc2626',
}

/**
 * Split a list into what is still going and what is finished, keeping each
 * side in the order it arrived. The two groups are rendered under their own
 * headings — without that the two card shapes read as inconsistency rather
 * than as a distinction.
 */
export function partitionByLiveness(items, isDone = item => isSettled(item?.status)) {
  const live = []
  const done = []
  for (const item of items || []) {
    (isDone(item) ? done : live).push(item)
  }
  return { live, done }
}

/**
 * The three points every one of these lists passes through, whatever it
 * calls them. `at` is 0, 1 or 2 — how far this record has come.
 */
export function progressOf(status) {
  const s = String(status || '').toLowerCase()
  if (isSettled(s)) return 2
  if (IN_HAND.has(s)) return 1
  return 0
}
