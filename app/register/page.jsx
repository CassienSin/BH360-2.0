'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getProvinces, getCities, getBarangays } from '@/lib/locations'
import { Eye, EyeOff, Mail, Lock, User, Phone, MapPin, ArrowRight, KeyRound, CheckCircle, XCircle, Check, X } from 'lucide-react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import SearchSelect from '@/components/SearchSelect'

const dots = [...Array(25)].map((_, i) => ({
  size: (((i * 7) % 6) + 3),
  left: ((i * 17 + 13) % 100),
  top: ((i * 23 + 7) % 100),
  duration: ((i * 3) % 6) + 4,
  delay: (i * 0.7) % 4,
}))

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState(1)
  const [selectedRole, setSelectedRole] = useState('resident')
  const [inviteCode, setInviteCode] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [verifiedBarangay, setVerifiedBarangay] = useState(null) // For officials/tanods

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

  // Load cities when province changes
  useEffect(() => {
    if (selectedProvince) {
      getCities(selectedProvince).then(setCities)
      setSelectedCity('')
      setSelectedBarangayId('')
      setBarangays([])
    }
  }, [selectedProvince])

  // Load barangays when city changes
  useEffect(() => {
    if (selectedProvince && selectedCity) {
      getBarangays(selectedProvince, selectedCity).then(setBarangays)
      setSelectedBarangayId('')
    }
  }, [selectedCity])

  function handleChange(e) { setForm({ ...form, [e.target.name]: e.target.value }) }

  // Password strength checks
  const passwordChecks = {
    length: form.password.length >= 8,
    uppercase: /[A-Z]/.test(form.password),
    lowercase: /[a-z]/.test(form.password),
    number: /[0-9]/.test(form.password),
    symbol: /[!@#$%^&*(),.?":{}|<>]/.test(form.password),
  }
  const passwordStrength = Object.values(passwordChecks).filter(Boolean).length
  const strengthLabel = passwordStrength <= 2 ? 'Weak' : passwordStrength <= 3 ? 'Fair' : passwordStrength <= 4 ? 'Good' : 'Strong'
  const strengthColor = passwordStrength <= 2 ? '#ef4444' : passwordStrength <= 3 ? '#f97316' : passwordStrength <= 4 ? '#22c55e' : '#16a34a'

  async function handleRoleNext() {
    if (selectedRole === 'resident') { setStep(2); return }

    setInviteLoading(true)
    setError('')

    const { data: code } = await supabase
      .from('invite_codes')
      .select('*, barangays(id, name, city, province)')
      .eq('code', inviteCode.trim().toUpperCase())
      .eq('role', selectedRole)
      .eq('used', false)
      .single()

    setInviteLoading(false)

    if (!code) {
      setError('Invalid or already used invite code. Please check and try again.')
      return
    }

    setVerifiedBarangay(code.barangays)
    setSelectedBarangayId(code.barangay_id)
    setStep(2)
    toast.success(`Welcome to ${code.barangays?.name || 'your barangay'}! ✓`)
  }

  async function handleRegister(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Validation
    if (form.full_name.trim().length < 2) {
      setError('Full name must be at least 2 characters.')
      setLoading(false); return
    }
    if (passwordStrength < 5) {
      setError('Password does not meet all requirements.')
      setLoading(false); return
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.')
      setLoading(false); return
    }
    if (form.phone && !/^09\d{9}$/.test(form.phone)) {
      setError('Phone must be in format 09xxxxxxxxx.')
      setLoading(false); return
    }
    if (!selectedBarangayId) {
      setError('Please select your barangay.')
      setLoading(false); return
    }

    const { data, error } = await supabase.auth.signUp({ email: form.email, password: form.password })
    if (error) { setError(error.message); setLoading(false); return }

    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id,
      full_name: form.full_name.trim(),
      role: selectedRole,
      address: form.address.trim(),
      phone: form.phone.trim(),
      barangay_id: selectedBarangayId,
    })
    if (profileError) { setError(profileError.message); setLoading(false); return }

    if (selectedRole !== 'resident') {
      await supabase.from('invite_codes')
        .update({ used: true, used_by: data.user.id })
        .eq('code', inviteCode.trim().toUpperCase())
    }

    toast.success('Account created successfully!')
    router.push('/login')
  }

  const roles = [
    { value: 'resident', label: 'Resident', desc: 'Report incidents & request help', icon: '🏠', public: true },
    { value: 'official', label: 'Barangay Official', desc: 'Requires an invite code', icon: '⭐', public: false },
    { value: 'tanod', label: 'Tanod', desc: 'Requires an invite code', icon: '🛡️', public: false },
  ]

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-6 bg-brand relative overflow-hidden">

      {/* Animated background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 right-20 w-[500px] h-[500px] rounded-full opacity-20"
          style={{background: 'radial-gradient(circle, #a78bfa 0%, transparent 70%)', filter: 'blur(80px)', animation: 'float 8s ease-in-out infinite'}} />
        <div className="absolute bottom-0 left-20 w-[400px] h-[400px] rounded-full opacity-15"
          style={{background: 'radial-gradient(circle, white 0%, transparent 70%)', filter: 'blur(60px)', animation: 'floatReverse 10s ease-in-out infinite'}} />
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

      <div className="relative z-10 w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-6 fade-up">
          <div className="w-16 h-16 mx-auto mb-4 relative" style={{animation: 'float 6s ease-in-out infinite'}}>
            <Image src="/logo.png" alt="BH360" fill sizes="64px" loading="eager" className="object-contain drop-shadow-2xl" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full mb-4"
            style={{background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', backdropFilter: 'blur(10px)'}}>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white text-xs font-bold tracking-wide">JOIN YOUR COMMUNITY</span>
          </div>

          <h1 className="text-3xl font-black text-white mb-2" style={{letterSpacing: '-1px'}}>
            <span style={{
              background: 'linear-gradient(135deg, #fff 0%, #c4b5fd 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>Create your account</span>
          </h1>
          <p className="text-purple-200 text-sm">Join your barangay community in seconds</p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 mb-6 fade-up">
          {[1, 2].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                style={{
                  background: step >= s ? 'white' : 'rgba(255,255,255,0.15)',
                  color: step >= s ? '#5B54E8' : 'rgba(255,255,255,0.5)',
                  border: step >= s ? 'none' : '1px solid rgba(255,255,255,0.25)',
                  boxShadow: step >= s ? '0 4px 16px rgba(255,255,255,0.3)' : 'none',
                }}>
                {step > s ? <CheckCircle size={14} /> : s}
              </div>
              {s < 2 && <div className="w-12 h-0.5 rounded-full transition-all" style={{background: step > s ? 'white' : 'rgba(255,255,255,0.2)'}} />}
            </div>
          ))}
        </div>

        <div className="rounded-3xl p-4 sm:p-6 md:p-8 fade-up-1"
          style={{
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 32px 80px rgba(0,0,0,0.2), 0 8px 24px rgba(91,84,232,0.15)',
            border: '1px solid rgba(255,255,255,0.5)',
          }}>

          {error && (
            <div className="mb-5 px-4 py-3 rounded-2xl text-sm flex items-start gap-2 fade-up"
              style={{background: '#fff1f1', border: '1px solid #fecaca'}}>
              <span>⚠️</span>
              <span className="text-red-700">{error}</span>
            </div>
          )}

          {/* Step 1 — Role Selection */}
          {step === 1 && (
            <div className="fade-up">
              <h2 className="text-2xl font-black text-gray-900 mb-1" style={{letterSpacing: '-0.5px'}}>Who are you?</h2>
              <p className="text-gray-400 text-sm mb-6">Select your role in the barangay.</p>

              <div className="space-y-3 mb-5">
                {roles.map(role => (
                  <div key={role.value}
                    onClick={() => { setSelectedRole(role.value); setError(''); setInviteCode(''); setVerifiedBarangay(null) }}
                    className="rounded-2xl p-4 flex items-center gap-4 cursor-pointer transition-all"
                    style={{
                      border: `2px solid ${selectedRole === role.value ? '#5B54E8' : '#e8e3ff'}`,
                      background: selectedRole === role.value ? '#f0effe' : 'white',
                      boxShadow: selectedRole === role.value ? '0 0 0 4px rgba(91,84,232,0.08)' : 'none',
                    }}>
                    <div className="text-3xl">{role.icon}</div>
                    <div className="flex-1">
                      <p className="font-bold text-gray-800 text-sm">{role.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{role.desc}</p>
                    </div>
                    {!role.public && (
                      <div className="flex items-center gap-1 px-2 py-1 rounded-lg" style={{background: '#fef9c3'}}>
                        <KeyRound size={11} className="text-yellow-600" />
                        <span className="text-xs font-bold text-yellow-700 hidden sm:block">Code</span>
                      </div>
                    )}
                    <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                      style={{
                        borderColor: selectedRole === role.value ? '#5B54E8' : '#d1d5db',
                        background: selectedRole === role.value ? '#5B54E8' : 'transparent',
                      }}>
                      {selectedRole === role.value && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </div>
                ))}
              </div>

              {/* Invite code field */}
              {selectedRole !== 'resident' && (
                <div className="mb-5 fade-up">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                    Invite Code
                  </label>
                  <div className="relative">
                    <KeyRound size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      value={inviteCode}
                      onChange={e => { setInviteCode(e.target.value); setError('') }}
                      className="input-field w-full rounded-2xl pl-10 pr-4 py-3 text-sm text-gray-800 uppercase tracking-wider font-bold"
                      placeholder={`e.g. ${selectedRole === 'official' ? 'OFFICIAL-2026' : 'TANOD-2026'}`}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                    <KeyRound size={10} /> Contact your barangay captain to get an invite code
                  </p>
                </div>
              )}

              <button onClick={handleRoleNext}
                disabled={inviteLoading || (selectedRole !== 'resident' && !inviteCode.trim())}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-white font-bold text-sm transition-all hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100"
                style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 8px 32px rgba(91,84,232,0.4)'}}>
                {inviteLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
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
          {step === 2 && (
            <div className="fade-up">
              <div className="flex items-center justify-between mb-5">
                <button onClick={() => { setStep(1); setError('') }}
                  className="text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1">
                  ← Back
                </button>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{background: '#f0effe'}}>
                  <span className="text-base">{roles.find(r => r.value === selectedRole)?.icon}</span>
                  <span className="text-xs font-bold" style={{color: '#5B54E8'}}>
                    {roles.find(r => r.value === selectedRole)?.label}
                  </span>
                </div>
              </div>

              <h2 className="text-2xl font-black text-gray-900 mb-1" style={{letterSpacing: '-0.5px'}}>Account details</h2>
              <p className="text-gray-400 text-sm mb-6">Fill in your personal information.</p>

              {/* Verified barangay banner for officials/tanods */}
              {verifiedBarangay && (
                <div className="mb-5 p-4 rounded-2xl flex items-center gap-3"
                  style={{background: '#f0fdf4', border: '1px solid #dcfce7'}}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{background: '#22c55e'}}>
                    <CheckCircle size={16} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-emerald-700">Verified Barangay</p>
                    <p className="text-sm font-bold text-emerald-900 truncate">{verifiedBarangay.name}</p>
                    <p className="text-xs text-emerald-600 truncate">{verifiedBarangay.city}, {verifiedBarangay.province}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleRegister} className="space-y-4">

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Full Name</label>
                    <div className="relative">
                      <User size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input name="full_name" value={form.full_name} onChange={handleChange} required maxLength={100}
                        className="input-field w-full rounded-2xl pl-9 pr-3 py-3 text-sm text-gray-800"
                        placeholder="Juan Dela Cruz" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Phone</label>
                    <div className="relative">
                      <Phone size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input name="phone" value={form.phone} onChange={handleChange} maxLength={11}
                        className="input-field w-full rounded-2xl pl-9 pr-3 py-3 text-sm text-gray-800"
                        placeholder="09xxxxxxxxx" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Email</label>
                  <div className="relative">
                    <Mail size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input name="email" type="email" value={form.email} onChange={handleChange} required
                      className="input-field w-full rounded-2xl pl-9 pr-4 py-3 text-sm text-gray-800"
                      placeholder="you@email.com" />
                  </div>
                </div>

                {/* Password with strength indicator */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Password</label>
                  <div className="relative">
                    <Lock size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input name="password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={handleChange} required
                      className="input-field w-full rounded-2xl pl-9 pr-10 py-3 text-sm text-gray-800"
                      placeholder="Create a strong password" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>

                  {form.password && (
                    <div className="mt-3 space-y-2 fade-up">
                      {/* Strength bar */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-500">Strength:</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{background: `${strengthColor}20`, color: strengthColor}}>
                          {strengthLabel}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map(i => (
                          <div key={i} className="flex-1 h-1.5 rounded-full transition-all"
                            style={{background: i <= passwordStrength ? strengthColor : '#e5e7eb'}} />
                        ))}
                      </div>

                      {/* Requirements */}
                      <div className="grid grid-cols-1 gap-1 mt-3">
                        {[
                          { key: 'length', label: 'At least 8 characters' },
                          { key: 'uppercase', label: 'One uppercase letter (A-Z)' },
                          { key: 'lowercase', label: 'One lowercase letter (a-z)' },
                          { key: 'number', label: 'One number (0-9)' },
                          { key: 'symbol', label: 'One symbol (!@#$%^&*)' },
                        ].map(({ key, label }) => (
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
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <Lock size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input name="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} value={form.confirmPassword} onChange={handleChange} required
                      className="input-field w-full rounded-2xl pl-9 pr-10 py-3 text-sm text-gray-800"
                      placeholder="Re-enter password" />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                      {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  {form.confirmPassword && form.password !== form.confirmPassword && (
                    <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1"><X size={11} /> Passwords don't match</p>
                  )}
                  {form.confirmPassword && form.password === form.confirmPassword && form.password && (
                    <p className="text-xs text-emerald-500 mt-1.5 flex items-center gap-1"><Check size={11} /> Passwords match</p>
                  )}
                </div>

                {/* Location dropdowns — only for residents */}
                  {selectedRole === 'resident' && (
                    <div className="space-y-3 pt-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Your Barangay</p>

                      <SearchSelect
                        value={selectedProvince}
                        onChange={setSelectedProvince}
                        options={provinces}
                        placeholder="Select Province"
                      />

                      <SearchSelect
                        value={selectedCity}
                        onChange={setSelectedCity}
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
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Address</label>
                  <div className="relative">
                    <MapPin size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input name="address" value={form.address} onChange={handleChange} maxLength={200}
                      className="input-field w-full rounded-2xl pl-9 pr-4 py-3 text-sm text-gray-800"
                      placeholder="Sitio, Street, House Number" />
                  </div>
                </div>

                <button type="submit" disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-white font-bold text-sm transition-all hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100 mt-2"
                  style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 8px 32px rgba(91,84,232,0.4)'}}>
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
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

          <div className="mt-6 pt-5 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-400">
              Already have an account?{' '}
              <a href="/login" className="font-bold transition-colors" style={{color: '#5B54E8'}}>Sign in →</a>
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-3 text-xs flex-wrap"
          style={{color: 'rgba(255,255,255,0.6)'}}>
          <span className="flex items-center gap-1"><CheckCircle size={11} /> Free forever</span>
          <span style={{color: 'rgba(255,255,255,0.3)'}}>·</span>
          <span className="flex items-center gap-1"><CheckCircle size={11} /> Privacy first</span>
          <span style={{color: 'rgba(255,255,255,0.3)'}}>·</span>
          <span className="flex items-center gap-1"><CheckCircle size={11} /> Secure signup</span>
        </div>

        <p className="text-center text-xs mt-4" style={{color: 'rgba(255,255,255,0.4)'}}>
          © 2026 BH360 · Empowering Filipino communities
        </p>
      </div>
    </div>
  )
}