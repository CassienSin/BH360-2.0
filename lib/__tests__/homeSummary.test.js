import { describe, it, expect } from 'vitest'
import {
  greeting, plural, joinClauses, activityCounts, summarySentence, mostPressing,
} from '@/lib/homeSummary'

/**
 * The home screen's opening line is generated, which is exactly where
 * "1 reports are still with the tanods" gets shipped. These exist so it
 * cannot be.
 */

const at = iso => new Date(iso).getTime()

describe('greeting', () => {
  it('reads the clock in the barangay, not on the device', () => {
    // 01:00 UTC is 09:00 in Manila. A resident working abroad should still
    // be greeted by the hour back home.
    expect(greeting(at('2026-09-02T01:00:00Z'))).toBe('Good morning')
    expect(greeting(at('2026-09-02T06:00:00Z'))).toBe('Good afternoon') // 14:00 PH
    expect(greeting(at('2026-09-02T12:00:00Z'))).toBe('Good evening')   // 20:00 PH
  })

  it('gets the boundaries right rather than off by one', () => {
    expect(greeting(at('2026-09-01T03:59:00Z'))).toBe('Good morning')   // 11:59 PH
    expect(greeting(at('2026-09-01T04:00:00Z'))).toBe('Good afternoon') // 12:00 PH
    expect(greeting(at('2026-09-01T09:59:00Z'))).toBe('Good afternoon') // 17:59 PH
    expect(greeting(at('2026-09-01T10:00:00Z'))).toBe('Good evening')   // 18:00 PH
  })

  it('handles the day rolling over in Manila but not in UTC', () => {
    // 17:00 UTC is 01:00 the next day in Manila.
    expect(greeting(at('2026-09-01T17:00:00Z'))).toBe('Good morning')
  })
})

describe('plural', () => {
  it('does not say "1 reports"', () => {
    expect(plural(1, 'report is', 'reports are')).toBe('1 report is')
    expect(plural(2, 'report is', 'reports are')).toBe('2 reports are')
    expect(plural(0, 'report is', 'reports are')).toBe('0 reports are')
  })
})

describe('joinClauses', () => {
  it('joins the way a person writes, not the way an array prints', () => {
    expect(joinClauses(['a'])).toBe('a')
    expect(joinClauses(['a', 'b'])).toBe('a and b')
    expect(joinClauses(['a', 'b', 'c'])).toBe('a, b and c')
  })
  it('returns nothing for nothing', () => {
    expect(joinClauses([])).toBe('')
  })
})

describe('activityCounts', () => {
  const data = {
    incidents: [
      { status: 'pending' }, { status: 'assigned' },
      { status: 'resolved' }, { status: 'resolved' },
    ],
    tickets: [{ status: 'open' }, { status: 'closed' }],
    documentRequests: [{ status: 'processing' }, { status: 'released' }],
    blotterCases: [{ status: 'mediation' }, { status: 'settled' }],
    unreadAnnouncements: 2,
  }

  it('counts what is outstanding, not how many rows exist', () => {
    // The old tiles said 15 when 13 were resolved. That number answered
    // nothing a resident opened the page to ask.
    const c = activityCounts(data)
    expect(c.incidents).toEqual({ open: 2, total: 4 })
    expect(c.tickets).toEqual({ open: 1, total: 2 })
    expect(c.documents).toEqual({ open: 1, total: 2 })
  })

  it('lets the blotter bring its own idea of open', () => {
    const c = activityCounts({
      ...data,
      isCaseOpen: k => ['filed', 'mediation', 'pangkat'].includes(k.status),
    })
    expect(c.cases).toEqual({ open: 1, total: 2 })
  })

  it('returns zeroes rather than throwing on a fresh account', () => {
    const c = activityCounts()
    expect(c.incidents).toEqual({ open: 0, total: 0 })
    expect(c.announcements.open).toBe(0)
  })
})

describe('summarySentence', () => {
  const counts = (over = {}) => activityCounts({
    incidents: [], tickets: [], documentRequests: [], blotterCases: [],
    unreadAnnouncements: 0, ...over,
  })

  it('names the barangay and lists only what is outstanding', () => {
    const s = summarySentence(
      counts({ incidents: [{ status: 'pending' }, { status: 'assigned' }], unreadAnnouncements: 2 }),
      { barangayName: 'Matab-ang' }
    )
    expect(s.allClear).toBe(false)
    expect(s.text).toBe(
      'In Matab-ang today: 2 reports are still with the tanods and 2 announcements you have not read.'
    )
  })

  it('reads correctly when every count is one', () => {
    const s = summarySentence(
      counts({
        incidents: [{ status: 'pending' }],
        tickets: [{ status: 'open' }],
        unreadAnnouncements: 1,
      }),
      { barangayName: 'Matab-ang' }
    )
    expect(s.text).toContain('1 report is still with the tanods')
    expect(s.text).toContain('1 ticket is still open')
    expect(s.text).toContain('1 announcement you have not read')
    expect(s.text).not.toMatch(/1 \w+s /)
  })

  it('says nothing needs you rather than listing four zeroes', () => {
    const s = summarySentence(counts(), { barangayName: 'Matab-ang' })
    expect(s.allClear).toBe(true)
    expect(s.text).toBe('Nothing needs you in Matab-ang right now.')
    expect(s.text).not.toMatch(/\b0\b/)
  })

  it('still reads as a sentence with no barangay name loaded', () => {
    expect(summarySentence(counts()).text).toBe('Nothing needs you right now.')
    const busy = summarySentence(counts({ incidents: [{ status: 'pending' }] }))
    expect(busy.text).toMatch(/^Today: /)
  })

  it('ends in a full stop whatever the combination', () => {
    const combos = [
      {}, { incidents: [{ status: 'pending' }] },
      { incidents: [{ status: 'pending' }], tickets: [{ status: 'open' }] },
      {
        incidents: [{ status: 'pending' }], tickets: [{ status: 'open' }],
        documentRequests: [{ status: 'processing' }],
        blotterCases: [{ status: 'mediation' }], unreadAnnouncements: 3,
      },
    ]
    for (const c of combos) {
      expect(summarySentence(counts(c), { barangayName: 'X' }).text).toMatch(/\.$/)
    }
  })
})

describe('mostPressing', () => {
  const critical = {
    id: 'i1', title: 'Fire near the covered court', priority: 'Critical',
    status: 'pending', created_at: '2026-09-01T10:00:00Z',
  }
  const ordinary = {
    id: 'i2', title: 'Streetlight out', priority: 'Medium',
    status: 'pending', created_at: '2026-09-01T08:00:00Z',
  }

  it('picks the critical report over an older ordinary one', () => {
    // Ordering by consequence, not recency — the fire outranks the
    // streetlight even though the streetlight has waited longer.
    const p = mostPressing({ incidents: [ordinary, critical] })
    expect(p.id).toBe('i1')
    expect(p.tone).toBe('urgent')
  })

  it('never surfaces something already resolved', () => {
    const p = mostPressing({ incidents: [{ ...critical, status: 'resolved' }] })
    expect(p).toBeNull()
  })

  it('falls back to the longest-waiting open report', () => {
    const p = mostPressing({ incidents: [ordinary] })
    expect(p.id).toBe('i2')
    expect(p.tone).toBe('watch')
  })

  it('raises a document the barangay has let run past its deadline', () => {
    const p = mostPressing({
      incidents: [],
      documentRequests: [{
        id: 'd1', reference_code: 'BC-2026-0001', status: 'processing',
        due_at: '2026-08-01T09:00:00Z',
      }],
    }, at('2026-09-01T09:00:00Z'))
    expect(p.kind).toBe('document')
    expect(p.detail).toMatch(/RA 11032|deadline/)
  })

  it('says the tanod is on the way once one has been assigned', () => {
    const p = mostPressing({ incidents: [{ ...critical, status: 'assigned' }] })
    expect(p.detail).toBe('A tanod is on the way')
  })

  it('returns nothing when nothing is pressing', () => {
    expect(mostPressing({ incidents: [], documentRequests: [] })).toBeNull()
    expect(mostPressing({})).toBeNull()
  })
})
