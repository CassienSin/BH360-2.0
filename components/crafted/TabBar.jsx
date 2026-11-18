import Link from 'next/link'
import { HomeIcon, IncidentsIcon, DocumentsIcon, AiIcon, PerformanceIcon } from '@/components/icons/BhIcons'
import styles from './tab-bar.module.css'

/**
 * The phone tab bars (DESIGN.md §4). Each tab is a dashboard section; a
 * tab also stays lit for the sections reached from it (`also`).
 *
 * Residents: Home · Reports · Report (the raised red button, the only red
 * on a normal screen: the emergency entry) · Docs · AI Assistant.
 * Tanods: Duty · Assigned · Stats (Map joins with the map task).
 */
export const TAB_BARS = {
  resident: [
    { key: 'home', label: 'Home', icon: HomeIcon, also: ['announcements', 'tickets', 'blotter'] },
    { key: 'incidents', label: 'Reports', icon: IncidentsIcon },
    { center: true, key: 'report', label: 'Report', href: '/resident/report', icon: IncidentsIcon },
    { key: 'documents', label: 'Docs', icon: DocumentsIcon },
    { key: 'ai', label: 'AI Assistant', icon: AiIcon },
  ],
  tanod: [
    { key: 'home', label: 'Duty', icon: HomeIcon },
    { key: 'active', label: 'Assigned', icon: IncidentsIcon, also: ['resolved'] },
    { key: 'stats', label: 'Stats', icon: PerformanceIcon },
  ],
}

/** Which tab is lit for a section (undefined: none). */
export function tabFor(role, section) {
  return TAB_BARS[role]?.find(t => !t.center && (t.key === section || t.also?.includes(section)))?.key
}

/**
 * White, 1px top hairline, 22px icons with 11px labels; phone layout only.
 * `onSelect(key)` switches the section. Without it (the static loading
 * frame) the bar is drawn but inert. `preview` draws it in place, at any
 * width (the style guide).
 */
export default function TabBar({ role, activeSection, onSelect, preview = false }) {
  const tabs = TAB_BARS[role]
  if (!tabs) return null
  const lit = tabFor(role, activeSection)
  const still = !onSelect && !preview
  return (
    <nav aria-label="Sections" className={`${styles.bar} ${preview ? styles.preview : ''}`} inert={still || undefined} aria-hidden={still || undefined}>
      {tabs.map(tab => {
        const Icon = tab.icon
        if (tab.center) {
          return (
            <Link key={tab.key} href={preview ? '#' : tab.href} className={styles.report} prefetch={false}>
              <span className={styles.reportCircle}><Icon size={24} active /></span>
              <span className={styles.reportLabel}>{tab.label}</span>
            </Link>
          )
        }
        const active = lit === tab.key
        return (
          <button key={tab.key} type="button" className={`${styles.tab} ${active ? styles.active : ''}`}
            aria-current={active ? 'page' : undefined}
            onClick={onSelect ? () => onSelect(tab.key) : undefined}>
            <Icon size={22} active={active} />
            <span className={styles.label}>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
