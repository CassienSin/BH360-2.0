'use client'
import { useState, useEffect, useRef } from 'react'
import { Star, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import toast from 'react-hot-toast'

// Hoisted to module scope — this was being recreated on every render,
// and defined after the early return where it didn't need to be.
const RATING_LABELS = {
  1: { label: 'Poor', emoji: '😞', color: '#ef4444', desc: 'Not satisfied with the service' },
  2: { label: 'Fair', emoji: '😐', color: '#f97316', desc: 'Could be better' },
  3: { label: 'Good', emoji: '🙂', color: '#3b82f6', desc: 'Decent service' },
  4: { label: 'Great', emoji: '😊', color: '#22c55e', desc: 'Very satisfied!' },
  5: { label: 'Excellent', emoji: '🤩', color: '#16a34a', desc: 'Outstanding response!' },
}

export default function RatingModal({ open, onClose, onSubmit, incident }) {
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const panelRef = useRef(null)

  // Closing clears the form, so the next incident starts blank. Done while
  // rendering when `open` flips (no effect, no extra render pass).
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (!open) {
      setRating(0)
      setHoverRating(0)
      setFeedback('')
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if (!open) return
    const handleEsc = (e) => {
      // Don't allow closing while the submission is in flight
      if (e.key === 'Escape' && !submitting) onClose()
    }
    document.addEventListener('keydown', handleEsc)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
    }
  }, [open, onClose, submitting])

  // Move focus into the dialog on open so keyboard/screen-reader users
  // land inside it instead of the page behind the backdrop.
  useEffect(() => {
    if (open) setTimeout(() => panelRef.current?.focus(), 50)
  }, [open])

  async function handleSubmit() {
    if (submitting) return
    if (rating === 0) {
      toast.error('Please select a rating')
      return
    }
    setSubmitting(true)
    try {
      await onSubmit({ rating, feedback: feedback.trim() })
    } catch (err) {
      // Previously a failure here left the modal stuck on "Submitting..."
      toast.error('Failed to submit rating. Please try again.')
      console.error('RatingModal submit failed:', err)
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  const displayRating = hoverRating || rating
  const current = RATING_LABELS[displayRating]

  return (
    <div className="fixed inset-0 z-50 sheet-overlay bg-[var(--scrim)] [animation:sheetFade_.2s_ease_both]"
      onClick={() => { if (!submitting) onClose() }}>

      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rating-modal-title"
        className="sheet-panel relative flex max-w-md flex-col overflow-hidden bg-surface shadow-[var(--shadow-float)] outline-none [animation:sheetUp_.32s_var(--ease-sheet)_both] sm:border sm:border-line"
        onClick={e => e.stopPropagation()}>

        <span aria-hidden="true" className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-line sm:hidden" />
        <div className="flex items-start gap-3 px-[18px] pt-3.5 pb-1 sm:pt-[18px]">
          <div className="min-w-0 flex-1">
            <h2 id="rating-modal-title" className="text-[17px] font-extrabold text-ink">Rate the response</h2>
            <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{incident?.title}{incident?.location ? ` · ${incident.location}` : ''}</p>
          </div>
          <button onClick={onClose} disabled={submitting} aria-label="Close"
            className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-line bg-surface text-ink outline-none hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong disabled:opacity-50">
            <X size={18} strokeWidth={1.9} />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-[18px] py-4">
          {/* Star Rating */}
          <div>
            <p id="rating-group-label" className="mb-2 text-[13px] font-bold text-ink">How was the response?</p>
            <div className="flex gap-2" role="radiogroup" aria-labelledby="rating-group-label">
              {[1, 2, 3, 4, 5].map(star => {
                const on = displayRating >= star
                return (
                  <button
                    key={star}
                    type="button"
                    role="radio"
                    aria-checked={rating === star}
                    aria-label={`${star} star${star === 1 ? '' : 's'}: ${RATING_LABELS[star].label}`}
                    disabled={submitting}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onFocus={() => setHoverRating(star)}
                    onBlur={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                    className={`flex size-12 items-center justify-center rounded-[10px] border transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong disabled:pointer-events-none ${on ? 'border-[color-mix(in_srgb,var(--warn)_35%,var(--line))] bg-warn-soft' : 'border-line bg-surface'}`}>
                    <Star size={24} strokeWidth={1.75} fill={on ? 'var(--warn)' : 'none'} color={on ? 'var(--warn)' : 'var(--line-strong)'} />
                  </button>
                )
              })}
            </div>
            {/* Fixed height so the sheet doesn't jump */}
            <p className="mt-2 h-10 text-[13px] leading-snug" aria-live="polite">
              {displayRating > 0
                ? <><strong className="text-ink">{current.label}.</strong> <span className="text-muted-foreground">{current.desc}</span></>
                : <span className="text-muted-foreground">Tap a star to rate.</span>}
            </p>
          </div>

          <Field id="rating-feedback" label="Anything to add?" optional hint={`${feedback.length} of 300`}>
            <Textarea
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              rows={3} maxLength={300}
              disabled={submitting}
              placeholder="What went well, or what could be better" />
          </Field>
        </div>

        <div className="flex gap-2.5 border-t border-line px-[18px] py-3">
          <Button variant="secondary" size="lg" onClick={onClose} disabled={submitting}>Skip</Button>
          <Button size="lg" className="flex-1" onClick={handleSubmit} disabled={submitting || rating === 0} aria-busy={submitting || undefined}>
            {submitting ? <><Loader2 className="animate-spin" aria-hidden="true" />Sending…</> : 'Send rating'}
          </Button>
        </div>
      </div>
    </div>
  )
}