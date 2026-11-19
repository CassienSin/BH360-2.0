'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { Check, X, Camera, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase'
import toast from 'react-hot-toast'

// Derive the extension from the MIME type instead of trusting file.name,
// which can be missing an extension entirely or contain junk.
const EXT_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
}

export default function ResolveModal({ open, onClose, onResolve, incident, userId }) {
  const supabase = useMemo(() => createClient(), [])
  const [notes, setNotes] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const textareaRef = useRef(null)

  // Closing clears the form, so the next incident starts blank. Done while
  // rendering when `open` flips (no effect, no extra render pass).
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (!open) {
      setNotes('')
      setImageFile(null)
      setImagePreview(null)
      setSubmitting(false)
    }
  }

  // Each preview URL is revoked once it is replaced, cleared or the modal
  // unmounts, so selected photos never leak memory.
  useEffect(() => {
    if (!imagePreview) return undefined
    return () => URL.revokeObjectURL(imagePreview)
  }, [imagePreview])

  useEffect(() => {
    if (!open) return
    const handleEsc = (e) => {
      // Don't allow closing mid-submit — the upload/resolve is in flight
      if (e.key === 'Escape' && !submitting) onClose()
    }
    document.addEventListener('keydown', handleEsc)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
    }
  }, [open, onClose, submitting])

  // Put the cursor where the user is about to type
  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 50)
  }, [open])

  function handleImageSelect(e) {
    const file = e.target.files?.[0]
    // Allow re-selecting the same file after removing it — without this,
    // choosing the same photo twice doesn't fire onChange.
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB')
      return
    }
    setImageFile(file)
    // Object URLs are cheaper than FileReader base64 for previews —
    // no reading the whole file into memory as a string.
    setImagePreview(URL.createObjectURL(file))
  }

  function removeImage() {
    setImageFile(null)
    setImagePreview(null)
  }

  async function handleSubmit() {
    if (submitting) return
    if (notes.trim().length < 5) {
      toast.error('Please provide a brief resolution note (at least 5 characters)')
      return
    }

    setSubmitting(true)
    let uploadedPath = null

    try {
      let imageUrl = null

      if (imageFile) {
        const ext = EXT_BY_MIME[imageFile.type] || 'jpg'
        // crypto.randomUUID() can't collide the way Date.now() + Math.random() can
        const fileName = `${userId}/resolutions/${crypto.randomUUID()}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('incident-images')
          .upload(fileName, imageFile, { contentType: imageFile.type })

        if (uploadError) {
          toast.error('Failed to upload photo: ' + uploadError.message)
          return
        }

        uploadedPath = fileName
        // The object path, not a URL — the bucket is private and viewers
        // sign their own short-lived URL (see lib/storage.js).
        imageUrl = fileName
      }

      await onResolve({
        notes: notes.trim(),
        imageUrl,
        resolvedAt: new Date().toISOString(),
      })
    } catch (err) {
      // Previously an error thrown by onResolve left the modal stuck on
      // "Resolving..." forever and orphaned the uploaded photo in storage.
      if (uploadedPath) {
        await supabase.storage.from('incident-images').remove([uploadedPath]).catch(() => {})
      }
      toast.error('Failed to resolve incident. Please try again.')
      console.error('ResolveModal submit failed:', err)
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  // T04 as a bottom sheet on phones, a dialog on wider screens (the same
  // chrome as the rating sheet).
  return (
    <div className="fixed inset-0 z-50 sheet-overlay bg-[var(--scrim)] [animation:sheetFade_.2s_ease_both]"
      onClick={() => { if (!submitting) onClose() }}>

      <div
        className="sheet-panel relative flex max-w-md flex-col overflow-hidden bg-surface shadow-[var(--shadow-float)] outline-none [animation:sheetUp_.32s_var(--ease-sheet)_both] sm:border sm:border-line"
        role="dialog"
        aria-modal="true"
        aria-labelledby="resolve-modal-title"
        onClick={e => e.stopPropagation()}>

        <span aria-hidden="true" className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-line sm:hidden" />
        <div className="flex items-start gap-3 px-[18px] pt-3.5 pb-1 sm:pt-[18px]">
          <div className="min-w-0 flex-1">
            <h2 id="resolve-modal-title" className="text-[17px] font-extrabold text-ink">Close the report</h2>
            <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{incident?.title}{incident?.location ? ` · ${incident.location}` : ''}</p>
          </div>
          <button onClick={onClose} disabled={submitting} aria-label="Close"
            className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-line bg-surface text-ink outline-none hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong disabled:opacity-50">
            <X size={18} strokeWidth={1.9} />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-[18px] py-4">
          <div>
            <label htmlFor="resolution-notes" className="mb-2 block text-[13px] font-bold text-ink">What did you do?</label>
            <textarea
              id="resolution-notes"
              ref={textareaRef}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4} maxLength={500}
              disabled={submitting}
              placeholder="What you found and what you did about it"
              className="w-full resize-none rounded-[10px] border border-line bg-surface px-3.5 py-3 text-[15px] leading-relaxed text-ink outline-none placeholder:text-muted-foreground focus:border-brand-strong disabled:opacity-60" />
            <p className="mt-1.5 text-xs text-muted-foreground">
              {notes.trim().length < 5 ? `At least 5 characters · ${notes.length} of 500` : `${notes.length} of 500`}
            </p>
          </div>

          <div>
            <p className="mb-2 text-[13px] font-bold text-ink">Photo of the scene <span className="font-normal text-muted-foreground">(optional)</span></p>
            {!imagePreview ? (
              <label className="flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-[10px] border border-dashed border-line-strong text-brand-strong hover:bg-surface-sunk focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-strong">
                <Camera size={20} aria-hidden="true" />
                <span className="text-xs font-bold">Add</span>
                <input type="file" accept="image/*" capture="environment"
                  onChange={handleImageSelect} disabled={submitting} className="sr-only" />
              </label>
            ) : (
              <div className="relative inline-block overflow-hidden rounded-[10px] border border-line">
                <img src={imagePreview} alt="Resolution photo" className="h-32 max-w-full object-cover" />
                <button onClick={removeImage} disabled={submitting} aria-label="Remove photo"
                  className="absolute top-1.5 right-1.5 flex size-8 items-center justify-center rounded-[8px] bg-surface text-ink shadow-[var(--shadow-lift)] disabled:opacity-50">
                  <X size={15} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-line px-[18px] pt-3 pb-[max(12px,env(safe-area-inset-bottom,0px))]">
          <p className="mb-2.5 text-center text-xs text-muted-foreground">The resident is told and can rate the response.</p>
          <Button size="lg" className="w-full" onClick={handleSubmit} disabled={submitting || notes.trim().length < 5} aria-busy={submitting || undefined}>
            {submitting ? <><Loader2 className="animate-spin" aria-hidden="true" />Resolving…</> : <><Check aria-hidden="true" />Mark as resolved</>}
          </Button>
        </div>
      </div>
    </div>
  )
}
