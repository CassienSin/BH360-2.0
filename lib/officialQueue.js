// What is waiting on a barangay official right now, as one list for the
// dashboard's "Waiting on you" card (O01). Built only from the records the
// official dashboard already loads; nothing here queries anything.
//
// Order: what is past a legal deadline first, then a critical report
// nobody has taken, then what is close to a deadline, then everything else;
// oldest first within each group.

import { isSettled } from './recordState'
import { stageDeadline, isOpen as caseIsOpen } from './katarungan'
import { deadlineState, DOCUMENT_TYPES } from './documents'
import { timeAgo } from './timeAgo'

const HOUR = 60 * 60 * 1000
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

/** A short "waiting 3 h" / "waiting 2 d" for something that came in at `at`. */
export function waitingFor(at, now = Date.now()) {
  const ms = now - new Date(at).getTime()
  if (!Number.isFinite(ms) || ms < 0) return 'Just now'
  if (ms < HOUR) return `Waiting ${Math.max(1, Math.round(ms / 60000))} min`
  if (ms < 24 * HOUR) return `Waiting ${Math.round(ms / HOUR)} h`
  return `Waiting ${Math.round(ms / (24 * HOUR))} d`
}

/**
 * @returns {{ kind: 'case'|'incident'|'ticket'|'document'|'verification',
 *   id: string, title: string, sub: string, when: string,
 *   tone: 'danger'|'warn'|'quiet', action: string, rank: number, at: number }[]}
 */
export function waitingOnOfficial({
  incidents = [], tickets = [], cases = [], documents = [], users = [], selfId, now = Date.now(),
} = {}) {
  const items = []
  const time = at => new Date(at || 0).getTime() || 0

  for (const c of cases) {
    if (!caseIsOpen(c)) continue
    const d = stageDeadline(c, now)
    if (d.level !== 'breach' && d.level !== 'due') continue
    const overdue = d.level === 'breach'
    items.push({
      kind: 'case', id: c.id,
      title: [c.case_number ? `Case ${c.case_number}` : 'Case', c.nature].filter(Boolean).join(' · '),
      sub: [c.complainant_name, c.respondent_name].filter(Boolean).join(' v. '),
      when: overdue ? `Overdue ${plural(-d.daysLeft || 1, 'day')}` : d.daysLeft === 0 ? 'Due today' : `${plural(d.daysLeft, 'day')} left`,
      tone: overdue ? 'danger' : 'warn',
      action: 'Review', rank: overdue ? 0 : 2, at: time(d.dueAt),
    })
  }

  for (const r of documents) {
    if (['released', 'denied'].includes(r.status)) continue
    const d = deadlineState(r, now)
    if (d.level !== 'breach' && d.level !== 'due') continue
    const overdue = d.level === 'breach'
    items.push({
      kind: 'document', id: r.id,
      title: DOCUMENT_TYPES[r.document_type]?.label || 'Document request',
      sub: ['Document', r.profiles?.full_name].filter(Boolean).join(' · '),
      when: overdue ? 'Past the deadline' : d.label,
      tone: overdue ? 'danger' : 'warn',
      action: 'Review', rank: overdue ? 0 : 2, at: time(r.due_at),
    })
  }

  for (const i of incidents) {
    if (isSettled(i.status) || i.assigned_to) continue
    const critical = i.priority === 'Critical'
    items.push({
      kind: 'incident', id: i.id,
      title: i.title,
      sub: ['Report', i.profiles?.full_name, i.location].filter(Boolean).join(' · '),
      when: `Unassigned · ${timeAgo(i.created_at, new Date(now))}`,
      tone: critical ? 'danger' : 'warn',
      action: 'Assign', rank: critical ? 1 : 3, at: time(i.created_at),
    })
  }

  for (const t of tickets) {
    // Open or being handled: the same "needs a reply" as lib/homeSummary.js.
    if (isSettled(t.status)) continue
    const at = time(t.created_at)
    items.push({
      kind: 'ticket', id: t.id,
      title: t.title,
      sub: ['Ticket', t.profiles?.full_name].filter(Boolean).join(' · '),
      when: waitingFor(t.created_at, now),
      tone: now - at > 2 * HOUR ? 'warn' : 'quiet',
      action: 'Reply', rank: 4, at,
    })
  }

  for (const u of users) {
    if (u.id === selfId || u.is_super_admin) continue
    if ((u.verification_status || 'pending') !== 'pending') continue
    items.push({
      kind: 'verification', id: u.id,
      title: u.full_name || 'New account',
      sub: 'Verification',
      when: `Signed up ${timeAgo(u.created_at, new Date(now))}`,
      tone: 'quiet',
      action: 'Verify', rank: 5, at: time(u.created_at),
    })
  }

  return items.sort((a, b) => a.rank - b.rank || a.at - b.at)
}
