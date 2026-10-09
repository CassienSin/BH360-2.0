export const TIME_ZONE = 'Asia/Manila'
const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
export function dateKey(value) {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  const parts = Object.fromEntries(dateFormatter.formatToParts(date).map(p => [p.type, p.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}
export function monthBounds(month) {
  const [year, number] = month.split('-').map(Number)
  return {
    start: new Date(Date.UTC(year, number - 1, 1) - 8 * 3600000).toISOString(),
    end: new Date(Date.UTC(year, number, 1) - 8 * 3600000).toISOString(),
  }
}
export function shiftMonth(month, offset) {
  const [year, number] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, number - 1 + offset, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}
export function monthCells(month) {
  const [year, number] = month.split('-').map(Number)
  const start = new Date(Date.UTC(year, number - 1, 1)).getUTCDay()
  const length = new Date(Date.UTC(year, number, 0)).getUTCDate()
  return Array.from({ length: Math.ceil((start + length) / 7) * 7 }, (_, i) => {
    const day = i - start + 1
    return day > 0 && day <= length ? `${month}-${String(day).padStart(2, '0')}` : null
  })
}
export function groupEvents(data, visible) {
  const byDay = new Map()
  for (const type of ['appointments', 'incidents', 'announcements']) {
    if (!visible[type]) continue
    for (const item of data[type] || []) {
      // Appointments belong to their scheduled day, never their creation/reminder day.
      const time = type === 'appointments' ? item.starts_at : item.created_at
      const key = dateKey(time)
      if (!key) continue
      if (!byDay.has(key)) byDay.set(key, [])
      byDay.get(key).push({ ...item, type, time })
    }
  }
  for (const events of byDay.values()) events.sort((a, b) => new Date(a.time) - new Date(b.time) || String(a.id).localeCompare(String(b.id)))
  return byDay
}

// Explicit pagination avoids silently dropping records at Supabase's row limit.
export async function loadMonth(client, barangayId, month) {
  const { start, end } = monthBounds(month)
  const tables = ['appointments', 'incidents', 'announcements']
  const results = await Promise.all(tables.map(async table => {
    const column = table === 'appointments' ? 'starts_at' : 'created_at'
    const rows = []
    try {
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await client.from(table).select('*')
          .eq('barangay_id', barangayId).gte(column, start).lt(column, end)
          .order(column, { ascending: true }).order('id', { ascending: true }).range(offset, offset + 499)
        if (error) throw error
        rows.push(...(data || []))
        if (!data || data.length < 500) break
      }
      return { table, rows, error: null }
    } catch {
      return { table, rows: [], error: `Could not load ${table}. Please retry.` }
    }
  }))
  return { data: Object.fromEntries(results.map(r => [r.table, r.rows])), errors: results.filter(r => r.error).map(r => r.error) }
}
