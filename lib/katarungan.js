import { workingDeadline } from '@/lib/documents'

/**
 * Katarungang Pambarangay — the barangay justice system.
 *
 * RA 7160 Secs. 399–422 make the barangay the first forum for most disputes
 * between neighbours, and Sec. 412 makes going through it a PRECONDITION to
 * filing in court: without a Certificate to File Action the complaint is
 * dismissible for prematurity. This is the barangay's core judicial
 * function, and it runs on a clock.
 *
 *   Sec. 408    Which disputes the Lupon may take, and seven exceptions.
 *   Sec. 410(b) The chairman summons the respondent by the NEXT WORKING DAY,
 *               and has 15 days from the first meeting to mediate.
 *   Sec. 410(e) The Pangkat then has 15 days from the day it convenes,
 *               extendible ONCE by up to another 15.
 *   Sec. 412    Conciliation failed → the Lupon secretary issues the
 *               Certificate to File Action.
 *   Sec. 416    A settlement has the force of a final judgment after 10 days.
 *   Sec. 418    Either party may repudiate within those 10 days, on the
 *               ground that consent was vitiated by fraud, violence or
 *               intimidation.
 *
 * ONE DISPUTE THE BARANGAY MUST NOT TOUCH
 *
 * Violence against women and their children is not conciliable, and this is
 * not a matter of preference: under RA 9262 Sec. 33 a Punong Barangay or
 * Kagawad who mediates such a case, or influences the victim to compromise
 * or abandon the relief she is seeking, is administratively liable. The
 * offence is a public crime; there is no private settlement to reach. So
 * the assessment below treats it as a PROHIBITION rather than an
 * ineligibility — the difference being that an ineligible dispute is simply
 * referred onward, while this one must not be scheduled for mediation at
 * all, and the barangay's job is a Barangay Protection Order and a referral
 * to the PNP Women and Children Protection Desk.
 *
 * Citations verified against LawPhil, the Supreme Court E-Library and the
 * Revised Katarungang Pambarangay Law and its IRR.
 */

export const KP_PERIODS = {
  summonWorkingDays: 1,      // Sec. 410(b) — "within the next working day"
  mediationDays: 15,         // Sec. 410(b) — from the first meeting
  pangkatDays: 15,           // Sec. 410(e) — from the day it convenes
  pangkatExtensionDays: 15,  // Sec. 410(e) — once, at the pangkat's discretion
  repudiationDays: 10,       // Sec. 418
  finalityDays: 10,          // Sec. 416
}

/**
 * The Sec. 408 exceptions, plus the RA 9262 prohibition.
 *
 * These are presented to the recording official as a checklist rather than
 * inferred, because most of them turn on facts only the person taking the
 * complaint knows — where the parties live, who they work for, what the
 * dispute is worth.
 */
export const KP_EXCLUSIONS = {
  vawc: {
    label: 'Violence against a woman or her child',
    help: 'Any act covered by RA 9262 — physical, sexual, psychological or economic abuse by a partner, former partner or family member.',
    citation: 'RA 9262, Sec. 33',
    prohibited: true,
    consequence: 'The barangay must NOT mediate or conciliate this, and must not press the victim to settle. '
               + 'Issue a Barangay Protection Order under Sec. 14 and refer to the PNP Women and Children Protection Desk.',
  },
  government_party: {
    label: 'The government, or one of its subdivisions or instrumentalities, is a party',
    citation: 'RA 7160, Sec. 408(a)',
  },
  public_officer_official_functions: {
    label: 'A party is a public officer or employee, and the dispute is about their official functions',
    citation: 'RA 7160, Sec. 408(b)',
  },
  penalty_exceeds_limit: {
    label: 'The offence is punishable by more than one year’s imprisonment or a fine over ₱5,000',
    help: 'This is the usual reason a criminal complaint leaves the Lupon.',
    citation: 'RA 7160, Sec. 408(c)',
  },
  no_private_offended_party: {
    label: 'There is no private offended party',
    help: 'Offences against the state — illegal drugs, illegal gambling, and the like.',
    citation: 'RA 7160, Sec. 408(d)',
  },
  real_property_different_lgu: {
    label: 'The dispute involves real property in different cities or municipalities',
    help: 'Unless both parties agree to submit to an appropriate Lupon anyway.',
    citation: 'RA 7160, Sec. 408(e)',
  },
  parties_different_lgu: {
    label: 'The parties actually reside in different cities or municipalities',
    help: 'Unless the barangays adjoin each other and both parties agree.',
    citation: 'RA 7160, Sec. 408(f)',
  },
  juridical_entity: {
    label: 'A party is a corporation, partnership or other juridical entity',
    help: 'The Lupon settles disputes between natural persons.',
    citation: 'RA 7160, Sec. 408 (as construed)',
  },
}

/**
 * What the incident category suggests the official should check.
 *
 * Suggestions, never conclusions. "Violence / Fight" covers both a scuffle
 * between neighbours — which IS conciliable — and domestic abuse, which the
 * barangay is forbidden to mediate. Only the person taking the complaint
 * knows which one is in front of them, so the app asks rather than decides.
 */
export const CATEGORY_KP_HINTS = {
  Violence: {
    suggest: [],
    prompt: 'Is this violence against a woman or her child? If so, RA 9262 Sec. 33 forbids '
          + 'mediating it — tick the first box.',
  },
  Drugs: { suggest: ['no_private_offended_party', 'penalty_exceeds_limit'], prompt: null },
  Theft: {
    suggest: [],
    prompt: 'Check the value involved: over ₱5,000, or punishable by more than a year, takes '
          + 'this outside the Lupon under Sec. 408(c).',
  },
  Fire: { suggest: ['no_private_offended_party'], prompt: null },
  Medical: { suggest: ['no_private_offended_party'], prompt: null },
  Flood: { suggest: ['no_private_offended_party'], prompt: null },
  Noise: { suggest: [], prompt: null },
  Vandalism: { suggest: [], prompt: null },
  Animals: { suggest: [], prompt: null },
  Garbage: { suggest: [], prompt: null },
  Traffic: { suggest: [], prompt: null },
  Infrastructure: { suggest: ['government_party'], prompt: null },
  Other: { suggest: [], prompt: null },
}

/**
 * Can the Lupon take this dispute?
 *
 * @returns {{ eligible:boolean, prohibited:boolean, blocking:Array,
 *             summary:string, legalBasis:string }}
 */
export function assessEligibility(exclusionKeys = []) {
  const blocking = exclusionKeys
    .filter(k => KP_EXCLUSIONS[k])
    .map(k => ({ key: k, ...KP_EXCLUSIONS[k] }))

  const prohibited = blocking.some(b => b.prohibited)
  const eligible = blocking.length === 0

  let summary
  if (prohibited) {
    summary = 'The barangay must not mediate this dispute.'
  } else if (!eligible) {
    summary = 'Outside the Lupon’s authority — record it and refer the parties onward.'
  } else {
    summary = 'Within the Lupon’s authority. Conciliation is a precondition to filing in court.'
  }

  const legalBasis = eligible
    ? 'RA 7160, Secs. 408 and 412 — Katarungang Pambarangay; conciliation is a precondition to court action'
    : blocking.map(b => `${b.citation} — ${b.label}`).join('; ')

  return { eligible, prohibited, blocking, summary, legalBasis }
}

// ─────────────────────────────────────────────────────────────────────────
// The clocks
// ─────────────────────────────────────────────────────────────────────────

/** Calendar days — Secs. 410, 416 and 418 all say "days", not working days. */
export function addDays(from, days) {
  const d = new Date(from)
  d.setDate(d.getDate() + days)
  return d
}

/** Whole days between two instants; negative once `to` is in the past. */
export function daysBetween(from, to) {
  return Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000)
}

/** Sec. 410(b) — the respondent is summoned by the next WORKING day. */
export function summonDeadline(filedAt) {
  return workingDeadline(filedAt, KP_PERIODS.summonWorkingDays)
}

/** Sec. 410(b) — 15 days from the first meeting of the parties. */
export function mediationDeadline(firstMeetingAt) {
  return addDays(firstMeetingAt, KP_PERIODS.mediationDays)
}

/** Sec. 410(e) — 15 days from the day the pangkat convenes, +15 if extended. */
export function pangkatDeadline(convenedAt, extended = false) {
  return addDays(convenedAt, KP_PERIODS.pangkatDays + (extended ? KP_PERIODS.pangkatExtensionDays : 0))
}

/** Sec. 418 — a settlement may be repudiated within 10 days. */
export function repudiationDeadline(settledAt) {
  return addDays(settledAt, KP_PERIODS.repudiationDays)
}

export const CASE_STATUS = {
  filed:      { label: 'Filed',            color: '#f97316', bg: '#fff7ed', desc: 'Awaiting summons to the respondent' },
  mediation:  { label: 'Mediation',        color: '#3b82f6', bg: '#eff6ff', desc: 'Before the Punong Barangay' },
  pangkat:    { label: 'Pangkat',          color: '#5B54E8', bg: '#f0effe', desc: 'Before the Pangkat ng Tagapagkasundo' },
  settled:    { label: 'Settled',          color: '#22c55e', bg: '#f0fdf4', desc: 'Amicable settlement reached' },
  repudiated: { label: 'Repudiated',       color: '#b45309', bg: '#fffbeb', desc: 'Settlement repudiated under Sec. 418' },
  cfa_issued: { label: 'CFA issued',       color: '#dc2626', bg: '#fef2f2', desc: 'Certificate to File Action — the parties may go to court' },
  referred:   { label: 'Referred',         color: '#6b7280', bg: '#f9fafb', desc: 'Outside the Lupon — referred onward' },
  withdrawn:  { label: 'Withdrawn',        color: '#6b7280', bg: '#f9fafb', desc: 'Complainant withdrew' },
}

/** Stages where a clock is still running against the barangay. */
const OPEN_STAGES = new Set(['filed', 'mediation', 'pangkat'])

export function isOpen(kase) {
  return OPEN_STAGES.has(kase?.status)
}

export const KP_DEADLINE_STYLE = {
  ok:     { color: '#22c55e', bg: '#f0fdf4', border: '#dcfce7' },
  due:    { color: '#b45309', bg: '#fffbeb', border: '#fef3c7' },
  breach: { color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
  window: { color: '#3b82f6', bg: '#eff6ff', border: '#dbeafe' },
  none:   { color: '#6b7280', bg: '#f9fafb', border: '#f0effe' },
}

/**
 * Which clock is running on this case right now, and how it stands.
 *
 * @returns {{ label:string|null, dueAt:string|null, daysLeft:number|null,
 *             level:'ok'|'due'|'breach'|'window'|'none', citation:string|null }}
 */
export function stageDeadline(kase, now = Date.now()) {
  const none = { label: null, dueAt: null, daysLeft: null, level: 'none', citation: null }
  if (!kase) return none

  // `dueWithin` is how many days out counts as "act on this now". It varies
  // by stage on purpose: three days is a sensible warning inside a 15-day
  // mediation period, but meaningless for the summons, which is a
  // next-working-day obligation with nothing to wait for. A summons is
  // therefore due from the moment the case is filed.
  const grade = (dueAt, label, citation, dueWithin = 3) => {
    if (!dueAt) return none
    const daysLeft = daysBetween(now, dueAt)
    const level = daysLeft < 0 ? 'breach' : daysLeft <= dueWithin ? 'due' : 'ok'
    return { label, dueAt: new Date(dueAt).toISOString(), daysLeft, level, citation }
  }

  switch (kase.status) {
    case 'filed':
      return grade(kase.summon_due_at, 'Summon the respondent', 'RA 7160, Sec. 410(b)', Infinity)
    case 'mediation':
      return grade(kase.mediation_due_at, 'Mediation period', 'RA 7160, Sec. 410(b)')
    case 'pangkat':
      return grade(kase.pangkat_due_at,
        kase.pangkat_extended ? 'Pangkat period (extended)' : 'Pangkat period',
        'RA 7160, Sec. 410(e)')
    case 'settled': {
      if (!kase.settled_at) return none
      const dueAt = repudiationDeadline(kase.settled_at)
      const daysLeft = daysBetween(now, dueAt)
      // Not a deadline the barangay can breach — a window the parties hold.
      return daysLeft < 0
        ? { label: 'Final and executory', dueAt: dueAt.toISOString(), daysLeft, level: 'ok',
            citation: 'RA 7160, Sec. 416' }
        : { label: `Repudiation window — ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`,
            dueAt: dueAt.toISOString(), daysLeft, level: 'window', citation: 'RA 7160, Sec. 418' }
    }
    default:
      return none
  }
}

/** What the official may legitimately do next, given the stage. */
export function availableActions(kase) {
  if (!kase) return []
  switch (kase.status) {
    case 'filed':
      return kase.lupon_eligible
        ? ['record_first_meeting', 'withdraw', 'refer']
        : ['refer', 'withdraw']
    case 'mediation':
      return ['settle', 'constitute_pangkat', 'withdraw']
    case 'pangkat':
      return kase.pangkat_extended
        ? ['settle', 'issue_cfa', 'withdraw']
        : ['settle', 'extend_pangkat', 'issue_cfa', 'withdraw']
    case 'settled':
      return ['repudiate']
    case 'repudiated':
      return ['issue_cfa']
    default:
      return []
  }
}
