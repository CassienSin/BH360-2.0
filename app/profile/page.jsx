'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ArrowLeft, User, Phone, MapPin, Mail, Save, Edit2, Shield, Star, Home } from 'lucide-react'
import Image from 'next/image'
import toast from 'react-hot-toast'

const dots = [...Array(20)].map((_, i) => ({
  size: (((i * 7) % 6) + 3),
  left: ((i * 17 + 13) % 100),
  top: ((i * 23 + 7) % 100),
  duration: ((i * 3) % 6) + 4,
  delay: (i * 0.7) % 4,
}))

const AnimatedDots = () => (
  <div className="absolute inset-0" style={{overflow: 'hidden', pointerEvents: 'none'}}>
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
)

export default function ProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  const [scrolled, setScrolled] = useState(false)
  const [profile, setProfile] = useState(null)
  const [email, setEmail] = useState('')
  const [form, setForm] = useState({ full_name: '', phone: '', address: '' })
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')
      setEmail(user.email)
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)
      setForm({ full_name: prof?.full_name || '', phone: prof?.phone || '', address: prof?.address || '' })
      setLoading(false)
    }
    loadProfile()
  }, [])

  async function handleSave() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('profiles').update({
      full_name: form.full_name,
      phone: form.phone,
      address: form.address,
    }).eq('id', user.id)

    if (error) {
      toast.error('Failed to update profile.')
      setSaving(false)
      return
    }

    setProfile(prev => ({ ...prev, ...form }))
    setEditing(false)
    setSaving(false)
    toast.success('Profile updated successfully!')
  }

  function handleBack() {
    if (profile?.role === 'official') router.push('/official')
    else if (profile?.role === 'tanod') router.push('/tanod')
    else router.push('/resident')
  }

  const roleConfig = {
    resident: { label: 'Resident', icon: Home, color: '#5B54E8', bg: '#f0effe' },
    official: { label: 'Barangay Official', icon: Star, color: '#f97316', bg: '#fff7ed' },
    tanod: { label: 'Tanod', icon: Shield, color: '#22c55e', bg: '#f0fdf4' },
  }

  const role = roleConfig[profile?.role] || roleConfig.resident
  const RoleIcon = role.icon

  const Skeleton = ({ className }) => <div className={`skeleton-shimmer ${className}`} />

  return (
    <div className="min-h-screen relative overflow-hidden bg-brand">
      <AnimatedDots />

      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 right-20 w-96 h-96 rounded-full opacity-10"
          style={{background: 'white', filter: 'blur(80px)', animation: 'float 8s ease-in-out infinite'}} />
        <div className="absolute bottom-20 left-20 w-72 h-72 rounded-full opacity-10"
          style={{background: 'white', filter: 'blur(60px)', animation: 'floatReverse 10s ease-in-out infinite'}} />
        <div className="absolute inset-0 opacity-5"
          style={{backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px)', backgroundSize: '60px 60px'}} />
      </div>

      {/* Header */}
      <header className="bg-white fixed top-0 left-0 right-0 z-20 px-6 py-4 flex items-center justify-between transition-all duration-300"
        style={{
          background: scrolled ? 'rgba(255,255,255,0.85)' : 'white',
          backdropFilter: scrolled ? 'blur(20px)' : 'blur(0px)',
          boxShadow: scrolled ? '0 2px 12px rgba(91,84,232,0.08)' : '0 2px 12px rgba(91,84,232,0.08)',
          borderBottom: '1px solid #f0effe'
        }}>
        <div className="flex items-center gap-3">
          <button onClick={handleBack}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-gray-100">
            <ArrowLeft size={18} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-base font-bold text-gray-800">My Profile</h1>
            <p className="text-xs text-gray-400">View and edit your information</p>
          </div>
        </div>
        {!loading && (
          <button onClick={() => editing ? handleSave() : setEditing(true)}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold disabled:opacity-50 transition-all"
            style={{
              background: editing ? 'linear-gradient(135deg, #5B54E8, #7C75F0)' : 'white',
              color: editing ? 'white' : '#5B54E8',
              border: editing ? 'none' : '1.5px solid #e8e3ff',
              boxShadow: editing ? '0 4px 16px rgba(91,84,232,0.3)' : 'none'
            }}>
            {editing ? (
              saving ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Saving...
                </span>
              ) : <><Save size={14} /> Save Changes</>
            ) : <><Edit2 size={14} /> Edit Profile</>}
          </button>
        )}
      </header>

      <main className="relative z-10 max-w-xl mx-auto px-4 py-8 space-y-4 pt-24">
        {loading ? (
          <>
            <div className="white-card p-6 text-center">
              <Skeleton className="w-20 h-20 rounded-3xl mx-auto mb-4" />
              <Skeleton className="h-5 w-40 mx-auto mb-2" />
              <Skeleton className="h-3 w-24 mx-auto" />
            </div>
            <div className="white-card p-6 space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-2xl flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Avatar Card */}
            <div className="white-card p-6 text-center fade-up">
              <div className="relative inline-block mb-4">
                <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-3xl font-black text-white mx-auto"
                  style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 8px 32px rgba(91,84,232,0.3)'}}>
                  {profile?.full_name?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-xl flex items-center justify-center"
                  style={{background: role.bg, border: '2px solid white'}}>
                  <RoleIcon size={13} style={{color: role.color}} />
                </div>
              </div>
              <h2 className="text-xl font-bold text-gray-800" style={{letterSpacing: '-0.5px'}}>
                {profile?.full_name || 'No name set'}
              </h2>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mt-2"
                style={{background: role.bg}}>
                <RoleIcon size={12} style={{color: role.color}} />
                <span className="text-xs font-semibold" style={{color: role.color}}>{role.label}</span>
              </div>
              <p className="text-gray-400 text-xs mt-2">
                Member since {profile?.created_at
                  ? new Date(profile.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long' })
                  : 'Unknown'}
              </p>
            </div>

            {/* Info Card */}
            <div className="white-card p-6 fade-up-1">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Personal Information</h3>
              <div className="space-y-4">

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{background: '#f0effe'}}>
                    <User size={16} style={{color: '#5B54E8'}} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Full Name</p>
                    {editing ? (
                      <input value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})}
                        className="input-field w-full rounded-xl px-3 py-2 text-sm text-gray-800"
                        placeholder="Your full name" />
                    ) : (
                      <p className="text-sm font-semibold text-gray-800">{profile?.full_name || '—'}</p>
                    )}
                  </div>
                </div>

                <div className="border-t border-gray-50" />

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{background: '#f0f9ff'}}>
                    <Mail size={16} className="text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Email</p>
                    <p className="text-sm font-semibold text-gray-800">{email}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Email cannot be changed</p>
                  </div>
                </div>

                <div className="border-t border-gray-50" />

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{background: '#f0fdf4'}}>
                    <Phone size={16} className="text-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Phone</p>
                    {editing ? (
                      <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                        className="input-field w-full rounded-xl px-3 py-2 text-sm text-gray-800"
                        placeholder="09xxxxxxxxx" />
                    ) : (
                      <p className="text-sm font-semibold text-gray-800">{profile?.phone || '—'}</p>
                    )}
                  </div>
                </div>

                <div className="border-t border-gray-50" />

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{background: '#fff7ed'}}>
                    <MapPin size={16} className="text-orange-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Address</p>
                    {editing ? (
                      <textarea value={form.address} onChange={e => setForm({...form, address: e.target.value})}
                        rows={2}
                        className="input-field w-full rounded-xl px-3 py-2 text-sm text-gray-800 resize-none"
                        placeholder="Sitio, Barangay, Municipality" />
                    ) : (
                      <p className="text-sm font-semibold text-gray-800">{profile?.address || '—'}</p>
                    )}
                  </div>
                </div>

              </div>

              {editing && (
                <div className="flex gap-2 mt-6 pt-4 border-t border-gray-100">
                  <button onClick={() => setEditing(false)}
                    className="flex-1 py-2.5 rounded-2xl text-sm font-semibold text-gray-500 transition-colors hover:bg-gray-50"
                    style={{border: '1.5px solid #e8e3ff'}}>
                    Cancel
                  </button>
                  <button onClick={handleSave} disabled={saving}
                    className="flex-1 btn-primary flex items-center justify-center gap-2 py-2.5 rounded-2xl text-white text-sm font-semibold">
                    {saving ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        Saving...
                      </span>
                    ) : <><Save size={14} /> Save Changes</>}
                  </button>
                </div>
              )}
            </div>

            {/* Role Card */}
            <div className="white-card p-5 fade-up-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Account Details</h3>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{background: role.bg}}>
                  <RoleIcon size={16} style={{color: role.color}} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{role.label}</p>
                  <p className="text-xs text-gray-400">Your role in the barangay system</p>
                </div>
                <div className="ml-auto">
                  <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                    style={{background: role.bg, color: role.color}}>
                    Active
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}