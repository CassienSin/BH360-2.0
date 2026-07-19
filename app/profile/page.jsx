'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ArrowLeft, User, Phone, MapPin, Camera, Save, Lock, AlertTriangle, FileText, CheckCircle, Bell, Loader2, Edit3, X, Activity, Award, Mail, Eye, EyeOff, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { timeAgo, fullDate } from '@/lib/timeAgo'
import AnimatedDots from '@/components/AnimatedDots'

const EXT_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
}

const roleConfig = {
  resident: { label: 'Resident', color: '#5B54E8', bg: '#f0effe', gradient: 'linear-gradient(135deg, #5B54E8, #7C75F0)' },
  official: { label: 'Barangay Official', color: '#f97316', bg: '#fff7ed', gradient: 'linear-gradient(135deg, #f97316, #ea580c)' },
  tanod: { label: 'Tanod', color: '#22c55e', bg: '#f0fdf4', gradient: 'linear-gradient(135deg, #22c55e, #16a34a)' },
  super_admin: { label: 'Super Admin', color: '#1f2937', bg: '#f3f4f6', gradient: 'linear-gradient(135deg, #1f2937, #4b5563)' },
}

export default function ProfilePage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const fileInputRef = useRef(null)

  const [profile, setProfile] = useState(null)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [activeTab, setActiveTab] = useState('info')

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
      if (!user) return router.push('/login')

      const { data: prof } = await supabase
        .from('profiles')
        .select('*, barangays(id, name, city, province)')
        .eq('id', user.id)
        .maybeSingle()

      if (cancelled) return
      if (!prof) return router.push('/login')

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
        const { data: inc } = await supabase.from('incidents')
          .select('id, title, status, created_at, priority, category, resolved_at, rating')
          .eq('assigned_to', user.id)
          .order('created_at', { ascending: false })
          .limit(20)
        if (!cancelled) setIncidents(inc || [])
      } else if (prof.role === 'official') {
        const { data: ann } = await supabase.from('announcements')
          .select('id, title, created_at')
          .eq('posted_by', user.id)
          .order('created_at', { ascending: false })
          .limit(20)
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

  if (loading) {
    return (
      <div className="min-h-screen bg-brand flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-white" />
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

      <header className="bg-white relative z-10 px-4 sm:px-6 py-4 flex items-center gap-3"
        style={{ boxShadow: '0 2px 12px rgba(91,84,232,0.08)', borderBottom: '1px solid #f0effe' }}>
        <button onClick={() => router.push(getDashboardPath())} aria-label="Back to dashboard"
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-gray-100 flex-shrink-0">
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-base font-bold text-gray-800">My Profile</h1>
          <p className="text-xs text-gray-400">Manage your account & activity</p>
        </div>
      </header>

      <main className="relative z-10 max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Profile Card */}
        <div className="white-card overflow-hidden">
          {/* Cover gradient */}
          <div className="h-24 relative" style={{ background: rc.gradient }}>
            <div className="absolute inset-0 opacity-30"
              style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
          </div>

          <div className="px-6 pb-6 -mt-12 relative">
            <div className="flex items-end justify-between gap-4 flex-wrap">
              {/* Avatar */}
              <div className="relative group">
                <div className="w-24 h-24 rounded-3xl flex items-center justify-center text-2xl font-bold text-white border-4 border-white overflow-hidden"
                  style={{ background: rc.gradient, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile?.full_name || 'Avatar'} className="w-full h-full object-cover" />
                  ) : (
                    profile?.full_name?.[0]?.toUpperCase()
                  )}
                </div>

                {/* Hover overlay (desktop) */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  aria-label="Change avatar"
                  className="absolute inset-0 rounded-3xl bg-black/0 hover:bg-black/40 transition-colors flex items-center justify-center">
                  {uploadingAvatar ? (
                    <Loader2 size={20} className="animate-spin text-white" />
                  ) : (
                    <Camera size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </button>

                {/* Always-visible camera badge — on phones there's no hover,
                    so the overlay above was invisible and users had no clue
                    the avatar was tappable. */}
                {!uploadingAvatar && (
                  <button onClick={() => fileInputRef.current?.click()}
                    aria-label="Change avatar"
                    className="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                    style={{ background: 'white', border: '2px solid #f0effe' }}>
                    <Camera size={13} style={{ color: '#5B54E8' }} />
                  </button>
                )}

                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />

                {/* Remove button */}
                {profile?.avatar_url && !uploadingAvatar && (
                  <button onClick={handleRemoveAvatar} aria-label="Remove avatar"
                    className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                    title="Remove avatar">
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                {!editing ? (
                  <button onClick={() => setEditing(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105"
                    style={{ background: '#f0effe', color: '#5B54E8', border: '1px solid #e8e3ff' }}>
                    <Edit3 size={12} /> Edit Profile
                  </button>
                ) : (
                  <>
                    <button onClick={() => { setEditing(false); setForm({ full_name: profile.full_name, phone: profile.phone || '', address: profile.address || '' }) }}
                      disabled={saving}
                      className="px-4 py-2 rounded-xl text-xs font-bold transition-colors hover:bg-gray-100"
                      style={{ color: '#6b7280', border: '1px solid #e5e7eb' }}>
                      Cancel
                    </button>
                    <button onClick={handleSave} disabled={saving}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all hover:scale-105 disabled:opacity-60"
                      style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 4px 12px rgba(91,84,232,0.3)' }}>
                      {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-bold text-gray-800" style={{ letterSpacing: '-0.5px' }}>{profile?.full_name}</h2>
                <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                  style={{ background: rc.bg, color: rc.color }}>
                  {rc.label}
                </span>
              </div>
              {profile?.barangays && (
                <p className="text-sm text-gray-400 mt-1">📍 {profile.barangays.name}, {profile.barangays.city}, {profile.barangays.province}</p>
              )}
              <p className="text-xs text-gray-300 mt-1">Member since {fullDate(profile?.created_at)}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            { value: 'info', label: 'Info', icon: User },
            { value: 'activity', label: 'Activity', icon: Activity },
            { value: 'security', label: 'Security', icon: Lock },
          ].map(({ value, label, icon: Icon }) => (
            <button key={value} onClick={() => setActiveTab(value)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap"
              style={{
                background: activeTab === value ? 'white' : 'rgba(255,255,255,0.15)',
                color: activeTab === value ? '#5B54E8' : 'white',
                boxShadow: activeTab === value ? '0 4px 16px rgba(91,84,232,0.15)' : 'none',
              }}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {/* INFO TAB */}
        {activeTab === 'info' && (
          <div className="white-card p-6 fade-up">
            <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
              <User size={14} style={{ color: '#5B54E8' }} /> Personal Information
            </h3>

            <div className="space-y-4">
              {/* Email — read-only; it's the login identity */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Email</label>
                <p className="text-sm text-gray-800 font-medium px-1 flex items-center gap-2">
                  <Mail size={13} className="text-gray-400" /> {email || '—'}
                </p>
              </div>

              {/* Name */}
              <div>
                <label htmlFor="profile-name" className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Full Name</label>
                {editing ? (
                  <div className="relative">
                    <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input id="profile-name" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
                      maxLength={100} autoComplete="name"
                      className="input-field w-full rounded-2xl pl-10 pr-4 py-3 text-sm text-gray-800"
                      placeholder="Your full name" />
                  </div>
                ) : (
                  <p className="text-sm text-gray-800 font-medium px-1">{profile?.full_name || '—'}</p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label htmlFor="profile-phone" className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Phone Number</label>
                {editing ? (
                  <div className="relative">
                    <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input id="profile-phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                      maxLength={11} autoComplete="tel-national" inputMode="numeric"
                      className="input-field w-full rounded-2xl pl-10 pr-4 py-3 text-sm text-gray-800"
                      placeholder="09xxxxxxxxx" />
                  </div>
                ) : (
                  <p className="text-sm text-gray-800 font-medium px-1">{profile?.phone || <span className="text-gray-300 italic">Not provided</span>}</p>
                )}
              </div>

              {/* Address */}
              <div>
                <label htmlFor="profile-address" className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Address</label>
                {editing ? (
                  <div className="relative">
                    <MapPin size={14} className="absolute left-3.5 top-3.5 text-gray-400" />
                    <textarea id="profile-address" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
                      rows={2} maxLength={200} autoComplete="street-address"
                      className="input-field w-full rounded-2xl pl-10 pr-4 py-3 text-sm text-gray-800 resize-none"
                      placeholder="Sitio, Street, etc." />
                  </div>
                ) : (
                  <p className="text-sm text-gray-800 font-medium px-1">{profile?.address || <span className="text-gray-300 italic">Not provided</span>}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ACTIVITY TAB */}
        {activeTab === 'activity' && (
          <div className="space-y-4 fade-up">
            {/* Activity stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {profile?.role === 'resident' && [
                { label: 'My Incidents', value: incidents.length, icon: AlertTriangle, color: '#f97316' },
                { label: 'Pending', value: pendingCount, icon: Activity, color: '#3b82f6' },
                { label: 'My Tickets', value: tickets.length, icon: FileText, color: '#5B54E8' },
                { label: 'Resolved', value: resolvedCount, icon: CheckCircle, color: '#22c55e' },
              ].map((stat) => (
                <div key={stat.label} className="white-card p-4">
                  <stat.icon size={16} style={{ color: stat.color }} className="mb-2" />
                  <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{stat.label}</p>
                </div>
              ))}

              {profile?.role === 'tanod' && [
                { label: 'Total Assigned', value: incidents.length, icon: AlertTriangle, color: '#5B54E8' },
                { label: 'Resolved', value: resolvedCount, icon: CheckCircle, color: '#22c55e' },
                { label: 'Active', value: incidents.filter(i => i.status === 'assigned').length, icon: Activity, color: '#f97316' },
                // Average rating says far more about performance than a
                // raw count of how many ratings exist.
                { label: avgRating ? `Avg Rating (${ratedIncidents.length})` : 'Avg Rating', value: avgRating ? `⭐ ${avgRating}` : '—', icon: Award, color: '#f59e0b' },
              ].map((stat) => (
                <div key={stat.label} className="white-card p-4">
                  <stat.icon size={16} style={{ color: stat.color }} className="mb-2" />
                  <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{stat.label}</p>
                </div>
              ))}

              {profile?.role === 'official' && [
                { label: 'Announcements', value: announcements.length, icon: Bell, color: '#5B54E8' },
              ].map((stat) => (
                <div key={stat.label} className="white-card p-4">
                  <stat.icon size={16} style={{ color: stat.color }} className="mb-2" />
                  <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Recent activity */}
            <div className="white-card p-6">
              <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Activity size={14} style={{ color: '#5B54E8' }} /> Recent Activity
              </h3>

              {totalActivity === 0 && (
                <div className="text-center py-8">
                  <Activity size={32} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-400">No activity yet</p>
                </div>
              )}

              <div className="space-y-2">
                {profile?.role === 'resident' && incidents.map(inc => (
                  <div key={inc.id} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#fff7ed' }}>
                      <AlertTriangle size={13} className="text-orange-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{inc.title}</p>
                      <p className="text-xs text-gray-400" title={fullDate(inc.created_at)}>Reported {timeAgo(inc.created_at)}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${
                      inc.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                      inc.status === 'assigned' ? 'bg-blue-100 text-blue-700' :
                      'bg-emerald-100 text-emerald-700'
                    }`}>{inc.status}</span>
                  </div>
                ))}

                {profile?.role === 'resident' && tickets.map(t => (
                  <div key={t.id} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)' }}>
                      <FileText size={13} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{t.title}</p>
                      <p className="text-xs text-gray-400" title={fullDate(t.created_at)}>Ticket · {timeAgo(t.created_at)}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${
                      t.status === 'open' ? 'bg-amber-100 text-amber-700' :
                      t.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                      'bg-emerald-100 text-emerald-700'
                    }`}>{t.status.replace('_', ' ')}</span>
                  </div>
                ))}

                {profile?.role === 'tanod' && incidents.map(inc => (
                  <div key={inc.id} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#fef9c3' }}>
                      <AlertTriangle size={13} className="text-yellow-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{inc.title}</p>
                      <p className="text-xs text-gray-400" title={fullDate(inc.created_at)}>
                        {inc.status === 'resolved' && inc.resolved_at ? `Resolved ${timeAgo(inc.resolved_at)}` : `Assigned ${timeAgo(inc.created_at)}`}
                      </p>
                    </div>
                    {inc.rating && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700 flex-shrink-0">⭐ {inc.rating}</span>
                    )}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${
                      inc.status === 'resolved' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                    }`}>{inc.status}</span>
                  </div>
                ))}

                {profile?.role === 'official' && announcements.map(a => (
                  <div key={a.id} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)' }}>
                      <Bell size={13} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{a.title}</p>
                      <p className="text-xs text-gray-400" title={fullDate(a.created_at)}>Posted {timeAgo(a.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SECURITY TAB */}
        {activeTab === 'security' && (
          <div className="white-card p-6 fade-up">
            <h3 className="text-sm font-bold text-gray-800 mb-1 flex items-center gap-2">
              <Lock size={14} style={{ color: '#5B54E8' }} /> Change Password
            </h3>
            <p className="text-xs text-gray-400 mb-5">Update your account password</p>

            <div className="space-y-4">
              <div>
                <label htmlFor="new-password" className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">New Password</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input id="new-password" type={showNewPassword ? 'text' : 'password'}
                    value={passwordForm.new}
                    onChange={e => setPasswordForm({ ...passwordForm, new: e.target.value })}
                    autoComplete="new-password"
                    className="input-field w-full rounded-2xl pl-10 pr-10 py-3 text-sm text-gray-800"
                    placeholder="At least 8 characters" />
                  <button type="button" onClick={() => setShowNewPassword(!showNewPassword)}
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                    {showNewPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirm-password" className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Confirm New Password</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input id="confirm-password" type={showConfirmPassword ? 'text' : 'password'}
                    value={passwordForm.confirm}
                    onChange={e => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                    onKeyDown={e => { if (e.key === 'Enter' && passwordsMatch) handleChangePassword() }}
                    autoComplete="new-password"
                    className="input-field w-full rounded-2xl pl-10 pr-10 py-3 text-sm text-gray-800"
                    placeholder="Confirm new password" />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                    {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {passwordForm.confirm && passwordForm.new !== passwordForm.confirm && (
                  <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1"><X size={11} /> Passwords don't match</p>
                )}
                {passwordsMatch && passwordForm.confirm && (
                  <p className="text-xs text-emerald-500 mt-1.5 flex items-center gap-1"><Check size={11} /> Passwords match</p>
                )}
              </div>

              <button onClick={handleChangePassword} disabled={changingPassword || !passwordForm.new || !passwordForm.confirm}
                className="w-full py-3 rounded-2xl text-sm font-bold text-white transition-all hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100"
                style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 8px 24px rgba(91,84,232,0.3)' }}>
                {changingPassword ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={14} className="animate-spin" /> Updating...
                  </span>
                ) : '🔒 Update Password'}
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}