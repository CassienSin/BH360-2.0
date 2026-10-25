'use client'
import desktop from '@/components/desktop-pages.module.css'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Send, User, Mail, Phone, Briefcase, MapPin, MessageSquare, CheckCircle, Loader2, Shield } from 'lucide-react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import SearchSelect from '@/components/SearchSelect'
import { PageHeader } from '@/components/AppUI'
import { getProvinces, getCities, getBarangays } from '@/lib/locations'

const dots = [...Array(20)].map((_, i) => ({
  size: (((i * 7) % 6) + 3),
  left: ((i * 17 + 13) % 100),
  top: ((i * 23 + 7) % 100),
  duration: ((i * 3) % 6) + 4,
  delay: (i * 0.7) % 4,
}))

const AnimatedDots = () => (
  <div className="absolute inset-0" style={{ overflow: 'hidden', pointerEvents: 'none' }}>
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

export default function RequestAccess() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    position: '',
    message: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Location selectors
  const [provinces, setProvinces] = useState([])
  const [cities, setCities] = useState([])
  const [barangays, setBarangays] = useState([])
  const [selectedProvince, setSelectedProvince] = useState('')
  const [selectedCity, setSelectedCity] = useState('')
  const [selectedBarangay, setSelectedBarangay] = useState('')
  const [loadingLocations, setLoadingLocations] = useState(false)

  useEffect(() => {
    getProvinces().then(setProvinces)
  }, [])

  // Choosing a province or city clears the choices below it and starts
  // the loading indicator, right where the choice is made. The effects
  // below only fetch.
  function chooseProvince(province) {
    setSelectedProvince(province)
    setSelectedCity('')
    setSelectedBarangay('')
    setBarangays([])
    if (province) setLoadingLocations(true)
  }
  function chooseCity(city) {
    setSelectedCity(city)
    setSelectedBarangay('')
    if (city) setLoadingLocations(true)
  }

  // `cancelled` drops a slow answer for a place the user has already left.
  useEffect(() => {
    if (!selectedProvince) return
    let cancelled = false
    getCities(selectedProvince).then(c => {
      if (cancelled) return
      setCities(c)
      setLoadingLocations(false)
    })
    return () => { cancelled = true }
  }, [selectedProvince])

  useEffect(() => {
    if (!selectedCity || !selectedProvince) return
    let cancelled = false
    getBarangays(selectedProvince, selectedCity).then(b => {
      if (cancelled) return
      setBarangays(b)
      setLoadingLocations(false)
    })
    return () => { cancelled = true }
  }, [selectedCity, selectedProvince])

  async function handleSubmit(e) {
    e.preventDefault()
    // The submit button disables while submitting, but Enter in an input
    // still fires onSubmit — guard against duplicate applications.
    if (submitting) return

    const phone = form.phone.trim()

    if (!selectedBarangay) {
      toast.error('Please select your barangay')
      return
    }
    if (form.full_name.trim().length < 3) {
      toast.error('Please enter your full name')
      return
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      toast.error('Please enter a valid email')
      return
    }
    // Same rule as everywhere else in the app — the old length>=10 check
    // accepted things like "12345678901" that no one can call back.
    if (!/^09\d{9}$/.test(phone)) {
      toast.error('Phone must be in format 09xxxxxxxxx')
      return
    }
    if (form.position.trim().length < 3) {
      toast.error('Please enter your position')
      return
    }

    setSubmitting(true)

    const { error } = await supabase.from('barangay_applications').insert({
      full_name: form.full_name.trim(),
      email: form.email.trim().toLowerCase(),
      phone,
      position: form.position.trim(),
      barangay_id: selectedBarangay,
      message: form.message.trim() || null,
    })

    if (error) {
      // 23505 = Postgres unique violation, if you add the recommended
      // unique index on (email, barangay_id) where status = 'pending'
      if (error.code === '23505') {
        toast.error('You already have a pending application for this barangay.')
      } else {
        toast.error('Failed to submit application: ' + error.message)
      }
      setSubmitting(false)
      return
    }

    setSubmitted(true)
    setSubmitting(false)
    toast.success('Request sent')
  }

  if (submitted) {
    return (
      <div className="min-h-screen relative overflow-clip bg-brand flex items-center justify-center p-4">
        <AnimatedDots />
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-20 right-20 w-96 h-96 rounded-full opacity-10"
            style={{ background: 'white', filter: 'blur(80px)', animation: 'float 8s ease-in-out infinite' }} />
        </div>

        <div className="white-card p-8 max-w-md text-center relative z-10 fade-up-1">
          <div className="w-20 h-20 mx-auto mb-5 rounded-3xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 8px 32px rgba(34,197,94,0.4)', animation: 'float 2s ease-in-out infinite' }}>
            <CheckCircle size={36} className="text-white" />
          </div>
          <h2 className="text-2xl font-black text-gray-800 mb-2" style={{ letterSpacing: '-0.5px' }}>Request sent</h2>
          <p className="text-sm text-gray-500 mb-6">
            Thanks! We’ll review your request and send your invite code to <strong>{form.email}</strong> once it’s approved.
          </p>

          <div className="rounded-2xl p-4 mb-6"
            style={{ background: 'var(--brand-soft)', border: '1px solid var(--brand-border)' }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--brand)' }}>What&apos;s Next?</p>
            <ol className="text-xs text-gray-700 space-y-1.5 text-left">
              <li>1. We verify your position and barangay</li>
              <li>2. You receive an official invite code by email</li>
              <li>3. Sign up with the code, then invite your team</li>
            </ol>
          </div>

          <button onClick={() => router.push('/')}
            className="btn-primary w-full py-3 rounded-2xl text-white text-sm font-bold">
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-clip bg-brand">
      <AnimatedDots />
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 right-20 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'white', filter: 'blur(80px)', animation: 'float 8s ease-in-out infinite' }} />
        <div className="absolute bottom-20 left-20 w-72 h-72 rounded-full opacity-10"
          style={{ background: 'white', filter: 'blur(60px)', animation: 'floatReverse 10s ease-in-out infinite' }} />
      </div>

      <PageHeader
        title="Request access"
        description="For barangay officials setting up their barangay"
        iconElement={<Image src="/logo.png" alt="" width={36} height={36} className="object-contain" />}
        iconStyle={{ background: 'transparent' }}
        onBack={() => router.push('/')}
        backLabel="Back to home"
        maxWidth={1180}
      />

      <main className={`relative z-10 max-w-2xl mx-auto px-4 py-8 ${desktop.accessPage}`}>
        <div className="glass-card p-4 mb-6 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.2)' }}>
            <Shield size={20} className="text-white" />
          </div>
          <div>
            <p className="text-white text-sm font-bold">Set up your barangay</p>
            <p className="text-purple-50 text-sm mt-0.5 leading-relaxed">
              Tell us who you are and which barangay you serve. Once your request is approved, you’ll get an official invite code to create your account and invite your team.
            </p>
          </div>
        </div>

        <div className="white-card p-6">
          <form onSubmit={handleSubmit} className={`space-y-5 ${desktop.accessForm}`}>
            {/* Full Name */}
            <div>
              <label htmlFor="ra-name" className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                Full Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input id="ra-name" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
                  required maxLength={100} autoComplete="name"
                  className="input-field w-full rounded-2xl pl-10 pr-4 py-3 text-sm text-gray-800"
                  placeholder="Juan dela Cruz" />
              </div>
            </div>

            {/* Email & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="ra-email" className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Email <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input id="ra-email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                    required autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false}
                    className="input-field w-full rounded-2xl pl-10 pr-4 py-3 text-sm text-gray-800"
                    placeholder="email@example.com" />
                </div>
              </div>

              <div>
                <label htmlFor="ra-phone" className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Phone <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input id="ra-phone" type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                    required maxLength={11} autoComplete="tel-national" inputMode="numeric"
                    className="input-field w-full rounded-2xl pl-10 pr-4 py-3 text-sm text-gray-800"
                    placeholder="09xxxxxxxxx" />
                </div>
              </div>
            </div>

            {/* Position */}
            <div>
              <label htmlFor="ra-position" className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                Position / Title <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Briefcase size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input id="ra-position" value={form.position} onChange={e => setForm({ ...form, position: e.target.value })}
                  required maxLength={100} autoComplete="organization-title"
                  className="input-field w-full rounded-2xl pl-10 pr-4 py-3 text-sm text-gray-800"
                  placeholder="e.g. Punong Barangay, Kagawad" />
              </div>
            </div>

            {/* Location */}
            <div className={desktop.accessLocation}>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                <MapPin size={11} className="inline mr-1" />
                Your Barangay <span className="text-red-500">*</span>
              </label>

              {/* Provinces and cities are plain string arrays, which is
                  exactly what SearchSelect's default getLabel/getValue
                  (identity) expect. The old code wrapped them in
                  { value, label } objects WITHOUT passing getLabel/getValue
                  — so getLabel returned an object and .toLowerCase() crashed
                  the whole page. Barangays are { id, name } rows, so those
                  DO need explicit accessors, same as the register page. */}
              <div className="space-y-2">
                <SearchSelect
                  value={selectedProvince}
                  onChange={chooseProvince}
                  options={provinces}
                  placeholder="Select Province" />

                {selectedProvince && (
                  <SearchSelect
                    value={selectedCity}
                    onChange={chooseCity}
                    options={cities}
                    placeholder={loadingLocations ? "Loading cities..." : "Select City/Municipality"}
                    disabled={loadingLocations} />
                )}

                {selectedCity && (
                  <SearchSelect
                    value={selectedBarangay}
                    onChange={setSelectedBarangay}
                    options={barangays}
                    getLabel={(b) => b.name}
                    getValue={(b) => b.id}
                    placeholder={loadingLocations ? "Loading barangays..." : "Select Barangay"}
                    disabled={loadingLocations} />
                )}
              </div>
            </div>

            {/* Message */}
            <div className={desktop.accessMessage}>
              <label htmlFor="ra-message" className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                Additional Message <span className="text-gray-500 font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <MessageSquare size={15} className="absolute left-3.5 top-3.5 text-gray-500" />
                <textarea id="ra-message" value={form.message} onChange={e => setForm({ ...form, message: e.target.value })}
                  rows={3} maxLength={500}
                  className="input-field w-full rounded-2xl pl-10 pr-4 py-3 text-sm text-gray-800 resize-none"
                  placeholder="Anything that helps us verify your request" />
              </div>
              <p className="text-xs text-gray-500 text-right mt-1">{form.message.length}/500</p>
            </div>

            <button type="submit" disabled={submitting}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-white font-semibold text-sm mt-2 disabled:opacity-50">
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send size={14} /> Send request
                </>
              )}
            </button>

            <p className="text-xs text-gray-500 text-center pt-2">
              Already have an invite code? <a href="/register" className="font-bold" style={{ color: 'var(--brand-dark)' }}>Sign up with it</a>
            </p>
          </form>
        </div>
      </main>
    </div>
  )
}