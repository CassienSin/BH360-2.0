'use client'
import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { loginHref } from '@/lib/loginRedirect'
import { goBack } from '@/lib/goBack'
import { createClient } from '@/lib/supabase'
import { KINDS } from '@/lib/offline/outbox'
import { enqueue } from '@/lib/offline/sync'
import { X, Camera, Crosshair, Loader2, Phone } from 'lucide-react'
import dynamic from 'next/dynamic'
import toast from 'react-hot-toast'
import imageCompression from 'browser-image-compression'
import { CATEGORY_LIST, getPriority, getBasis, citationDetail, PRIORITY_STYLE } from '@/lib/legalBasis'
import { useBarangayAvailability } from '@/lib/useBarangayAvailability'
import { AvailabilityStrip, EmergencyContacts, ReportOutcome } from '@/components/ResponderAvailability'
import PageShell from '@/components/crafted/PageShell'
import { CategoryIcon, categoryColor } from '@/lib/categoryIcons'
import { Card } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Tag } from '@/components/ui/tag'
import { Notice } from '@/components/ui/notice'

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

const MapPicker = dynamic(() => import('@/components/MapPicker'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center bg-track" style={{ height: 'var(--report-map-height, 200px)' }}>
      <Loader2 size={20} className="animate-spin text-brand-strong" aria-hidden="true" />
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

function PriorityGuidance({ basis }) {
  return (
    <div className="border-t border-line px-[18px] py-3.5 space-y-2 text-[13px] leading-[1.55] text-body">
      {basis.law && (
        <p>
          <strong className="text-brand-strong">{basis.law}{basis.sections ? `, ${basis.sections}` : ''}</strong> · {basis.lawTitle}
        </p>
      )}
      {/* What the cited provision actually says. Without this the citation
          is decoration — residents (and officials on review) can check the claim. */}
      {basis.provision && <p className="text-muted-foreground">{basis.provision}</p>}
      {basis.source && (
        <a href={basis.source} target="_blank" rel="noopener noreferrer" className="inline-block font-bold text-brand-strong hover:text-brand-deep">Read the law</a>
      )}
      <p>{basis.reason}</p>
      {basis.responseMode === 'refer_to_agency' && basis.agency && (
        <Notice tone="warn">This will be referred to <strong>{basis.agency}</strong>.</Notice>
      )}
    </div>
  )
}

// Plain words for the category grid (R02): a short name and a hint.
// The categories' own labels ("Medical Emergency") don't fit three across
// on a phone; the report still stores the category key, unchanged.
const CATEGORY_BLURB = {
  Fire: { label: 'Fire', desc: 'BFP leads · RA 9514' },
  Medical: { label: 'Medical', desc: 'Ambulance and first aid' },
  Flood: { label: 'Flood', desc: 'Rising water, blocked drains' },
  Violence: { label: 'Violence', desc: 'Fights, threats, abuse' },
  Theft: { label: 'Theft', desc: 'Stolen property, break-ins' },
  Noise: { label: 'Noise', desc: 'Karaoke, loud parties' },
  Traffic: { label: 'Traffic', desc: 'Accidents, blocked roads' },
  // A soft hyphen: three across on a phone, "Infra-" / "structure" wraps cleanly.
  Infrastructure: { label: 'Infra­structure', desc: 'Streetlights, roads, wires' },
  Garbage: { label: 'Garbage', desc: 'Missed collection, dumping' },
  Animals: { label: 'Animals', desc: 'Strays, bites' },
  Drugs: { label: 'Drugs', desc: 'Suspected drug activity' },
  Vandalism: { label: 'Vandalism', desc: 'Graffiti, damaged property' },
  Other: { label: 'Something else', desc: 'Describe it yourself' },
}

// Priority as a tag tone: red only for critical (DESIGN.md §7).
const PRIORITY_TONE = { Critical: 'danger', High: 'warn', Medium: 'quiet', Low: 'quiet' }

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
  const [step, setStep] = useState(1) // 1: what happened, 2: details and location
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

      let imageUrl = null
      let photoLost = false
      if (imageFile) {
        imageUrl = await uploadImage(user.id)
        if (!imageUrl) {
          // The photo could not be uploaded — almost always no signal. A
          // fire reported without a picture still gets a tanod sent; losing
          // the whole report because the picture would not go is worse than
          // losing the picture.
          photoLost = true
        }
      }

      // Priority comes from the category mapping, never from user input.
      // auto_escalated is always true: every priority in this system is
      // law-assigned rather than reporter-selected.
      const finalPriority = getPriority(form.category)

      // .select().single() returns the row AFTER the auto-assign trigger has
      // run, so the outcome screen can tell the resident the truth about
      // whether anyone actually picked it up.
      // The id is ours, not the database's. If this ends up queued and
      // replayed, the upsert conflicts on it rather than filing the same
      // fire a second time.
      const row = {
        id: crypto.randomUUID(),
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
      }

      const { data: created, error } = await supabase.from('incidents')
        .insert(row).select().single()

      if (error) {
        const queued = await enqueue(KINDS.REPORT, { row }, { userId: user.id })
        if (!queued) {
          toast.error('Failed to report incident. Please try again.')
          return
        }
        toast(photoLost
          ? 'No signal — your report is saved and will be sent when you reconnect. The photo could not be attached.'
          : 'No signal — your report is saved and will be sent the moment you reconnect.',
          { icon: '📡', duration: 8000 })
        // The outcome screen runs off the row we built. It cannot say who
        // was dispatched, because nothing has been yet.
        setOutcome({ ...row, queuedOffline: true })
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }

      if (photoLost) {
        toast('Your report was filed, but the photo could not be uploaded.',
          { icon: '📷', duration: 7000 })
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

  // The report is two steps on screen (R02 what happened, R03 details);
  // one form and one submit, exactly as before.
  const chosen = CATEGORIES.find(c => c.value === form.category)
  const back = () => {
    if (outcome) return router.replace('/resident')
    if (step === 2) return setStep(1)
    goBack(router, '/resident')
  }

  if (outcome) {
    return (
      <PageShell title="Report sent" sub="What happens next" onBack={back} backLabel="Back to home">
        <ReportOutcome
          incident={outcome}
          availability={availability}
          barangayPhone={barangayPhone}
          onDone={() => router.replace('/resident')}
        />
      </PageShell>
    )
  }

  if (step === 1) {
    return (
      <PageShell
        title="Report an incident"
        sub="Step 1 of 2 · What happened?"
        onBack={back}
        maxWidth={720}
        bandContent={(
          <a href="tel:911" className="flex items-center gap-2.5 rounded-[12px] bg-danger-soft px-3.5 py-3 shadow-[var(--shadow-lift)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            <Phone size={16} strokeWidth={2} className="shrink-0 text-danger" aria-hidden="true" />
            <span className="flex-1 text-sm font-bold text-danger">Life in danger? Call 911 first.</span>
            <span className="text-sm font-extrabold text-danger">Call</span>
          </a>
        )}
        footer={
          <Button size="lg" full disabled={!form.category} onClick={() => setStep(2)}>Continue</Button>
        }>
        {/* Who is actually available to receive this, right now. Often
            this says "nobody" — that is deliberate. A resident who
            knows nobody is on duty calls 911 in seconds; one who
            assumes a tanod is coming waits twenty minutes. */}
        <AvailabilityStrip availability={availability} compact />

        <fieldset>
          <legend className="sr-only">What happened?</legend>
          <div className="grid grid-cols-2 min-[380px]:grid-cols-3 gap-2.5">
            {CATEGORIES.map(cat => {
              const selected = form.category === cat.value
              return (
                <button key={cat.value} type="button" aria-pressed={selected}
                  onClick={() => setForm(prev => ({ ...prev, category: cat.value }))}
                  className={`flex min-h-[118px] flex-col items-start rounded-[12px] bg-surface text-left transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong ${selected ? 'border-2 border-brand-strong p-[11px]' : 'border border-line p-3 hover:border-line-strong'}`}>
                  <CategoryIcon category={cat.value} size={22} active={selected} style={{ color: categoryColor(cat.value) }} />
                  <span className="mt-2.5 max-w-full text-[15px] max-[419px]:text-[14px] font-extrabold leading-tight text-ink hyphens-manual">{CATEGORY_BLURB[cat.value]?.label || cat.label}</span>
                  <span className="mt-1 text-xs leading-[1.4] text-muted-foreground">{CATEGORY_BLURB[cat.value]?.desc || ''}</span>
                </button>
              )
            })}
          </div>
        </fieldset>
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Report an incident"
      sub="Step 2 of 2 · Details and location"
      onBack={back}
      maxWidth={720}
      bandContent={chosen && (
        <div className="flex items-center gap-3 rounded-[12px] bg-surface px-3.5 py-2.5 shadow-[var(--shadow-lift)]">
          <CategoryIcon category={chosen.value} size={22} style={{ color: categoryColor(chosen.value) }} />
          <span className="flex-1 text-[15px] font-extrabold text-ink">{CATEGORY_BLURB[chosen.value]?.label || chosen.label}</span>
          <Button variant="ghost" size="sm" className="-mr-2" onClick={() => setStep(1)}>Change</Button>
        </div>
      )}
      footer={
        <>
          <p className="text-center text-xs text-muted-foreground">Saved on your phone if you lose signal. It sends when you are back online.</p>
          <Button type="submit" form="report-form" variant="danger" size="lg" full
            disabled={loading || compressing || !form.category} aria-busy={loading || undefined}>
            {loading ? <><Loader2 className="animate-spin" aria-hidden="true" />{uploading ? 'Uploading the photo…' : 'Sending…'}</> : 'Send report'}
          </Button>
        </>
      }>
      <form id="report-form" onSubmit={handleSubmit} className="flex flex-col gap-4">

        {/* Priority is assigned from the category by the law that governs
            it — never chosen by the resident. */}
        {basis && priorityStyle && (
          <Card role="status" aria-live="polite">
            <div className="flex items-center gap-2 px-[18px] pt-3.5">
              <span className="flex-1 text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase">Priority, set by the law</span>
              <Tag tone={PRIORITY_TONE[assignedPriority] || 'quiet'}>{priorityStyle.label}</Tag>
            </div>
            <details className="group">
              <summary className="cursor-pointer list-none px-[18px] pt-1 pb-3.5 text-[13px] text-body outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-strong">
                {priorityStyle.desc}. <span className="font-bold text-brand-strong group-open:hidden">Why?</span>
              </summary>
              <PriorityGuidance basis={basis} />
            </details>
          </Card>
        )}

        {/* Emergency numbers — shown when the barangay legally cannot
            handle this (fire, medical) or when nobody is on duty */}
        <EmergencyContacts category={form.category} availability={availability} barangayPhone={barangayPhone} />

        <Field id="incident-title" label="Short title" name="title" value={form.title} onChange={handleChange}
          required maxLength={TITLE_MAX} placeholder="What happened, in a few words" />

        <Field id="incident-description" label="What did you see?" hint={`${form.description.length} of ${DESC_MAX}`}>
          <Textarea name="description" value={form.description} onChange={handleChange} required rows={4} maxLength={DESC_MAX}
            placeholder="Who, what, and anything a tanod should know before arriving" />
        </Field>

        {/* Photo */}
        <div>
          <p className="mb-1.5 text-[13px] font-bold text-ink">Photo<span className="font-normal text-muted-foreground"> · optional</span></p>
          <div className="flex flex-wrap gap-2.5">
            {imagePreview && (
              <div className="relative size-[72px] overflow-hidden rounded-[10px] border border-line">
                <img src={imagePreview} alt="Selected photo" className="size-full object-cover" />
                <button type="button" onClick={removeImage} aria-label="Remove photo"
                  className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-[rgba(26,24,48,0.7)] text-white">
                  <X size={13} strokeWidth={2.2} aria-hidden="true" />
                </button>
              </div>
            )}
            <label className={`flex size-[72px] cursor-pointer flex-col items-center justify-center gap-1 rounded-[10px] border border-dashed border-line-strong bg-surface text-brand-strong ${compressing ? 'opacity-70' : 'hover:border-brand-strong'}`}>
              {compressing ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Camera size={18} strokeWidth={1.9} aria-hidden="true" />}
              <span className="text-xs font-bold">{compressing ? 'Shrinking' : imagePreview ? 'Replace' : 'Add'}</span>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={handleImageSelect} className="sr-only" />
            </label>
          </div>
          {imageFile && originalSize && originalSize > imageFile.size && (
            <p className="mt-1.5 text-xs text-muted-foreground">Shrunk from {(originalSize / 1024 / 1024).toFixed(1)} MB to {imageFile.size > 1024 * 1024 ? `${(imageFile.size / 1024 / 1024).toFixed(2)} MB` : `${Math.round(imageFile.size / 1024)} KB`} so it sends faster.</p>
          )}
        </div>

        {/* Location */}
        <div>
          <p className="mb-1.5 text-[13px] font-bold text-ink">Location</p>
          <Card>
            <div className="relative">
              <MapPicker bare coords={coords} setCoords={setCoords} height="var(--report-map-height, 200px)" />
              <div className="absolute bottom-2.5 left-2.5 z-[3] flex gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={useMyLocation} disabled={gettingLocation} className="shadow-[var(--shadow-lift)]">
                  {gettingLocation ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Crosshair aria-hidden="true" />}
                  {gettingLocation ? 'Finding you…' : 'Use my location'}
                </Button>
                {coords && (
                  <Button type="button" variant="secondary" size="sm" onClick={() => setCoords(null)} className="shadow-[var(--shadow-lift)]">Clear pin</Button>
                )}
              </div>
            </div>
            <div className="border-t border-line px-3.5 pt-3 pb-3.5">
              <label htmlFor="incident-location" className="sr-only">Where it happened</label>
              <Input id="incident-location" name="location" value={form.location} onChange={handleChange}
                required maxLength={LOCATION_MAX} placeholder="Street, landmark, purok" />
              <p className={`mt-1.5 text-xs ${coords ? 'text-ok' : 'text-muted-foreground'}`}>
                {coords
                  ? `Pinned at ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}${coords.accuracy != null ? ` · GPS accurate to ${coords.accuracy > 1000 ? `${(coords.accuracy / 1000).toFixed(1)} km` : `${coords.accuracy} m`}` : ''}`
                  : 'Tap the map or use your location so the tanod finds it fast.'}
              </p>
            </div>
          </Card>
        </div>
      </form>
    </PageShell>
  )
}
