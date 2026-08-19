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
 * WHAT COUNTS AS THE BARANGAY HAVING RESPONDED
 *
 * This used to stop the clock as soon as status left 'pending', on the
 * assumption that an assignment meant a human dispatcher had acted. The
 * auto_assign_tanod trigger made that assumption false: it assigns every
 * incident the moment it is filed, so long as anyone is on duty. The result
 * was that aging silently never fired at all — the only incidents that could
 * age were the ones filed when the barangay had nobody on duty.
 *
 * A machine assigning a report is not the barangay responding to it. The
 * clock now stops only on evidence a PERSON acted:
 *
 *   • acknowledged_at is set (an official opened the critical alert), or
 *   • assignment_method is 'manual' or 'reassigned' (an official chose the
 *     tanod). 'auto' and 'auto_offduty' are the trigger, and do not count.
 *
 * After that the incident is not finished, only seen — so it moves to a
 * second, longer clock and keeps aging until it is actually resolved. Both
 * clocks run from created_at, because that is when the resident started
 * waiting, which is the only stopwatch they care about.
 */

// Phase 1 — expected time to first HUMAN response.
export const RESPONSE_WINDOW_MS = {
  Critical: 15 * 60 * 1000,          // 15 minutes
  High: 4 * 60 * 60 * 1000,          // 4 hours
  Medium: 24 * 60 * 60 * 1000,       // 1 day
  Low: 72 * 60 * 60 * 1000,          // 3 days
}

// Phase 2 — expected time to resolution, once someone has taken it on.
// Deliberately much longer: responding is a phone call, resolving may need
// a site visit, a mediation hearing, or another agency entirely.
export const RESOLUTION_WINDOW_MS = {
  Critical: 4 * 60 * 60 * 1000,      // 4 hours
  High: 24 * 60 * 60 * 1000,         // 1 day
  Medium: 72 * 60 * 60 * 1000,       // 3 days
  Low: 7 * 24 * 60 * 60 * 1000,      // 1 week
}

// Band floors. 100 apart so aging can lift an item above a fresher item of
// the next band up, while CRITICAL_BAND stays unreachable by aging alone.
const BAND = { Low: 100, Medium: 200, High: 300, Critical: 400 }
const MAX_AGED_SCORE = BAND.Critical - 1   // 399 — the ceiling for aging

// How many multiples of its window an incident must sit before it reaches
// maximum standing.
const FULL_BOOST_AT = 4

/** Assignment methods that represent a person deciding, not the trigger. */
const HUMAN_ASSIGNMENT = new Set(['manual', 'reassigned'])

/**
 * Has a human acted on this yet? See the note above on why an automatic
 * assignment does not count.
 */
export function hasHumanResponse(incident) {
  if (incident?.acknowledged_at) return true
  return HUMAN_ASSIGNMENT.has(incident?.assignment_method)
}

const PHASE_LABELS = {
  response: ['Past response time', 'No response yet', 'Still unanswered'],
  resolution: ['Past resolution target', 'Overdue', 'Long overdue'],
}

/**
 * Standing for a single incident.
 * @returns {{ score:number, overdueRatio:number, level:0|1|2|3, aged:boolean,
 *             label:string|null, phase:'response'|'resolution'|'done',
 *             windowMs:number|null }}
 */
export function computeStanding(incident, now = Date.now()) {
  const priority = incident?.priority || 'Medium'
  const base = BAND[priority] ?? BAND.Medium
  const settled = {
    score: base, overdueRatio: 0, level: 0, aged: false,
    label: null, phase: 'done', windowMs: null,
  }

  // Resolved is the only thing that stops the clock for good.
  if (incident?.status === 'resolved') return settled

  const phase = hasHumanResponse(incident) ? 'resolution' : 'response'
  const windows = phase === 'response' ? RESPONSE_WINDOW_MS : RESOLUTION_WINDOW_MS
  const windowMs = windows[priority] ?? windows.Medium

  const created = new Date(incident?.created_at).getTime()
  if (!Number.isFinite(created)) return { ...settled, phase, windowMs }

  const overdueRatio = (now - created) / windowMs

  // Still inside its window — no boost, but report the phase so the UI can
  // say which clock is running.
  if (overdueRatio <= 1) {
    return { score: base, overdueRatio, level: 0, aged: false, label: null, phase, windowMs }
  }

  // Ramp from 0 to a full band-and-a-half as it goes from 1x to 4x overdue.
  const progress = Math.min((overdueRatio - 1) / (FULL_BOOST_AT - 1), 1)
  const boost = Math.round(progress * 150)
  const score = Math.min(base + boost, MAX_AGED_SCORE)

  // Three visible steps so the UI can say something meaningful rather than
  // exposing a raw number nobody can interpret.
  const level = overdueRatio >= 3 ? 3 : overdueRatio >= 2 ? 2 : 1
  const label = PHASE_LABELS[phase][level - 1]

  return { score, overdueRatio, level, aged: true, label, phase, windowMs }
}

/** Styling for the standing badge — deliberately amber/orange, never red. */
export const STANDING_STYLE = {
  1: { bg: '#fffbeb', color: '#b45309', border: '#fef3c7' },
  2: { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
  3: { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
}

function durationLabel(ms) {
  const hours = ms / 3600000
  if (hours < 1) return `${Math.round(ms / 60000)} minutes`
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`
  const days = hours / 24
  return `${days} day${days === 1 ? '' : 's'}`
}

/** Human-readable first-response target, e.g. "1 day". */
export function responseWindowLabel(priority) {
  return durationLabel(RESPONSE_WINDOW_MS[priority] ?? RESPONSE_WINDOW_MS.Medium)
}

/** Human-readable resolution target, e.g. "3 days". */
export function resolutionWindowLabel(priority) {
  return durationLabel(RESOLUTION_WINDOW_MS[priority] ?? RESOLUTION_WINDOW_MS.Medium)
}

/** The target that currently applies to this incident, as a phrase. */
export function activeWindowLabel(incident) {
  const priority = incident?.priority || 'Medium'
  return hasHumanResponse(incident)
    ? `resolution within ${resolutionWindowLabel(priority)}`
    : `a response within ${responseWindowLabel(priority)}`
}

/** Sort comparator: highest standing first, then oldest first. */
export function byStanding(a, b, now = Date.now()) {
  const diff = computeStanding(b, now).score - computeStanding(a, now).score
  if (diff !== 0) return diff
  return new Date(a.created_at) - new Date(b.created_at)
}
