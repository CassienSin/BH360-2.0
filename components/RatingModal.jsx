'use client'
import { useState, useEffect, useRef } from 'react'
import { Star, X, MessageSquare, Loader2 } from 'lucide-react'
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

  useEffect(() => {
    if (!open) {
      setRating(0)
      setHoverRating(0)
      setFeedback('')
      setSubmitting(false)
    }
  }, [open])

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
      onClick={() => { if (!submitting) onClose() }}>

      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rating-modal-title"
        className="w-full max-w-md rounded-3xl overflow-hidden fade-up-1 max-h-[90vh] flex flex-col outline-none"
        style={{ background: 'white', boxShadow: '0 32px 80px rgba(0,0,0,0.3)' }}
        onClick={e => e.stopPropagation()}>

        <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', boxShadow: '0 8px 24px rgba(251,191,36,0.4)' }}>
              <Star size={22} className="text-white fill-white" />
            </div>
            <div>
              <h2 id="rating-modal-title" className="text-lg font-bold text-gray-800">Rate the Service</h2>
              <p className="text-xs text-gray-400">Help us improve barangay response</p>
            </div>
          </div>
          <button onClick={onClose} disabled={submitting} aria-label="Close"
            className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors flex-shrink-0 disabled:opacity-50">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-5">
          {/* Incident summary */}
          <div className="p-3 rounded-2xl" style={{ background: '#fafaff', border: '1px solid #f0effe' }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#5B54E8' }}>Resolved Incident</p>
            <p className="text-sm font-bold text-gray-800">{incident?.title}</p>
            <p className="text-xs text-gray-400 mt-0.5">📍 {incident?.location}</p>
          </div>

          {/* Star Rating */}
          <div className="text-center">
            <p id="rating-group-label" className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 block">
              How was the response?
            </p>

            <div className="flex justify-center gap-2 mb-4" role="radiogroup" aria-labelledby="rating-group-label">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  role="radio"
                  aria-checked={rating === star}
                  aria-label={`${star} star${star === 1 ? '' : 's'} — ${RATING_LABELS[star].label}`}
                  disabled={submitting}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onFocus={() => setHoverRating(star)}
                  onBlur={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                  className="transition-all hover:scale-110 active:scale-95 disabled:pointer-events-none"
                  style={{ filter: displayRating >= star ? 'none' : 'grayscale(100%) opacity(0.3)' }}>
                  <Star
                    size={36}
                    fill={displayRating >= star ? '#fbbf24' : 'none'}
                    color={displayRating >= star ? '#f59e0b' : '#d1d5db'}
                    strokeWidth={1.5}
                  />
                </button>
              ))}
            </div>

            {/* Fixed-height container to prevent layout shift */}
            <div className="h-20 flex items-center justify-center" aria-live="polite">
              {displayRating > 0 ? (
                <div className="text-center">
                  <p className="text-2xl mb-1 leading-none">{current.emoji}</p>
                  <p className="text-base font-bold" style={{ color: current.color }}>{current.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{current.desc}</p>
                </div>
              ) : (
                <p className="text-xs text-gray-300">Tap the stars to rate</p>
              )}
            </div>
          </div>

          {/* Feedback */}
          <div>
            <label htmlFor="rating-feedback"
              className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <MessageSquare size={11} /> Feedback <span className="text-gray-300 font-normal">(Optional)</span>
            </label>
            <textarea
              id="rating-feedback"
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              rows={3} maxLength={300}
              disabled={submitting}
              placeholder="Share your experience with the response..."
              className="input-field w-full rounded-2xl px-4 py-3 text-sm text-gray-800 resize-none disabled:opacity-60" />
            <p className="text-xs text-gray-400 text-right mt-1">{feedback.length}/300</p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} disabled={submitting}
            className="flex-1 py-3 rounded-2xl text-sm font-bold transition-all hover:bg-gray-50 disabled:opacity-50"
            style={{ background: '#fafaff', color: '#6b7280', border: '1px solid #f0effe' }}>
            Skip
          </button>
          <button onClick={handleSubmit} disabled={submitting || rating === 0}
            className="flex-1 py-3 rounded-2xl text-sm font-bold text-white transition-all hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100"
            style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', boxShadow: '0 8px 32px rgba(251,191,36,0.4)' }}>
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Submitting...
              </span>
            ) : '⭐ Submit Rating'}
          </button>
        </div>
      </div>
    </div>
  )
}