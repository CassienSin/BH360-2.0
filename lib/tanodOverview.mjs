const PAGE_SIZE = 500

async function readAll(query) {
  const rows = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await query().range(offset, offset + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < PAGE_SIZE) return rows
  }
}

export async function loadTanodOverview(client, barangayId) {
  const [roster, work] = await Promise.allSettled([
    readAll(() => client.from('profiles')
      .select('id, full_name, phone, address, avatar_url, role, barangay_id, on_duty, duty_changed_at, last_seen_at, deactivated_at')
      .eq('barangay_id', barangayId).eq('role', 'tanod').is('deactivated_at', null)
      .order('full_name', { ascending: true }).order('id', { ascending: true })),
    readAll(() => client.from('incidents')
      .select('id, title, category, priority, location, assigned_to, status, created_at')
      .eq('barangay_id', barangayId).eq('status', 'assigned')
      .order('created_at', { ascending: false }).order('id', { ascending: true })),
  ])
  return {
    tanods: roster.status === 'fulfilled' ? roster.value : null,
    assignments: work.status === 'fulfilled' ? work.value : null,
    errors: [roster.status === 'rejected' && 'Could not load the tanod roster.', work.status === 'rejected' && 'Could not load current assignments.'].filter(Boolean),
  }
}

export function groupAssignments(incidents) {
  if (incidents === null) return null
  const grouped = new Map()
  for (const incident of incidents) {
    if (!incident.assigned_to || incident.status !== 'assigned') continue
    if (!grouped.has(incident.assigned_to)) grouped.set(incident.assigned_to, [])
    grouped.get(incident.assigned_to).push(incident)
  }
  const priority = { Critical: 0, High: 1, Medium: 2, Low: 3 }
  for (const list of grouped.values()) list.sort((a, b) => (priority[a.priority] ?? 4) - (priority[b.priority] ?? 4))
  return grouped
}

export function filterTanods(tanods, assignments, search, filter) {
  const query = search.trim().toLowerCase()
  return tanods.filter(t => (!query || [t.full_name, t.phone, t.address].some(value => String(value || '').toLowerCase().includes(query))) &&
    (filter === 'all' || (filter === 'on' && t.on_duty) || (filter === 'off' && !t.on_duty) || (filter === 'assigned' && assignments?.get(t.id)?.length > 0)))
    .sort((a, b) => Number(Boolean(b.on_duty)) - Number(Boolean(a.on_duty)) || (a.full_name || '').localeCompare(b.full_name || '') || a.id.localeCompare(b.id))
}

export function activityState(tanod, now = Date.now()) {
  const seen = tanod.last_seen_at ? new Date(tanod.last_seen_at).getTime() : NaN
  return { missing: !Number.isFinite(seen), stale: Boolean(tanod.on_duty) && (!Number.isFinite(seen) || now - seen > 30 * 60000) }
}
