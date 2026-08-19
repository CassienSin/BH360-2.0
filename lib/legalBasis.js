/**
 * Incident categories ↔ Philippine law.
 *
 * This file is the SINGLE SOURCE OF TRUTH for incident categories. Every
 * category is defined here exactly once, together with:
 *
 *   • how it is presented (label, icon, colour) — so the report form, the
 *     dashboards, the map, the calendar and the analytics page can never
 *     drift apart the way they did when each kept its own copy; and
 *   • the law that governs it — so a category cannot exist in the UI
 *     without a stated legal basis behind it.
 *
 * Those two things live together on purpose. "Theft" is not a colour and
 * an emoji that happens to have a law bolted on: it is a legal category
 * the barangay has specific, limited powers over, and the colour is just
 * how we draw it.
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
 * CITATION FIELDS. Each entry carries `law` (the citation as residents
 * would recognise it), `lawTitle` (the statute's own title), `sections`
 * (the specific provisions relied on — this is what makes the citation
 * checkable rather than decorative), `provision` (a plain-language
 * statement of what those sections actually say) and `source` (where to
 * read the text). Anything asserted in `reason` must be traceable to
 * `sections`; if it is not in the cited provision, it does not go in.
 *
 * Citations verified against LawPhil, the Supreme Court E-Library and the
 * Official Gazette. Note that the Revised Penal Code is Act No. 3815, not
 * a Republic Act, and is cited as such.
 */

export const LEGAL_BASIS = {
  // ── CRITICAL: immediate threat to life ──────────────────────────────
  Fire: {
    label: 'Fire',
    icon: '🔥',
    color: '#ea580c',
    bg: '#fff7ed',
    priority: 'Critical',
    law: 'RA 9514',
    lawTitle: 'Fire Code of the Philippines of 2008',
    sections: 'Secs. 5–6',
    provision: 'Enforcement of the Fire Code is vested in the Bureau of Fire '
             + 'Protection, which has exclusive authority over fire suppression '
             + 'and fire-safety inspection.',
    source: 'https://lawphil.net/statutes/repacts/ra2008/ra_9514_2008.html',
    responseMode: 'refer_to_agency',
    agency: 'Bureau of Fire Protection (BFP)',
    reason: 'Fire is a life-safety emergency under the Fire Code. '
          + 'Barangay personnel assist with evacuation and crowd control '
          + 'only — fire suppression is the exclusive mandate of the BFP.',
  },
  Medical: {
    label: 'Medical Emergency',
    icon: '🚑',
    color: '#dc2626',
    bg: '#fef2f2',
    priority: 'Critical',
    law: 'RA 10932',
    lawTitle: 'Anti-Hospital Deposit Law — BP 702 as amended by RA 8344 (1997) and RA 10932 (2017)',
    sections: 'Sec. 1',
    provision: 'Hospitals and clinics, public or private, may not demand a '
             + 'deposit or advance payment before administering initial '
             + 'medical treatment in an emergency or serious case, nor refuse '
             + 'to treat one. RA 10932 raised the penalties for refusal.',
    source: 'https://lawphil.net/statutes/repacts/ra2017/ra_10932_2017.html',
    responseMode: 'refer_to_agency',
    agency: 'Nearest hospital / 911 / City-Municipal Health Office',
    reason: 'Medical emergencies are time-critical. No hospital may turn the '
          + 'patient away or demand a deposit first, so the barangay’s '
          + 'role is rapid referral and transport assistance — never delay '
          + 'transport to arrange payment.',
  },
  Violence: {
    label: 'Violence / Fight',
    icon: '⚠️',
    color: '#dc2626',
    bg: '#fef2f2',
    priority: 'Critical',
    law: 'RA 9262',
    lawTitle: 'Anti-Violence Against Women and Their Children Act of 2004',
    sections: 'Secs. 14 and 30',
    provision: 'Sec. 14: the Punong Barangay issues a Barangay Protection '
             + 'Order on the date of filing, ex parte and free of charge (any '
             + 'available Kagawad acts if the Punong Barangay is unavailable, '
             + 'with an attestation to that effect); a BPO is effective for '
             + '15 days. Sec. 30: barangay officials and law enforcers must '
             + 'respond immediately to a call for help — entering the '
             + 'dwelling if necessary, whether or not a protection order has '
             + 'been issued — and may arrest without a warrant while the '
             + 'violence is occurring or where there is imminent danger to '
             + 'life or limb.',
    source: 'https://lawphil.net/statutes/repacts/ra2004/ra_9262_2004.html',
    responseMode: 'barangay_response',
    agency: 'PNP Women and Children Protection Desk (for the criminal case)',
    reason: 'Sec. 30 makes immediate response a duty of barangay officials, '
          + 'not a discretionary call, and Sec. 14 lets the Punong Barangay '
          + 'issue a protection order the same day it is applied for — no '
          + 'court order needed. A duty that must be discharged the same day '
          + 'is why this is classified Critical.',
    specialAction: 'offer_bpo',
  },

  // ── HIGH: serious and urgent, not immediately life-threatening ──────
  Flood: {
    label: 'Flooding',
    icon: '🌊',
    color: '#3b82f6',
    bg: '#eff6ff',
    priority: 'High',
    law: 'RA 10121',
    lawTitle: 'Philippine Disaster Risk Reduction and Management Act of 2010',
    sections: 'Secs. 11–12',
    provision: 'The Barangay Development Council serves as the disaster risk '
             + 'reduction and management committee of the barangay, and a '
             + 'Barangay DRRM Committee operates under the Punong Barangay as '
             + 'the front line for localized disasters.',
    source: 'https://lawphil.net/statutes/repacts/ra2010/ra_10121_2010.html',
    responseMode: 'barangay_response',
    agency: 'Barangay Disaster Risk Reduction and Management Committee (BDRRMC)',
    reason: 'RA 10121 makes the barangay the front-line responder for '
          + 'localized disasters. Classified High rather than Critical '
          + 'because flood severity varies widely — officials should '
          + 'escalate to Critical on review when lives are at risk.',
  },
  Drugs: {
    label: 'Illegal Drugs',
    icon: '💊',
    color: '#be185d',
    bg: '#fdf2f8',
    priority: 'High',
    law: 'RA 9165',
    lawTitle: 'Comprehensive Dangerous Drugs Act of 2002',
    sections: 'Secs. 51 and 82',
    provision: 'Sec. 51 obliges LGUs to fund enforcement assistance, giving '
             + 'priority to preventive and educational programs; enforcement '
             + 'and arrest powers rest with PDEA and the PNP. Barangay '
             + 'Anti-Drug Abuse Councils operate under DILG issuances, not '
             + 'as a police force.',
    source: 'https://lawphil.net/statutes/repacts/ra2002/ra_9165_2002.html',
    responseMode: 'refer_to_agency',
    agency: 'PNP Anti-Illegal Drugs Unit / PDEA',
    reason: 'Barangay officials support enforcement through reporting and '
          + 'IEC campaigns but hold NO arrest or interdiction authority. '
          + 'Tanods must not confront suspects — observe, document, refer.',
  },
  Theft: {
    label: 'Theft / Robbery',
    icon: '🚨',
    color: '#ef4444',
    bg: '#fef2f2',
    priority: 'High',
    law: 'Act No. 3815, Arts. 293–311; RA 7160',
    lawTitle: 'Revised Penal Code (robbery and theft); Local Government Code — Katarungang Pambarangay',
    sections: 'RPC Arts. 293–311; RA 7160 Secs. 408 and 412',
    provision: 'Robbery and theft are crimes under the Revised Penal Code. '
             + 'Sec. 408 gives the Lupon authority to conciliate disputes '
             + 'between parties residing in the same city or municipality, '
             + 'but expressly EXCLUDES offenses punishable by imprisonment '
             + 'exceeding one year or a fine exceeding ₱5,000 — which '
             + 'covers most robbery and any sizeable theft. Sec. 412 makes '
             + 'conciliation a precondition to filing in court only for the '
             + 'disputes the Lupon may actually take.',
    source: 'https://lawphil.net/statutes/repacts/ra1991/ra_7160_1991.html',
    responseMode: 'barangay_response',
    agency: 'PNP if armed, ongoing, or the amount takes it past the Lupon’s limit',
    reason: 'Crimes against property warrant prompt response. Only minor '
          + 'cases between residents of the same city or municipality are '
          + 'eligible for Lupon conciliation — anything punishable by more '
          + 'than a year, or armed or in progress, goes to the PNP and must '
          + 'not be routed into mediation.',
  },
  Animals: {
    label: 'Stray Animals',
    icon: '🐕',
    color: '#a16207',
    bg: '#fefce8',
    priority: 'High',
    law: 'RA 9482',
    lawTitle: 'Anti-Rabies Act of 2007',
    sections: 'Secs. 5 and 7',
    provision: 'Sec. 5 requires the pet owner to report a biting incident to '
             + 'the concerned officials within 24 hours, place the dog under '
             + 'observation, assist the victim immediately and shoulder the '
             + 'medical expenses. Sec. 7 puts impounding and field control of '
             + 'stray dogs, and vaccination and registration drives, on the '
             + 'LGU.',
    source: 'https://lawphil.net/statutes/repacts/ra2007/ra_9482_2007.html',
    responseMode: 'barangay_response',
    agency: 'City/Municipal Health Office (for bite victims)',
    reason: 'The 24-hour reporting duty in Sec. 5 exists because rabies is '
          + 'virtually always fatal once symptomatic. Animal-bite exposure '
          + 'needs referral for post-exposure prophylaxis right away — '
          + 'hence High rather than Medium.',
  },

  // ── MEDIUM: standard barangay business ──────────────────────────────
  Garbage: {
    label: 'Garbage / Sanitation',
    icon: '🗑️',
    color: '#16a34a',
    bg: '#f0fdf4',
    priority: 'Medium',
    law: 'RA 9003',
    lawTitle: 'Ecological Solid Waste Management Act of 2000',
    sections: 'Sec. 10',
    provision: 'Segregation and collection of solid waste is conducted at the '
             + 'BARANGAY level for biodegradable, compostable and reusable '
             + 'waste, and the barangay is responsible for 100% collection '
             + 'efficiency from residential, commercial, industrial and '
             + 'agricultural sources. Non-recyclable materials and special '
             + 'waste are the responsibility of the city or municipality.',
    source: 'https://lawphil.net/statutes/repacts/ra2001/ra_9003_2001.html',
    responseMode: 'barangay_response',
    agency: 'City/Municipal ENRO for non-recyclable and special waste',
    reason: 'Uncollected waste is a barangay duty by name under Sec. 10, not '
          + 'a complaint to pass upward. Standard priority — it is a public '
          + 'health matter that should not be forgotten, but it does not '
          + 'displace emergencies.',
  },
  Traffic: {
    label: 'Traffic Issue',
    icon: '🚦',
    color: '#0891b2',
    bg: '#ecfeff',
    priority: 'Medium',
    law: 'RA 4136 / RA 7160',
    lawTitle: 'Land Transportation and Traffic Code; Local Government Code',
    sections: 'RA 4136; RA 7160 Secs. 447 and 458',
    provision: 'RA 4136 governs land transportation and traffic rules '
             + 'nationally. RA 7160 Secs. 447 and 458 empower municipal and '
             + 'city sanggunians to regulate traffic and enact the local '
             + 'ordinances barangay personnel help enforce.',
    source: 'https://lawphil.net/statutes/repacts/ra1964/ra_4136_1964.html',
    responseMode: 'barangay_response',
    agency: 'PNP / LTO for accidents with injuries',
    reason: 'LGUs may enforce local traffic ordinances under RA 7160. '
          + 'Tanods may assist with traffic control. Accidents involving '
          + 'injuries should be reported under Medical Emergency instead.',
  },
  Infrastructure: {
    label: 'Infrastructure',
    icon: '🛠️',
    color: '#8b5cf6',
    bg: '#f5f3ff',
    priority: 'Medium',
    law: 'RA 7160',
    lawTitle: 'Local Government Code of 1991',
    sections: 'Sec. 17',
    provision: 'Basic services and facilities are devolved to LGUs; for the '
             + 'barangay these expressly include the maintenance of barangay '
             + 'roads, bridges, water supply systems and other infrastructure '
             + 'funded out of barangay funds.',
    source: 'https://lawphil.net/statutes/repacts/ra1991/ra_7160_1991.html',
    responseMode: 'barangay_response',
    agency: null,
    reason: 'Barangay infrastructure maintenance is a devolved basic '
          + 'service. Damaged infrastructure can become hazardous, so it '
          + 'warrants standard rather than low priority.',
  },
  Vandalism: {
    label: 'Vandalism',
    icon: '🎨',
    color: '#7c3aed',
    bg: '#f5f3ff',
    priority: 'Medium',
    law: 'Act No. 3815, Arts. 327–331',
    lawTitle: 'Revised Penal Code — Malicious Mischief',
    sections: 'RPC Arts. 327–331; RA 7160 Secs. 408 and 412',
    provision: 'Deliberately causing damage to another’s property is '
             + 'malicious mischief, penalised according to the value of the '
             + 'damage. Where the penalty does not exceed one year of '
             + 'imprisonment or a ₱5,000 fine, the dispute falls within '
             + 'Lupon conciliation under RA 7160 Sec. 408.',
    source: 'https://lawphil.net/statutes/repacts/act/act_3815_1930.html',
    responseMode: 'barangay_response',
    agency: null,
    reason: 'Damage to property is punishable under the Revised Penal Code '
          + 'and, at the values usually involved, is eligible for barangay '
          + 'conciliation.',
  },
  Other: {
    label: 'Other',
    icon: '📝',
    color: '#6b7280',
    bg: '#f9fafb',
    priority: 'Medium',
    law: null,
    lawTitle: null,
    sections: null,
    provision: null,
    source: null,
    responseMode: 'barangay_response',
    agency: null,
    reason: 'No specific statute mapped. Defaults to standard priority so '
          + 'it is neither ignored nor allowed to displace emergencies; '
          + 'officials reclassify on review.',
  },

  // ── LOW: quality-of-life, resolved through mediation ────────────────
  Noise: {
    label: 'Noise Complaint',
    icon: '🔊',
    color: '#f97316',
    bg: '#fff7ed',
    priority: 'Low',
    law: 'Local ordinance / RA 7160',
    lawTitle: 'Barangay and city/municipal noise ordinances (no national statute governs noise as such)',
    sections: 'RA 7160 Secs. 391, 447 and 458; Civil Code Arts. 694–707',
    provision: 'No Republic Act sets a national noise limit for residential '
             + 'areas. The sanggunian barangay may adopt measures on peace '
             + 'and order (Sec. 391) and city/municipal sanggunians enact the '
             + 'noise ordinances that actually apply (Secs. 447, 458). '
             + 'Persistent noise may also be a nuisance under Civil Code '
             + 'Arts. 694–707, which is a Lupon-conciliable dispute.',
    source: 'https://lawphil.net/statutes/repacts/ra1991/ra_7160_1991.html',
    responseMode: 'barangay_response',
    agency: null,
    reason: 'Noise is governed by local ordinance rather than national law '
          + 'and is typically resolved through barangay mediation. '
          + 'Classified Low so it never displaces emergencies in the '
          + 'response queue.',
  },
}

/** Fallback if a category somehow has no mapping. */
const DEFAULT_PRIORITY = 'Medium'

/**
 * Display metadata only, keyed by category — for the map, calendar,
 * analytics and list views, which need the icon and colours but not the
 * legal text. Derived, so a new category can never be added to the UI
 * without going through LEGAL_BASIS first.
 *
 * `emoji` mirrors `icon`: the map components named the field that way.
 */
export const CATEGORY_CONFIG = Object.fromEntries(
  Object.entries(LEGAL_BASIS).map(([value, b]) => [
    value,
    { label: b.label, icon: b.icon, emoji: b.icon, color: b.color, bg: b.bg },
  ])
)

/**
 * Categories as an ordered array, for the report form's picker.
 * Ordered by legal severity band (Critical first) so that in an emergency
 * the category a resident needs is at the top of the list.
 */
export const CATEGORY_LIST = Object.entries(LEGAL_BASIS).map(([value, b]) => ({
  value,
  label: b.label,
  icon: b.icon,
  color: b.color,
  bg: b.bg,
  priority: b.priority,
  law: b.law,
}))

/** Display metadata for a category, falling back to "Other". */
export function getCategoryMeta(category) {
  return CATEGORY_CONFIG[category] || CATEGORY_CONFIG.Other
}

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
  return `${basis.law} — ${basis.lawTitle}`
}

/**
 * Citation with the specific provisions relied on:
 * "RA 9262, Secs. 14 and 30 — Anti-Violence Against Women..."
 * Use this wherever there is room; it is what makes the citation checkable.
 */
export function citationDetail(category) {
  const basis = LEGAL_BASIS[category]
  if (!basis?.law) return null
  const cite = basis.sections ? `${basis.law}, ${basis.sections}` : basis.law
  return `${cite} — ${basis.lawTitle}`
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
