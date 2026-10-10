const DAY = 86400000
const PAGE_SIZE = 500

export function manilaDate(value = Date.now()) {
  return new Date(new Date(value).getTime() + 8 * 3600000).toISOString().slice(0, 10)
}
export function shiftDate(date, days) {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + days * DAY).toISOString().slice(0, 10)
}
export function dateBounds(from, to) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) return null
  return { start: new Date(`${from}T00:00:00+08:00`).getTime(), end: new Date(`${shiftDate(to, 1)}T00:00:00+08:00`).getTime() }
}
export function manilaInput(value) {
  return new Date(new Date(value).getTime() + 8 * 3600000).toISOString().slice(0, 16)
}
export function formatDutyTime(value) {
  return value ? new Date(value).toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Not recorded'
}
export function durationLabel(ms) {
  if (ms == null) return '—'
  const minutes = Math.max(0, Math.floor(ms / 60000))
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

export async function readDutyRows(query) {
  const rows = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await query().range(offset, offset + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < PAGE_SIZE) return rows
  }
}

// Preserve unmatched transitions instead of inventing clock-in/out times.
export function dutySessions(logs) {
  const pending = new Map()
  const sessions = []
  const ordered = [...logs].sort((a, b) => new Date(a.changed_at) - new Date(b.changed_at) || a.id.localeCompare(b.id))
  for (const log of ordered) {
    if (!Number.isFinite(new Date(log.changed_at).getTime())) continue
    if (log.went_on_duty) {
      if (pending.has(log.tanod_id)) sessions.push({ ...pending.get(log.tanod_id), incomplete: true })
      pending.set(log.tanod_id, { id: log.id, tanod_id: log.tanod_id, start: log.changed_at, end: null })
    } else {
      const open = pending.get(log.tanod_id)
      sessions.push(open ? { ...open, end: log.changed_at } : { id: log.id, tanod_id: log.tanod_id, start: null, end: log.changed_at, incomplete: true })
      pending.delete(log.tanod_id)
    }
  }
  sessions.push(...pending.values())
  return sessions.sort((a, b) => new Date(b.start || b.end) - new Date(a.start || a.end))
}

export function filterDutySessions(sessions, bounds, tanodId = 'all', now = Date.now()) {
  if (!bounds) return []
  return sessions.filter(s => {
    if (tanodId !== 'all' && s.tanod_id !== tanodId) return false
    const start = new Date(s.start || s.end).getTime()
    const end = s.end ? new Date(s.end).getTime() : s.incomplete ? start : Math.max(start, now)
    return start < bounds.end && (end > bounds.start || (start === end && start >= bounds.start))
  })
}

export function validateShift(form, shifts = [], now = Date.now()) {
  if (!form.tanod_id || !form.start || !form.end) return { error: 'Choose a tanod and enter the start and end times.' }
  const start = new Date(`${form.start}:00+08:00`).getTime()
  const end = new Date(`${form.end}:00+08:00`).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return { error: 'End time must be after start time. For overnight duty, choose the next day.' }
  if (start <= now) return { error: 'Choose a future start time.' }
  if (end - start > DAY) return { error: 'A duty shift can be at most 24 hours.' }
  if ((form.area || '').trim().length > 160 || (form.notes || '').trim().length > 500) return { error: 'Keep the area within 160 characters and notes within 500 characters.' }
  if (shifts.some(s => s.id !== form.id && s.status === 'scheduled' && s.tanod_id === form.tanod_id && new Date(s.starts_at).getTime() < end && new Date(s.ends_at).getTime() > start)) return { error: 'This tanod already has a shift during those hours.' }
  return { starts_at: new Date(start).toISOString(), ends_at: new Date(end).toISOString() }
}

export function scheduleError(error, operation = 'save') {
  if (error?.code === '23P01') return 'This tanod already has a shift during those hours. Refresh and choose another time.'
  if (error?.message?.includes('changed by another')) return 'This shift was changed by another official. Refresh before editing again.'
  if (['42P01', 'PGRST205', 'PGRST202', '42883'].includes(error?.code)) return 'Duty Schedule needs its database update. Ask the app administrator to finish setup, then refresh.'
  return operation === 'load' ? 'Could not load the duty schedule. Check your connection and refresh.' : 'Could not save the shift. Check your connection and access, then refresh before trying again.'
}
