'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { AlertTriangle, Search, X, Download, FileSpreadsheet, SlidersHorizontal, Star, ChevronDown, Clock, Shield, Phone, Check, Send } from 'lucide-react'
import { timeAgo, fullDate } from '@/lib/timeAgo'

const CATEGORY_CONFIG = {
  Noise: { icon: '🔊', color: '#f97316', bg: '#fff7ed' },
  Theft: { icon: '🚨', color: '#ef4444', bg: '#fef2f2' },
  Violence: { icon: '⚠️', color: '#dc2626', bg: '#fef2f2' },
  Fire: { icon: '🔥', color: '#ea580c', bg: '#fff7ed' },
  Flood: { icon: '🌊', color: '#3b82f6', bg: '#eff6ff' },
  Infrastructure: { icon: '🛠️', color: '#8b5cf6', bg: '#f5f3ff' },
  Animals: { icon: '🐕', color: '#a16207', bg: '#fefce8' },
  Medical: { icon: '🚑', color: '#dc2626', bg: '#fef2f2' },
  Traffic: { icon: '🚦', color: '#0891b2', bg: '#ecfeff' },
  Vandalism: { icon: '🎨', color: '#7c3aed', bg: '#f5f3ff' },
  Drugs: { icon: '💊', color: '#be185d', bg: '#fdf2f8' },
  Other: { icon: '📝', color: '#6b7280', bg: '#f9fafb' },
}

const PRIORITY_CONFIG = {
  Low: { color: '#22c55e', bg: '#f0fdf4', icon: '🟢', order: 1 },
  Medium: { color: '#3b82f6', bg: '#eff6ff', icon: '🔵', order: 2 },
  High: { color: '#f97316', bg: '#fff7ed', icon: '🟠', order: 3 },
  Critical: { color: '#dc2626', bg: '#fef2f2', icon: '🔴', order: 4 },
}

const STATUS_FILTERS = [
  { value: 'all', label: 'All', color: '#5B54E8' },
  { value: 'pending', label: 'Pending', color: '#f97316' },
  { value: 'assigned', label: 'Assigned', color: '#3b82f6' },
  { value: 'resolved', label: 'Resolved', color: '#22c55e' },
]

const SORTS = [
  { value: 'triage', label: 'Needs action first' },
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'priority', label: 'Highest priority' },
]

// How long a pending incident can sit before the card starts saying so.
// Critical incidents get a much shorter fuse.
const WAIT_WARN_MS = 2 * 60 * 60 * 1000
const WAIT_URGENT_MS = 6 * 60 * 60 * 1000
const CRITICAL_WARN_MS = 15 * 60 * 1000

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)' // easeOutQuint — settles, never bounces

function waitState(incident) {
  if (incident.status !== 'pending') return null
  const age = Date.now() - new Date(incident.created_at).getTime()
  const critical = incident.priority === 'Critical'
  const warn = critical ? CRITICAL_WARN_MS : WAIT_WARN_MS
  const urgent = critical ? WAIT_WARN_MS : WAIT_URGENT_MS
  if (age < warn) return null
  return {
    level: age >= urgent ? 'urgent' : 'warn',
    label: `Waiting ${timeAgo(incident.created_at).replace(' ago', '')}`,
  }
}

/* ---------------------------------------------------------------------------
   Animation. All of it lives in one place so timings stay consistent, and all
   of it sits inside a no-preference query — nothing moves for people who've
   asked their OS to reduce motion.
--------------------------------------------------------------------------- */
const styles = `
.inc-collapse { display: grid; grid-template-rows: 0fr; opacity: 0; }
.inc-collapse > .inc-collapse-inner { overflow: hidden; min-height: 0; }
.inc-collapse.inc-open { grid-template-rows: 1fr; opacity: 1; }

.inc-noscrollbar::-webkit-scrollbar { display: none; }
.inc-noscrollbar { scrollbar-width: none; }
.inc-sheet-scroll { -webkit-overflow-scrolling: touch; }

@media (prefers-reduced-motion: no-preference) {
  @keyframes incCardIn {
    from { opacity: 0; transform: translateY(10px) scale(0.995); }
    to   { opacity: 1; transform: none; }
  }
  @keyframes incFadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes incSheetIn {
    from { opacity: 0; transform: translateY(20px) scale(0.98); }
    to   { opacity: 1; transform: none; }
  }
  @keyframes incSheetUpMobile { from { transform: translateY(100%); } to { transform: none; } }
  @keyframes incSheetDownMobile { from { transform: none; } to { transform: translateY(100%); } }
  @keyframes incZoomIn { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: none; } }
  @keyframes incRowIn { from { opacity: 0; transform: translateX(-6px); } to { opacity: 1; transform: none; } }

  .inc-card { animation: incCardIn 380ms ${EASE} both; }
  .inc-backdrop { animation: incFadeIn 180ms ease-out both; }
  .inc-backdrop-out { animation: incFadeIn 160ms ease-in reverse both; }
  .inc-sheet { animation: incSheetIn 300ms ${EASE} both; }
  .inc-sheet-out { animation: incFadeIn 180ms ease-in reverse both; }
  .inc-zoom { animation: incZoomIn 260ms ${EASE} both; }
  .inc-row { animation: incRowIn 260ms ${EASE} both; }

  @media (max-width: 639px) {
    .inc-sheet { animation: incSheetUpMobile 320ms ${EASE} both; }
    .inc-sheet-out { animation: incSheetDownMobile 220ms cubic-bezier(0.4, 0, 1, 1) both; }
  }

  .inc-collapse { transition: grid-template-rows 300ms ${EASE}, opacity 220ms ease-out; }
  .inc-press { transition: transform 120ms ${EASE}; }
  .inc-press:active { transform: scale(0.96); }
  .inc-chevron { transition: transform 280ms ${EASE}; }
  .inc-lift { transition: box-shadow 240ms ${EASE}, transform 240ms ${EASE}; }
  .inc-lift:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(91,84,232,0.10); }
  .inc-tint { transition: background 200ms ${EASE}, color 200ms ${EASE}, border-color 200ms ${EASE}; }
}
`

/* --------------------------------- Sheet ---------------------------------
   Bottom sheet on phones, centered dialog on desktop. Unmount is delayed so
   the close animation finishes instead of the panel vanishing mid-slide.
------------------------------------------------------------------------- */
function Sheet({ open, onClose, labelledBy, children }) {
  const [mounted, setMounted] = useState(open)
  const [closing, setClosing] = useState(false)
  const panelRef = useRef(null)

  useEffect(() => {
    if (open) { setMounted(true); setClosing(false); return }
    if (!mounted) return
    setClosing(true)
    const t = setTimeout(() => { setMounted(false); setClosing(false) }, 220)
    return () => clearTimeout(t)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mounted) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    // Move focus into the panel so keyboard and screen-reader users land here
    const t = setTimeout(() => panelRef.current?.focus(), 60)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      clearTimeout(t)
    }
  }, [mounted, onClose])

  if (!mounted) return null

  return (
    <div className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 ${closing ? 'inc-backdrop-out' : 'inc-backdrop'}`}
      style={{ background: 'rgba(17,17,27,0.45)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}>
      <div ref={panelRef} tabIndex={-1}
        role="dialog" aria-modal="true" aria-labelledby={labelledBy}
        onClick={e => e.stopPropagation()}
        className={`w-full sm:max-w-sm bg-white outline-none flex flex-col ${closing ? 'inc-sheet-out' : 'inc-sheet'}`}
        style={{
          borderRadius: '24px 24px 0 0',
          boxShadow: '0 -8px 48px rgba(17,17,27,0.25)',
          maxHeight: '85vh',
          // Keeps the last row clear of the iOS home indicator
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}>
        {/* Grab handle — the affordance that reads as "dismissible sheet" */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1 flex-shrink-0">
          <div className="w-9 h-1 rounded-full" style={{ background: '#e5e7eb' }} />
        </div>
        {children}
      </div>
    </div>
  )
}

/* ----------------------------- Tanod picker -----------------------------
   Replaces the native <select>. The OS picker truncated names, hid duty
   status, and gave no sense of who's already loaded up.
----------------------------------------------------------------------- */
function TanodPicker({ open, onClose, incident, tanods, activeCounts, onPick }) {
  const [query, setQuery] = useState('')
  useEffect(() => { if (open) setQuery('') }, [open])

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...tanods]
      .filter(t => !q || t.full_name?.toLowerCase().includes(q))
      .sort((a, b) =>
        (b.on_duty === true) - (a.on_duty === true) ||
        (activeCounts[a.id] || 0) - (activeCounts[b.id] || 0) ||
        (a.full_name || '').localeCompare(b.full_name || ''))
  }, [tanods, query, activeCounts])

  const onDuty = list.filter(t => t.on_duty)
  const offDuty = list.filter(t => !t.on_duty)

  const row = (t, i) => {
    const active = activeCounts[t.id] || 0
    return (
      <button key={t.id} onClick={() => { onPick(t.id); onClose() }}
        className="inc-row inc-press w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 active:bg-gray-100"
        style={{ animationDelay: `${Math.min(i, 8) * 25}ms` }}>
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden text-sm font-bold text-white"
          style={{
            background: t.on_duty
              ? 'linear-gradient(135deg, #22c55e, #16a34a)'
              : 'linear-gradient(135deg, #9ca3af, #6b7280)',
          }}>
          {t.avatar_url
            ? <img src={t.avatar_url} alt="" className="w-full h-full object-cover" />
            : (t.full_name?.[0]?.toUpperCase() || '?')}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800 truncate">{t.full_name}</p>
          <p className="text-[11px] text-gray-400 truncate">
            {active > 0 ? `${active} active assignment${active === 1 ? '' : 's'}` : 'No active assignments'}
            {t.phone ? ` · ${t.phone}` : ''}
          </p>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0"
          style={{
            background: t.on_duty ? '#f0fdf4' : '#f3f4f6',
            color: t.on_duty ? '#16a34a' : '#9ca3af',
          }}>
          {t.on_duty ? 'On duty' : 'Off duty'}
        </span>
      </button>
    )
  }

  return (
    <Sheet open={open} onClose={onClose} labelledBy="dispatch-title">
      <div className="px-4 pt-3 pb-3 flex items-start gap-3 flex-shrink-0" style={{ borderBottom: '1px solid #f0effe' }}>
        <div className="flex-1 min-w-0">
          <h3 id="dispatch-title" className="text-sm font-bold text-gray-800">Dispatch a tanod</h3>
          <p className="text-xs text-gray-400 truncate">{incident?.title}</p>
        </div>
        <button onClick={onClose} aria-label="Close"
          className="inc-press w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 flex-shrink-0">
          <X size={16} />
        </button>
      </div>

      {tanods.length > 6 && (
        <div className="px-4 py-2.5 flex-shrink-0" style={{ borderBottom: '1px solid #f7f6ff' }}>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Find a tanod…" aria-label="Find a tanod"
              className="input-field w-full rounded-xl pl-8 pr-3 py-2 text-sm text-gray-800" />
          </div>
        </div>
      )}

      <div className="overflow-y-auto inc-sheet-scroll flex-1">
        {list.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-gray-400">
            {tanods.length === 0 ? 'No tanods registered yet.' : 'No tanod matches that name.'}
          </p>
        )}
        {onDuty.length > 0 && (
          <>
            <p className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 sticky top-0 z-10"
              style={{ background: '#fafaff' }}>
              Available now ({onDuty.length})
            </p>
            {onDuty.map(row)}
          </>
        )}
        {offDuty.length > 0 && (
          <>
            <p className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 sticky top-0 z-10"
              style={{ background: '#fafaff' }}>
              Off duty ({offDuty.length}) · may not respond right away
            </p>
            {offDuty.map(row)}
          </>
        )}
      </div>
    </Sheet>
  )
}

/* -------------------------------- Lightbox ------------------------------ */
function Lightbox({ src, alt, onClose }) {
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    const close = () => { setClosing(true); setTimeout(onClose, 160) }
    const onKey = (e) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  function close() {
    setClosing(true)
    setTimeout(onClose, 160)
  }

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${closing ? 'inc-backdrop-out' : 'inc-backdrop'}`}
      style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(6px)' }}
      onClick={close} role="dialog" aria-modal="true" aria-label={alt}>
      <button onClick={close} aria-label="Close image"
        className="inc-press absolute top-4 right-4 w-10 h-10 rounded-2xl flex items-center justify-center text-white z-10"
        style={{ background: 'rgba(255,255,255,0.15)' }}>
        <X size={18} />
      </button>
      <img src={src} alt={alt} onClick={e => e.stopPropagation()}
        className={closing ? '' : 'inc-zoom'}
        style={{
          maxWidth: '100%', maxHeight: '85vh', borderRadius: 16,
          objectFit: 'contain', boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }} />
    </div>
  )
}

function Thumb({ src, label, onOpen }) {
  return (
    <button onClick={() => onOpen(src, label)}
      aria-label={`View ${label}`}
      className="inc-press relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0"
      style={{ border: '1px solid #f0effe' }}>
      <img src={src} alt="" loading="lazy" className="w-full h-full object-cover" />
    </button>
  )
}

export default function IncidentsSection({
  incidents = [],
  tanods = [],
  onDispatch,          // (incidentId, tanodId) => void
  onResolve,           // (incident) => void
  onExport,            // (format, data, meta) => void
  loading = false,
}) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [category, setCategory] = useState('all')
  const [priority, setPriority] = useState('all')
  const [sort, setSort] = useState('triage')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [expanded, setExpanded] = useState(() => new Set())
  const [lightbox, setLightbox] = useState(null)
  const [dispatchFor, setDispatchFor] = useState(null) // incident awaiting a tanod
  const searchRef = useRef(null)

  // "/" focuses search
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const counts = useMemo(() => ({
    all: incidents.length,
    pending: incidents.filter(i => i.status === 'pending').length,
    assigned: incidents.filter(i => i.status === 'assigned').length,
    resolved: incidents.filter(i => i.status === 'resolved').length,
  }), [incidents])

  // Active load per tanod, surfaced in the picker so dispatching spreads
  // across the team instead of piling onto whoever sorts first
  const activeCounts = useMemo(() => {
    const c = {}
    incidents.forEach(i => {
      if (i.status === 'assigned' && i.assigned_to) c[i.assigned_to] = (c[i.assigned_to] || 0) + 1
    })
    return c
  }, [incidents])

  const scoped = useMemo(
    () => status === 'all' ? incidents : incidents.filter(i => i.status === status),
    [incidents, status]
  )
  const categoryCounts = useMemo(() => {
    const c = {}
    scoped.forEach(i => { const k = i.category || 'Other'; c[k] = (c[k] || 0) + 1 })
    return c
  }, [scoped])
  const priorityCounts = useMemo(() => {
    const c = {}
    scoped.forEach(i => { if (i.priority) c[i.priority] = (c[i.priority] || 0) + 1 })
    return c
  }, [scoped])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = incidents.filter(inc => {
      const matchesSearch = !q ||
        inc.title?.toLowerCase().includes(q) ||
        inc.description?.toLowerCase().includes(q) ||
        inc.location?.toLowerCase().includes(q) ||
        inc.profiles?.full_name?.toLowerCase().includes(q)
      return matchesSearch &&
        (status === 'all' || inc.status === status) &&
        (category === 'all' || inc.category === category) &&
        (priority === 'all' || inc.priority === priority)
    })

    const byNewest = (a, b) => new Date(b.created_at) - new Date(a.created_at)
    if (sort === 'newest') return list.sort(byNewest)
    if (sort === 'oldest') return list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    if (sort === 'priority') return list.sort((a, b) =>
      (PRIORITY_CONFIG[b.priority]?.order || 0) - (PRIORITY_CONFIG[a.priority]?.order || 0) || byNewest(a, b))

    // triage: unresolved before resolved, critical first, longest-waiting first
    const statusOrder = { pending: 1, assigned: 2, resolved: 3 }
    return list.sort((a, b) => {
      const s = (statusOrder[a.status] || 4) - (statusOrder[b.status] || 4)
      if (s !== 0) return s
      const p = (PRIORITY_CONFIG[b.priority]?.order || 2) - (PRIORITY_CONFIG[a.priority]?.order || 2)
      if (p !== 0) return p
      return a.status === 'resolved' ? byNewest(a, b) : new Date(a.created_at) - new Date(b.created_at)
    })
  }, [incidents, search, status, category, priority, sort])

  const activeFilters = [
    search && { key: 'search', label: `"${search}"`, clear: () => setSearch('') },
    status !== 'all' && { key: 'status', label: STATUS_FILTERS.find(f => f.value === status)?.label, clear: () => setStatus('all') },
    category !== 'all' && { key: 'category', label: category, clear: () => setCategory('all') },
    priority !== 'all' && { key: 'priority', label: priority, clear: () => setPriority('all') },
  ].filter(Boolean)

  function clearAll() {
    setSearch(''); setStatus('all'); setCategory('all'); setPriority('all')
  }

  function toggleExpanded(id) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  useEffect(() => {
    if (category !== 'all' && !categoryCounts[category]) setCategory('all')
  }, [categoryCounts, category])
  useEffect(() => {
    if (priority !== 'all' && !priorityCounts[priority]) setPriority('all')
  }, [priorityCounts, priority])

  const exportMeta = { status, category, priority, count: filtered.length }
  const advancedActive = category !== 'all' || priority !== 'all'

  if (loading) {
    return (
      <div className="space-y-3">
        <style>{styles}</style>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="white-card p-5">
            <div className="flex items-center gap-3">
              <div className="skeleton-shimmer w-10 h-10 rounded-2xl flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="skeleton-shimmer h-3.5 w-3/4" />
                <div className="skeleton-shimmer h-3 w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <style>{styles}</style>

      {/* TOOLBAR */}
      {incidents.length > 0 && (
        <div className="white-card p-3 sticky top-0 z-10">
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">

            <div className="relative flex-1 sm:min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
              <input
                ref={searchRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') setSearch('') }}
                type="search"
                aria-label="Search incidents"
                placeholder="Search title, location, or reporter…"
                className="input-field w-full rounded-xl pl-9 pr-8 py-2.5 sm:py-2 text-sm text-gray-800"
              />
              {search && (
                <button onClick={() => setSearch('')} aria-label="Clear search"
                  className="inc-press absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Scrolls sideways on narrow phones instead of wrapping into a
                  second ragged row */}
              <div className="flex gap-1 p-1 rounded-xl overflow-x-auto inc-noscrollbar flex-1 sm:flex-none"
                role="group" aria-label="Filter by status"
                style={{ background: '#fafaff', border: '1px solid #f0effe' }}>
                {STATUS_FILTERS.map(f => (
                  <button key={f.value} onClick={() => setStatus(f.value)}
                    aria-pressed={status === f.value}
                    className="inc-press inc-tint px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap flex-shrink-0"
                    style={{
                      background: status === f.value ? f.color : 'transparent',
                      color: status === f.value ? 'white' : '#6b7280',
                    }}>
                    {f.label} <span style={{ opacity: 0.75 }}>{counts[f.value]}</span>
                  </button>
                ))}
              </div>

              <button onClick={() => setFiltersOpen(o => !o)}
                aria-expanded={filtersOpen} aria-controls="advanced-filters" aria-label="More filters"
                className="inc-press inc-tint flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold flex-shrink-0"
                style={{
                  background: advancedActive ? '#5B54E8' : '#fafaff',
                  color: advancedActive ? 'white' : '#6b7280',
                  border: '1px solid #f0effe',
                }}>
                <SlidersHorizontal size={12} />
                <span className="hidden sm:inline">Filters</span>
                <ChevronDown size={11} className="inc-chevron" style={{ transform: filtersOpen ? 'rotate(180deg)' : 'none' }} />
              </button>
            </div>

            <div className="flex items-center gap-2 sm:ml-auto">
              <select value={sort} onChange={e => setSort(e.target.value)}
                aria-label="Sort incidents"
                className="text-xs font-bold rounded-xl px-2.5 py-2 text-gray-600 outline-none cursor-pointer flex-1 sm:flex-none"
                style={{ background: '#fafaff', border: '1px solid #f0effe' }}>
                {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>

              <button onClick={() => onExport?.('csv', filtered, exportMeta)} disabled={filtered.length === 0}
                aria-label={`Export ${filtered.length} incidents to CSV`}
                className="inc-press flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-bold disabled:opacity-40"
                style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #dcfce7' }}>
                <FileSpreadsheet size={12} /> CSV
              </button>
              <button onClick={() => onExport?.('pdf', filtered, exportMeta)} disabled={filtered.length === 0}
                aria-label={`Export ${filtered.length} incidents to PDF`}
                className="inc-press flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
                <Download size={12} /> PDF
              </button>
            </div>
          </div>

          {/* Advanced filters — height-animated open/close, no pop */}
          <div id="advanced-filters" className={`inc-collapse ${filtersOpen ? 'inc-open' : ''}`}>
            <div className="inc-collapse-inner">
              <div className="mt-3 pt-3 space-y-3" style={{ borderTop: '1px solid #f7f6ff' }}>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Category</p>
                  <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Filter by category">
                    <button onClick={() => setCategory('all')} aria-pressed={category === 'all'}
                      className="inc-press inc-tint px-2.5 py-1.5 rounded-lg text-xs font-bold"
                      style={{
                        background: category === 'all' ? '#5B54E8' : '#fafaff',
                        color: category === 'all' ? 'white' : '#6b7280',
                        border: '1px solid #f0effe',
                      }}>
                      All
                    </button>
                    {Object.entries(CATEGORY_CONFIG).map(([cat, conf]) => {
                      const n = categoryCounts[cat] || 0
                      if (n === 0 && category !== cat) return null
                      return (
                        <button key={cat} onClick={() => setCategory(p => p === cat ? 'all' : cat)}
                          aria-pressed={category === cat}
                          className="inc-press inc-tint px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1"
                          style={{
                            background: category === cat ? conf.color : '#fafaff',
                            color: category === cat ? 'white' : conf.color,
                            border: `1px solid ${category === cat ? conf.color : conf.color + '25'}`,
                          }}>
                          <span aria-hidden="true">{conf.icon}</span> {cat} <span className="opacity-70">{n}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Priority</p>
                  <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Filter by priority">
                    <button onClick={() => setPriority('all')} aria-pressed={priority === 'all'}
                      className="inc-press inc-tint px-2.5 py-1.5 rounded-lg text-xs font-bold"
                      style={{
                        background: priority === 'all' ? '#5B54E8' : '#fafaff',
                        color: priority === 'all' ? 'white' : '#6b7280',
                        border: '1px solid #f0effe',
                      }}>
                      All
                    </button>
                    {Object.entries(PRIORITY_CONFIG).sort((a, b) => b[1].order - a[1].order).map(([p, conf]) => {
                      const n = priorityCounts[p] || 0
                      if (n === 0 && priority !== p) return null
                      return (
                        <button key={p} onClick={() => setPriority(prev => prev === p ? 'all' : p)}
                          aria-pressed={priority === p}
                          className="inc-press inc-tint px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1"
                          style={{
                            background: priority === p ? conf.color : '#fafaff',
                            color: priority === p ? 'white' : conf.color,
                            border: `1px solid ${priority === p ? conf.color : conf.color + '30'}`,
                          }}>
                          <span aria-hidden="true">{conf.icon}</span> {p} <span className="opacity-70">{n}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {activeFilters.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mt-2.5 pt-2.5" style={{ borderTop: '1px solid #f7f6ff' }}>
              <span className="text-[10px] text-gray-400 font-semibold">
                {filtered.length} of {incidents.length}
              </span>
              {activeFilters.map(f => (
                <button key={f.key} onClick={f.clear}
                  aria-label={`Remove filter ${f.label}`}
                  className="inc-press flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-colors hover:bg-purple-100"
                  style={{ background: '#f0effe', color: '#5B54E8' }}>
                  {f.label} <X size={9} />
                </button>
              ))}
              <button onClick={clearAll} className="text-[10px] font-bold ml-1" style={{ color: '#5B54E8' }}>
                Clear all
              </button>
            </div>
          )}
        </div>
      )}

      {/* EMPTY STATES */}
      {incidents.length === 0 && (
        <div className="white-card p-10 text-center inc-card">
          <div className="w-14 h-14 mx-auto mb-3 rounded-3xl flex items-center justify-center" style={{ background: '#fff7ed' }}>
            <AlertTriangle size={26} className="text-orange-400" />
          </div>
          <p className="text-sm font-semibold text-gray-700">No incidents reported yet</p>
          <p className="text-xs text-gray-400 mt-1">Reports from residents will appear here the moment they're submitted.</p>
        </div>
      )}

      {incidents.length > 0 && filtered.length === 0 && (
        <div className="white-card p-10 text-center inc-card">
          <Search size={32} className="mx-auto mb-3" style={{ color: '#5B54E8', opacity: 0.3 }} />
          <p className="text-sm font-semibold text-gray-700">Nothing matches these filters</p>
          <p className="text-xs text-gray-400 mt-1">Try a broader search or clear a filter.</p>
          <button onClick={clearAll}
            className="inc-press mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold"
            style={{ background: '#f0effe', color: '#5B54E8', border: '1px solid #e8e3ff' }}>
            <X size={12} /> Clear all filters
          </button>
        </div>
      )}

      {/* CARDS */}
      {filtered.map((inc, index) => {
        const cat = CATEGORY_CONFIG[inc.category] || CATEGORY_CONFIG.Other
        const pri = PRIORITY_CONFIG[inc.priority]
        const wait = waitState(inc)
        const assignedTanod = inc.assigned_to ? tanods.find(t => t.id === inc.assigned_to) : null
        const isResolved = inc.status === 'resolved'
        const isPending = inc.status === 'pending'
        const hasResolutionDetail = isResolved && (inc.resolution_notes || inc.rating)
        const isOpen = expanded.has(inc.id)
        const images = [
          inc.image_url && { src: inc.image_url, label: 'reported photo' },
          inc.resolution_image_url && { src: inc.resolution_image_url, label: 'resolution photo' },
        ].filter(Boolean)

        return (
          <article key={inc.id} className="white-card p-4 inc-card inc-lift"
            style={{
              animationDelay: `${Math.min(index, 10) * 30}ms`,
              ...(wait?.level === 'urgent'
                ? { borderLeft: '3px solid #dc2626' }
                : wait?.level === 'warn'
                ? { borderLeft: '3px solid #f97316' }
                : isResolved
                ? { opacity: 0.9 }
                : {}),
            }}>

            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
                style={{ background: cat.bg }} aria-hidden="true">
                {cat.icon}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-gray-800 text-sm">{inc.title}</h3>
                      {pri && (inc.priority === 'Critical' || inc.priority === 'High') && !isResolved && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold flex items-center gap-1"
                          style={{ background: pri.bg, color: pri.color }}>
                          <span aria-hidden="true">{pri.icon}</span> {inc.priority}
                        </span>
                      )}
                      {wait && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold flex items-center gap-1"
                          style={{
                            background: wait.level === 'urgent' ? '#fef2f2' : '#fff7ed',
                            color: wait.level === 'urgent' ? '#dc2626' : '#c2410c',
                          }}>
                          <Clock size={9} /> {wait.label}
                        </span>
                      )}
                    </div>

                    {inc.description && (
                      <p className="text-gray-500 text-xs mt-1"
                        style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {inc.description}
                      </p>
                    )}

                    <div className="flex items-center gap-x-2 gap-y-1 flex-wrap mt-1.5 text-[11px] text-gray-400">
                      <span className="truncate max-w-[180px]">📍 {inc.location || 'No location'}</span>
                      <span aria-hidden="true">·</span>
                      <span>{inc.profiles?.full_name || 'Unknown reporter'}</span>
                      <span aria-hidden="true">·</span>
                      <time title={fullDate(inc.created_at)} dateTime={inc.created_at}>{timeAgo(inc.created_at)}</time>
                      {inc.category && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span style={{ color: cat.color }}>{inc.category}</span>
                        </>
                      )}
                    </div>

                    {assignedTanod && !isResolved && (
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <Shield size={11} className="text-blue-500" aria-hidden="true" />
                        <span className="text-[11px] font-semibold text-blue-600">{assignedTanod.full_name}</span>
                        <span className="text-[10px] px-1.5 rounded-full font-bold"
                          style={{
                            background: assignedTanod.on_duty ? '#f0fdf4' : '#f3f4f6',
                            color: assignedTanod.on_duty ? '#16a34a' : '#9ca3af',
                          }}>
                          {assignedTanod.on_duty ? 'on duty' : 'off duty'}
                        </span>
                        {assignedTanod.phone && (
                          <a href={`tel:${assignedTanod.phone.replace(/[^0-9+]/g, '')}`}
                            aria-label={`Call ${assignedTanod.full_name}`}
                            className="inc-press w-6 h-6 rounded-md flex items-center justify-center hover:bg-blue-50 transition-colors">
                            <Phone size={11} className="text-blue-500" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  {/* DESKTOP actions — narrow column beside the content */}
                  {!isResolved && (
                    <div className="hidden sm:flex flex-col gap-1.5 flex-shrink-0 w-[150px]">
                      {isPending && (
                        <button onClick={() => setDispatchFor(inc)}
                          className="inc-press inc-tint flex items-center justify-center gap-1.5 text-[11px] font-bold px-2 py-2 rounded-lg hover:brightness-95"
                          style={{ background: '#f0effe', color: '#5B54E8', border: '1px solid #e8e3ff' }}>
                          <Send size={11} /> Dispatch tanod
                        </button>
                      )}
                      <button onClick={() => onResolve?.(inc)}
                        className="inc-press flex items-center justify-center gap-1.5 text-[11px] font-bold px-2 py-2 rounded-lg text-white transition-colors hover:bg-emerald-600"
                        style={{ background: '#22c55e' }}>
                        <Check size={11} /> Mark resolved
                      </button>
                    </div>
                  )}
                </div>

                {images.length > 0 && (
                  <div className="flex gap-2 mt-2.5">
                    {images.map(img => (
                      <Thumb key={img.src} src={img.src} label={img.label}
                        onOpen={(src, label) => setLightbox({ src, alt: label })} />
                    ))}
                  </div>
                )}

                {hasResolutionDetail && (
                  <>
                    <button onClick={() => toggleExpanded(inc.id)}
                      aria-expanded={isOpen}
                      className="inc-press flex items-center gap-2 mt-2.5 text-[11px] font-bold hover:opacity-70"
                      style={{ color: '#16a34a' }}>
                      {inc.rating && (
                        <span className="flex items-center gap-0.5" aria-label={`Rated ${inc.rating} out of 5`}>
                          {[1, 2, 3, 4, 5].map(s => (
                            <Star key={s} size={10}
                              fill={s <= inc.rating ? '#f59e0b' : 'none'}
                              color={s <= inc.rating ? '#f59e0b' : '#d1d5db'} />
                          ))}
                        </span>
                      )}
                      {isOpen ? 'Hide resolution' : 'View resolution'}
                      <ChevronDown size={11} className="inc-chevron" style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }} />
                    </button>

                    <div className={`inc-collapse ${isOpen ? 'inc-open' : ''}`}>
                      <div className="inc-collapse-inner">
                        <div className="mt-2 space-y-2">
                          {inc.resolution_notes && (
                            <div className="p-2.5 rounded-xl" style={{ background: '#f0fdf4', border: '1px solid #dcfce7' }}>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-1">Resolution notes</p>
                              <p className="text-xs text-emerald-900">{inc.resolution_notes}</p>
                            </div>
                          )}
                          {inc.rating && (
                            <div className="p-2.5 rounded-xl" style={{ background: '#fffbeb', border: '1px solid #fef3c7' }}>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1">
                                Resident feedback · {inc.rating}.0 / 5.0
                              </p>
                              {inc.rating_feedback && (
                                <p className="text-xs text-amber-900 italic">"{inc.rating_feedback}"</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* MOBILE actions — full-width row below the content, 44px tall so
                they're comfortable thumb targets instead of a 150px column
                squeezing the title into two words per line */}
            {!isResolved && (
              <div className="flex sm:hidden gap-2 mt-3 pt-3" style={{ borderTop: '1px solid #f7f6ff' }}>
                {isPending && (
                  <button onClick={() => setDispatchFor(inc)}
                    className="inc-press flex-1 h-11 flex items-center justify-center gap-1.5 text-xs font-bold rounded-xl"
                    style={{ background: '#f0effe', color: '#5B54E8', border: '1px solid #e8e3ff' }}>
                    <Send size={13} /> Dispatch
                  </button>
                )}
                <button onClick={() => onResolve?.(inc)}
                  className="inc-press flex-1 h-11 flex items-center justify-center gap-1.5 text-xs font-bold rounded-xl text-white"
                  style={{ background: '#22c55e', boxShadow: '0 4px 12px rgba(34,197,94,0.25)' }}>
                  <Check size={13} /> Mark resolved
                </button>
              </div>
            )}
          </article>
        )
      })}

      <TanodPicker
        open={!!dispatchFor}
        onClose={() => setDispatchFor(null)}
        incident={dispatchFor}
        tanods={tanods}
        activeCounts={activeCounts}
        onPick={(tanodId) => onDispatch?.(dispatchFor.id, tanodId)}
      />

      {lightbox && (
        <Lightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />
      )}
    </div>
  )
}