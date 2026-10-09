'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Plus, RefreshCw, Clock3, UserRound, MapPin, ClipboardList } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { CATEGORY_CONFIG } from '@/lib/legalBasis'
import { dateKey, monthCells, shiftMonth, groupEvents, loadMonth, TIME_ZONE } from './calendar-data.mjs'
import styles from './calendar.module.css'

const TYPES = { appointments: { label: 'Appointments', singular: 'Appointment', color: '#087f8c' }, incidents: { label: 'Incidents', singular: 'Incident', color: '#d97706' }, announcements: { label: 'Announcements', singular: 'Announcement', color: '#6554dc' } }
const PRIORITIES = { Low: '#15803d', Medium: '#2563eb', High: '#c2410c', Critical: '#dc2626' }
const EMPTY = { appointments: [], incidents: [], announcements: [] }
const formatTime = value => new Date(value).toLocaleTimeString('en-PH', { timeZone: TIME_ZONE, hour: 'numeric', minute: '2-digit' })
const formatDay = key => new Date(`${key}T12:00:00+08:00`).toLocaleDateString('en-PH', { timeZone: TIME_ZONE, weekday: 'long', month: 'long', day: 'numeric' })

export default function CalendarView() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [today, setToday] = useState(() => dateKey(new Date()))
  const [month, setMonth] = useState(() => dateKey(new Date()).slice(0, 7))
  const [selected, setSelected] = useState(() => dateKey(new Date()))
  const [profile, setProfile] = useState(null)
  const [authError, setAuthError] = useState('')
  const [snapshot, setSnapshot] = useState({ month: '', data: EMPTY, errors: [] })
  const [pending, setPending] = useState(true)
  const [refresh, setRefresh] = useState(0)
  const [visible, setVisible] = useState({ appointments: true, incidents: true, announcements: true })
  const [colorBy, setColorBy] = useState('category')
  const request = useRef(0)
  const dayButtons = useRef(new Map())

  useEffect(() => {
    let cancelled = false
    async function authenticate() {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (cancelled) return
        if (error) throw error
        if (!user) { router.replace('/login'); return }
        const { data: official, error: profileError } = await supabase.from('profiles').select('id, role, barangay_id, barangays(name)').eq('id', user.id).single()
        if (cancelled) return
        if (profileError) throw profileError
        if (official?.role !== 'official' || !official?.barangay_id) { router.replace('/login'); return }
        setProfile(official)
      } catch {
        if (!cancelled) setAuthError('Could not load your calendar access. Refresh this page to try again.')
      }
    }
    authenticate()
    return () => { cancelled = true }
  }, [router, supabase])

  useEffect(() => {
    if (!profile?.barangay_id) return
    let cancelled = false
    let debounce
    async function reload() {
      const id = ++request.current
      setPending(true)
      const result = await loadMonth(supabase, profile.barangay_id, month)
      if (!cancelled && request.current === id) {
        setSnapshot({ month, ...result })
        setPending(false)
      }
    }
    function scheduleReload() { clearTimeout(debounce); debounce = setTimeout(reload, 150) }
    reload()
    const channel = supabase.channel(`calendar-${profile.barangay_id}`)
    for (const table of Object.keys(TYPES)) channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `barangay_id=eq.${profile.barangay_id}` }, scheduleReload)
    channel.subscribe()
    function onFocus() { setToday(dateKey(new Date())); scheduleReload() }
    window.addEventListener('focus', onFocus)
    return () => { cancelled = true; clearTimeout(debounce); window.removeEventListener('focus', onFocus); supabase.removeChannel(channel) }
  }, [supabase, profile?.barangay_id, month, refresh])

  const data = snapshot.month === month ? snapshot.data : EMPTY
  const errors = snapshot.month === month ? snapshot.errors : []
  const loading = !authError && (!profile || pending || snapshot.month !== month)
  const byDay = useMemo(() => groupEvents(data, visible), [data, visible])
  const cells = useMemo(() => monthCells(month), [month])
  const events = byDay.get(selected) || []
  const monthTitle = new Date(`${month}-01T12:00:00+08:00`).toLocaleDateString('en-PH', { timeZone: TIME_ZONE, month: 'long', year: 'numeric' })
  const color = item => item.type !== 'incidents' ? TYPES[item.type].color : colorBy === 'priority' ? PRIORITIES[item.priority] || '#64748b' : CATEGORY_CONFIG[item.category]?.color || '#64748b'

  function navigate(offset) { const next = shiftMonth(month, offset); setMonth(next); setSelected(`${next}-01`) }
  function goToday() { const key = dateKey(new Date()); setToday(key); setMonth(key.slice(0, 7)); setSelected(key) }
  function moveFocus(event, key) {
    const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    if (!(event.key in offsets)) return
    event.preventDefault()
    const date = new Date(`${key}T12:00:00+08:00`)
    date.setTime(date.getTime() + offsets[event.key] * 86400000)
    const next = dateKey(date)
    setMonth(next.slice(0, 7)); setSelected(next)
    requestAnimationFrame(() => dayButtons.current.get(next)?.focus())
  }

  return <div className={styles.page}>
    <header className={styles.header}>
      <button className={styles.iconButton} onClick={() => router.push('/official')} aria-label="Back to dashboard"><ArrowLeft size={19} /></button>
      <span className={styles.logo}><CalendarDays size={21} /></span>
      <div className={styles.heading}><h1>Barangay calendar</h1><p>{profile?.barangays?.name || 'Schedule and activity'} · Philippine time</p></div>
      <div className={styles.headerActions}>
        <button className={styles.secondary} aria-label="View appointments" onClick={() => router.push('/official/calendar/appointments')}><ClipboardList size={16} /><span>Appointments</span></button>
        <button className={styles.primary} aria-label="New appointment" onClick={() => router.push('/official/calendar/appointments/new')}><Plus size={16} /><span>New appointment</span></button>
      </div>
    </header>

    <main className={styles.main}>
      <div className={styles.intro}><div><p className={styles.eyebrow}>MONTHLY OVERVIEW</p><h2>Plan the day. Keep track of your barangay.</h2></div><p>Appointments, reported incidents, and posted announcements in one place.</p></div>
      {authError && <div className={styles.error} role="alert">{authError}</div>}
      <section className={styles.stats} aria-label="Monthly totals">
        {[['Appointments', data.appointments.length, 'Scheduled this month', '#087f8c'], ['Incidents', data.incidents.length, 'Reported this month', '#b45309'], ['Pending incidents', data.incidents.filter(i => i.status === 'pending').length, 'Awaiting assignment', '#c2410c'], ['Announcements', data.announcements.length, 'Posted this month', '#6554dc']].map(([label, count, note, tint]) => <div className={styles.stat} key={label}><span className={styles.statMarker} style={{ background: tint }} /><div><p>{label}</p><strong>{loading || authError || errors.some(e => e.includes(label === 'Pending incidents' ? 'incidents' : label.toLowerCase())) ? '—' : count}</strong><small>{note}</small></div></div>)}
      </section>
      <div className={styles.workspace}>
        <section className={styles.calendar} aria-label="Month calendar" aria-busy={loading}>
          <div className={styles.toolbar}><div><h2 aria-live="polite">{monthTitle}</h2><p>Select a day to see its schedule.</p></div><div className={styles.navigation}><button className={styles.secondary} onClick={goToday}>Today</button><button className={styles.iconButton} aria-label="Previous month" onClick={() => navigate(-1)}><ChevronLeft size={19} /></button><button className={styles.iconButton} aria-label="Next month" onClick={() => navigate(1)}><ChevronRight size={19} /></button></div></div>
          <div className={styles.filters} aria-label="Calendar filters">
            <div className={styles.typeFilters}>{Object.entries(TYPES).map(([type, config]) => <button key={type} aria-pressed={visible[type]} onClick={() => setVisible(prev => ({ ...prev, [type]: !prev[type] }))} className={`${styles.filter} ${visible[type] ? styles.filterActive : ''}`}><span style={{ background: config.color }} />{config.label}</button>)}</div>
            <label className={styles.colorFilter}>Incident color<select value={colorBy} onChange={e => setColorBy(e.target.value)}><option value="category">Category</option><option value="priority">Priority</option></select></label>
          </div>
          {errors.length > 0 && <div className={styles.error} role="alert">{errors.join(' ')} <button onClick={() => setRefresh(v => v + 1)}>Retry</button></div>}
          <div className={styles.weekdays}>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <span key={day}>{day}</span>)}</div>
          <div className={styles.grid}>
            {cells.map((key, index) => {
              if (!key) return <div key={`empty-${index}`} className={styles.blank} aria-hidden="true" />
              const dayEvents = byDay.get(key) || []
              // Put appointments first in the compact preview; the day panel is chronological.
              const previews = [...dayEvents.filter(e => e.type === 'appointments'), ...dayEvents.filter(e => e.type !== 'appointments')]
              return <button key={key} ref={el => { if (el) dayButtons.current.set(key, el); else dayButtons.current.delete(key) }} className={`${styles.day} ${selected === key ? styles.selected : ''} ${today === key ? styles.today : ''}`} onClick={() => setSelected(key)} onKeyDown={e => moveFocus(e, key)} aria-pressed={selected === key} aria-current={today === key ? 'date' : undefined} aria-label={`${formatDay(key)}. ${loading ? 'Loading events' : Object.entries(TYPES).map(([type, conf]) => `${dayEvents.filter(e => e.type === type).length} ${conf.label.toLowerCase()}`).join(', ')}`}>
                <span className={styles.dayTop}><span className={styles.dayNumber}>{Number(key.slice(-2))}</span>{dayEvents.length > 0 && <span className={styles.dayCount}>{dayEvents.length}</span>}</span>
                <span className={styles.cellEvents}>{previews.slice(0, 2).map(item => <span key={`${item.type}-${item.id}`} className={styles.cellEvent} style={{ borderLeftColor: color(item) }}>{item.type === 'appointments' ? `${formatTime(item.time)} · ` : ''}{item.title}</span>)}{dayEvents.length > 2 && <span className={styles.more}>+{dayEvents.length - 2} more</span>}</span>
                <span className={styles.mobileDots}>{Object.keys(TYPES).filter(type => dayEvents.some(e => e.type === type)).map(type => <span key={type} style={{ background: TYPES[type].color }} />)}</span>
              </button>
            })}
          </div>
          <div className={styles.footer}><span>{loading ? 'Loading calendar…' : 'Appointments use their scheduled date. Incidents and announcements use their creation date.'}</span><button className={styles.refresh} aria-label="Refresh calendar" disabled={loading} onClick={() => setRefresh(v => v + 1)}><RefreshCw size={14} />Refresh</button></div>
        </section>

        <aside className={styles.agenda} aria-label="Selected day details">
          <div className={styles.agendaHeading}><p className={styles.eyebrow}>SELECTED DAY</p><h2>{formatDay(selected)}</h2><p aria-live="polite">{loading ? 'Loading schedule…' : `${events.length} visible ${events.length === 1 ? 'item' : 'items'}`}</p></div>
          <div className={styles.agendaBody}>
            {loading ? <p className={styles.empty} role="status">Loading your schedule…</p> : authError ? <p className={styles.empty}>Calendar access is unavailable.</p> : events.length === 0 ? <div className={styles.empty}><CalendarDays size={30} /><h3>{errors.length ? 'Some records could not be loaded' : Object.values(visible).some(Boolean) ? 'Nothing to show for this day' : 'All event types are hidden'}</h3><p>{errors.length ? 'Use Retry above to reload missing records.' : 'Choose another date or adjust the filters above.'}</p></div> : events.map(item => <article key={`${item.type}-${item.id}`} className={styles.event} style={{ borderLeftColor: color(item) }}>
              <div className={styles.eventMeta}><span style={{ color: TYPES[item.type].color }}>{TYPES[item.type].singular}</span><time dateTime={item.time}><Clock3 size={12} />{formatTime(item.time)}</time></div>
              <h3>{item.title}</h3>
              {item.type === 'appointments' && <>{item.participant_name && <p className={styles.detail}><UserRound size={14} />{item.participant_name}</p>}{item.notes && <p className={styles.notes}>{item.notes}</p>}<small>Reminder: {item.remind_at ? new Date(item.remind_at).toLocaleString('en-PH', { timeZone: TIME_ZONE, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Not set'}</small></>}
              {item.type === 'incidents' && <><div className={styles.badges}><span>{item.category || 'Other'}</span><span>{item.priority || 'Unspecified'} priority</span><span>{String(item.status || 'Unknown').replaceAll('_', ' ')}</span></div>{item.location && <p className={styles.detail}><MapPin size={14} />{item.location}</p>}</>}
              {item.type === 'announcements' && <p className={styles.notes}>{item.content}</p>}
            </article>)}
          </div>
          <button className={styles.agendaAction} onClick={() => router.push('/official/calendar/appointments')}><ClipboardList size={16} />View appointment list<ChevronRight size={16} /></button>
        </aside>
      </div>
    </main>
  </div>
}
