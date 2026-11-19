'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { loginHref } from '@/lib/loginRedirect'
import { PageSkeleton } from '@/components/Skeletons'
import ClientBoundary from '@/components/ClientBoundary'
import { PAGE_HEADERS } from '@/lib/pageHeaders'
import { useSectionEntrance } from '@/lib/useSectionEntrance'
import { useUrlSection } from '@/lib/useUrlSection'
import { createClient } from '@/lib/supabase'
import { Phone, Camera, Lock, Loader2, Pencil, Eye, EyeOff, Check, ChevronRight, Settings, HelpCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { timeAgo, fullDate } from '@/lib/timeAgo'
import { isVerified, verificationStyle } from '@/lib/verification'
import { CategoryIcon, categoryColor } from '@/lib/categoryIcons'
import PageShell from '@/components/crafted/PageShell'
import { TicketsIcon, AnnouncementsIcon } from '@/components/icons/BhIcons'
import { Card, CardHead } from '@/components/ui/card'
import { Rows, Row, RowTitle } from '@/components/ui/table'
import { Field } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Segmented } from '@/components/ui/segmented'
import { StatStrip } from '@/components/ui/stat-strip'
import { Status } from '@/components/ui/tag'
import { Muted } from '@/components/ui/text'
import { initials } from '@/components/ui/avatar'

const EXT_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
}

const roleConfig = {
  resident: { label: 'Resident' },
  official: { label: 'Barangay official' },
  tanod: { label: 'Tanod' },
  super_admin: { label: 'Super admin' },
}

const PROFILE_TABS = ['info', 'activity', 'security']

function ProfilePage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const fileInputRef = useRef(null)

  const [profile, setProfile] = useState(null)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  // replace, not push: Back should leave Profile, not walk through its tabs
  const [activeTab, setActiveTab] = useUrlSection(PROFILE_TABS, 'info', { param: 'tab', history: 'replace' })

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    address: '',
  })

  const [passwordForm, setPasswordForm] = useState({ new: '', confirm: '' })
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

  // Activity data
  const [incidents, setIncidents] = useState([])
  const [tickets, setTickets] = useState([])
  const [announcements, setAnnouncements] = useState([])

  useEffect(() => {
    let cancelled = false
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.replace(loginHref())

      const { data: prof, error: profError } = await supabase
        .from('profiles')
        .select('*, barangays(id, name, city, province)')
        .eq('id', user.id)
        .maybeSingle()

      if (cancelled) return
      // Only a genuinely missing profile means "sign in again"; a failed
      // request means try again.
      if (profError) {
        console.error('Could not load your profile:', profError)
        toast.error('Could not load your profile. Please refresh.')
        setLoading(false)
        return
      }
      if (!prof) return router.replace(loginHref())

      setProfile(prof)
      setEmail(user.email || '')
      setForm({
        full_name: prof.full_name || '',
        phone: prof.phone || '',
        address: prof.address || '',
      })

      // Load activity based on role
      if (prof.role === 'resident') {
        const [incRes, tixRes] = await Promise.all([
          supabase.from('incidents')
            .select('id, title, status, created_at, priority, category')
            .eq('reported_by', user.id)
            .order('created_at', { ascending: false })
            .limit(20),
          supabase.from('tickets')
            .select('id, title, status, created_at')
            .eq('created_by', user.id)
            .order('created_at', { ascending: false })
            .limit(10),
        ])
        if (!cancelled) {
          setIncidents(incRes.data || [])
          setTickets(tixRes.data || [])
        }
      } else if (prof.role === 'tanod') {
        const { data: inc, error: incError } = await supabase.from('incidents')
          .select('id, title, status, created_at, priority, category, resolved_at, rating')
          .eq('assigned_to', user.id)
          .order('created_at', { ascending: false })
          .limit(20)
        // Personal stats. An empty list here would read as "you have never
        // been assigned anything", which is a discouraging thing to get wrong.
        if (incError) console.error('Could not load your assignment history:', incError)
        if (!cancelled) setIncidents(inc || [])
      } else if (prof.role === 'official') {
        const { data: ann, error: annError } = await supabase.from('announcements')
          .select('id, title, created_at')
          .eq('posted_by', user.id)
          .order('created_at', { ascending: false })
          .limit(20)
        if (annError) console.error('Could not load your announcements:', annError)
        if (!cancelled) setAnnouncements(ann || [])
      }

      if (!cancelled) setLoading(false)
    }
    loadData()
    return () => { cancelled = true }
  }, [supabase, router])

  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0]
    // Allow re-selecting the same file after a failed attempt
    e.target.value = ''
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB')
      return
    }

    setUploadingAvatar(true)

    // Upload the NEW avatar first, then update the profile, and only then
    // delete the old file. The previous order deleted the old avatar
    // before the upload — so a failed upload left the user with a broken
    // image and no way back.
    const ext = EXT_BY_MIME[file.type] || 'jpg'
    const fileName = `${profile.id}/${crypto.randomUUID()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { cacheControl: '3600', upsert: false, contentType: file.type })

    if (uploadError) {
      toast.error('Failed to upload avatar: ' + uploadError.message)
      setUploadingAvatar(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName)

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', profile.id)

    if (updateError) {
      // Roll back the orphaned upload
      await supabase.storage.from('avatars').remove([fileName]).catch(() => {})
      toast.error('Failed to update profile')
      setUploadingAvatar(false)
      return
    }

    // Clean up the old file last — a failure here is harmless
    const oldPath = profile.avatar_url?.split('/avatars/')[1]
    if (oldPath) {
      await supabase.storage.from('avatars').remove([oldPath]).catch(() => {})
    }

    setProfile({ ...profile, avatar_url: publicUrl })
    toast.success('Avatar updated! 🎉')
    setUploadingAvatar(false)
  }

  async function handleRemoveAvatar() {
    if (!profile.avatar_url || uploadingAvatar) return

    setUploadingAvatar(true)

    // Update the profile first; only delete the file once nothing
    // references it anymore.
    const { error } = await supabase.from('profiles')
      .update({ avatar_url: null })
      .eq('id', profile.id)

    if (error) {
      toast.error('Failed to remove avatar')
      setUploadingAvatar(false)
      return
    }

    const oldPath = profile.avatar_url.split('/avatars/')[1]
    if (oldPath) {
      await supabase.storage.from('avatars').remove([oldPath]).catch(() => {})
    }

    setProfile({ ...profile, avatar_url: null })
    toast.success('Avatar removed')
    setUploadingAvatar(false)
  }

  async function handleSave() {
    if (saving) return
    if (form.full_name.trim().length < 2) {
      toast.error('Name must be at least 2 characters')
      return
    }
    const phone = form.phone.trim()
    // Same rule as registration — previously the profile page accepted
    // any string, so a typo here broke the format the rest of the app
    // assumes for contacting reporters.
    if (phone && !/^09\d{9}$/.test(phone)) {
      toast.error('Phone must be in format 09xxxxxxxxx')
      return
    }
    setSaving(true)

    const updates = {
      full_name: form.full_name.trim(),
      phone: phone || null,
      address: form.address.trim() || null,
    }

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', profile.id)

    if (error) {
      toast.error('Failed to update profile: ' + error.message)
      setSaving(false)
      return
    }

    setProfile({ ...profile, ...updates })
    setEditing(false)
    setSaving(false)
    toast.success('Profile updated!')
  }

  async function handleChangePassword() {
    if (changingPassword) return
    if (passwordForm.new.length < 8) {
      toast.error('New password must be at least 8 characters')
      return
    }
    if (passwordForm.new !== passwordForm.confirm) {
      toast.error('Passwords do not match')
      return
    }

    setChangingPassword(true)

    const { error } = await supabase.auth.updateUser({ password: passwordForm.new })

    if (error) {
      toast.error('Failed to change password: ' + error.message)
      setChangingPassword(false)
      return
    }

    setPasswordForm({ new: '', confirm: '' })
    toast.success('Password changed successfully!')
    setChangingPassword(false)
  }

  function getDashboardPath() {
    if (profile?.is_super_admin) return '/admin'
    if (profile?.role === 'official') return '/official'
    if (profile?.role === 'tanod') return '/tanod'
    return '/resident'
  }

  const rc = profile?.is_super_admin
    ? roleConfig.super_admin
    : (roleConfig[profile?.role] || roleConfig.resident)

  // Activity stats
  const resolvedCount = incidents.filter(i => i.status === 'resolved').length
  const pendingCount = incidents.filter(i => i.status === 'pending').length
  const ratedIncidents = incidents.filter(i => i.rating)
  const avgRating = ratedIncidents.length
    ? (ratedIncidents.reduce((sum, i) => sum + i.rating, 0) / ratedIncidents.length).toFixed(1)
    : null
  const totalActivity = incidents.length + tickets.length + announcements.length

  const passwordsMatch = passwordForm.new && passwordForm.new === passwordForm.confirm

  // The open tab's card eases in when you switch tabs, not on page load.
  const tabEnter = useSectionEntrance(activeTab, !loading) ? 'fade-up' : ''

  if (loading) return <PageSkeleton layout="profile" header={PAGE_HEADERS.profile} />

  // On the band: the role, and for residents whether they're verified.
  const roleTag = profile?.role === 'resident' && !profile?.is_super_admin
    ? (isVerified(profile) ? 'Verified resident' : verificationStyle(profile?.verification_status).label)
    : rc.label
  const cancelEdit = () => { setEditing(false); setForm({ full_name: profile.full_name, phone: profile.phone || '', address: profile.address || '' }) }
  const place = profile?.barangays ? [profile.barangays.name, profile.barangays.city, profile.barangays.province].filter(Boolean).join(', ') : null

  const statusTone = { pending: 'warn', open: 'warn', assigned: 'info', in_progress: 'info', resolved: 'ok', closed: 'quiet' }
  const statusText = s => (s || '').replace('_', ' ').replace(/^./, c => c.toUpperCase())

  return (
    <PageShell
      title={PAGE_HEADERS.profile.title}
      onBack={() => router.push(getDashboardPath())}
      backLabel="Back to dashboard"
      actions={activeTab === 'info' && !editing ? (
        <IconButton kind="onband" label="Edit profile" onClick={() => { setActiveTab('info'); setEditing(true) }}>
          <Pencil size={16} strokeWidth={1.9} />
        </IconButton>
      ) : null}
      bandContent={(
        <>
          <div className="flex items-center gap-3.5">
            <div className="relative shrink-0">
              <span className="flex size-16 items-center justify-center overflow-hidden rounded-[14px] bg-white text-[22px] font-extrabold text-[#4A43D4]">
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt="" className="size-full object-cover" />
                  : initials(profile?.full_name)}
              </span>
              <button onClick={() => fileInputRef.current?.click()} disabled={uploadingAvatar}
                aria-label={profile?.avatar_url ? 'Change photo' : 'Add a photo'}
                className="absolute -right-1.5 -bottom-1.5 flex size-7 items-center justify-center rounded-full border-2 border-white bg-[#4A43D4] text-white outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-70">
                {uploadingAvatar ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Camera size={13} strokeWidth={2} aria-hidden="true" />}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[22px] font-extrabold leading-tight tracking-[-0.4px] text-white">{profile?.full_name}</p>
              <span className="mt-1.5 inline-flex h-[22px] items-center gap-1 rounded-[6px] bg-[var(--onband)] px-2 text-xs font-bold text-white">
                {isVerified(profile) && profile?.role === 'resident' && <Check size={12} strokeWidth={2.6} aria-hidden="true" />}
                {roleTag}
              </span>
              {profile?.avatar_url && !uploadingAvatar && (
                <button onClick={handleRemoveAvatar} className="ml-2 text-xs font-bold text-white/85 underline-offset-2 hover:underline">Remove photo</button>
              )}
            </div>
          </div>
          <Segmented onBand full label="Profile sections" value={activeTab} onChange={setActiveTab}
            items={[{ value: 'info', label: 'Details' }, { value: 'activity', label: 'Activity' }, { value: 'security', label: 'Password' }]} />
        </>
      )}>

      {/* DETAILS */}
      {activeTab === 'info' && (
        <div className={`flex flex-col gap-3.5 ${tabEnter}`}>
          {editing ? (
            <Card lift className="px-[18px] py-4 space-y-4">
              <h2 className="text-[15px] font-extrabold text-ink">Edit your details</h2>
              <Field id="profile-name" label="Full name" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
                maxLength={100} autoComplete="name" placeholder="Your full name" />
              <Field id="profile-phone" label="Mobile number" icon={<Phone />} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                maxLength={11} autoComplete="tel-national" inputMode="numeric" placeholder="09XX XXX XXXX" optional />
              <Field id="profile-address" label="Address" optional>
                <Textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
                  rows={2} maxLength={200} autoComplete="street-address" placeholder="Sitio, street, house number" className="min-h-[72px]" />
              </Field>
              <div className="flex gap-2.5">
                <Button variant="secondary" onClick={cancelEdit} disabled={saving}>Cancel</Button>
                <Button className="flex-1" onClick={handleSave} disabled={saving} aria-busy={saving || undefined}>
                  {saving ? <><Loader2 className="animate-spin" aria-hidden="true" />Saving…</> : 'Save changes'}
                </Button>
              </div>
            </Card>
          ) : (
            <Card lift>
              <dl className="divide-y divide-line">
                {[
                  ['Barangay', place],
                  ['Address', profile?.address],
                  ['Mobile', profile?.phone],
                  ['Email', email],
                  ['Member since', fullDate(profile?.created_at)],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-baseline gap-3 px-3.5 sm:px-[18px] py-3">
                    <dt className="w-[108px] shrink-0 text-[13px] text-muted-foreground">{label}</dt>
                    <dd className={`min-w-0 flex-1 text-sm font-bold break-words ${value ? 'text-ink' : 'font-normal text-muted-foreground'}`}>{value || 'Not added'}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}

          <Card>
            <Rows>
              <Row as={Link} href="/settings" interactive className="flex items-center gap-3">
                <Settings size={18} strokeWidth={1.9} className="text-brand-strong" aria-hidden="true" />
                <span className="flex-1 text-sm font-bold text-ink">Settings</span>
                <ChevronRight size={16} className="text-muted-foreground" aria-hidden="true" />
              </Row>
              <Row as={Link} href="/help" interactive className="flex items-center gap-3">
                <HelpCircle size={18} strokeWidth={1.9} className="text-brand-strong" aria-hidden="true" />
                <span className="flex-1 text-sm font-bold text-ink">Help and FAQ</span>
                <ChevronRight size={16} className="text-muted-foreground" aria-hidden="true" />
              </Row>
              <Row as="button" interactive onClick={() => setActiveTab('security')} className="flex items-center gap-3">
                <Lock size={18} strokeWidth={1.9} className="text-brand-strong" aria-hidden="true" />
                <span className="flex-1 text-sm font-bold text-ink">Change password</span>
                <ChevronRight size={16} className="text-muted-foreground" aria-hidden="true" />
              </Row>
            </Rows>
          </Card>
        </div>
      )}

      {/* ACTIVITY */}
      {activeTab === 'activity' && (
        <div className={`flex flex-col gap-3.5 ${tabEnter}`}>
          {profile?.role === 'resident' && (
            <StatStrip stats={[
              { label: 'My reports', value: incidents.length },
              { label: 'Waiting', value: pendingCount },
              { label: 'My tickets', value: tickets.length },
              { label: 'Resolved', value: resolvedCount, tone: resolvedCount ? 'ok' : 'default' },
            ]} />
          )}
          {profile?.role === 'tanod' && (
            <StatStrip stats={[
              { label: 'Assigned', value: incidents.length },
              { label: 'Resolved', value: resolvedCount, tone: resolvedCount ? 'ok' : 'default' },
              { label: 'Active', value: incidents.filter(i => i.status === 'assigned').length },
              // Average rating says far more about performance than a raw
              // count of how many ratings exist.
              { label: 'Avg. rating', value: avgRating ? `${avgRating} / 5` : '—', note: avgRating ? `${ratedIncidents.length} ratings` : 'no ratings yet' },
            ]} />
          )}
          {profile?.role === 'official' && (
            <StatStrip stats={[{ label: 'Announcements posted', value: announcements.length }]} />
          )}

          <Card>
            <CardHead title="Recent activity" />
            {totalActivity === 0 ? (
              <Muted className="px-[18px] pb-4">Nothing yet. Your reports, tickets and posts show up here.</Muted>
            ) : (
              <Rows className="border-t border-line">
                {profile?.role === 'resident' && incidents.map(inc => (
                  <Row key={inc.id} className="flex items-center gap-3">
                    <CategoryIcon category={inc.category} size={20} className="shrink-0" style={{ color: categoryColor(inc.category) }} />
                    <RowTitle className="flex-1" title={inc.title} sub={<span title={fullDate(inc.created_at)}>Reported {timeAgo(inc.created_at)}</span>} />
                    <Status tone={statusTone[inc.status] || 'quiet'}>{statusText(inc.status)}</Status>
                  </Row>
                ))}
                {profile?.role === 'resident' && tickets.map(t => (
                  <Row key={t.id} className="flex items-center gap-3">
                    <TicketsIcon size={20} className="shrink-0 text-brand-strong" />
                    <RowTitle className="flex-1" title={t.title} sub={<span title={fullDate(t.created_at)}>Ticket · {timeAgo(t.created_at)}</span>} />
                    <Status tone={statusTone[t.status] || 'quiet'}>{statusText(t.status)}</Status>
                  </Row>
                ))}
                {profile?.role === 'tanod' && incidents.map(inc => (
                  <Row key={inc.id} className="flex items-center gap-3">
                    <CategoryIcon category={inc.category} size={20} className="shrink-0" style={{ color: inc.status === 'resolved' ? 'var(--ok)' : categoryColor(inc.category) }} />
                    <RowTitle className="flex-1" title={inc.title}
                      sub={<span title={fullDate(inc.created_at)}>{inc.status === 'resolved' && inc.resolved_at ? `Resolved ${timeAgo(inc.resolved_at)}` : `Assigned ${timeAgo(inc.created_at)}`}{inc.rating ? ` · rated ${inc.rating}/5` : ''}</span>} />
                    <Status tone={statusTone[inc.status] || 'quiet'}>{statusText(inc.status)}</Status>
                  </Row>
                ))}
                {profile?.role === 'official' && announcements.map(a => (
                  <Row key={a.id} className="flex items-center gap-3">
                    <AnnouncementsIcon size={20} className="shrink-0 text-brand-strong" />
                    <RowTitle className="flex-1" title={a.title} sub={<span title={fullDate(a.created_at)}>Posted {timeAgo(a.created_at)}</span>} />
                  </Row>
                ))}
              </Rows>
            )}
          </Card>
        </div>
      )}

      {/* PASSWORD */}
      {activeTab === 'security' && (
        <Card lift className={`px-[18px] py-4 space-y-4 ${tabEnter}`}>
          <div>
            <h2 className="text-[15px] font-extrabold text-ink">Change password</h2>
            <p className="text-xs text-muted-foreground mt-0.5">At least 8 characters.</p>
          </div>
          <Field id="new-password" label="New password" icon={<Lock />} type={showNewPassword ? 'text' : 'password'}
            value={passwordForm.new} onChange={e => setPasswordForm({ ...passwordForm, new: e.target.value })}
            autoComplete="new-password" placeholder="At least 8 characters"
            trailing={
              <IconButton kind="ghost" label={showNewPassword ? 'Hide password' : 'Show password'} onClick={() => setShowNewPassword(!showNewPassword)}>
                {showNewPassword ? <EyeOff size={16} strokeWidth={1.9} /> : <Eye size={16} strokeWidth={1.9} />}
              </IconButton>
            } />
          <Field id="confirm-password" label="Confirm new password" icon={<Lock />} type={showConfirmPassword ? 'text' : 'password'}
            value={passwordForm.confirm} onChange={e => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
            onKeyDown={e => { if (e.key === 'Enter' && passwordsMatch) handleChangePassword() }}
            autoComplete="new-password" placeholder="Type it again"
            error={passwordForm.confirm && passwordForm.new !== passwordForm.confirm ? 'Passwords don’t match' : undefined}
            hint={passwordsMatch && passwordForm.confirm ? 'Passwords match.' : undefined}
            trailing={
              <IconButton kind="ghost" label={showConfirmPassword ? 'Hide password' : 'Show password'} onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                {showConfirmPassword ? <EyeOff size={16} strokeWidth={1.9} /> : <Eye size={16} strokeWidth={1.9} />}
              </IconButton>
            } />
          <Button size="lg" full onClick={handleChangePassword} disabled={changingPassword || !passwordForm.new || !passwordForm.confirm} aria-busy={changingPassword || undefined}>
            {changingPassword ? <><Loader2 className="animate-spin" aria-hidden="true" />Saving…</> : 'Save new password'}
          </Button>
        </Card>
      )}
    </PageShell>
  )
}

/**
 * The tab lives in the URL (?tab=…), read with useSearchParams — see
 * components/ClientBoundary.jsx. The fallback matches the page's own
 * loading skeleton, so a refresh shows one skeleton throughout.
 */
export default function Profile() {
  return (
    <ClientBoundary fallback={<PageSkeleton layout="profile" header={PAGE_HEADERS.profile} />}>
      <ProfilePage />
    </ClientBoundary>
  )
}
