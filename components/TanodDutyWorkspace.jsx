'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, ClipboardList, RefreshCw, Plus, Download, Clock3, Users, CheckCircle2, AlertCircle, Pencil, X } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { dateBounds, dutySessions, filterDutySessions, formatDutyTime, durationLabel, manilaDate, manilaInput, readDutyRows, scheduleError, shiftDate, validateShift } from '@/lib/tanodDuty.mjs'
import styles from './tanod-duty.module.css'

function emptyForm(day) {
  return { id: null, tanod_id: '', start: `${day}T08:00`, end: `${day}T16:00`, area: '', notes: '' }
}

export default function TanodDutyWorkspace({ profile, mode }) {
  const schedule = mode === 'schedule'
  const supabase = useMemo(() => createClient(), [])
  const [today] = useState(() => manilaDate())
  const [from, setFrom] = useState(schedule ? today : `${today.slice(0, 7)}-01`)
  const [to, setTo] = useState(schedule ? shiftDate(today, 6) : today)
  const [tanodId, setTanodId] = useState('all')
  const [status, setStatus] = useState('all')
  const [data, setData] = useState({ people: [], rows: [], errors: [], ready: false })
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)
  const [form, setForm] = useState(() => emptyForm(shiftDate(today, 1)))
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [cancelId, setCancelId] = useState(null)
  const [now, setNow] = useState(() => Date.now())
  const editor = useRef(null)
  const firstField = useRef(null)

  useEffect(() => {
    let alive = true
    let version = 0
    let debounce
    async function load() {
      const current = ++version
      setLoading(true)
      const results = await Promise.allSettled([
        readDutyRows(() => supabase.from('profiles').select('id,full_name,role,barangay_id,deactivated_at,on_duty').eq('barangay_id', profile.barangay_id).eq('role', 'tanod').order('full_name').order('id')),
        readDutyRows(() => supabase.from(schedule ? 'tanod_duty_schedules' : 'duty_logs').select(schedule ? 'id,tanod_id,barangay_id,starts_at,ends_at,area,notes,status,updated_at' : 'id,tanod_id,barangay_id,went_on_duty,changed_at').eq('barangay_id', profile.barangay_id).order(schedule ? 'starts_at' : 'changed_at').order('id')),
      ])
      if (!alive || current !== version) return
      const [people, records] = results
      setData({
        people: people.status === 'fulfilled' ? people.value : [],
        rows: records.status === 'fulfilled' ? records.value : [],
        errors: [people.status === 'rejected' && 'Could not load tanod names. Refresh to try again.', records.status === 'rejected' && (schedule ? scheduleError(records.reason, 'load') : 'Could not load duty records. Refresh to try again.')].filter(Boolean),
        ready: people.status === 'fulfilled' && records.status === 'fulfilled',
      })
      setNow(Date.now())
      setLoading(false)
    }
    const refresh = () => { clearTimeout(debounce); debounce = setTimeout(load, 250) }
    load()
    const channel = supabase.channel(`tanod-duty-${mode}-${profile.barangay_id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: schedule ? 'tanod_duty_schedules' : 'duty_logs', filter: `barangay_id=eq.${profile.barangay_id}` }, refresh)
      .subscribe()
    window.addEventListener('focus', refresh)
    const timer = setInterval(refresh, 60000)
    return () => { alive = false; clearTimeout(debounce); clearInterval(timer); window.removeEventListener('focus', refresh); supabase.removeChannel(channel) }
  }, [supabase, profile.barangay_id, mode, schedule, reload])

  const people = new Map(data.people.map(p => [p.id, p]))
  const name = id => people.get(id)?.full_name || 'Unavailable tanod'
  const bounds = dateBounds(from, to)
  const sessions = useMemo(() => dutySessions(schedule ? [] : data.rows), [data.rows, schedule])
  const recordState = row => row.incomplete ? 'Incomplete record' : row.end ? 'Closed' : 'No clock-out recorded'
  const scheduleState = row => row.status === 'cancelled' ? 'Cancelled' : new Date(row.ends_at).getTime() <= now ? 'Past shift' : new Date(row.starts_at).getTime() <= now ? 'Scheduled now' : 'Upcoming'
  const rows = schedule
    ? data.rows.filter(r => bounds && (tanodId === 'all' || r.tanod_id === tanodId) && new Date(r.starts_at).getTime() < bounds.end && new Date(r.ends_at).getTime() > bounds.start && (status === 'all' || (status === 'cancelled' ? r.status === 'cancelled' : r.status !== 'cancelled')))
    : filterDutySessions(sessions, bounds, tanodId, now).filter(r => status === 'all' || (status === 'closed' ? r.end && !r.incomplete : !r.end || r.incomplete))
  const totalPeople = new Set(rows.map(r => r.tanod_id)).size
  const incomplete = rows.filter(r => !r.end || r.incomplete).length
  const active = rows.filter(r => r.status === 'scheduled').length
  const canSave = data.ready && !saving && !loading

  function openEditor(row) {
    setForm(row ? { id: row.id, tanod_id: row.tanod_id, start: manilaInput(row.starts_at), end: manilaInput(row.ends_at), area: row.area || '', notes: row.notes || '', updated_at: row.updated_at } : emptyForm(from > today ? from : shiftDate(manilaDate(), 1)))
    setError(''); setNotice(''); setCancelId(null)
    requestAnimationFrame(() => { editor.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); firstField.current?.focus({ preventScroll: true }) })
  }
  function update(field, value) { setForm(previous => ({ ...previous, [field]: value })) }

  async function save(event) {
    event.preventDefault()
    if (!canSave) return
    const checked = validateShift(form, data.rows)
    if (checked.error) { setError(checked.error); return }
    setSaving(true); setError(''); setNotice('')
    try {
      const { error: failure } = await supabase.rpc('save_tanod_duty_schedule', { p_id: form.id, p_tanod_id: form.tanod_id, p_starts_at: checked.starts_at, p_ends_at: checked.ends_at, p_area: form.area.trim(), p_notes: form.notes.trim(), p_expected_updated_at: form.updated_at || null })
      if (failure) throw failure
      setNotice(form.id ? 'Duty shift updated.' : 'Duty shift scheduled.')
      setFrom(form.start.slice(0, 10)); setTo(form.end.slice(0, 10)); setTanodId('all'); setStatus('all')
      setForm(emptyForm(shiftDate(manilaDate(), 1)))
      setReload(v => v + 1)
    } catch (failure) { setError(scheduleError(failure)) }
    finally { setSaving(false) }
  }
  async function cancel(row) {
    if (!canSave) return
    setSaving(true); setError(''); setNotice('')
    try {
      const { error: failure } = await supabase.rpc('cancel_tanod_duty_schedule', { p_id: row.id, p_expected_updated_at: row.updated_at })
      if (failure) throw failure
      setCancelId(null); setNotice('Shift cancelled. It remains in the schedule history.')
      if (form.id === row.id) setForm(emptyForm(shiftDate(manilaDate(), 1)))
      setReload(v => v + 1)
    } catch (failure) { setError(scheduleError(failure)) }
    finally { setSaving(false) }
  }
  function exportRecords() {
    const cell = value => `"${String(value ?? '').replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"', '""')}"`
    const csv = [['Tanod', 'Duty start (Asia/Manila)', 'Duty end (Asia/Manila)', 'Full recorded duration', 'Record status'], ...rows.map(r => [name(r.tanod_id), formatDutyTime(r.start), formatDutyTime(r.end), r.start && r.end ? durationLabel(new Date(r.end) - new Date(r.start)) : '', recordState(r)])].map(r => r.map(cell).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a'); link.href = url; link.download = `tanod-duty-${from}-${to}.csv`; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return <section className={styles.workspace} aria-label={schedule ? 'Duty schedule' : 'Duty records'}>
    <div className={styles.banner}><span className={styles.bannerIcon}>{schedule ? <CalendarDays size={23} /> : <ClipboardList size={23} />}</span><div><h2>{schedule ? 'Plan your team’s duty' : 'Duty records'}</h2><p>{schedule ? 'Organize upcoming shifts and assigned areas for your barangay tanods.' : 'Review recorded duty starts and ends across your team.'}</p></div>{schedule && <button className={styles.lightButton} disabled={!canSave} onClick={() => openEditor(null)}><Plus size={16} />New shift</button>}</div>
    <div className={styles.stats}>{[
      [schedule ? 'Scheduled shifts' : 'Duty records', schedule ? active : rows.length, ClipboardList],
      ['Tanods in view', totalPeople, Users],
      [schedule ? 'Cancelled shifts' : 'Closed records', schedule ? rows.length - active : rows.length - incomplete, CheckCircle2],
      [schedule ? 'Upcoming shifts' : 'Needs review', schedule ? rows.filter(r => scheduleState(r) === 'Upcoming').length : incomplete, Clock3],
    ].map(([label, value, Icon]) => <div className={styles.stat} key={label}><span><Icon size={19} /></span><div><small>{label}</small><strong>{loading || !data.ready || !bounds ? '—' : value}</strong></div></div>)}</div>
    {data.errors.length > 0 && <div className={styles.alert} role="alert"><AlertCircle size={18} /><span>{data.errors.join(' ')}</span></div>}
    {error && <div className={styles.alert} role="alert"><AlertCircle size={18} /><span>{error}</span></div>}
    {notice && <div className={styles.success} role="status"><CheckCircle2 size={18} />{notice}</div>}
    <div className={schedule ? styles.scheduleLayout : ''}>
      <div className={styles.card}>
        <div className={styles.heading}><div><h3>{schedule ? 'Team schedule' : 'Recorded duty sessions'}</h3><p>All dates and times are in Philippine time.</p></div><div className={styles.actions}><button className={styles.outlineButton} disabled={loading || saving} onClick={() => setReload(v => v + 1)} aria-label="Refresh duty data"><RefreshCw size={15} />Refresh</button>{!schedule && <button className={styles.outlineButton} disabled={loading || !data.ready || !rows.length} onClick={exportRecords}><Download size={15} />Export</button>}</div></div>
        <div className={styles.filters}>
          <label>From<input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
          <label>Through<input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
          <label>Tanod<select value={tanodId} onChange={e => setTanodId(e.target.value)}><option value="all">All tanods</option>{data.people.map(p => <option key={p.id} value={p.id}>{p.full_name}{p.deactivated_at ? ' (inactive)' : ''}</option>)}</select></label>
          <label>Status<select value={status} onChange={e => setStatus(e.target.value)}><option value="all">All statuses</option>{schedule ? <><option value="scheduled">Scheduled</option><option value="cancelled">Cancelled</option></> : <><option value="closed">Closed records</option><option value="review">Needs review</option></>}</select></label>
        </div>
        {!bounds && <p className={styles.empty} role="alert">Choose a valid date range. The end date must be on or after the start date.</p>}
        {loading ? <p className={styles.empty} role="status">Loading {schedule ? 'duty schedule' : 'duty records'}…</p> : !data.ready ? <p className={styles.empty}>Records are unavailable. Use Refresh after resolving the message above.</p> : bounds && !rows.length ? <div className={styles.empty}><CalendarDays size={28} /><h4>{schedule ? 'No shifts in this view' : 'No duty records in this view'}</h4><p>{schedule ? 'Choose different dates or schedule a new shift.' : 'Try a different date range. Records appear when a tanod changes their duty status.'}</p></div> : bounds && (schedule ? <div className={styles.shifts}>{rows.map(row => <article key={row.id} className={styles.shift}><div className={styles.shiftHeading}><strong>{name(row.tanod_id)}</strong><span className={`${styles.badge} ${row.status === 'cancelled' ? styles.neutral : styles.purple}`}>{scheduleState(row)}</span></div><p className={styles.shiftTime}><Clock3 size={14} />{formatDutyTime(row.starts_at)}<br />to {formatDutyTime(row.ends_at)}</p><p className={styles.area}>{row.area || 'No area specified'}</p>{row.notes && <p className={styles.notes}>{row.notes}</p>}{row.status === 'scheduled' && new Date(row.starts_at).getTime() > now && <div className={styles.shiftActions}><button disabled={!canSave} onClick={() => openEditor(row)}><Pencil size={13} />Edit</button><button disabled={!canSave} onClick={() => setCancelId(row.id)}><X size={13} />Cancel shift</button></div>}{cancelId === row.id && <div className={styles.confirm}><p>Cancel this shift for {name(row.tanod_id)}?</p><div><button disabled={saving} onClick={() => setCancelId(null)}>Keep shift</button><button disabled={!canSave} onClick={() => cancel(row)}>Confirm cancellation</button></div></div>}</article>)}</div> : <div className={styles.tableScroll}><table className={styles.table}><thead><tr><th>Tanod</th><th>Duty start</th><th>Duty end</th><th>Duration</th><th>Record status</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td data-label="Tanod"><strong>{name(row.tanod_id)}</strong></td><td data-label="Duty start">{formatDutyTime(row.start)}</td><td data-label="Duty end">{formatDutyTime(row.end)}</td><td data-label="Duration">{row.start && row.end ? durationLabel(new Date(row.end) - new Date(row.start)) : '—'}</td><td data-label="Record status"><span className={`${styles.badge} ${row.end && !row.incomplete ? styles.green : styles.amber}`}>{recordState(row)}</span></td></tr>)}</tbody></table></div>)}
        <p className={styles.footnote}>{schedule ? 'A planned shift does not automatically turn a tanod’s duty status on or off. Past shifts do not confirm attendance.' : 'Times reflect duty changes received by the system, including delayed offline updates. Duration covers the full closed session. These are self-reported duty records, not verified attendance.'}</p>
      </div>
      {schedule && <aside className={`${styles.card} ${styles.editor}`} ref={editor}>
        <div className={styles.heading}><div><h3>{form.id ? 'Edit duty shift' : 'Schedule a shift'}</h3><p>Set duty hours and an assigned area.</p></div></div>
        <form onSubmit={save} className={styles.form}>
          <fieldset disabled={!canSave}>
            <label>Tanod <span>*</span><select required ref={firstField} value={form.tanod_id} onChange={e => update('tanod_id', e.target.value)}><option value="">Select a tanod</option>{data.people.filter(p => !p.deactivated_at).map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select></label>
            <label>Start date and time <span>*</span><input required type="datetime-local" value={form.start} onChange={e => update('start', e.target.value)} /></label>
            <label>End date and time <span>*</span><input required type="datetime-local" value={form.end} onChange={e => update('end', e.target.value)} /></label>
            <p className={styles.hint}>Philippine time · For overnight duty, choose the following day as the end date. Maximum 24 hours per shift.</p>
            <label>Assigned area<input maxLength={160} value={form.area} onChange={e => update('area', e.target.value)} placeholder="e.g. Barangay hall / Purok 2" /></label>
            <label>Notes<textarea rows={3} maxLength={500} value={form.notes} onChange={e => update('notes', e.target.value)} placeholder="Patrol area or handover instructions" /></label>
            <button className={styles.primaryButton} type="submit">{saving ? 'Saving…' : form.id ? 'Save changes' : 'Save duty shift'}</button>
            {form.id && <button type="button" className={styles.outlineButton} onClick={() => openEditor(null)}>Discard edit</button>}
          </fieldset>
        </form>
      </aside>}
    </div>
  </section>
}
