import { plural, joinClauses } from '@/lib/homeSummary'
import { computeStanding } from '@/lib/triage'

/**
 * The tanod's side of an incident.
 *
 * A tanod could previously do exactly one thing to an assignment: resolve
 * it. There was no way to say "seen it" or "I'm here", so the barangay had
 * no response time — the stat labelled "Avg Response" was really the
 * average time to resolution, and an official could not tell a report that
 * had been dispatched from one that had actually been read.
 *
 * Four points now, each stamped by the database rather than the client:
 * dispatched, acknowledged, on scene, resolved.
 */

export const RESPONSE_STEPS = ['Dispatched', 'On the way', 'On scene', 'Resolved']

/** How far along an assignment is: an index into RESPONSE_STEPS. */
export function responseStage(incident) {
  if (!incident) return 0
  if (incident.status === 'resolved') return 3
  if (incident.arrived_at) return 2
  if (incident.acknowledged_at) return 1
  return 0
}

/** What the tanod does next, or null once there is nothing left to do. */
export function nextAction(incident) {
  const stage = responseStage(incident)
  if (stage === 0) return { key: 'acknowledge', label: "I'm on my way", field: 'acknowledged_at' }
  if (stage === 1) return { key: 'arrive', label: "I've arrived", field: 'arrived_at' }
  if (stage === 2) return { key: 'resolve', label: 'Resolve', field: null }
  return null
}

const PRIORITY_ORDER = { Critical: 4, High: 3, Medium: 2, Low: 1 }

/**
 * Queue order: worst first, and within one priority the one that has been
 * waiting LONGEST. The old comparator sorted newest first, so of two
 * Critical assignments the one that had waited three hours sat below the
 * one from five minutes ago — the opposite of a queue.
 */
export function byUrgency(a, b) {
  const pa = PRIORITY_ORDER[a?.priority] ?? 2
  const pb = PRIORITY_ORDER[b?.priority] ?? 2
  if (pa !== pb) return pb - pa
  return new Date(a?.created_at || 0) - new Date(b?.created_at || 0)
}

/** Assignments past their response window, worst first. */
export function overdueAssignments(assignments = [], now = Date.now()) {
  return assignments.filter(inc => computeStanding(inc, now).aged)
}

/**
 * The line under the greeting.
 *
 * Being off duty with live assignments is the thing most worth saying: a
 * tanod who forgot to go on duty still has reports pointed at them, and
 * nothing anywhere told them so.
 */
export function tanodSummary({ assignments = [], onDuty = false, barangayName, now = Date.now() } = {}) {
  const unseen = assignments.filter(i => !i.acknowledged_at).length
  const overdue = overdueAssignments(assignments, now).length
  const where = barangayName ? ` in ${barangayName}` : ''

  if (assignments.length === 0) {
    return {
      allClear: onDuty,
      text: onDuty
        ? `Nothing assigned to you${where} right now.`
        : `Nothing assigned to you${where}. You are off duty.`,
    }
  }

  const parts = [plural(assignments.length, 'assignment', 'assignments')]
  if (unseen > 0) parts.push(`${unseen} you have not opened yet`)
  if (overdue > 0) parts.push(`${plural(overdue, 'is', 'are')} past its response time`)

  const duty = onDuty ? '' : ' You are off duty — the barangay still has these pointed at you.'
  return { allClear: false, text: `You have ${joinClauses(parts)}${where}.${duty}` }
}

/** The assignment to open first. */
export function mostUrgentAssignment(assignments = [], now = Date.now()) {
  const sorted = [...assignments].sort(byUrgency)
  const pick = sorted[0]
  if (!pick) return null
  const standing = computeStanding(pick, now)
  const stage = responseStage(pick)

  return {
    kind: 'assignment',
    tone: standing.aged || pick.priority === 'Critical' ? 'urgent' : 'watch',
    id: pick.id,
    title: pick.title,
    detail: standing.aged
      ? `${standing.label} · ${pick.location || 'no location given'}`
      : `${RESPONSE_STEPS[stage]} · ${pick.location || 'no location given'}`,
  }
}

/* ---------------------------------------------------------------------- */

const HOUR_MS = 1000 * 60 * 60

function averageHours(pairs) {
  const spans = pairs
    .filter(([from, to]) => from && to)
    .map(([from, to]) => (new Date(to) - new Date(from)) / HOUR_MS)
    .filter(h => Number.isFinite(h) && h >= 0)
  if (spans.length === 0) return { value: null, sample: 0 }
  return { value: spans.reduce((a, b) => a + b, 0) / spans.length, sample: spans.length }
}

/** "18m" / "2.4h" — null when there is nothing to average. */
export function formatHours(hours) {
  if (hours === null || hours === undefined) return null
  return hours < 1 ? `${Math.round(hours * 60)}m` : `${hours.toFixed(1)}h`
}

/**
 * The performance numbers, each saying what it actually measures.
 *
 * Every average carries its sample size, because the stamps only start
 * existing now: a tanod with years of resolved reports still has none of
 * them acknowledged, and "N/A" with a reason beats a number built from
 * three rows presented as though it meant something.
 */
export function tanodStats(incidents = [], now = Date.now()) {
  const resolved = incidents.filter(i => i.status === 'resolved')

  const monthStart = new Date(now)
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const respond = averageHours(resolved.concat(incidents.filter(i => i.status !== 'resolved'))
    .map(i => [i.created_at, i.acknowledged_at]))
  const travel = averageHours(incidents.map(i => [i.acknowledged_at, i.arrived_at]))
  const resolve = averageHours(resolved.map(i => [i.created_at, i.resolved_at]))

  const rated = resolved.filter(i => i.rating)
  const avgRating = rated.length
    ? (rated.reduce((sum, i) => sum + i.rating, 0) / rated.length).toFixed(1)
    : null

  return {
    totalAssigned: incidents.length,
    resolvedTotal: resolved.length,
    resolvedThisMonth: resolved.filter(i =>
      new Date(i.resolved_at || i.created_at) >= monthStart).length,
    respond: { ...respond, label: formatHours(respond.value) },
    travel: { ...travel, label: formatHours(travel.value) },
    resolve: { ...resolve, label: formatHours(resolve.value) },
    avgRating,
    ratedCount: rated.length,
    resolutionRate: incidents.length
      ? Math.round((resolved.length / incidents.length) * 100)
      : 0,
  }
}
