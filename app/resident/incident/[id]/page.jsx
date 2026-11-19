'use client'
import { IncidentDetailSkeleton } from '@/components/Skeletons'
import { useEffect, useLayoutEffect, useRef, useState, useMemo } from 'react'
import { settleEntrances } from '@/components/SectionContent'
import { useRouter, useParams } from 'next/navigation'
import { loginHref } from '@/lib/loginRedirect'
import { goBack } from '@/lib/goBack'
import { createClient } from '@/lib/supabase'
import dynamic from 'next/dynamic'
import { Star, X, Phone } from 'lucide-react'
import toast from 'react-hot-toast'
import { timeAgo, fullDate } from '@/lib/timeAgo'
import { LEGAL_BASIS, CATEGORY_CONFIG } from '@/lib/legalBasis'
import { useSignedIncidentUrl } from '@/lib/useSignedUrl'
import PageShell from '@/components/crafted/PageShell'
import { reportState } from '@/components/resident/ResidentSections'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Avatar } from '@/components/ui/avatar'
import { Tag } from '@/components/ui/tag'
import { Notice } from '@/components/ui/notice'
import { Textarea } from '@/components/ui/textarea'
import { SectionLabel, Muted } from '@/components/ui/text'
import { useBarangayAvailability } from '@/lib/useBarangayAvailability'
import { EmergencyContacts } from '@/components/ResponderAvailability'
import { subscribeWhenSignedIn } from '@/lib/realtime'

const MiniMap = dynamic(() => import('@/components/MiniMap'), { ssr: false })

/**
 * Incident detail — resident view.
 *
 * The official page answers "what happened here?" for someone working a
 * queue. This page answers a different question for a different person:
 * "is anyone coming, and what should I do meanwhile?" — possibly asked by
 * someone standing next to the incident right now.
 *
 * So the language is plain rather than procedural ("A tanod is on the way",
 * not "auto-assigned via dispatch rule"), emergency numbers stay one tap
 * away for as long as the report is unresolved, and the status of the
 * response is the first thing on the page rather than a field inside it.
 */

// Icons and colours come from the same table that holds each
// category's governing law — see lib/legalBasis.js.
const CATEGORY = CATEGORY_CONFIG

// The incident-images bucket is private, so both of these sign their own
// URL and hand the signed one to the lightbox. Rendering nothing when the
// URL cannot be signed is deliberate: a photo you may not see should look
// like no photo rather than a broken image.
function IncidentPhoto({ stored, onOpen }) {
  const signed = useSignedIncidentUrl(stored)
  if (!signed) return null
  return (
    <button onClick={() => onOpen(signed)} aria-label="View your photo"
      className="mt-3 block w-full overflow-hidden rounded-[10px] border border-line outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong">
      <img loading="lazy" decoding="async" src={signed} alt="Your photo" className="w-full max-h-56 object-cover" />
    </button>
  )
}

function TimelinePhoto({ stored, onOpen }) {
  const signed = useSignedIncidentUrl(stored)
  if (!signed) return null
  return (
    <button onClick={() => onOpen(signed)} aria-label="View resolution photo"
      className="mt-2 block size-16 overflow-hidden rounded-[10px] border border-line outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong">
      <img loading="lazy" decoding="async" src={signed} alt="" className="w-full h-full object-cover" />
    </button>
  )
}

const PRIORITY = {
  Critical: { color: '#dc2626', bg: '#fef2f2', icon: '🔴', word: 'Emergency' },
  High: { color: '#f97316', bg: '#fff7ed', icon: '🟠', word: 'Urgent' },
  Medium: { color: '#3b82f6', bg: '#eff6ff', icon: '🔵', word: 'Standard' },
  Low: { color: '#22c55e', bg: '#f0fdf4', icon: '🟢', word: 'Non-urgent' },
}

/** Plain-language status. This is the answer the resident came for. */
function statusPanel(inc, responder) {
  if (inc.status === 'resolved') {
    return {
      tone: 'ok',
      title: 'This has been resolved.',
      body: inc.resolution_notes
        ? 'The barangay marked your report resolved and left a note below.'
        : 'The barangay marked your report resolved.',
    }
  }
  if (inc.assigned_to && inc.assignment_method === 'auto_offduty') {
    return {
      tone: 'warn',
      title: 'Assigned, but no tanod is on shift.',
      body: `Your report went to ${responder?.full_name || 'a tanod'}, who may not be working right now. If this is urgent, call one of the numbers below.`,
    }
  }
  if (inc.assigned_to) {
    return {
      tone: inc.acknowledged_at || inc.arrived_at ? 'ok' : 'info',
      title: inc.arrived_at ? 'The tanod is there.' : inc.acknowledged_at ? 'A tanod is on the way.' : 'A tanod has been assigned.',
      body: `${responder?.full_name || 'A tanod'} can see your report.`,
    }
  }
  return {
    tone: 'danger',
    title: 'No one has been assigned yet.',
    body: 'Your report is recorded and officials will see it. If anyone is in danger, call for help now.',
  }
}

export default function ResidentIncidentDetail() {
  const router = useRouter()
  const params = useParams()
  const supabase = useMemo(() => createClient(), [])

  const [incident, setIncident] = useState(null)
  const [responder, setResponder] = useState(null)
  const [barangayId, setBarangayId] = useState(null)
  const [barangayPhone, setBarangayPhone] = useState(null)
  const [loading, setLoading] = useState(true)
  const mainRef = useRef(null)
  const [denied, setDenied] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const [rating, setRating] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [savingRating, setSavingRating] = useState(false)

  const availability = useBarangayAvailability(barangayId)

  // Fetch on open and whenever the incident id changes. `cancelled`
  // drops answers for an incident the user has already navigated away from.
  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (cancelled) return
      if (authError || !user) { router.replace(loginHref()); return }

      // See the note in app/resident/report/page.jsx: if the embedded
      // barangays(phone) column is missing, the whole select fails and
      // barangay_id comes back null too.
      const { data: prof, error: profError } = await supabase
        .from('profiles').select('barangay_id, barangays(phone)').eq('id', user.id).single()
      if (cancelled) return
      if (profError) console.error('Could not load barangay context:', profError)
      setBarangayId(prof?.barangay_id ?? null)
      setBarangayPhone(prof?.barangays?.phone ?? null)

      const { data, error } = await supabase
        .from('incidents').select('*').eq('id', params.id).single()
      if (cancelled) return

      // A resident may only open their own report. RLS enforces this too —
      // this check is for a clear message rather than an empty screen.
      if (error || !data || data.reported_by !== user.id) {
        setDenied(true); setLoading(false); return
      }
      setIncident(data)
      setRating(data.rating || 0)
      setFeedback(data.rating_feedback || '')

      if (data.assigned_to) {
        const { data: t, error: responderError } = await supabase
          .from('profiles').select('full_name, phone, on_duty').eq('id', data.assigned_to).single()
        if (cancelled) return
        // The report still renders without the responder's details.
        if (responderError) console.error('Could not load the assigned tanod:', responderError)
        setResponder(t)
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [supabase, router, params.id])

  // Live updates — the resident sees a tanod get assigned without refreshing
  useEffect(() => {
    if (!params.id) return
    const ch = supabase.channel(`res-incident-${params.id}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'incidents', filter: `id=eq.${params.id}` },
        payload => setIncident(prev => ({ ...prev, ...payload.new })))
    const leaveCh = subscribeWhenSignedIn(supabase, ch)
    return () => { leaveCh() }
  }, [params.id, supabase])

  const basis = incident ? LEGAL_BASIS[incident.category] : null
  const cat = incident ? (CATEGORY[incident.category] || CATEGORY.Other) : CATEGORY.Other
  const pri = incident ? (PRIORITY[incident.priority] || PRIORITY.Medium) : PRIORITY.Medium
  const panel = incident ? statusPanel(incident, responder) : null

  async function submitRating() {
    if (!rating) return
    setSavingRating(true)
    const now = new Date().toISOString()
    const { error } = await supabase.from('incidents')
      .update({ rating, rating_feedback: feedback.trim() || null, rated_at: now })
      .eq('id', incident.id)
    setSavingRating(false)
    if (error) { toast.error('Could not save your rating. Please try again.'); return }
    setIncident(p => ({ ...p, rating, rating_feedback: feedback.trim() || null, rated_at: now }))
    toast.success('Thank you for the feedback!')
  }

  // The report replaces its skeleton in place: finish the timeline's own
  // entrance before the first paint (items added later still animate).
  useLayoutEffect(() => { if (!loading) settleEntrances(mainRef.current) }, [loading])

  if (loading) return <IncidentDetailSkeleton variant="resident" />

  if (denied) {
    return (
      <PageShell title="Report not found" onBack={() => router.replace('/resident')} backLabel="Back to my reports">
        <Card lift className="px-[18px] py-5">
          <Muted>This report doesn’t exist, or it isn’t one of yours.</Muted>
          <Button className="mt-3" onClick={() => router.replace('/resident?section=incidents')}>Back to my reports</Button>
        </Card>
      </PageShell>
    )
  }

  const canRate = incident.status === 'resolved' && !incident.rated_at
  const hasMap = Number.isFinite(incident.latitude)
  const step = reportState(incident).step
  const steps = [
    { title: 'Received', at: incident.created_at, body: 'Your report reached the barangay' },
    { title: 'Assigned', at: incident.auto_assigned_at, body: responder?.full_name ? `${responder.full_name} is responding` : 'A tanod is assigned to it' },
    { title: incident.arrived_at ? 'On scene' : 'On the way', at: incident.arrived_at || incident.acknowledged_at, body: incident.arrived_at ? 'The tanod is there' : 'The tanod saw it and is heading over' },
    { title: 'Resolved', at: incident.resolved_at, body: incident.resolution_notes || 'You can rate the response here', photo: incident.resolution_image_url },
  ]

  return (
    <PageShell
      title={incident.title}
      sub={`${cat.label || incident.category} · reported ${timeAgo(incident.created_at)}`}
      onBack={() => goBack(router, '/resident?section=incidents')}
      bandContent={hasMap ? (
        <Card lift>
          <MiniMap bare lat={incident.latitude} lng={incident.longitude} height="clamp(180px, 26dvh, 300px)" label="your report" />
        </Card>
      ) : null}>
      <div ref={mainRef} className="contents">

        {/* The answer they came for: plain words on who is coming */}
        <Notice tone={panel.tone} title={panel.title} role="status">
          {panel.body}
        </Notice>

        {/* Emergency numbers stay reachable for as long as it's unresolved */}
        {incident.status !== 'resolved' && (
          <EmergencyContacts category={incident.category} availability={availability} barangayPhone={barangayPhone} />
        )}

        {/* Progress */}
        <Card lift={!hasMap} className="px-[18px] py-4">
          <ol aria-label="Progress">
            {steps.map((s, i) => {
              const reached = i < step
              const last = i === steps.length - 1
              return (
                <li key={s.title} className="relative flex gap-3 pb-4 last:pb-0">
                  {!last && <span aria-hidden="true" className={`absolute left-[5px] top-4 bottom-0 w-0.5 ${i + 1 < step ? 'bg-ok' : 'bg-line'}`} />}
                  <span aria-hidden="true" className={`relative mt-1.5 size-3 shrink-0 rounded-full ${reached ? 'bg-ok' : 'border-2 border-line-strong bg-surface'}`} />
                  <div className="min-w-0">
                    <p className={`text-[15px] font-extrabold ${reached ? 'text-ink' : 'text-muted-foreground'}`}>
                      {s.title}
                      {reached && s.at && <time className="ml-1.5 text-sm font-normal text-muted-foreground" dateTime={s.at} title={fullDate(s.at)}>{timeAgo(s.at)}</time>}
                      {!reached && <span className="sr-only"> (not yet)</span>}
                    </p>
                    <p className="text-[13px] text-muted-foreground">{s.body}</p>
                    {reached && <TimelinePhoto stored={s.photo} onOpen={(url) => setLightbox({ src: url, alt: 'Resolution photo' })} />}
                  </div>
                </li>
              )
            })}
          </ol>
        </Card>

        {/* Who is responding */}
        {responder && (
          <Card className="flex items-center gap-3 px-[18px] py-3.5">
            <Avatar name={responder.full_name} tone={responder.on_duty ? 'ok' : 'quiet'} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-extrabold text-ink">{responder.full_name}</p>
              <p className="text-xs text-muted-foreground">Barangay tanod · {responder.on_duty ? 'on duty' : 'off duty'}</p>
            </div>
            {responder.phone && incident.status !== 'resolved' && (
              <IconButton kind="plain" label={`Call ${responder.full_name?.split(' ')[0] || 'the tanod'}`}
                onClick={() => { window.location.href = `tel:${responder.phone.replace(/[^0-9+]/g, '')}` }}>
                <Phone size={18} strokeWidth={1.9} />
              </IconButton>
            )}
          </Card>
        )}

        {/* What they reported */}
        <Card className="px-[18px] py-4">
          <SectionLabel as="h2">Your report</SectionLabel>
          <p className="text-[15px] leading-[1.55] text-ink whitespace-pre-wrap">{incident.description}</p>
          <IncidentPhoto stored={incident.image_url} onOpen={(url) => setLightbox({ src: url, alt: 'Your photo' })} />
          <p className="mt-2 text-xs text-muted-foreground">
            {[cat.label || incident.category, incident.location, incident.image_url ? '1 photo' : null].filter(Boolean).join(' · ')}
          </p>
        </Card>

        {/* Why it was classified this way — residents can't set priority,
            so they deserve to see the reasoning rather than just the label */}
        {basis?.law && (
          <Card className="px-[18px] py-4">
            <div className="flex items-center gap-2">
              <SectionLabel as="h2" className="mb-0 flex-1">Why it’s {pri.word.toLowerCase()}</SectionLabel>
              <Tag tone={incident.priority === 'Critical' ? 'danger' : incident.priority === 'High' ? 'warn' : 'quiet'}>{pri.word}</Tag>
            </div>
            <p className="mt-2 text-[13px] leading-[1.55] text-body">
              <strong className="text-brand-strong">{basis.law}{basis.sections ? `, ${basis.sections}` : ''}</strong> · {basis.lawTitle}. {basis.reason}
            </p>
            {basis.source && (
              <a href={basis.source} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block text-[13px] font-bold text-brand-strong hover:text-brand-deep">Read the law</a>
            )}
          </Card>
        )}

        {/* Rating — only once, only after resolution */}
        {canRate && (
          <Card lift className="px-[18px] py-4">
            <h2 className="text-[15px] font-extrabold text-ink">How was the response?</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Your rating helps the barangay improve. Officials can see it.</p>
            <div className="mt-3 flex items-center gap-1.5" role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map(s => (
                <button key={s} onClick={() => setRating(s)} aria-label={`${s} star${s === 1 ? '' : 's'}`} aria-checked={rating === s} role="radio"
                  className={`flex size-11 items-center justify-center rounded-[10px] border transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong ${s <= rating ? 'border-[color-mix(in_srgb,var(--warn)_35%,var(--line))] bg-warn-soft' : 'border-line bg-surface'}`}>
                  <Star size={20} strokeWidth={1.9} fill={s <= rating ? 'var(--warn)' : 'none'} color={s <= rating ? 'var(--warn)' : 'var(--line-strong)'} />
                </button>
              ))}
            </div>
            <Textarea className="mt-3" value={feedback} onChange={e => setFeedback(e.target.value)} rows={3} maxLength={300}
              aria-label="Anything you'd like the barangay to know (optional)" placeholder="Anything you’d like the barangay to know? (optional)" />
            <Button full className="mt-3" onClick={submitRating} disabled={!rating || savingRating} aria-busy={savingRating || undefined}>
              {savingRating ? 'Sending…' : 'Send rating'}
            </Button>
          </Card>
        )}

        {incident.rated_at && (
          <Card className="flex items-center gap-3 px-[18px] py-3">
            <span className="flex gap-0.5" role="img" aria-label={`${incident.rating} out of 5 stars`}>
              {[1, 2, 3, 4, 5].map(s => (
                <Star key={s} size={14} fill={s <= incident.rating ? 'var(--warn)' : 'none'} color={s <= incident.rating ? 'var(--warn)' : 'var(--line-strong)'} aria-hidden="true" />
              ))}
            </span>
            <p className="text-xs text-muted-foreground">Thanks. You rated this {timeAgo(incident.rated_at)}{incident.rating_feedback ? `: “${incident.rating_feedback}”` : '.'}</p>
          </Card>
        )}
      </div>

      {lightbox && (
        <div className="fixed inset-0 flex items-center justify-center bg-[rgba(10,8,40,0.85)] p-4"
          style={{ zIndex: 9999 }} onClick={() => setLightbox(null)} role="dialog" aria-modal="true">
          <IconButton kind="onband" label="Close" onClick={() => setLightbox(null)} className="absolute top-4 right-4" style={{ zIndex: 10000 }}>
            <X size={18} strokeWidth={1.9} />
          </IconButton>
          <img src={lightbox.src} alt={lightbox.alt} onClick={e => e.stopPropagation()}
            style={{ maxWidth: '100%', maxHeight: '85dvh', borderRadius: 14, objectFit: 'contain' }} />
        </div>
      )}
    </PageShell>
  )
}
