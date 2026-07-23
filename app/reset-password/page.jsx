'use client'
// Save as: app/reset-password/page.jsx
//
// This is where the email's reset link lands. Supabase signs the user in
// with a temporary "recovery" session via the link, and this page lets
// them set a new password with supabase.auth.updateUser().

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { Eye, EyeOff, Lock, ArrowRight, CheckCircle, KeyRound } from 'lucide-react'
import Image from 'next/image'

export default function ResetPasswordPage() {
  const supabase = useMemo(() => createClient(), [])
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  // 'checking' | 'ready' | 'invalid'
  const [linkState, setLinkState] = useState('checking')

  useEffect(() => {
    let cancelled = false

    // 1) If Supabase already rejected the link, it says so explicitly in
    //    the URL hash (#error=...&error_code=otp_expired etc). Surface
    //    that instead of guessing via timeouts.
    const hashParams = new URLSearchParams(window.location.hash.slice(1))
    if (hashParams.get('error')) {
      console.error('Auth link error:',
        hashParams.get('error_code'), '—', hashParams.get('error_description'))
      setLinkState('invalid')
      return
    }

    // 2) Whichever signal arrives first wins: the auth event fired by the
    //    client's own URL processing, or our explicit verification below.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (cancelled) return
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setLinkState('ready')
      }
    })

    async function verify() {
      // 3) PKCE flow: modern recovery links arrive with ?code=... — exchange
      //    it explicitly rather than racing the client's auto-detection
      //    against a timeout. NOTE: this exchange only succeeds in the SAME
      //    BROWSER that requested the reset (the code verifier lives in its
      //    storage). Opening the link elsewhere fails here by design.
      const code = new URLSearchParams(window.location.search).get('code')
      if (code) {
        const { error: xError } = await supabase.auth.exchangeCodeForSession(code)
        if (cancelled) return
        if (xError) {
          console.error('Code exchange failed:', xError.message)
          setLinkState('invalid')
        } else {
          setLinkState('ready')
        }
        return
      }

      // 4) Older-style links carry tokens in the hash, which the client
      //    processes asynchronously — check for a session, then allow a
      //    generous grace period before declaring the link dead.
      const { data: { session } } = await supabase.auth.getSession()
      if (cancelled) return
      if (session) {
        setLinkState('ready')
      } else {
        setTimeout(() => {
          if (!cancelled) {
            setLinkState(prev => (prev === 'checking' ? 'invalid' : prev))
          }
        }, 6000)
      }
    }
    verify()

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [supabase])

  async function handleReset(e) {
    e.preventDefault()
    if (loading) return
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      if (/same password|different from the old/i.test(updateError.message)) {
        setError('Your new password must be different from your old one.')
      } else if (/expired|invalid/i.test(updateError.message)) {
        setError('This reset link has expired. Please request a new one from the login page.')
      } else {
        setError(updateError.message)
      }
      return
    }

    // Sign out the recovery session so they log in fresh with the new
    // password — cleaner than silently landing them in a dashboard.
    await supabase.auth.signOut()
    setDone(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand relative overflow-hidden px-6 py-12">

      {/* Soft background glow, consistent with the login page */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 right-20 w-[500px] h-[500px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #a78bfa 0%, transparent 70%)', filter: 'blur(80px)' }} />
        <div className="absolute bottom-0 left-20 w-[400px] h-[400px] rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)', filter: 'blur(60px)' }} />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8 fade-up">
          <div className="w-16 h-16 mx-auto mb-3 relative">
            <Image src="/logo.png" alt="BH360" fill sizes="64px" loading="eager" className="object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-white">BarangayHub 360</h1>
        </div>

        <div className="rounded-3xl p-4 sm:p-6 md:p-8 fade-up-1"
          style={{
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 32px 80px rgba(0,0,0,0.2), 0 8px 24px rgba(91,84,232,0.15)',
            border: '1px solid rgba(255,255,255,0.5)',
          }}>

          {/* Verifying the link */}
          {linkState === 'checking' && !done && (
            <div className="text-center py-8">
              <svg className="animate-spin w-6 h-6 mx-auto mb-4" fill="none" viewBox="0 0 24 24" aria-hidden="true" style={{ color: '#5B54E8' }}>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm text-gray-500">Verifying your reset link...</p>
            </div>
          )}

          {/* Link invalid or expired */}
          {linkState === 'invalid' && !done && (
            <div className="text-center py-4">
              <div className="w-16 h-16 mx-auto rounded-3xl flex items-center justify-center mb-5"
                style={{ background: '#fff1f1' }}>
                <KeyRound size={26} className="text-red-400" />
              </div>
              <h2 className="text-2xl font-black text-gray-900" style={{ letterSpacing: '-1px' }}>Link expired</h2>
              <p className="text-gray-400 text-sm mt-3 max-w-xs mx-auto">
                This password reset link is invalid, already used, or was opened in a
                different browser than the one that requested it. Request a new link
                from the login page — and open it on this same device and browser.
              </p>
              <a href="/login"
                className="mt-8 w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-white font-bold text-sm transition-all hover:scale-[1.02]"
                style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 8px 32px rgba(91,84,232,0.4)' }}>
                Back to Sign In <ArrowRight size={16} />
              </a>
            </div>
          )}

          {/* New password form */}
          {linkState === 'ready' && !done && (
            <>
              <div className="mb-8">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-3"
                  style={{ background: '#f0effe' }}>
                  <KeyRound size={11} style={{ color: '#5B54E8' }} />
                  <span className="text-xs font-bold" style={{ color: '#5B54E8' }}>Almost there</span>
                </div>
                <h2 className="text-3xl font-black text-gray-900" style={{ letterSpacing: '-1px' }}>Set new password 🔐</h2>
                <p className="text-gray-400 text-sm mt-2">Choose a strong password you haven't used before.</p>
              </div>

              {error && (
                <div className="mb-5 px-4 py-3 rounded-2xl text-sm flex items-start gap-2 fade-up"
                  role="alert"
                  style={{ background: '#fff1f1', border: '1px solid #fecaca' }}>
                  <span aria-hidden="true">⚠️</span>
                  <span className="text-red-700">{error}</span>
                </div>
              )}

              <form onSubmit={handleReset} className="space-y-4">
                <div>
                  <label htmlFor="new-password" className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">New Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input id="new-password" type={showPassword ? 'text' : 'password'} value={password}
                      onChange={e => setPassword(e.target.value)} required minLength={8}
                      autoComplete="new-password"
                      className="input-field w-full rounded-2xl pl-11 pr-12 py-3.5 text-sm text-gray-800"
                      placeholder="At least 8 characters" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="confirm-password" className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input id="confirm-password" type={showPassword ? 'text' : 'password'} value={confirm}
                      onChange={e => setConfirm(e.target.value)} required minLength={8}
                      autoComplete="new-password"
                      className="input-field w-full rounded-2xl pl-11 pr-4 py-3.5 text-sm text-gray-800"
                      placeholder="Repeat your new password" />
                  </div>
                </div>

                <div className="pt-2">
                  <button type="submit" disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-white font-bold text-sm transition-all hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100"
                    style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 8px 32px rgba(91,84,232,0.4)' }}>
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Updating password...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">Update Password <ArrowRight size={16} /></span>
                    )}
                  </button>
                </div>
              </form>
            </>
          )}

          {/* Success */}
          {done && (
            <div className="text-center py-4 fade-up">
              <div className="w-16 h-16 mx-auto rounded-3xl flex items-center justify-center mb-5"
                style={{ background: '#f0fdf4' }}>
                <CheckCircle size={26} className="text-emerald-500" />
              </div>
              <h2 className="text-2xl font-black text-gray-900" style={{ letterSpacing: '-1px' }}>Password updated! ✅</h2>
              <p className="text-gray-400 text-sm mt-3 max-w-xs mx-auto">
                Your password has been changed. Sign in with your new password to continue.
              </p>
              <a href="/login"
                className="mt-8 w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-white font-bold text-sm transition-all hover:scale-[1.02]"
                style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 8px 32px rgba(91,84,232,0.4)' }}>
                Sign In <ArrowRight size={16} />
              </a>
            </div>
          )}
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'rgba(255,255,255,0.4)' }}>
          © 2026 BH360 · Empowering Filipino communities
        </p>
      </div>
    </div>
  )
}