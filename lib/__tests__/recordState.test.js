import { describe, it, expect } from 'vitest'
import {
  isSettled, toneFor, progressOf, partitionByLiveness, TONE_RAIL,
} from '@/lib/recordState'

/**
 * The card layout turns entirely on "is this still going?", so a wrong
 * answer here does not render slightly off — it files an open report away
 * in the archive where nobody looks at it.
 */

describe('isSettled', () => {
  it('knows each list\'s own word for finished', () => {
    // Four lists, four vocabularies, one question.
    expect(isSettled('resolved')).toBe(true)   // incidents
    expect(isSettled('closed')).toBe(true)     // tickets
    expect(isSettled('released')).toBe(true)   // documents
    expect(isSettled('settled')).toBe(true)    // blotter
  })

  it('counts a denial as finished — decided is decided', () => {
    expect(isSettled('denied')).toBe(true)
  })

  it('keeps anything still moving out of the archive', () => {
    for (const s of ['pending', 'assigned', 'open', 'in_progress', 'filed', 'mediation']) {
      expect(isSettled(s), s).toBe(false)
    }
  })

  it('treats an unrecognised status as still going, not as finished', () => {
    // Erring this way puts a surprise status at the top of the list as a
    // full card. Erring the other way would hide an open report.
    expect(isSettled('escalated_to_city')).toBe(false)
    expect(isSettled(undefined)).toBe(false)
    expect(isSettled(null)).toBe(false)
    expect(isSettled('')).toBe(false)
  })

  it('is not thrown by casing from a hand-written status', () => {
    expect(isSettled('Resolved')).toBe(true)
    expect(isSettled('RESOLVED')).toBe(true)
  })
})

describe('toneFor — the rail colour', () => {
  it('separates waiting from being handled from done', () => {
    expect(toneFor('pending')).toBe('waiting')
    expect(toneFor('assigned')).toBe('active')
    expect(toneFor('in_progress')).toBe('active')
    expect(toneFor('resolved')).toBe('done')
  })

  it('greys a denial rather than showing it as a success', () => {
    // Emerald on a denied request would read as "you got it".
    expect(toneFor('denied')).toBe('closed')
    expect(toneFor('released')).toBe('done')
  })

  it('turns red on a missed deadline, but only while still open', () => {
    expect(toneFor('pending', { breached: true })).toBe('overdue')
    // A request the barangay decided late is decided; the clock has stopped.
    expect(toneFor('released', { breached: true })).toBe('done')
  })

  it('maps every tone it can return to a rail colour', () => {
    const tones = ['waiting', 'active', 'done', 'closed', 'overdue']
    for (const t of tones) expect(TONE_RAIL[t], t).toMatch(/^#[0-9a-f]{6}$/i)
  })
})

describe('progressOf', () => {
  it('places a record on the three-step track', () => {
    expect(progressOf('pending')).toBe(0)
    expect(progressOf('assigned')).toBe(1)
    expect(progressOf('resolved')).toBe(2)
  })

  it('never returns a step outside the track it draws', () => {
    for (const s of ['pending', 'assigned', 'resolved', 'denied', 'nonsense', undefined]) {
      const at = progressOf(s)
      expect(at, String(s)).toBeGreaterThanOrEqual(0)
      expect(at, String(s)).toBeLessThanOrEqual(2)
    }
  })
})

describe('partitionByLiveness', () => {
  const list = [
    { id: 1, status: 'resolved' },
    { id: 2, status: 'pending' },
    { id: 3, status: 'resolved' },
    { id: 4, status: 'assigned' },
  ]

  it('splits the two groups the layout renders', () => {
    const { live, done } = partitionByLiveness(list)
    expect(live.map(i => i.id)).toEqual([2, 4])
    expect(done.map(i => i.id)).toEqual([1, 3])
  })

  it('keeps each side in the order it arrived', () => {
    // The lists come back newest-first from Supabase; re-sorting here would
    // silently override that.
    const { done } = partitionByLiveness(list)
    expect(done.map(i => i.id)).toEqual([1, 3])
  })

  it('loses nothing — every record lands on exactly one side', () => {
    const { live, done } = partitionByLiveness(list)
    expect(live.length + done.length).toBe(list.length)
  })

  it('accepts a list\'s own definition of finished', () => {
    // Blotter cases are "open" at filed, mediation and pangkat, which the
    // generic rule does not know.
    const cases = [
      { id: 'a', status: 'pangkat' },
      { id: 'b', status: 'cfa_issued' },
      { id: 'c', status: 'filed' },
    ]
    const openStages = new Set(['filed', 'mediation', 'pangkat'])
    const { live, done } = partitionByLiveness(cases, k => !openStages.has(k.status))
    expect(live.map(c => c.id)).toEqual(['a', 'c'])
    expect(done.map(c => c.id)).toEqual(['b'])
  })

  it('handles an empty or missing list without throwing', () => {
    expect(partitionByLiveness([])).toEqual({ live: [], done: [] })
    expect(partitionByLiveness(undefined)).toEqual({ live: [], done: [] })
  })
})
