'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { Eye, EyeOff, Mail, Lock, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { postLoginPath } from '@/lib/loginRedirect'
import { greeting } from '@/lib/homeSummary'
import { useBrowserValue } from '@/lib/useHydrated'
import AuthShell, { AuthHeading } from '@/components/crafted/AuthShell'
import { Field } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Notice } from '@/components/ui/notice'

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
  // "Magandang gabi" by the device clock — only once in the browser, so the
  // prerendered HTML (server time) never disagrees with it.
  const hello = useBrowserValue(() => greeting(), null)

  // THE BACK-BUTTON FIX, part 1: if someone who is already signed in lands
  // on /login (e.g. by pressing back from their dashboard), bounce them
  // straight back to their dashboard instead of showing the login form.
  useEffect(() => {
    let cancelled = false
    async function checkExistingSession() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || cancelled) return
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role, is_super_admin, deactivated_at')
        .eq('id', session.user.id)
        .maybeSingle()
      if (cancelled || profile?.deactivated_at) return
      // dashboardPath(null) resolves to '/resident', so routing on a failed
      // lookup would drop an official — or the super admin — onto the
      // resident dashboard. Stay on the login page instead and let them
      // sign in deliberately.
      if (error || !profile) {
        console.error('Could not read the signed-in profile:', error)
        return
      }
      window.location.replace(postLoginPath(profile))
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
    window.location.replace(postLoginPath(profile))
  }

  async function handleForgotPassword(e) {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setError('')

    // Use an implicit-flow client JUST for the reset request: the PKCE
    // client mints pkce_-prefixed tokens that must be redeemed in the
    // same browser, which breaks cross-device email links. Implicit-flow
    // tokens verify server-side from any device via verifyOtp. This
    // client is throwaway — no persistence, no refresh loop — so it
    // can't cause token-rotation conflicts with the main client.
    const resetClient = createSupabaseJsClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { flowType: 'implicit', autoRefreshToken: false, persistSession: false } }
    )
    const { error: resetError } = await resetClient.auth.resetPasswordForEmail(
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

  const busy = <><Loader2 className="animate-spin" aria-hidden="true" /></>

  // Forgot-password modes get a back button and their own title on phones.
  const forgot = mode !== 'login'
  return (
    <AuthShell
      title={forgot ? 'Reset password' : undefined}
      onBack={forgot ? () => switchMode('login') : undefined}
      below={forgot
        ? <button type="button" onClick={() => switchMode('login')} className="font-bold text-white hover:underline underline-offset-4">Back to sign in</button>
        : <>Barangay officials: <Link href="/request-access">request access</Link></>}>

      {/* ---------- LOGIN MODE ---------- */}
      {mode === 'login' && (
        <>
          <AuthHeading title="Sign in" sub={`${hello ? `${hello}. ` : ''}Use the email you signed up with.`} />

          {error && <Notice tone="danger" className="mb-4">{error}</Notice>}

          <form onSubmit={handleLogin} className="space-y-4">
            <Field id="login-email" label="Email" icon={<Mail />} type="email" value={email} onChange={e => setEmail(e.target.value)} required
              autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false}
              placeholder="name@email.com" />

            <Field id="login-password" label="Password" icon={<Lock />} type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
              autoComplete="current-password" placeholder="Your password"
              trailing={
                <IconButton kind="ghost" label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff size={16} strokeWidth={1.9} /> : <Eye size={16} strokeWidth={1.9} />}
                </IconButton>
              } />

            <div className="flex justify-end">
              <button type="button" onClick={() => switchMode('forgot')}
                className="text-[13px] font-bold text-brand-strong hover:text-brand-deep rounded-md">
                Forgot password?
              </button>
            </div>

            <Button type="submit" size="lg" full disabled={loading} aria-busy={loading || undefined}>
              {loading ? <>{busy}Signing in…</> : 'Sign in'}
            </Button>
          </form>

          <p className="mt-6 pt-5 border-t border-line text-center text-sm text-body">
            New here? <Link href="/register" className="font-bold text-brand-strong hover:text-brand-deep">Create an account</Link>
          </p>
        </>
      )}

      {/* ---------- FORGOT PASSWORD (and sent) ---------- */}
      {forgot && (
        <>
          <AuthHeading title="Forgot your password?" sub="We will email you a link to set a new one." />

          {error && <Notice tone="danger" className="mb-4">{error}</Notice>}

          <form onSubmit={handleForgotPassword} className="space-y-4">
            <Field id="forgot-email" label="Email" icon={<Mail />} type="email" value={email} onChange={e => setEmail(e.target.value)} required
              autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false}
              placeholder="name@email.com" />

            <Button type="submit" size="lg" full disabled={loading} aria-busy={loading || undefined}>
              {loading ? <>{busy}Sending link…</> : mode === 'forgot-sent' ? 'Send it again' : 'Send reset link'}
            </Button>
          </form>

          {mode === 'forgot-sent' && (
            <Notice tone="ok" title="Check your email." className="mt-4" aria-live="polite">
              If an account uses <span className="font-semibold">{email}</span>, a link is on its way. It can take a minute, so check your spam folder too. The link expires after a short time.
            </Notice>
          )}
        </>
      )}
    </AuthShell>
  )
}
