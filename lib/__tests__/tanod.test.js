import { describe, it, expect } from 'vitest'
import {
  RESPONSE_STEPS, responseStage, nextAction, byUrgency,
  overdueAssignments, tanodSummary, mostUrgentAssignment,
  tanodStats, formatHours,
} from '@/lib/tanod'

/**
 * A tanod could previously only resolve an assignment — there was no way to
 * record having seen it or reached it. These cover the four points that now
 * exist and the numbers built from them.
 */

const at = iso => new Date(iso).getTime()
const NOW = at('2026-09-02T12:00:00Z')

describe('responseStage', () => {
  it('walks the four points of a response', () => {
    expect(responseStage({ status: 'assigned' })).toBe(0)
    expect(responseStage({ status: 'assigned', acknowledged_at: '2026-09-02T10:00:00Z' })).toBe(1)
    expect(responseStage({ status: 'assigned', acknowledged_at: '2026-09-02T10:00:00Z', arrived_at: '2026-09-02T10:20:00Z' })).toBe(2)
    expect(responseStage({ status: 'resolved' })).toBe(3)
  })

  it('never returns a step past the end of the track it draws', () => {
    for (const inc of [{}, { status: 'resolved', arrived_at: 'x' }, undefined]) {
      const s = responseStage(inc)
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThan(RESPONSE_STEPS.length)
    }
  })

  it('treats arrival without an acknowledgement as being on scene', () => {
    // The database fills the missing acknowledgement, but the UI must not
    // fall back to step 0 in the moment before that row is re-read.
    expect(responseStage({ status: 'assigned', arrived_at: '2026-09-02T10:00:00Z' })).toBe(2)
  })

  it('counts a resolved report as done even with no stamps at all', () => {
    // Every incident resolved before this feature existed.
    expect(responseStage({ status: 'resolved', acknowledged_at: null, arrived_at: null })).toBe(3)
  })
})

describe('nextAction', () => {
  it('offers one thing at a time, in order', () => {
    expect(nextAction({ status: 'assigned' }).key).toBe('acknowledge')
    expect(nextAction({ status: 'assigned', acknowledged_at: 'x' }).key).toBe('arrive')
    expect(nextAction({ status: 'assigned', acknowledged_at: 'x', arrived_at: 'y' }).key).toBe('resolve')
  })
  it('offers nothing once resolved', () => {
    expect(nextAction({ status: 'resolved' })).toBeNull()
  })
})

describe('byUrgency', () => {
  const mk = (id, priority, created) => ({ id, priority, created_at: created })

  it('puts the worse priority first', () => {
    const list = [mk('low', 'Low', '2026-09-01T00:00:00Z'), mk('crit', 'Critical', '2026-09-02T00:00:00Z')]
    expect(list.sort(byUrgency).map(i => i.id)).toEqual(['crit', 'low'])
  })

  it('puts the LONGEST waiting first within one priority', () => {
    // The old comparator sorted newest first, so of two Critical reports the
    // one that had waited three hours sat below the one from five minutes
    // ago — the opposite of a queue.
    const list = [
      mk('new', 'Critical', '2026-09-02T11:55:00Z'),
      mk('old', 'Critical', '2026-09-02T09:00:00Z'),
    ]
    expect(list.sort(byUrgency).map(i => i.id)).toEqual(['old', 'new'])
  })

  it('treats an unknown priority as Medium rather than dropping it to the bottom', () => {
    const list = [mk('none', undefined, '2026-09-01T00:00:00Z'), mk('low', 'Low', '2026-09-01T00:00:00Z')]
    expect(list.sort(byUrgency)[0].id).toBe('none')
  })
})

describe('overdueAssignments', () => {
  it('finds the ones past their response window', () => {
    const fresh = { priority: 'Critical', status: 'assigned', created_at: '2026-09-02T11:59:00Z' }
    const stale = { priority: 'Critical', status: 'assigned', created_at: '2026-09-01T00:00:00Z' }
    const found = overdueAssignments([fresh, stale], NOW)
    expect(found).toHaveLength(1)
    expect(found[0]).toBe(stale)
  })
})

describe('tanodSummary', () => {
  const assigned = (n, over = {}) => Array.from({ length: n }, (_, i) => ({
    id: String(i), status: 'assigned', priority: 'Medium',
    created_at: '2026-09-02T11:50:00Z', ...over,
  }))

  it('does not say "1 assignments"', () => {
    const s = tanodSummary({ assignments: assigned(1, { acknowledged_at: 'x' }), onDuty: true, barangayName: 'Matab-ang', now: NOW })
    expect(s.text).toContain('1 assignment in Matab-ang')
    expect(s.text).not.toContain('1 assignments')
  })

  it('counts the ones never opened', () => {
    const s = tanodSummary({ assignments: assigned(3), onDuty: true, barangayName: 'Matab-ang', now: NOW })
    expect(s.text).toContain('3 assignments')
    expect(s.text).toContain('3 you have not opened yet')
  })

  it('says so when a tanod is off duty but still holds assignments', () => {
    // Nothing anywhere used to tell them. The reports stay pointed at them
    // either way.
    const s = tanodSummary({ assignments: assigned(2), onDuty: false, barangayName: 'Matab-ang', now: NOW })
    expect(s.text).toContain('off duty')
    expect(s.allClear).toBe(false)
  })

  it('is all clear only when nothing is assigned AND they are on duty', () => {
    expect(tanodSummary({ assignments: [], onDuty: true, now: NOW }).allClear).toBe(true)
    const off = tanodSummary({ assignments: [], onDuty: false, now: NOW })
    expect(off.allClear).toBe(false)
    expect(off.text).toContain('off duty')
  })

  it('ends in a full stop in every branch', () => {
    const cases = [
      { assignments: [], onDuty: true }, { assignments: [], onDuty: false },
      { assignments: assigned(1), onDuty: true }, { assignments: assigned(4), onDuty: false },
    ]
    for (const c of cases) {
      expect(tanodSummary({ ...c, barangayName: 'X', now: NOW }).text).toMatch(/\.$/)
    }
  })
})

describe('mostUrgentAssignment', () => {
  it('picks the longest-waiting critical', () => {
    const list = [
      { id: 'a', priority: 'Low', status: 'assigned', created_at: '2026-09-01T00:00:00Z', location: 'X' },
      { id: 'b', priority: 'Critical', status: 'assigned', created_at: '2026-09-02T09:00:00Z', location: 'Y' },
    ]
    const p = mostUrgentAssignment(list, NOW)
    expect(p.id).toBe('b')
    expect(p.tone).toBe('urgent')
  })

  it('does not reorder the caller\'s array', () => {
    const list = [
      { id: 'a', priority: 'Low', status: 'assigned', created_at: '2026-09-01T00:00:00Z' },
      { id: 'b', priority: 'Critical', status: 'assigned', created_at: '2026-09-02T09:00:00Z' },
    ]
    mostUrgentAssignment(list, NOW)
    expect(list.map(i => i.id)).toEqual(['a', 'b'])
  })

  it('returns nothing when nothing is assigned', () => {
    expect(mostUrgentAssignment([], NOW)).toBeNull()
  })

  it('says where it is, or admits there is no location', () => {
    const p = mostUrgentAssignment([{ id: 'a', priority: 'Medium', status: 'assigned', created_at: '2026-09-02T11:50:00Z' }], NOW)
    expect(p.detail).toContain('no location given')
  })
})

describe('formatHours', () => {
  it('reads in minutes below the hour', () => {
    expect(formatHours(0.3)).toBe('18m')
    expect(formatHours(2.44)).toBe('2.4h')
    expect(formatHours(null)).toBeNull()
  })
})

describe('tanodStats', () => {
  const incidents = [
    {
      status: 'resolved', created_at: '2026-09-01T10:00:00Z',
      acknowledged_at: '2026-09-01T10:30:00Z', arrived_at: '2026-09-01T11:00:00Z',
      resolved_at: '2026-09-01T12:00:00Z', rating: 5,
    },
    {
      status: 'assigned', created_at: '2026-09-02T10:00:00Z',
      acknowledged_at: '2026-09-02T10:10:00Z',
    },
  ]

  it('measures responding, travelling and resolving as three different things', () => {
    // "Avg Response" used to be resolved_at - created_at. It was the time to
    // finish the job, presented as the time to answer the call.
    const s = tanodStats(incidents, NOW)
    expect(s.respond.label).toBe('20m')   // 30m and 10m
    expect(s.travel.label).toBe('30m')    // one sample
    expect(s.resolve.label).toBe('2.0h')  // one sample
  })

  it('reports the sample size behind every average', () => {
    const s = tanodStats(incidents, NOW)
    expect(s.respond.sample).toBe(2)
    expect(s.travel.sample).toBe(1)
    expect(s.resolve.sample).toBe(1)
  })

  it('says N/A rather than inventing a number for reports with no stamps', () => {
    // Every incident resolved before this existed has neither stamp.
    const legacy = [{ status: 'resolved', created_at: '2026-08-01T00:00:00Z', resolved_at: '2026-08-01T04:00:00Z' }]
    const s = tanodStats(legacy, NOW)
    expect(s.respond.label).toBeNull()
    expect(s.respond.sample).toBe(0)
    expect(s.resolve.label).toBe('4.0h')
  })

  it('ignores a stamp that runs backwards rather than averaging a negative', () => {
    const broken = [{ status: 'resolved', created_at: '2026-09-01T12:00:00Z', acknowledged_at: '2026-09-01T10:00:00Z', resolved_at: '2026-09-01T13:00:00Z' }]
    expect(tanodStats(broken, NOW).respond.sample).toBe(0)
  })

  it('counts this month from the resolution, not the report', () => {
    const s = tanodStats([
      { status: 'resolved', created_at: '2026-08-28T00:00:00Z', resolved_at: '2026-09-01T00:00:00Z' },
    ], NOW)
    expect(s.resolvedThisMonth).toBe(1)
  })

  it('handles an empty history without dividing by zero', () => {
    const s = tanodStats([], NOW)
    expect(s.resolutionRate).toBe(0)
    expect(s.avgRating).toBeNull()
    expect(s.respond.label).toBeNull()
  })
})
