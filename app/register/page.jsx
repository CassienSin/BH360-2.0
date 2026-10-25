'use client'
import desktop from '@/components/desktop-pages.module.css'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getProvinces, getCities, getBarangays } from '@/lib/locations'
import { Eye, EyeOff, Mail, Lock, User, Phone, MapPin, ArrowRight, ArrowLeft, KeyRound, CheckCircle, Check, X } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import toast from 'react-hot-toast'
import SearchSelect from '@/components/SearchSelect'
import { PASSWORD_RULES, checkPassword } from '@/lib/passwordRules'

const dots = [...Array(25)].map((_, i) => ({
  size: (((i * 7) % 6) + 3),
  left: ((i * 17 + 13) % 100),
  top: ((i * 23 + 7) % 100),
  duration: ((i * 3) % 6) + 4,
  delay: (i * 0.7) % 4,
}))

const roles = [
  { value: 'resident', label: 'Resident', desc: 'Report incidents & request help', icon: '🏠', public: true },
  { value: 'official', label: 'Barangay Official', desc: 'Requires an invite code', icon: '⭐', public: false },
  { value: 'tanod', label: 'Tanod', desc: 'Requires an invite code', icon: '🛡️', public: false },
]

// PH mobile numbers: exactly 11 digits, starting with 09
const PHONE_REGEX = /^09\d{9}$/

function friendlyAuthError(message) {
  if (/already registered|already been registered/i.test(message)) {
    return 'An account with this email already exists. Try signing in instead.'
  }
  if (/rate limit|too many/i.test(message)) {
    return 'Too many attempts. Please wait a moment and try again.'
  }
  // The signup trigger aborts with a database error when the invite code
  // fails to claim (e.g. someone else used it between validation and
  // submit). Supabase surfaces it generically, so translate it here.
  if (/invalid_invite_code|database error saving new user/i.test(message)) {
    return 'Your invite code could not be claimed — it may have just been used by someone else. Please request a new code and try again.'
  }
  return message
}

export default function RegisterPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [step, setStep] = useState(1)
  const [selectedRole, setSelectedRole] = useState('resident')
  const [inviteCode, setInviteCode] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [verifiedBarangay, setVerifiedBarangay] = useState(null) // For officials/tanods
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false)

  // Location state
  const [provinces, setProvinces] = useState([])
  const [cities, setCities] = useState([])
  const [barangays, setBarangays] = useState([])
  const [selectedProvince, setSelectedProvince] = useState('')
  const [selectedCity, setSelectedCity] = useState('')
  const [selectedBarangayId, setSelectedBarangayId] = useState('')

  const [form, setForm] = useState({
    full_name: '', email: '', password: '', confirmPassword: '', address: '', phone: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Load provinces on mount
  useEffect(() => {
    getProvinces().then(setProvinces)
  }, [])

  // Choosing a province or city clears the choices below it, right where
  // the choice is made. The effects below only fetch.
  function chooseProvince(province) {
    setSelectedProvince(province)
    setSelectedCity('')
    setSelectedBarangayId('')
    setBarangays([])
  }
  function chooseCity(city) {
    setSelectedCity(city)
    setSelectedBarangayId('')
  }

  // Load cities when province changes. `cancelled` drops a slow answer
  // for a province the user has already switched away from.
  useEffect(() => {
    if (!selectedProvince) return
    let cancelled = false
    getCities(selectedProvince).then(c => { if (!cancelled) setCities(c) })
    return () => { cancelled = true }
  }, [selectedProvince])

  // Load barangays when city changes
  useEffect(() => {
    if (!selectedProvince || !selectedCity) return
    let cancelled = false
    getBarangays(selectedProvince, selectedCity).then(b => { if (!cancelled) setBarangays(b) })
    return () => { cancelled = true }
  }, [selectedProvince, selectedCity])

  function handleChange(e) { setForm({ ...form, [e.target.name]: e.target.value }) }

  // Phone input: digits only, hard-capped at 11, and pasted international
  // formats (+639..., 639..., 0063...) are normalized to the local
  // 09xxxxxxxxx form. Letters and symbols simply can't be typed.
  function handlePhoneChange(e) {
    let digits = e.target.value.replace(/\D/g, '')
    if (digits.startsWith('00639')) digits = '09' + digits.slice(5)
    else if (digits.startsWith('639')) digits = '09' + digits.slice(3)
    digits = digits.slice(0, 11)
    setForm(f => ({ ...f, phone: digits }))
  }

  const phoneValid = PHONE_REGEX.test(form.phone)
  // Wrong prefix is worth calling out separately — "must start with 09" is
  // a much more useful message than a generic "invalid phone number".
  const phonePrefixWrong = form.phone.length >= 2 && !form.phone.startsWith('09')

  // Password strength checks
  const { checks: passwordChecks, score: passwordStrength } = checkPassword(form.password)
  const strengthLabel = passwordStrength <= 2 ? 'Weak' : passwordStrength <= 3 ? 'Fair' : passwordStrength <= 4 ? 'Good' : 'Strong'
  const strengthColor = passwordStrength <= 2 ? '#ef4444' : passwordStrength <= 3 ? '#f97316' : passwordStrength <= 4 ? '#22c55e' : '#16a34a'

  async function handleRoleNext() {
    if (selectedRole === 'resident') { setStep(2); return }
    if (inviteLoading) return

    setInviteLoading(true)
    setError('')

    // Codes are validated through a SECURITY DEFINER Postgres function —
    // the invite_codes table itself is never readable by clients, so
    // nobody can harvest valid codes from the browser console. The
    // function also handles upper/trim normalization server-side.
    const { data, error: codeError } = await supabase
      .rpc('validate_invite_code', {
        input_code: inviteCode,
        input_role: selectedRole,
      })

    setInviteLoading(false)

    if (codeError) {
      setError('Could not verify the code right now. Please try again.')
      return
    }
    // RPC returns an ARRAY of rows (not a single object like maybeSingle)
    if (!data || data.length === 0) {
      setError('Invalid or already used invite code. Please check and try again.')
      return
    }

    const match = data[0]
    setVerifiedBarangay({
      name: match.barangay_name,
      city: match.barangay_city,
      province: match.barangay_province,
    })
    setSelectedBarangayId(match.barangay_id)
    setStep(2)
    toast.success(`Welcome to ${match.barangay_name || 'your barangay'}! ✓`)
  }

  async function handleRegister(e) {
    e.preventDefault()
    // Enter in an input still submits while the button is disabled
    if (loading) return
    setLoading(true)
    setError('')

    const phone = form.phone.trim()

    // Validation
    if (form.full_name.trim().length < 2) {
      setError('Full name must be at least 2 characters.')
      setLoading(false); return
    }
    if (passwordStrength < PASSWORD_RULES.length) {
      setError('Password does not meet all requirements.')
      setLoading(false); return
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.')
      setLoading(false); return
    }
    if (phone && !PHONE_REGEX.test(phone)) {
      setError('Phone number must be 11 digits starting with 09 (e.g. 09171234567).')
      setLoading(false); return
    }
    if (!selectedBarangayId) {
      setError('Please select your barangay.')
      setLoading(false); return
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      // Metadata travels with the auth user. If you later add a DB trigger
      // that creates profiles from auth metadata (recommended — it makes
      // signup atomic), everything it needs is already here.
      options: {
        data: {
          full_name: form.full_name.trim(),
          role: selectedRole,
          barangay_id: selectedBarangayId,
          phone,
          address: form.address.trim(),
          // The DB trigger claims this atomically during signup.
          invite_code: selectedRole !== 'resident' ? inviteCode.trim() : null,
        },
      },
    })
    if (signUpError) {
      setError(friendlyAuthError(signUpError.message))
      setLoading(false)
      return
    }

    // If email confirmation is enabled in Supabase, there's no session yet —
    // the user must click the link in their inbox first. The old code
    // ignored this: it said "Account created!" and sent them to a login
    // that would only reply "Email not confirmed".
    if (!data.session) {
      setAwaitingConfirmation(true)
      setLoading(false)
      return
    }

    // Nothing to do here. Profile creation and invite-code claiming both
    // happen ATOMICALLY inside the database, in the handle_new_user trigger
    // (supabase/setup.sql, Section 7). If the code was already claimed the
    // trigger raises, which fails signUp itself and creates NO auth user —
    // no orphaned accounts, no burnt codes, and it behaves the same whether
    // or not email confirmation is switched on.

    toast.success('Account created successfully!')
    // replace, not push — Back from the login page shouldn't return to a
    // half-filled registration form for an account that already exists.
    router.replace('/login')
  }

  return (
    <div className={`min-h-screen flex items-center justify-center py-12 px-6 bg-brand relative overflow-hidden ${desktop.registrationRoot}`}>

      <Link href="/" className="absolute top-4 left-4 z-20 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white transition-colors hover:bg-white/15">
        <ArrowLeft size={15} aria-hidden="true" /> Home
      </Link>

      {/* Animated background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 right-20 w-[500px] h-[500px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #a78bfa 0%, transparent 70%)', filter: 'blur(80px)', animation: 'float 8s ease-in-out infinite' }} />
        <div className="absolute bottom-0 left-20 w-[400px] h-[400px] rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)', filter: 'blur(60px)', animation: 'floatReverse 10s ease-in-out infinite' }} />
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

      <div className={`relative z-10 w-full max-w-lg ${desktop.registration}`}>

        {/* Header */}
        <div className={`text-center mb-6 fade-up ${desktop.registrationHeading}`}>
          <div className="w-16 h-16 mx-auto mb-4 relative" style={{ animation: 'float 6s ease-in-out infinite' }}>
            <Image src="/logo.png" alt="BarangayHub 360" fill sizes="64px" loading="eager" className="object-contain drop-shadow-2xl" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full mb-4"
            style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', backdropFilter: 'blur(10px)' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white text-xs font-bold tracking-wide">JOIN YOUR COMMUNITY</span>
          </div>

          <h1 className="text-3xl font-black text-white mb-2" style={{ letterSpacing: '-1px' }}>
            <span style={{
              background: 'linear-gradient(135deg, #fff 0%, #c4b5fd 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>Create your account</span>
          </h1>
          <p className="text-purple-50 text-sm">Sign up in two quick steps</p>
        </div>

        {/* Step indicators */}
        {!awaitingConfirmation && (
          <ol className={`flex items-start justify-center gap-2 mb-6 fade-up ${desktop.registrationSteps}`} aria-label="Sign-up steps">
            {[1, 2].map(s => (
              <li key={s} className="flex items-start gap-2" aria-current={step === s ? 'step' : undefined}>
                <div className="flex flex-col items-center gap-1.5 w-20">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                  style={{
                    background: step >= s ? 'white' : 'rgba(255,255,255,0.15)',
                    color: step >= s ? 'var(--brand)' : 'rgba(255,255,255,0.5)',
                    border: step >= s ? 'none' : '1px solid rgba(255,255,255,0.25)',
                    boxShadow: step >= s ? '0 4px 16px rgba(255,255,255,0.3)' : 'none',
                  }}>
                  {step > s ? <CheckCircle size={14} aria-label="Done" /> : s}
                </div>
                <span className="text-xs font-semibold text-white" style={{ opacity: step >= s ? 1 : 0.75 }}>
                  {s === 1 ? 'Your role' : 'Your details'}
                </span>
                </div>
                {s < 2 && <div className="w-10 h-0.5 rounded-full transition-all mt-4" style={{ background: step > s ? 'white' : 'rgba(255,255,255,0.35)' }} aria-hidden="true" />}
              </li>
            ))}
          </ol>
        )}

        <div className={`rounded-3xl p-4 sm:p-6 md:p-8 fade-up-1 ${desktop.registrationCard}`}
          style={{
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 32px 80px rgba(0,0,0,0.2), 0 8px 24px rgba(91,84,232,0.15)',
            border: '1px solid rgba(255,255,255,0.5)',
          }}>

          {error && (
            <div className="mb-5 px-4 py-3 rounded-2xl text-sm flex items-start gap-2 fade-up"
              role="alert"
              style={{ background: '#fff1f1', border: '1px solid #fecaca' }}>
              <span aria-hidden="true">⚠️</span>
              <span className="text-red-700">{error}</span>
            </div>
          )}

          {/* Confirmation-required panel */}
          {awaitingConfirmation && (
            <div className="fade-up text-center py-4">
              <div className="w-16 h-16 mx-auto rounded-3xl flex items-center justify-center mb-4"
                style={{ background: '#f0fdf4' }}>
                <Mail size={28} className="text-emerald-500" />
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-2" style={{ letterSpacing: '-0.5px' }}>Check your email</h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                We sent a confirmation link to{' '}
                <span className="font-bold text-gray-800">{form.email}</span>.
                Click it to activate your account, then sign in.
              </p>
              <button onClick={() => router.replace('/login')}
                className="mt-6 w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-white font-bold text-sm transition-all hover:scale-[1.02]"
                style={{ background: 'linear-gradient(135deg, var(--brand), var(--brand-light))', boxShadow: '0 8px 32px rgba(91,84,232,0.4)' }}>
                Go to Sign In <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* Step 1 — Role Selection */}
          {!awaitingConfirmation && step === 1 && (
            <div className="fade-up">
              <h2 className="text-2xl font-black text-gray-900 mb-1" style={{ letterSpacing: '-0.5px' }}>Who are you?</h2>
              <p className="text-gray-500 text-sm mb-6">Select your role in the barangay.</p>

              <div className="space-y-3 mb-5" role="radiogroup" aria-label="Select your role">
                {roles.map(role => (
                  <div key={role.value}
                    role="radio"
                    aria-checked={selectedRole === role.value}
                    tabIndex={0}
                    onClick={() => { setSelectedRole(role.value); setError(''); setInviteCode(''); setVerifiedBarangay(null) }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSelectedRole(role.value); setError(''); setInviteCode(''); setVerifiedBarangay(null)
                      }
                    }}
                    className="rounded-2xl p-4 flex items-center gap-4 cursor-pointer transition-all"
                    style={{
                      border: `2px solid ${selectedRole === role.value ? 'var(--brand)' : 'var(--brand-border)'}`,
                      background: selectedRole === role.value ? 'var(--brand-soft)' : 'white',
                      boxShadow: selectedRole === role.value ? '0 0 0 4px rgba(91,84,232,0.08)' : 'none',
                    }}>
                    <div className="text-3xl" aria-hidden="true">{role.icon}</div>
                    <div className="flex-1">
                      <p className="font-bold text-gray-800 text-sm">{role.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{role.desc}</p>
                    </div>
                    {!role.public && (
                      <div className="flex items-center gap-1 px-2 py-1 rounded-lg" style={{ background: '#fef9c3' }}>
                        <KeyRound size={11} className="text-yellow-600" />
                        <span className="text-xs font-bold text-yellow-700 hidden sm:block">Code</span>
                      </div>
                    )}
                    <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                      style={{
                        borderColor: selectedRole === role.value ? 'var(--brand)' : '#d1d5db',
                        background: selectedRole === role.value ? 'var(--brand)' : 'transparent',
                      }}>
                      {selectedRole === role.value && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </div>
                ))}
              </div>

              {/* Invite code field */}
              {selectedRole !== 'resident' && (
                <div className="mb-5 fade-up">
                  <label htmlFor="invite-code" className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                    Invite Code
                  </label>
                  <div className="relative">
                    <KeyRound size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      id="invite-code"
                      value={inviteCode}
                      onChange={e => { setInviteCode(e.target.value); setError('') }}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleRoleNext() } }}
                      autoCapitalize="characters" autoComplete="off" spellCheck={false}
                      className="input-field w-full rounded-2xl pl-10 pr-4 py-3 text-sm text-gray-800 uppercase tracking-wider font-bold"
                      placeholder={`e.g. ${selectedRole === 'official' ? 'OFFICIAL-2026' : 'TANOD-2026'}`}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1">
                    <KeyRound size={10} /> Contact your barangay captain to get an invite code
                  </p>
                  <p className="text-xs mt-2">
                    Don&apos;t have a code yet?{' '}
                    <button type="button" onClick={() => router.push('/request-access')}
                      className="font-bold hover:underline" style={{ color: 'var(--brand)' }}>
                      Request access →
                    </button>
                  </p>
                </div>
              )}

              <button onClick={handleRoleNext}
                disabled={inviteLoading || (selectedRole !== 'resident' && !inviteCode.trim())}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-white font-bold text-sm transition-all hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100"
                style={{ background: 'linear-gradient(135deg, var(--brand), var(--brand-light))', boxShadow: '0 8px 32px rgba(91,84,232,0.4)' }}>
                {inviteLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Verifying...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">Continue <ArrowRight size={16} /></span>
                )}
              </button>
            </div>
          )}

          {/* Step 2 — Account Details */}
          {!awaitingConfirmation && step === 2 && (
            <div className="fade-up">
              <div className="flex items-center justify-between mb-5">
                <button onClick={() => { setStep(1); setError('') }}
                  className="text-xs font-semibold text-gray-500 hover:text-gray-600 transition-colors flex items-center gap-1">
                  ← Back
                </button>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: 'var(--brand-soft)' }}>
                  <span className="text-base" aria-hidden="true">{roles.find(r => r.value === selectedRole)?.icon}</span>
                  <span className="text-xs font-bold" style={{ color: 'var(--brand)' }}>
                    {roles.find(r => r.value === selectedRole)?.label}
                  </span>
                </div>
              </div>

              <h2 className="text-2xl font-black text-gray-900 mb-1" style={{ letterSpacing: '-0.5px' }}>Account details</h2>
              <p className="text-gray-500 text-sm mb-6">Fill in your personal information.</p>

              {/* Verified barangay banner for officials/tanods */}
              {verifiedBarangay && (
                <div className="mb-5 p-4 rounded-2xl flex items-center gap-3"
                  style={{ background: '#f0fdf4', border: '1px solid #dcfce7' }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: '#22c55e' }}>
                    <CheckCircle size={16} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-emerald-700">Verified Barangay</p>
                    <p className="text-sm font-bold text-emerald-900 truncate">{verifiedBarangay.name}</p>
                    <p className="text-xs text-emerald-600 truncate">{verifiedBarangay.city}, {verifiedBarangay.province}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleRegister} className={`space-y-4 ${desktop.registrationForm}`}>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="reg-name" className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Full Name</label>
                    <div className="relative">
                      <User size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                      <input id="reg-name" name="full_name" value={form.full_name} onChange={handleChange} required maxLength={100}
                        autoComplete="name"
                        className="input-field w-full rounded-2xl pl-9 pr-3 py-3 text-sm text-gray-800"
                        placeholder="Juan Dela Cruz" />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="reg-phone" className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Phone</label>
                    <div className="relative">
                      <Phone size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                      <input id="reg-phone" name="phone" type="tel" value={form.phone} onChange={handlePhoneChange}
                        maxLength={11} autoComplete="tel-national" inputMode="numeric" pattern="09[0-9]{9}"
                        aria-invalid={form.phone ? !phoneValid : undefined}
                        aria-describedby="phone-hint"
                        className="input-field w-full rounded-2xl pl-9 pr-3 py-3 text-sm text-gray-800"
                        placeholder="09xxxxxxxxx" />
                      {form.phone && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2">
                          {phoneValid
                            ? <Check size={14} className="text-emerald-500" />
                            : <X size={14} className="text-red-400" />}
                        </span>
                      )}
                    </div>
                    {form.phone && !phoneValid && (
                      <p id="phone-hint" className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                        <X size={11} />
                        {phonePrefixWrong
                          ? 'Must start with 09'
                          : `${form.phone.length}/11 digits`}
                      </p>
                    )}
                    {form.phone && phoneValid && (
                      <p id="phone-hint" className="text-xs text-emerald-500 mt-1.5 flex items-center gap-1">
                        <Check size={11} /> Valid number
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="reg-email" className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Email</label>
                  <div className="relative">
                    <Mail size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input id="reg-email" name="email" type="email" value={form.email} onChange={handleChange} required
                      autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false}
                      className="input-field w-full rounded-2xl pl-9 pr-4 py-3 text-sm text-gray-800"
                      placeholder="you@email.com" />
                  </div>
                </div>

                {/* Password with strength indicator */}
                <div>
                  <label htmlFor="reg-password" className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Password</label>
                  <div className="relative">
                    <Lock size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input id="reg-password" name="password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={handleChange} required
                      autoComplete="new-password"
                      className="input-field w-full rounded-2xl pl-9 pr-10 py-3 text-sm text-gray-800"
                      placeholder="Create a strong password" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-600 transition-colors">
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>

                  {form.password && (
                    <div className="mt-3 space-y-2 fade-up">
                      {/* Strength bar */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-500">Strength:</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{ background: `${strengthColor}20`, color: strengthColor }}>
                          {strengthLabel}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map(i => (
                          <div key={i} className="flex-1 h-1.5 rounded-full transition-all"
                            style={{ background: i <= passwordStrength ? strengthColor : '#e5e7eb' }} />
                        ))}
                      </div>

                      {/* Requirements */}
                      <div className="grid grid-cols-1 gap-1 mt-3">
                        {PASSWORD_RULES.map(({ key, label }) => (
                          <div key={key} className="flex items-center gap-2 text-xs">
                            {passwordChecks[key] ? (
                              <Check size={12} className="text-emerald-500 flex-shrink-0" />
                            ) : (
                              <X size={12} className="text-gray-300 flex-shrink-0" />
                            )}
                            <span className={passwordChecks[key] ? 'text-emerald-600 line-through' : 'text-gray-500'}>
                              {label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label htmlFor="reg-confirm" className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <Lock size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input id="reg-confirm" name="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} value={form.confirmPassword} onChange={handleChange} required
                      autoComplete="new-password"
                      className="input-field w-full rounded-2xl pl-9 pr-10 py-3 text-sm text-gray-800"
                      placeholder="Re-enter password" />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-600 transition-colors">
                      {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  {form.confirmPassword && form.password !== form.confirmPassword && (
                    <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1"><X size={11} /> Passwords don&apos;t match</p>
                  )}
                  {form.confirmPassword && form.password === form.confirmPassword && form.password && (
                    <p className="text-xs text-emerald-500 mt-1.5 flex items-center gap-1"><Check size={11} /> Passwords match</p>
                  )}
                </div>

                {/* Location dropdowns — only for residents */}
                {selectedRole === 'resident' && (
                  <div className={`space-y-3 pt-2 ${desktop.registrationLocation}`}>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Your Barangay</p>

                    <SearchSelect
                      value={selectedProvince}
                      onChange={chooseProvince}
                      options={provinces}
                      placeholder="Select Province"
                    />

                    <SearchSelect
                      value={selectedCity}
                      onChange={chooseCity}
                      options={cities}
                      placeholder={selectedProvince ? 'Select City / Municipality' : 'Select province first'}
                      disabled={!selectedProvince}
                    />

                    <SearchSelect
                      value={selectedBarangayId}
                      onChange={setSelectedBarangayId}
                      options={barangays}
                      placeholder={selectedCity ? 'Select Barangay' : 'Select city first'}
                      disabled={!selectedCity}
                      getLabel={(b) => b.name}
                      getValue={(b) => b.id}
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="reg-address" className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Address</label>
                  <div className="relative">
                    <MapPin size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input id="reg-address" name="address" value={form.address} onChange={handleChange} maxLength={200}
                      autoComplete="street-address"
                      className="input-field w-full rounded-2xl pl-9 pr-4 py-3 text-sm text-gray-800"
                      placeholder="Sitio, Street, House Number" />
                  </div>
                </div>

                <button type="submit" disabled={loading || (form.phone.length > 0 && !phoneValid)}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-white font-bold text-sm transition-all hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100 mt-2"
                  style={{ background: 'linear-gradient(135deg, var(--brand), var(--brand-light))', boxShadow: '0 8px 32px rgba(91,84,232,0.4)' }}>
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Creating account...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">Create Account <ArrowRight size={16} /></span>
                  )}
                </button>
              </form>
            </div>
          )}

          {!awaitingConfirmation && (
            <div className="mt-6 pt-5 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-500">
                Already have an account?{' '}
                <a href="/login" className="font-bold transition-colors" style={{ color: 'var(--brand-dark)' }}>Sign in</a>
              </p>
            </div>
          )}
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'rgba(255,255,255,0.8)' }}>
          © 2026 BarangayHub 360
        </p>
      </div>
    </div>
  )
}