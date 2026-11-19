'use client'
import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { loginHref } from '@/lib/loginRedirect'
import { goBack } from '@/lib/goBack'
import { createClient } from '@/lib/supabase'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import PageShell from '@/components/crafted/PageShell'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { SectionLabel, Muted } from '@/components/ui/text'

const TITLE_MIN = 3
const TITLE_MAX = 100
const DESC_MIN = 10
const DESC_MAX = 1000

const CATEGORIES = [
  { value: 'inquiry', label: 'A question', desc: 'Ask about a service or a rule' },
  { value: 'request', label: 'A request', desc: 'Ask the barangay for something' },
  { value: 'complaint', label: 'A complaint', desc: 'A problem that isn’t an emergency' },
  { value: 'feedback', label: 'Feedback', desc: 'Ideas and suggestions' },
]

const EXAMPLES = [
  { title: 'Request for barangay clearance', category: 'request' },
  { title: 'Streetlight out in our area', category: 'complaint' },
  { title: 'Suggestion for a community event', category: 'feedback' },
  { title: 'Question about a health program', category: 'inquiry' },
]

const NEXT_STEPS = [
  { title: 'An official reads it', desc: 'Usually within a few hours' },
  { title: 'You talk it through', desc: 'Replies come into this conversation' },
  { title: 'It closes when it’s sorted', desc: 'You can open a new one any time' },
]

export default function NewTicket() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [form, setForm] = useState({ title: '', description: '', category: 'inquiry' })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const redirectTimerRef = useRef(null)

  // Clear the pending redirect if the user navigates away first
  useEffect(() => {
    return () => clearTimeout(redirectTimerRef.current)
  }, [])

  // Validate against trimmed lengths so "   ab " can't enable the button
  const trimmedTitle = form.title.trim()
  const trimmedDesc = form.description.trim()
  const titleValid = trimmedTitle.length >= TITLE_MIN && trimmedTitle.length <= TITLE_MAX
  const descValid = trimmedDesc.length >= DESC_MIN && trimmedDesc.length <= DESC_MAX
  const formValid = titleValid && descValid


  async function handleSubmit(e) {
    e.preventDefault()
    if (loading) return

    if (trimmedTitle.length < TITLE_MIN) {
      toast.error(`Subject must be at least ${TITLE_MIN} characters.`)
      return
    }
    if (trimmedDesc.length < DESC_MIN) {
      toast.error(`Description must be at least ${DESC_MIN} characters.`)
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

      const { data, error } = await supabase
        .from('tickets')
        .insert({
          title: trimmedTitle,
          description: trimmedDesc,
          category: form.category,
          created_by: user.id,
          barangay_id: prof.barangay_id,
          status: 'open',
        })
        .select()
        .single()

      if (error) {
        toast.error('Failed to create ticket. Please try again.')
        return
      }

      setSuccess(true)
      redirectTimerRef.current = setTimeout(() => router.push(`/resident/ticket/${data.id}`), 1500)
    } catch (err) {
      console.error('Ticket creation failed:', err)
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <PageShell title="Ask the barangay" sub="Sent">
        <Card lift className="px-[18px] py-5" role="status">
          <h2 className="text-[17px] font-extrabold text-ink">Your question is with the barangay</h2>
          <Muted className="mt-1">An official will answer in the conversation. Opening it now…</Muted>
        </Card>
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Ask the barangay"
      sub="An official answers you in a conversation"
      onBack={() => goBack(router, '/resident?section=tickets')}
      footer={
        <>
          <p className="text-center text-xs text-muted-foreground">Only barangay officials can see it.</p>
          <Button type="submit" form="ticket-form" size="lg" full disabled={loading || !formValid} aria-busy={loading || undefined}>
            {loading ? <><Loader2 className="animate-spin" aria-hidden="true" />Sending…</> : 'Send'}
          </Button>
        </>
      }>
      <form id="ticket-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-bold text-ink">What is it about?</legend>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map((cat, i) => {
              const selected = form.category === cat.value
              return (
                <button key={cat.value} type="button" aria-pressed={selected}
                  onClick={() => setForm(prev => ({ ...prev, category: cat.value }))}
                  className={`rounded-[12px] bg-surface text-left transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong ${selected ? 'border-2 border-brand-strong px-[13px] py-[11px]' : 'border border-line px-3.5 py-3 hover:border-line-strong'} ${i < 2 ? 'shadow-[var(--shadow-lift)]' : ''}`}>
                  <span className="block text-[15px] font-extrabold text-ink">{cat.label}</span>
                  <span className="block text-xs leading-snug text-muted-foreground">{cat.desc}</span>
                </button>
              )
            })}
          </div>
        </fieldset>

        <div>
          <p className="mb-1.5 text-[13px] font-bold text-ink" id="examples-label">Start from an example</p>
          <div className="flex flex-wrap gap-2" role="group" aria-labelledby="examples-label">
            {EXAMPLES.map(ex => (
              <Chip key={ex.title} onClick={() => setForm(prev => ({ ...prev, title: ex.title, category: ex.category }))}>{ex.title}</Chip>
            ))}
          </div>
        </div>

        <Field id="ticket-title" label="Subject" value={form.title}
          onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
          required maxLength={TITLE_MAX} placeholder="A few words about it"
          error={form.title && !titleValid ? `A little longer, please (${TITLE_MIN - trimmedTitle.length} more)` : undefined}
          hint={`${form.title.length} of ${TITLE_MAX}`} />

        <Field id="ticket-description" label="Your question or concern"
          error={form.description && !descValid ? `A little more detail, please (${DESC_MIN - trimmedDesc.length} more)` : undefined}
          hint={`${form.description.length} of ${DESC_MAX} · Say where, when and what you need.`}>
          <Textarea value={form.description}
            onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
            required rows={6} maxLength={DESC_MAX}
            placeholder="When, where, what happened, and what you need from the barangay" />
        </Field>

        <Card className="px-[18px] py-4">
          <SectionLabel as="h2">What happens next</SectionLabel>
          <ol className="space-y-2.5">
            {NEXT_STEPS.map((s, i) => (
              <li key={s.title} className="flex items-start gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-extrabold text-brand-strong" aria-hidden="true">{i + 1}</span>
                <span>
                  <span className="block text-sm font-bold text-ink">{s.title}</span>
                  <span className="block text-xs text-muted-foreground">{s.desc}</span>
                </span>
              </li>
            ))}
          </ol>
        </Card>
      </form>
    </PageShell>
  )
}
