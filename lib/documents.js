/**
 * Barangay document requests, and the clock RA 11032 puts on them.
 *
 * RA 11032 — the Ease of Doing Business and Efficient Government Service
 * Delivery Act of 2018, which amended RA 9485 (Anti-Red Tape Act of 2007) —
 * is not advisory. It sets a hard ceiling on how long a barangay may sit on
 * a request:
 *
 *   Sec. 6        Every office must publish a Citizen's Charter stating,
 *                 for each service, its requirements and its processing
 *                 time. That is what DOCUMENT_TYPES below is.
 *
 *   Sec. 9(b)(1)  The processing time may not exceed
 *                     3 WORKING DAYS  — simple transactions
 *                     7 working days  — complex transactions
 *                    20 working days  — highly technical transactions
 *                 counted from receipt of the complete application. It may
 *                 be extended ONCE, for the same number of days.
 *
 *   Sec. 10       If the office neither approves nor denies within the
 *                 prescribed time, the request is DEEMED APPROVED, provided
 *                 the requirements were complete and the fees paid. The
 *                 acknowledgement receipt then has the same force as the
 *                 document itself.
 *
 * Two consequences shape this file:
 *
 *   1. WORKING days, not calendar days. A request filed on a Friday before
 *      a long weekend is not late on Monday. Weekends and Philippine
 *      holidays are excluded — see workingDeadline().
 *
 *   2. The deadline is FROZEN onto the request row when it is filed, along
 *      with the classification and the citation. A request must be judged
 *      against the deadline it was actually subject to, not against a
 *      holiday table someone edited afterwards.
 *
 * Citations verified against LawPhil, the Supreme Court E-Library and the
 * RA 11032 IRR (CSC–ARTA–DTI Joint Memorandum Circular No. 2019-001).
 */

// ─────────────────────────────────────────────────────────────────────────
// RA 11032 Sec. 9(b)(1) — the statutory ceilings
// ─────────────────────────────────────────────────────────────────────────
export const RA_11032_LIMITS = {
  simple: 3,
  complex: 7,
  highly_technical: 20,
}

export const CLASSIFICATION_LABEL = {
  simple: 'Simple transaction',
  complex: 'Complex transaction',
  highly_technical: 'Highly technical transaction',
}

// Offices close at 5pm. A deadline of "the third working day" means the end
// of that day's business, not the same clock time the request came in.
const CLOSE_OF_BUSINESS_HOUR = 17

// The Philippines has had no daylight saving since 1978, so a fixed offset
// is exact — and it keeps this arithmetic independent of whatever timezone
// the resident's phone happens to be in.
const PH_OFFSET_MS = 8 * 60 * 60 * 1000

// ─────────────────────────────────────────────────────────────────────────
// The barangay's Citizen's Charter (RA 11032 Sec. 6)
//
// `classification` picks the statutory ceiling; `days` restates it so the
// value written onto the request row is explicit rather than inferred.
// ─────────────────────────────────────────────────────────────────────────
export const DOCUMENT_TYPES = {
  barangay_clearance: {
    label: 'Barangay Clearance',
    blurb: 'General-purpose clearance certifying you have no pending barangay case.',
    icon: '📄',
    color: '#5B54E8',
    bg: '#f0effe',
    classification: 'simple',
    days: 3,
    law: 'RA 11032',
    sections: 'Sec. 9(b)(1)',
    lawTitle: 'Ease of Doing Business and Efficient Government Service Delivery Act of 2018',
    requirements: [
      'Verified resident account',
      'Valid government-issued ID',
      'Stated purpose for the clearance',
    ],
    feeNote: 'A reasonable fee may be charged under the barangay’s revenue ordinance.',
  },
  certificate_of_residency: {
    label: 'Certificate of Residency',
    blurb: 'Certifies that you actually reside in this barangay.',
    icon: '🏠',
    color: '#0891b2',
    bg: '#ecfeff',
    classification: 'simple',
    days: 3,
    law: 'RA 11032',
    sections: 'Sec. 9(b)(1)',
    lawTitle: 'Ease of Doing Business and Efficient Government Service Delivery Act of 2018',
    requirements: [
      'Verified resident account',
      'Valid government-issued ID showing your address',
    ],
    feeNote: 'A reasonable fee may be charged under the barangay’s revenue ordinance.',
  },
  certificate_of_indigency: {
    label: 'Certificate of Indigency',
    blurb: 'Certifies indigent status for medical, educational or legal assistance.',
    icon: '🤝',
    color: '#16a34a',
    bg: '#f0fdf4',
    classification: 'simple',
    days: 3,
    law: 'RA 11032',
    sections: 'Sec. 9(b)(1)',
    lawTitle: 'Ease of Doing Business and Efficient Government Service Delivery Act of 2018',
    requirements: [
      'Verified resident account',
      'Valid government-issued ID',
      'The office or programme the certificate is for',
    ],
    feeNote: 'Issued free of charge — this certificate exists precisely because the applicant cannot pay.',
  },
  first_time_jobseeker: {
    label: 'First-Time Jobseeker Certificate',
    blurb: 'Certifies you are a first-time jobseeker, waiving fees on the documents employers ask for.',
    icon: '💼',
    color: '#f97316',
    bg: '#fff7ed',
    classification: 'simple',
    days: 3,
    law: 'RA 11032',
    sections: 'Sec. 9(b)(1)',
    lawTitle: 'Ease of Doing Business and Efficient Government Service Delivery Act of 2018',
    alsoCited: 'RA 11261 (First Time Jobseekers Assistance Act of 2019) — the barangay '
             + 'certification is issued free of charge and the benefits run for one year '
             + 'from its issuance.',
    requirements: [
      'Verified resident account with at least 6 months’ residency',
      'Valid government-issued ID',
      'Sworn statement that this is your first time looking for work',
    ],
    feeNote: 'Free of charge under RA 11261, and valid for one (1) year from issuance.',
  },
  barangay_id: {
    label: 'Barangay ID',
    blurb: 'Barangay-issued identification card for residents.',
    icon: '🪪',
    color: '#7c3aed',
    bg: '#f5f3ff',
    classification: 'simple',
    days: 3,
    law: 'RA 11032',
    sections: 'Sec. 9(b)(1)',
    lawTitle: 'Ease of Doing Business and Efficient Government Service Delivery Act of 2018',
    requirements: [
      'Verified resident account',
      'Valid government-issued ID',
      'Recent 1x1 photo',
    ],
    feeNote: 'A reasonable fee may be charged under the barangay’s revenue ordinance.',
  },
  business_clearance: {
    label: 'Barangay Business Clearance',
    blurb: 'Barangay clearance required before the city or municipality issues a business permit.',
    icon: '🏪',
    color: '#b45309',
    bg: '#fffbeb',
    // Longer by statute, not by preference: RA 7160 Sec. 152(c) gives the
    // barangay seven working days on a business clearance, after which the
    // city or municipality may issue the permit without it.
    classification: 'complex',
    days: 7,
    law: 'RA 7160',
    sections: 'Sec. 152(c)',
    lawTitle: 'Local Government Code of 1991',
    alsoCited: 'RA 11032 Secs. 9(b)(1) and 11(f) — business-related barangay clearances '
             + 'are applied for, issued and collected at the city or municipality, which '
             + 'remits the fee to the barangay.',
    requirements: [
      'Verified resident or business owner account',
      'DTI or SEC registration',
      'Proof of the business address (lease or title)',
    ],
    feeNote:
      'The sangguniang barangay may impose a reasonable fee (RA 7160 Sec. 152(c)). Under '
      + 'RA 11032 Sec. 11(f), business-related barangay clearances are applied for, issued '
      + 'and collected at the city or municipality, which remits the fee to the barangay.',
  },
  good_moral_character: {
    label: 'Certificate of Good Moral Character',
    blurb: 'Certifies you have no derogatory record on file with the barangay.',
    icon: '🎓',
    color: '#be185d',
    bg: '#fdf2f8',
    classification: 'simple',
    days: 3,
    law: 'RA 11032',
    sections: 'Sec. 9(b)(1)',
    lawTitle: 'Ease of Doing Business and Efficient Government Service Delivery Act of 2018',
    requirements: [
      'Verified resident account',
      'Valid government-issued ID',
      'The school or employer the certificate is for',
    ],
    feeNote: 'A reasonable fee may be charged under the barangay’s revenue ordinance.',
  },
}

/** The Citizen's Charter as an ordered list, fastest services first. */
export const DOCUMENT_TYPE_LIST = Object.entries(DOCUMENT_TYPES)
  .map(([value, d]) => ({ value, ...d }))
  .sort((a, b) => a.days - b.days || a.label.localeCompare(b.label))

export function getDocumentType(key) {
  return DOCUMENT_TYPES[key] || null
}

/** Frozen onto the request row so the citation survives edits to this file. */
export function documentLegalBasis(key) {
  const d = DOCUMENT_TYPES[key]
  if (!d) return 'RA 11032, Sec. 9(b)(1) — Ease of Doing Business and Efficient Government Service Delivery Act of 2018'
  const base = `${d.law}, ${d.sections} — ${d.lawTitle}`
  const window = `${CLASSIFICATION_LABEL[d.classification].toLowerCase()}: ${d.days} working days`
  return d.alsoCited ? `${base} (${window}). Also: ${d.alsoCited}` : `${base} (${window})`
}

// ─────────────────────────────────────────────────────────────────────────
// Philippine working days
// ─────────────────────────────────────────────────────────────────────────

const pad = (n) => String(n).padStart(2, '0')

/** The Philippine calendar date of an instant, as { y, m, d } (m is 0-based). */
function phParts(date) {
  const shifted = new Date(date.getTime() + PH_OFFSET_MS)
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth(), d: shifted.getUTCDate() }
}

/** 'YYYY-MM-DD' for a { y, m, d }. */
function dayKey({ y, m, d }) {
  return `${y}-${pad(m + 1)}-${pad(d)}`
}

/** The instant of `hour`:00 Philippine time on a Philippine calendar date. */
function phInstant({ y, m, d }, hour) {
  return new Date(Date.UTC(y, m, d, hour) - PH_OFFSET_MS)
}

/** 0 = Sunday … 6 = Saturday, for a Philippine calendar date. */
function weekday({ y, m, d }) {
  return new Date(Date.UTC(y, m, d)).getUTCDay()
}

/** Anonymous Gregorian computus — Easter Sunday as { y, m, d }. */
function easterSunday(year) {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const dd = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - dd - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return { y: year, m: month - 1, d: day }
}

function shiftDays({ y, m, d }, delta) {
  const t = new Date(Date.UTC(y, m, d + delta))
  return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate() }
}

/** Last Monday of August — National Heroes Day. */
function nationalHeroesDay(year) {
  const lastDay = new Date(Date.UTC(year, 7, 31))
  const back = (lastDay.getUTCDay() + 6) % 7 // days since the previous Monday
  return { y: year, m: 7, d: 31 - back }
}

/**
 * Holidays that move with the Islamic calendar (Eid'l Fitr, Eid'l Adha) or
 * are added by proclamation (Chinese New Year, bridging days) cannot be
 * computed — Malacañang proclaims them each year. Add them here when the
 * proclamation for a new year comes out.
 *
 * A missing entry makes the computed deadline EARLIER than the law allows,
 * which holds the barangay to a tighter clock than RA 11032 requires. That
 * is the safe direction to be wrong in, but it is still worth keeping
 * current.
 */
export const PROCLAIMED_NON_WORKING_DAYS = {
  2025: [
    '2025-01-29', // Chinese New Year
    '2025-03-31', // Eid'l Fitr
    '2025-06-06', // Eid'l Adha
    '2025-11-01', // All Saints' Day (special non-working)
    '2025-12-24', // Christmas Eve
  ],
  2026: [
    '2026-02-17', // Chinese New Year
    '2026-11-02', // All Souls' Day
    '2026-12-24', // Christmas Eve
    // Eid'l Fitr and Eid'l Adha 2026: add once proclaimed.
  ],
}

const holidayCache = new Map()

/**
 * Every day in `year` on which barangay offices are closed: regular
 * holidays (RA 9492 / EO 292 as amended) and special non-working days.
 * Special WORKING days are deliberately absent — offices stay open.
 */
export function philippineHolidays(year) {
  if (holidayCache.has(year)) return holidayCache.get(year)

  const easter = easterSunday(year)
  const days = [
    { y: year, m: 0, d: 1 },      // New Year's Day
    shiftDays(easter, -3),        // Maundy Thursday
    shiftDays(easter, -2),        // Good Friday
    shiftDays(easter, -1),        // Black Saturday (special non-working)
    { y: year, m: 3, d: 9 },      // Araw ng Kagitingan
    { y: year, m: 4, d: 1 },      // Labor Day
    { y: year, m: 5, d: 12 },     // Independence Day
    { y: year, m: 7, d: 21 },     // Ninoy Aquino Day (special non-working)
    nationalHeroesDay(year),      // National Heroes Day
    { y: year, m: 10, d: 1 },     // All Saints' Day (special non-working)
    { y: year, m: 10, d: 30 },    // Bonifacio Day
    { y: year, m: 11, d: 8 },     // Immaculate Conception (special non-working)
    { y: year, m: 11, d: 25 },    // Christmas Day
    { y: year, m: 11, d: 30 },    // Rizal Day
    { y: year, m: 11, d: 31 },    // Last day of the year (special non-working)
  ]

  const set = new Set(days.map(dayKey))
  for (const key of PROCLAIMED_NON_WORKING_DAYS[year] || []) set.add(key)

  holidayCache.set(year, set)
  return set
}

/** True when barangay offices are open on that Philippine calendar date. */
function isWorkingDate(parts) {
  const dow = weekday(parts)
  if (dow === 0 || dow === 6) return false
  return !philippineHolidays(parts.y).has(dayKey(parts))
}

/** True when `date` falls on a Philippine working day. */
export function isWorkingDay(date) {
  return isWorkingDate(phParts(new Date(date)))
}

/**
 * The RA 11032 Sec. 9(b)(1) deadline: close of business on the Nth working
 * day after the request was received.
 *
 * Day 0 is the day of filing — the count starts on the next working day, so
 * a request filed Friday afternoon with a 3-day limit is due at 5pm the
 * following Wednesday, not Monday.
 */
export function workingDeadline(from, workingDays) {
  let parts = phParts(new Date(from))
  let remaining = Math.max(1, Math.round(workingDays))

  while (remaining > 0) {
    parts = shiftDays(parts, 1)
    if (isWorkingDate(parts)) remaining -= 1
  }
  return phInstant(parts, CLOSE_OF_BUSINESS_HOUR)
}

/** Working days between two instants; negative once the deadline has passed. */
export function workingDaysBetween(from, to) {
  const start = new Date(from)
  const end = new Date(to)
  const sign = end >= start ? 1 : -1
  const [a, b] = sign === 1 ? [start, end] : [end, start]

  let parts = phParts(a)
  const endKey = dayKey(phParts(b))
  let count = 0

  while (dayKey(parts) !== endKey) {
    parts = shiftDays(parts, 1)
    if (isWorkingDate(parts)) count += 1
  }
  return count * sign
}

// ─────────────────────────────────────────────────────────────────────────
// Request state
// ─────────────────────────────────────────────────────────────────────────

export const DOC_STATUS_STYLE = {
  pending:    { label: 'Received',   color: '#f97316', bg: '#fff7ed', desc: 'Waiting to be picked up by an official' },
  processing: { label: 'Processing', color: '#3b82f6', bg: '#eff6ff', desc: 'Being prepared' },
  ready:      { label: 'Ready',      color: '#5B54E8', bg: '#f0effe', desc: 'Ready for pickup at the barangay hall' },
  released:   { label: 'Released',   color: '#22c55e', bg: '#f0fdf4', desc: 'Handed to the requester' },
  denied:     { label: 'Denied',     color: '#ef4444', bg: '#fef2f2', desc: 'Denied in writing, with the reason stated' },
}

/** Statuses that mean the office has acted, so the clock has stopped. */
const DECIDED = new Set(['released', 'denied'])

/**
 * Where a request stands against its RA 11032 deadline.
 *
 * `deemedApproved` is the one that matters: past the deadline with no
 * decision, Sec. 10 says the request is approved whether or not the office
 * has done anything. Surfacing it is the point — an SLA nobody can see is
 * one nobody is held to.
 */
export function deadlineState(request, now = Date.now()) {
  if (!request?.due_at) {
    return { decided: false, overdue: false, deemedApproved: false, workingDaysLeft: null, label: null, level: 'ok' }
  }

  const due = new Date(request.due_at)
  const decided = DECIDED.has(request.status)

  if (decided) {
    const when = request.released_at ? new Date(request.released_at) : null
    const late = when ? when > due : false
    return {
      decided: true,
      overdue: false,
      deemedApproved: false,
      workingDaysLeft: null,
      level: late ? 'late' : 'ok',
      label: late ? 'Released past the RA 11032 deadline' : null,
    }
  }

  const overdue = now > due.getTime()
  const daysLeft = workingDaysBetween(now, due)

  if (overdue) {
    return {
      decided: false,
      overdue: true,
      // Sec. 10 applies to an undecided request whose time has run out.
      deemedApproved: true,
      workingDaysLeft: daysLeft,
      level: 'breach',
      label: 'Deemed approved — RA 11032 Sec. 10',
    }
  }

  return {
    decided: false,
    overdue: false,
    deemedApproved: false,
    workingDaysLeft: daysLeft,
    level: daysLeft <= 1 ? 'due' : 'ok',
    label: daysLeft <= 0
      ? 'Due today'
      : `${daysLeft} working day${daysLeft === 1 ? '' : 's'} left`,
  }
}

export const DEADLINE_STYLE = {
  ok:     { color: '#22c55e', bg: '#f0fdf4', border: '#dcfce7' },
  due:    { color: '#b45309', bg: '#fffbeb', border: '#fef3c7' },
  breach: { color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
  late:   { color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
}

/** "Wed, 3 Sep 2026, 5:00 PM" in Philippine time. */
export function formatDeadline(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}
