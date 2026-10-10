'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Shield, Users, Search, Phone, MapPin, Clock3, Plus, RefreshCw, ChevronRight, AlertCircle, ClipboardList } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { timeAgo } from '@/lib/timeAgo'
import { activityState, filterTanods, groupAssignments, loadTanodOverview } from '@/lib/tanodOverview.mjs'
import styles from './tanod-management.module.css'

const EMPTY = []
const FILTERS = [['all', 'All tanods'], ['on', 'On duty'], ['off', 'Off duty'], ['assigned', 'With assignments']]
const dateTime = value => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Not recorded'

function Avatar({ tanod, large = false }) {
  const [failed, setFailed] = useState(false)
  return <span className={`${styles.avatar} ${large ? styles.avatarLarge : ''}`} aria-hidden="true">
    {(tanod.full_name || '?').split(' ').filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase()}
    {tanod.avatar_url && !failed && (
      // Small user-uploaded avatars can come from dynamic storage URLs.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={tanod.avatar_url} alt="" loading="lazy" onError={() => setFailed(true)} />
    )}
  </span>
}

export default function TanodManagementOverview({ profile, onInvite, onOpenIncident }) {
  const supabase = useMemo(() => createClient(), [])
  const [result, setResult] = useState({ barangayId: null, tanods: null, assignments: null, errors: [], loadedAt: null })
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [selectedId, setSelectedId] = useState(null)
  const [now, setNow] = useState(() => Date.now())
  const requests = useRef(0)
  const details = useRef(null)

  useEffect(() => {
    if (!profile?.barangay_id || profile?.role !== 'official') return
    let cancelled = false
    let debounce
    const barangayId = profile.barangay_id
    async function load() {
      const version = ++requests.current
      setLoading(true)
      const next = await loadTanodOverview(supabase, barangayId)
      if (!cancelled && version === requests.current) {
        setResult({ ...next, barangayId, loadedAt: Date.now() })
        setNow(Date.now())
        setLoading(false)
      }
    }
    function refresh() { clearTimeout(debounce); debounce = setTimeout(load, 250) }
    load()
    const channel = supabase.channel(`tanod-overview-${barangayId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `barangay_id=eq.${barangayId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents', filter: `barangay_id=eq.${barangayId}` }, refresh)
      .subscribe()
    window.addEventListener('focus', refresh)
    const tick = setInterval(() => setNow(Date.now()), 60000)
    return () => { cancelled = true; clearTimeout(debounce); clearInterval(tick); window.removeEventListener('focus', refresh); supabase.removeChannel(channel) }
  }, [supabase, profile?.barangay_id, profile?.role, reload])

  const sameBarangay = result.barangayId === profile?.barangay_id
  const tanods = sameBarangay ? result.tanods : null
  const assignments = useMemo(() => groupAssignments(sameBarangay ? result.assignments : null), [sameBarangay, result.assignments])
  const visible = useMemo(() => filterTanods(tanods || EMPTY, assignments, search, filter), [tanods, assignments, search, filter])
  const selected = visible.find(t => t.id === selectedId) || visible[0]
  const currentWork = selected && assignments ? assignments.get(selected.id) || EMPTY : null
  const busy = loading || !sameBarangay
  const errors = sameBarangay ? result.errors : []
  const onDuty = tanods?.filter(t => t.on_duty).length
  const withAssignments = assignments && tanods ? tanods.filter(t => assignments.get(t.id)?.length > 0).length : null
  const staleCount = tanods?.filter(t => activityState(t, now).stale).length || 0

  function selectTanod(id) {
    setSelectedId(id)
    requestAnimationFrame(() => {
      if (window.matchMedia('(max-width: 900px)').matches) {
        details.current?.scrollIntoView({ behavior: 'auto', block: 'start' })
        details.current?.focus({ preventScroll: true })
      }
    })
  }

  return <section className={styles.overview} aria-label="Tanod management overview">
    <div className={styles.banner}>
      <span className={styles.bannerIcon}><Shield size={23} /></span>
      <div><h2>Team overview</h2><p>See who is on duty and keep track of current assignments.</p></div>
      <button type="button" onClick={onInvite} className={styles.invite}><Plus size={16} />Invite tanod</button>
    </div>

    <div className={styles.stats} aria-label="Tanod summary">
      {[
        ['Total tanods', tanods?.length, 'Active accounts', 'all', Users, 'purple'],
        ['On duty', onDuty, 'Marked as on duty', 'on', Shield, 'green'],
        ['With assignments', withAssignments, 'Have active incidents', 'assigned', ClipboardList, 'orange'],
        ['Off duty', tanods ? tanods.length - onDuty : null, 'Marked as off duty', 'off', Clock3, 'gray'],
      ].map(([label, value, caption, key, Icon, tone]) => <button type="button" key={key} className={`${styles.stat} ${filter === key ? styles.statSelected : ''}`} onClick={() => setFilter(key)} aria-pressed={filter === key} aria-label={`Filter ${label.toLowerCase()}`}>
        <span className={`${styles.statIcon} ${styles[tone]}`}><Icon size={20} /></span><span><span className={styles.statLabel}>{label}</span><strong>{value == null ? '—' : value}</strong><small>{caption}</small></span>
      </button>)}
    </div>

    {errors.length > 0 && <div className={styles.notice} role="alert"><AlertCircle size={17} /><span>{errors.join(' ')} Missing information is shown as unavailable.</span><button type="button" disabled={busy} onClick={() => setReload(v => v + 1)}>Retry</button></div>}
    {staleCount > 0 && <div className={styles.notice}><Clock3 size={16} /><span>{staleCount} on-duty {staleCount === 1 ? 'tanod has' : 'tanods have'} no recent app activity. Call to confirm availability when needed.</span></div>}

    <div className={styles.workspace}>
      <div className={styles.roster}>
        <div className={styles.rosterHeading}><div><h3>Tanod roster</h3><p aria-live="polite">{busy ? 'Updating roster…' : tanods ? `${visible.length} of ${tanods.length} tanods shown` : 'Roster unavailable'}</p></div><button type="button" className={styles.refresh} onClick={() => setReload(v => v + 1)} disabled={busy} aria-label="Refresh tanod overview"><RefreshCw size={15} /><span>Refresh</span></button></div>
        <div className={styles.tools}><label className={styles.search}><Search size={16} /><input aria-label="Search tanods" placeholder="Search name, phone, or address…" value={search} onChange={e => setSearch(e.target.value)} />{search && <button type="button" aria-label="Clear search" onClick={() => setSearch('')}>×</button>}</label><div className={styles.filters} aria-label="Filter tanod roster">{FILTERS.map(([key, label]) => <button type="button" key={key} aria-pressed={filter === key} className={filter === key ? styles.filterActive : ''} onClick={() => setFilter(key)}>{label}</button>)}</div></div>
        {busy && !tanods ? <p className={styles.empty} role="status">Loading your tanod roster…</p> : tanods === null ? <p className={styles.empty}>The roster could not be loaded. Use Retry above.</p> : visible.length === 0 ? <div className={styles.empty}><Users size={30} /><h4>{tanods.length ? 'No matching tanods' : 'No tanods registered yet'}</h4><p>{tanods.length ? 'Try a different name or duty filter.' : 'Invite your barangay tanods to get started.'}</p>{tanods.length > 0 ? <button type="button" onClick={() => { setSearch(''); setFilter('all') }}>Clear filters</button> : <button type="button" onClick={onInvite}>Invite tanod</button>}</div> : <div className={styles.tableScroll} aria-busy={busy}><table className={styles.table}><thead><tr><th scope="col">Tanod</th><th scope="col">Duty status</th><th scope="col">Assignments</th><th scope="col"><span className={styles.srOnly}>Actions</span></th></tr></thead><tbody>{visible.map(t => {
          const count = assignments ? assignments.get(t.id)?.length || 0 : null
          const activity = activityState(t, now)
          return <tr key={t.id} className={selected?.id === t.id ? styles.selectedRow : ''}>
            <td data-label="Tanod"><div className={styles.person}><Avatar key={`${t.id}-${t.avatar_url}`} tanod={t} /><div><strong>{t.full_name || 'Unnamed tanod'}</strong><small>{t.phone || 'No phone number'}</small><small className={activity.stale ? styles.stale : ''}>{activity.missing ? 'App activity unknown' : `Last active ${timeAgo(t.last_seen_at, new Date(now))}`}</small></div></div></td>
            <td data-label="Duty status"><span className={`${styles.badge} ${t.on_duty ? styles.green : styles.gray}`}>{t.on_duty ? 'On duty' : 'Off duty'}</span></td>
            <td data-label="Assignments"><span className={`${styles.badge} ${count > 0 ? styles.orange : styles.gray}`}>{count === null ? 'Unavailable' : `${count} active`}</span></td>
            <td className={styles.rowAction}><button type="button" aria-label={`View details for ${t.full_name || 'tanod'}`} aria-controls="tanod-overview-details" aria-pressed={selected?.id === t.id} onClick={() => selectTanod(t.id)}>Details<ChevronRight size={14} /></button></td>
          </tr>
        })}</tbody></table></div>}
        <div className={styles.rosterFooter}>Duty status is self-reported. App activity does not confirm attendance.{result.loadedAt && <span>Updated {timeAgo(result.loadedAt, new Date(now))}</span>}</div>
      </div>

      <aside className={styles.details} id="tanod-overview-details" ref={details} tabIndex={-1} aria-label="Selected tanod details">
        {selected ? <>
          <div className={styles.detailsHeading}><Avatar key={`${selected.id}-${selected.avatar_url}`} tanod={selected} large /><h3>{selected.full_name || 'Unnamed tanod'}</h3><span className={`${styles.badge} ${selected.on_duty ? styles.green : styles.gray}`}>{selected.on_duty ? 'On duty' : 'Off duty'}</span></div>
          <div className={styles.detailsBody}>
            <dl className={styles.contact}><div><dt><Phone size={14} />Phone</dt><dd>{selected.phone ? <a href={`tel:${selected.phone.replace(/[^0-9+]/g, '')}`}>{selected.phone}</a> : 'Not provided'}</dd></div><div><dt><MapPin size={14} />Address</dt><dd>{selected.address || 'Not provided'}</dd></div><div><dt><Clock3 size={14} />{selected.on_duty ? 'On duty since' : 'Off duty since'}</dt><dd>{dateTime(selected.duty_changed_at)}</dd></div></dl>
            {!selected.on_duty && currentWork?.length > 0 && <p className={styles.inlineNotice}>This tanod is off duty but still has active assignments. Review the incidents below.</p>}
            {activityState(selected, now).stale && <p className={styles.inlineNotice}>No recent app activity. Confirm availability by phone if a response is needed.</p>}
            <div className={styles.assignmentsHeading}><h4>Current assignments</h4><span>{currentWork === null ? '—' : currentWork.length}</span></div>
            {currentWork === null ? <p className={styles.muted}>Assignment information is unavailable.</p> : currentWork.length === 0 ? <p className={styles.muted}>No active incidents assigned.</p> : <div className={styles.assignmentList}>{currentWork.map(incident => <button type="button" key={incident.id} className={styles.assignment} onClick={() => onOpenIncident(incident.id)}><span className={styles.assignmentTop}><span>{incident.category || 'Incident'}</span><span className={incident.priority === 'Critical' || incident.priority === 'High' ? styles.urgent : ''}>{incident.priority || 'Unspecified'} priority</span></span><strong>{incident.title || 'Untitled incident'}</strong>{incident.location && <small>{incident.location}</small>}<span className={styles.openIncident}>View incident<ChevronRight size={13} /></span></button>)}</div>}
          </div>
        </> : <div className={styles.empty}><Shield size={30} /><h4>Tanod details</h4><p>Select a tanod from the roster to view contact information and assignments.</p></div>}
      </aside>
    </div>
  </section>
}
