'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getProvinces, getCities, getBarangays } from '@/lib/locations'
import { Eye, EyeOff, Mail, Lock, Phone, MapPin, KeyRound, Check, X, Loader2 } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import SearchSelect from '@/components/SearchSelect'
import { PASSWORD_RULES, checkPassword } from '@/lib/passwordRules'
import AuthShell, { AuthHeading } from '@/components/crafted/AuthShell'
import { Field } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Notice } from '@/components/ui/notice'
import { Tag } from '@/components/ui/tag'
import { ResidentIcon, OfficialIcon, TanodsIcon } from '@/components/icons/BhIcons'

const roles = [
  { value: 'resident', label: 'Resident', desc: 'Live in the barangay. Sign up on your own; an official verifies you.', icon: ResidentIcon, public: true },
  { value: 'official', label: 'Barangay official', desc: 'Captain, kagawad or secretary. Needs an invite code.', icon: OfficialIcon, public: false },
  { value: 'tanod', label: 'Tanod', desc: 'Respond to reports on duty. Needs an invite code.', icon: TanodsIcon, public: false },
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

  const roleInfo = roles.find(r => r.value === selectedRole)
  const busy = <Loader2 className="animate-spin" aria-hidden="true" />
  const strengthTone = passwordStrength <= 2 ? 'var(--danger)' : passwordStrength <= 3 ? 'var(--warn)' : 'var(--ok)'
  const eye = (shown, toggle) => (
    <IconButton kind="ghost" label={shown ? 'Hide password' : 'Show password'} onClick={toggle}>
      {shown ? <EyeOff size={16} strokeWidth={1.9} /> : <Eye size={16} strokeWidth={1.9} />}
    </IconButton>
  )

  return (
    <AuthShell
      width={!awaitingConfirmation && step === 2 ? 560 : 440}
      title="Create an account"
      backHref="/"
      onBack={!awaitingConfirmation && step === 2 ? () => { setStep(1); setError('') } : undefined}
      below={!awaitingConfirmation && <>Have an account? <Link href="/login">Sign in</Link></>}>

      {/* Confirmation required */}
      {awaitingConfirmation && (
        <>
          <AuthHeading title="Check your email" sub={<>We sent a confirmation link to <span className="font-bold text-ink">{form.email}</span>. Open it to activate your account, then sign in.</>} />
          <Button size="lg" full onClick={() => router.replace('/login')}>Go to sign in</Button>
        </>
      )}

      {/* Step 1 — role */}
      {!awaitingConfirmation && step === 1 && (
        <>
          <AuthHeading eyebrow="Step 1 of 2" title="Who are you?" sub="Pick the one that fits." />
          {error && <Notice tone="danger" className="mb-4">{error}</Notice>}

          <div className="space-y-2.5 mb-4" role="radiogroup" aria-label="Select your role">
            {roles.map(role => {
              const on = selectedRole === role.value
              const RoleIcon = role.icon
              const pick = () => { setSelectedRole(role.value); setError(''); setInviteCode(''); setVerifiedBarangay(null) }
              return (
                <div key={role.value}
                  role="radio"
                  aria-checked={on}
                  tabIndex={0}
                  onClick={pick}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick() } }}
                  className={`flex items-start gap-3 rounded-[12px] cursor-pointer transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong ${on ? 'border-2 border-brand-strong bg-brand-soft px-[13px] py-[13px]' : 'border border-line bg-surface px-3.5 py-3.5 hover:border-line-strong'}`}>
                  <RoleIcon size={20} active={on} className="mt-0.5 shrink-0 text-brand-strong" style={{ '--bh-icon-knockout': on ? 'var(--brand-soft)' : 'var(--surface)' }} />
                  <div className="flex-1 min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-[15px] font-extrabold text-ink">
                      {role.label}
                      {!role.public && <Tag>Invite code</Tag>}
                    </p>
                    <p className="text-[13px] leading-[1.5] text-body mt-0.5">{role.desc}</p>
                  </div>
                  <span aria-hidden="true" className={`mt-0.5 size-5 shrink-0 rounded-full flex items-center justify-center border-2 ${on ? 'border-brand-strong' : 'border-line-strong bg-surface'}`}>
                    {on && <span className="size-2.5 rounded-full bg-brand-strong" />}
                  </span>
                </div>
              )
            })}
          </div>

          {selectedRole !== 'resident' && (
            <div className="mb-4">
              <Field id="invite-code" label="Invite code" icon={<KeyRound />}
                value={inviteCode}
                onChange={e => { setInviteCode(e.target.value); setError('') }}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleRoleNext() } }}
                autoCapitalize="characters" autoComplete="off" spellCheck={false}
                className="[&_input]:uppercase [&_input]:tracking-wider [&_input]:font-bold"
                placeholder={selectedRole === 'official' ? 'e.g. OFFICIAL-2026' : 'e.g. TANOD-2026'}
                hint="Ask your barangay captain for a code." />
              <p className="text-[13px] text-body mt-2">
                No code yet?{' '}
                <Link href="/request-access" className="font-bold text-brand-strong hover:text-brand-deep">Request access</Link>
              </p>
            </div>
          )}

          <Button size="lg" full onClick={handleRoleNext}
            disabled={inviteLoading || (selectedRole !== 'resident' && !inviteCode.trim())}
            aria-busy={inviteLoading || undefined}>
            {inviteLoading ? <>{busy}Checking the code…</> : 'Continue'}
          </Button>
        </>
      )}

      {/* Step 2 — details */}
      {!awaitingConfirmation && step === 2 && (
        <>
          <AuthHeading eyebrow={`Step 2 of 2 · ${roleInfo?.label}`} title="Your details"
            sub={selectedRole === 'resident' ? 'We use these to verify you live in the barangay.' : 'These go on your account.'} />
          {error && <Notice tone="danger" className="mb-4">{error}</Notice>}

          {verifiedBarangay && (
            <Notice tone="ok" title="Invite code accepted." className="mb-4">
              {verifiedBarangay.name}, {verifiedBarangay.city}, {verifiedBarangay.province}
            </Notice>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field id="reg-name" label="Full name" name="full_name" value={form.full_name} onChange={handleChange} required maxLength={100}
                autoComplete="name" placeholder="As on your ID" />
              <Field id="reg-phone" label="Mobile number" icon={<Phone />} name="phone" type="tel" value={form.phone} onChange={handlePhoneChange}
                maxLength={11} autoComplete="tel-national" inputMode="numeric" pattern="09[0-9]{9}"
                placeholder="09XX XXX XXXX" optional
                error={form.phone && !phoneValid ? (phonePrefixWrong ? 'Must start with 09' : `${form.phone.length} of 11 digits`) : undefined}
                hint={form.phone && phoneValid ? 'Looks right.' : undefined} />
            </div>

            <Field id="reg-email" label="Email" icon={<Mail />} name="email" type="email" value={form.email} onChange={handleChange} required
              autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false}
              placeholder="name@email.com" />

            <div>
              <Field id="reg-password" label="Password" icon={<Lock />} name="password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={handleChange} required
                autoComplete="new-password" placeholder="Create a strong password"
                trailing={eye(showPassword, () => setShowPassword(!showPassword))} />
              {form.password && (
                <div className="mt-2.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex flex-1 gap-1" aria-hidden="true">
                      {[1, 2, 3, 4, 5].map(i => (
                        <span key={i} className="h-1 flex-1 rounded-sm" style={{ background: i <= passwordStrength ? strengthTone : 'var(--line)' }} />
                      ))}
                    </div>
                    <span className="text-xs font-bold" style={{ color: strengthTone }}>{strengthLabel}</span>
                  </div>
                  <ul className="grid gap-1 sm:grid-cols-2">
                    {PASSWORD_RULES.map(({ key, label }) => (
                      <li key={key} className={`flex items-center gap-1.5 text-xs ${passwordChecks[key] ? 'text-ok' : 'text-muted-foreground'}`}>
                        {passwordChecks[key] ? <Check size={12} strokeWidth={2.4} aria-hidden="true" /> : <X size={12} aria-hidden="true" />}
                        <span>{label}<span className="sr-only">{passwordChecks[key] ? ' (done)' : ' (not yet)'}</span></span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <Field id="reg-confirm" label="Confirm password" icon={<Lock />} name="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} value={form.confirmPassword} onChange={handleChange} required
              autoComplete="new-password" placeholder="Type it again"
              trailing={eye(showConfirmPassword, () => setShowConfirmPassword(!showConfirmPassword))}
              error={form.confirmPassword && form.password !== form.confirmPassword ? 'Passwords don’t match' : undefined}
              hint={form.confirmPassword && form.password === form.confirmPassword && form.password ? 'Passwords match.' : undefined} />

            {/* Location: residents pick their barangay; an invite code carries it. */}
            {selectedRole === 'resident' && (
              <fieldset className="space-y-2.5">
                <legend className="mb-1.5 text-[13px] font-bold text-ink">Barangay</legend>
                <SearchSelect value={selectedProvince} onChange={chooseProvince} options={provinces} placeholder="Province" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <SearchSelect value={selectedCity} onChange={chooseCity} options={cities}
                    placeholder={selectedProvince ? 'City or municipality' : 'Pick a province first'} disabled={!selectedProvince} />
                  <SearchSelect value={selectedBarangayId} onChange={setSelectedBarangayId} options={barangays}
                    placeholder={selectedCity ? 'Barangay' : 'Pick a city first'} disabled={!selectedCity}
                    getLabel={(b) => b.name} getValue={(b) => b.id} />
                </div>
              </fieldset>
            )}

            <Field id="reg-address" label="Address" icon={<MapPin />} name="address" value={form.address} onChange={handleChange} maxLength={200}
              autoComplete="street-address" optional placeholder="Sitio, street, house number" />

            <div className="flex gap-2.5 pt-1">
              <Button variant="secondary" size="lg" onClick={() => { setStep(1); setError('') }}>Back</Button>
              <Button type="submit" size="lg" className="flex-1" disabled={loading || (form.phone.length > 0 && !phoneValid)} aria-busy={loading || undefined}>
                {loading ? <>{busy}Creating your account…</> : 'Create account'}
              </Button>
            </div>
          </form>
        </>
      )}
    </AuthShell>
  )
}
