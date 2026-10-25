'use client'
import { useState, useCallback, useMemo, useSyncExternalStore } from 'react'
import toast from 'react-hot-toast'
import IncidentMapScreen from '@/components/IncidentMapScreen'
import { useNow } from '@/lib/useNow'

// Sample data around Lahug, Cebu City. Names and reports are invented.
const BASE = [10.3325, 123.8985]
const MIN = 60 * 1000

function at(dLat, dLng) {
  return { latitude: BASE[0] + dLat, longitude: BASE[1] + dLng }
}

function makeSample(now) {
  const iso = (minsAgo) => new Date(now - minsAgo * MIN).toISOString()
  const inc = (id, title, category, priority, status, minsAgo, pos, extra = {}) => ({
    id, title, category, priority, status, created_at: iso(minsAgo), location: extra.location || 'Purok 3, Lahug',
    description: extra.description || '', ...(pos || { latitude: null, longitude: null }),
    profiles: { full_name: extra.reporter || 'Ana Lim', phone: '+63 900 000 0000' },
    assigned_to: extra.assigned_to || null, resolved_at: status === 'resolved' ? iso(minsAgo - 20) : null,
  })
  const incidents = [
    inc('i1', 'Kitchen fire near the chapel', 'Fire', 'Critical', 'pending', 4, at(0.0004, 0.0006), { location: 'Purok 3, beside San Roque Chapel' }),
    inc('i2', 'Fight outside a sari-sari store', 'Violence', 'Critical', 'pending', 9, at(0.0031, 0.0042), { location: 'Purok 5' }),
    inc('i3', 'Flooded drainage on Gorordo Ave', 'Flood', 'High', 'pending', 300, at(-0.0035, -0.004), { location: 'Gorordo Ave, Purok 1' }),
    inc('i4', 'Stray dogs near the elementary school', 'Animals', 'High', 'assigned', 38, at(-0.0022, 0.0049), { location: 'Purok 4', assigned_to: 't2' }),
    inc('i5', 'Karaoke past 10 PM', 'Noise', 'Low', 'assigned', 60, at(0.0052, 0.0068), { location: 'Purok 6', assigned_to: 't3' }),
    inc('i6', 'Broken streetlight', 'Infrastructure', 'Medium', 'assigned', 120, at(-0.0049, 0.0011), { location: 'Salinas Drive', assigned_to: 't1' }),
    inc('i7', 'Overflowing garbage bins', 'Garbage', 'Medium', 'pending', 50, at(0.0021, -0.0052), { location: 'Purok 2 market' }),
    inc('i8', 'Motorcycle blocking the road', 'Traffic', 'Medium', 'pending', 25, at(0.00215, -0.00512), { location: 'Purok 2 market' }),
    inc('i9', 'Graffiti on the covered court', 'Vandalism', 'Medium', 'pending', 70, at(0.00205, -0.00528), { location: 'Purok 2 covered court' }),
    inc('i10', 'Phone snatched at the jeepney stop', 'Theft', 'High', 'resolved', 240, at(-0.001, -0.002), { location: 'JY Square stop' }),
    inc('i11', 'Elderly resident collapsed', 'Medical', 'Critical', 'resolved', 400, at(0.004, -0.001)),
    inc('i12', 'Suspicious package by the gate', 'Other', 'Medium', 'pending', 15, null, { location: 'Near Lahug barangay hall (no pin)' }),
  ]
  return { incidents }
}

// Tanod positions are rebuilt from the clock so their GPS stays "live";
// Aldo's is always 8 minutes old, to show the signal-lost state.
function makeTanods(now) {
  const iso = (minsAgo) => new Date(now - minsAgo * MIN).toISOString()
  const trail = (id, name, positions, minsAgoLatest) => ({
    tanod: { id, full_name: name, phone: '+63 900 000 0001', on_duty: true, avatar_url: null },
    points: positions.map((p, i) => ({
      tanod_id: id, ...at(p[0], p[1]), accuracy: 12,
      recorded_at: iso(minsAgoLatest + (positions.length - 1 - i) * 3),
    })),
  })
  const tanodTrails = {
    t1: trail('t1', 'Ramon Santos', [[-0.001, 0.002], [0.0001, 0.0014]], 1),
    t2: trail('t2', 'Joel Cruz', [[-0.004, 0.006], [-0.0035, 0.0058]], 1),
    t3: trail('t3', 'Mark Reyes', [[0.004, 0.006], [0.0047, 0.0063]], 2),
    t4: trail('t4', 'Aldo Villanueva', [[-0.0005, -0.006], [-0.0008, -0.0065]], 8),
  }
  return tanodTrails
}

const noopSubscribe = () => () => {}

export default function MapPreview() {
  // Like the real page, show the loading state on the server and build the
  // sample in the browser: times rendered on both would disagree by seconds.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false)
  const now = useNow()
  const [data, setData] = useState(() => makeSample(now))
  const tanodTrails = useMemo(() => makeTanods(now), [now])

  const onDispatch = useCallback(async (incident, tanodId) => {
    await new Promise(r => setTimeout(r, 400))
    setData(d => ({ ...d, incidents: d.incidents.map(i => (i.id === incident.id ? { ...i, status: 'assigned', assigned_to: tanodId } : i)) }))
    toast.success('Tanod dispatched (sample data)')
  }, [])

  return (
    <IncidentMapScreen
      loading={!hydrated}
      barangayName="Lahug (sample data)"
      live
      incidents={data.incidents}
      tanodTrails={tanodTrails}
      onDispatch={onDispatch}
      onOpenIncident={(inc) => toast(`Would open ${inc.title}`)}
      onBack={() => toast('Back to dashboard')}
    />
  )
}
