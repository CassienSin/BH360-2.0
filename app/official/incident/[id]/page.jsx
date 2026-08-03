'use client'
import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import dynamic from 'next/dynamic'
import {
  ArrowLeft, MapPin, Phone, Clock, Shield, Scale, ShieldAlert, Check, Send,
  Pencil, Star, User, Loader2, X, Navigation, FileText, Bell, AlertTriangle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { timeAgo, fullDate } from '@/lib/timeAgo'
import { LEGAL_BASIS, getPriority } from '@/lib/legalBasis'
import { computeStanding, responseWindowLabel } from '@/lib/triage'

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

const CATEGORY = {
  Noise: { icon: '🔊', color: '#f97316' }, Theft: { icon: '🚨', color: '#ef4444' },
  Violence: { icon: '⚠️', color: '#dc2626' }, Fire: { icon: '🔥', color: '#ea580c' },
  Flood: { icon: '🌊', color: '#3b82f6' }, Infrastructure: { icon: '🛠️', color: '#8b5cf6' },
  Animals: { icon: '🐕', color: '#a16207' }, Medical: { icon: '🚑', color: '#dc2626' },
  Traffic: { icon: '🚦', color: '#0891b2' }, Vandalism: { icon: '🎨', color: '#7c3aed' },
  Drugs: { icon: '💊', color: '#be185d' }, Other: { icon: '📝', color: '#6b7280' },
}

const PRIORITY = {
  Critical: { color: '#dc2626', bg: '#fef2f2', icon: '🔴' },
  High: { color: '#f97316', bg: '#fff7ed', icon: '🟠' },
  Medium: { color: '#3b82f6', bg: '#eff6ff', icon: '🔵' },
  Low: { color: '#22c55e', bg: '#f0fdf4', icon: '🟢' },
}

const STATUS = {
  pending: { label: 'Awaiting response', color: '#c2410c', bg: '#fff7ed' },
  assigned: { label: 'Tanod dispatched', color: '#1d4ed8', bg: '#eff6ff' },
  resolved: { label: 'Resolved', color: '#15803d', bg: '#f0fdf4' },
}

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
      body: inc.legal_basis || `${basis?.law} — ${basis?.lawTitle}`,
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

const TONE = {
  neutral: { dot: '#5B54E8', bg: '#f0effe' },
  legal: { dot: '#7C75F0', bg: '#f0effe' },
  warn: { dot: '#dc2626', bg: '#fef2f2' },
  override: { dot: '#d97706', bg: '#fffbeb' },
  good: { dot: '#16a34a', bg: '#f0fdf4' },
}

export default function IncidentDetail() {
  const router = useRouter()
  const params = useParams()
  const supabase = useMemo(() => createClient(), [])

  const [incident, setIncident] = useState(null)
  const [people, setPeople] = useState({})
  const [tanods, setTanods] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) { router.replace('/login'); return }

    const { data: prof } = await supabase
      .from('profiles').select('role, barangay_id').eq('id', user.id).single()
    if (prof?.role !== 'official') { router.replace('/login'); return }

    const { data, error } = await supabase
      .from('incidents')
      .select('*, profiles!incidents_reported_by_fkey(full_name, phone)')
      .eq('id', params.id)
      .single()

    if (error || !data) { setNotFound(true); setLoading(false); return }
    setIncident(data)

    // Everyone who appears in the timeline, resolved in one query
    const ids = [data.assigned_to, data.acknowledged_by, data.priority_overridden_by].filter(Boolean)
    if (ids.length) {
      const { data: rows } = await supabase
        .from('profiles').select('id, full_name, phone, on_duty, avatar_url').in('id', ids)
      const map = {}
      for (const r of rows || []) map[r.id] = r
      setPeople(map)
    }

    const { data: tanodRows } = await supabase
      .from('profiles').select('id, full_name, phone, on_duty')
      .eq('barangay_id', prof.barangay_id).eq('role', 'tanod').is('deactivated_at', null)
    setTanods(tanodRows || [])

    setLoading(false)
  }, [supabase, router, params.id])

  useEffect(() => { load() }, [load])

  // Live updates while the page is open
  useEffect(() => {
    if (!params.id) return
    const ch = supabase.channel(`incident-${params.id}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'incidents', filter: `id=eq.${params.id}` },
        payload => setIncident(prev => ({ ...prev, ...payload.new })))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [params.id, supabase])

  const timeline = useMemo(() => buildTimeline(incident, people), [incident, people])
  const basis = incident ? LEGAL_BASIS[incident.category] : null
  const standing = incident ? computeStanding(incident) : null
  const cat = incident ? (CATEGORY[incident.category] || CATEGORY.Other) : CATEGORY.Other
  const pri = incident ? (PRIORITY[incident.priority] || PRIORITY.Medium) : PRIORITY.Medium
  const st = incident ? (STATUS[incident.status] || STATUS.pending) : STATUS.pending

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
    if (!data?.length) { toast.error('Already assigned by someone else.'); load(); return }
    setIncident(p => ({ ...p, assigned_to: tanodId, status: 'assigned' }))
    toast.success('Tanod dispatched')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-brand flex items-center justify-center">
        <Loader2 size={30} className="animate-spin text-white" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-brand flex items-center justify-center p-6">
        <div className="white-card p-8 text-center max-w-sm">
          <AlertTriangle size={28} className="mx-auto mb-3 text-orange-400" />
          <h1 className="text-lg font-bold text-gray-800">Incident not found</h1>
          <p className="text-sm text-gray-400 mt-1">
            It may have been deleted, or the link is wrong.
          </p>
          <button onClick={() => router.replace('/official')}
            className="btn-primary mt-5 px-5 py-2.5 rounded-2xl text-white text-sm font-bold">
            Back to dashboard
          </button>
        </div>
      </div>
    )
  }

  const assignedTanod = incident.assigned_to ? people[incident.assigned_to] : null

  return (
    <div className="min-h-screen bg-brand">
      <style>{`
        .idt-line::before {
          content: ''; position: absolute; left: 15px; top: 30px; bottom: -14px;
          width: 2px; background: #e8e3ff;
        }
        .idt-item:last-child .idt-line::before { display: none; }
        .idt-press { transition: transform 120ms ease; }
        .idt-press:active { transform: scale(0.97); }
        @media (prefers-reduced-motion: no-preference) {
          @keyframes idtIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
          .idt-item { animation: idtIn 340ms cubic-bezier(0.22,1,0.36,1) both; }
        }
      `}</style>

      {/* Header */}
      <header className="bg-white sticky top-0 z-30 px-4 sm:px-6 py-3 flex items-center gap-3"
        style={{ boxShadow: '0 2px 12px rgba(91,84,232,0.08)', borderBottom: '1px solid #f0effe' }}>
        <button onClick={() => router.back()} aria-label="Go back"
          className="idt-press w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100 flex-shrink-0">
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${cat.color}18`, fontSize: 17 }}>
          {cat.icon}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-bold text-gray-800 truncate">{incident.title}</h1>
          <p className="text-[11px] text-gray-400">
            {incident.category} · reported {timeAgo(incident.created_at)}
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
          <Pill bg={pri.bg} color={pri.color}>{pri.icon} {incident.priority}</Pill>
          <Pill bg={st.bg} color={st.color}>{st.label}</Pill>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5 pb-28 lg:pb-8">
        {/* Mobile pills */}
        <div className="flex sm:hidden items-center gap-1.5 mb-3">
          <Pill bg={pri.bg} color={pri.color}>{pri.icon} {incident.priority}</Pill>
          <Pill bg={st.bg} color={st.color}>{st.label}</Pill>
          {standing?.aged && incident.status !== 'resolved' && (
            <Pill bg="#fffbeb" color="#b45309"><Clock size={9} /> {standing.label}</Pill>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">

          {/* ---------------- LEFT: the incident itself ---------------- */}
          <div className="space-y-4">

            {/* Overdue banner */}
            {standing?.aged && incident.status === 'pending' && (
              <div className="rounded-2xl px-4 py-3 flex items-start gap-2.5"
                style={{ background: '#fffbeb', border: '1px solid #fef3c7' }}>
                <Clock size={15} className="flex-shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <p className="text-xs font-black text-amber-800">{standing.label}</p>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    {incident.priority} incidents target a response within {responseWindowLabel(incident.priority)}.
                    This one has been waiting {timeAgo(incident.created_at).replace(' ago', '')}.
                  </p>
                </div>
              </div>
            )}

            <div className="white-card p-5">
              <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">
                What was reported
              </p>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {incident.description}
              </p>

              <div className="flex flex-wrap gap-2 mt-4 pt-4" style={{ borderTop: '1px solid #f7f6ff' }}>
                <Meta icon={User} label="Reporter" value={incident.profiles?.full_name || 'Unknown'} />
                <Meta icon={Clock} label="Reported" value={fullDate(incident.created_at)} />
              </div>

              {incident.profiles?.phone && (
                <a href={`tel:${incident.profiles.phone.replace(/[^0-9+]/g, '')}`}
                  className="idt-press mt-3 flex items-center justify-center gap-2 h-10 rounded-2xl text-xs font-bold"
                  style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #dcfce7' }}>
                  <Phone size={13} /> Call {incident.profiles.full_name?.split(' ')[0] || 'reporter'}
                </a>
              )}
            </div>

            {/* Photos */}
            {(incident.image_url || incident.resolution_image_url) && (
              <div className="white-card p-5">
                <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-3">Photos</p>
                <div className="grid grid-cols-2 gap-3">
                  {incident.image_url && (
                    <PhotoCard src={incident.image_url} label="Reported by resident"
                      onOpen={() => setLightbox({ src: incident.image_url, alt: 'Reported photo' })} />
                  )}
                  {incident.resolution_image_url && (
                    <PhotoCard src={incident.resolution_image_url} label="Resolution proof"
                      onOpen={() => setLightbox({ src: incident.resolution_image_url, alt: 'Resolution photo' })} />
                  )}
                </div>
              </div>
            )}

            {/* Location */}
            <div className="white-card p-5">
              <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">Location</p>
              <p className="text-sm text-gray-700 flex items-start gap-1.5 mb-3">
                <MapPin size={14} className="flex-shrink-0 mt-0.5" style={{ color: cat.color }} />
                {incident.location || 'No location description given'}
              </p>
              {Number.isFinite(incident.latitude) ? (
                <>
                  <MiniMap lat={incident.latitude} lng={incident.longitude} height={200} />
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${incident.latitude},${incident.longitude}`}
                    target="_blank" rel="noopener noreferrer"
                    className="idt-press mt-3 flex items-center justify-center gap-2 h-10 rounded-2xl text-xs font-bold"
                    style={{ background: '#fafaff', color: '#5B54E8', border: '1px solid #e8e3ff' }}>
                    <Navigation size={13} /> Open directions
                  </a>
                </>
              ) : (
                <p className="text-xs text-gray-400 px-3 py-6 rounded-2xl text-center"
                  style={{ background: '#fafaff', border: '1px dashed #e8e3ff' }}>
                  No map pin — this was reported without coordinates.
                </p>
              )}
            </div>
          </div>

          {/* ---------------- RIGHT: audit trail + actions ---------------- */}
          <div className="space-y-4">

            {/* Legal basis */}
            {basis?.law && (
              <div className="white-card p-4">
                <div className="flex items-start gap-2">
                  <Scale size={14} className="flex-shrink-0 mt-0.5" style={{ color: '#5B54E8' }} />
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: '#5B54E8' }}>
                      Legal basis
                    </p>
                    <p className="text-xs font-bold text-gray-800 mt-1">{basis.law}</p>
                    <p className="text-[11px] text-gray-500">{basis.lawTitle}</p>
                    <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">{basis.reason}</p>
                  </div>
                </div>

                {basis.responseMode === 'refer_to_agency' && basis.agency && (
                  <div className="mt-3 px-3 py-2 rounded-xl flex items-start gap-2"
                    style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
                    <ShieldAlert size={12} className="flex-shrink-0 mt-0.5 text-orange-600" />
                    <p className="text-[11px] text-orange-800 leading-relaxed">
                      <strong>{basis.agency}</strong> has authority here. Tanods document and assist only.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Assigned responder */}
            {assignedTanod && (
              <div className="white-card p-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">
                  Assigned responder
                </p>
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-xs flex-shrink-0"
                    style={{ background: assignedTanod.on_duty ? '#22c55e' : '#9ca3af' }}>
                    {assignedTanod.full_name?.[0]?.toUpperCase() || 'T'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-gray-800 truncate">{assignedTanod.full_name}</p>
                    <p className="text-[10px] text-gray-400">
                      {assignedTanod.on_duty ? 'On duty' : 'Off duty'}
                      {incident.assignment_method === 'auto' && ' · auto-assigned'}
                      {incident.assignment_method === 'auto_offduty' && ' · fallback assignment'}
                      {incident.assignment_method === 'manual' && ' · dispatched by an official'}
                    </p>
                  </div>
                  {assignedTanod.phone && (
                    <a href={`tel:${assignedTanod.phone.replace(/[^0-9+]/g, '')}`}
                      aria-label={`Call ${assignedTanod.full_name}`}
                      className="idt-press w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: '#eff6ff' }}>
                      <Phone size={13} className="text-blue-500" />
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* ===== THE TIMELINE — the reason this page exists ===== */}
            <div className="white-card p-5">
              <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-4">
                What happened, in order
              </p>
              <div className="space-y-4">
                {timeline.map((e, i) => {
                  const tone = TONE[e.tone] || TONE.neutral
                  const Icon = e.icon
                  return (
                    <div key={i} className="idt-item relative flex gap-3"
                      style={{ animationDelay: `${Math.min(i, 8) * 55}ms` }}>
                      <div className="idt-line relative flex-shrink-0">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center relative z-10"
                          style={{ background: tone.bg }}>
                          <Icon size={14} style={{ color: tone.dot }} />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1 pb-1">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <p className="text-xs font-black text-gray-800">{e.title}</p>
                          {e.at && (
                            <time className="text-[10px] text-gray-400 flex-shrink-0" title={fullDate(e.at)}>
                              {timeAgo(e.at)}
                            </time>
                          )}
                        </div>
                        {e.body && (
                          <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{e.body}</p>
                        )}
                        {e.quote && (
                          <p className="text-[11px] italic mt-1.5 px-2.5 py-1.5 rounded-lg"
                            style={{ background: tone.bg, color: tone.dot }}>
                            "{e.quote}"
                          </p>
                        )}
                        {e.note && (
                          <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">{e.note}</p>
                        )}
                        {e.photo && (
                          <button onClick={() => setLightbox({ src: e.photo, alt: 'Resolution photo' })}
                            className="idt-press mt-2 w-16 h-16 rounded-lg overflow-hidden block"
                            style={{ border: '1px solid #f0effe' }}>
                            <img src={e.photo} alt="" className="w-full h-full object-cover" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* An unfinished incident says so, rather than just ending */}
                {incident.status !== 'resolved' && (
                  <div className="relative flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center"
                      style={{ background: '#fafaff', border: '1px dashed #e8e3ff' }}>
                      <Clock size={13} className="text-gray-300" />
                    </div>
                    <p className="text-[11px] text-gray-400 self-center">
                      {incident.status === 'pending' ? 'Waiting for a responder…' : 'Response in progress…'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Action bar — sticky on mobile, where the buttons are hardest to reach */}
      {incident.status !== 'resolved' && (
        <div className="fixed bottom-0 left-0 right-0 lg:sticky lg:bottom-4 z-30 px-4 py-3 lg:max-w-5xl lg:mx-auto"
          style={{
            background: 'rgba(255,255,255,0.96)',
            backdropFilter: 'blur(10px)',
            borderTop: '1px solid #f0effe',
            paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
          }}>
          <div className="flex gap-2 max-w-5xl mx-auto">
            {incident.status === 'pending' && (
              <TanodSelect tanods={tanods} onPick={dispatchTo} busy={busy} />
            )}
            <button onClick={resolve} disabled={busy}
              className="idt-press flex-1 h-11 rounded-2xl text-xs font-black text-white flex items-center justify-center gap-1.5 disabled:opacity-50"
              style={{ background: '#22c55e', boxShadow: '0 6px 20px rgba(34,197,94,0.3)' }}>
              <Check size={14} /> Mark resolved
            </button>
          </div>
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 flex items-center justify-center p-4"
          style={{
            background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(6px)',
            zIndex: 9999,                                   
          }}
          onClick={() => setLightbox(null)} role="dialog" aria-modal="true">
          <button onClick={() => setLightbox(null)} aria-label="Close"
            className="absolute top-4 right-4 w-10 h-10 rounded-2xl flex items-center justify-center text-white"
            style={{ background: 'rgba(255,255,255,0.15)', zIndex: 10000 }}>
            <X size={18} />
          </button>
          <img src={lightbox.src} alt={lightbox.alt} onClick={e => e.stopPropagation()}
            style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: 16, objectFit: 'contain' }} />
        </div>
      )}
    </div>
  )
}

/* ------------------------------- bits ------------------------------- */

function Pill({ children, bg, color }) {
  return (
    <span className="px-2 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 flex-shrink-0"
      style={{ background: bg, color }}>
      {children}
    </span>
  )
}

function Meta({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl"
      style={{ background: '#fafaff', border: '1px solid #f0effe' }}>
      <Icon size={12} className="text-gray-400 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400 leading-none">{label}</p>
        <p className="text-[11px] font-semibold text-gray-700 truncate mt-0.5">{value}</p>
      </div>
    </div>
  )
}

function PhotoCard({ src, label, onOpen }) {
  return (
    <button onClick={onOpen} className="idt-press text-left rounded-2xl overflow-hidden w-full"
      style={{ border: '1px solid #f0effe' }}>
      <img src={src} alt={label} className="w-full h-32 object-cover" loading="lazy" />
      <p className="text-[10px] font-bold text-gray-500 px-2.5 py-1.5" style={{ background: '#fafaff' }}>
        {label}
      </p>
    </button>
  )
}

function TanodSelect({ tanods, onPick, busy }) {
  const [open, setOpen] = useState(false)
  const sorted = useMemo(
    () => [...tanods].sort((a, b) => (b.on_duty === true) - (a.on_duty === true) ||
      (a.full_name || '').localeCompare(b.full_name || '')),
    [tanods]
  )

  return (
    <>
      <button onClick={() => setOpen(true)} disabled={busy}
        className="idt-press flex-1 h-11 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 disabled:opacity-50"
        style={{ background: '#f0effe', color: '#5B54E8', border: '1px solid #e8e3ff' }}>
        <Send size={14} /> Dispatch tanod
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
          style={{ background: 'rgba(17,17,27,0.45)', backdropFilter: 'blur(6px)' }}
          onClick={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()}
            className="w-full sm:max-w-sm bg-white flex flex-col"
            style={{ borderRadius: '24px 24px 0 0', maxHeight: '80vh', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            <div className="px-4 py-3 flex items-center justify-between flex-shrink-0"
              style={{ borderBottom: '1px solid #f0effe' }}>
              <h3 className="text-sm font-bold text-gray-800">Dispatch a tanod</h3>
              <button onClick={() => setOpen(false)} aria-label="Close"
                className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100">
                <X size={16} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {sorted.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-gray-400">No tanods registered.</p>
              )}
              {sorted.map(t => (
                <button key={t.id} onClick={() => { onPick(t.id); setOpen(false) }}
                  className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50 active:bg-gray-100">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-xs flex-shrink-0"
                    style={{ background: t.on_duty ? '#22c55e' : '#9ca3af' }}>
                    {t.full_name?.[0]?.toUpperCase() || 'T'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">{t.full_name}</p>
                    <p className="text-[11px] text-gray-400">{t.phone || 'No phone on file'}</p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0"
                    style={{
                      background: t.on_duty ? '#f0fdf4' : '#f3f4f6',
                      color: t.on_duty ? '#16a34a' : '#9ca3af',
                    }}>
                    {t.on_duty ? 'On duty' : 'Off duty'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}