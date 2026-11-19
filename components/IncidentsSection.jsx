'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation' 
import { isSettled } from '@/lib/recordState'
import { X, Check, Pencil, ExternalLink } from 'lucide-react'
import { timeAgo, fullDate } from '@/lib/timeAgo'
import { LEGAL_BASIS, CATEGORY_CONFIG, getPriority } from '@/lib/legalBasis'
import { computeStanding } from '@/lib/triage'
import { useNow } from '@/lib/useNow'
import { CategoryIcon, categoryColor } from '@/lib/categoryIcons'
import { Card } from '@/components/ui/card'
import { Rows, Row } from '@/components/ui/table'
import { Tag, Status, TONE_FG } from '@/components/ui/tag'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { Avatar } from '@/components/ui/avatar'
import { Notice } from '@/components/ui/notice'
import { Muted } from '@/components/ui/text'
import { Textarea } from '@/components/ui/textarea'
import { SearchBox, FilterSelect, ExportMenu, RowMenu } from '@/components/official/Toolbar'


const PRIORITY_CONFIG = {
  Low: { color: '#22c55e', bg: '#f0fdf4', icon: '🟢', order: 1 },
  Medium: { color: '#3b82f6', bg: '#eff6ff', icon: '🔵', order: 2 },
  High: { color: '#f97316', bg: '#fff7ed', icon: '🟠', order: 3 },
  Critical: { color: '#dc2626', bg: '#fef2f2', icon: '🔴', order: 4 },
}

// Priority as a tag (DESIGN.md §5): red only for Critical.
const PRIORITY_TONE = { Critical: 'danger', High: 'warn', Medium: 'quiet', Low: 'quiet' }

// The switch above the table (O02). Active is what still needs the
// barangay: unassigned plus dispatched.
const STATUS_FILTERS = [
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Unassigned' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'all', label: 'All' },
]
const inStatus = (inc, status) =>
  status === 'all' || (status === 'active' ? !isSettled(inc.status) : inc.status === status)

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
@media (prefers-reduced-motion: no-preference) {
  @keyframes incFadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes incSheetIn {
    from { opacity: 0; transform: translateY(20px) scale(0.98); }
    to   { opacity: 1; transform: none; }
  }
  @keyframes incSheetUpMobile { from { transform: translateY(100%); } to { transform: none; } }
  @keyframes incSheetDownMobile { from { transform: none; } to { transform: translateY(100%); } }
  .inc-backdrop { animation: incFadeIn 180ms ease-out both; }
  .inc-backdrop-out { animation: incFadeIn 160ms ease-in reverse both; }
  .inc-sheet { animation: incSheetIn 300ms ${EASE} both; }
  .inc-sheet-out { animation: incFadeIn 180ms ease-in reverse both; }
  @media (max-width: 639px) {
    .inc-sheet { animation: incSheetUpMobile 320ms ${EASE} both; }
    .inc-sheet-out { animation: incSheetDownMobile 220ms cubic-bezier(0.4, 0, 1, 1) both; }
  }
}
`

/* --------------------------------- Sheet -------------------------------- */
function Sheet({ open, onClose, labelledBy, children }) {
  const [mounted, setMounted] = useState(open)
  const [closing, setClosing] = useState(false)
  const [wasOpen, setWasOpen] = useState(open)
  const panelRef = useRef(null)

  // React to `open` flipping while rendering (React's "adjust state when a
  // prop changes" pattern): opening shows the sheet at once, closing starts
  // the exit animation. Reopening mid-exit cancels it.
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) { setMounted(true); setClosing(false) }
    else if (mounted) setClosing(true)
  }

  // The exit animation runs 220 ms, then the sheet unmounts.
  useEffect(() => {
    if (!closing) return
    const t = setTimeout(() => { setMounted(false); setClosing(false) }, 220)
    return () => clearTimeout(t)
  }, [closing])

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
    <div className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-[var(--scrim)] ${closing ? 'inc-backdrop-out' : 'inc-backdrop'}`}
      onClick={onClose}>
      <div ref={panelRef} tabIndex={-1}
        role="dialog" aria-modal="true" aria-labelledby={labelledBy}
        onClick={e => e.stopPropagation()}
        className={`flex max-h-[85dvh] w-full flex-col rounded-t-[20px] bg-surface pb-[env(safe-area-inset-bottom,0px)] shadow-[var(--shadow-float)] outline-none sm:max-w-md sm:rounded-[16px] sm:border sm:border-line ${closing ? 'inc-sheet-out' : 'inc-sheet'}`}>
        <span aria-hidden="true" className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-line sm:hidden" />
        {children}
      </div>
    </div>
  )
}

function SheetHead({ id, title, sub, onClose }) {
  return (
    <div className="flex shrink-0 items-start gap-3 border-b border-line px-[18px] pt-3.5 pb-3 sm:pt-[18px]">
      <div className="min-w-0 flex-1">
        <h3 id={id} className="text-[17px] font-extrabold text-ink">{title}</h3>
        {sub && <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{sub}</p>}
      </div>
      <button type="button" onClick={onClose} aria-label="Close"
        className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-line bg-surface text-ink outline-none hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong">
        <X size={18} strokeWidth={1.9} />
      </button>
    </div>
  )
}

/* ----------------------------- Tanod picker ----------------------------- */
function TanodPicker({ open, onClose, incident, tanods, activeCounts, onPick }) {
  const [query, setQuery] = useState('')
  // Each time the picker opens, it starts with an empty search.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setQuery('')
  }

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

  const row = t => {
    const active = activeCounts[t.id] || 0
    return (
      <Row key={t.id} as="button" type="button" interactive onClick={() => { onPick(t.id); onClose() }} className="flex items-center gap-3">
        <Avatar name={t.full_name} src={t.avatar_url} size="sm" tone={t.on_duty ? 'ok' : 'brand'} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-ink">{t.full_name}</span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {active > 0 ? `${active} active` : 'No active assignments'}
            {t.phone ? ` · ${t.phone}` : ''}
          </span>
        </span>
        <Status tone={t.on_duty ? 'ok' : 'quiet'} className="shrink-0">{t.on_duty ? 'On duty' : 'Off duty'}</Status>
      </Row>
    )
  }
  const group = label => (
    <p className="sticky top-0 z-10 border-b border-line bg-surface-sunk px-[18px] py-2 text-xs font-bold text-muted-foreground">{label}</p>
  )

  return (
    <Sheet open={open} onClose={onClose} labelledBy="dispatch-title">
      <SheetHead id="dispatch-title" title="Dispatch a tanod" sub={incident?.title} onClose={onClose} />

      {incident && LEGAL_BASIS[incident.category]?.responseMode === 'refer_to_agency' && (
        <Notice tone="warn" className="mx-[18px] mt-3 shrink-0">
          <strong>{LEGAL_BASIS[incident.category].agency}</strong> has authority here.
          Dispatch to document and assist only, not to intervene.
        </Notice>
      )}

      {tanods.length > 6 && (
        <div className="shrink-0 border-b border-line px-[18px] py-2.5">
          <SearchBox value={query} onChange={setQuery} label="Find a tanod" placeholder="Find a tanod" />
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {list.length === 0 && (
          <Muted className="px-[18px] py-6">
            {tanods.length === 0 ? 'No tanods yet. Tanods join with an invite code from Users.' : 'No tanod matches that name.'}
          </Muted>
        )}
        {onDuty.length > 0 && (
          <>
            {group(`Available now · ${onDuty.length}`)}
            <Rows>{onDuty.map(row)}</Rows>
          </>
        )}
        {offDuty.length > 0 && (
          <>
            {group(`Off duty · ${offDuty.length} · may not respond right away`)}
            <Rows>{offDuty.map(row)}</Rows>
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

  // Start fresh each time the dialog opens for an incident. Keyed on the
  // incident's id, not the object: a live update to the same incident while
  // the official is choosing must not wipe their choice.
  const session = open && incident ? incident.id : null
  const [lastSession, setLastSession] = useState(null)
  if (session !== lastSession) {
    setLastSession(session)
    if (session != null) { setPicked(incident.priority); setReason('') }
  }

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
      <SheetHead id="override-title" title="Adjust priority" sub={incident.title} onClose={onClose} />

      <div className="flex-1 space-y-4 overflow-y-auto px-[18px] py-4">
        {basis?.law && (
          <Notice tone="info">
            The system set <strong>{lawAssigned}</strong> under <strong>{basis.law}</strong>.
            A change records your name and reason.
          </Notice>
        )}

        {incident.priority_override_reason && (
          <Notice tone="warn" title="Changed before">&ldquo;{incident.priority_override_reason}&rdquo;</Notice>
        )}

        <div>
          <p className="mb-2 text-[13px] font-bold text-ink">New priority</p>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="New priority">
            {Object.entries(PRIORITY_CONFIG).sort((a, b) => b[1].order - a[1].order).map(([p]) => {
              const on = picked === p
              return (
                <button key={p} type="button" onClick={() => setPicked(p)} aria-pressed={on}
                  className={`flex h-11 items-center gap-2 rounded-[10px] border px-3 text-sm font-bold outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong ${on ? 'border-brand-strong bg-brand-soft text-brand-strong' : 'border-line bg-surface text-ink hover:border-line-strong'}`}>
                  <span className="size-[7px] rounded-full" style={{ background: TONE_FG[PRIORITY_TONE[p]] }} aria-hidden="true" />
                  {p}
                  {p === lawAssigned && <span className="ml-auto text-xs font-bold text-muted-foreground">by law</span>}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label htmlFor="override-reason" className="mb-2 block text-[13px] font-bold text-ink">
            Reason for the change
          </label>
          <Textarea id="override-reason" value={reason} onChange={e => setReason(e.target.value)}
            rows={3} maxLength={300} disabled={!changed}
            placeholder="For example: water above waist level, families evacuating" />
          <p className="mt-1.5 text-xs text-muted-foreground">
            {!changed ? 'Pick a different priority first.'
              : reason.trim().length < 10 ? `${10 - reason.trim().length} more characters needed`
                : `${reason.length} of 300`}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 gap-2.5 border-t border-line px-[18px] py-3">
        <Button variant="secondary" size="lg" onClick={onClose}>Cancel</Button>
        <Button size="lg" className="flex-1" onClick={save} disabled={!canSave} aria-busy={saving || undefined}>
          {saving ? 'Saving…' : 'Save change'}
        </Button>
      </div>
    </Sheet>
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
  // Paging. `incidents` holds only what has been fetched so far, so the
  // filter counts and the CSV/PDF export cover the loaded window — the
  // footer below says so rather than letting the numbers imply totals.
  hasMore = false,
  loadingMore = false,
  onLoadMore,
}) {
  const now = useNow()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('active')
  // What the user picked. The filter actually applied (`category`,
  // `priority`, below) falls back to 'all' when the pick no longer matches
  // anything, so a chip never vanishes while its filter stays on.
  const [categoryChoice, setCategory] = useState('all')
  const [priorityChoice, setPriority] = useState('all')
  const [sort, setSort] = useState('triage')
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
    active: incidents.filter(i => !isSettled(i.status)).length,
    pending: incidents.filter(i => i.status === 'pending').length,
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
    () => incidents.filter(i => inStatus(i, status)),
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
  const category = categoryChoice !== 'all' && !categoryCounts[categoryChoice] ? 'all' : categoryChoice
  const priority = priorityChoice !== 'all' && !priorityCounts[priorityChoice] ? 'all' : priorityChoice

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = incidents.filter(inc => {
      const matchesSearch = !q ||
        inc.title?.toLowerCase().includes(q) ||
        inc.description?.toLowerCase().includes(q) ||
        inc.location?.toLowerCase().includes(q) ||
        inc.profiles?.full_name?.toLowerCase().includes(q)
      return matchesSearch &&
        inStatus(inc, status) &&
        (category === 'all' || inc.category === category) &&
        (priority === 'all' || inc.priority === priority)
    })

    const byNewest = (a, b) => new Date(b.created_at) - new Date(a.created_at)
    if (sort === 'newest') return list.sort(byNewest)
    if (sort === 'oldest') return list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    if (sort === 'priority') return list.sort((a, b) =>
      (PRIORITY_CONFIG[b.priority]?.order || 0) - (PRIORITY_CONFIG[a.priority]?.order || 0) || byNewest(a, b))

    const statusOrder = { pending: 1, assigned: 2, resolved: 3 }
    return list.sort((a, b) => {
      const s = (statusOrder[a.status] || 4) - (statusOrder[b.status] || 4)
      if (s !== 0) return s
      const standing = computeStanding(b, now).score - computeStanding(a, now).score
      if (standing !== 0) return standing
      return a.status === 'resolved' ? byNewest(a, b) : new Date(a.created_at) - new Date(b.created_at)
    })
  }, [incidents, search, status, category, priority, sort, now])

  const activeFilters = [
    search && { key: 'search', label: `"${search}"`, clear: () => setSearch('') },
    category !== 'all' && { key: 'category', label: category, clear: () => setCategory('all') },
    priority !== 'all' && { key: 'priority', label: priority, clear: () => setPriority('all') },
  ].filter(Boolean)

  function clearAll() {
    setSearch(''); setCategory('all'); setPriority('all')
  }

  const tanodById = useMemo(() => Object.fromEntries(tanods.map(t => [t.id, t])), [tanods])

  const open = inc => router.push(`/official/incident/${inc.id}`)

  // What a row says about an incident: where it stands, who has it, and
  // whether it has waited longer than its priority allows.
  function describe(inc) {
    const tanod = inc.assigned_to ? tanodById[inc.assigned_to] : null
    const name = tanod?.full_name || 'Tanod'
    const resolved = inc.status === 'resolved'
    let status = 'Unassigned'
    let tone = inc.priority === 'Critical' ? 'danger' : 'warn'
    if (resolved) { status = 'Resolved'; tone = 'quiet' }
    else if (inc.arrived_at) { status = `${name} · on scene`; tone = 'ok' }
    else if (inc.acknowledged_at) { status = `${name} · on the way`; tone = 'ok' }
    else if (inc.status === 'assigned' || inc.assigned_to) { status = name; tone = 'info' }
    const standing = resolved ? null : computeStanding(inc, now)
    const basis = LEGAL_BASIS[inc.category]
    return {
      status, tone,
      critical: inc.priority === 'Critical' && !resolved,
      aged: standing?.aged ? standing.label : null,
      agedTone: standing?.level >= 2 ? 'danger' : 'warn',
      note: resolved ? null
        : inc.assignment_method === 'auto_offduty' ? 'No tanod was on duty: call to confirm'
          : basis?.responseMode === 'refer_to_agency' && basis.agency ? `Refer to ${basis.agency}` : null,
    }
  }

  function menuFor(inc) {
    const resolved = inc.status === 'resolved'
    return [
      { label: 'Open report', icon: <ExternalLink size={15} aria-hidden="true" />, onClick: () => open(inc) },
      !resolved && { label: 'Resolve', icon: <Check size={15} aria-hidden="true" />, onClick: () => onResolve?.(inc) },
      !resolved && onPriorityChange && { label: 'Adjust priority', icon: <Pencil size={15} aria-hidden="true" />, onClick: () => setOverrideFor(inc) },
    ]
  }


  const exportMeta = { status, category, priority, count: filtered.length }

  if (loading) {
    return (
      <Card aria-busy="true" aria-label="Loading incidents">
        <div className="divide-y divide-line">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-[18px] py-3.5">
              <div className="skeleton-shimmer h-[22px] w-16 rounded-md" />
              <div className="flex-1 space-y-2">
                <div className="skeleton-shimmer h-3.5 w-2/5" />
                <div className="skeleton-shimmer h-3 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    )
  }

  return (
    <div className="@container">
      <style>{styles}</style>

      {incidents.length === 0 ? (
        <Card className="px-[18px] py-5">
          <p className="text-sm font-bold text-ink">No incidents yet</p>
          <Muted className="mt-1">Reports from residents show up here the moment they are sent.</Muted>
        </Card>
      ) : (
      // Not overflow-hidden: the row and export menus open past its edge.
      <Card className="!overflow-visible">
        {/* Toolbar: the status switch, search, filters, sort, export. */}
        <div className="flex flex-wrap items-center gap-2.5 px-3.5 py-3 sm:px-[18px]">
          <Segmented label="Filter by status" value={status} onChange={setStatus}
            items={STATUS_FILTERS.map(f => ({ value: f.value, label: f.label, count: f.value === 'all' || f.value === 'resolved' ? undefined : counts[f.value] }))}
            className="w-full @3xl:w-auto [scrollbar-width:none]! [&::-webkit-scrollbar]:hidden" />
          <SearchBox value={search} onChange={setSearch} inputRef={searchRef} label="Search reports" className="min-w-48 flex-1 @5xl:max-w-64" />
          <div className="flex w-full flex-wrap items-center gap-2 @3xl:ml-auto @3xl:w-auto">
            <FilterSelect label="Category" value={category} onChange={setCategory} className="min-w-0 flex-1 @3xl:flex-none"
              options={[{ value: 'all', label: 'Category' }, ...Object.keys(CATEGORY_CONFIG)
                .filter(c => categoryCounts[c] || category === c)
                .map(c => ({ value: c, label: `${c} · ${categoryCounts[c] || 0}` }))]} />
            <FilterSelect label="Priority" value={priority} onChange={setPriority} className="min-w-0 flex-1 @3xl:flex-none"
              options={[{ value: 'all', label: 'Priority' }, ...Object.entries(PRIORITY_CONFIG)
                .sort((a, b) => b[1].order - a[1].order)
                .filter(([p]) => priorityCounts[p] || priority === p)
                .map(([p]) => ({ value: p, label: `${p} · ${priorityCounts[p] || 0}` }))]} />
            <ExportMenu count={filtered.length} noun="incidents" onExport={format => onExport?.(format, filtered, exportMeta)} />
          </div>
        </div>

        {activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-line px-3.5 py-2.5 sm:px-[18px]">
            <span className="text-xs text-muted-foreground">{filtered.length} of {incidents.length}</span>
            {activeFilters.map(f => (
              <button key={f.key} type="button" onClick={f.clear} aria-label={`Remove filter ${f.label}`}
                className="inline-flex h-7 items-center gap-1 rounded-lg bg-brand-soft px-2 text-xs font-bold text-brand-strong hover:bg-[color-mix(in_srgb,var(--brand-soft)_70%,var(--brand)_8%)]">
                {f.label}<X size={12} aria-hidden="true" />
              </button>
            ))}
            <Button variant="ghost" size="sm" onClick={clearAll}>Clear all</Button>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="border-t border-line px-[18px] py-6">
            <p className="text-sm font-bold text-ink">
              {status === 'active' && !search && category === 'all' && priority === 'all' ? 'Nothing open right now' : 'Nothing matches'}
            </p>
            <Muted className="mt-1">
              {status === 'active' && !search && category === 'all' && priority === 'all'
                ? 'Every report has been resolved. New ones show up here first.'
                : 'Try a broader search or clear a filter.'}
            </Muted>
            {activeFilters.length > 0 && <Button variant="secondary" size="sm" className="mt-3" onClick={clearAll}>Clear filters</Button>}
          </div>
        ) : (
          <>
            {/* Wide: the table (O02). */}
            <table className="hidden w-full table-fixed border-collapse text-left @3xl:table">
              <thead>
                <tr className="border-t border-line bg-surface-sunk text-xs font-bold text-muted-foreground">
                  <th scope="col" className="w-[104px] py-2.5 pl-[18px] font-bold">Priority</th>
                  <th scope="col" className="px-3 py-2.5 font-bold">Report</th>
                  <th scope="col" className="w-[150px] px-3 py-2.5 font-bold">Category</th>
                  <th scope="col" className="hidden w-[150px] px-3 py-2.5 font-bold @5xl:table-cell">Location</th>
                  <th scope="col" className="w-[108px] px-3 py-2.5 font-bold">Reported</th>
                  <th scope="col" className="w-[180px] px-3 py-2.5 font-bold">Status</th>
                  <th scope="col" className="w-[140px] py-2.5 pr-[18px]"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(inc => {
                  const row = describe(inc)
                  return (
                    <tr key={inc.id} onClick={() => open(inc)}
                      className={`cursor-pointer border-t border-line transition-colors hover:bg-surface-sunk ${row.critical ? 'bg-[color-mix(in_srgb,var(--danger-soft)_60%,var(--surface))] hover:bg-danger-soft' : ''}`}>
                      <td className="py-3 pl-[18px]"><Tag tone={PRIORITY_TONE[inc.priority] || 'quiet'}>{inc.priority || 'Medium'}</Tag></td>
                      <td className="min-w-0 px-3 py-3">
                        <button type="button" onClick={e => { e.stopPropagation(); open(inc) }}
                          className="block max-w-full truncate text-left text-sm font-bold text-ink outline-none hover:underline focus-visible:underline">
                          {inc.title}
                        </button>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {[inc.profiles?.full_name || 'Unknown reporter', row.note].filter(Boolean).join(' · ')}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-body">
                          <span className="shrink-0" style={{ color: categoryColor(inc.category) }}><CategoryIcon category={inc.category} size={16} /></span>
                          <span className="truncate">{inc.category || 'Other'}</span>
                        </span>
                      </td>
                      <td className="hidden truncate px-3 py-3 text-[13px] text-body @5xl:table-cell">{inc.location || '—'}</td>
                      <td className="px-3 py-3 text-[13px]">
                        <time title={fullDate(inc.created_at)} dateTime={inc.created_at} className="block truncate text-body">{timeAgo(inc.created_at, new Date(now))}</time>
                        {row.aged && <span className="block truncate text-xs font-bold" style={{ color: TONE_FG[row.agedTone] }}>{row.aged}</span>}
                      </td>
                      <td className="px-3 py-3"><Status tone={row.tone} className="max-w-full">{row.status}</Status></td>
                      <td className="py-3 pr-[18px]" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {inc.status === 'pending'
                            ? <Button size="sm" onClick={() => setDispatchFor(inc)}>Dispatch</Button>
                            : <Button size="sm" variant="secondary" onClick={() => open(inc)}>Open</Button>}
                          <RowMenu label={`More for ${inc.title}`} items={menuFor(inc)} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Narrow: one row per report. */}
            <Rows className="border-t border-line @3xl:hidden">
              {filtered.map(inc => {
                const row = describe(inc)
                return (
                  <Row key={inc.id} critical={row.critical} className="flex items-start gap-3">
                    <span className="mt-0.5 shrink-0" style={{ color: categoryColor(inc.category) }}><CategoryIcon category={inc.category} size={20} /></span>
                    <button type="button" onClick={() => open(inc)} className="min-w-0 flex-1 text-left outline-none focus-visible:underline">
                      <span className="block truncate text-sm font-bold text-ink">{inc.title}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {[inc.location, timeAgo(inc.created_at, new Date(now)), row.note].filter(Boolean).join(' · ')}
                      </span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-2">
                        <Tag tone={PRIORITY_TONE[inc.priority] || 'quiet'}>{inc.priority || 'Medium'}</Tag>
                        <Status tone={row.tone}>{row.status}</Status>
                        {row.aged && <span className="text-xs font-bold" style={{ color: TONE_FG[row.agedTone] }}>{row.aged}</span>}
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {inc.status === 'pending' && <Button size="sm" onClick={() => setDispatchFor(inc)}>Dispatch</Button>}
                      <RowMenu label={`More for ${inc.title}`} items={menuFor(inc)} />
                    </div>
                  </Row>
                )
              })}
            </Rows>
          </>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-line px-3.5 py-3 sm:px-[18px]">
          <p className="flex-1 text-xs text-muted-foreground">
            Showing {filtered.length} of {incidents.length} {hasMore ? 'loaded ' : ''}report{incidents.length === 1 ? '' : 's'}
            {hasMore && '. Filters and exports cover the loaded ones.'}
          </p>
          <FilterSelect label="Sort" value={sort} onChange={setSort} options={SORTS} />
          {hasMore && (
            <Button variant="secondary" size="sm" onClick={onLoadMore} disabled={loadingMore} aria-busy={loadingMore || undefined}>
              {loadingMore ? 'Loading…' : 'Load older'}
            </Button>
          )}
        </div>
      </Card>
      )}

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
    </div>
  )
}
