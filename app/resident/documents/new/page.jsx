'use client'
import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { loginHref } from '@/lib/loginRedirect'
import { goBack } from '@/lib/goBack'
import { createClient } from '@/lib/supabase'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  DOCUMENT_TYPE_LIST, DOCUMENT_TYPES, CLASSIFICATION_LABEL,
  documentLegalBasis, workingDeadline, formatDeadline,
} from '@/lib/documents'
import { canRequestDocuments, documentBlockReason } from '@/lib/verification'
import PageShell from '@/components/crafted/PageShell'
import { PageSkeleton } from '@/components/Skeletons'
import { Card, CardHead } from '@/components/ui/card'
import { Field } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/notice'
import { Muted } from '@/components/ui/text'

const PURPOSE_MIN = 5
const PURPOSE_MAX = 200
const NOTES_MAX = 500

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
      if (error || !user) { router.replace(loginHref()); return }
      const { data, error: profError } = await supabase
        .from('profiles')
        .select('id, full_name, role, is_super_admin, barangay_id, verification_status, verification_note, barangays(name)')
        .eq('id', user.id)
        .single()
      if (cancelled) return
      // Without a profile the form cannot tell whether this account is
      // verified, and would show the gate as though it had been refused.
      if (profError) {
        console.error('Could not load your profile:', profError)
        toast.error('Could not load your account. Please refresh.')
      }
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

  if (loadingProfile) return <PageSkeleton cards={3} maxWidth={640} />

  const days = n => `${n} working day${n === 1 ? '' : 's'}`

  if (created) {
    return (
      <PageShell title="Request filed" sub={`${profile?.barangays?.name || 'Your barangay'} · Citizen’s Charter`}
        onBack={() => router.push('/resident?section=documents')} backLabel="Back to my documents"
        footer={
          <div className="flex gap-2.5">
            <Button variant="secondary" size="lg" onClick={() => { setCreated(null); setForm({ document_type: '', purpose: '', notes: '' }) }}>Request another</Button>
            <Button size="lg" className="flex-1" onClick={() => router.push('/resident?section=documents')}>See my documents</Button>
          </div>
        }>
        <Card lift className="px-[18px] py-4">
          <p className="text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase">Your reference</p>
          <p className="mt-1 font-mono text-[22px] font-extrabold text-brand-strong">{created.reference_code}</p>
          <p className="mt-2 text-[13px] leading-[1.55] text-body">
            Keep it. Under RA 11032 Sec. 10, once the deadline passes, the acknowledgement of your request carries the same force as the document itself.
          </p>
        </Card>
        <Notice tone="info" title={`The barangay must act by ${formatDeadline(created.due_at)}.`}>
          {days(created.processing_days)}, weekends and Philippine holidays not counted.
        </Notice>
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Request a document"
      sub="Choose a document and tell us why"
      onBack={() => goBack(router, '/resident?section=documents')}
      footer={
        <Button type="submit" form="document-form" size="lg" full disabled={!formValid || submitting || !allowed} aria-busy={submitting || undefined}>
          {submitting ? <><Loader2 className="animate-spin" aria-hidden="true" />Filing…</> : 'Submit request'}
        </Button>
      }>

      {/* ── Verification gate ──────────────────────────────────── */}
      {!allowed && (
        <Notice tone="warn" title="Your account isn’t verified yet.">
          {blockReason} A barangay certification is an official statement about who you are and where you live, so the barangay checks that first (RA 7160, Sec. 394). Reporting an incident never waits on this.
          <button onClick={() => router.push('/resident/report')} className="mt-1.5 block text-xs font-bold text-brand-strong hover:text-brand-deep">Report an incident instead</button>
        </Notice>
      )}

      {/* ── The Citizen's Charter (RA 11032 Sec. 6) ────────────── */}
      <form id="document-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2" disabled={!allowed}>
          <legend className="sr-only">What do you need?</legend>
          {DOCUMENT_TYPE_LIST.map((d, i) => {
            const active = form.document_type === d.value
            return (
              <label key={d.value}
                className={`flex cursor-pointer items-center gap-3 rounded-[12px] bg-surface transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-strong has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 ${active ? 'border-2 border-brand-strong px-[13px] py-[11px]' : 'border border-line px-3.5 py-3 hover:border-line-strong'} ${i === 0 ? 'shadow-[var(--shadow-lift)]' : ''}`}>
                <input type="radio" name="document_type" value={d.value} checked={active}
                  onChange={() => setForm(f => ({ ...f, document_type: d.value }))} className="sr-only" />
                <span aria-hidden="true" className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${active ? 'border-brand-strong' : 'border-line-strong'}`}>
                  {active && <span className="size-2.5 rounded-full bg-brand-strong" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-extrabold text-ink">{d.label}</span>
                  <span className="block text-[13px] leading-snug text-muted-foreground">{d.blurb}</span>
                </span>
                <span className="shrink-0 text-right leading-tight">
                  <span className="block text-[15px] font-extrabold text-ink tabular-nums">{d.days}</span>
                  <span className="block text-[11px] text-muted-foreground">working day{d.days === 1 ? '' : 's'}</span>
                </span>
              </label>
            )
          })}
        </fieldset>
        <Muted className="text-xs -mt-1">Each service lists its own processing time, as RA 11032 Sec. 6 requires. Fees follow your barangay’s ordinance.</Muted>

        {/* ── What the law promises for this document ──────────── */}
        {doc && (
          <Card role="status" aria-live="polite">
            <CardHead title={`${days(doc.days)} at most`} sub={CLASSIFICATION_LABEL[doc.classification]} />
            <div className="border-t border-line px-[18px] py-3.5 space-y-2.5 text-[13px] leading-[1.55] text-body">
              {previewDue && (
                <p>File this now and the deadline is <strong className="text-ink">{formatDeadline(previewDue)}</strong>. Weekends and Philippine holidays are not counted.</p>
              )}
              <p>
                <strong className="text-brand-strong">{doc.law}, {doc.sections}</strong> · {doc.lawTitle}.{' '}
                If the barangay neither issues nor denies this by the deadline, RA 11032 Sec. 10 deems it approved: your acknowledgement receipt then has the same force as the document.
              </p>
              {doc.alsoCited && <p className="text-muted-foreground">{doc.alsoCited}</p>}
              <div>
                <p className="font-bold text-ink">Bring with you</p>
                <ul className="mt-0.5 list-disc pl-5">
                  {doc.requirements.map(r => <li key={r}>{r}</li>)}
                </ul>
              </div>
              <p className="text-muted-foreground">{doc.feeNote}</p>
            </div>
          </Card>
        )}

        <Field id="purpose" label="Purpose" value={form.purpose} disabled={!allowed}
          onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
          maxLength={PURPOSE_MAX} placeholder="e.g. Employment requirement"
          error={purpose.length > 0 && purpose.length < PURPOSE_MIN ? 'A little more detail, please.' : undefined}
          hint={`${purpose.length} of ${PURPOSE_MAX}`} />

        <Field id="notes" label="Anything else the barangay should know?" optional>
          <Textarea value={form.notes} disabled={!allowed} rows={3}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            maxLength={NOTES_MAX} />
        </Field>
      </form>
    </PageShell>
  )
}
