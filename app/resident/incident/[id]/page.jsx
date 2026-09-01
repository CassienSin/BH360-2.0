'use client'
import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import dynamic from 'next/dynamic'
import {
  ArrowLeft, MapPin, Clock, Shield, Scale, Star, Loader2, X, FileText,
  Check, AlertTriangle, Phone, ShieldOff, Send,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { timeAgo, fullDate } from '@/lib/timeAgo'
import { LEGAL_BASIS, CATEGORY_CONFIG } from '@/lib/legalBasis'
import { useSignedIncidentUrl } from '@/lib/useSignedUrl'
import { useBarangayAvailability } from '@/lib/useBarangayAvailability'
import { EmergencyContacts } from '@/components/ResponderAvailability'

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
      className="rid-press w-full rounded-2xl overflow-hidden block mb-4"
      style={{ border: '1px solid #f0effe' }}>
      <img src={signed} alt="Your photo" className="w-full max-h-56 object-cover" />
    </button>
  )
}

function TimelinePhoto({ stored, onOpen }) {
  const signed = useSignedIncidentUrl(stored)
  if (!signed) return null
  return (
    <button onClick={() => onOpen(signed)} aria-label="View resolution photo"
      className="rid-press mt-2 w-16 h-16 rounded-lg overflow-hidden block"
      style={{ border: '1px solid #f0effe' }}>
      <img src={signed} alt="" className="w-full h-full object-cover" />
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
      tone: { bg: '#f0fdf4', border: '#dcfce7', color: '#15803d' },
      Icon: Check,
      title: 'This has been resolved',
      body: inc.resolution_notes
        ? 'The barangay marked your report resolved and left a note below.'
        : 'The barangay marked your report resolved.',
    }
  }
  if (inc.assigned_to && inc.assignment_method === 'auto_offduty') {
    return {
      tone: { bg: '#fffbeb', border: '#fef3c7', color: '#b45309' },
      Icon: Clock,
      title: 'Assigned, but no tanod is on shift',
      body: `Your report went to ${responder?.full_name || 'a tanod'}, who may not be working right now. If this is urgent, please call one of the numbers below.`,
    }
  }
  if (inc.assigned_to) {
    return {
      tone: { bg: '#eff6ff', border: '#dbeafe', color: '#1d4ed8' },
      Icon: Shield,
      title: 'A tanod is on the way',
      body: `${responder?.full_name || 'A tanod'} has been assigned and can see your report.`,
    }
  }
  return {
    tone: { bg: '#fef2f2', border: '#fecaca', color: '#dc2626' },
    Icon: ShieldOff,
    title: 'No one has been assigned yet',
    body: 'Your report is recorded and officials will see it. If anyone is in danger, call for help now.',
  }
}

/* Timeline, in the resident's terms — no internal mechanics, no names of
   officials who adjusted classifications. Just what happened to their report. */
function buildTimeline(inc, responder) {
  if (!inc) return []
  const events = [{
    at: inc.created_at,
    icon: FileText,
    tone: { dot: '#5B54E8', bg: '#f0effe' },
    title: 'You reported this',
  }]

  const basis = LEGAL_BASIS[inc.category]
  if (basis?.law) {
    events.push({
      at: inc.created_at,
      icon: Scale,
      tone: { dot: '#7C75F0', bg: '#f0effe' },
      title: `Classified as ${PRIORITY[inc.priority]?.word || inc.priority}`,
      body: `Based on ${basis.law} — ${basis.lawTitle}.`,
    })
  }

  if (inc.assigned_to) {
    events.push({
      at: inc.auto_assigned_at,
      icon: Shield,
      tone: { dot: '#1d4ed8', bg: '#eff6ff' },
      title: 'A tanod was assigned',
      body: responder?.full_name ? `${responder.full_name} is responding.` : null,
    })
  }

  if (inc.resolved_at || inc.status === 'resolved') {
    events.push({
      at: inc.resolved_at,
      icon: Check,
      tone: { dot: '#16a34a', bg: '#f0fdf4' },
      title: 'Marked resolved',
      body: inc.resolution_notes,
      photo: inc.resolution_image_url,
    })
  }

  if (inc.rated_at || inc.rating) {
    events.push({
      at: inc.rated_at,
      icon: Star,
      tone: { dot: '#d97706', bg: '#fffbeb' },
      title: `You rated this ${inc.rating} out of 5`,
      quote: inc.rating_feedback,
    })
  }

  return events.sort((a, b) => {
    if (!a.at) return 1
    if (!b.at) return -1
    return new Date(a.at) - new Date(b.at)
  })
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
  const [denied, setDenied] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const [rating, setRating] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [savingRating, setSavingRating] = useState(false)

  const availability = useBarangayAvailability(barangayId)

  const load = useCallback(async () => {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) { router.replace('/login'); return }

    // See the note in app/resident/report/page.jsx: if the embedded
    // barangays(phone) column is missing, the whole select fails and
    // barangay_id comes back null too.
    const { data: prof, error: profError } = await supabase
      .from('profiles').select('barangay_id, barangays(phone)').eq('id', user.id).single()
    if (profError) console.error('Could not load barangay context:', profError)
    setBarangayId(prof?.barangay_id ?? null)
    setBarangayPhone(prof?.barangays?.phone ?? null)

    const { data, error } = await supabase
      .from('incidents').select('*').eq('id', params.id).single()

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
      // The report still renders without the responder's details.
      if (responderError) console.error('Could not load the assigned tanod:', responderError)
      setResponder(t)
    }
    setLoading(false)
  }, [supabase, router, params.id])

  useEffect(() => { load() }, [load])

  // Live updates — the resident sees a tanod get assigned without refreshing
  useEffect(() => {
    if (!params.id) return
    const ch = supabase.channel(`res-incident-${params.id}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'incidents', filter: `id=eq.${params.id}` },
        payload => setIncident(prev => ({ ...prev, ...payload.new })))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [params.id, supabase])

  const timeline = useMemo(() => buildTimeline(incident, responder), [incident, responder])
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

  if (loading) {
    return (
      <div className="min-h-screen bg-brand flex items-center justify-center">
        <Loader2 size={30} className="animate-spin text-white" />
      </div>
    )
  }

  if (denied) {
    return (
      <div className="min-h-screen bg-brand flex items-center justify-center p-6">
        <div className="white-card p-8 text-center max-w-sm">
          <AlertTriangle size={28} className="mx-auto mb-3 text-orange-400" />
          <h1 className="text-lg font-bold text-gray-800">Report not found</h1>
          <p className="text-sm text-gray-400 mt-1">
            This report doesn't exist, or it isn't one of yours.
          </p>
          <button onClick={() => router.replace('/resident')}
            className="btn-primary mt-5 px-5 py-2.5 rounded-2xl text-white text-sm font-bold">
            Back to my reports
          </button>
        </div>
      </div>
    )
  }

  const canRate = incident.status === 'resolved' && !incident.rated_at
  const { Icon: PanelIcon } = panel

  return (
    <div className="min-h-screen bg-brand">
      <style>{`
        .rid-line::before {
          content: ''; position: absolute; left: 15px; top: 30px; bottom: -14px;
          width: 2px; background: #e8e3ff;
        }
        .rid-item:last-child .rid-line::before { display: none; }
        .rid-press { transition: transform 120ms ease; }
        .rid-press:active { transform: scale(0.97); }
        @media (prefers-reduced-motion: no-preference) {
          @keyframes ridIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
          .rid-item { animation: ridIn 340ms cubic-bezier(0.22,1,0.36,1) both; }
        }
      `}</style>

      <header className="bg-white sticky top-0 z-30 px-4 py-3 flex items-center gap-3"
        style={{ boxShadow: '0 2px 12px rgba(91,84,232,0.08)', borderBottom: '1px solid #f0effe' }}>
        <button onClick={() => router.back()} aria-label="Go back"
          className="rid-press w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100 flex-shrink-0">
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${cat.color}18`, fontSize: 17 }}>
          {cat.icon}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-bold text-gray-800 truncate">{incident.title}</h1>
          <p className="text-[11px] text-gray-400">Reported {timeAgo(incident.created_at)}</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* The answer they came for, first thing on the page */}
        <div className="rounded-2xl px-4 py-4 flex items-start gap-3"
          style={{ background: panel.tone.bg, border: `1px solid ${panel.tone.border}` }}
          role="status">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'white' }}>
            <PanelIcon size={18} style={{ color: panel.tone.color }} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black leading-tight" style={{ color: panel.tone.color }}>
              {panel.title}
            </p>
            <p className="text-xs mt-1 leading-relaxed" style={{ color: panel.tone.color, opacity: 0.85 }}>
              {panel.body}
            </p>
            {responder?.phone && incident.status !== 'resolved' && (
              <a href={`tel:${responder.phone.replace(/[^0-9+]/g, '')}`}
                className="rid-press inline-flex items-center gap-1.5 mt-2.5 px-3 h-9 rounded-xl text-xs font-bold"
                style={{ background: 'white', color: panel.tone.color }}>
                <Phone size={12} /> Call {responder.full_name?.split(' ')[0]}
              </a>
            )}
          </div>
        </div>

        {/* Emergency numbers stay reachable for as long as it's unresolved */}
        {incident.status !== 'resolved' && (
          <EmergencyContacts
            category={incident.category}
            availability={availability}
            barangayPhone={barangayPhone}
          />
        )}

        {/* What they reported */}
        <div className="white-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] px-2 py-1 rounded-lg font-black flex items-center gap-1"
              style={{ background: pri.bg, color: pri.color }}>
              {pri.icon} {pri.word}
            </span>
            <span className="text-[10px] text-gray-400 font-semibold">{incident.category}</span>
          </div>

          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
            {incident.description}
          </p>

          <p className="text-xs text-gray-400 mt-3 flex items-start gap-1.5">
            <MapPin size={12} className="flex-shrink-0 mt-0.5" style={{ color: cat.color }} />
            {incident.location}
          </p>

          <IncidentPhoto stored={incident.image_url}
            onOpen={(url) => setLightbox({ src: url, alt: 'Your photo' })} />

          {Number.isFinite(incident.latitude) && (
            <div className="mt-3">
              <MiniMap lat={incident.latitude} lng={incident.longitude} height={170} />
            </div>
          )}
        </div>

        {/* Why it was classified this way — residents can't set priority,
            so they deserve to see the reasoning rather than just the label */}
        {basis?.law && (
          <div className="white-card p-4">
            <div className="flex items-start gap-2">
              <Scale size={14} className="flex-shrink-0 mt-0.5" style={{ color: '#5B54E8' }} />
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: '#5B54E8' }}>
                  Why it was classified {pri.word.toLowerCase()}
                </p>
                <p className="text-xs text-gray-700 mt-1">
                  <strong>{basis.law}</strong>
                  {basis.sections && <strong>{', '}{basis.sections}</strong>} — {basis.lawTitle}
                </p>
                <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed">{basis.reason}</p>
                {basis.source && (
                  <a href={basis.source} target="_blank" rel="noopener noreferrer"
                    className="inline-block text-[11px] font-semibold mt-1.5 underline" style={{ color: '#5B54E8' }}>
                    Read the law
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Progress */}
        <div className="white-card p-5">
          <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-4">Progress</p>
          <div className="space-y-4">
            {timeline.map((e, i) => {
              const Icon = e.icon
              return (
                <div key={i} className="rid-item relative flex gap-3"
                  style={{ animationDelay: `${Math.min(i, 6) * 55}ms` }}>
                  <div className="rid-line relative flex-shrink-0">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center relative z-10"
                      style={{ background: e.tone.bg }}>
                      <Icon size={14} style={{ color: e.tone.dot }} />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 pb-1">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <p className="text-xs font-black text-gray-800">{e.title}</p>
                      {e.at && (
                        <time className="text-[10px] text-gray-400" title={fullDate(e.at)}>
                          {timeAgo(e.at)}
                        </time>
                      )}
                    </div>
                    {e.body && <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{e.body}</p>}
                    {e.quote && (
                      <p className="text-[11px] italic mt-1.5 px-2.5 py-1.5 rounded-lg"
                        style={{ background: e.tone.bg, color: e.tone.dot }}>
                        "{e.quote}"
                      </p>
                    )}
                    <TimelinePhoto stored={e.photo}
                      onOpen={(url) => setLightbox({ src: url, alt: 'Resolution photo' })} />
                  </div>
                </div>
              )
            })}

            {incident.status !== 'resolved' && (
              <div className="relative flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: '#fafaff', border: '1px dashed #e8e3ff' }}>
                  <Clock size={13} className="text-gray-300" />
                </div>
                <p className="text-[11px] text-gray-400 self-center">Still in progress…</p>
              </div>
            )}
          </div>
        </div>

        {/* Rating — only once, only after resolution */}
        {canRate && (
          <div className="white-card p-5">
            <p className="text-sm font-black text-gray-800">How was the response?</p>
            <p className="text-xs text-gray-400 mt-0.5 mb-3">
              Your rating helps the barangay improve. It's visible to officials.
            </p>

            <div className="flex items-center gap-1.5 mb-3" role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map(s => (
                <button key={s} onClick={() => setRating(s)}
                  aria-label={`${s} star${s === 1 ? '' : 's'}`}
                  aria-checked={rating === s} role="radio"
                  className="rid-press w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ background: s <= rating ? '#fffbeb' : '#fafaff', border: `1px solid ${s <= rating ? '#fef3c7' : '#f0effe'}` }}>
                  <Star size={20}
                    fill={s <= rating ? '#f59e0b' : 'none'}
                    color={s <= rating ? '#f59e0b' : '#d1d5db'} />
                </button>
              ))}
            </div>

            <textarea value={feedback} onChange={e => setFeedback(e.target.value)}
              rows={3} maxLength={300}
              placeholder="Anything you'd like the barangay to know? (optional)"
              className="input-field w-full rounded-2xl px-3 py-2.5 text-sm text-gray-800 resize-none" />

            <button onClick={submitRating} disabled={!rating || savingRating}
              className="btn-primary rid-press w-full mt-3 h-11 rounded-2xl text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
              <Send size={14} />
              {savingRating ? 'Sending…' : 'Submit rating'}
            </button>
          </div>
        )}

        {incident.rated_at && (
          <div className="white-card p-4 flex items-center gap-3">
            <div className="flex gap-0.5 flex-shrink-0">
              {[1, 2, 3, 4, 5].map(s => (
                <Star key={s} size={14}
                  fill={s <= incident.rating ? '#f59e0b' : 'none'}
                  color={s <= incident.rating ? '#f59e0b' : '#d1d5db'} />
              ))}
            </div>
            <p className="text-xs text-gray-500">Thanks — you rated this {timeAgo(incident.rated_at)}.</p>
          </div>
        )}
      </main>

      {lightbox && (
        <div className="fixed inset-0 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', zIndex: 9999 }}
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