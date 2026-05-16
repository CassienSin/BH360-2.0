'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ArrowLeft, AlertTriangle, MapPin, FileText, Tag, Upload, X, Image as ImageIcon, Camera, Crosshair, Loader2, Zap } from 'lucide-react'
import dynamic from 'next/dynamic'
import toast from 'react-hot-toast'

const categories = [
  { value: 'Noise', label: 'Noise Complaint', icon: '🔊', color: '#f97316', bg: '#fff7ed' },
  { value: 'Theft', label: 'Theft / Robbery', icon: '🚨', color: '#ef4444', bg: '#fef2f2' },
  { value: 'Violence', label: 'Violence / Fight', icon: '⚠️', color: '#dc2626', bg: '#fef2f2' },
  { value: 'Fire', label: 'Fire', icon: '🔥', color: '#ea580c', bg: '#fff7ed' },
  { value: 'Flood', label: 'Flooding', icon: '🌊', color: '#3b82f6', bg: '#eff6ff' },
  { value: 'Infrastructure', label: 'Infrastructure', icon: '🛠️', color: '#8b5cf6', bg: '#f5f3ff' },
  { value: 'Animals', label: 'Stray Animals', icon: '🐕', color: '#a16207', bg: '#fefce8' },
  { value: 'Medical', label: 'Medical Emergency', icon: '🚑', color: '#dc2626', bg: '#fef2f2' },
  { value: 'Traffic', label: 'Traffic Issue', icon: '🚦', color: '#0891b2', bg: '#ecfeff' },
  { value: 'Vandalism', label: 'Vandalism', icon: '🎨', color: '#7c3aed', bg: '#f5f3ff' },
  { value: 'Drugs', label: 'Illegal Drugs', icon: '💊', color: '#be185d', bg: '#fdf2f8' },
  { value: 'Other', label: 'Other', icon: '📝', color: '#6b7280', bg: '#f9fafb' },
]

const priorities = [
  { value: 'Low', label: 'Low', desc: 'Non-urgent', color: '#22c55e', bg: '#f0fdf4', icon: '🟢' },
  { value: 'Medium', label: 'Medium', desc: 'Standard', color: '#3b82f6', bg: '#eff6ff', icon: '🔵' },
  { value: 'High', label: 'High', desc: 'Urgent', color: '#f97316', bg: '#fff7ed', icon: '🟠' },
  { value: 'Critical', label: 'Critical', desc: 'Emergency!', color: '#dc2626', bg: '#fef2f2', icon: '🔴' },
]

const dots = [...Array(20)].map((_, i) => ({
  size: (((i * 7) % 6) + 3),
  left: ((i * 17 + 13) % 100),
  top: ((i * 23 + 7) % 100),
  duration: ((i * 3) % 6) + 4,
  delay: (i * 0.7) % 4,
}))

const AnimatedDots = () => (
  <div className="absolute inset-0" style={{overflow: 'hidden', pointerEvents: 'none'}}>
    {dots.map((dot, i) => (
      <div key={i} style={{
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
      }} />
    ))}
  </div>
)

const MapPicker = dynamic(() => import('@/components/MapPicker'), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl flex items-center justify-center" style={{height: '250px', background: '#fafaff', border: '1px solid #f0effe'}}>
      <Loader2 size={20} className="animate-spin text-purple-500" />
    </div>
  ),
})

export default function ReportIncident() {
  const router = useRouter()
  const supabase = createClient()
  const [form, setForm] = useState({ title: '', description: '', location: '', category: '', priority: 'Medium' })
  const [loading, setLoading] = useState(false)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [coords, setCoords] = useState(null) // { lat, lng, accuracy }
  const [gettingLocation, setGettingLocation] = useState(false)

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
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
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: accuracy
        })
        setGettingLocation(false)

        if (accuracy > 1000) {
          toast.success(`Location set (~${(accuracy/1000).toFixed(1)}km accuracy). For better accuracy, adjust the pin on the map.`, { duration: 5000 })
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
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    )
  }

  function handleImageSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB')
      return
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file')
      return
    }

    setImageFile(file)
    const reader = new FileReader()
    reader.onloadend = () => setImagePreview(reader.result)
    reader.readAsDataURL(file)
  }

  function removeImage() {
    setImageFile(null)
    setImagePreview(null)
  }

  async function uploadImage(userId) {
    if (!imageFile) return null
    setUploading(true)

    const fileExt = imageFile.name.split('.').pop()
    const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

    const { error } = await supabase.storage
      .from('incident-images')
      .upload(fileName, imageFile, {
        cacheControl: '3600',
        upsert: false
      })

    setUploading(false)

    if (error) {
      toast.error('Failed to upload image: ' + error.message)
      return null
    }

    const { data: { publicUrl } } = supabase.storage
      .from('incident-images')
      .getPublicUrl(fileName)

    return publicUrl
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)

    if (!form.category) {
      toast.error('Please select a category.')
      setLoading(false); return
    }
    if (form.title.trim().length < 3) {
      toast.error('Title must be at least 3 characters.')
      setLoading(false); return
    }
    if (form.title.trim().length > 100) {
      toast.error('Title must be under 100 characters.')
      setLoading(false); return
    }
    if (form.description.trim().length < 10) {
      toast.error('Description must be at least 10 characters.')
      setLoading(false); return
    }
    if (form.description.trim().length > 1000) {
      toast.error('Description must be under 1000 characters.')
      setLoading(false); return
    }
    if (form.location.trim().length < 3) {
      toast.error('Please provide a more specific location.')
      setLoading(false); return
    }

    const { data: { user } } = await supabase.auth.getUser()
    const { data: prof } = await supabase.from('profiles').select('barangay_id').eq('id', user.id).single()

    if (!prof?.barangay_id) {
      toast.error('Your account is not assigned to a barangay.')
      setLoading(false); return
    }

    let imageUrl = null
    if (imageFile) {
      imageUrl = await uploadImage(user.id)
      if (!imageUrl) {
        setLoading(false); return
      }
    }

    const { error } = await supabase.from('incidents').insert({
      title: form.title.trim(),
      description: form.description.trim(),
      location: form.location.trim(),
      category: form.category,
      priority: form.priority,
      image_url: imageUrl,
      latitude: coords?.lat || null,
      longitude: coords?.lng || null,
      reported_by: user.id,
      barangay_id: prof.barangay_id,
      status: 'pending'
    })

    if (error) {
      toast.error('Failed to report incident. Please try again.')
      setLoading(false); return
    }

    toast.success('Incident reported successfully!')
    setTimeout(() => router.push('/resident'), 1000)
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-brand">
      <AnimatedDots />
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 right-20 w-96 h-96 rounded-full opacity-10"
          style={{background: 'white', filter: 'blur(80px)', animation: 'float 8s ease-in-out infinite'}} />
        <div className="absolute bottom-20 left-20 w-72 h-72 rounded-full opacity-10"
          style={{background: 'white', filter: 'blur(60px)', animation: 'floatReverse 10s ease-in-out infinite'}} />
      </div>

      <header className="bg-white relative z-10 px-6 py-4 flex items-center gap-3"
        style={{boxShadow: '0 2px 12px rgba(91,84,232,0.08)', borderBottom: '1px solid #f0effe'}}>
        <button onClick={() => router.back()}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-gray-100">
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-base font-bold text-gray-800">Report an Incident</h1>
          <p className="text-xs text-gray-400">Notify the barangay immediately</p>
        </div>
      </header>

      <main className="relative z-10 max-w-2xl mx-auto px-4 py-8">
        <div className="glass-card p-4 mb-6 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{background: 'rgba(255,255,255,0.2)'}}>
            <AlertTriangle size={18} className="text-white" />
          </div>
          <div>
            <p className="text-white text-sm font-semibold">Report an incident</p>
            <p className="text-purple-200 text-xs mt-0.5">Add a photo and pin location for faster response.</p>
          </div>
        </div>

        <div className="white-card p-6">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Category Selection */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Tag size={11} /> Category <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {categories.map(cat => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setForm({...form, category: cat.value})}
                    className="p-3 rounded-2xl flex flex-col items-center gap-1.5 text-center transition-all hover:scale-105"
                    style={{
                      background: form.category === cat.value ? cat.bg : '#fafaff',
                      border: `2px solid ${form.category === cat.value ? cat.color : '#f0effe'}`,
                      boxShadow: form.category === cat.value ? `0 4px 12px ${cat.color}25` : 'none',
                    }}>
                    <span className="text-2xl">{cat.icon}</span>
                    <span className="text-xs font-bold leading-tight"
                      style={{color: form.category === cat.value ? cat.color : '#6b7280'}}>
                      {cat.label}
                    </span>
                  </button>
                ))}
              </div>
              {form.category && (
                <p className="text-xs mt-2 flex items-center gap-1.5 fade-up" style={{color: categories.find(c => c.value === form.category)?.color}}>
                  ✓ Selected: <strong>{categories.find(c => c.value === form.category)?.label}</strong>
                </p>
              )}
            </div>

            {/* Priority Selection */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Zap size={11} /> Priority Level <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {priorities.map(p => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setForm({...form, priority: p.value})}
                      className="p-3 rounded-2xl flex flex-col items-center gap-1 text-center transition-all hover:scale-105 relative overflow-hidden"
                      style={{
                        background: form.priority === p.value ? p.bg : '#fafaff',
                        border: `2px solid ${form.priority === p.value ? p.color : '#f0effe'}`,
                        boxShadow: form.priority === p.value ? `0 4px 12px ${p.color}25` : 'none',
                      }}>
                      {form.priority === p.value && p.value === 'Critical' && (
                        <div className="absolute inset-0 pointer-events-none"
                          style={{background: `radial-gradient(circle at 50% 50%, ${p.color}10, transparent 70%)`, animation: 'pulse 2s ease-in-out infinite'}} />
                      )}
                      <span className="text-xl">{p.icon}</span>
                      <span className="text-xs font-bold leading-tight"
                        style={{color: form.priority === p.value ? p.color : '#6b7280'}}>
                        {p.label}
                      </span>
                      <span className="text-[10px]"
                        style={{color: form.priority === p.value ? p.color : '#9ca3af'}}>
                        {p.desc}
                      </span>
                    </button>
                  ))}
                </div>
                {form.priority === 'Critical' && (
                  <p className="text-xs mt-2 flex items-center gap-1.5 fade-up text-red-600 font-bold">
                    ⚠️ Critical incidents notify officials immediately and require urgent response!
                  </p>
                )}
              </div>

            {/* Title */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                Incident Title
              </label>
              <div className="relative">
                <AlertTriangle size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input name="title" value={form.title} onChange={handleChange} required maxLength={100}
                  className="input-field w-full rounded-2xl pl-10 pr-4 py-3 text-sm text-gray-800"
                  placeholder="Brief title for the incident..." />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                Description
              </label>
              <div className="relative">
                <FileText size={15} className="absolute left-3.5 top-3.5 text-gray-400" />
                <textarea name="description" value={form.description} onChange={handleChange} required rows={4} maxLength={1000}
                  className="input-field w-full rounded-2xl pl-10 pr-4 py-3 text-sm text-gray-800 resize-none"
                  placeholder="Describe the incident in detail..." />
              </div>
              <p className="text-xs text-gray-400 text-right mt-1">{form.description.length}/1000</p>
            </div>

            {/* Location */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                Location Description
              </label>
              <div className="relative">
                <MapPin size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input name="location" value={form.location} onChange={handleChange} required
                  className="input-field w-full rounded-2xl pl-10 pr-4 py-3 text-sm text-gray-800"
                  placeholder="e.g. Near Sitio 3 basketball court..." />
              </div>
            </div>

            {/* Map Picker */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <MapPin size={11} /> Pin on Map <span className="text-gray-300 font-normal">(Optional but helpful)</span>
              </label>

              <div className="flex gap-2 mb-3 flex-wrap">
                <button type="button" onClick={useMyLocation} disabled={gettingLocation}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105 disabled:opacity-50"
                  style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', color: 'white', boxShadow: '0 4px 12px rgba(91,84,232,0.3)'}}>
                  {gettingLocation ? <Loader2 size={12} className="animate-spin" /> : <Crosshair size={12} />}
                  {gettingLocation ? 'Getting location...' : 'Use My Location'}
                </button>
                {coords && (
                  <button type="button" onClick={() => setCoords(null)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors hover:bg-red-50"
                    style={{color: '#ef4444', border: '1px solid #fecaca'}}>
                    <X size={12} /> Clear
                  </button>
                )}
              </div>

              <MapPicker coords={coords} setCoords={setCoords} />

              {coords && (
                <div className="mt-2 flex items-center justify-between flex-wrap gap-2 fade-up">
                  <p className="text-xs flex items-center gap-1.5" style={{color: '#5B54E8'}}>
                    📍 <strong>Pinned:</strong> {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
                  </p>
                  {coords.accuracy && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                      style={{
                        background: coords.accuracy > 1000 ? '#fef3c7' : coords.accuracy > 100 ? '#dbeafe' : '#d1fae5',
                        color: coords.accuracy > 1000 ? '#92400e' : coords.accuracy > 100 ? '#1e40af' : '#065f46',
                      }}>
                      {coords.accuracy > 1000 ? `~${(coords.accuracy/1000).toFixed(1)}km` : `±${coords.accuracy}m`}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Image Upload */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Camera size={11} /> Photo Evidence <span className="text-gray-300 font-normal">(Optional)</span>
              </label>

              {!imagePreview ? (
                <label className="block cursor-pointer">
                  <div className="rounded-2xl p-8 text-center transition-all hover:scale-[1.01]"
                    style={{
                      background: '#fafaff',
                      border: '2px dashed #e8e3ff',
                    }}>
                    <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-3"
                      style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 8px 24px rgba(91,84,232,0.3)'}}>
                      <Upload size={20} className="text-white" />
                    </div>
                    <p className="text-sm font-bold text-gray-800 mb-1">Click to upload photo</p>
                    <p className="text-xs text-gray-400">JPG, PNG, GIF up to 5MB</p>
                    <p className="text-[10px] text-gray-300 mt-2">A photo helps officials respond faster</p>
                  </div>
                  <input type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                </label>
              ) : (
                <div className="relative rounded-2xl overflow-hidden group fade-up"
                  style={{border: '2px solid #e8e3ff'}}>
                  <img src={imagePreview} alt="Preview" className="w-full max-h-80 object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute top-3 right-3 flex gap-2">
                    <button type="button" onClick={removeImage}
                      className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-110"
                      style={{background: 'rgba(239,68,68,0.95)', color: 'white', boxShadow: '0 4px 12px rgba(239,68,68,0.4)'}}>
                      <X size={16} />
                    </button>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 px-4 py-3 flex items-center gap-2"
                    style={{background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.7))'}}>
                    <ImageIcon size={14} className="text-white" />
                    <p className="text-xs text-white font-semibold">{imageFile?.name}</p>
                    <span className="ml-auto text-xs text-white/80">{(imageFile?.size / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                </div>
              )}
            </div>

            <button type="submit" disabled={loading || !form.category}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-white font-semibold text-sm mt-2 disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  {uploading ? 'Uploading image...' : 'Submitting...'}
                </span>
              ) : 'Submit Report'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}