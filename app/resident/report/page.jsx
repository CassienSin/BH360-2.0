'use client'
import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ArrowLeft, AlertTriangle, MapPin, FileText, Tag, Upload, X, Image as ImageIcon, Camera, Crosshair, Loader2, Scale, ShieldAlert } from 'lucide-react'
import dynamic from 'next/dynamic'
import toast from 'react-hot-toast'
import imageCompression from 'browser-image-compression'
import { CATEGORY_LIST, getPriority, getBasis, citationDetail, PRIORITY_STYLE } from '@/lib/legalBasis'
import { useBarangayAvailability } from '@/lib/useBarangayAvailability'
import { AvailabilityStrip, EmergencyContacts, ReportOutcome } from '@/components/ResponderAvailability'

const TITLE_MIN = 3
const TITLE_MAX = 100
const DESC_MIN = 10
const DESC_MAX = 1000
const LOCATION_MIN = 3
const LOCATION_MAX = 200
const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB (hard cap after compression)
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
// Skip compression if the file is already small
const COMPRESS_THRESHOLD = 400 * 1024 // 400KB
const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.5,          // target ~500KB
  maxWidthOrHeight: 1920,  // plenty of detail for incident evidence
  useWebWorker: true,      // don't block the UI thread
  initialQuality: 0.8,
}

// The category list — icons, labels and colours included — comes from
// lib/legalBasis.js, where each one is defined alongside the law that
// governs it. A category with no legal basis cannot appear here.
const CATEGORIES = CATEGORY_LIST

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
      <div
        key={i}
        style={{
          position: 'absolute',
          width: `${dot.size}px`,
          height: `${dot.size}px`,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.4)',
          left: `${dot.left}%`,
          top: `${dot.top}%`,
          animation: `float ${dot.duration}s ease-in-out infinite`,
          animationDelay: `${dot.delay}s`,
          filter: 'blur(0.5px)',
        }}
      />
    ))}
  </div>
)

const MapPicker = dynamic(() => import('@/components/MapPicker'), {
  ssr: false,
  loading: () => (
    <div
      className="rounded-2xl flex items-center justify-center"
      style={{ height: '250px', background: '#fafaff', border: '1px solid #f0effe' }}
    >
      <Loader2 size={20} className="animate-spin text-purple-500" />
    </div>
  ),
})

/** Returns an error message string, or null if the form is valid. */
function validateForm(form) {
  if (!form.category) return 'Please select what happened.'
  const title = form.title.trim()
  if (title.length < TITLE_MIN) return `Title must be at least ${TITLE_MIN} characters.`
  if (title.length > TITLE_MAX) return `Title must be under ${TITLE_MAX} characters.`
  const description = form.description.trim()
  if (description.length < DESC_MIN) return `Description must be at least ${DESC_MIN} characters.`
  if (description.length > DESC_MAX) return `Description must be under ${DESC_MAX} characters.`
  const location = form.location.trim()
  if (location.length < LOCATION_MIN) return 'Please provide a more specific location.'
  if (location.length > LOCATION_MAX) return `Location must be under ${LOCATION_MAX} characters.`
  return null
}

export default function ReportIncident() {
  const router = useRouter()
  // Memoize so we don't create a new client on every render
  const supabase = useMemo(() => createClient(), [])

  // NOTE: there is no `priority` field in this form. Priority is derived
  // from the category via lib/legalBasis.js — residents describe what
  // happened, the system determines urgency. This prevents a noise
  // complaint from being filed as "Critical" and displacing a real
  // emergency in the officials' response queue.
  const [form, setForm] = useState({ title: '', description: '', location: '', category: '' })
  const [loading, setLoading] = useState(false)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [originalSize, setOriginalSize] = useState(null) // bytes, before compression
  const [compressing, setCompressing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [coords, setCoords] = useState(null) // { lat, lng, accuracy }
  const [gettingLocation, setGettingLocation] = useState(false)
  const fileInputRef = useRef(null)

  // Barangay context, loaded up front so the availability strip can render
  // while the resident is still filling in the form
  const [barangayId, setBarangayId] = useState(null)
  const [barangayPhone, setBarangayPhone] = useState(null)
  const [outcome, setOutcome] = useState(null) // the created incident, post-submit
  const availability = useBarangayAvailability(barangayId)

  useEffect(() => {
    let cancelled = false
    async function loadBarangay() {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user || cancelled) return
      // The embedded barangays(phone) column has to exist in the database
      // for this whole select to succeed — when it did not, `data` came back
      // null and took barangay_id down with it, silently disabling the
      // responder-availability strip and the emergency-contacts card. Log
      // the error rather than swallowing it, so the next schema drift is
      // visible instead of just quietly turning a feature off.
      const { data, error } = await supabase
        .from('profiles')
        .select('barangay_id, barangays(phone)')
        .eq('id', user.id)
        .single()
      if (cancelled) return
      if (error) console.error('Could not load barangay context:', error)
      setBarangayId(data?.barangay_id ?? null)
      setBarangayPhone(data?.barangays?.phone ?? null)
    }
    loadBarangay()
    return () => { cancelled = true }
  }, [supabase])

  // Revoke the object URL when the preview changes or on unmount (avoids memory leaks)
  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview)
    }
  }, [imagePreview])

  const selectedCategory = useMemo(
    () => CATEGORIES.find(c => c.value === form.category) || null,
    [form.category]
  )

  // ── Automated legal classification ────────────────────────────────────
  const basis = form.category ? getBasis(form.category) : null
  const assignedPriority = form.category ? getPriority(form.category) : null
  const priorityStyle = assignedPriority ? PRIORITY_STYLE[assignedPriority] : null

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser')
      return
    }
    setGettingLocation(true)

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const accuracy = Math.round(pos.coords.accuracy)
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy })
        setGettingLocation(false)

        if (accuracy > 1000) {
          toast.success(`Location set (~${(accuracy / 1000).toFixed(1)}km accuracy). For better accuracy, adjust the pin on the map.`, { duration: 5000 })
        } else if (accuracy > 100) {
          toast.success(`Location set (~${accuracy}m accuracy). You can fine-tune by tapping the map.`, { duration: 4000 })
        } else {
          toast.success(`Location set with high accuracy! (${accuracy}m)`)
        }
      },
      (err) => {
        let message = 'Could not get your location.'
        if (err.code === 1) message = 'Location permission denied. Please allow access or pick on the map.'
        if (err.code === 2) message = 'Location unavailable. Please pick on the map.'
        if (err.code === 3) message = 'Location request timed out. Please try again.'
        toast.error(message + ' You can also click on the map to pin manually.', { duration: 5000 })
        setGettingLocation(false)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  async function handleImageSelect(e) {
    const file = e.target.files?.[0]
    // Reset the input so re-selecting the same file still fires onChange
    e.target.value = ''
    if (!file) return

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error('Please select a JPG, PNG, GIF, or WebP image.')
      return
    }

    let finalFile = file

    // Compress large stills; skip GIFs (compression would drop animation)
    // and files that are already small.
    if (file.type !== 'image/gif' && file.size > COMPRESS_THRESHOLD) {
      setCompressing(true)
      try {
        const compressed = await imageCompression(file, COMPRESSION_OPTIONS)
        // Re-wrap so the original filename is preserved
        finalFile = new File([compressed], file.name, { type: compressed.type })
      } catch (err) {
        // Compression failing shouldn't block the report — fall back to the original
        console.warn('Image compression failed, using original file:', err)
      } finally {
        setCompressing(false)
      }
    }

    // Hard cap still applies (covers GIFs and failed compression)
    if (finalFile.size > MAX_IMAGE_SIZE) {
      toast.error('Image must be under 5MB. Try a smaller photo.')
      return
    }

    setOriginalSize(file.size)
    setImageFile(finalFile)
    // Object URLs are instant and lighter than base64 data URLs
    setImagePreview(prev => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(finalFile)
    })
  }

  const removeImage = useCallback(() => {
    setImageFile(null)
    setOriginalSize(null)
    setImagePreview(prev => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  async function uploadImage(userId) {
    setUploading(true)
    try {
      // Derive a safe extension from MIME type rather than trusting the filename
      const ext = (imageFile.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
      const fileName = `${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`

      const { error } = await supabase.storage
        .from('incident-images')
        .upload(fileName, imageFile, { cacheControl: '3600', upsert: false })

      if (error) {
        toast.error('Failed to upload image: ' + error.message)
        return null
      }

      // Store the OBJECT PATH, not a URL. The bucket is private, so there is
      // no durable URL to keep — every viewer signs their own, briefly, via
      // lib/storage.js. Rows written before this still hold a full public
      // URL and keep working: incidentImagePath() accepts both.
      return fileName
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (loading) return

    // Validate before setting loading — no need to toggle state for invalid input
    const validationError = validateForm(form)
    if (validationError) {
      toast.error(validationError)
      return
    }

    setLoading(true)
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        toast.error('Your session has expired. Please log in again.')
        router.replace('/login')
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

      let imageUrl = null
      if (imageFile) {
        imageUrl = await uploadImage(user.id)
        if (!imageUrl) return // uploadImage already showed a toast
      }

      // Priority comes from the category mapping, never from user input.
      // auto_escalated is always true: every priority in this system is
      // law-assigned rather than reporter-selected.
      const finalPriority = getPriority(form.category)

      // .select().single() returns the row AFTER the auto-assign trigger has
      // run, so the outcome screen can tell the resident the truth about
      // whether anyone actually picked it up.
      const { data: created, error } = await supabase.from('incidents').insert({
        title: form.title.trim(),
        description: form.description.trim(),
        location: form.location.trim(),
        category: form.category,
        priority: finalPriority,
        // Audit trail: the citation is frozen at report time, so later
        // edits to lib/legalBasis.js never rewrite past classifications
        legal_basis: citationDetail(form.category),
        response_mode: basis?.responseMode ?? null,
        auto_escalated: true,
        image_url: imageUrl,
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
        reported_by: user.id,
        barangay_id: prof.barangay_id,
        status: 'pending',
      }).select().single()

      if (error) {
        toast.error('Failed to report incident. Please try again.')
        return
      }

      // Show the outcome instead of redirecting — the resident needs to know
      // whether a responder is actually coming
      setOutcome(created)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      console.error('Incident submit failed:', err)
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-brand">
      <AnimatedDots />
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div
          className="absolute top-20 right-20 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'white', filter: 'blur(80px)', animation: 'float 8s ease-in-out infinite' }}
        />
        <div
          className="absolute bottom-20 left-20 w-72 h-72 rounded-full opacity-10"
          style={{ background: 'white', filter: 'blur(60px)', animation: 'floatReverse 10s ease-in-out infinite' }}
        />
      </div>

      <header
        className="bg-white relative z-10 px-6 py-4 flex items-center gap-3"
        style={{ boxShadow: '0 2px 12px rgba(91,84,232,0.08)', borderBottom: '1px solid #f0effe' }}
      >
        <button
          onClick={() => (outcome ? router.replace('/resident') : router.back())}
          aria-label="Go back"
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-gray-100"
        >
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-base font-bold text-gray-800">
            {outcome ? 'Report submitted' : 'Report an Incident'}
          </h1>
          <p className="text-xs text-gray-400">
            {outcome ? 'What happens next' : 'Notify the barangay immediately'}
          </p>
        </div>
      </header>

      <main className="relative z-10 max-w-2xl mx-auto px-4 py-8">
        {!outcome && (
          <>
            <div className="glass-card p-4 mb-4 flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.2)' }}
              >
                <AlertTriangle size={18} className="text-white" />
              </div>
              <div>
                <p className="text-white text-sm font-semibold">Report an incident</p>
                <p className="text-purple-200 text-xs mt-0.5">
                  Just describe what happened — urgency is assigned automatically based on Philippine law.
                </p>
              </div>
            </div>

            {/* Who is actually available to receive this, right now. Often
                this says "nobody" — that is deliberate. A resident who
                knows nobody is on duty calls 911 in seconds; one who
                assumes a tanod is coming waits twenty minutes. */}
            <div className="mb-6">
              <AvailabilityStrip availability={availability} />
            </div>
          </>
        )}

        <div className="white-card p-6">
          {outcome ? (
            <ReportOutcome
              incident={outcome}
              availability={availability}
              barangayPhone={barangayPhone}
              onDone={() => router.replace('/resident')}
            />
          ) : (
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Category Selection — this alone determines priority */}
            <fieldset>
              <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Tag size={11} /> What happened? <span className="text-red-500">*</span>
              </legend>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CATEGORIES.map(cat => {
                  const selected = form.category === cat.value
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setForm(prev => ({ ...prev, category: cat.value }))}
                      className="p-3 rounded-2xl flex flex-col items-center gap-1.5 text-center transition-all hover:scale-105"
                      style={{
                        background: selected ? cat.bg : '#fafaff',
                        border: `2px solid ${selected ? cat.color : '#f0effe'}`,
                        boxShadow: selected ? `0 4px 12px ${cat.color}25` : 'none',
                      }}
                    >
                      <span className="text-2xl" aria-hidden="true">{cat.icon}</span>
                      <span className="text-xs font-bold leading-tight" style={{ color: selected ? cat.color : '#6b7280' }}>
                        {cat.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </fieldset>

            {/* ── Automated priority assignment ──────────────────────────
                Replaces the old resident-selected priority picker.
                Shows the assigned level, the governing law, the reasoning,
                and (for referral categories) which agency handles it. */}
            {basis && priorityStyle && (
              <div
                className="rounded-2xl overflow-hidden fade-up"
                style={{ border: `2px solid ${priorityStyle.color}30` }}
                role="status"
                aria-live="polite"
              >
                <div className="px-4 py-3 flex items-center gap-3" style={{ background: priorityStyle.bg }}>
                  <span className="text-2xl" aria-hidden="true">{priorityStyle.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: priorityStyle.color }}>
                      Priority assigned automatically
                    </p>
                    <p className="text-base font-black leading-tight" style={{ color: priorityStyle.color }}>
                      {priorityStyle.label}
                      <span className="text-xs font-semibold opacity-70"> · {priorityStyle.desc}</span>
                    </p>
                  </div>
                </div>

                <div className="px-4 py-3" style={{ background: 'white' }}>
                  {basis.law && (
                    <div className="flex items-start gap-2 mb-2">
                      <Scale size={13} className="flex-shrink-0 mt-0.5" style={{ color: '#5B54E8' }} aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-xs leading-relaxed text-gray-700">
                          <strong style={{ color: '#5B54E8' }}>{basis.law}</strong>
                          {basis.sections && (
                            <span className="font-semibold" style={{ color: '#5B54E8' }}>{', '}{basis.sections}</span>
                          )}
                          {' — '}{basis.lawTitle}
                        </p>
                        {/* What the cited provision actually says. Without
                            this the citation is decoration — residents (and
                            officials on review) can check the claim. */}
                        {basis.provision && (
                          <p className="text-[11px] text-gray-500 leading-relaxed mt-1">{basis.provision}</p>
                        )}
                        {basis.source && (
                          <a
                            href={basis.source}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block text-[11px] font-semibold mt-1 underline"
                            style={{ color: '#5B54E8' }}
                          >
                            Read the law
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                  <p className="text-[11px] text-gray-500 leading-relaxed">{basis.reason}</p>

                  {basis.responseMode === 'refer_to_agency' && basis.agency && (
                    <div
                      className="mt-2.5 px-3 py-2 rounded-xl flex items-start gap-2"
                      style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}
                    >
                      <ShieldAlert size={12} className="flex-shrink-0 mt-0.5 text-orange-600" aria-hidden="true" />
                      <p className="text-[11px] text-orange-800 leading-relaxed">
                        This will be referred to <strong>{basis.agency}</strong>.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Emergency numbers — shown when the barangay legally cannot
                handle this (fire, medical) or when nobody is on duty */}
            <EmergencyContacts
              category={form.category}
              availability={availability}
              barangayPhone={barangayPhone}
            />

            {/* Title */}
            <div>
              <label htmlFor="incident-title" className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                Incident Title <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <AlertTriangle size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <input
                  id="incident-title"
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  required
                  maxLength={TITLE_MAX}
                  className="input-field w-full rounded-2xl pl-10 pr-4 py-3 text-sm text-gray-800"
                  placeholder="Brief title for the incident..."
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="incident-description" className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                Description <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <FileText size={15} className="absolute left-3.5 top-3.5 text-gray-400" aria-hidden="true" />
                <textarea
                  id="incident-description"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  required
                  rows={4}
                  maxLength={DESC_MAX}
                  className="input-field w-full rounded-2xl pl-10 pr-4 py-3 text-sm text-gray-800 resize-none"
                  placeholder="Describe the incident in detail..."
                />
              </div>
              <p className="text-xs text-gray-400 text-right mt-1">{form.description.length}/{DESC_MAX}</p>
            </div>

            {/* Location */}
            <div>
              <label htmlFor="incident-location" className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                Location Description <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <MapPin size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <input
                  id="incident-location"
                  name="location"
                  value={form.location}
                  onChange={handleChange}
                  required
                  maxLength={LOCATION_MAX}
                  className="input-field w-full rounded-2xl pl-10 pr-4 py-3 text-sm text-gray-800"
                  placeholder="e.g. Near Sitio 3 basketball court..."
                />
              </div>
            </div>

            {/* Map Picker */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <MapPin size={11} /> Pin on Map <span className="text-gray-300 font-normal">(Optional but helpful)</span>
              </p>

              <div className="flex gap-2 mb-3 flex-wrap">
                <button
                  type="button"
                  onClick={useMyLocation}
                  disabled={gettingLocation}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', color: 'white', boxShadow: '0 4px 12px rgba(91,84,232,0.3)' }}
                >
                  {gettingLocation ? <Loader2 size={12} className="animate-spin" /> : <Crosshair size={12} />}
                  {gettingLocation ? 'Getting location...' : 'Use My Location'}
                </button>
                {coords && (
                  <button
                    type="button"
                    onClick={() => setCoords(null)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors hover:bg-red-50"
                    style={{ color: '#ef4444', border: '1px solid #fecaca' }}
                  >
                    <X size={12} /> Clear
                  </button>
                )}
              </div>

              <MapPicker coords={coords} setCoords={setCoords} />

              {coords && (
                <div className="mt-2 flex items-center justify-between flex-wrap gap-2 fade-up">
                  <p className="text-xs flex items-center gap-1.5" style={{ color: '#5B54E8' }}>
                    📍 <strong>Pinned:</strong> {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
                  </p>
                  {coords.accuracy != null && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-bold"
                      style={{
                        background: coords.accuracy > 1000 ? '#fef3c7' : coords.accuracy > 100 ? '#dbeafe' : '#d1fae5',
                        color: coords.accuracy > 1000 ? '#92400e' : coords.accuracy > 100 ? '#1e40af' : '#065f46',
                      }}
                    >
                      {coords.accuracy > 1000 ? `~${(coords.accuracy / 1000).toFixed(1)}km` : `±${coords.accuracy}m`}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Image Upload */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Camera size={11} /> Photo Evidence <span className="text-gray-300 font-normal">(Optional)</span>
              </p>

              {compressing ? (
                <div
                  className="rounded-2xl p-8 text-center"
                  style={{ background: '#fafaff', border: '2px dashed #e8e3ff' }}
                  role="status"
                >
                  <div
                    className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-3"
                    style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 8px 24px rgba(91,84,232,0.3)' }}
                  >
                    <Loader2 size={20} className="animate-spin text-white" />
                  </div>
                  <p className="text-sm font-bold text-gray-800 mb-1">Optimizing photo...</p>
                  <p className="text-xs text-gray-400">Shrinking the file so it uploads faster</p>
                </div>
              ) : !imagePreview ? (
                <label className="block cursor-pointer">
                  <div
                    className="rounded-2xl p-8 text-center transition-all hover:scale-[1.01]"
                    style={{ background: '#fafaff', border: '2px dashed #e8e3ff' }}
                  >
                    <div
                      className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-3"
                      style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 8px 24px rgba(91,84,232,0.3)' }}
                    >
                      <Upload size={20} className="text-white" />
                    </div>
                    <p className="text-sm font-bold text-gray-800 mb-1">Click to upload photo</p>
                    <p className="text-xs text-gray-400">JPG, PNG, GIF, WebP — large photos are optimized automatically</p>
                    <p className="text-[10px] text-gray-300 mt-2">A photo helps officials respond faster</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                </label>
              ) : (
                <div className="relative rounded-2xl overflow-hidden group fade-up" style={{ border: '2px solid #e8e3ff' }}>
                  <img src={imagePreview} alt="Selected photo preview" className="w-full max-h-80 object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute top-3 right-3 flex gap-2">
                    <button
                      type="button"
                      onClick={removeImage}
                      aria-label="Remove photo"
                      className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-110"
                      style={{ background: 'rgba(239,68,68,0.95)', color: 'white', boxShadow: '0 4px 12px rgba(239,68,68,0.4)' }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div
                    className="absolute bottom-0 left-0 right-0 px-4 py-3 flex items-center gap-2"
                    style={{ background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.7))' }}
                  >
                    <ImageIcon size={14} className="text-white" aria-hidden="true" />
                    <p className="text-xs text-white font-semibold truncate">{imageFile?.name}</p>
                    <span className="ml-auto text-xs text-white/80 flex-shrink-0">
                      {imageFile && originalSize && originalSize > imageFile.size ? (
                        <>
                          <s className="opacity-60">{(originalSize / 1024 / 1024).toFixed(1)} MB</s>
                          {' → '}
                          {imageFile.size > 1024 * 1024
                            ? `${(imageFile.size / 1024 / 1024).toFixed(2)} MB`
                            : `${Math.round(imageFile.size / 1024)} KB`}
                        </>
                      ) : (
                        imageFile
                          ? imageFile.size > 1024 * 1024
                            ? `${(imageFile.size / 1024 / 1024).toFixed(2)} MB`
                            : `${Math.round(imageFile.size / 1024)} KB`
                          : '0 KB'
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || compressing || !form.category}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-white font-semibold text-sm mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  {uploading ? 'Uploading image...' : 'Submitting...'}
                </span>
              ) : 'Submit Report'}
            </button>
          </form>
          )}
        </div>
      </main>
    </div>
  )
}