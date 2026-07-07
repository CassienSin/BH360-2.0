'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { CheckCircle, Upload, X, Camera, FileText, Loader2, Image as ImageIcon } from 'lucide-react'
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

  // Reset state whenever the modal closes, and revoke the preview URL
  // so each selected photo doesn't leak memory.
  useEffect(() => {
    if (!open) {
      setNotes('')
      setImageFile(null)
      setImagePreview(prev => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      setSubmitting(false)
    }
  }, [open])

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
    setImagePreview(prev => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
  }

  function removeImage() {
    setImageFile(null)
    setImagePreview(prev => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
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
        const { data: { publicUrl } } = supabase.storage
          .from('incident-images')
          .getPublicUrl(fileName)
        imageUrl = publicUrl
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
      onClick={() => { if (!submitting) onClose() }}>

      <div className="w-full max-w-md rounded-3xl overflow-hidden fade-up-1 max-h-[90vh] flex flex-col"
        style={{ background: 'white', boxShadow: '0 32px 80px rgba(0,0,0,0.3)' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="resolve-modal-title"
        onClick={e => e.stopPropagation()}>

        <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 8px 24px rgba(34,197,94,0.4)' }}>
              <CheckCircle size={22} className="text-white" />
            </div>
            <div>
              <h2 id="resolve-modal-title" className="text-lg font-bold text-gray-800">Mark as Resolved</h2>
              <p className="text-xs text-gray-400">Add details and proof of resolution</p>
            </div>
          </div>
          <button onClick={onClose} disabled={submitting} aria-label="Close"
            className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors flex-shrink-0 disabled:opacity-50">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-4">
          {/* Incident summary */}
          <div className="p-3 rounded-2xl" style={{ background: '#fafaff', border: '1px solid #f0effe' }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#5B54E8' }}>Resolving</p>
            <p className="text-sm font-bold text-gray-800">{incident?.title}</p>
            <p className="text-xs text-gray-400 mt-0.5">📍 {incident?.location}</p>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="resolution-notes"
              className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <FileText size={11} /> Resolution Notes <span className="text-red-500">*</span>
            </label>
            <textarea
              id="resolution-notes"
              ref={textareaRef}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4} maxLength={500}
              disabled={submitting}
              placeholder="What actions did you take to resolve this incident?"
              className="input-field w-full rounded-2xl px-4 py-3 text-sm text-gray-800 resize-none disabled:opacity-60" />
            <p className="text-xs text-gray-400 text-right mt-1">{notes.length}/500</p>
          </div>

          {/* Photo Evidence */}
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Camera size={11} /> Photo Evidence <span className="text-gray-300 font-normal">(Optional)</span>
            </span>

            {!imagePreview ? (
              <label className="block cursor-pointer">
                <div className="rounded-2xl p-5 text-center transition-all hover:scale-[1.01]"
                  style={{ background: '#fafaff', border: '2px dashed #e8e3ff' }}>
                  <div className="w-10 h-10 mx-auto rounded-xl flex items-center justify-center mb-2"
                    style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
                    <Upload size={16} className="text-white" />
                  </div>
                  <p className="text-xs font-bold text-gray-800">Tap to upload photo</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Proof of resolution helps build trust</p>
                </div>
                <input type="file" accept="image/*" capture="environment"
                  onChange={handleImageSelect} disabled={submitting} className="hidden" />
              </label>
            ) : (
              <div className="relative rounded-2xl overflow-hidden fade-up"
                style={{ border: '2px solid #dcfce7' }}>
                <img src={imagePreview} alt="Resolution proof" className="w-full max-h-48 object-cover" />
                <button onClick={removeImage} disabled={submitting} aria-label="Remove photo"
                  className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-50"
                  style={{ background: 'rgba(239,68,68,0.95)', color: 'white' }}>
                  <X size={14} />
                </button>
                <div className="absolute bottom-0 left-0 right-0 px-3 py-2 flex items-center gap-2"
                  style={{ background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.7))' }}>
                  <ImageIcon size={12} className="text-white" />
                  <p className="text-xs text-white font-semibold truncate">{imageFile?.name}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} disabled={submitting}
            className="flex-1 py-3 rounded-2xl text-sm font-bold transition-all hover:bg-gray-50 disabled:opacity-50"
            style={{ background: '#fafaff', color: '#6b7280', border: '1px solid #f0effe' }}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={submitting || notes.trim().length < 5}
            className="flex-1 py-3 rounded-2xl text-sm font-bold text-white transition-all hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100"
            style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 8px 32px rgba(34,197,94,0.4)' }}>
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Resolving...
              </span>
            ) : '✓ Confirm Resolution'}
          </button>
        </div>
      </div>
    </div>
  )
}