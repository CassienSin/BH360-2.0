import { describe, it, expect } from 'vitest'
import {
  LEGAL_BASIS, CATEGORY_CONFIG, CATEGORY_LIST, PRIORITY_STYLE,
  getPriority, getBasis, getCategoryMeta, citationLabel, citationDetail, mustRefer,
} from '@/lib/legalBasis'

const entries = Object.entries(LEGAL_BASIS)

describe('every category is backed by a stated legal position', () => {
  it('assigns a priority from the four bands', () => {
    for (const [key, b] of entries) {
      expect(['Critical', 'High', 'Medium', 'Low'], key).toContain(b.priority)
    }
  })

  it('says whether the barangay may act or must refer', () => {
    for (const [key, b] of entries) {
      expect(['barangay_response', 'refer_to_agency'], key).toContain(b.responseMode)
    }
  })

  it('names the agency whenever it says to refer — otherwise "refer" is useless', () => {
    for (const [key, b] of entries) {
      if (b.responseMode === 'refer_to_agency') {
        expect(b.agency, `${key} refers but names nobody`).toBeTruthy()
      }
    }
  })

  it('explains its classification', () => {
    for (const [key, b] of entries) expect(b.reason, key).toBeTruthy()
  })
})

describe('citations are checkable, not decorative', () => {
  it('gives sections, the provision text and a source wherever a law is cited', () => {
    for (const [key, b] of entries) {
      if (!b.law) continue
      expect(b.lawTitle, `${key} lawTitle`).toBeTruthy()
      expect(b.sections, `${key} has no section — the citation cannot be checked`).toBeTruthy()
      expect(b.provision, `${key} does not say what the section provides`).toBeTruthy()
      expect(b.source, `${key} has nowhere to read the law`).toMatch(/^https:\/\//)
    }
  })

  it('leaves "Other" honestly unmapped instead of inventing a statute', () => {
    expect(LEGAL_BASIS.Other.law).toBeNull()
    expect(citationLabel('Other')).toBeNull()
    expect(citationDetail('Other')).toBeNull()
  })

  it('builds a short citation and a sectioned one', () => {
    expect(citationLabel('Fire')).toBe('RA 9514 — Fire Code of the Philippines of 2008')
    expect(citationDetail('Violence')).toContain('RA 9262, Secs. 14 and 30')
  })
})

describe('the corrections that prompted this table', () => {
  it('cites RA 9262 Secs. 14 and 30 — NOT Sec. 15, which is court-issued TPOs', () => {
    expect(LEGAL_BASIS.Violence.sections).toBe('Secs. 14 and 30')
    expect(LEGAL_BASIS.Violence.sections).not.toMatch(/\b15\b/)
  })

  it('cites RA 10932 for medical emergencies, not RA 8344 alone', () => {
    expect(LEGAL_BASIS.Medical.law).toBe('RA 10932')
    expect(LEGAL_BASIS.Medical.lawTitle).toMatch(/8344/)
  })

  it('treats theft as an RPC offence, with Lupon conciliation only as a channel', () => {
    expect(LEGAL_BASIS.Theft.law).toMatch(/Act No\. 3815/)
    expect(LEGAL_BASIS.Theft.provision).toMatch(/exceeding one year|EXCLUDES/i)
  })

  it('cites the Revised Penal Code as Act No. 3815, never as an RA', () => {
    for (const [key, b] of entries) {
      if (b.law?.includes('3815')) expect(b.law, key).toMatch(/^Act No\. 3815/)
    }
  })

  it('maps garbage to RA 9003 Sec. 10, a duty the barangay owns by name', () => {
    expect(LEGAL_BASIS.Garbage.law).toBe('RA 9003')
    expect(LEGAL_BASIS.Garbage.sections).toBe('Sec. 10')
  })
})

describe('priority is derived from the category alone', () => {
  it('classifies threats to life as Critical', () => {
    for (const c of ['Fire', 'Medical', 'Violence']) expect(getPriority(c), c).toBe('Critical')
  })

  it('keeps noise at the bottom so it never displaces an emergency', () => {
    expect(getPriority('Noise')).toBe('Low')
  })

  it('falls back to Medium for an unknown category — neither ignored nor urgent', () => {
    expect(getPriority('SomethingNew')).toBe('Medium')
    expect(getBasis('SomethingNew')).toBeNull()
  })

  it('flags the categories the barangay has no authority over', () => {
    expect(mustRefer('Fire')).toBe(true)
    expect(mustRefer('Drugs')).toBe(true)
    expect(mustRefer('Theft')).toBe(false)
  })
})

describe('display metadata is derived, so the UI cannot drift from the law', () => {
  it('covers exactly the categories in LEGAL_BASIS', () => {
    expect(Object.keys(CATEGORY_CONFIG).sort()).toEqual(Object.keys(LEGAL_BASIS).sort())
    expect(CATEGORY_LIST).toHaveLength(entries.length)
  })

  it('exposes both icon and emoji, since the map components ask for emoji', () => {
    for (const [key, meta] of Object.entries(CATEGORY_CONFIG)) {
      expect(meta.icon, key).toBeTruthy()
      expect(meta.emoji, key).toBe(meta.icon)
      expect(meta.color, key).toMatch(/^#/)
      expect(meta.bg, key).toMatch(/^#/)
    }
  })

  it('falls back to Other for an unknown category instead of undefined', () => {
    expect(getCategoryMeta('Nope')).toEqual(CATEGORY_CONFIG.Other)
    expect(getCategoryMeta('Fire').label).toBe('Fire')
  })

  it('orders the report form by severity, emergencies first', () => {
    expect(CATEGORY_LIST[0].priority).toBe('Critical')
    expect(CATEGORY_LIST[CATEGORY_LIST.length - 1].priority).toBe('Low')
  })

  it('styles all four priority bands', () => {
    for (const p of ['Critical', 'High', 'Medium', 'Low']) {
      expect(PRIORITY_STYLE[p], p).toBeTruthy()
    }
  })
})
