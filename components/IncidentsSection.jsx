'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { AlertTriangle, Search, X, Download, FileSpreadsheet, SlidersHorizontal, Star, ChevronDown, Clock, Shield, Phone, Check, Send, Scale, ShieldAlert, Pencil, ArrowUpDown } from 'lucide-react'
import { timeAgo, fullDate } from '@/lib/timeAgo'
import { LEGAL_BASIS, getPriority } from '@/lib/legalBasis'
import { computeStanding, STANDING_STYLE, responseWindowLabel } from '@/lib/triage'

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

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: '#c2410c', bg: '#fff7ed' },
  assigned: { label: 'Assigned', color: '#1d4ed8', bg: '#eff6ff' },
  resolved: { label: 'Resolved', color: '#15803d', bg: '#f0fdf4' },
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

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

/* ---------------------------------------------------------------------------
   Styles. Font sizes are pinned in px rather than rem so the layout survives
   the large system-font settings common on Android — the previous version
   blew out to unreadable proportions on a real phone.
--------------------------------------------------------------------------- */
const styles = `
.inc-collapse { display: grid; grid-template-rows: 0fr; opacity: 0; }
.inc-collapse > .inc-collapse-inner { overflow: hidden; min-height: 0; }
.inc-collapse.inc-open { grid-template-rows: 1fr; opacity: 1; }

.inc-noscrollbar::-webkit-scrollbar { display: none; }
.inc-noscrollbar { scrollbar-width: none; }
.inc-sheet-scroll { -webkit-overflow-scrolling: touch; }

/* Pinned type scale — immune to browser/OS font scaling blowing up the grid */
.inc-t10 { font-size: 10px; line-height: 1.35; }
.inc-t11 { font-size: 11px; line-height: 1.4; }
.inc-t12 { font-size: 12px; line-height: 1.45; }
.inc-t13 { font-size: 13px; line-height: 1.45; }
.inc-t14 { font-size: 14px; line-height: 1.4; }

/* Horizontal chip rail: fades at the right edge so it reads as scrollable
   instead of looking like a clipped row */
.inc-rail { position: relative; }
.inc-rail::after {
  content: ''; position: absolute; right: 0; top: 0; bottom: 0; width: 24px;
  background: linear-gradient(90deg, transparent, white);
  pointer-events: none;
}

@media (prefers-reduced-motion: no-preference) {
  @keyframes incCardIn {
    from { opacity: 0; transform: translateY(8px); }
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

  .inc-card { animation: incCardIn 320ms ${EASE} both; }
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
  @media (hover: hover) {
    .inc-lift:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(91,84,232,0.10); }
  }
  .inc-tint { transition: background 200ms ${EASE}, color 200ms ${EASE}, border-color 200ms ${EASE}; }
}
`

/* --------------------------------- Sheet -------------------------------- */
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
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}>
        <div className="sm:hidden flex justify-center pt-2.5 pb-1 flex-shrink-0">
          <div className="w-9 h-1 rounded-full" style={{ background: '#e5e7eb' }} />
        </div>
        {children}
      </div>
    </div>
  )
}

/* ----------------------------- Tanod picker ----------------------------- */
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
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden inc-t13 font-bold text-white"
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
          <p className="inc-t13 font-bold text-gray-800 truncate">{t.full_name}</p>
          <p className="inc-t11 text-gray-400 truncate">
            {active > 0 ? `${active} active` : 'No active assignments'}
            {t.phone ? ` · ${t.phone}` : ''}
          </p>
        </div>
        <span className="inc-t10 px-2 py-0.5 rounded-full font-bold flex-shrink-0"
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
          <h3 id="dispatch-title" className="inc-t13 font-bold text-gray-800">Dispatch a tanod</h3>
          <p className="inc-t11 text-gray-400 truncate">{incident?.title}</p>
        </div>
        <button onClick={onClose} aria-label="Close"
          className="inc-press w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 flex-shrink-0">
          <X size={16} />
        </button>
      </div>

      {incident && LEGAL_BASIS[incident.category]?.responseMode === 'refer_to_agency' && (
        <div className="mx-4 mt-3 px-3 py-2.5 rounded-xl flex items-start gap-2 flex-shrink-0"
          style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
          <ShieldAlert size={13} className="flex-shrink-0 mt-0.5 text-orange-600" aria-hidden="true" />
          <p className="inc-t11 text-orange-800">
            <strong>{LEGAL_BASIS[incident.category].agency}</strong> has authority here.
            Dispatch to document and assist only — not to intervene.
          </p>
        </div>
      )}

      {tanods.length > 6 && (
        <div className="px-4 py-2.5 flex-shrink-0" style={{ borderBottom: '1px solid #f7f6ff' }}>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Find a tanod…" aria-label="Find a tanod"
              className="input-field w-full rounded-xl pl-8 pr-3 py-2 inc-t13 text-gray-800" />
          </div>
        </div>
      )}

      <div className="overflow-y-auto inc-sheet-scroll flex-1">
        {list.length === 0 && (
          <p className="px-4 py-8 text-center inc-t13 text-gray-400">
            {tanods.length === 0 ? 'No tanods registered yet.' : 'No tanod matches that name.'}
          </p>
        )}
        {onDuty.length > 0 && (
          <>
            <p className="px-4 py-1.5 inc-t10 font-bold uppercase tracking-wider text-gray-400 sticky top-0 z-10"
              style={{ background: '#fafaff' }}>
              Available now ({onDuty.length})
            </p>
            {onDuty.map(row)}
          </>
        )}
        {offDuty.length > 0 && (
          <>
            <p className="px-4 py-1.5 inc-t10 font-bold uppercase tracking-wider text-gray-400 sticky top-0 z-10"
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

/* --------------------------- Priority override --------------------------- */
function PriorityOverride({ open, onClose, incident, onSubmit }) {
  const [picked, setPicked] = useState(null)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && incident) { setPicked(incident.priority); setReason('') }
  }, [open, incident])

  if (!incident) return null

  const lawAssigned = incident.original_priority || getPriority(incident.category)
  const basis = LEGAL_BASIS[incident.category]
  const changed = picked !== incident.priority
  const canSave = changed && reason.trim().length >= 10 && !saving

  async function save() {
    setSaving(true)
    try {
      await onSubmit?.(incident, picked, reason.trim())
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} labelledBy="override-title">
      <div className="px-4 pt-3 pb-3 flex items-start gap-3 flex-shrink-0" style={{ borderBottom: '1px solid #f0effe' }}>
        <div className="flex-1 min-w-0">
          <h3 id="override-title" className="inc-t13 font-bold text-gray-800">Adjust priority</h3>
          <p className="inc-t11 text-gray-400 truncate">{incident.title}</p>
        </div>
        <button onClick={onClose} aria-label="Close"
          className="inc-press w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 flex-shrink-0">
          <X size={16} />
        </button>
      </div>

      <div className="overflow-y-auto inc-sheet-scroll flex-1 px-4 py-3 space-y-3">
        {basis?.law && (
          <div className="p-2.5 rounded-xl flex items-start gap-2" style={{ background: '#f0effe', border: '1px solid #e8e3ff' }}>
            <Scale size={12} className="flex-shrink-0 mt-0.5" style={{ color: '#5B54E8' }} aria-hidden="true" />
            <p className="inc-t11" style={{ color: '#5B54E8' }}>
              System assigned <strong>{lawAssigned}</strong> under <strong>{basis.law}</strong>.
              Overriding records your name and reason.
            </p>
          </div>
        )}

        {incident.priority_override_reason && (
          <div className="p-2.5 rounded-xl" style={{ background: '#fffbeb', border: '1px solid #fef3c7' }}>
            <p className="inc-t10 font-bold uppercase tracking-wider text-amber-700 mb-1">Previously adjusted</p>
            <p className="inc-t11 text-amber-900 italic">"{incident.priority_override_reason}"</p>
          </div>
        )}

        <div>
          <p className="inc-t10 font-bold text-gray-400 uppercase tracking-wider mb-1.5">New priority</p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(PRIORITY_CONFIG).sort((a, b) => b[1].order - a[1].order).map(([p, conf]) => (
              <button key={p} onClick={() => setPicked(p)}
                aria-pressed={picked === p}
                className="inc-press inc-tint p-2.5 rounded-xl inc-t12 font-bold flex items-center gap-2"
                style={{
                  background: picked === p ? conf.bg : '#fafaff',
                  color: picked === p ? conf.color : '#6b7280',
                  border: `2px solid ${picked === p ? conf.color : '#f0effe'}`,
                }}>
                <span aria-hidden="true">{conf.icon}</span> {p}
                {p === lawAssigned && <span className="ml-auto inc-t10 opacity-60">auto</span>}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="override-reason" className="inc-t10 font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
            Reason for change {changed && <span className="text-red-500">*</span>}
          </label>
          <textarea id="override-reason" value={reason} onChange={e => setReason(e.target.value)}
            rows={3} maxLength={300} disabled={!changed}
            placeholder="e.g. Floodwater above waist level, families evacuating"
            className="input-field w-full rounded-xl px-3 py-2.5 inc-t13 text-gray-800 resize-none disabled:opacity-50" />
          <p className="inc-t10 text-gray-400 text-right mt-1">
            {changed && reason.trim().length < 10
              ? `${10 - reason.trim().length} more characters needed`
              : `${reason.length}/300`}
          </p>
        </div>
      </div>

      <div className="px-4 py-3 flex gap-2 flex-shrink-0" style={{ borderTop: '1px solid #f0effe' }}>
        <button onClick={onClose}
          className="inc-press flex-1 h-11 rounded-xl inc-t12 font-bold"
          style={{ background: '#fafaff', color: '#6b7280', border: '1px solid #f0effe' }}>
          Cancel
        </button>
        <button onClick={save} disabled={!canSave}
          className="inc-press flex-1 h-11 rounded-xl inc-t12 font-bold text-white disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)' }}>
          {saving ? 'Saving…' : 'Save change'}
        </button>
      </div>
    </Sheet>
  )
}

/* -------------------------------- Lightbox ------------------------------ */
function Lightbox({ src, alt, onClose }) {
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { setClosing(true); setTimeout(onClose, 160) } }
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
      className="inc-press relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0"
      style={{ border: '1px solid #f0effe' }}>
      <img src={src} alt="" loading="lazy" className="w-full h-full object-cover" />
    </button>
  )
}

export default function IncidentsSection({
  incidents = [],
  tanods = [],
  onDispatch,
  onResolve,
  onExport,
  onPriorityChange,
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
  const [dispatchFor, setDispatchFor] = useState(null)
  const [overrideFor, setOverrideFor] = useState(null)
  const searchRef = useRef(null)

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

    const statusOrder = { pending: 1, assigned: 2, resolved: 3 }
    const now = Date.now()
    return list.sort((a, b) => {
      const s = (statusOrder[a.status] || 4) - (statusOrder[b.status] || 4)
      if (s !== 0) return s
      const standing = computeStanding(b, now).score - computeStanding(a, now).score
      if (standing !== 0) return standing
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
          <div key={i} className="white-card p-4">
            <div className="flex items-center gap-3">
              <div className="skeleton-shimmer w-9 h-9 rounded-xl flex-shrink-0" />
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

      {/* ================= TOOLBAR =================
          Rebuilt mobile-first. Previously the export buttons and the status
          rail competed for one row and the PDF button fell off the right
          edge of the screen. Now: search on its own row, a scrollable status
          rail with a fade affordance, and a compact control row where
          exports collapse to icons under 640px. */}
      {incidents.length > 0 && (
        <div className="white-card p-3 space-y-2.5">

          {/* Search */}
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') setSearch('') }}
              type="search"
              aria-label="Search incidents"
              placeholder="Search incidents…"
              className="input-field w-full rounded-xl pl-9 pr-9 py-2.5 inc-t13 text-gray-800"
            />
            {search && (
              <button onClick={() => setSearch('')} aria-label="Clear search"
                className="inc-press absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Status rail — scrolls horizontally, fades at the edge */}
          <div className="inc-rail">
            <div className="flex gap-1.5 overflow-x-auto inc-noscrollbar pr-6"
              role="group" aria-label="Filter by status">
              {STATUS_FILTERS.map(f => {
                const on = status === f.value
                return (
                  <button key={f.value} onClick={() => setStatus(f.value)}
                    aria-pressed={on}
                    className="inc-press inc-tint px-3 h-9 rounded-xl inc-t12 font-bold whitespace-nowrap flex-shrink-0 flex items-center gap-1.5"
                    style={{
                      background: on ? f.color : '#fafaff',
                      color: on ? 'white' : '#6b7280',
                      border: `1px solid ${on ? f.color : '#f0effe'}`,
                    }}>
                    {f.label}
                    <span className="inc-t10 px-1.5 rounded-md font-black"
                      style={{
                        background: on ? 'rgba(255,255,255,0.25)' : '#f0effe',
                        color: on ? 'white' : '#5B54E8',
                      }}>
                      {counts[f.value]}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Controls: sort · filters · exports.
              Exports become icon-only below 640px so nothing overflows. */}
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1 min-w-0">
              <ArrowUpDown size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden="true" />
              <select value={sort} onChange={e => setSort(e.target.value)}
                aria-label="Sort incidents"
                className="w-full appearance-none inc-t12 font-bold rounded-xl pl-7 pr-6 h-9 text-gray-600 outline-none cursor-pointer truncate"
                style={{ background: '#fafaff', border: '1px solid #f0effe' }}>
                {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden="true" />
            </div>

            <button onClick={() => setFiltersOpen(o => !o)}
              aria-expanded={filtersOpen} aria-controls="advanced-filters"
              aria-label="More filters"
              className="inc-press inc-tint flex items-center gap-1 px-2.5 h-9 rounded-xl inc-t12 font-bold flex-shrink-0"
              style={{
                background: advancedActive ? '#5B54E8' : '#fafaff',
                color: advancedActive ? 'white' : '#6b7280',
                border: `1px solid ${advancedActive ? '#5B54E8' : '#f0effe'}`,
              }}>
              <SlidersHorizontal size={13} />
              {advancedActive && <span className="inc-t10">on</span>}
            </button>

            <button onClick={() => onExport?.('csv', filtered, exportMeta)} disabled={filtered.length === 0}
              aria-label={`Export ${filtered.length} incidents to CSV`}
              className="inc-press flex items-center gap-1 px-2.5 h-9 rounded-xl inc-t12 font-bold disabled:opacity-40 flex-shrink-0"
              style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #dcfce7' }}>
              <FileSpreadsheet size={13} /> <span className="hidden sm:inline">CSV</span>
            </button>
            <button onClick={() => onExport?.('pdf', filtered, exportMeta)} disabled={filtered.length === 0}
              aria-label={`Export ${filtered.length} incidents to PDF`}
              className="inc-press flex items-center gap-1 px-2.5 h-9 rounded-xl inc-t12 font-bold text-white disabled:opacity-40 flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
              <Download size={13} /> <span className="hidden sm:inline">PDF</span>
            </button>
          </div>

          {/* Advanced filters */}
          <div id="advanced-filters" className={`inc-collapse ${filtersOpen ? 'inc-open' : ''}`}>
            <div className="inc-collapse-inner">
              <div className="pt-2.5 space-y-3" style={{ borderTop: '1px solid #f7f6ff' }}>
                <div>
                  <p className="inc-t10 font-bold text-gray-400 uppercase tracking-wider mb-1.5">Category</p>
                  <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Filter by category">
                    <button onClick={() => setCategory('all')} aria-pressed={category === 'all'}
                      className="inc-press inc-tint px-2.5 py-1.5 rounded-lg inc-t12 font-bold"
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
                          className="inc-press inc-tint px-2.5 py-1.5 rounded-lg inc-t12 font-bold flex items-center gap-1"
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
                  <p className="inc-t10 font-bold text-gray-400 uppercase tracking-wider mb-1.5">Priority</p>
                  <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Filter by priority">
                    <button onClick={() => setPriority('all')} aria-pressed={priority === 'all'}
                      className="inc-press inc-tint px-2.5 py-1.5 rounded-lg inc-t12 font-bold"
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
                          className="inc-press inc-tint px-2.5 py-1.5 rounded-lg inc-t12 font-bold flex items-center gap-1"
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
            <div className="flex items-center gap-1.5 flex-wrap pt-2.5" style={{ borderTop: '1px solid #f7f6ff' }}>
              <span className="inc-t10 text-gray-400 font-semibold">
                {filtered.length} of {incidents.length}
              </span>
              {activeFilters.map(f => (
                <button key={f.key} onClick={f.clear}
                  aria-label={`Remove filter ${f.label}`}
                  className="inc-press flex items-center gap-1 px-2 py-1 rounded-lg inc-t10 font-bold"
                  style={{ background: '#f0effe', color: '#5B54E8' }}>
                  {f.label} <X size={9} />
                </button>
              ))}
              <button onClick={clearAll} className="inc-t10 font-bold ml-1" style={{ color: '#5B54E8' }}>
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
          <p className="inc-t13 font-semibold text-gray-700">No incidents reported yet</p>
          <p className="inc-t12 text-gray-400 mt-1">Reports from residents appear here the moment they're submitted.</p>
        </div>
      )}

      {incidents.length > 0 && filtered.length === 0 && (
        <div className="white-card p-10 text-center inc-card">
          <Search size={30} className="mx-auto mb-3" style={{ color: '#5B54E8', opacity: 0.3 }} />
          <p className="inc-t13 font-semibold text-gray-700">Nothing matches these filters</p>
          <p className="inc-t12 text-gray-400 mt-1">Try a broader search or clear a filter.</p>
          <button onClick={clearAll}
            className="inc-press mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl inc-t12 font-bold"
            style={{ background: '#f0effe', color: '#5B54E8', border: '1px solid #e8e3ff' }}>
            <X size={12} /> Clear all filters
          </button>
        </div>
      )}

      {/* ================= CARDS ================= */}
      {filtered.map((inc, index) => {
        const cat = CATEGORY_CONFIG[inc.category] || CATEGORY_CONFIG.Other
        const pri = PRIORITY_CONFIG[inc.priority] || PRIORITY_CONFIG.Medium
        const st = STATUS_CONFIG[inc.status] || STATUS_CONFIG.pending
        const assignedTanod = inc.assigned_to ? tanods.find(t => t.id === inc.assigned_to) : null
        const isResolved = inc.status === 'resolved'
        const isPending = inc.status === 'pending'
        const hasResolutionDetail = isResolved && (inc.resolution_notes || inc.rating)
        const isOpen = expanded.has(inc.id)
        const basis = LEGAL_BASIS[inc.category]
        const wasOverridden = Boolean(inc.priority_overridden_by)
        const standing = computeStanding(inc)
        const mustRefer = basis?.responseMode === 'refer_to_agency'
        const images = [
          inc.image_url && { src: inc.image_url, label: 'reported photo' },
          inc.resolution_image_url && { src: inc.resolution_image_url, label: 'resolution photo' },
        ].filter(Boolean)

        // The left rail always encodes priority — previously a resolved fire
        // looked identical to a resolved noise complaint. Overdue items get
        // the amber/red aging colour instead, since that's the more urgent
        // signal while it applies.
        const railColor = standing.level >= 2 ? STANDING_STYLE[standing.level].color
          : standing.level === 1 ? '#f97316'
          : pri.color

        return (
          <article key={inc.id} className="white-card inc-card inc-lift overflow-hidden"
            style={{
              animationDelay: `${Math.min(index, 8) * 25}ms`,
              borderLeft: `4px solid ${railColor}`,
              opacity: isResolved ? 0.82 : 1,
            }}>
            <div className="p-3.5">

              {/* Row 1: icon · title · badges */}
              <div className="flex items-start gap-2.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: cat.bg, fontSize: 17 }} aria-hidden="true">
                  {cat.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="inc-t14 font-bold text-gray-800 break-words">{inc.title}</h3>

                  {/* Badge row — priority and status ALWAYS shown, including
                      on resolved incidents, so the list stays readable at a
                      glance instead of going blank once handled */}
                  <div className="flex items-center gap-1 flex-wrap mt-1">
                    <span className="inc-t10 px-1.5 py-0.5 rounded-md font-bold flex items-center gap-1"
                      style={{ background: pri.bg, color: pri.color }}>
                      <span aria-hidden="true">{pri.icon}</span> {inc.priority}
                    </span>
                    <span className="inc-t10 px-1.5 py-0.5 rounded-md font-bold"
                      style={{ background: st.bg, color: st.color }}>
                      {st.label}
                    </span>
                    {standing.aged && !isResolved && (
                      <span className="inc-t10 px-1.5 py-0.5 rounded-md font-bold flex items-center gap-1"
                        style={{
                          background: STANDING_STYLE[standing.level].bg,
                          color: STANDING_STYLE[standing.level].color,
                        }}
                        title={`Response target for ${inc.priority}: ${responseWindowLabel(inc.priority)}. Still classified ${inc.priority} — only its queue position rose.`}>
                        <Clock size={9} /> {standing.label}
                      </span>
                    )}
                    {basis?.law && (
                      <span className="inc-t10 px-1.5 py-0.5 rounded-md font-bold flex items-center gap-1"
                        style={{ background: '#f0effe', color: '#5B54E8' }}
                        title={basis.reason}>
                        <Scale size={9} /> {basis.law}
                      </span>
                    )}
                    {wasOverridden && (
                      <span className="inc-t10 px-1.5 py-0.5 rounded-md font-bold"
                        style={{ background: '#fef3c7', color: '#92400e' }}
                        title={`Changed from ${inc.original_priority}: ${inc.priority_override_reason}`}>
                        adjusted
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Description */}
              {inc.description && (
                <p className="inc-t12 text-gray-500 mt-2"
                  style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {inc.description}
                </p>
              )}

              {/* Metadata — location on its own line so it never fights the
                  reporter name for space on a narrow screen */}
              <div className="mt-2 space-y-0.5">
                <p className="inc-t11 text-gray-400 flex items-center gap-1">
                  <span aria-hidden="true">📍</span>
                  <span className="truncate">{inc.location || 'No location given'}</span>
                </p>
                <p className="inc-t11 text-gray-400 truncate">
                  {inc.profiles?.full_name || 'Unknown reporter'}
                  {' · '}
                  <time title={fullDate(inc.created_at)} dateTime={inc.created_at}>{timeAgo(inc.created_at)}</time>
                  {inc.category && <span style={{ color: cat.color }}>{' · '}{inc.category}</span>}
                </p>
              </div>

              {/* Referral guidance */}
              {mustRefer && !isResolved && basis?.agency && (
                <div className="mt-2.5 px-2.5 py-2 rounded-xl flex items-start gap-2"
                  style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
                  <ShieldAlert size={12} className="flex-shrink-0 mt-0.5 text-orange-600" aria-hidden="true" />
                  <p className="inc-t11 text-orange-800">
                    <strong>Refer to {basis.agency}.</strong> Document and assist only — the
                    barangay has no enforcement authority here.
                  </p>
                </div>
              )}

              {/* Off-duty fallback warning */}
              {inc.assignment_method === 'auto_offduty' && !isResolved && (
                <div className="mt-2 px-2.5 py-2 rounded-xl flex items-start gap-2"
                  style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
                  <ShieldAlert size={12} className="flex-shrink-0 mt-0.5 text-red-600" aria-hidden="true" />
                  <p className="inc-t11 text-red-800">
                    <strong>No tanod was on duty.</strong> Assigned to the most recently active
                    tanod — call them directly to confirm.
                  </p>
                </div>
              )}

              {/* Assigned tanod */}
              {assignedTanod && !isResolved && (
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <Shield size={11} className="text-blue-500 flex-shrink-0" aria-hidden="true" />
                  <span className="inc-t11 font-semibold text-blue-600 truncate">{assignedTanod.full_name}</span>
                  <span className="inc-t10 px-1.5 rounded-full font-bold flex-shrink-0"
                    style={{
                      background: assignedTanod.on_duty ? '#f0fdf4' : '#f3f4f6',
                      color: assignedTanod.on_duty ? '#16a34a' : '#9ca3af',
                    }}>
                    {assignedTanod.on_duty ? 'on duty' : 'off duty'}
                  </span>
                  {assignedTanod.phone && (
                    <a href={`tel:${assignedTanod.phone.replace(/[^0-9+]/g, '')}`}
                      aria-label={`Call ${assignedTanod.full_name}`}
                      className="inc-press w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: '#eff6ff' }}>
                      <Phone size={12} className="text-blue-500" />
                    </a>
                  )}
                </div>
              )}

              {/* Photos */}
              {images.length > 0 && (
                <div className="flex gap-2 mt-2.5">
                  {images.map(img => (
                    <Thumb key={img.src} src={img.src} label={img.label}
                      onOpen={(src, label) => setLightbox({ src, alt: label })} />
                  ))}
                </div>
              )}

              {/* Resolution detail */}
              {hasResolutionDetail && (
                <>
                  <button onClick={() => toggleExpanded(inc.id)}
                    aria-expanded={isOpen}
                    className="inc-press flex items-center gap-2 mt-2.5 inc-t11 font-bold"
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
                            <p className="inc-t10 font-bold uppercase tracking-wider text-emerald-700 mb-1">Resolution notes</p>
                            <p className="inc-t12 text-emerald-900">{inc.resolution_notes}</p>
                          </div>
                        )}
                        {inc.rating && (
                          <div className="p-2.5 rounded-xl" style={{ background: '#fffbeb', border: '1px solid #fef3c7' }}>
                            <p className="inc-t10 font-bold uppercase tracking-wider text-amber-700 mb-1">
                              Resident feedback · {inc.rating}.0 / 5.0
                            </p>
                            {inc.rating_feedback && (
                              <p className="inc-t12 text-amber-900 italic">"{inc.rating_feedback}"</p>
                            )}
                          </div>
                        )}
                        {wasOverridden && (
                          <div className="p-2.5 rounded-xl" style={{ background: '#f0effe', border: '1px solid #e8e3ff' }}>
                            <p className="inc-t10 font-bold uppercase tracking-wider mb-1" style={{ color: '#5B54E8' }}>
                              Priority adjusted · {inc.original_priority} → {inc.priority}
                            </p>
                            <p className="inc-t12 italic" style={{ color: '#4c46c4' }}>"{inc.priority_override_reason}"</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Actions — one full-width row on every screen size. The old
                150px desktop side-column squeezed titles into two words per
                line on tablets; a footer row is predictable everywhere. */}
            {!isResolved && (
              <div className="flex gap-2 px-3.5 py-2.5" style={{ borderTop: '1px solid #f7f6ff', background: '#fcfcff' }}>
                {isPending && (
                  <button onClick={() => setDispatchFor(inc)}
                    className="inc-press flex-1 h-10 flex items-center justify-center gap-1.5 inc-t12 font-bold rounded-xl"
                    style={{ background: '#f0effe', color: '#5B54E8', border: '1px solid #e8e3ff' }}>
                    <Send size={13} /> Dispatch
                  </button>
                )}
                <button onClick={() => onResolve?.(inc)}
                  className="inc-press flex-1 h-10 flex items-center justify-center gap-1.5 inc-t12 font-bold rounded-xl text-white"
                  style={{ background: '#22c55e' }}>
                  <Check size={13} /> Resolve
                </button>
                {onPriorityChange && (
                  <button onClick={() => setOverrideFor(inc)}
                    aria-label="Adjust priority"
                    className="inc-press w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0"
                    style={{ background: '#fafaff', color: '#6b7280', border: '1px solid #f0effe' }}>
                    <Pencil size={13} />
                  </button>
                )}
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

      <PriorityOverride
        open={!!overrideFor}
        onClose={() => setOverrideFor(null)}
        incident={overrideFor}
        onSubmit={onPriorityChange}
      />

      {lightbox && (
        <Lightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />
      )}
    </div>
  )
}