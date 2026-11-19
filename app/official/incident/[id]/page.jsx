'use client'
import { IncidentDetailSkeleton } from '@/components/Skeletons'
import { useEffect, useLayoutEffect, useRef, useState, useMemo } from 'react'
import { settleEntrances } from '@/components/SectionContent'
import { useRouter, useParams } from 'next/navigation'
import { loginHref } from '@/lib/loginRedirect'
import { goBack } from '@/lib/goBack'
import { createClient } from '@/lib/supabase'
import dynamic from 'next/dynamic'
import {
  Phone, Shield, Scale, Check, Send, Pencil, Star, X, FileText, Bell,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { timeAgo, fullDate } from '@/lib/timeAgo'
import { LEGAL_BASIS } from '@/lib/legalBasis'
import { computeStanding, activeWindowLabel } from '@/lib/triage'
import { useSignedIncidentUrl } from '@/lib/useSignedUrl'
import PageShell from '@/components/crafted/PageShell'
import { Card, CardHead } from '@/components/ui/card'
import { Rows, Row } from '@/components/ui/table'
import { Tag, Status } from '@/components/ui/tag'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { Notice } from '@/components/ui/notice'
import { Muted } from '@/components/ui/text'
import { CategoryIcon } from '@/lib/categoryIcons'
import { subscribeWhenSignedIn } from '@/lib/realtime'

const MiniMap = dynamic(() => import('@/components/MiniMap'), { ssr: false })

/**
 * Incident detail — the record of one incident, end to end.
 *
 * The card in the list answers "does this need me right now?". This page
 * answers "what happened here?", which is a different question and needs
 * different information: the full legal classification, every hand the
 * incident passed through, and why each decision was made.
 *
 * The audit timeline is the centre of the page rather than a footnote,
 * because it is the one view where the whole system becomes legible: law
 * assigns a priority, a trigger assigns a responder, a human overrides
 * with a stated reason, a resident rates the result. Read top to bottom,
 * it is the chain of custody for a public-safety report.
 */

/* ---------------------------------------------------------------------------
   Timeline construction. Each entry is a fact the database recorded, not a
   guess — if a field is null the event simply isn't in the list, which is
   itself informative (an unacknowledged critical shows a gap).
--------------------------------------------------------------------------- */
function buildTimeline(inc, people) {
  if (!inc) return []
  const name = id => people[id]?.full_name || 'Unknown'
  const events = []

  events.push({
    at: inc.created_at,
    icon: FileText,
    tone: 'neutral',
    title: 'Reported',
    body: `${inc.profiles?.full_name || 'A resident'} filed this report.`,
  })

  const basis = LEGAL_BASIS[inc.category]
  if (inc.legal_basis || basis) {
    events.push({
      at: inc.created_at,
      icon: Scale,
      tone: 'legal',
      title: `Classified ${inc.original_priority || inc.priority}`,
      body: inc.legal_basis || `${basis?.law}${basis?.sections ? `, ${basis.sections}` : ''} — ${basis?.lawTitle}`,
      note: basis?.reason,
    })
  }

  if (inc.assigned_to && inc.auto_assigned_at) {
    const offDuty = inc.assignment_method === 'auto_offduty'
    events.push({
      at: inc.auto_assigned_at,
      icon: Shield,
      tone: offDuty ? 'warn' : 'neutral',
      title: offDuty ? 'Auto-assigned — nobody on duty' : 'Auto-assigned',
      body: offDuty
        ? `No tanod was on shift. Sent to ${name(inc.assigned_to)}, the most recently active tanod.`
        : `Sent to ${name(inc.assigned_to)} by the dispatch rule.`,
    })
  } else if (inc.assigned_to && inc.assignment_method === 'manual') {
    events.push({
      at: null,
      icon: Send,
      tone: 'neutral',
      title: 'Dispatched by an official',
      body: `Assigned to ${name(inc.assigned_to)}.`,
    })
  }

  if (inc.acknowledged_at) {
    const lag = Math.round((new Date(inc.acknowledged_at) - new Date(inc.created_at)) / 60000)
    events.push({
      at: inc.acknowledged_at,
      icon: Bell,
      tone: 'neutral',
      title: 'Alert acknowledged',
      body: `${name(inc.acknowledged_by)} saw the critical alert ${lag} minute${lag === 1 ? '' : 's'} after it was reported.`,
    })
  }

  if (inc.priority_overridden_by) {
    events.push({
      at: inc.priority_overridden_at,
      icon: Pencil,
      tone: 'override',
      title: `Priority changed · ${inc.original_priority} → ${inc.priority}`,
      body: `${name(inc.priority_overridden_by)} adjusted the automatic classification.`,
      quote: inc.priority_override_reason,
    })
  }

  if (inc.resolved_at || inc.status === 'resolved') {
    events.push({
      at: inc.resolved_at,
      icon: Check,
      tone: 'good',
      title: 'Marked resolved',
      body: inc.resolution_notes || 'No resolution notes were recorded.',
      photo: inc.resolution_image_url,
    })
  }

  if (inc.rated_at || inc.rating) {
    events.push({
      at: inc.rated_at,
      icon: Star,
      tone: 'good',
      title: `Resident rated ${inc.rating} out of 5`,
      body: inc.rating_feedback ? null : 'No written feedback.',
      quote: inc.rating_feedback,
    })
  }

  return events.sort((a, b) => {
    if (!a.at) return 1
    if (!b.at) return -1
    return new Date(a.at) - new Date(b.at)
  })
}

export default function IncidentDetail() {
  const router = useRouter()
  const params = useParams()
  const supabase = useMemo(() => createClient(), [])

  const [incident, setIncident] = useState(null)
  const [people, setPeople] = useState({})
  const [tanods, setTanods] = useState([])
  const [loading, setLoading] = useState(true)
  const mainRef = useRef(null)
  const [notFound, setNotFound] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const [busy, setBusy] = useState(false)

  // Bumped to fetch again (after a dispatch conflict shows stale data).
  const [reloadCount, setReloadCount] = useState(0)

  // Fetch on open and whenever the incident id changes (or a reload is asked for). `cancelled`
  // drops answers for an incident the user has already navigated away from.
  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (cancelled) return
      if (authError || !user) { router.replace(loginHref()); return }

      const { data: prof, error: profError } = await supabase
        .from('profiles').select('role, barangay_id').eq('id', user.id).single()
      if (cancelled) return
      // A failed query is not the same as being the wrong role.
      if (profError) {
        console.error('Could not load your profile:', profError)
        toast.error('Could not load this incident. Please refresh.')
        setLoading(false)
        return
      }
      if (prof?.role !== 'official') { router.replace(loginHref()); return }

      const { data, error } = await supabase
        .from('incidents')
        .select('*, profiles!incidents_reported_by_fkey(full_name, phone)')
        .eq('id', params.id)
        .single()
      if (cancelled) return

      if (error || !data) { setNotFound(true); setLoading(false); return }
      setIncident(data)

      // Everyone who appears in the timeline, resolved in one query
      const ids = [data.assigned_to, data.acknowledged_by, data.priority_overridden_by].filter(Boolean)
      if (ids.length) {
        const { data: rows, error: rowsError } = await supabase
          .from('profiles').select('id, full_name, phone, on_duty, avatar_url').in('id', ids)
        if (cancelled) return
        // Names for the audit trail. Without them it falls back to ids, which
        // is ugly but readable — not worth interrupting the page for.
        if (rowsError) console.error('Could not load the people named on this incident:', rowsError)
        const map = {}
        for (const r of rows || []) map[r.id] = r
        setPeople(map)
      }

      const { data: tanodRows, error: tanodError } = await supabase
        .from('profiles').select('id, full_name, phone, on_duty')
        .eq('barangay_id', prof.barangay_id).eq('role', 'tanod').is('deactivated_at', null)
      if (cancelled) return
      // Feeds the dispatch picker; an empty list would read as "no tanods".
      if (tanodError) console.error('Could not load the tanod roster:', tanodError)
      setTanods(tanodRows || [])

      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [supabase, router, params.id, reloadCount])

  // Live updates while the page is open
  useEffect(() => {
    if (!params.id) return
    const ch = supabase.channel(`incident-${params.id}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'incidents', filter: `id=eq.${params.id}` },
        payload => setIncident(prev => ({ ...prev, ...payload.new })))
    const leaveCh = subscribeWhenSignedIn(supabase, ch)
    return () => { leaveCh() }
  }, [params.id, supabase])

  const timeline = useMemo(() => buildTimeline(incident, people), [incident, people])
  const basis = incident ? LEGAL_BASIS[incident.category] : null
  const standing = incident ? computeStanding(incident) : null
  // The dispatch list: on duty first, then by name.
  const sortedTanods = useMemo(
    () => [...tanods].sort((a, b) => (b.on_duty === true) - (a.on_duty === true) ||
      (a.full_name || '').localeCompare(b.full_name || '')),
    [tanods]
  )

  async function resolve() {
    setBusy(true)
    const { error } = await supabase.from('incidents')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('id', incident.id)
    setBusy(false)
    if (error) { toast.error('Could not update. Try again.'); return }
    setIncident(p => ({ ...p, status: 'resolved', resolved_at: new Date().toISOString() }))
    toast.success('Marked resolved')
  }

  async function dispatchTo(tanodId) {
    setBusy(true)
    const { data, error } = await supabase.from('incidents')
      .update({ assigned_to: tanodId, status: 'assigned', assignment_method: 'manual' })
      .eq('id', incident.id).eq('status', 'pending').select()
    setBusy(false)
    if (error) { toast.error('Dispatch failed.'); return }
    if (!data?.length) { toast.error('Already assigned by someone else.'); setReloadCount(n => n + 1); return }
    setIncident(p => ({ ...p, assigned_to: tanodId, status: 'assigned' }))
    toast.success('Tanod dispatched')
  }

  // The report replaces its skeleton in place: finish the timeline's own
  // entrance before the first paint (items added later still animate).
  useLayoutEffect(() => { if (!loading) settleEntrances(mainRef.current) }, [loading])

  if (loading) return <IncidentDetailSkeleton />

  if (notFound) {
    return (
      <PageShell title="Incident" onBack={() => goBack(router, '/official?section=incidents')}>
        <Card className="px-[18px] py-5">
          <h2 className="text-[15px] font-extrabold text-ink">Incident not found</h2>
          <Muted className="mt-1">It may have been deleted, or the link is wrong.</Muted>
          <Button variant="secondary" className="mt-4" onClick={() => router.replace('/official?section=incidents')}>Back to incidents</Button>
        </Card>
      </PageShell>
    )
  }

  const assignedTanod = incident.assigned_to ? people[incident.assigned_to] : null
  const resolved = incident.status === 'resolved'
  const pending = incident.status === 'pending'
  const hasMap = Number.isFinite(incident.latitude) && Number.isFinite(incident.longitude)
  const reporter = incident.profiles?.full_name || 'a resident'
  const stateLabel = resolved ? 'Resolved' : pending ? 'Unassigned' : incident.arrived_at ? 'Tanod on scene' : incident.acknowledged_at ? 'Tanod on the way' : 'Dispatched'
  const stateTone = resolved ? 'quiet' : pending ? (incident.priority === 'Critical' ? 'danger' : 'warn') : incident.acknowledged_at ? 'ok' : 'info'
  const resolveButton = (variant, extra = {}) => (
    <Button variant={variant} onClick={resolve} disabled={busy} aria-busy={busy || undefined} {...extra}>
      <Check aria-hidden="true" />Mark resolved
    </Button>
  )

  return (
    <PageShell
      maxWidth={1120}
      eyebrow={`Reported ${timeAgo(incident.created_at)}`}
      title={incident.title}
      sub={`${incident.location || 'No location given'} · reported by ${reporter}`}
      onBack={() => goBack(router, '/official?section=incidents')}
      backLabel="Back to incidents"
      actions={!resolved && <span className="hidden desk:flex">{resolveButton('white')}</span>}
      footer={!resolved && resolveButton('primary', { size: 'lg', className: 'w-full' })}
      footerPhoneOnly>
      <div ref={mainRef} className="grid items-start gap-3.5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">

        {/* ---------------- LEFT: the incident itself ---------------- */}
        <div className="flex min-w-0 flex-col gap-3.5">
          <Card lift>
            {incident.image_url && (
              <PhotoCard src={incident.image_url} label="Photo from the reporter"
                onOpen={(url) => setLightbox({ src: url, alt: 'Reported photo' })} />
            )}
            <div className="space-y-3 px-[18px] py-4">
              <div className="flex flex-wrap items-center gap-1.5">
                <Tag tone={PRIORITY_TONE[incident.priority] || 'quiet'}>{incident.priority}</Tag>
                <Tag tone="brand"><CategoryIcon category={incident.category} size={13} />{incident.category}</Tag>
                <Status tone={stateTone} className="ml-1">{stateLabel}</Status>
              </div>
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-body">{incident.description}</p>
              <p className="text-xs text-muted-foreground">
                Reported by {reporter}
                {incident.profiles?.phone ? <> · <a href={`tel:${incident.profiles.phone.replace(/[^0-9+]/g, '')}`} className="font-bold text-brand-strong hover:underline">{incident.profiles.phone}</a></> : null}
                {' · '}<time dateTime={incident.created_at} title={fullDate(incident.created_at)}>{fullDate(incident.created_at)}</time>
              </p>

              {standing?.aged && !resolved && (
                <Notice tone={standing.level >= 2 ? 'danger' : 'warn'} title={standing.label}>
                  {incident.priority} reports target {activeWindowLabel(incident)}. This one has waited {timeAgo(incident.created_at).replace(' ago', '')}.
                  {standing.phase === 'response' && ' Nobody has acknowledged it or chosen the responder yet; an automatic assignment does not count.'}
                </Notice>
              )}

              {basis?.law && (
                <div className="rounded-[10px] bg-info-soft px-3.5 py-3">
                  <p className="text-xs font-extrabold tracking-[0.04em] text-info uppercase">
                    Who leads · {basis.law}{basis.sections ? `, ${basis.sections}` : ''}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-ink">{basis.reason}</p>
                  {basis.responseMode === 'refer_to_agency' && basis.agency && (
                    <p className="mt-1.5 text-sm font-bold text-ink">{basis.agency} has authority here. Tanods document and assist only.</p>
                  )}
                  {basis.provision && <p className="mt-1.5 text-xs leading-relaxed text-body">{basis.provision}</p>}
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {basis.lawTitle}
                    {basis.source && <> · <a href={basis.source} target="_blank" rel="noopener noreferrer" className="font-bold text-brand-strong hover:underline">Read the law</a></>}
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* What happened, in order: every fact the database recorded. */}
          <Card>
            <CardHead title="Activity" />
            <ol className="border-t border-line">
              {timeline.map((e, i) => (
                <li key={i} className="grid grid-cols-[74px_minmax(0,1fr)] gap-3 border-b border-line px-[18px] py-3 last:border-b-0">
                  <time className="pt-px text-xs font-bold text-muted-foreground" dateTime={e.at || undefined} title={e.at ? fullDate(e.at) : undefined}>
                    {e.at ? clock(e.at) : '—'}
                  </time>
                  <div className="min-w-0">
                    <p className="text-sm font-bold" style={{ color: TONE_COLOR[e.tone] || 'var(--ink)' }}>{e.title}</p>
                    {e.body && <p className="mt-0.5 text-[13px] leading-relaxed text-body">{e.body}</p>}
                    {e.quote && <p className="mt-1 text-[13px] text-body italic">&ldquo;{e.quote}&rdquo;</p>}
                    {e.note && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{e.note}</p>}
                    {e.photo && (
                      <TimelinePhoto stored={e.photo}
                        onOpen={(url) => setLightbox({ src: url, alt: 'Resolution photo' })} />
                    )}
                  </div>
                </li>
              ))}
              {/* An unfinished incident says so, rather than just ending. */}
              {!resolved && (
                <li className="grid grid-cols-[74px_minmax(0,1fr)] gap-3 px-[18px] py-3">
                  <span className="text-xs font-bold text-muted-foreground">Now</span>
                  <p className="text-[13px] text-muted-foreground">{pending ? 'Waiting for a responder.' : 'Response in progress.'}</p>
                </li>
              )}
            </ol>
          </Card>
        </div>

        {/* ---------------- RIGHT: where, and who responds ---------------- */}
        <div className="flex min-w-0 flex-col gap-3.5">
          <Card lift>
            {hasMap ? (
              <div className="relative border-b border-line">
                <MiniMap bare lat={incident.latitude} lng={incident.longitude} height="clamp(200px, 30dvh, 280px)" />
              </div>
            ) : (
              <Muted className="border-b border-line px-[18px] py-5">No map pin: this was reported without coordinates.</Muted>
            )}
            <div className="px-[18px] py-3">
              <p className="text-sm text-ink">
                <strong>{incident.location || 'No location description'}</strong>
                {hasMap && <span className="text-body"> · {incident.latitude.toFixed(4)}, {incident.longitude.toFixed(4)}</span>}
              </p>
            </div>
          </Card>

          {pending ? (
            <Card>
              <CardHead title="Dispatch a tanod" sub="On duty first, then the fewest active reports" />
              {sortedTanods.length === 0 ? (
                <Muted className="border-t border-line px-[18px] py-5">No tanods yet. Tanods join with an invite code from Users.</Muted>
              ) : (
                <Rows className="border-t border-line">
                  {sortedTanods.map((t, i) => (
                    <Row key={t.id} className="flex items-center gap-3">
                      <Avatar name={t.full_name} size="sm" tone={t.on_duty ? 'ok' : 'brand'} />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 truncate text-sm font-bold text-ink">
                          <span className="truncate">{t.full_name}</span>
                          {i === 0 && t.on_duty && <Tag tone="ok" className="shrink-0">Best match</Tag>}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{t.on_duty ? 'On duty' : 'Off duty'}{t.phone ? ` · ${t.phone}` : ''}</p>
                      </div>
                      <Button size="sm" variant={t.on_duty ? 'primary' : 'secondary'} disabled={busy}
                        onClick={() => dispatchTo(t.id)} aria-label={`Dispatch ${t.full_name}`}>
                        Dispatch
                      </Button>
                    </Row>
                  ))}
                </Rows>
              )}
            </Card>
          ) : assignedTanod && (
            <Card>
              <CardHead title="Responder" />
              <div className="flex items-center gap-3 border-t border-line px-[18px] py-3">
                <Avatar name={assignedTanod.full_name} src={assignedTanod.avatar_url} size="sm" tone={assignedTanod.on_duty ? 'ok' : 'brand'} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink">{assignedTanod.full_name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {assignedTanod.on_duty ? 'On duty' : 'Off duty'}
                    {incident.assignment_method === 'auto' && ' · auto-assigned'}
                    {incident.assignment_method === 'auto_offduty' && ' · fallback assignment'}
                    {incident.assignment_method === 'manual' && ' · dispatched by an official'}
                  </p>
                </div>
                {assignedTanod.phone && (
                  <Button asChild variant="secondary" size="sm">
                    <a href={`tel:${assignedTanod.phone.replace(/[^0-9+]/g, '')}`} aria-label={`Call ${assignedTanod.full_name}`}>
                      <Phone aria-hidden="true" />Call
                    </a>
                  </Button>
                )}
              </div>
            </Card>
          )}

          {incident.resolution_image_url && (
            <Card>
              <CardHead title="Resolution proof" />
              <PhotoCard src={incident.resolution_image_url} label="Photo from the responder"
                onOpen={(url) => setLightbox({ src: url, alt: 'Resolution photo' })} />
            </Card>
          )}
        </div>
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[rgba(10,9,30,0.82)] p-4"
          onClick={() => setLightbox(null)} role="dialog" aria-modal="true" aria-label={lightbox.alt}>
          <button type="button" onClick={() => setLightbox(null)} aria-label="Close"
            className="absolute top-4 right-4 flex size-10 items-center justify-center rounded-[10px] bg-[var(--onband)] text-white">
            <X size={18} />
          </button>
          <img src={lightbox.src} alt={lightbox.alt} onClick={e => e.stopPropagation()}
            className="max-h-[85dvh] max-w-full rounded-[14px] object-contain" />
        </div>
      )}
    </PageShell>
  )
}

/* ------------------------------- bits ------------------------------- */

const PRIORITY_TONE = { Critical: 'danger', High: 'warn', Medium: 'quiet', Low: 'quiet' }
const TONE_COLOR = { warn: 'var(--danger)', override: 'var(--warn)', good: 'var(--ok)' }

/** "7:42 PM" today, "Nov 16" before that. */
function clock(at) {
  const d = new Date(at)
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

// `src` is the stored path; the bucket is private, so sign it here and hand
// the signed URL to the lightbox.
function PhotoCard({ src, label, onOpen }) {
  const signed = useSignedIncidentUrl(src)
  if (!signed) return null
  return (
    <button type="button" onClick={() => onOpen(signed)} aria-label={`View ${label.toLowerCase()}`}
      className="relative block w-full border-b border-line outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-strong">
      <img src={signed} alt={label} className="h-56 w-full object-cover" loading="lazy" />
      <span className="absolute bottom-3 left-3 rounded-md bg-surface px-2 py-1 text-xs font-bold text-body">{label}</span>
    </button>
  )
}

function TimelinePhoto({ stored, onOpen }) {
  const signed = useSignedIncidentUrl(stored)
  if (!signed) return null
  return (
    <button type="button" onClick={() => onOpen(signed)}
      aria-label="View resolution photo"
      className="mt-2 block size-16 overflow-hidden rounded-lg border border-line">
      <img loading="lazy" decoding="async" src={signed} alt="" className="size-full object-cover" />
    </button>
  )
}
