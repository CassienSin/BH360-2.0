/**
 * National hotlines, one list for every page that shows them (help, offline,
 * resident home). Calls don't need data, so these work offline.
 *
 * `danger`: emergency lines (fire, medical, the national number) draw their
 * phone icon in the danger colour (DESIGN.md §6); the rest use the brand.
 */
export const HOTLINES = [
  { key: 'emergency', name: 'National Emergency Hotline', short: 'Emergency', number: '911', desc: 'For police, fire, or medical emergencies', danger: true },
  { key: 'redcross', name: 'Philippine Red Cross', short: 'Ambulance (Red Cross)', number: '143', desc: 'Medical emergencies and ambulance', danger: true },
  { key: 'bfp', name: 'Bureau of Fire Protection', short: 'Fire (BFP)', number: '160', desc: 'Fire emergencies', danger: true },
  { key: 'pnp', name: 'Philippine National Police', short: 'Police (PNP)', number: '117', desc: 'Crime, public safety', danger: false },
  { key: 'ndrrmc', name: 'NDRRMC (Disaster)', short: 'Disaster (NDRRMC)', number: '(02) 8911-1406', desc: 'Natural disasters', danger: false },
  { key: 'doh', name: 'DOH Health Hotline', short: 'Health (DOH)', number: '1555', desc: 'Health emergencies and concerns', danger: false },
]

/** A tel: link for a number as printed: "(02) 8911-1406" → "tel:0289111406". */
export function telHref(number) {
  return `tel:${String(number).replace(/[^\d+]/g, '')}`
}
