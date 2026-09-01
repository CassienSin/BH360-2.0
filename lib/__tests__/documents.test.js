import { describe, it, expect } from 'vitest'
import {
  RA_11032_LIMITS, DOCUMENT_TYPES, DOCUMENT_TYPE_LIST, CLASSIFICATION_LABEL,
  documentLegalBasis, philippineHolidays, isWorkingDay, workingDeadline,
  workingDaysBetween, deadlineState, getDocumentType,
} from '@/lib/documents'

// Philippine time is UTC+8 with no DST, so an instant is written here as the
// UTC moment it corresponds to. 02:00Z is 10:00 in Manila — mid-morning, well
// inside office hours, so nothing here depends on a boundary.
const ph = (iso) => new Date(iso)
const MORNING = 'T02:00:00Z'
const CLOSE_OF_BUSINESS = 'T09:00:00.000Z' // 17:00 +08:00

describe('RA 11032 Sec. 9(b)(1) — the statutory ceilings', () => {
  it('caps each class of transaction at the number of days the Act states', () => {
    expect(RA_11032_LIMITS).toEqual({ simple: 3, complex: 7, highly_technical: 20 })
  })

  it('never lets a document promise a shorter clock than its classification', () => {
    // The invariant that matters: `days` is what gets frozen onto the request
    // row, so if it ever drifted from the classification the barangay would be
    // held to a deadline the law does not impose.
    for (const [key, doc] of Object.entries(DOCUMENT_TYPES)) {
      expect(doc.days, `${key} declares ${doc.days} days as ${doc.classification}`)
        .toBe(RA_11032_LIMITS[doc.classification])
    }
  })

  it('gives every document a classification the Act recognises', () => {
    for (const [key, doc] of Object.entries(DOCUMENT_TYPES)) {
      expect(Object.keys(RA_11032_LIMITS), key).toContain(doc.classification)
      expect(CLASSIFICATION_LABEL[doc.classification]).toBeTruthy()
    }
  })

  it('treats a barangay clearance as a simple transaction — 3 working days', () => {
    expect(DOCUMENT_TYPES.barangay_clearance.days).toBe(3)
  })

  it('gives a business clearance 7 working days, per RA 7160 Sec. 152(c)', () => {
    expect(DOCUMENT_TYPES.business_clearance.days).toBe(7)
    expect(DOCUMENT_TYPES.business_clearance.sections).toContain('152(c)')
  })
})

describe('the Citizen’s Charter (Sec. 6)', () => {
  it('states requirements and a fee note for every document', () => {
    for (const [key, doc] of Object.entries(DOCUMENT_TYPES)) {
      expect(doc.label, key).toBeTruthy()
      expect(doc.requirements.length, key).toBeGreaterThan(0)
      expect(doc.feeNote, key).toBeTruthy()
    }
  })

  it('lists the fastest services first', () => {
    const days = DOCUMENT_TYPE_LIST.map(d => d.days)
    expect(days).toEqual([...days].sort((a, b) => a - b))
  })

  it('says the certificate of indigency is free — the point of the document', () => {
    expect(DOCUMENT_TYPES.certificate_of_indigency.feeNote).toMatch(/free of charge/i)
  })

  it('cites RA 11261 for the first-time jobseeker certificate', () => {
    expect(DOCUMENT_TYPES.first_time_jobseeker.alsoCited).toMatch(/11261/)
  })

  it('returns null for an unknown key rather than a broken object', () => {
    expect(getDocumentType('not_a_document')).toBeNull()
  })
})

describe('documentLegalBasis — frozen onto the request row', () => {
  it('names the law, the section and the window', () => {
    const basis = documentLegalBasis('barangay_clearance')
    expect(basis).toContain('RA 11032')
    expect(basis).toContain('Sec. 9(b)(1)')
    expect(basis).toContain('3 working days')
  })

  it('does not repeat the law name when the sections already carry it', () => {
    // Regression: an early version produced "RA 7160, RA 7160 Sec. 152(c)".
    const basis = documentLegalBasis('business_clearance')
    expect(basis.match(/RA 7160/g)).toHaveLength(1)
  })

  it('falls back to the general RA 11032 citation for an unknown document', () => {
    expect(documentLegalBasis('made_up')).toContain('RA 11032')
  })
})

describe('Philippine holidays', () => {
  const h2026 = philippineHolidays(2026)

  it('includes the fixed regular holidays', () => {
    for (const day of ['2026-01-01', '2026-04-09', '2026-05-01', '2026-06-12',
                       '2026-11-30', '2026-12-25', '2026-12-30']) {
      expect(h2026, day).toContain(day)
    }
  })

  it('computes the movable Holy Week dates (Easter 2026 falls on 5 April)', () => {
    expect(h2026).toContain('2026-04-02') // Maundy Thursday
    expect(h2026).toContain('2026-04-03') // Good Friday
    expect(h2026).toContain('2026-04-04') // Black Saturday
  })

  it('computes National Heroes Day as the last Monday of August', () => {
    expect(h2026).toContain('2026-08-31')
    expect(philippineHolidays(2025)).toContain('2025-08-25')
  })

  it('includes the special non-working days offices close for', () => {
    expect(h2026).toContain('2026-08-21') // Ninoy Aquino Day
    expect(h2026).toContain('2026-11-01') // All Saints'
    expect(h2026).toContain('2026-12-08') // Immaculate Conception
    expect(h2026).toContain('2026-12-31')
  })
})

describe('isWorkingDay', () => {
  it('excludes weekends', () => {
    expect(isWorkingDay(ph('2026-08-15' + MORNING))).toBe(false) // Saturday
    expect(isWorkingDay(ph('2026-08-16' + MORNING))).toBe(false) // Sunday
    expect(isWorkingDay(ph('2026-08-17' + MORNING))).toBe(true)  // Monday
  })

  it('excludes holidays', () => {
    expect(isWorkingDay(ph('2026-12-25' + MORNING))).toBe(false)
    expect(isWorkingDay(ph('2026-08-21' + MORNING))).toBe(false) // Ninoy Aquino Day
  })
})

describe('workingDeadline — the clock a barangay is held to', () => {
  it('counts from the NEXT working day, not the day of filing', () => {
    // Filed Monday 17 Aug 2026, 3 working days -> Tue, Wed, Thu.
    expect(workingDeadline(ph('2026-08-17' + MORNING), 3).toISOString())
      .toBe('2026-08-20' + CLOSE_OF_BUSINESS)
  })

  it('lands at close of business, not the same clock time as the request', () => {
    const due = workingDeadline(ph('2026-08-17T00:30:00Z'), 3)
    expect(due.toISOString()).toBe('2026-08-20' + CLOSE_OF_BUSINESS)
  })

  it('skips the weekend — Friday plus 3 is the following Wednesday', () => {
    expect(workingDeadline(ph('2026-08-14' + MORNING), 3).toISOString())
      .toBe('2026-08-19' + CLOSE_OF_BUSINESS)
  })

  it('skips a holiday inside the window', () => {
    // Filed Thu 20 Aug 2026. Fri 21st is Ninoy Aquino Day, then the weekend,
    // so the three working days are Mon 24, Tue 25, Wed 26.
    expect(workingDeadline(ph('2026-08-20' + MORNING), 3).toISOString())
      .toBe('2026-08-26' + CLOSE_OF_BUSINESS)
  })

  it('handles a business clearance across Christmas', () => {
    // Filed Mon 21 Dec 2026. Non-working: 24th, 25th, weekends, 30th, 31st.
    const due = workingDeadline(ph('2026-12-21' + MORNING), 7)
    expect(isWorkingDay(due)).toBe(true)
    expect(due.getTime()).toBeGreaterThan(ph('2027-01-01').getTime())
  })

  it('always lands on a working day, whatever the start', () => {
    for (const start of ['2026-01-01', '2026-04-03', '2026-08-15', '2026-12-24']) {
      expect(isWorkingDay(workingDeadline(ph(start + MORNING), 3)), start).toBe(true)
    }
  })
})

describe('workingDaysBetween', () => {
  it('counts working days forward', () => {
    expect(workingDaysBetween(ph('2026-08-17' + MORNING), ph('2026-08-20' + MORNING))).toBe(3)
  })

  it('goes negative once the deadline is behind you', () => {
    expect(workingDaysBetween(ph('2026-08-20' + MORNING), ph('2026-08-17' + MORNING))).toBe(-3)
  })

  it('is zero within the same Philippine day', () => {
    expect(workingDaysBetween(ph('2026-08-17T01:00:00Z'), ph('2026-08-17T08:00:00Z'))).toBe(0)
  })
})

describe('deadlineState — RA 11032 Sec. 10', () => {
  const request = (over = {}) => ({
    status: 'pending',
    processing_days: 3,
    due_at: '2026-08-20' + CLOSE_OF_BUSINESS,
    ...over,
  })

  it('is calm while there is time left', () => {
    const s = deadlineState(request(), ph('2026-08-18' + MORNING).getTime())
    expect(s.overdue).toBe(false)
    expect(s.deemedApproved).toBe(false)
    expect(s.level).toBe('ok')
  })

  it('warns on the last day', () => {
    const s = deadlineState(request(), ph('2026-08-20' + MORNING).getTime())
    expect(s.level).toBe('due')
    expect(s.label).toBe('Due today')
  })

  it('deems the request approved once the deadline passes undecided', () => {
    const s = deadlineState(request(), ph('2026-08-21' + MORNING).getTime())
    expect(s.overdue).toBe(true)
    expect(s.deemedApproved).toBe(true)
    expect(s.level).toBe('breach')
    expect(s.label).toMatch(/Sec\. 10/)
  })

  it('does NOT deem a decided request approved, however late it is read', () => {
    for (const status of ['released', 'denied']) {
      const s = deadlineState(
        request({ status, released_at: '2026-08-19' + MORNING }),
        ph('2027-01-01').getTime()
      )
      expect(s.deemedApproved, status).toBe(false)
      expect(s.decided, status).toBe(true)
    }
  })

  it('records that a release landed after the deadline', () => {
    const s = deadlineState(
      request({ status: 'released', released_at: '2026-08-25' + MORNING }),
      ph('2026-08-26').getTime()
    )
    expect(s.level).toBe('late')
    expect(s.label).toMatch(/past the RA 11032 deadline/i)
  })

  it('stays quiet rather than throwing when a row has no deadline', () => {
    const s = deadlineState({ status: 'pending' })
    expect(s.deemedApproved).toBe(false)
    expect(s.label).toBeNull()
  })
})
