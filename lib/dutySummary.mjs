import { dateBounds, manilaDate, readDutyRows } from './tanodDuty.mjs'

export function shiftPhase(shift, now = Date.now()) {
  if (new Date(shift.ends_at).getTime() <= now) return 'elapsed'
  return new Date(shift.starts_at).getTime() <= now ? 'current' : 'upcoming'
}

export function todaysShifts(shifts, now = Date.now()) {
  const bounds = dateBounds(manilaDate(now), manilaDate(now))
  const order = { current: 0, upcoming: 1, elapsed: 2 }
  return shifts.filter(s => s.status === 'scheduled' && new Date(s.starts_at).getTime() < bounds.end && new Date(s.ends_at).getTime() > bounds.start)
    .sort((a, b) => order[shiftPhase(a, now)] - order[shiftPhase(b, now)] || new Date(a.starts_at) - new Date(b.starts_at) || a.id.localeCompare(b.id))
}

export function personalShifts(shifts, tanodId, now = Date.now()) {
  const relevant = shifts.filter(s => s.tanod_id === tanodId && s.status === 'scheduled' && new Date(s.ends_at).getTime() > now)
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at) || a.id.localeCompare(b.id))
  return { current: relevant.find(s => shiftPhase(s, now) === 'current') || null, next: relevant.find(s => shiftPhase(s, now) === 'upcoming') || null }
}

export async function loadDutySummary(client, profile, now = Date.now()) {
  if (!profile?.id || !profile?.barangay_id || !['official', 'tanod'].includes(profile.role)) throw new Error('Duty schedule access is unavailable.')
  const query = () => client.from('tanod_duty_schedules')
    .select('id,tanod_id,barangay_id,starts_at,ends_at,area,notes,status')
    .eq('barangay_id', profile.barangay_id).eq('status', 'scheduled')
    .order('starts_at').order('id')
  if (profile.role === 'tanod') {
    // With non-overlapping schedules, two rows cover the current and next shift.
    const { data, error } = await query().eq('tanod_id', profile.id).gt('ends_at', new Date(now).toISOString()).limit(2)
    if (error) throw error
    return { shifts: data || [], people: [] }
  }
  const bounds = dateBounds(manilaDate(now), manilaDate(now))
  const [shifts, people] = await Promise.all([
    readDutyRows(() => query().lt('starts_at', new Date(bounds.end).toISOString()).gt('ends_at', new Date(bounds.start).toISOString())),
    readDutyRows(() => client.from('profiles').select('id,full_name,on_duty,deactivated_at,last_seen_at')
      .eq('barangay_id', profile.barangay_id).eq('role', 'tanod').order('id')),
  ])
  return { shifts, people }
}
