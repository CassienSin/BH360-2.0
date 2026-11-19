'use client'
import Image from 'next/image'
import ConfirmDialog from '@/components/ConfirmDialog'
import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { loginHref } from '@/lib/loginRedirect'
import { goBack } from '@/lib/goBack'
import { createClient } from '@/lib/supabase'
import { Loader2, Send, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useHydrated } from '@/lib/useHydrated'
import { useNow } from '@/lib/useNow'
import PageShell from '@/components/crafted/PageShell'
import Band from '@/components/crafted/Band'
import { Card, CardHead } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Notice } from '@/components/ui/notice'
import { Muted } from '@/components/ui/text'

const TITLE_MIN = 3
const TITLE_MAX = 150
const CONTENT_MIN = 10
const CONTENT_MAX = 2000
const DRAFT_KEY = 'announcement-draft'
const UNDO_SECONDS = 60

const TEMPLATES = [
  {
    label: 'General Update',
    title: 'Important Update from the Barangay',
    content: 'Dear residents,\n\nWe would like to inform everyone about...\n\nFor any concerns, please feel free to visit the barangay hall during office hours.\n\nThank you for your cooperation.',
  },
  {
    label: 'Community Event',
    title: 'Upcoming Community Event',
    content: 'We are excited to invite all residents to our upcoming community event!\n\n📅 Date: \n📍 Location: \n🕐 Time: \n\nLet\'s come together as one community. See you there!',
  },
  {
    label: 'Safety Alert',
    title: 'Safety Advisory',
    content: 'Attention all residents:\n\nThis is an important safety advisory regarding...\n\nPlease take necessary precautions and stay alert. Report any suspicious activity to your local barangay tanod.',
  },
  {
    label: 'Health Program',
    title: 'Health Program Schedule',
    content: 'The barangay is pleased to announce the following health program:\n\n🏥 Service: \n📅 Date: \n📍 Where: Barangay Health Center\n👨‍⚕️ Open to: All residents\n\nPlease bring valid ID.',
  },
]

// The saved draft, or null when there is none or it is unreadable.
function readDraft() {
  try {
    const draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null')
    if (draft && (draft.title || draft.content)) return { title: draft.title || '', content: draft.content || '' }
  } catch {
    // Corrupt draft or storage blocked: start blank
  }
  return null
}

export default function NewAnnouncement() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const now = useNow()
  const [form, setForm] = useState({ title: '', content: '' })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [posterName, setPosterName] = useState(null)
  const [draftRestored, setDraftRestored] = useState(false)
  const [postedId, setPostedId] = useState(null)
  const [undoSecondsLeft, setUndoSecondsLeft] = useState(UNDO_SECONDS)
  const [undoing, setUndoing] = useState(false)
  const [pendingTemplate, setPendingTemplate] = useState(null)

  // Restore a saved draft once, on the first render in the browser. The
  // server renders an empty form, so this must wait for hydration; doing it
  // while rendering (not in an effect) avoids a flash of the empty form.
  const hydrated = useHydrated()
  const [draftChecked, setDraftChecked] = useState(false)
  if (hydrated && !draftChecked) {
    setDraftChecked(true)
    const draft = readDraft()
    if (draft) {
      setForm(draft)
      setDraftRestored(true)
    }
  }

  // Load the official's name for the preview byline
  useEffect(() => {
    let cancelled = false
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace(loginHref())
        return
      }
      const { data: prof, error: profError } = await supabase
        .from('profiles').select('full_name').eq('id', user.id).single()
      // Only used for the preview byline — the announcement posts either way.
      if (profError) console.error('Could not load your name for the preview:', profError)
      if (!cancelled && prof?.full_name) setPosterName(prof.full_name)
    }
    loadProfile()

    return () => {
      cancelled = true
    }
  }, [supabase, router])

  // Autosave the draft (debounced) so an accidental back-swipe doesn't lose a long announcement
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        if (form.title || form.content) {
          sessionStorage.setItem(DRAFT_KEY, JSON.stringify(form))
        } else {
          sessionStorage.removeItem(DRAFT_KEY)
        }
      } catch {
        // Storage full/unavailable — non-critical
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [form])

  const trimmedTitle = form.title.trim()
  const trimmedContent = form.content.trim()
  const titleValid = trimmedTitle.length >= TITLE_MIN && trimmedTitle.length <= TITLE_MAX
  const contentValid = trimmedContent.length >= CONTENT_MIN && trimmedContent.length <= CONTENT_MAX
  const formValid = titleValid && contentValid
  const isDirty = form.title.trim() !== '' || form.content.trim() !== ''

  function applyTemplate(template) {
    // Don't silently wipe out an in-progress announcement
    if (isDirty) {
      setPendingTemplate(template)
      return
    }
    loadTemplate(template)
  }

  function loadTemplate(template) {
    setForm({ title: template.title, content: template.content })
    setDraftRestored(false)
    setPendingTemplate(null)
    toast.success(`Template "${template.label}" loaded!`)
  }

  function clearDraft() {
    setForm({ title: '', content: '' })
    setDraftRestored(false)
    try { sessionStorage.removeItem(DRAFT_KEY) } catch {}
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (loading) return

    if (!formValid) {
      if (trimmedTitle.length < TITLE_MIN) toast.error(`Title must be at least ${TITLE_MIN} characters.`)
      else if (trimmedContent.length < CONTENT_MIN) toast.error(`Content must be at least ${CONTENT_MIN} characters.`)
      return
    }

    setLoading(true)
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        toast.error('Your session has expired. Please log in again.')
        router.replace(loginHref())
        return
      }

      const { data: prof, error: profError } = await supabase
        .from('profiles')
        .select('barangay_id')
        .eq('id', user.id)
        .single()

      if (profError || !prof?.barangay_id) {
        toast.error('Your account is not assigned to a barangay.')
        return
      }

      const { data: inserted, error } = await supabase.from('announcements').insert({
        title: trimmedTitle,
        content: trimmedContent,
        posted_by: user.id,
        barangay_id: prof.barangay_id,
        // Publish after the undo window — residents' queries/RLS filter on
        // published_at <= now(), so the row is invisible until then
        published_at: new Date(Date.now() + UNDO_SECONDS * 1000).toISOString(),
      }).select('id').single()

      if (error || !inserted) {
        toast.error('Failed to post announcement. Please try again.')
        return
      }

      // Keep the draft in storage until the undo window closes,
      // so recalling restores the full text
      setPostedId(inserted.id)
      setUndoSecondsLeft(UNDO_SECONDS)
      setSuccess(true)
    } catch (err) {
      console.error('Announcement post failed:', err)
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Countdown while the undo window is open; redirect when it closes
  useEffect(() => {
    if (!success || !postedId) return
    if (undoSecondsLeft <= 0) {
      try { sessionStorage.removeItem(DRAFT_KEY) } catch {}
      // Save it once more now that it is visible. Residents' live feed
      // could not see the original insert (it was still hidden), but it
      // does see this update — so it appears without a refresh.
      supabase.from('announcements')
        .update({ published_at: new Date(Date.now() - 1000).toISOString() })
        .eq('id', postedId)
        .then(({ error }) => { if (error) console.error('Publishing announcement failed:', error) })
        .finally(() => router.push('/official?section=announcements'))
      return
    }
    const timer = setTimeout(() => setUndoSecondsLeft(s => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [success, postedId, undoSecondsLeft, router, supabase])

  async function undoPost() {
    if (undoing || !postedId) return
    setUndoing(true)
    try {
      const { error } = await supabase.from('announcements').delete().eq('id', postedId)
      if (error) throw error
      // Back to the form with the draft intact (still in state + sessionStorage)
      setPostedId(null)
      setSuccess(false)
      toast.success('Announcement recalled — your draft is unchanged.')
    } catch (err) {
      console.error('Undo failed:', err)
      toast.error('Could not recall the announcement. It may have already published.')
    } finally {
      setUndoing(false)
    }
  }

  const backToList = () => goBack(router, '/official?section=announcements')
  const clock = new Date(now).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M$/i, '')

  if (success) {
    return (
      <PageShell eyebrow="Announcements" title="Announcement posted" onBack={backToList} maxWidth={560}>
        <Card lift className="px-[18px] py-5" role="status">
          <h2 className="text-[17px] font-extrabold text-ink">Residents see it in {undoSecondsLeft} s</h2>
          <Muted className="mt-1">Spotted a mistake? You can still take it back until then. Leaving this page won&rsquo;t cancel it; it publishes on its own.</Muted>
          <div className="mt-4 h-1 overflow-hidden rounded-full bg-track" aria-hidden="true">
            <div className="h-full rounded-full bg-brand-strong transition-[width] duration-1000 ease-linear motion-reduce:transition-none"
              style={{ width: `${(undoSecondsLeft / UNDO_SECONDS) * 100}%` }} />
          </div>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <Button variant="secondary" size="lg" onClick={undoPost} disabled={undoing} aria-busy={undoing || undefined}>
              {undoing ? <Loader2 className="animate-spin" aria-hidden="true" /> : <X aria-hidden="true" />}
              {undoing ? 'Taking it back…' : 'Undo'}
            </Button>
            <Button size="lg" className="flex-1" onClick={() => {
              try { sessionStorage.removeItem(DRAFT_KEY) } catch {}
              router.push('/official?section=announcements')
            }}>Done</Button>
          </div>
        </Card>
      </PageShell>
    )
  }

  const titleCount = `${form.title.length} of ${TITLE_MAX}`
  const contentCount = `${form.content.length} of ${CONTENT_MAX}`

  return (
    <PageShell eyebrow="Announcements" title="New announcement" onBack={backToList} backLabel="Back to announcements"
      maxWidth={1120}
      actions={<Button variant="onband" onClick={backToList}>Cancel</Button>}>
      <div className="grid items-start gap-3.5 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <Card lift className="min-w-0">
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 px-[18px] py-4">
              {draftRestored && (
                <Notice tone="info" title="Your unsaved draft is back.">
                  <button type="button" onClick={clearDraft} className="font-bold text-brand-strong underline underline-offset-2">Discard it</button>
                </Notice>
              )}

              <div>
                <p className="mb-2 text-[13px] font-bold text-ink">Start from</p>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Templates">
                  {TEMPLATES.map(tmpl => (
                    <button key={tmpl.label} type="button" onClick={() => applyTemplate(tmpl)}
                      className="h-8 rounded-[9px] border border-line bg-surface px-3 text-[13px] font-bold text-ink outline-none hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong">
                      {tmpl.label}
                    </button>
                  ))}
                </div>
              </div>

              <Field id="announcement-title" label="Title"
                hint={form.title && !titleValid ? `Too short: at least ${TITLE_MIN} characters. ${titleCount}` : titleCount}>
                <Input id="announcement-title" value={form.title} required maxLength={TITLE_MAX}
                  onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="For example: Water interruption on Saturday" />
              </Field>

              <Field id="announcement-content" label="Message"
                hint={form.content && !contentValid ? `Add a little more: ${Math.max(CONTENT_MIN - trimmedContent.length, 0)} more characters. ${contentCount}` : contentCount}>
                <Textarea id="announcement-content" value={form.content} required rows={7} maxLength={CONTENT_MAX}
                  onChange={e => setForm(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="What is happening, when, who is affected and what residents should do." />
              </Field>

              <div className="rounded-[10px] border border-line bg-surface-sunk px-3.5 py-3 text-[13px] leading-relaxed text-body">
                <strong className="text-ink">Who gets it:</strong> everyone in the barangay sees it in their announcements, and phones with notifications on get an alert.
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-line px-[18px] py-3">
              <p className="min-w-0 flex-1 text-xs text-muted-foreground">
                You&rsquo;ll have {UNDO_SECONDS} seconds to undo after publishing. {isDirty ? 'The draft is kept on this device.' : ''}
              </p>
              <Button type="submit" size="lg" disabled={loading || !formValid} aria-busy={loading || undefined}>
                {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
                {loading ? 'Publishing…' : 'Publish'}
              </Button>
            </div>
          </form>
        </Card>

        {/* How it lands: the push alert on a resident's lock screen, then
            the card in their announcements (O11 phone preview). */}
        <Card className="min-w-0">
          <CardHead title="Preview" sub="How it shows on a resident's phone" />
          <div className="px-[18px] pb-[18px]">
            <div className="mx-auto max-w-[300px] rounded-[30px] bg-[#1B1838] p-2.5" aria-hidden="true">
              <div className="relative isolate overflow-hidden rounded-[22px] px-3 pt-6 pb-4" style={{ minHeight: 300 }}>
                <Band mode="fill" seed={8} dots={8} />
                <p className="relative z-[1] text-center text-[44px] leading-none font-light tracking-[-1px] text-white tabular-nums">{clock}</p>
                <div className="relative z-[1] mt-5 rounded-[14px] bg-surface/95 px-3 py-2.5 text-left">
                  <p className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                    <Image src="/logo.png" alt="" width={12} height={12} />BH360 · now
                  </p>
                  <p className="mt-1 line-clamp-2 text-[13px] leading-snug font-extrabold text-ink">{form.title.trim() || 'Your title'}</p>
                  <p className="mt-0.5 line-clamp-3 text-xs leading-snug text-body">{form.content.trim() || 'The first lines of your message show here.'}</p>
                </div>
              </div>
            </div>

            <p className="mt-4 mb-2 text-[13px] font-bold text-ink">In their announcements</p>
            <div className="rounded-[14px] border border-line px-4 py-3">
              <p className="text-sm font-bold break-words text-ink">{form.title.trim() || 'Your title'}</p>
              <p className="mt-1 text-[13px] leading-relaxed whitespace-pre-wrap break-words text-body line-clamp-4">{form.content.trim() || 'Your message.'}</p>
              <p className="mt-1.5 text-xs text-muted-foreground">{posterName ? `${posterName} · ` : ''}just now</p>
            </div>
          </div>
        </Card>
      </div>

      <ConfirmDialog open={Boolean(pendingTemplate)} onClose={() => setPendingTemplate(null)}
        title="Replace your draft?"
        message={`Your title and message will be replaced with the “${pendingTemplate?.label || ''}” template.`}
        confirmText="Replace draft" cancelText="Keep my draft" variant="warning"
        onConfirm={() => { if (pendingTemplate) loadTemplate(pendingTemplate) }} />
    </PageShell>
  )
}
