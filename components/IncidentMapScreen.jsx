'use client'
import { useEffect, useState, useCallback, useSyncExternalStore } from 'react'
import { Map as MapIcon, Moon, Sun } from 'lucide-react'
import { PageHeader, PageState } from '@/components/AppUI'
import CommandMap, { DEFAULT_PREFS, STATUS_FILTERS } from '@/components/CommandMap'
import { CATEGORY_CONFIG } from '@/lib/legalBasis'
import { normalizeBasemap } from '@/lib/mapConfig'
import styles from './incident-map-screen.module.css'

const PREFS_KEY = 'map-view-prefs-v2'

// false during the server render and hydration, true afterwards.
const noop = () => () => {}
function useHydrated() {
  return useSyncExternalStore(noop, () => true, () => false)
}

// Saved choices are validated before use: a stale category or a base map
// whose key was removed must not leave the map in a state no control shows.
function loadPrefs() {
  if (typeof window === 'undefined') return DEFAULT_PREFS
  try {
    const saved = JSON.parse(sessionStorage.getItem(PREFS_KEY) || '{}')
    return {
      statusFilter: STATUS_FILTERS.some(f => f.value === saved.statusFilter) ? saved.statusFilter : DEFAULT_PREFS.statusFilter,
      categoryFilter: saved.categoryFilter === 'all' || CATEGORY_CONFIG[saved.categoryFilter] ? saved.categoryFilter : 'all',
      theme: saved.theme === 'dark' ? 'dark' : 'light',
      basemap: normalizeBasemap(saved.basemap),
      layers: {
        tanods: typeof saved.layers?.tanods === 'boolean' ? saved.layers.tanods : true,
        heatmap: saved.layers?.heatmap === true,
        coverage: saved.layers?.coverage === true,
      },
    }
  } catch {
    return DEFAULT_PREFS
  }
}

/**
 * The incident map page without its data source: header, night mode and
 * remembered view choices around the console. app/official/map/page.jsx
 * feeds it live Supabase data; app/dev/map-preview feeds it sample data.
 */
export default function IncidentMapScreen({
  loading = false,
  barangayName,
  live = false,
  incidents,
  tanodTrails,
  onDispatch,
  onOpenIncident,
  onBack,
}) {
  // Saved choices are read on the client only. Until hydration finishes the
  // screen renders the defaults, exactly as the server did, so a saved
  // night mode cannot cause a hydration mismatch; it applies one frame later.
  const hydrated = useHydrated()
  const [savedPrefs, setPrefs] = useState(loadPrefs)
  const prefs = hydrated ? savedPrefs : DEFAULT_PREFS
  const setPref = useCallback((key, value) => setPrefs(p => ({ ...p, [key]: value })), [])

  useEffect(() => {
    try { sessionStorage.setItem(PREFS_KEY, JSON.stringify(savedPrefs)) } catch { /* storage blocked: not critical */ }
  }, [savedPrefs])

  const dark = prefs.theme === 'dark'

  return (
    <div className={`${styles.screen} ${dark ? styles.dark : 'bg-brand'}`}>
      <PageHeader
        title="Incident Map"
        description={`${barangayName ? `${barangayName} · ` : ''}Incidents and on-duty tanods, live`}
        icon={MapIcon}
        onBack={onBack}
        backLabel="Back to dashboard"
        maxWidth={1600}
        actions={(
          <>
            <span className={`${styles.live} ${live ? styles.liveOn : styles.liveOff}`} role="status">
              <span className={styles.liveDot} aria-hidden="true" />
              {live ? 'Live' : 'Reconnecting…'}
            </span>
            <button type="button" className={styles.night} aria-pressed={dark} onClick={() => setPref('theme', dark ? 'light' : 'dark')}>
              {dark ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
              Night mode
            </button>
          </>
        )}
      />
      <main className={styles.main}>
        {loading ? (
          <div className={styles.loading}><PageState kind="loading" title="Loading the map…" /></div>
        ) : (
          <CommandMap
            incidents={incidents}
            tanodTrails={tanodTrails}
            onDispatch={onDispatch}
            onOpenIncident={onOpenIncident}
            prefs={prefs}
            setPref={setPref}
          />
        )}
      </main>
    </div>
  )
}
