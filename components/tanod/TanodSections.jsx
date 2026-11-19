'use client'
import dynamic from 'next/dynamic'
import { Check, ChevronLeft, ChevronRight, Loader2, Navigation, Phone } from 'lucide-react'
import Band from '@/components/crafted/Band'
import { Card, CardHead } from '@/components/ui/card'
import { Rows, Row } from '@/components/ui/table'
import { Tag, Status } from '@/components/ui/tag'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Avatar } from '@/components/ui/avatar'
import { Muted, SectionLabel } from '@/components/ui/text'
import { Menu } from '@/components/official/Toolbar'
import { CategoryIcon, categoryColor } from '@/lib/categoryIcons'
import { RESPONSE_STEPS, responseStage, nextAction } from '@/lib/tanod'
import { computeStanding } from '@/lib/triage'
import { timeAgo, fullDate } from '@/lib/timeAgo'
import { useSignedIncidentUrl } from '@/lib/useSignedUrl'

const MiniMap = dynamic(() => import('@/components/MiniMap'), { ssr: false })

/*
 * The tanod dashboard's pieces in the Crafted style (T01–T06).
 * Presentation only: every list is what app/tanod/page.jsx loads, and
 * every action (on the way, arrived, resolve, call, directions) calls
 * back into the page, which owns the writes and the offline queue.
 */

const PRIORITY_TONE = { Critical: 'danger', High: 'warn' }

/** Where an assignment stands for the tanod: one plain label and a tone. */
export function assignmentState(inc, now) {
  if (!inc) return { label: '', tone: 'quiet' }
  if (inc.status === 'resolved') return { label: 'Resolved', tone: 'quiet' }
  if (inc.arrived_at) return { label: 'On scene', tone: 'ok' }
  if (inc.acknowledged_at) return { label: 'On the way', tone: 'ok' }
  const standing = computeStanding(inc, now)
  if (standing.aged) return { label: standing.label, tone: standing.level >= 2 ? 'danger' : 'warn' }
  return { label: 'Waiting', tone: inc.priority === 'Critical' ? 'danger' : 'warn' }
}

const hasCoords = inc => Number.isFinite(inc?.latitude) && Number.isFinite(inc?.longitude)

/** Google Maps / Waze / Apple Maps, the page decides how each opens. */
export function DirectionsMenu({ inc, onDirections, up = false, children }) {
  return (
    <Menu up={up} align="left" items={[
      { label: 'Google Maps', onClick: () => onDirections('google', inc.latitude, inc.longitude) },
      { label: 'Waze', onClick: () => onDirections('waze', inc.latitude, inc.longitude) },
      { label: 'Apple Maps', onClick: () => onDirections('apple', inc.latitude, inc.longitude) },
    ]} trigger={children} />
  )
}

/** The primary step for an assignment, by stage (I'm on my way, I've arrived, Resolve). */
function primaryStep(inc, { onStamp, onResolve, busy }) {
  const action = nextAction(inc)
  if (!action) return null
  if (action.key === 'resolve') return { label: 'Resolve', run: () => onResolve(inc) }
  return { label: busy ? 'Saving…' : action.label, run: () => onStamp(inc, action.field), busy }
}

/**
 * T01: the most urgent assignment on the band: priority and when, the
 * title and place, the map, then Navigate and the next step.
 */
export function AssignmentHero({ inc, busy, onOpen, onStamp, onResolve, onDirections }) {
  const step = primaryStep(inc, { onStamp, onResolve, busy })
  return (
    <Card lift>
      <button type="button" onClick={() => onOpen(inc)} className="block w-full px-[18px] pt-3.5 pb-3 text-left outline-none focus-visible:bg-surface-sunk">
        <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {PRIORITY_TONE[inc.priority] && <Tag tone={PRIORITY_TONE[inc.priority]}>{inc.priority}</Tag>}
          <span>Assigned {timeAgo(inc.created_at)}</span>
        </span>
        <span className="mt-2 flex items-start gap-2.5">
          <span className="mt-0.5 shrink-0" style={{ color: categoryColor(inc.category) }}><CategoryIcon category={inc.category} size={20} /></span>
          <span className="min-w-0">
            <span className="block text-[17px] leading-snug font-extrabold text-ink">{inc.title}</span>
            <span className="mt-0.5 block truncate text-[13px] text-body">{inc.location || 'No location given'}</span>
          </span>
        </span>
      </button>
      {hasCoords(inc) && (
        <div className="border-y border-line">
          <MiniMap bare directions={false} lat={inc.latitude} lng={inc.longitude} height={150} label={inc.title} />
        </div>
      )}
      <div className="flex gap-2.5 px-[18px] py-3.5">
        {hasCoords(inc) && (
          <DirectionsMenu inc={inc} onDirections={onDirections} up>
            {({ open, toggle }) => (
              <Button variant="secondary" size="lg" onClick={toggle} aria-expanded={open} aria-haspopup="menu" className="flex-1">
                <Navigation aria-hidden="true" />Navigate
              </Button>
            )}
          </DirectionsMenu>
        )}
        {step && (
          <Button size="lg" className="flex-1" onClick={step.run} disabled={step.busy} aria-busy={step.busy || undefined}>
            {step.busy && <Loader2 className="animate-spin" aria-hidden="true" />}{step.label}
          </Button>
        )}
      </div>
    </Card>
  )
}

/** One assignment as a row (Up next, Assigned). */
function AssignmentRow({ inc, now, onOpen }) {
  const st = assignmentState(inc, now)
  return (
    <Row as="button" type="button" interactive onClick={() => onOpen(inc)} className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0" style={{ color: categoryColor(inc.category) }}><CategoryIcon category={inc.category} size={20} /></span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{inc.title}</span>
          {PRIORITY_TONE[inc.priority] && <Tag tone={PRIORITY_TONE[inc.priority]} className="shrink-0">{inc.priority}</Tag>}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {[inc.location || 'No location given', timeAgo(inc.created_at)].join(' · ')}
          {inc.queuedOffline ? ' · saved, sends when online' : ''}
        </span>
        <Status tone={st.tone} className="mt-1.5">{st.label}</Status>
      </span>
      <ChevronRight size={16} aria-hidden="true" className="mt-1 shrink-0 text-muted-foreground" />
    </Row>
  )
}

/** T01: the rest of the queue, after the one on the band. */
export function UpNextCard({ items, now, onOpen, onSeeAll }) {
  if (!items.length) return null
  return (
    <Card>
      <CardHead title="Up next" action={<Button variant="ghost" size="sm" onClick={onSeeAll}>See all</Button>} />
      <Rows className="border-t border-line">
        {items.map(inc => <AssignmentRow key={inc.id} inc={inc} now={now} onOpen={onOpen} />)}
      </Rows>
    </Card>
  )
}

/** T02 Active: every open assignment, worst first. */
export function AssignmentList({ items, now, onOpen, empty }) {
  if (!items.length) {
    return <Card lift className="px-[18px] py-5"><p className="text-sm font-bold text-ink">Nothing assigned</p><Muted className="mt-1">{empty}</Muted></Card>
  }
  return (
    <Card lift>
      <Rows>{items.map(inc => <AssignmentRow key={inc.id} inc={inc} now={now} onOpen={onOpen} />)}</Rows>
    </Card>
  )
}

/** T02 Done: what this tanod has closed, newest first, with what they wrote. */
export function DoneList({ items, onOpen }) {
  if (!items.length) {
    return <Card lift className="px-[18px] py-5"><p className="text-sm font-bold text-ink">Nothing resolved yet</p><Muted className="mt-1">Reports you close show up here with your notes.</Muted></Card>
  }
  return (
    <Card lift>
      <Rows>
        {items.map(inc => (
          <Row key={inc.id} as="button" type="button" interactive onClick={() => onOpen(inc)} className="flex items-start gap-3">
            <Check size={18} strokeWidth={2.2} aria-hidden="true" className="mt-0.5 shrink-0 text-ok" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-ink">{inc.title}</span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground" title={fullDate(inc.resolved_at || inc.created_at)}>
                Resolved {timeAgo(inc.resolved_at || inc.created_at)}{inc.location ? ` · ${inc.location}` : ''}
              </span>
              {inc.resolution_notes && <span className="mt-1 line-clamp-2 block text-[13px] text-body">{inc.resolution_notes}</span>}
            </span>
            {inc.rating ? <Tag tone="warn" className="shrink-0">{inc.rating} / 5</Tag> : null}
          </Row>
        ))}
      </Rows>
    </Card>
  )
}

function ProgressSteps({ stage }) {
  return (
    <ol className="grid grid-cols-4 gap-1.5" aria-label={`Progress: ${RESPONSE_STEPS[stage]}`}>
      {RESPONSE_STEPS.map((label, i) => (
        <li key={label} className="min-w-0">
          <span className={`block h-1 rounded-full ${i <= stage ? 'bg-ok' : 'bg-track'}`} aria-hidden="true" />
          <span className={`mt-1.5 block truncate text-center text-[11px] font-bold ${i === stage ? 'text-ok' : i < stage ? 'text-ok' : 'text-muted-foreground'}`}>{label}</span>
        </li>
      ))}
    </ol>
  )
}

function Photo({ stored, alt }) {
  const signed = useSignedIncidentUrl(stored)
  if (!signed) return null
  return (
    <a href={signed} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-[10px] border border-line">
      <img src={signed} alt={alt} className="max-h-56 w-full object-cover" loading="lazy" />
    </a>
  )
}

/**
 * T03: one assignment, full screen, opened by ?assignment=<id> so the
 * phone's Back button closes it. The map, the progress, what the resident
 * said, who to call, and the next step pinned to the bottom.
 */
export function AssignmentPanel({ inc, now, busy, onClose, onStamp, onResolve, onDirections, onCall }) {
  const stage = responseStage(inc)
  const step = primaryStep(inc, { onStamp, onResolve, busy })
  const resolved = inc.status === 'resolved'
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="assignment-title"
      className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-page [animation:sheetFade_.18s_ease_both] motion-reduce:animate-none">
      <header className="relative isolate shrink-0 px-4 pt-[max(16px,env(safe-area-inset-top,0px))] pb-3 text-white">
        <Band extend={0} fade={56} dots={10} seed={7} />
        <div className="relative z-[1] mx-auto flex max-w-2xl items-center gap-2.5">
          <IconButton kind="onband" label="Back" onClick={onClose}><ChevronLeft size={18} strokeWidth={1.9} /></IconButton>
          <div className="min-w-0 flex-1">
            <h1 id="assignment-title" className="truncate text-[17px] font-extrabold">{inc.title}</h1>
            <p className="truncate text-xs text-white/80">{[inc.category, inc.priority, assignmentState(inc, now).label].filter(Boolean).join(' · ')}</p>
          </div>
        </div>
      </header>

      <main className="relative z-[1] flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-2xl flex-col gap-3.5 px-4 pt-1 pb-6">
          {hasCoords(inc) && (
            <Card lift className="relative">
              <MiniMap bare directions={false} lat={inc.latitude} lng={inc.longitude} height="clamp(180px, 30dvh, 300px)" label={inc.title} />
              <div className="absolute right-3 bottom-3 z-[500]">
                <DirectionsMenu inc={inc} onDirections={onDirections} up>
                  {({ open, toggle }) => (
                    <button type="button" onClick={toggle} aria-expanded={open} aria-haspopup="menu"
                      className="inline-flex h-[34px] items-center gap-2 rounded-[10px] border border-line bg-surface px-3 text-[13px] font-bold text-ink shadow-[var(--shadow-lift)] hover:border-line-strong">
                      <Navigation size={15} aria-hidden="true" />Open in Maps
                    </button>
                  )}
                </DirectionsMenu>
              </div>
            </Card>
          )}

          <Card className="px-[18px] py-3.5"><ProgressSteps stage={stage} /></Card>

          <Card className="px-[18px] py-3.5">
            <SectionLabel as="h2" className="mb-1">What the resident said</SectionLabel>
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-ink">{inc.description || 'No description.'}</p>
            <p className="mt-2 text-xs text-muted-foreground" title={fullDate(inc.created_at)}>
              {[inc.category, inc.location, timeAgo(inc.created_at)].filter(Boolean).join(' · ')}
            </p>
            {inc.image_url && <div className="mt-3"><Photo stored={inc.image_url} alt="Photo from the resident" /></div>}
          </Card>

          {resolved && (inc.resolution_notes || inc.resolution_image_url) && (
            <Card className="px-[18px] py-3.5">
              <SectionLabel as="h2" className="mb-1">What you wrote</SectionLabel>
              {inc.resolution_notes && <p className="text-[15px] leading-relaxed text-ink">{inc.resolution_notes}</p>}
              {inc.resolution_image_url && <div className="mt-3"><Photo stored={inc.resolution_image_url} alt="Resolution photo" /></div>}
            </Card>
          )}

          <Card>
            <div className="flex items-center gap-3 px-[18px] py-3">
              <Avatar name={inc.profiles?.full_name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink">{inc.profiles?.full_name || 'The reporter'}</p>
                <p className="text-xs text-muted-foreground">{inc.profiles?.phone ? 'Reporter · tap to call' : 'Reporter · no number on file'}</p>
              </div>
              <IconButton kind="plain" label={`Call ${inc.profiles?.full_name || 'the reporter'}`} disabled={!inc.profiles?.phone}
                onClick={() => onCall(inc.profiles?.phone)}>
                <Phone size={18} strokeWidth={1.9} />
              </IconButton>
            </div>
          </Card>
        </div>
      </main>

      {step && (
        <footer className="relative z-[2] shrink-0 border-t border-line bg-surface px-4 pt-3 pb-[max(14px,env(safe-area-inset-bottom,0px))]">
          <div className="mx-auto max-w-2xl">
            <Button size="lg" className="w-full" onClick={step.run} disabled={step.busy} aria-busy={step.busy || undefined}>
              {step.busy && <Loader2 className="animate-spin" aria-hidden="true" />}{step.label}
            </Button>
          </div>
        </footer>
      )}
    </div>
  )
}

/** T06: reports handled per day, the latest day in brand. */
export function HandledChart({ days }) {
  const max = Math.max(1, ...days.map(d => d.count))
  const total = days.reduce((s, d) => s + d.count, 0)
  return (
    <Card>
      <CardHead title="Reports handled" action={<span className="text-xs text-muted-foreground">Last 7 days · {total}</span>} />
      {total === 0 ? (
        <Muted className="border-t border-line px-[18px] py-4">Nothing resolved in the last 7 days. Reports you close show up here by day.</Muted>
      ) : (
      <div className="px-[18px] pb-4" role="img" aria-label={`Reports resolved per day: ${days.map(d => `${d.label} ${d.count}`).join(', ')}`}>
        <div className="flex h-36 items-end gap-2.5">
          {days.map((d, i) => (
            <div key={i} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <span className="text-xs font-bold text-body tabular-nums">{d.count || ''}</span>
              <span className={`w-full max-w-9 rounded-t-[6px] ${i === days.length - 1 ? 'bg-brand-strong' : 'bg-[color-mix(in_srgb,var(--brand-strong)_28%,var(--surface))]'}`}
                style={{ height: `${Math.max(d.count ? 6 : 2, (d.count / max) * 100)}%` }} />
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex gap-2.5">
          {days.map((d, i) => <span key={i} className="flex-1 text-center text-xs text-muted-foreground">{d.label}</span>)}
        </div>
      </div>
      )}
    </Card>
  )
}

/** T06: resolved reports by category. */
export function ByTypeCard({ rows }) {
  if (!rows.length) return null
  const max = Math.max(...rows.map(r => r.count))
  return (
    <Card>
      <CardHead title="By type" />
      <Rows className="border-t border-line">
        {rows.slice(0, 6).map(r => (
          <Row key={r.category} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_2rem] items-center gap-3">
            <span className="flex min-w-0 items-center gap-2 text-sm font-bold text-ink">
              <span className="shrink-0" style={{ color: categoryColor(r.category) }}><CategoryIcon category={r.category} size={18} /></span>
              <span className="truncate">{r.category}</span>
            </span>
            <span className="h-1.5 overflow-hidden rounded-full bg-track" aria-hidden="true">
              <span className="block h-full rounded-full bg-brand-strong" style={{ width: `${(r.count / max) * 100}%` }} />
            </span>
            <span className="text-right text-sm font-extrabold text-ink tabular-nums">{r.count}</span>
          </Row>
        ))}
      </Rows>
    </Card>
  )
}
