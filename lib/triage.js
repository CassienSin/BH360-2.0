/**
 * Queue aging (triage standing).
 *
 * An incident's PRIORITY is a fact about what it is — assigned from the
 * category via lib/legalBasis.js, and never changed by the passage of time.
 * A noise complaint is still a noise complaint four days later.
 *
 * Its STANDING is different: it reflects how long the barangay has left it
 * unattended. Without aging, a low-priority report can sit behind every
 * newer item indefinitely — the queue quietly becomes a place where small
 * problems go to be forgotten.
 *
 * So: standing rises with neglect, the priority label does not move, and
 * nothing can age its way into the Critical band. Critical means "threat to
 * life" — that is a classification, not a queue position.
 *
 *   score = base band + overdue boost (capped below the Critical band)
 *
 * Only PENDING incidents age. Once a tanod is dispatched, the barangay has
 * responded; resolution time is a separate concern.
 */

// Expected time to first response, per priority. These are the barangay's
// own service targets, not legal deadlines — tune them per LGU if needed.
export const RESPONSE_WINDOW_MS = {
  Critical: 15 * 60 * 1000,          // 15 minutes
  High: 4 * 60 * 60 * 1000,          // 4 hours
  Medium: 24 * 60 * 60 * 1000,       // 1 day
  Low: 72 * 60 * 60 * 1000,          // 3 days
}

// Band floors. 100 apart so aging can lift an item above a fresher item of
// the next band up, while CRITICAL_BAND stays unreachable by aging alone.
const BAND = { Low: 100, Medium: 200, High: 300, Critical: 400 }
const MAX_AGED_SCORE = BAND.Critical - 1   // 399 — the ceiling for aging

// How many multiples of its response window an incident must sit before it
// reaches maximum standing.
const FULL_BOOST_AT = 4

/**
 * Standing for a single incident.
 * @returns {{ score:number, overdueRatio:number, level:0|1|2|3, aged:boolean, label:string|null }}
 */
export function computeStanding(incident, now = Date.now()) {
  const priority = incident?.priority || 'Medium'
  const base = BAND[priority] ?? BAND.Medium

  // Only unattended reports age. Assigned means someone is on it.
  if (incident?.status !== 'pending') {
    return { score: base, overdueRatio: 0, level: 0, aged: false, label: null }
  }

  const window = RESPONSE_WINDOW_MS[priority] ?? RESPONSE_WINDOW_MS.Medium
  const age = now - new Date(incident.created_at).getTime()
  const overdueRatio = age / window

  // Not yet past its response window — no boost.
  if (overdueRatio <= 1) {
    return { score: base, overdueRatio, level: 0, aged: false, label: null }
  }

  // Ramp from 0 to a full band-and-a-half as it goes from 1x to 4x overdue.
  const progress = Math.min((overdueRatio - 1) / (FULL_BOOST_AT - 1), 1)
  const boost = Math.round(progress * 150)
  const score = Math.min(base + boost, MAX_AGED_SCORE)

  // Three visible steps so the UI can say something meaningful rather than
  // exposing a raw number nobody can interpret.
  const level = overdueRatio >= 3 ? 3 : overdueRatio >= 2 ? 2 : 1
  const label = level === 3 ? 'Long overdue'
    : level === 2 ? 'Overdue'
    : 'Past response time'

  return { score, overdueRatio, level, aged: true, label }
}

/** Styling for the standing badge — deliberately amber/orange, never red. */
export const STANDING_STYLE = {
  1: { bg: '#fffbeb', color: '#b45309', border: '#fef3c7' },
  2: { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
  3: { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
}

/**
 * Human-readable target, e.g. "Response target: 1 day".
 * Used in tooltips so the badge doesn't feel arbitrary.
 */
export function responseWindowLabel(priority) {
  const ms = RESPONSE_WINDOW_MS[priority] ?? RESPONSE_WINDOW_MS.Medium
  const hours = ms / 3600000
  if (hours < 1) return `${Math.round(ms / 60000)} minutes`
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`
  const days = hours / 24
  return `${days} day${days === 1 ? '' : 's'}`
}

/** Sort comparator: highest standing first, then oldest first. */
export function byStanding(a, b, now = Date.now()) {
  const diff = computeStanding(b, now).score - computeStanding(a, now).score
  if (diff !== 0) return diff
  return new Date(a.created_at) - new Date(b.created_at)
}