'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ArrowLeft, Send, User, Mail, Phone, Briefcase, MapPin, MessageSquare, CheckCircle, Loader2, Shield } from 'lucide-react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import SearchSelect from '@/components/SearchSelect'
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

  useEffect(() => {
    if (selectedProvince) {
      setLoadingLocations(true)
      setSelectedCity('')
      setSelectedBarangay('')
      setBarangays([])
      getCities(selectedProvince).then(c => {
        setCities(c)
        setLoadingLocations(false)
      })
    }
  }, [selectedProvince])

  useEffect(() => {
    if (selectedCity && selectedProvince) {
      setLoadingLocations(true)
      setSelectedBarangay('')
      getBarangays(selectedProvince, selectedCity).then(b => {
        setBarangays(b)
        setLoadingLocations(false)
      })
    }
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
    toast.success('Application submitted!')
  }

  if (submitted) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-brand flex items-center justify-center p-4">
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
          <h2 className="text-2xl font-black text-gray-800 mb-2" style={{ letterSpacing: '-0.5px' }}>Application Submitted!</h2>
          <p className="text-sm text-gray-500 mb-6">
            Thank you for your interest in BarangayHub 360. Our team will review your application within 1-3 business days and send your invite code to <strong>{form.email}</strong>.
          </p>

          <div className="rounded-2xl p-4 mb-6"
            style={{ background: '#f0effe', border: '1px solid #e8e3ff' }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#5B54E8' }}>What's Next?</p>
            <ol className="text-xs text-gray-700 space-y-1.5 text-left">
              <li>✓ Our team verifies your barangay credentials</li>
              <li>✓ You receive an invite code via email</li>
              <li>✓ Use the code to register and onboard your team</li>
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
    <div className="min-h-screen relative overflow-hidden bg-brand">
      <AnimatedDots />
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 right-20 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'white', filter: 'blur(80px)', animation: 'float 8s ease-in-out infinite' }} />
        <div className="absolute bottom-20 left-20 w-72 h-72 rounded-full opacity-10"
          style={{ background: 'white', filter: 'blur(60px)', animation: 'floatReverse 10s ease-in-out infinite' }} />
      </div>

      <header className="bg-white relative z-10 px-6 py-4 flex items-center gap-3"
        style={{ boxShadow: '0 2px 12px rgba(91,84,232,0.08)', borderBottom: '1px solid #f0effe' }}>
        <button onClick={() => router.push('/')} aria-label="Back to home"
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-gray-100">
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 relative">
            <Image src="/logo.png" alt="BH360" fill sizes="36px" loading="eager" className="object-contain" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-800">Request Access</h1>
            <p className="text-xs text-gray-400">For Barangay Officials</p>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-2xl mx-auto px-4 py-8">
        <div className="glass-card p-4 mb-6 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.2)' }}>
            <Shield size={20} className="text-white" />
          </div>
          <div>
            <p className="text-white text-sm font-bold">Onboard your barangay</p>
            <p className="text-purple-200 text-xs mt-0.5">
              Fill out this form to request access for your barangay. Our team will verify your information and send you an invite code.
            </p>
          </div>
        </div>

        <div className="white-card p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Full Name */}
            <div>
              <label htmlFor="ra-name" className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                Full Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
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
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
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
                  <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input id="ra-phone" type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
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
                <Briefcase size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input id="ra-position" value={form.position} onChange={e => setForm({ ...form, position: e.target.value })}
                  required maxLength={100} autoComplete="organization-title"
                  className="input-field w-full rounded-2xl pl-10 pr-4 py-3 text-sm text-gray-800"
                  placeholder="e.g. Barangay Captain, Secretary, Kagawad" />
              </div>
            </div>

            {/* Location */}
            <div>
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
                  onChange={setSelectedProvince}
                  options={provinces}
                  placeholder="Select Province" />

                {selectedProvince && (
                  <SearchSelect
                    value={selectedCity}
                    onChange={setSelectedCity}
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
            <div>
              <label htmlFor="ra-message" className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                Additional Message <span className="text-gray-300 font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <MessageSquare size={15} className="absolute left-3.5 top-3.5 text-gray-400" />
                <textarea id="ra-message" value={form.message} onChange={e => setForm({ ...form, message: e.target.value })}
                  rows={3} maxLength={500}
                  className="input-field w-full rounded-2xl pl-10 pr-4 py-3 text-sm text-gray-800 resize-none"
                  placeholder="Tell us why you'd like to onboard your barangay..." />
              </div>
              <p className="text-xs text-gray-400 text-right mt-1">{form.message.length}/500</p>
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
                  <Send size={14} /> Submit Application
                </>
              )}
            </button>

            <p className="text-xs text-gray-400 text-center pt-2">
              Already have an invite code? <a href="/register" className="font-semibold" style={{ color: '#5B54E8' }}>Register here →</a>
            </p>
          </form>
        </div>
      </main>
    </div>
  )
}