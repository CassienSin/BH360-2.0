'use client'
import { Check, ShieldCheck } from 'lucide-react'
import { CATEGORY_CONFIG } from '@/lib/legalBasis'
import { CategoryIcon } from '@/lib/categoryIcons'
import { topPriority } from '@/lib/mapGeometry'
import styles from './markers.module.css'

const PIN_PATH = 'M20 1C9.6 1 1.5 9.2 1.5 19.4 1.5 32 20 51 20 51s18.5-19 18.5-31.6C38.5 9.2 30.4 1 20 1z'

/**
 * One incident. Fill = category colour (the same colour the category
 * carries everywhere else in the app); the badges add what a dispatcher
 * scans for: priority on the right, status on the left.
 */
export function IncidentPin({ incident, selected = false, onSelect }) {
  const cat = CATEGORY_CONFIG[incident.category] || CATEGORY_CONFIG.Other
  const pending = incident.status === 'pending'
  const assigned = incident.status === 'assigned'
  const resolved = incident.status === 'resolved'
  const priorityBadge = resolved ? null
    : incident.priority === 'Critical' ? styles.critical
    : incident.priority === 'High' ? styles.high : null

  return (
    <button
      type="button"
      className={`${styles.pin} ${selected ? styles.selected : ''} ${resolved ? styles.resolved : ''}`}
      aria-label={`${cat.label}: ${incident.title}. ${incident.priority || 'Medium'} priority, ${incident.status}.`}
      aria-pressed={selected}
      onClick={(e) => { e.stopPropagation(); onSelect?.(incident.id) }}
    >
      {pending && <span className={styles.pulse} style={{ background: `${cat.color}59` }} />}
      {selected && <span className={styles.ring} />}
      <svg className={styles.pinSvg} viewBox="0 0 40 52" aria-hidden="true">
        <path d={PIN_PATH} fill={cat.color} stroke="#fff" strokeWidth="2.5" />
        <circle cx="20" cy="19" r="12" fill="#fff" />
      </svg>
      <span className={styles.pinGlyph} style={{ color: cat.color }}>
        <CategoryIcon category={incident.category} size={16} strokeWidth={2.4} />
      </span>
      {priorityBadge && <span className={`${styles.badge} ${styles.badgeRight} ${priorityBadge}`}>!</span>}
      {assigned && (
        <span className={`${styles.badge} ${styles.badgeLeft} ${styles.assigned}`}>
          <ShieldCheck size={11} strokeWidth={3} aria-hidden="true" />
        </span>
      )}
      {resolved && (
        <span className={`${styles.badge} ${styles.badgeRight} ${styles.done}`}>
          <Check size={10} strokeWidth={3.5} aria-hidden="true" />
        </span>
      )}
    </button>
  )
}

/** Several incidents whose pins would overlap at this zoom. */
export function ClusterMarker({ incidents, onOpen }) {
  const count = incidents.length
  const top = topPriority(incidents)
  const size = count > 30 ? 56 : count > 12 ? 50 : count > 5 ? 46 : 42
  const label = top
    ? `${count} incidents here, highest priority ${top}. Show them in the queue.`
    : `${count} resolved incidents here. Show them in the queue.`
  return (
    <button
      type="button"
      className={`${styles.cluster} ${top ? '' : styles.clusterResolved}`}
      style={{ width: size, height: size, fontSize: size > 48 ? 16 : 14 }}
      aria-label={label}
      title={label}
      onClick={(e) => { e.stopPropagation(); onOpen?.(incidents) }}
    >
      <span className={`${styles.clusterHalo} ${top === 'Critical' ? styles.clusterHaloCritical : ''}`} />
      <span style={{ position: 'relative' }}>{count}</span>
      {(top === 'Critical' || top === 'High') && (
        <span className={styles.clusterDot} style={{ background: top === 'Critical' ? '#dc2626' : '#f97316' }} />
      )}
    </button>
  )
}

function initials(name) {
  const parts = String(name || 'Tanod').trim().split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || 'T'
}

/** An on-duty tanod's latest GPS position. Amber when the signal is stale. */
export function TanodMarker({ position, onOpen }) {
  const name = position.tanod?.full_name || 'Tanod'
  return (
    <button
      type="button"
      className={`${styles.tanod} ${position.stale ? styles.tanodStale : ''}`}
      aria-label={`${name}, ${position.stale ? 'signal lost' : 'live location'}. Show details.`}
      onClick={(e) => { e.stopPropagation(); onOpen?.(position.tanodId) }}
    >
      {!position.stale && <span className={styles.tanodHalo} />}
      {position.tanod?.avatar_url
        ? <img src={position.tanod.avatar_url} alt="" className={styles.tanodPhoto} />
        : <span style={{ position: 'relative' }}>{initials(name)}</span>}
    </button>
  )
}

export function MeasureDot() {
  return <span className={styles.measureDot} aria-hidden="true" />
}

export { initials }
