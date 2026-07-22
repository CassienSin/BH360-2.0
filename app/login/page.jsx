'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { Eye, EyeOff, Mail, Lock, ArrowRight, ArrowLeft, CheckCircle, Shield, Users, Activity, KeyRound } from 'lucide-react'
import Image from 'next/image'
import { dashboardPath } from '@/lib/roles'

const dots = [...Array(25)].map((_, i) => ({
  size: (((i * 7) % 6) + 3),
  left: ((i * 17 + 13) % 100),
  top: ((i * 23 + 7) % 100),
  duration: ((i * 3) % 6) + 4,
  delay: (i * 0.7) % 4,
}))

// Friendlier wording for the most common auth errors
function friendlyAuthError(message) {
  if (/invalid login credentials/i.test(message)) {
    return 'Incorrect email or password. Please try again.'
  }
  if (/email not confirmed/i.test(message)) {
    return 'Please confirm your email first — check your inbox for the verification link.'
  }
  if (/rate limit|too many/i.test(message)) {
    return 'Too many attempts. Please wait a moment and try again.'
  }
  return message
}

export default function LoginPage() {
  const supabase = useMemo(() => createClient(), [])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // 'login' | 'forgot' | 'forgot-sent'
  const [mode, setMode] = useState('login')

  // THE BACK-BUTTON FIX, part 1: if someone who is already signed in lands
  // on /login (e.g. by pressing back from their dashboard), bounce them
  // straight back to their dashboard instead of showing the login form.
  useEffect(() => {
    let cancelled = false
    async function checkExistingSession() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || cancelled) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, is_super_admin, deactivated_at')
        .eq('id', session.user.id)
        .maybeSingle()
      if (cancelled || profile?.deactivated_at) return
      window.location.replace(dashboardPath(profile))
    }
    checkExistingSession()
    return () => { cancelled = true }
  }, [supabase])

  function switchMode(next) {
    setMode(next)
    setError('')
  }

  async function handleLogin(e) {
    e.preventDefault()
    // The submit button is disabled while loading, but pressing Enter in an
    // input still fires the form's onSubmit — guard against double sign-in.
    if (loading) return
    setLoading(true)
    setError('')

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (authError) {
      setError(friendlyAuthError(authError.message))
      setLoading(false)
      return
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, is_super_admin, deactivated_at')
      .eq('id', data.user.id)
      .maybeSingle()

    if (profileError) {
      setError('Signed in, but we could not load your profile. Please try again.')
      setLoading(false)
      return
    }

    // Block deactivated accounts
    if (profile?.deactivated_at) {
      await supabase.auth.signOut()
      setError('This account has been deactivated. Please contact support to reactivate it.')
      setLoading(false)
      return
    }

    // THE BACK-BUTTON FIX, part 2: location.replace() swaps the login page
    // OUT of the browser history instead of stacking the dashboard on top
    // of it. Previously `window.location.href = ...` pushed a new entry,
    // so pressing back on mobile returned users to the login form.
    window.location.replace(dashboardPath(profile))
  }

  async function handleForgotPassword(e) {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setError('')

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: `${window.location.origin}/reset-password` }
    )

    setLoading(false)
    if (resetError) {
      setError(friendlyAuthError(resetError.message))
      return
    }
    // Always show success — Supabase doesn't reveal whether the email
    // exists, and neither should we (prevents account enumeration).
    setMode('forgot-sent')
  }

  return (
    <div className="min-h-screen flex bg-brand relative overflow-hidden">

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

      {/* Left panel — Brand showcase */}
      <div className="hidden lg:flex flex-1 flex-col items-center justify-center px-12 relative z-10">
        <div className="relative z-10 text-white text-center max-w-md">

          {/* Logo */}
          <div className="w-32 h-32 mx-auto mb-6 relative" style={{ animation: 'float 6s ease-in-out infinite' }}>
            <Image src="/logo.png" alt="BH360" fill sizes="128px" loading="eager" className="object-contain drop-shadow-2xl" />
          </div>

          <h1 className="text-5xl mb-3" style={{ fontWeight: 800, letterSpacing: '-2px', lineHeight: 1 }}>
            <span style={{
              background: 'linear-gradient(135deg, #fff 0%, #c4b5fd 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>BarangayHub 360</span>
          </h1>
          <p className="text-purple-200 text-sm font-light tracking-widest uppercase mb-10">Smart Community Management</p>

          {/* Feature list */}
          <div className="space-y-3 text-left max-w-sm mx-auto">
            {[
              { icon: Activity, text: 'Smart Incident Reporting', color: '#fb923c' },
              { icon: Shield, text: 'Real-time Tanod Dispatch', color: '#22c55e' },
              { icon: Shield, text: 'AI-Powered Analytics', color: '#fbbf24' },
              { icon: Users, text: 'Resident Support Tickets', color: '#a78bfa' },
            ].map(({ icon: Icon, text, color }) => (
              <div key={text} className="flex items-center gap-3 p-3 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)' }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.15)' }}>
                  <Icon size={14} style={{ color }} />
                </div>
                <span className="text-sm font-medium text-white">{text}</span>
              </div>
            ))}
          </div>

          {/* Trust line */}
          <div className="mt-10 flex items-center justify-center gap-2 text-xs text-purple-200">
            <CheckCircle size={11} /> Trusted by Filipino communities
          </div>
        </div>
      </div>

      {/* Right panel — Login / Forgot password */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 relative z-10">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8 fade-up">
            <div className="w-16 h-16 mx-auto mb-3 relative">
              <Image src="/logo.png" alt="BH360" fill sizes="64px" loading="eager" className="object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-white">BarangayHub 360</h1>
            <p className="text-purple-200 text-xs mt-1">Smart Community Management</p>
          </div>

          {/* Card */}
          <div className="rounded-3xl p-4 sm:p-6 md:p-8 fade-up-1"
            style={{
              background: 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 32px 80px rgba(0,0,0,0.2), 0 8px 24px rgba(91,84,232,0.15)',
              border: '1px solid rgba(255,255,255,0.5)',
            }}>

            {/* ---------- LOGIN MODE ---------- */}
            {mode === 'login' && (
              <>
                <div className="mb-8">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-3"
                    style={{ background: '#f0effe' }}>
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold" style={{ color: '#5B54E8' }}>Welcome back</span>
                  </div>
                  <h2 className="text-3xl font-black text-gray-900" style={{ letterSpacing: '-1px' }}>Sign in 👋</h2>
                  <p className="text-gray-400 text-sm mt-2">Continue to your barangay dashboard</p>
                </div>

                {error && (
                  <div className="mb-5 px-4 py-3 rounded-2xl text-sm flex items-start gap-2 fade-up"
                    role="alert"
                    style={{ background: '#fff1f1', border: '1px solid #fecaca' }}>
                    <span aria-hidden="true">⚠️</span>
                    <span className="text-red-700">{error}</span>
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">

                  <div className="fade-up-2">
                    <label htmlFor="login-email" className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Email Address</label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input id="login-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required
                        autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false}
                        className="input-field w-full rounded-2xl pl-11 pr-4 py-3.5 text-sm text-gray-800"
                        placeholder="you@email.com" />
                    </div>
                  </div>

                  <div className="fade-up-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="login-password" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Password</label>
                      <button type="button" onClick={() => switchMode('forgot')}
                        className="text-xs font-bold transition-colors hover:opacity-70"
                        style={{ color: '#5B54E8' }}>
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input id="login-password" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                        autoComplete="current-password"
                        className="input-field w-full rounded-2xl pl-11 pr-12 py-3.5 text-sm text-gray-800"
                        placeholder="••••••••" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="fade-up-4 pt-2">
                    <button type="submit" disabled={loading}
                      className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-white font-bold text-sm transition-all hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100"
                      style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 8px 32px rgba(91,84,232,0.4)' }}>
                      {loading ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Signing in...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">Sign In <ArrowRight size={16} /></span>
                      )}
                    </button>
                  </div>
                </form>

                <div className="mt-6 pt-6 border-t border-gray-100 text-center">
                  <p className="text-sm text-gray-400">
                    Don't have an account?{' '}
                    <a href="/register" className="font-bold transition-colors" style={{ color: '#5B54E8' }}>Create one →</a>
                  </p>
                </div>
              </>
            )}

            {/* ---------- FORGOT PASSWORD MODE ---------- */}
            {mode === 'forgot' && (
              <>
                <div className="mb-8">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-3"
                    style={{ background: '#f0effe' }}>
                    <KeyRound size={11} style={{ color: '#5B54E8' }} />
                    <span className="text-xs font-bold" style={{ color: '#5B54E8' }}>Password reset</span>
                  </div>
                  <h2 className="text-3xl font-black text-gray-900" style={{ letterSpacing: '-1px' }}>Forgot password?</h2>
                  <p className="text-gray-400 text-sm mt-2">Enter your email and we'll send you a link to set a new one.</p>
                </div>

                {error && (
                  <div className="mb-5 px-4 py-3 rounded-2xl text-sm flex items-start gap-2 fade-up"
                    role="alert"
                    style={{ background: '#fff1f1', border: '1px solid #fecaca' }}>
                    <span aria-hidden="true">⚠️</span>
                    <span className="text-red-700">{error}</span>
                  </div>
                )}

                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <label htmlFor="forgot-email" className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Email Address</label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input id="forgot-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required
                        autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false}
                        className="input-field w-full rounded-2xl pl-11 pr-4 py-3.5 text-sm text-gray-800"
                        placeholder="you@email.com" />
                    </div>
                  </div>

                  <button type="submit" disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-white font-bold text-sm transition-all hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100"
                    style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 8px 32px rgba(91,84,232,0.4)' }}>
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Sending link...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">Send Reset Link <ArrowRight size={16} /></span>
                    )}
                  </button>
                </form>

                <button onClick={() => switchMode('login')}
                  className="mt-6 w-full flex items-center justify-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors">
                  <ArrowLeft size={14} /> Back to sign in
                </button>
              </>
            )}

            {/* ---------- RESET LINK SENT ---------- */}
            {mode === 'forgot-sent' && (
              <div className="text-center py-4 fade-up">
                <div className="w-16 h-16 mx-auto rounded-3xl flex items-center justify-center mb-5"
                  style={{ background: '#f0fdf4' }}>
                  <Mail size={26} className="text-emerald-500" />
                </div>
                <h2 className="text-2xl font-black text-gray-900" style={{ letterSpacing: '-1px' }}>Check your email 📬</h2>
                <p className="text-gray-400 text-sm mt-3 max-w-xs mx-auto">
                  If an account exists for <span className="font-semibold text-gray-600">{email}</span>, a
                  password reset link is on its way. It may take a minute — check your spam folder too.
                </p>
                <p className="text-xs text-gray-400 mt-4">The link expires after a short time, so use it soon.</p>

                <button onClick={() => switchMode('login')}
                  className="mt-8 w-full flex items-center justify-center gap-1.5 py-3.5 rounded-2xl text-sm font-bold transition-colors hover:bg-gray-50"
                  style={{ color: '#5B54E8', border: '1px solid #e8e3ff' }}>
                  <ArrowLeft size={14} /> Back to sign in
                </button>
              </div>
            )}
          </div>

          {/* Footer trust line */}
          <div className="mt-6 flex items-center justify-center gap-3 text-xs flex-wrap"
            style={{ color: 'rgba(255,255,255,0.6)' }}>
            <span className="flex items-center gap-1"><CheckCircle size={11} /> Secure login</span>
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
            <span className="flex items-center gap-1"><CheckCircle size={11} /> Privacy first</span>
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
            <span className="flex items-center gap-1"><CheckCircle size={11} /> Free forever</span>
          </div>

          <p className="text-center text-xs mt-4" style={{ color: 'rgba(255,255,255,0.4)' }}>
            © 2026 BH360 · Empowering Filipino communities
          </p>
        </div>
      </div>
    </div>
  )
}