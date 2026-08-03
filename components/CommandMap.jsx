'use client'
import { useState, useMemo, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import {
  Activity, Shield, Clock, AlertTriangle, Radar, Sun, Moon, Layers,
  Crosshair, History, Play, Pause, X, Send, Phone, MapPin, Navigation, Flame,
} from 'lucide-react'
import { timeAgo, fullDate } from '@/lib/timeAgo'
import { rankResponders, formatDistance, formatEta } from '@/lib/geo'
import { useCoverageStats, stateAtTime } from '@/lib/mapStats'
import { LEGAL_BASIS } from '@/lib/legalBasis'

const IncidentMap = dynamic(() => import('@/components/IncidentMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center" style={{ background: '#eceafc' }}>
      <div className="text-sm text-gray-400">Loading map…</div>
    </div>
  ),
})

/**
 * Command console around the incident map.
 *
 * The map alone is a viewer: it shows where things are. This turns it into
 * a console — see, decide, dispatch — by putting the live queue and the
 * dispatch decision on either side of it, so an official never has to
 * navigate away mid-incident.
 *
 * Theme is a toggle rather than a fixed choice: the dark "operations" view
 * is not decoration, it is for the night shift. A white screen in a dark
 * barangay hall causes glare and kills night vision; officials working
 * daylight hours generally prefer the lighter map.
 */

const PRIORITY_COLOR = { Critical: '#dc2626', High: '#f97316', Medium: '#3b82f6', Low: '#22c55e' }
const CATEGORY_EMOJI = {
  Noise: '🔊', Theft: '🚨', Violence: '⚠️', Fire: '🔥', Flood: '🌊',
  Infrastructure: '🛠️', Animals: '🐕', Medical: '🚑', Traffic: '🚦',
  Vandalism: '🎨', Drugs: '💊', Other: '📝',
}

const THEME = {
  light: {
    shell: '#ffffff', panel: '#ffffff', border: '#f0effe',
    text: '#1f2937', dim: '#9ca3af', sub: '#6b7280',
    raised: '#fafaff', accent: '#5B54E8',
  },
  dark: {
    shell: '#0f1117', panel: '#161923', border: '#242938',
    text: '#e8eaf2', dim: '#6b7280', sub: '#9aa3b8',
    raised: '#1c2030', accent: '#8b85ff',
  },
}

export default function CommandMap({
  incidents = [],
  tanodTrails = {},
  onDispatch,            // (incident, tanodId) => Promise
  onOpenIncident,
}) {
  const [theme, setTheme] = useState('light')
  const [selectedId, setSelectedId] = useState(null)
  const [showCoverage, setShowCoverage] = useState(false)
  const [showHeatmap, setShowHeatmap] = useState(false)
  const [radiusActive, setRadiusActive] = useState(false)
  const [radiusResult, setRadiusResult] = useState(null)
  const [timeMachine, setTimeMachine] = useState(false)
  const [timeOffset, setTimeOffset] = useState(0)  // minutes back from now
  const [playing, setPlaying] = useState(false)
  const [dispatching, setDispatching] = useState(null)

  const t = THEME[theme]

  // ---- Base data ------------------------------------------------------
  const validIncidents = useMemo(
    () => incidents.filter(i => Number.isFinite(i.latitude) && Number.isFinite(i.longitude)),
    [incidents]
  )

  const allTrailPoints = useMemo(() => {
    const out = []
    for (const { points } of Object.values(tanodTrails || {})) {
      for (const p of points || []) {
        if (Number.isFinite(p.latitude)) out.push(p)
      }
    }
    return out
  }, [tanodTrails])

  const livePositions = useMemo(() => {
    const out = []
    for (const [tanodId, { tanod, points }] of Object.entries(tanodTrails || {})) {
      const valid = (points || []).filter(p => Number.isFinite(p.latitude))
      if (!valid.length) continue
      const latest = valid[valid.length - 1]
      out.push({
        tanodId, tanod,
        latitude: latest.latitude,
        longitude: latest.longitude,
        recordedAt: latest.recorded_at,
        stale: Date.now() - new Date(latest.recorded_at).getTime() > 5 * 60 * 1000,
      })
    }
    return out
  }, [tanodTrails])

  // ---- Time machine ---------------------------------------------------
  const atMs = useMemo(
    () => Date.now() - timeOffset * 60 * 1000,
    [timeOffset]
  )
  const rewound = useMemo(
    () => (timeMachine ? stateAtTime(incidents, tanodTrails, atMs) : null),
    [timeMachine, incidents, tanodTrails, atMs]
  )

  const shownIncidents = timeMachine ? rewound.incidents.filter(i => Number.isFinite(i.latitude)) : validIncidents
  const shownPositions = timeMachine ? rewound.tanodPositions : livePositions

  // Playback
  useEffect(() => {
    if (!playing || !timeMachine) return
    const id = setInterval(() => {
      setTimeOffset(o => {
        if (o <= 0) { setPlaying(false); return 0 }
        return Math.max(0, o - 5)
      })
    }, 220)
    return () => clearInterval(id)
  }, [playing, timeMachine])

  // ---- Derived stats --------------------------------------------------
  const activeCounts = useMemo(() => {
    const c = {}
    incidents.forEach(i => {
      if (i.status === 'assigned' && i.assigned_to) c[i.assigned_to] = (c[i.assigned_to] || 0) + 1
    })
    return c
  }, [incidents])

  const coverage = useCoverageStats(allTrailPoints, validIncidents, 6)

  const stats = useMemo(() => {
    const active = incidents.filter(i => i.status !== 'resolved')
    const critical = active.filter(i => i.priority === 'Critical')
    const onDuty = livePositions.filter(p => p.tanod?.on_duty && !p.stale)
    const resolved = incidents.filter(i => i.resolved_at && i.created_at)
    const avgMin = resolved.length
      ? Math.round(
          resolved.reduce((s, i) =>
            s + (new Date(i.resolved_at) - new Date(i.created_at)) / 60000, 0) / resolved.length
        )
      : null
    const overdue = active.filter(i => {
      const age = Date.now() - new Date(i.created_at).getTime()
      const window = i.priority === 'Critical' ? 15 * 60000
        : i.priority === 'High' ? 4 * 3600000
        : i.priority === 'Medium' ? 24 * 3600000 : 72 * 3600000
      return i.status === 'pending' && age > window
    }).length
    return { active: active.length, critical: critical.length, onDuty: onDuty.length, avgMin, overdue }
  }, [incidents, livePositions])

  const selected = useMemo(
    () => shownIncidents.find(i => i.id === selectedId) || null,
    [shownIncidents, selectedId]
  )

  const responders = useMemo(
    () => (selected ? rankResponders(selected, livePositions, activeCounts) : []),
    [selected, livePositions, activeCounts]
  )

  const queue = useMemo(() => {
    const order = { pending: 1, assigned: 2, resolved: 3 }
    const rank = { Critical: 4, High: 3, Medium: 2, Low: 1 }
    return [...shownIncidents].sort((a, b) =>
      (order[a.status] || 4) - (order[b.status] || 4) ||
      (rank[b.priority] || 2) - (rank[a.priority] || 2) ||
      new Date(a.created_at) - new Date(b.created_at)
    )
  }, [shownIncidents])

  const handleDispatch = useCallback(async (tanodId) => {
    if (!selected) return
    setDispatching(tanodId)
    try {
      await onDispatch?.(selected, tanodId)
    } finally {
      setDispatching(null)
    }
  }, [selected, onDispatch])

  return (
    <div className="rounded-3xl overflow-hidden" style={{ background: t.shell, border: `1px solid ${t.border}` }}>
      <style>{`
        .cmd-scroll::-webkit-scrollbar { width: 6px; }
        .cmd-scroll::-webkit-scrollbar-thumb { background: ${t.border}; border-radius: 3px; }
        .cmd-row { transition: background 140ms ease; }
        .cmd-press { transition: transform 120ms ease; }
        .cmd-press:active { transform: scale(0.97); }
        @keyframes cmdBlink { 0%,100% { opacity:1 } 50% { opacity:0.35 } }
        .cmd-blink { animation: cmdBlink 1.4s ease-in-out infinite; }
      `}</style>

      {/* ================= STATUS RIBBON ================= */}
      <div className="px-3 py-2.5 flex items-center gap-2 overflow-x-auto"
        style={{ background: t.panel, borderBottom: `1px solid ${t.border}` }}>
        <Stat icon={Activity} label="Active" value={stats.active} color="#5B54E8" t={t} />
        <Stat icon={Flame} label="Critical" value={stats.critical} color="#dc2626" t={t}
          blink={stats.critical > 0} />
        <Stat icon={Shield} label="On duty" value={stats.onDuty} color="#22c55e" t={t} />
        <Stat icon={Clock} label="Avg resolve" color="#3b82f6" t={t}
          value={stats.avgMin == null ? '—'
            : stats.avgMin < 60 ? `${stats.avgMin} min`
            : stats.avgMin < 1440 ? `${Math.floor(stats.avgMin / 60)}h ${stats.avgMin % 60}m`
            : `${Math.round(stats.avgMin / 1440)}d`} />
        <Stat icon={AlertTriangle} label="Overdue" value={stats.overdue} color="#f97316" t={t} />
        {coverage && (
          <Stat icon={Radar} label="6h coverage" value={`${coverage.pct}%`}
            color={coverage.pct < 40 ? '#dc2626' : coverage.pct < 70 ? '#f97316' : '#22c55e'} t={t} />
        )}

        <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
          <IconToggle active={showCoverage} onClick={() => setShowCoverage(v => !v)} t={t}
            icon={Radar} label="Patrol gaps" />
          <IconToggle active={showHeatmap} onClick={() => setShowHeatmap(v => !v)} t={t}
            icon={Layers} label="Heatmap" />
          <IconToggle active={radiusActive} onClick={() => { setRadiusActive(v => !v); setRadiusResult(null) }} t={t}
            icon={Crosshair} label="Radius tool" />
          <IconToggle active={timeMachine} onClick={() => { setTimeMachine(v => !v); setTimeOffset(0); setPlaying(false) }} t={t}
            icon={History} label="Time machine" />
          <button onClick={() => setTheme(th => (th === 'light' ? 'dark' : 'light'))}
            aria-label="Toggle map theme"
            className="cmd-press w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: t.raised, color: t.sub, border: `1px solid ${t.border}` }}>
            {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
          </button>
        </div>
      </div>

      {/* ================= TIME SCRUBBER ================= */}
      {timeMachine && (
        <div className="px-3 py-2.5 flex items-center gap-3"
          style={{ background: t.raised, borderBottom: `1px solid ${t.border}` }}>
          <button onClick={() => setPlaying(p => !p)}
            className="cmd-press w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: t.accent, color: 'white' }}
            aria-label={playing ? 'Pause playback' : 'Play back the last 24 hours'}>
            {playing ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <input
            type="range" min={0} max={1440} step={5}
            value={1440 - timeOffset}
            onChange={e => { setTimeOffset(1440 - Number(e.target.value)); setPlaying(false) }}
            aria-label="Rewind the map"
            className="flex-1"
            style={{ accentColor: t.accent }}
          />
          <span className="flex-shrink-0 font-bold tabular-nums" style={{ fontSize: 11, color: t.text }}>
            {timeOffset === 0 ? 'Now' : `−${Math.floor(timeOffset / 60)}h ${timeOffset % 60}m`}
          </span>
          <span className="flex-shrink-0" style={{ fontSize: 10, color: t.dim }}>
            {new Date(atMs).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      )}

      {/* ================= THREE PANES ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_300px]" style={{ height: 'min(70vh, 640px)' }}>

        {/* LEFT — live queue */}
        <div className="hidden lg:flex flex-col overflow-hidden"
          style={{ background: t.panel, borderRight: `1px solid ${t.border}` }}>
          <div className="px-3 py-2 flex-shrink-0" style={{ borderBottom: `1px solid ${t.border}` }}>
            <p style={{ fontSize: 10, color: t.dim }} className="font-black uppercase tracking-wider">
              Queue · {queue.length}
            </p>
          </div>
          <div className="overflow-y-auto cmd-scroll flex-1">
            {queue.length === 0 && (
              <p style={{ fontSize: 12, color: t.dim }} className="px-3 py-8 text-center">
                Nothing on the map.
              </p>
            )}
            {queue.map(inc => {
              const sel = inc.id === selectedId
              const color = PRIORITY_COLOR[inc.priority] || '#3b82f6'
              return (
                <button key={inc.id} onClick={() => setSelectedId(inc.id)}
                  className="cmd-row w-full text-left px-3 py-2.5 flex items-start gap-2"
                  style={{
                    background: sel ? (theme === 'dark' ? '#232a3d' : '#f0effe') : 'transparent',
                    borderLeft: `3px solid ${sel ? t.accent : 'transparent'}`,
                    borderBottom: `1px solid ${t.border}`,
                    opacity: inc.status === 'resolved' ? 0.55 : 1,
                  }}>
                  <span className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center"
                    style={{ background: `${color}22`, fontSize: 12 }}>
                    {CATEGORY_EMOJI[inc.category] || '📍'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p style={{ fontSize: 12, color: t.text }} className="font-bold truncate">{inc.title}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span style={{ fontSize: 9, background: `${color}22`, color }}
                        className="px-1 py-0.5 rounded font-black">{inc.priority}</span>
                      <span style={{ fontSize: 9, color: t.dim }}>{timeAgo(inc.created_at)}</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* CENTER — map */}
        <div className="relative" style={{ minHeight: 320 }}>
          <IncidentMap
            incidents={shownIncidents}
            tanodTrails={timeMachine ? {} : tanodTrails}
            height="100%"
            theme={theme}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onIncidentClick={onOpenIncident}
            overlays={{
              coverage: showCoverage ? { trailPoints: allTrailPoints, incidents: validIncidents } : null,
              heatmap: showHeatmap ? shownIncidents : null,
              radius: radiusActive
                ? { incidents: shownIncidents, tanodPositions: shownPositions, onResult: setRadiusResult }
                : null,
            }}
          />

          {radiusActive && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(91,84,232,0.95)', color: 'white', fontSize: 11, fontWeight: 700 }}>
              {radiusResult
                ? `${radiusResult.incidents.length} incidents · ${radiusResult.tanods.length} tanods in range`
                : 'Tap the map to measure a 200m radius'}
            </div>
          )}
        </div>

        {/* RIGHT — dispatch console */}
        <div className="flex flex-col overflow-hidden"
          style={{ background: t.panel, borderLeft: `1px solid ${t.border}` }}>
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center px-5 text-center">
              <MapPin size={26} style={{ color: t.dim }} className="mb-2" />
              <p style={{ fontSize: 12, color: t.sub }} className="font-bold">Select an incident</p>
              <p style={{ fontSize: 11, color: t.dim }} className="mt-1">
                Pick from the queue or tap a pin to see the closest available responders.
              </p>
            </div>
          ) : (
            <>
              <div className="px-3 py-2.5 flex items-start gap-2 flex-shrink-0"
                style={{ background: PRIORITY_COLOR[selected.priority] || '#3b82f6' }}>
                <span style={{ fontSize: 15 }}>{CATEGORY_EMOJI[selected.category] || '📍'}</span>
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: 12 }} className="font-black text-white leading-tight break-words">
                    {selected.title}
                  </p>
                  <p style={{ fontSize: 10 }} className="text-white opacity-90 font-bold">
                    {selected.priority} · {selected.status} · {timeAgo(selected.created_at)}
                  </p>
                </div>
                <button onClick={() => setSelectedId(null)} aria-label="Clear selection"
                  className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>
                  <X size={12} />
                </button>
              </div>

              <div className="overflow-y-auto cmd-scroll flex-1 p-3 space-y-3">
                <p style={{ fontSize: 11, color: t.sub }} className="flex items-start gap-1.5">
                  <MapPin size={11} className="flex-shrink-0 mt-0.5" style={{ color: t.dim }} />
                  {selected.location || 'No location description'}
                </p>

                {LEGAL_BASIS[selected.category]?.responseMode === 'refer_to_agency' && (
                  <div className="px-2.5 py-2 rounded-xl" style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
                    <p style={{ fontSize: 10 }} className="text-orange-800">
                      <strong>{LEGAL_BASIS[selected.category].agency}</strong> has authority — dispatch to
                      document and assist only.
                    </p>
                  </div>
                )}

                {selected.profiles?.phone && (
                  <a href={`tel:${selected.profiles.phone.replace(/[^0-9+]/g, '')}`}
                    className="cmd-press flex items-center justify-center gap-1.5 w-full h-9 rounded-xl font-bold"
                    style={{ fontSize: 11, background: '#f0fdf4', color: '#16a34a', border: '1px solid #dcfce7' }}>
                    <Phone size={12} /> Call reporter
                  </a>
                )}

                {/* Nearest responders — the point of the whole console */}
                <div>
                  <p style={{ fontSize: 10, color: t.dim }} className="font-black uppercase tracking-wider mb-1.5">
                    Closest responders
                  </p>
                  {responders.length === 0 && (
                    <p style={{ fontSize: 11, color: t.dim }}>
                      No tanod positions available. Location sharing may be off.
                    </p>
                  )}
                  <div className="space-y-1.5">
                    {responders.slice(0, 5).map((r, i) => (
                      <div key={r.tanodId} className="rounded-xl p-2.5"
                        style={{
                          background: i === 0 ? (theme === 'dark' ? '#1b2a1f' : '#f0fdf4') : t.raised,
                          border: `1px solid ${i === 0 ? '#22c55e44' : t.border}`,
                        }}>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden font-black text-white"
                            style={{ background: r.onDuty && !r.stale ? '#22c55e' : '#9ca3af', fontSize: 11 }}>
                            {r.tanod?.avatar_url
                              ? <img src={r.tanod.avatar_url} alt="" className="w-full h-full object-cover" />
                              : (r.tanod?.full_name?.[0]?.toUpperCase() || 'T')}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p style={{ fontSize: 12, color: t.text }} className="font-bold truncate">
                              {r.tanod?.full_name || 'Tanod'}
                              {i === 0 && <span style={{ fontSize: 9, color: '#16a34a' }} className="ml-1">NEAREST</span>}
                            </p>
                            <p style={{ fontSize: 10, color: t.dim }}>
                              {formatDistance(r.meters)} · {formatEta(r.etaFoot)} on foot · {formatEta(r.etaMoto)} riding
                            </p>
                            <p style={{ fontSize: 9, color: t.dim }}>
                              {r.onDuty ? (r.stale ? 'signal lost' : 'on duty') : 'OFF DUTY'}
                              {r.load > 0 && ` · ${r.load} active`}
                            </p>
                          </div>
                        </div>
                        {selected.status === 'pending' && onDispatch && (
                          <button onClick={() => handleDispatch(r.tanodId)}
                            disabled={dispatching === r.tanodId}
                            className="cmd-press w-full h-8 rounded-lg font-bold mt-2 flex items-center justify-center gap-1.5 disabled:opacity-50"
                            style={{
                              fontSize: 11,
                              background: i === 0 ? '#22c55e' : t.accent,
                              color: 'white',
                            }}>
                            <Send size={11} />
                            {dispatching === r.tanodId ? 'Dispatching…' : 'Dispatch'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {Number.isFinite(selected.latitude) && (
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${selected.latitude},${selected.longitude}`}
                    target="_blank" rel="noopener noreferrer"
                    className="cmd-press flex items-center justify-center gap-1.5 w-full h-9 rounded-xl font-bold"
                    style={{ fontSize: 11, background: t.raised, color: t.sub, border: `1px solid ${t.border}` }}>
                    <Navigation size={12} /> Open directions
                  </a>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------ bits ------------------------------ */

function Stat({ icon: Icon, label, value, color, t, blink }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl flex-shrink-0"
      style={{ background: t.raised, border: `1px solid ${t.border}` }}>
      <Icon size={13} style={{ color }} className={blink ? 'cmd-blink' : ''} aria-hidden="true" />
      <div className="leading-none">
        <p style={{ fontSize: 13, color: t.text }} className="font-black tabular-nums">{value}</p>
        <p style={{ fontSize: 9, color: t.dim }} className="font-bold uppercase tracking-wide mt-0.5">{label}</p>
      </div>
    </div>
  )
}

function IconToggle({ active, onClick, icon: Icon, label, t }) {
  return (
    <button onClick={onClick} aria-pressed={active} aria-label={label} title={label}
      className="cmd-press w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
      style={{
        background: active ? t.accent : t.raised,
        color: active ? 'white' : t.sub,
        border: `1px solid ${active ? t.accent : t.border}`,
      }}>
      <Icon size={14} />
    </button>
  )
}