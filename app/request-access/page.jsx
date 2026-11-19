'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Mail, Phone, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import SearchSelect from '@/components/SearchSelect'
import AuthShell, { AuthHeading } from '@/components/crafted/AuthShell'
import { Field } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { getProvinces, getCities, getBarangays } from '@/lib/locations'

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
      <AuthShell title="Request access" below={<Link href="/">Back to home</Link>}>
        <AuthHeading title="Request sent" sub={<>Thanks. We’ll review it and send your invite code to <span className="font-bold text-ink">{form.email}</span> once it’s approved.</>} />
        <div className="rounded-[10px] bg-brand-soft px-4 py-3.5 mb-5">
          <p className="text-xs font-bold tracking-[0.06em] uppercase text-brand-strong mb-2">What happens next</p>
          <ol className="space-y-1.5 text-[13px] leading-[1.5] text-ink list-decimal pl-4">
            <li>We verify your position and barangay.</li>
            <li>You get an official invite code by email.</li>
            <li>Sign up with the code, then invite your team.</li>
          </ol>
        </div>
        <Button size="lg" full onClick={() => router.push('/')}>Back to home</Button>
      </AuthShell>
    )
  }

  return (
    <AuthShell width={600} title="Request access"
      below={<>Already have an invite code? <Link href="/register">Sign up with it</Link></>}>
      <AuthHeading title="Request access" sub="For Punong Barangays and secretaries. We review every request, then send an invite code for your officials." />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field id="ra-name" label="Your full name" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
            required maxLength={100} autoComplete="name" placeholder="As on your ID" />
          <Field id="ra-position" label="Position" value={form.position} onChange={e => setForm({ ...form, position: e.target.value })}
            required maxLength={100} autoComplete="organization-title" placeholder="e.g. Punong Barangay" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field id="ra-email" label="Work email" icon={<Mail />} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
            required autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} placeholder="name@email.com" />
          <Field id="ra-phone" label="Mobile number" icon={<Phone />} type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 11) })}
            required maxLength={11} autoComplete="tel-national" inputMode="numeric" placeholder="09XX XXX XXXX" />
        </div>

        {/* Provinces and cities are plain string arrays, which is exactly
            what SearchSelect's default getLabel/getValue (identity) expect.
            Barangays are { id, name } rows, so those need explicit accessors. */}
        <fieldset className="space-y-2.5">
          <legend className="mb-1.5 text-[13px] font-bold text-ink">Barangay</legend>
          <SearchSelect value={selectedProvince} onChange={chooseProvince} options={provinces} placeholder="Province" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <SearchSelect value={selectedCity} onChange={chooseCity} options={cities}
              placeholder={!selectedProvince ? 'Pick a province first' : loadingLocations && !selectedCity ? 'Loading cities…' : 'City or municipality'}
              disabled={!selectedProvince || loadingLocations} />
            <SearchSelect value={selectedBarangay} onChange={setSelectedBarangay} options={barangays}
              getLabel={(b) => b.name} getValue={(b) => b.id}
              placeholder={!selectedCity ? 'Pick a city first' : loadingLocations ? 'Loading barangays…' : 'Barangay'}
              disabled={!selectedCity || loadingLocations} />
          </div>
        </fieldset>

        <Field id="ra-message" label="Anything else" optional hint={`${form.message.length} of 500`}>
          <Textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })}
            rows={3} maxLength={500} placeholder="Anything that helps us verify your request" />
        </Field>

        <Button type="submit" size="lg" full disabled={submitting} aria-busy={submitting || undefined}>
          {submitting ? <><Loader2 className="animate-spin" aria-hidden="true" />Sending…</> : 'Send request'}
        </Button>
      </form>
    </AuthShell>
  )
}
