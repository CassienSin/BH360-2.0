'use client'
import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ArrowLeft, FileText, Scale, Clock, Loader2, CheckCircle, ShieldAlert, Send, ListChecks, Coins } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  DOCUMENT_TYPE_LIST, DOCUMENT_TYPES, CLASSIFICATION_LABEL,
  documentLegalBasis, workingDeadline, formatDeadline,
} from '@/lib/documents'
import { canRequestDocuments, documentBlockReason } from '@/lib/verification'

const PURPOSE_MIN = 5
const PURPOSE_MAX = 200
const NOTES_MAX = 500

const DOTS = Array.from({ length: 20 }, (_, i) => ({
  size: ((i * 7) % 6) + 3,
  left: (i * 17 + 13) % 100,
  top: (i * 23 + 7) % 100,
  duration: ((i * 3) % 6) + 4,
  delay: (i * 0.7) % 4,
}))

const AnimatedDots = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
    {DOTS.map((dot, i) => (
      <div key={i} style={{
        position: 'absolute',
        width: `${dot.size}px`, height: `${dot.size}px`,
        borderRadius: '50%', background: 'rgba(255,255,255,0.4)',
        left: `${dot.left}%`, top: `${dot.top}%`,
        animation: `float ${dot.duration}s ease-in-out infinite`,
        animationDelay: `${dot.delay}s`, filter: 'blur(0.5px)',
      }} />
    ))}
  </div>
)

export default function NewDocumentRequest() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [profile, setProfile] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [created, setCreated] = useState(null)
  const [form, setForm] = useState({ document_type: '', purpose: '', notes: '' })

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) { router.replace('/login'); return }
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, role, is_super_admin, barangay_id, verification_status, verification_note, barangays(name)')
        .eq('id', user.id)
        .single()
      if (cancelled) return
      setProfile(data ?? null)
      setLoadingProfile(false)
    }
    load()
    return () => { cancelled = true }
  }, [supabase, router])

  const doc = form.document_type ? DOCUMENT_TYPES[form.document_type] : null

  // The deadline the barangay will be held to, shown BEFORE the request is
  // filed. RA 11032 is a promise to the resident; a promise you only learn
  // about afterwards isn't much of one.
  const previewDue = useMemo(
    () => (doc ? workingDeadline(new Date(), doc.days) : null),
    [doc]
  )

  const allowed = canRequestDocuments(profile)
  const blockReason = documentBlockReason(profile)
  const purpose = form.purpose.trim()
  const formValid = !!doc && purpose.length >= PURPOSE_MIN && purpose.length <= PURPOSE_MAX

  async function handleSubmit(e) {
    e.preventDefault()
    if (submitting || !formValid || !allowed) return

    if (!profile?.barangay_id) {
      toast.error('Your account is not assigned to a barangay.')
      return
    }

    setSubmitting(true)
    // The deadline is computed here and stored on the row, so the request is
    // judged against the clock that applied on the day it was filed — not
    // against a holiday table or a classification edited later.
    const filedAt = new Date()
    const dueAt = workingDeadline(filedAt, doc.days)

    const { data, error } = await supabase
      .from('document_requests')
      .insert({
        document_type: form.document_type,
        purpose,
        notes: form.notes.trim() || null,
        requested_by: profile.id,
        barangay_id: profile.barangay_id,
        ra_classification: doc.classification,
        processing_days: doc.days,
        legal_basis: documentLegalBasis(form.document_type),
        due_at: dueAt.toISOString(),
      })
      .select()
      .single()

    setSubmitting(false)

    if (error) {
      toast.error(error.message || 'Could not file your request')
      return
    }
    setCreated(data)
    toast.success('Request filed')
  }

  if (loadingProfile) {
    return (
      <div className="min-h-dvh bg-brand flex items-center justify-center">
        <Loader2 size={30} className="animate-spin text-white" />
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-brand relative overflow-hidden">
      <AnimatedDots />

      <header className="bg-white sticky top-0 z-30 px-4 py-3 flex items-center gap-3"
        style={{ boxShadow: '0 2px 12px rgba(91,84,232,0.08)', borderBottom: '1px solid #f0effe' }}>
        <button onClick={() => router.back()} aria-label="Go back"
          className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div className="min-w-0">
          <h1 className="text-base font-bold text-gray-800" style={{ letterSpacing: '-0.5px' }}>
            Request a Document
          </h1>
          <p className="text-xs text-gray-400 truncate">
            {profile?.barangays?.name || 'Your barangay'} · Citizen’s Charter
          </p>
        </div>
      </header>

      <main className="relative z-10 max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* ── Filed successfully ─────────────────────────────────────── */}
        {created ? (
          <div className="white-card p-6 fade-up text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-3xl flex items-center justify-center"
              style={{ background: '#f0fdf4' }}>
              <CheckCircle size={30} className="text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-800">Request filed</h2>
            <p className="text-sm text-gray-500 mt-1">
              Keep this reference — under RA 11032 Sec. 10 the acknowledgement of your request
              carries the same force as the document itself once the deadline passes.
            </p>

            <p className="font-mono text-lg font-black mt-4" style={{ color: '#5B54E8' }}>
              {created.reference_code}
            </p>

            <div className="mt-4 px-4 py-3 rounded-2xl text-left"
              style={{ background: '#f0effe', border: '1px solid #e8e3ff' }}>
              <div className="flex items-start gap-2">
                <Clock size={13} className="flex-shrink-0 mt-0.5" style={{ color: '#5B54E8' }} />
                <div>
                  <p className="text-xs font-bold text-gray-800">
                    The barangay must act by {formatDeadline(created.due_at)}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                    {created.processing_days} working day{created.processing_days === 1 ? '' : 's'},
                    weekends and Philippine holidays excluded.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => router.push('/resident')}
                className="btn-primary flex-1 py-3 rounded-2xl text-white text-sm font-bold">
                Back to dashboard
              </button>
              <button onClick={() => { setCreated(null); setForm({ document_type: '', purpose: '', notes: '' }) }}
                className="px-5 py-3 rounded-2xl text-sm font-bold"
                style={{ background: '#fafaff', color: '#5B54E8', border: '1px solid #f0effe' }}>
                Request another
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* ── Verification gate ──────────────────────────────────── */}
            {!allowed && (
              <div className="white-card p-5 fade-up">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: '#fffbeb' }}>
                    <ShieldAlert size={18} className="text-amber-600" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-bold text-gray-800">Your account isn’t verified yet</h2>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">{blockReason}</p>
                    <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
                      A barangay certification is an official statement about who you are and where
                      you live, so the barangay checks that first (RA 7160, Sec. 394). Reporting an
                      incident never waits on this.
                    </p>
                    <button onClick={() => router.push('/resident/report')}
                      className="mt-3 text-xs font-bold" style={{ color: '#5B54E8' }}>
                      Report an incident instead →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── The Citizen's Charter (RA 11032 Sec. 6) ────────────── */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="white-card p-5 fade-up">
                <div className="flex items-center gap-2 mb-1">
                  <FileText size={15} style={{ color: '#5B54E8' }} />
                  <h2 className="font-bold text-gray-800 text-sm">What do you need?</h2>
                </div>
                <p className="text-[11px] text-gray-400 mb-4">
                  Every service below lists its own processing time, as RA 11032 Sec. 6 requires.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {DOCUMENT_TYPE_LIST.map(d => {
                    const active = form.document_type === d.value
                    return (
                      <button key={d.value} type="button" disabled={!allowed}
                        onClick={() => setForm(f => ({ ...f, document_type: d.value }))}
                        aria-pressed={active}
                        className="text-left px-3.5 py-3 rounded-2xl transition-all disabled:opacity-40"
                        style={{
                          background: active ? d.bg : '#fafaff',
                          border: `1.5px solid ${active ? d.color : '#f0effe'}`,
                        }}>
                        <div className="flex items-center gap-2">
                          <span className="text-lg" aria-hidden="true">{d.icon}</span>
                          <span className="text-xs font-bold" style={{ color: active ? d.color : '#374151' }}>
                            {d.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-1 leading-snug">{d.blurb}</p>
                        <p className="text-[10px] font-bold mt-1.5" style={{ color: d.color }}>
                          {d.days} working day{d.days === 1 ? '' : 's'}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* ── What the law promises for this document ──────────── */}
              {doc && (
                <div className="rounded-2xl overflow-hidden fade-up"
                  style={{ border: `2px solid ${doc.color}30` }} role="status" aria-live="polite">
                  <div className="px-4 py-3 flex items-center gap-3" style={{ background: doc.bg }}>
                    <Clock size={20} style={{ color: doc.color }} aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: doc.color }}>
                        {CLASSIFICATION_LABEL[doc.classification]}
                      </p>
                      <p className="text-base font-black leading-tight" style={{ color: doc.color }}>
                        {doc.days} working day{doc.days === 1 ? '' : 's'} maximum
                      </p>
                    </div>
                  </div>

                  <div className="px-4 py-3 bg-white space-y-2.5">
                    <div className="flex items-start gap-2">
                      <Scale size={13} className="flex-shrink-0 mt-0.5" style={{ color: '#5B54E8' }} />
                      <div className="min-w-0">
                        <p className="text-xs text-gray-700 leading-relaxed">
                          <strong style={{ color: '#5B54E8' }}>{doc.law}, {doc.sections}</strong>
                          {' — '}{doc.lawTitle}
                        </p>
                        {doc.alsoCited && (
                          <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">{doc.alsoCited}</p>
                        )}
                        <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                          If the barangay neither issues nor denies this by the deadline, RA 11032
                          Sec. 10 <strong>deems it approved</strong> — your acknowledgement receipt
                          then has the same force as the document.
                        </p>
                      </div>
                    </div>

                    {previewDue && (
                      <div className="px-3 py-2 rounded-xl flex items-start gap-2"
                        style={{ background: '#f0effe', border: '1px solid #e8e3ff' }}>
                        <Clock size={12} className="flex-shrink-0 mt-0.5" style={{ color: '#5B54E8' }} />
                        <p className="text-[11px] text-gray-700 leading-relaxed">
                          File this now and the deadline is <strong>{formatDeadline(previewDue)}</strong>
                          {' '}— weekends and Philippine holidays are not counted.
                        </p>
                      </div>
                    )}

                    <div className="flex items-start gap-2">
                      <ListChecks size={13} className="flex-shrink-0 mt-0.5 text-gray-400" />
                      <div>
                        <p className="text-[11px] font-bold text-gray-600">Bring with you</p>
                        <ul className="mt-0.5 space-y-0.5">
                          {doc.requirements.map(r => (
                            <li key={r} className="text-[11px] text-gray-500">• {r}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <Coins size={13} className="flex-shrink-0 mt-0.5 text-gray-400" />
                      <p className="text-[11px] text-gray-500 leading-relaxed">{doc.feeNote}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="white-card p-5 space-y-4 fade-up">
                <div>
                  <label htmlFor="purpose" className="text-xs font-bold text-gray-700">
                    What is it for? <span className="text-red-500">*</span>
                  </label>
                  <input id="purpose" value={form.purpose} disabled={!allowed}
                    onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
                    maxLength={PURPOSE_MAX}
                    placeholder="e.g. Employment requirement at ABC Company"
                    className="input-field w-full rounded-2xl px-4 py-2.5 text-sm text-gray-800 mt-1.5 disabled:opacity-40" />
                  <p className="text-[11px] text-gray-400 mt-1">
                    {purpose.length}/{PURPOSE_MAX}
                    {purpose.length > 0 && purpose.length < PURPOSE_MIN && ' · a little more detail, please'}
                  </p>
                </div>

                <div>
                  <label htmlFor="notes" className="text-xs font-bold text-gray-700">
                    Anything else the barangay should know?
                  </label>
                  <textarea id="notes" value={form.notes} disabled={!allowed} rows={3}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    maxLength={NOTES_MAX}
                    placeholder="Optional"
                    className="input-field w-full rounded-2xl px-4 py-2.5 text-sm text-gray-800 mt-1.5 disabled:opacity-40" />
                </div>

                <button type="submit" disabled={!formValid || submitting || !allowed}
                  className="btn-primary w-full py-3.5 rounded-2xl text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40">
                  {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  {submitting ? 'Filing…' : 'File this request'}
                </button>
              </div>
            </form>
          </>
        )}
      </main>
    </div>
  )
}
