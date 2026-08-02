/**
 * Legal basis for automated incident classification.
 *
 * DESIGN PRINCIPLE — residents describe WHAT HAPPENED; the system
 * determines HOW URGENT it is.
 *
 * Priority is NOT selected by the reporter. It is derived entirely from
 * the incident category, which is in turn mapped to the Philippine law
 * governing that type of incident. This removes the failure mode where a
 * resident marks a noise complaint as "Critical" (from panic,
 * misunderstanding, or to jump the queue) and displaces a real emergency
 * in the officials' response queue.
 *
 * Barangay officials CAN adjust priority after review — they are trained,
 * accountable public officers, and some categories genuinely vary in
 * severity (a flood report may be ankle-deep or life-threatening). Every
 * adjustment is recorded against the original automated value, so the
 * audit trail shows both what the law assigned and what the official
 * decided.
 *
 * TWO LEGAL QUESTIONS PER CATEGORY:
 *
 *   1. priority       — the severity the governing law implies. Assigned
 *                        automatically; not reporter-editable.
 *
 *   2. responseMode   — does the barangay have legal authority to act, or
 *                        must it document and refer?
 *                        'barangay_response' = tanods/officials may act directly
 *                        'refer_to_agency'   = document + escalate; do NOT
 *                        physically intervene (jurisdiction and safety)
 *
 * All citations verified against primary/authoritative sources (Official
 * Gazette, LawPhil, Supreme Court E-Library, implementing agency IRRs).
 */

export const LEGAL_BASIS = {
  // ── CRITICAL: immediate threat to life ──────────────────────────────
  Fire: {
    priority: 'Critical',
    law: 'RA 9514',
    lawTitle: 'Fire Code of the Philippines of 2008',
    responseMode: 'refer_to_agency',
    agency: 'Bureau of Fire Protection (BFP)',
    reason: 'Fire is a life-safety emergency under the Fire Code. '
          + 'Barangay personnel assist with evacuation and crowd control '
          + 'only \u2014 fire suppression is the exclusive mandate of the BFP.',
  },
  Medical: {
    priority: 'Critical',
    law: 'RA 8344',
    lawTitle: 'Anti-Hospital Deposit Law (1997)',
    responseMode: 'refer_to_agency',
    agency: 'Nearest hospital / 911 / City-Municipal Health Office',
    reason: 'Medical emergencies are time-critical. RA 8344 guarantees '
          + 'emergency patients treatment without upfront payment \u2014 the '
          + 'barangay\u2019s role is rapid referral and transport assistance.',
  },
  Violence: {
    priority: 'Critical',
    law: 'RA 9262',
    lawTitle: 'Anti-Violence Against Women and Their Children Act of 2004',
    responseMode: 'barangay_response',
    agency: 'PNP Women and Children Protection Desk (for the criminal case)',
    reason: 'Sec. 14 empowers the Punong Barangay (or any Kagawad in their '
          + 'absence) to issue a Barangay Protection Order the same day it '
          + 'is applied for \u2014 no court order needed. Sec. 15 requires BPO '
          + 'applications to take precedence over all other barangay '
          + 'business, which is why this is classified Critical.',
    specialAction: 'offer_bpo',
  },

  // ── HIGH: serious and urgent, not immediately life-threatening ──────
  Flood: {
    priority: 'High',
    law: 'RA 10121',
    lawTitle: 'Philippine Disaster Risk Reduction and Management Act of 2010',
    responseMode: 'barangay_response',
    agency: 'Barangay Disaster Risk Reduction and Management Committee (BDRRMC)',
    reason: 'RA 10121 makes the barangay the front-line responder for '
          + 'localized disasters. Classified High rather than Critical '
          + 'because flood severity varies widely \u2014 officials should '
          + 'escalate to Critical on review when lives are at risk.',
  },
  Drugs: {
    priority: 'High',
    law: 'RA 9165',
    lawTitle: 'Comprehensive Dangerous Drugs Act of 2002',
    responseMode: 'refer_to_agency',
    agency: 'PNP Anti-Illegal Drugs Unit / PDEA',
    reason: 'Barangay officials support enforcement through reporting and '
          + 'IEC campaigns but hold NO arrest or interdiction authority. '
          + 'Tanods must not confront suspects \u2014 observe, document, refer.',
  },
  Theft: {
    priority: 'High',
    law: 'RA 7160',
    lawTitle: 'Local Government Code \u2014 Katarungang Pambarangay (Secs. 399\u2013422)',
    responseMode: 'barangay_response',
    agency: 'PNP if armed, ongoing, or parties are from different barangays',
    reason: 'Crimes against property warrant prompt response. Minor '
          + 'disputes between residents of the same barangay are eligible '
          + 'for Lupong Tagapamayapa conciliation; escalate to PNP '
          + 'immediately if armed or in progress.',
  },
  Animals: {
    priority: 'High',
    law: 'RA 9482',
    lawTitle: 'Anti-Rabies Act of 2007',
    responseMode: 'barangay_response',
    agency: 'City/Municipal Health Office (for bite victims)',
    reason: 'RA 9482 names barangay officials as "concerned officials" for '
          + 'rabies response. Rabies is virtually always fatal once '
          + 'symptomatic, so animal-bite exposure requires prompt referral '
          + 'for post-exposure treatment \u2014 hence High rather than Medium.',
  },

  // ── MEDIUM: standard barangay business ──────────────────────────────
  Traffic: {
    priority: 'Medium',
    law: 'RA 4136 / RA 7160',
    lawTitle: 'Land Transportation and Traffic Code; Local Government Code Secs. 447/458',
    responseMode: 'barangay_response',
    agency: 'PNP / LTO for accidents with injuries',
    reason: 'LGUs may enforce local traffic ordinances under RA 7160. '
          + 'Tanods may assist with traffic control. Accidents involving '
          + 'injuries should be reported under Medical Emergency instead.',
  },
  Infrastructure: {
    priority: 'Medium',
    law: 'RA 7160',
    lawTitle: 'Local Government Code \u2014 Sec. 17 (devolved basic services)',
    responseMode: 'barangay_response',
    agency: null,
    reason: 'Barangay infrastructure maintenance is a devolved basic '
          + 'service. Damaged infrastructure can become hazardous, so it '
          + 'warrants standard rather than low priority.',
  },
  Vandalism: {
    priority: 'Medium',
    law: 'RPC Arts. 327\u2013328 / RA 7160',
    lawTitle: 'Revised Penal Code (Malicious Mischief); Katarungang Pambarangay',
    responseMode: 'barangay_response',
    agency: null,
    reason: 'Damage to property is punishable under the Revised Penal Code '
          + 'and is generally eligible for barangay conciliation.',
  },
  Other: {
    priority: 'Medium',
    law: null,
    lawTitle: null,
    responseMode: 'barangay_response',
    agency: null,
    reason: 'No specific statute mapped. Defaults to standard priority so '
          + 'it is neither ignored nor allowed to displace emergencies; '
          + 'officials reclassify on review.',
  },

  // ── LOW: quality-of-life, resolved through mediation ────────────────
  Noise: {
    priority: 'Low',
    law: 'Local ordinance',
    lawTitle: 'Barangay/City noise ordinance (no national statute governs)',
    responseMode: 'barangay_response',
    agency: null,
    reason: 'Noise complaints are governed by local ordinance rather than '
          + 'national law and are typically resolved through barangay '
          + 'mediation. Classified Low so they never displace emergencies '
          + 'in the response queue.',
  },
}

/** Fallback if a category somehow has no mapping. */
const DEFAULT_PRIORITY = 'Medium'

/**
 * The single source of truth for an incident's priority.
 * Derived from category alone — no reporter input.
 */
export function getPriority(category) {
  return LEGAL_BASIS[category]?.priority ?? DEFAULT_PRIORITY
}

/** Short citation: "RA 9514 — Fire Code of the Philippines of 2008" */
export function citationLabel(category) {
  const basis = LEGAL_BASIS[category]
  if (!basis?.law) return null
  return `${basis.law} \u2014 ${basis.lawTitle}`
}

/** Full basis object for a category, or null. */
export function getBasis(category) {
  return LEGAL_BASIS[category] ?? null
}

/** True when the barangay must refer rather than respond directly. */
export function mustRefer(category) {
  return LEGAL_BASIS[category]?.responseMode === 'refer_to_agency'
}

/** Display metadata per priority level (shared by report form and dashboards). */
export const PRIORITY_STYLE = {
  Critical: { color: '#dc2626', bg: '#fef2f2', icon: '🔴', label: 'Critical', desc: 'Emergency response' },
  High:     { color: '#f97316', bg: '#fff7ed', icon: '🟠', label: 'High',     desc: 'Urgent' },
  Medium:   { color: '#3b82f6', bg: '#eff6ff', icon: '🔵', label: 'Medium',   desc: 'Standard' },
  Low:      { color: '#22c55e', bg: '#f0fdf4', icon: '🟢', label: 'Low',      desc: 'Non-urgent' },
}