import { createElement } from 'react'
import { CATEGORY_BH_ICONS, OtherIcon } from '@/components/icons/BhIcons'

/**
 * The BH360 icon per incident category, for map pins, queue rows and page
 * headers. Outline by default; pass `active` for the solid version. Colour
 * comes from currentColor: fire, medical and violence rows set
 * var(--danger), everything else var(--brand-strong) (DESIGN.md §6).
 */
export function CategoryIcon({ category, ...props }) {
  return createElement(CATEGORY_BH_ICONS[category] || OtherIcon, { 'aria-hidden': true, ...props })
}

/** Categories that are emergencies: their icon and pin use the danger colour. */
export const DANGER_CATEGORIES = new Set(['Fire', 'Medical', 'Violence'])

/** The colour token for a category's icon: danger for emergencies, brand otherwise. */
export function categoryColor(category) {
  return DANGER_CATEGORIES.has(category) ? 'var(--danger)' : 'var(--brand-strong)'
}
