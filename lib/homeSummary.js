import { isSettled } from '@/lib/recordState'
import { deadlineState } from '@/lib/documents'

/**
 * What the home screen says is happening.
 *
 * The old greeting card promised "Here's what's happening in Matab-ang" and
 * then said nothing else — it was the largest element on the screen and the
 * only one carrying no information. This builds the sentence that makes the
 * promise true.
 *
 * Kept pure and separate because a generated sentence is exactly where
 * plural and zero bugs hide, and "1 reports are still with the tanods"
 * undoes the care taken everywhere else on the page.
 */

const PH_OFFSET_MS = 8 * 60 * 60 * 1000

/** Barangay time, not the device's — an OFW checking in from Dubai should
 *  still be greeted by the hour back home. */
export function greeting(now = Date.now()) {
  const hour = new Date(new Date(now).getTime() + PH_OFFSET_MS).getUTCHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/** "1 report" / "2 reports" — the whole reason this file has tests. */
export function plural(count, one, many) {
  return `${count} ${count === 1 ? one : many}`
}

/** Joins clauses the way a person writes them: a, b and c. */
export function joinClauses(parts) {
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

const openOnly = list => (list || []).filter(item => !isSettled(item?.status))

/**
 * The counts the tiles show. Each one is what still needs the resident,
 * never how many rows exist — a total answers nothing.
 */
export function activityCounts({
  incidents = [], tickets = [], documentRequests = [],
  blotterCases = [], unreadAnnouncements = 0, isCaseOpen,
} = {}) {
  const openIncidents = openOnly(incidents)
  const openTickets = openOnly(tickets)
  const openDocuments = openOnly(documentRequests)
  const openCases = isCaseOpen
    ? (blotterCases || []).filter(isCaseOpen)
    : openOnly(blotterCases)

  return {
    incidents: { open: openIncidents.length, total: incidents.length },
    tickets: { open: openTickets.length, total: tickets.length },
    documents: { open: openDocuments.length, total: documentRequests.length },
    cases: { open: openCases.length, total: blotterCases.length },
    announcements: { open: unreadAnnouncements },
  }
}

/**
 * The sentence under the greeting.
 *
 * Only what is actually outstanding gets a clause, so the line stays short
 * on a quiet day instead of listing four zeroes. When everything is quiet
 * it says so — "nothing needs you" is the answer a resident came for, not
 * an empty state to apologise for.
 */
export function summarySentence(counts, { barangayName } = {}) {
  const where = barangayName ? `In ${barangayName} today` : 'Today'
  const parts = []

  if (counts.incidents.open > 0) {
    parts.push(`${plural(counts.incidents.open, 'report is', 'reports are')} still with the tanods`)
  }
  if (counts.documents.open > 0) {
    parts.push(`${plural(counts.documents.open, 'document request is', 'document requests are')} being processed`)
  }
  if (counts.tickets.open > 0) {
    parts.push(`${plural(counts.tickets.open, 'ticket is', 'tickets are')} still open`)
  }
  if (counts.cases.open > 0) {
    parts.push(`${plural(counts.cases.open, 'blotter case is', 'blotter cases are')} before the Lupon`)
  }
  if (counts.announcements.open > 0) {
    parts.push(`${plural(counts.announcements.open, 'announcement', 'announcements')} you have not read`)
  }

  if (parts.length === 0) {
    return {
      allClear: true,
      text: barangayName
        ? `Nothing needs you in ${barangayName} right now.`
        : 'Nothing needs you right now.',
    }
  }

  return { allClear: false, text: `${where}: ${joinClauses(parts)}.` }
}

/**
 * The one thing worth pulling out of the list and putting a button on.
 *
 * Order is by consequence, not recency: a report nobody has picked up
 * outranks a document deadline, which outranks anything merely open.
 */
export function mostPressing({ incidents = [], documentRequests = [] } = {}, now = Date.now()) {
  const waiting = openOnly(incidents)
    .filter(i => i.priority === 'Critical')
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0]

  if (waiting) {
    return {
      kind: 'incident',
      tone: 'urgent',
      id: waiting.id,
      title: waiting.title,
      detail: waiting.status === 'assigned' ? 'A tanod is on the way' : 'Still waiting for a tanod',
      href: `/resident/incident/${waiting.id}`,
    }
  }

  const overdue = openOnly(documentRequests)
    .map(req => ({ req, state: deadlineState(req, now) }))
    .filter(({ state }) => state.overdue || state.deemedApproved)[0]

  if (overdue) {
    return {
      kind: 'document',
      tone: 'urgent',
      id: overdue.req.id,
      title: overdue.req.reference_code || 'Document request',
      detail: overdue.state.deemedApproved
        ? 'Past its deadline — deemed approved under RA 11032 Sec. 10'
        : 'Past the deadline the barangay is held to',
      href: null,
    }
  }

  const open = openOnly(incidents)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0]

  if (open) {
    return {
      kind: 'incident',
      tone: 'watch',
      id: open.id,
      title: open.title,
      detail: open.status === 'assigned' ? 'A tanod is on the way' : 'Waiting for a tanod',
      href: `/resident/incident/${open.id}`,
    }
  }

  return null
}
