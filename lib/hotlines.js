/**
 * Hotlines, one list for every page that shows them (help, offline,
 * resident home). Calls don't need data, so these work offline.
 *
 * Unified 911 (September 2025) covers police, fire and ambulance; the old
 * separate PNP (117) and BFP (160) numbers are gone.
 *
 * `number: null` means the number isn't known here: the barangay hall's
 * comes from barangays.phone when a page has it (pass it to hallLine), and
 * otherwise the row reads "Tap to call" without a link (DESIGN.md §7).
 * `danger`: emergency lines draw their phone icon in the danger colour.
 */
export const HOTLINES = [
  { key: 'emergency', name: 'Emergency: police, fire, ambulance', short: 'Emergency', number: '911', desc: 'Unified 911 for police, fire and ambulance', danger: true },
  { key: 'redcross', name: 'Philippine Red Cross', short: 'Philippine Red Cross', number: '143', desc: 'Ambulance and first aid', danger: true },
  { key: 'hall', name: 'Barangay hall', short: 'Barangay hall', number: null, desc: 'Your barangay office', danger: false },
]

/** The list with the barangay hall's own number filled in, when the page knows it. */
export function hotlinesFor(hallPhone) {
  return HOTLINES.map(line => (line.key === 'hall' && hallPhone ? { ...line, number: hallPhone } : line))
}

/** A tel: link for a number as printed: "(032) 123-4567" → "tel:0321234567". */
export function telHref(number) {
  return number ? `tel:${String(number).replace(/[^\d+]/g, '')}` : undefined
}

/** What to show where the number goes: the number, or "Tap to call". */
export function numberLabel(number) {
  return number || 'Tap to call'
}
