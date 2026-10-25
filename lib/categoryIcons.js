import { createElement } from 'react'
import {
  Flame, Ambulance, TriangleAlert, Droplets, Pill, Siren, PawPrint,
  Trash2, TrafficCone, Wrench, SprayCan, Volume2, FileText,
} from 'lucide-react'

/**
 * A line icon per incident category, for map pins and queue rows.
 * Emoji render differently on every phone; these look the same everywhere
 * and take the category colour.
 */
const CATEGORY_ICONS = {
  Fire: Flame,
  Medical: Ambulance,
  Violence: TriangleAlert,
  Flood: Droplets,
  Drugs: Pill,
  Theft: Siren,
  Animals: PawPrint,
  Garbage: Trash2,
  Traffic: TrafficCone,
  Infrastructure: Wrench,
  Vandalism: SprayCan,
  Noise: Volume2,
  Other: FileText,
}

export function CategoryIcon({ category, ...props }) {
  return createElement(CATEGORY_ICONS[category] || FileText, { 'aria-hidden': true, ...props })
}
