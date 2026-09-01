import { describe, it, expect } from 'vitest'
import {
  KP_PERIODS, KP_EXCLUSIONS, CATEGORY_KP_HINTS, CASE_STATUS,
  assessEligibility, summonDeadline, mediationDeadline, pangkatDeadline,
  repudiationDeadline, addDays, daysBetween, stageDeadline, availableActions, isOpen,
} from '@/lib/katarungan'

const NOW = Date.parse('2026-08-20T02:00:00Z')

describe('RA 7160 periods', () => {
  it('matches the Act: 15 days to mediate, 15 for the pangkat, 15 more at most', () => {
    expect(KP_PERIODS.mediationDays).toBe(15)
    expect(KP_PERIODS.pangkatDays).toBe(15)
    expect(KP_PERIODS.pangkatExtensionDays).toBe(15)
  })

  it('gives 10 days to repudiate, and 10 before a settlement becomes final', () => {
    expect(KP_PERIODS.repudiationDays).toBe(10)
    expect(KP_PERIODS.finalityDays).toBe(10)
  })
})

describe('RA 9262 Sec. 33 — the dispute the barangay must not touch', () => {
  it('marks VAWC as prohibited, not merely ineligible', () => {
    expect(KP_EXCLUSIONS.vawc.prohibited).toBe(true)
    expect(KP_EXCLUSIONS.vawc.citation).toBe('RA 9262, Sec. 33')
  })

  it('distinguishes a prohibition from an ordinary exclusion', () => {
    const vawc = assessEligibility(['vawc'])
    const ordinary = assessEligibility(['parties_different_lgu'])

    expect(vawc.prohibited).toBe(true)
    expect(vawc.eligible).toBe(false)
    expect(vawc.summary).toMatch(/must not mediate/i)

    // An ineligible dispute is simply referred onward; this one must not be
    // scheduled for mediation at all.
    expect(ordinary.prohibited).toBe(false)
    expect(ordinary.eligible).toBe(false)
    expect(ordinary.summary).toMatch(/refer/i)
  })

  it('tells the official what to do instead', () => {
    expect(KP_EXCLUSIONS.vawc.consequence).toMatch(/Protection Order/i)
    expect(KP_EXCLUSIONS.vawc.consequence).toMatch(/Women and Children/i)
  })

  it('does not assume every "Violence" incident is VAWC — it asks', () => {
    // A scuffle between neighbours IS conciliable; domestic abuse is not.
    // Only the person taking the complaint knows which this is.
    expect(CATEGORY_KP_HINTS.Violence.suggest).toEqual([])
    expect(CATEGORY_KP_HINTS.Violence.prompt).toMatch(/9262/)
  })
})

describe('Sec. 408 exceptions', () => {
  it('cites a section for every exclusion', () => {
    for (const [key, x] of Object.entries(KP_EXCLUSIONS)) {
      expect(x.label, key).toBeTruthy()
      expect(x.citation, key).toMatch(/^RA \d+/)
    }
  })

  it('treats a dispute with no exclusions as within the Lupon', () => {
    const a = assessEligibility([])
    expect(a.eligible).toBe(true)
    expect(a.blocking).toEqual([])
    expect(a.legalBasis).toMatch(/Secs\. 408 and 412/)
  })

  it('records every reason it is out, not just the first', () => {
    const a = assessEligibility(['penalty_exceeds_limit', 'no_private_offended_party'])
    expect(a.blocking).toHaveLength(2)
    expect(a.legalBasis).toMatch(/408\(c\)/)
    expect(a.legalBasis).toMatch(/408\(d\)/)
  })

  it('ignores keys it does not recognise rather than inventing an exclusion', () => {
    expect(assessEligibility(['not_a_real_exclusion']).eligible).toBe(true)
  })

  it('suggests the obvious exclusions for an illegal-drugs incident', () => {
    expect(CATEGORY_KP_HINTS.Drugs.suggest).toContain('no_private_offended_party')
    expect(CATEGORY_KP_HINTS.Drugs.suggest).toContain('penalty_exceeds_limit')
  })
})

describe('the clocks', () => {
  it('summons by the next WORKING day, skipping weekends and holidays', () => {
    // Filed Friday 14 Aug 2026 -> Monday 17th.
    expect(summonDeadline(new Date('2026-08-14T02:00:00Z')).toISOString())
      .toBe('2026-08-17T09:00:00.000Z')
    // Filed Thursday 20 Aug — Friday 21st is Ninoy Aquino Day -> Monday 24th.
    expect(summonDeadline(new Date('2026-08-20T02:00:00Z')).toISOString())
      .toBe('2026-08-24T09:00:00.000Z')
  })

  it('counts mediation and pangkat in CALENDAR days — the Act does not say working', () => {
    // 15 calendar days from Mon 3 Aug spans two weekends and lands on the 18th.
    expect(mediationDeadline('2026-08-03T02:00:00Z').toISOString().slice(0, 10)).toBe('2026-08-18')
    expect(pangkatDeadline('2026-08-03T02:00:00Z').toISOString().slice(0, 10)).toBe('2026-08-18')
  })

  it('adds the single Sec. 410(e) extension when it has been used', () => {
    expect(pangkatDeadline('2026-08-03T02:00:00Z', true).toISOString().slice(0, 10)).toBe('2026-09-02')
  })

  it('gives 10 days to repudiate a settlement', () => {
    expect(repudiationDeadline('2026-08-03T02:00:00Z').toISOString().slice(0, 10)).toBe('2026-08-13')
  })

  it('does basic day arithmetic across a month boundary', () => {
    expect(addDays('2026-01-31T00:00:00Z', 1).toISOString().slice(0, 10)).toBe('2026-02-01')
    expect(daysBetween('2026-08-01T00:00:00Z', '2026-08-11T00:00:00Z')).toBe(10)
    expect(daysBetween('2026-08-11T00:00:00Z', '2026-08-01T00:00:00Z')).toBe(-10)
  })
})

describe('stageDeadline — which clock is running', () => {
  const kase = (over) => ({ status: 'filed', lupon_eligible: true, ...over })

  it('watches the summons while a case is only filed', () => {
    const s = stageDeadline(kase({ summon_due_at: '2026-08-24T09:00:00Z' }), NOW)
    expect(s.label).toMatch(/Summon/)
    expect(s.citation).toBe('RA 7160, Sec. 410(b)')
    // Always "due", never "ok": a next-working-day obligation has nothing to
    // wait for, so it should read as actionable the moment the case is filed
    // — unlike a 15-day mediation period, where 3 days out is the warning.
    expect(s.level).toBe('due')
  })

  it('still breaches the summons once its working day has passed', () => {
    const s = stageDeadline(kase({ summon_due_at: '2026-08-18T09:00:00Z' }), NOW)
    expect(s.level).toBe('breach')
  })

  it('flags a breach once the mediation period has run out', () => {
    const s = stageDeadline(
      kase({ status: 'mediation', mediation_due_at: '2026-08-10T09:00:00Z' }), NOW)
    expect(s.level).toBe('breach')
    expect(s.daysLeft).toBeLessThan(0)
  })

  it('says when the pangkat period has already been extended', () => {
    const s = stageDeadline(
      kase({ status: 'pangkat', pangkat_due_at: '2026-09-10T09:00:00Z', pangkat_extended: true }), NOW)
    expect(s.label).toMatch(/extended/i)
    expect(s.citation).toBe('RA 7160, Sec. 410(e)')
  })

  it('shows the repudiation window as a window, not a breach', () => {
    // The barangay cannot "miss" this one — it belongs to the parties.
    const s = stageDeadline(kase({ status: 'settled', settled_at: '2026-08-18T02:00:00Z' }), NOW)
    expect(s.level).toBe('window')
    expect(s.citation).toBe('RA 7160, Sec. 418')
  })

  it('reports a settlement as final once the 10 days have passed', () => {
    const s = stageDeadline(kase({ status: 'settled', settled_at: '2026-07-01T02:00:00Z' }), NOW)
    expect(s.label).toBe('Final and executory')
    expect(s.citation).toBe('RA 7160, Sec. 416')
  })

  it('runs no clock on a closed case', () => {
    for (const status of ['cfa_issued', 'referred', 'withdrawn']) {
      expect(stageDeadline(kase({ status }), NOW).level, status).toBe('none')
    }
  })

  it('does not throw on a null case or a missing timestamp', () => {
    expect(stageDeadline(null).level).toBe('none')
    expect(stageDeadline(kase({ status: 'mediation' })).level).toBe('none')
  })
})

describe('availableActions — the stage machine', () => {
  it('will not let an ineligible case be scheduled for mediation', () => {
    const actions = availableActions({ status: 'filed', lupon_eligible: false })
    expect(actions).not.toContain('record_first_meeting')
    expect(actions).toContain('refer')
  })

  it('lets an eligible case start mediation', () => {
    expect(availableActions({ status: 'filed', lupon_eligible: true }))
      .toContain('record_first_meeting')
  })

  it('offers the pangkat only after mediation, and a CFA only after the pangkat', () => {
    const mediation = availableActions({ status: 'mediation' })
    expect(mediation).toContain('constitute_pangkat')
    expect(mediation).not.toContain('issue_cfa')
    expect(availableActions({ status: 'pangkat' })).toContain('issue_cfa')
  })

  it('offers the extension once and never again', () => {
    expect(availableActions({ status: 'pangkat', pangkat_extended: false })).toContain('extend_pangkat')
    expect(availableActions({ status: 'pangkat', pangkat_extended: true })).not.toContain('extend_pangkat')
  })

  it('lets a repudiated settlement proceed to a CFA', () => {
    expect(availableActions({ status: 'repudiated' })).toContain('issue_cfa')
  })

  it('offers nothing on a closed case', () => {
    expect(availableActions({ status: 'cfa_issued' })).toEqual([])
  })
})

describe('case status metadata', () => {
  it('describes every status the schema allows', () => {
    for (const s of ['filed', 'mediation', 'pangkat', 'settled', 'repudiated',
                     'cfa_issued', 'referred', 'withdrawn']) {
      expect(CASE_STATUS[s], s).toBeTruthy()
      expect(CASE_STATUS[s].desc, s).toBeTruthy()
    }
  })

  it('counts only the live stages as open', () => {
    expect(isOpen({ status: 'mediation' })).toBe(true)
    expect(isOpen({ status: 'settled' })).toBe(false)
    expect(isOpen(null)).toBe(false)
  })
})
