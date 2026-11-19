'use client'
// This is where the email's reset link lands. Supabase signs the user in
// with a temporary "recovery" session via the link, and this page lets
// them set a new password with supabase.auth.updateUser().

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { Eye, EyeOff, Lock, Check, X, Loader2 } from 'lucide-react'
import Link from 'next/link'
import AuthShell, { AuthHeading } from '@/components/crafted/AuthShell'
import { Field } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Notice } from '@/components/ui/notice'
import { PASSWORD_RULES, checkPassword } from '@/lib/passwordRules'
import { useBrowserValue } from '@/lib/useHydrated'

export default function ResetPasswordPage() {
  const supabase = useMemo(() => createClient(), [])
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  // 1) If Supabase already rejected the link, it says so explicitly in the
  //    URL hash (#error=...&error_code=otp_expired etc). That is fixed for
  //    the life of the page, so it is read once rather than kept in state.
  const linkRejected = useBrowserValue(() => Boolean(new URLSearchParams(window.location.hash.slice(1)).get('error')), false)

  // 'checking' | 'ready' | 'invalid'
  const [linkCheck, setLinkState] = useState('checking')
  const linkState = linkRejected ? 'invalid' : linkCheck

  useEffect(() => {
    let cancelled = false

    if (linkRejected) {
      const hashParams = new URLSearchParams(window.location.hash.slice(1))
      console.error('Auth link error:',
        hashParams.get('error_code'), '—', hashParams.get('error_description'))
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
      // 3) IMPORTANT ORDERING: the @supabase/ssr browser client AUTO-
      //    exchanges ?code= on page load. Auth codes are single-use, so if
      //    we also exchange immediately, one of the two calls always fails
      //    and we'd wrongly show "Link expired" despite a valid session.
      //    So: session first, manual exchange only as fallback, and never
      //    declare the link dead without a final session re-check.
      const { data: { session } } = await supabase.auth.getSession()
      if (cancelled) return
      if (session) { setLinkState('ready'); return }

      // token_hash flow (from our customized email template): verified
      // directly with the auth server — no PKCE verifier needed, so the
      // link works from ANY browser or device, including phones.
      const search = new URLSearchParams(window.location.search)
      const tokenHash = search.get('token_hash')
      if (tokenHash) {
        const { error: vError } = await supabase.auth.verifyOtp({
          type: 'recovery',
          token_hash: tokenHash,
        })
        if (cancelled) return
        if (vError) {
          console.error('Token verification failed:', vError.message)
          setLinkState(prev => (prev === 'ready' ? prev : 'invalid'))
        } else {
          setLinkState('ready')
        }
        return
      }

      const code = new URLSearchParams(window.location.search).get('code')
      if (code) {
        const { error: xError } = await supabase.auth.exchangeCodeForSession(code)
        if (cancelled) return
        if (!xError) { setLinkState('ready'); return }
        console.error('Manual code exchange failed:', xError.message)

        // The auto-exchange may have consumed the code just before us —
        // in that case a session EXISTS even though our exchange errored.
        const { data: { session: s2 } } = await supabase.auth.getSession()
        if (cancelled) return
        if (s2) { setLinkState('ready'); return }

        // Final beat: let any in-flight auto-exchange land, then decide.
        setTimeout(async () => {
          if (cancelled) return
          const { data: { session: s3 } } = await supabase.auth.getSession()
          if (cancelled) return
          setLinkState(prev => (prev === 'ready' ? prev : (s3 ? 'ready' : 'invalid')))
        }, 2500)
        return
      }

      // 4) Older-style links carry tokens in the hash, processed
      //    asynchronously — allow a generous grace period.
      setTimeout(() => {
        if (!cancelled) {
          setLinkState(prev => (prev === 'checking' ? 'invalid' : prev))
        }
      }, 6000)
    }
    verify()

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [supabase, linkRejected])

  const { checks } = checkPassword(password)

  async function handleReset(e) {
    e.preventDefault()
    if (loading) return
    setError('')

    if (!checkPassword(password).ok) {
      setError('Your new password doesn’t meet all the requirements below.')
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
    <AuthShell title="Reset password" backHref="/login"
      below={linkState === 'ready' && !done ? <Link href="/login">Back to sign in</Link> : undefined}>

      {/* Verifying the link */}
      {linkState === 'checking' && !done && (
        <div className="py-8 text-center" role="status">
          <Loader2 size={22} className="mx-auto mb-3 animate-spin text-brand-strong" aria-hidden="true" />
          <p className="text-sm text-body">Checking your reset link…</p>
        </div>
      )}

      {/* Link invalid or expired */}
      {linkState === 'invalid' && !done && (
        <>
          <AuthHeading title="This link has expired" sub="It was already used, or it’s too old. Ask for a new one with “Forgot password?” on the sign-in page." />
          <Button asChild size="lg" full><Link href="/login">Back to sign in</Link></Button>
        </>
      )}

      {/* New password form */}
      {linkState === 'ready' && !done && (
        <>
          <AuthHeading title="Set a new password" sub="Pick one you haven’t used before." />
          {error && <Notice tone="danger" className="mb-4">{error}</Notice>}

          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <Field id="new-password" label="New password" icon={<Lock />} type={showPassword ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)} required minLength={8}
                autoComplete="new-password" placeholder="Create a strong password"
                aria-describedby="new-password-rules"
                trailing={
                  <IconButton kind="ghost" label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff size={16} strokeWidth={1.9} /> : <Eye size={16} strokeWidth={1.9} />}
                  </IconButton>
                } />
              <ul id="new-password-rules" className="mt-2.5 grid gap-1 sm:grid-cols-2" aria-label="Password requirements">
                {PASSWORD_RULES.map(({ key, label }) => {
                  const met = checks[key]
                  return (
                    <li key={key} className={`flex items-center gap-1.5 text-xs ${met ? 'text-ok' : 'text-muted-foreground'}`}>
                      {met ? <Check size={12} strokeWidth={2.4} aria-hidden="true" /> : <X size={12} aria-hidden="true" />}
                      <span>{label}<span className="sr-only">{met ? ' (met)' : ' (not met yet)'}</span></span>
                    </li>
                  )
                })}
              </ul>
            </div>

            <Field id="confirm-password" label="Confirm password" icon={<Lock />} type={showPassword ? 'text' : 'password'} value={confirm}
              onChange={e => setConfirm(e.target.value)} required minLength={8}
              autoComplete="new-password" placeholder="Type it again"
              error={confirm && confirm !== password ? 'Passwords don’t match yet.' : undefined} />

            <Button type="submit" size="lg" full disabled={loading} aria-busy={loading || undefined}>
              {loading ? <><Loader2 className="animate-spin" aria-hidden="true" />Saving…</> : 'Save new password'}
            </Button>
          </form>
        </>
      )}

      {/* Success */}
      {done && (
        <>
          <AuthHeading title="Password changed" />
          <Notice tone="ok" title="All set." className="mb-5">Sign in with your new password to continue.</Notice>
          <Button asChild size="lg" full><Link href="/login">Sign in</Link></Button>
        </>
      )}
    </AuthShell>
  )
}
