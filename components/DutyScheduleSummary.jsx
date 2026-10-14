'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Clock3, MapPin, RefreshCw, ArrowRight, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { loadDutySummary, personalShifts, shiftPhase, todaysShifts } from '@/lib/dutySummary.mjs'
import { formatDutyTime, manilaDate, scheduleError } from '@/lib/tanodDuty.mjs'
import { activityState } from '@/lib/tanodOverview.mjs'
import styles from './duty-summary.module.css'

const PHASE = { current: 'Scheduled now', upcoming: 'Upcoming', elapsed: 'Time elapsed' }
const shortTime = value => new Date(value).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' })
const shortDate = value => new Date(value).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' })

function ShiftDetails({ shift }) {
  return <>
    <p className={styles.period}><Clock3 size={15} /><span><time dateTime={shift.starts_at}>{formatDutyTime(shift.starts_at)}</time><span className={styles.until}>to </span><time dateTime={shift.ends_at}>{formatDutyTime(shift.ends_at)}</time></span></p>
    <p className={styles.area}><MapPin size={15} /><span>{shift.area || 'Area not specified'}</span></p>
    {shift.notes && <div className={styles.instructions}><strong>Duty instructions</strong><p>{shift.notes}</p></div>}
  </>
}

export default function DutyScheduleSummary({ profile, onManage }) {
  const client = useMemo(() => createClient(), [])
  const official = profile?.role === 'official'
  const { id, barangay_id: barangayId, role } = profile || {}
  const identity = `${id}:${barangayId}:${role}`
  const [result, setResult] = useState(() => ({ identity: null, shifts: [], people: [], error: null, now: Date.now() }))
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!id || !barangayId || !['official', 'tanod'].includes(role)) return
    let cancelled = false
    let version = 0
    let debounce
    async function load() {
      const request = ++version
      setLoading(true)
      const now = Date.now()
      try {
        const data = await loadDutySummary(client, { id, barangay_id: barangayId, role }, now)
        if (!cancelled && request === version) setResult({ ...data, identity, error: null, now })
      } catch (error) {
        if (!cancelled && request === version) setResult({ identity, shifts: [], people: [], error, now })
      } finally {
        if (!cancelled && request === version) setLoading(false)
      }
    }
    const refresh = () => {
      if (document.visibilityState === 'hidden') return
      clearTimeout(debounce); debounce = setTimeout(load, 200)
    }
    load()
    const filter = official ? `barangay_id=eq.${barangayId}` : `tanod_id=eq.${id}`
    const channel = client.channel(`duty-summary-${role}-${barangayId}-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tanod_duty_schedules', filter }, refresh)
    if (official) channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `barangay_id=eq.${barangayId}` }, refresh)
    channel.subscribe()
    const timer = setInterval(refresh, 60000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => { cancelled = true; clearTimeout(debounce); clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); client.removeChannel(channel) }
  }, [client, id, barangayId, role, official, identity, reload])

  if (!id || !barangayId || !['official', 'tanod'].includes(role)) return null
  const busy = loading || result.identity !== identity
  const error = result.identity === identity ? result.error : null
  const today = todaysShifts(result.shifts, result.now)
  const personal = personalShifts(result.shifts, id, result.now)
  const people = new Map(result.people.map(p => [p.id, p]))
  const heading = official ? 'Today’s Duty' : 'Your Next Shift'

  return <section className={styles.card} aria-label={heading}>
    <header className={styles.header}>
      <span className={styles.icon}><CalendarDays size={21} /></span>
      <div className={styles.title}><h3>{heading}</h3><p>{official ? `${new Date(result.now).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', weekday: 'long', month: 'short', day: 'numeric' })} · Philippine time` : 'Your assigned duty hours and instructions'}</p></div>
      <button type="button" className={styles.refresh} aria-label={`Refresh ${official ? 'today’s duty' : 'your next shift'}`} disabled={busy} onClick={() => setReload(v => v + 1)}><RefreshCw size={15} /></button>
      {official && onManage && <button type="button" className={styles.manage} onClick={onManage}>Manage schedule<ArrowRight size={14} /></button>}
    </header>

    {busy ? <p className={styles.empty} role="status">Loading duty schedule…</p> : error ? <div className={styles.error} role="alert"><AlertCircle size={18} /><p>{official ? scheduleError(error, 'load') : 'Your schedule could not be loaded. Refresh to try again, or contact your barangay official to confirm your duty hours.'}</p></div> : official ? <>
      {today.length === 0 ? <div className={styles.empty}><h4>No shifts planned for today</h4><p>Use Manage schedule to assign duty hours. Current availability is shown in the roster below.</p></div> : <>
        <div className={styles.summary}><span><strong>{today.length}</strong> {today.length === 1 ? 'shift' : 'shifts'} planned today</span><span><strong>{today.filter(s => shiftPhase(s, result.now) === 'current').length}</strong> scheduled now</span></div>
        <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th scope="col">Tanod</th><th scope="col">Scheduled hours</th><th scope="col">Assigned area</th><th scope="col">Current duty status</th></tr></thead><tbody>{(expanded ? today : today.slice(0, 4)).map(shift => {
          const person = people.get(shift.tanod_id)
          const phase = shiftPhase(shift, result.now)
          const known = person && !person.deactivated_at && typeof person.on_duty === 'boolean'
          const stale = known && activityState(person, result.now).stale
          return <tr key={shift.id}>
            <td data-label="Tanod"><strong>{person?.full_name || 'Unavailable tanod'}</strong><span className={`${styles.badge} ${styles[phase]}`}>{PHASE[phase]}</span></td>
            <td data-label="Scheduled hours"><time dateTime={shift.starts_at}>{shortTime(shift.starts_at)}</time> – <time dateTime={shift.ends_at}>{shortTime(shift.ends_at)}</time>{manilaDate(shift.starts_at) !== manilaDate(shift.ends_at) && <small>{shortDate(shift.starts_at)} – {shortDate(shift.ends_at)} · Overnight</small>}</td>
            <td data-label="Assigned area">{shift.area || 'Not specified'}</td>
            <td data-label="Current duty status"><span className={`${styles.badge} ${known && person.on_duty ? styles.on : styles.off}`}>{person?.deactivated_at ? 'Inactive account' : !known ? 'Unavailable' : person.on_duty ? 'On duty' : 'Off duty'}</span>{stale && <small className={styles.stale}>No recent app activity</small>}</td>
          </tr>
        })}</tbody></table></div>
        {today.length > 4 && <button type="button" className={styles.showAll} aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>{expanded ? 'Show fewer shifts' : `Show all ${today.length} shifts`}</button>}
      </>}
      <p className={styles.footnote}>Scheduled hours are the plan. Current duty status is self-reported and does not confirm attendance.</p>
    </> : <div className={styles.personal}>
      {personal.current && <div className={styles.currentShift}><span className={`${styles.badge} ${styles.current}`}>Scheduled now</span><ShiftDetails shift={personal.current} /></div>}
      {personal.next ? <div className={styles.nextShift}><span className={`${styles.badge} ${styles.upcoming}`}>{personal.current ? 'Next scheduled shift' : 'Upcoming shift'}</span><ShiftDetails shift={personal.next} /></div> : <div className={styles.empty}><h4>{personal.current ? 'No further shift scheduled' : 'No upcoming duty shift'}</h4><p>Your barangay official’s next assignment will appear here.</p></div>}
      <p className={styles.personalNote}>All times are in Philippine time. Use the duty toggle when you start or finish duty; a schedule does not change your status automatically.</p>
    </div>}
  </section>
}
