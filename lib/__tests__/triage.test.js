import { describe, it, expect } from 'vitest'
import {
  computeStanding, hasHumanResponse, byStanding,
  RESPONSE_WINDOW_MS, RESOLUTION_WINDOW_MS,
  responseWindowLabel, resolutionWindowLabel, activeWindowLabel,
} from '@/lib/triage'

const NOW = Date.parse('2026-08-20T02:00:00Z')
const HOURS = 3600_000

/** An incident filed `agoHours` before NOW. */
const incident = (agoHours, over = {}) => ({
  priority: 'Low',
  status: 'assigned',
  created_at: new Date(NOW - agoHours * HOURS).toISOString(),
  ...over,
})

describe('what counts as the barangay having responded', () => {
  it('does not count an automatic assignment — a trigger is not a person', () => {
    expect(hasHumanResponse({ assignment_method: 'auto' })).toBe(false)
    expect(hasHumanResponse({ assignment_method: 'auto_offduty' })).toBe(false)
  })

  it('counts an official choosing the responder', () => {
    expect(hasHumanResponse({ assignment_method: 'manual' })).toBe(true)
    expect(hasHumanResponse({ assignment_method: 'reassigned' })).toBe(true)
  })

  it('counts an acknowledgement', () => {
    expect(hasHumanResponse({ acknowledged_at: '2026-08-20T01:00:00Z' })).toBe(true)
  })

  it('treats an unassigned report as unanswered', () => {
    expect(hasHumanResponse({ status: 'pending' })).toBe(false)
    expect(hasHumanResponse({})).toBe(false)
  })
})

describe('REGRESSION: auto-dispatch used to switch aging off entirely', () => {
  // auto_assign_tanod sets status='assigned' the moment an incident is filed
  // whenever anyone is on duty. The old computeStanding only aged 'pending'
  // rows, so in any barangay with a tanod on duty nothing ever aged.
  it('ages an auto-assigned report that nobody has looked at', () => {
    const s = computeStanding(incident(24 * 5, { assignment_method: 'auto' }), NOW)
    expect(s.aged).toBe(true)
    expect(s.phase).toBe('response')
    expect(s.label).toBeTruthy()
  })

  it('screams about an unanswered Critical within the hour', () => {
    const s = computeStanding(
      incident(1, { priority: 'Critical', assignment_method: 'auto' }), NOW)
    expect(s.aged).toBe(true)
    expect(s.overdueRatio).toBeGreaterThan(3)
  })
})

describe('phase 1 — awaiting a human response', () => {
  it('stays calm inside the response window', () => {
    const s = computeStanding(incident(2, { priority: 'Medium', status: 'pending' }), NOW)
    expect(s.aged).toBe(false)
    expect(s.level).toBe(0)
    expect(s.phase).toBe('response')
  })

  it('escalates through three visible steps as it goes further overdue', () => {
    const at = (mult) => computeStanding(
      incident((RESPONSE_WINDOW_MS.Medium / HOURS) * mult, { priority: 'Medium', status: 'pending' }),
      NOW
    ).level
    expect(at(1.5)).toBe(1)
    expect(at(2.5)).toBe(2)
    expect(at(4)).toBe(3)
  })
})

describe('phase 2 — responded, but not finished', () => {
  it('switches to the longer resolution clock once a human has acted', () => {
    const s = computeStanding(incident(24 * 5, { assignment_method: 'manual' }), NOW)
    expect(s.phase).toBe('resolution')
    expect(s.windowMs).toBe(RESOLUTION_WINDOW_MS.Low)
    expect(s.aged).toBe(false) // 5 days is inside the 1-week Low window
  })

  it('still ages an incident somebody took on and then forgot', () => {
    const s = computeStanding(incident(24 * 30, { assignment_method: 'manual' }), NOW)
    expect(s.phase).toBe('resolution')
    expect(s.aged).toBe(true)
    expect(s.label).toBe('Long overdue')
  })

  it('gives every priority more room to resolve than to respond', () => {
    for (const p of ['Critical', 'High', 'Medium', 'Low']) {
      expect(RESOLUTION_WINDOW_MS[p], p).toBeGreaterThan(RESPONSE_WINDOW_MS[p])
    }
  })
})

describe('the clock stops only on resolution', () => {
  it('never ages a resolved incident, however old', () => {
    const s = computeStanding(incident(24 * 365, { status: 'resolved' }), NOW)
    expect(s.aged).toBe(false)
    expect(s.phase).toBe('done')
  })
})

describe('priority is a classification, not a queue position', () => {
  it('never lets aging reach the Critical band', () => {
    const s = computeStanding(incident(24 * 3650, { priority: 'High', status: 'pending' }), NOW)
    expect(s.score).toBeLessThan(400)
  })

  it('keeps a fresh Critical above any aged non-Critical', () => {
    const agedLow = computeStanding(incident(24 * 3650, { priority: 'Low', status: 'pending' }), NOW)
    const freshCritical = computeStanding(incident(0.01, { priority: 'Critical', status: 'pending' }), NOW)
    expect(freshCritical.score).toBeGreaterThan(agedLow.score)
  })

  it('lets an overdue item outrank a fresher one of the same band', () => {
    const overdue = computeStanding(incident(24 * 20, { priority: 'Medium', status: 'pending' }), NOW)
    const fresh = computeStanding(incident(0.5, { priority: 'Medium', status: 'pending' }), NOW)
    expect(overdue.score).toBeGreaterThan(fresh.score)
  })
})

describe('byStanding', () => {
  it('sorts by standing, then oldest first', () => {
    const critical = incident(0.1, { priority: 'Critical', status: 'pending' })
    const oldLow = incident(24 * 40, { priority: 'Low', status: 'pending' })
    const newLow = incident(1, { priority: 'Low', status: 'pending' })
    const sorted = [newLow, oldLow, critical].sort((a, b) => byStanding(a, b, NOW))
    expect(sorted[0]).toBe(critical)
    expect(sorted[1]).toBe(oldLow)
  })
})

describe('window labels', () => {
  it('reads in minutes, hours or days as appropriate', () => {
    expect(responseWindowLabel('Critical')).toBe('15 minutes')
    expect(responseWindowLabel('High')).toBe('4 hours')
    expect(responseWindowLabel('Medium')).toBe('1 day')
    expect(resolutionWindowLabel('Low')).toBe('7 days')
  })

  it('names the clock that actually applies to an incident', () => {
    expect(activeWindowLabel({ priority: 'High', assignment_method: 'auto' }))
      .toMatch(/response within 4 hours/)
    expect(activeWindowLabel({ priority: 'High', assignment_method: 'manual' }))
      .toMatch(/resolution within 1 day/)
  })

  it('falls back to Medium for an unknown priority rather than throwing', () => {
    expect(responseWindowLabel('Bogus')).toBe(responseWindowLabel('Medium'))
  })
})

describe('bad data', () => {
  it('does not throw on a missing or malformed created_at', () => {
    expect(() => computeStanding({ status: 'pending' }, NOW)).not.toThrow()
    expect(computeStanding({ status: 'pending', created_at: 'nonsense' }, NOW).aged).toBe(false)
  })
})
