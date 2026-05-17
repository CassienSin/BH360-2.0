'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ArrowLeft, Bell, Globe, Shield, Trash2, Download, Smartphone, CheckCircle, AlertTriangle, Volume2, VolumeX, Save, Loader2, Lock } from 'lucide-react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import ConfirmDialog from '@/components/ConfirmDialog'

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

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState('default')

  const [prefs, setPrefs] = useState({
    incidents: true,
    tickets: true,
    announcements: true,
    sounds: true,
  })
  const [language, setLanguage] = useState('en')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')

      const { data: prof } = await supabase.from('profiles')
        .select('*, barangays(name, city)')
        .eq('id', user.id).single()

      setProfile(prof)
      if (prof?.notification_prefs) setPrefs(prof.notification_prefs)
      if (prof?.language) setLanguage(prof.language)

      // Check browser notification permission
      if ('Notification' in window) {
        setNotificationPermission(Notification.permission)
      }

      setLoading(false)
    }
    load()
  }, [])

  async function saveSettings() {
    setSaving(true)
    const { error } = await supabase.from('profiles').update({
      notification_prefs: prefs,
      language: language,
    }).eq('id', profile.id)

    if (error) {
      toast.error('Failed to save settings')
    } else {
      toast.success('Settings saved!')
    }
    setSaving(false)
  }

  async function requestNotificationPermission() {
    if (!('Notification' in window)) {
      toast.error('Browser notifications not supported')
      return
    }
    const permission = await Notification.requestPermission()
    setNotificationPermission(permission)
    if (permission === 'granted') {
      toast.success('Notifications enabled!')
      new Notification('BarangayHub 360', {
        body: 'Notifications are now active 🎉',
        icon: '/logo.png',
      })
    }
  }

  async function downloadMyData() {
    toast.loading('Preparing your data...')

    const { data: incidents } = await supabase.from('incidents')
      .select('*').eq('reported_by', profile.id)
    const { data: tickets } = await supabase.from('tickets')
      .select('*').eq('created_by', profile.id)

    const data = {
      profile: {
        full_name: profile.full_name,
        email: profile.email,
        role: profile.role,
        phone: profile.phone,
        address: profile.address,
        barangay: profile.barangays,
        created_at: profile.created_at,
      },
      incidents: incidents || [],
      tickets: tickets || [],
      exported_at: new Date().toISOString(),
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bh360-data-${profile.full_name?.replace(/\s/g, '-')}.json`
    a.click()
    URL.revokeObjectURL(url)

    toast.dismiss()
    toast.success('Data exported!')
  }

  async function deactivateAccount() {
    setDeleteConfirm(false)
    const loadingToast = toast.loading('Deactivating account...')

    const { error } = await supabase.from('profiles')
      .update({ deactivated_at: new Date().toISOString() })
      .eq('id', profile.id)

    toast.dismiss(loadingToast)

    if (error) {
      toast.error('Failed to deactivate account. Please contact support.')
      return
    }

    toast.success('Account deactivated. Signing out...')

    setTimeout(async () => {
      await supabase.auth.signOut()
      window.location.href = '/'
    }, 1500)
  }

  const Toggle = ({ enabled, onChange, label, desc }) => (
    <button onClick={() => onChange(!enabled)}
      className="w-full flex items-center justify-between gap-3 p-3 rounded-2xl transition-all hover:bg-gray-50">
      <div className="flex-1 text-left min-w-0">
        <p className="text-sm font-bold text-gray-800">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
      </div>
      <div className="w-10 h-6 rounded-full relative flex-shrink-0 transition-colors"
        style={{background: enabled ? '#5B54E8' : '#e5e7eb'}}>
        <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
          style={{left: enabled ? '20px' : '2px', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'}} />
      </div>
    </button>
  )

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
          style={{background: 'white', filter: 'blur(80px)', animation: 'float 8s ease-in-out infinite'}} />
      </div>

      <header className="bg-white relative z-10 px-4 sm:px-6 py-3 flex items-center gap-3 sticky top-0"
        style={{boxShadow: '0 4px 16px rgba(91,84,232,0.08)', borderBottom: '1px solid #f0effe'}}>
        <button onClick={() => router.back()}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors flex-shrink-0">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-gray-800 truncate" style={{letterSpacing: '-0.3px'}}>Settings</h1>
          <p className="text-xs text-gray-400 truncate">Customize your experience</p>
        </div>
        <button onClick={saveSettings} disabled={saving}
          className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold text-white transition-all hover:scale-105 disabled:opacity-50 flex-shrink-0"
          style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 4px 12px rgba(91,84,232,0.3)'}}>
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          <span className="hidden sm:inline">Save</span>
        </button>
      </header>

      <main className="relative z-10 max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* Notifications */}
        <div className="white-card p-5 fade-up">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{background: '#f0effe'}}>
              <Bell size={20} style={{color: '#5B54E8'}} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-800">Notifications</h3>
              <p className="text-xs text-gray-400">Choose what you want to be notified about</p>
            </div>
          </div>

          {/* Browser permission status */}
          <div className="p-3 rounded-2xl mb-3"
            style={{
              background: notificationPermission === 'granted' ? '#f0fdf4' : notificationPermission === 'denied' ? '#fef2f2' : '#fffbeb',
              border: `1px solid ${notificationPermission === 'granted' ? '#dcfce7' : notificationPermission === 'denied' ? '#fecaca' : '#fef3c7'}`,
            }}>
            <div className="flex items-start gap-2">
              {notificationPermission === 'granted' ? (
                <CheckCircle size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertTriangle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold"
                  style={{color: notificationPermission === 'granted' ? '#16a34a' : notificationPermission === 'denied' ? '#dc2626' : '#d97706'}}>
                  Browser Notifications: {notificationPermission === 'granted' ? 'Enabled' : notificationPermission === 'denied' ? 'Blocked' : 'Not enabled'}
                </p>
                <p className="text-xs mt-0.5"
                  style={{color: notificationPermission === 'granted' ? '#15803d' : notificationPermission === 'denied' ? '#991b1b' : '#92400e'}}>
                  {notificationPermission === 'granted' ? 'You\'ll receive push notifications' :
                   notificationPermission === 'denied' ? 'Enable in browser settings' :
                   'Click to allow notifications'}
                </p>
                {notificationPermission !== 'granted' && notificationPermission !== 'denied' && (
                  <button onClick={requestNotificationPermission}
                    className="mt-2 text-xs font-bold px-3 py-1.5 rounded-lg text-white"
                    style={{background: '#5B54E8'}}>
                    Enable Notifications
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <Toggle
              enabled={prefs.incidents}
              onChange={v => setPrefs({...prefs, incidents: v})}
              label="Incident Updates"
              desc="New incidents, assignments, and status changes"
            />
            <Toggle
              enabled={prefs.tickets}
              onChange={v => setPrefs({...prefs, tickets: v})}
              label="Ticket Messages"
              desc="New replies and status updates on tickets"
            />
            <Toggle
              enabled={prefs.announcements}
              onChange={v => setPrefs({...prefs, announcements: v})}
              label="Announcements"
              desc="New community broadcasts"
            />
            <Toggle
              enabled={prefs.sounds}
              onChange={v => setPrefs({...prefs, sounds: v})}
              label="Sound Effects"
              desc="Play sounds for important alerts"
            />
          </div>
        </div>

        {/* Language */}
        <div className="white-card p-5 fade-up-1">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{background: '#f0fdf4'}}>
              <Globe size={20} className="text-emerald-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-800">Language</h3>
              <p className="text-xs text-gray-400">Choose your preferred language</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'en', label: 'English', flag: '🇺🇸' },
              { value: 'tl', label: 'Tagalog', flag: '🇵🇭' },
            ].map(lang => (
              <button key={lang.value} onClick={() => setLanguage(lang.value)}
                className="p-3 rounded-2xl transition-all hover:scale-[1.02]"
                style={{
                  background: language === lang.value ? '#f0effe' : '#fafaff',
                  border: `2px solid ${language === lang.value ? '#5B54E8' : '#f0effe'}`,
                }}>
                <p className="text-2xl mb-1">{lang.flag}</p>
                <p className="text-sm font-bold" style={{color: language === lang.value ? '#5B54E8' : '#374151'}}>
                  {lang.label}
                </p>
              </button>
            ))}
          </div>
          <p className="text-xs text-amber-600 mt-3 flex items-center gap-1">
            <AlertTriangle size={11} /> Language switching coming soon — your preference is saved
          </p>
        </div>

        {/* PWA Install */}
        <div className="white-card p-5 fade-up-2">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{background: '#fff7ed'}}>
              <Smartphone size={20} className="text-orange-500" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-gray-800">Install as App</h3>
              <p className="text-xs text-gray-400">Add BarangayHub 360 to your home screen</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            On <strong>iPhone</strong>: Tap Share → "Add to Home Screen"<br />
            On <strong>Android</strong>: Tap menu (⋮) → "Install app"<br />
            On <strong>Desktop</strong>: Look for the install icon in your address bar
          </p>
        </div>

        {/* Privacy & Data */}
        <div className="white-card p-5 fade-up-3">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{background: '#eff6ff'}}>
              <Shield size={20} className="text-blue-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-800">Privacy & Data</h3>
              <p className="text-xs text-gray-400">Manage your personal data</p>
            </div>
          </div>

          <div className="space-y-2">
            <button onClick={downloadMyData}
              className="w-full flex items-center justify-between gap-3 p-3 rounded-2xl transition-all hover:bg-gray-50">
              <div className="flex items-center gap-3 flex-1 min-w-0 text-left">
                <Download size={16} className="text-blue-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-gray-800">Download My Data</p>
                  <p className="text-xs text-gray-400">Export all your data as JSON</p>
                </div>
              </div>
            </button>

            <button onClick={() => router.push('/profile')}
              className="w-full flex items-center justify-between gap-3 p-3 rounded-2xl transition-all hover:bg-gray-50">
              <div className="flex items-center gap-3 flex-1 min-w-0 text-left">
                <Lock size={16} className="text-gray-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-gray-800">Change Password</p>
                  <p className="text-xs text-gray-400">Update via your profile page</p>
                </div>
              </div>
              <ArrowLeft size={14} className="text-gray-400 rotate-180" />
            </button>
          </div>
        </div>

       {/* Account Status / Deactivation */}
        <div className="rounded-3xl p-5 fade-up-3"
          style={{background: '#fffbeb', border: '1px solid #fef3c7'}}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{background: '#fef3c7'}}>
              <AlertTriangle size={20} className="text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-900">Account Management</h3>
              <p className="text-xs text-amber-700">Pause or deactivate your account</p>
            </div>
          </div>

          <div className="p-3 rounded-2xl mb-3" style={{background: 'rgba(255,255,255,0.6)'}}>
            <p className="text-xs text-amber-900 leading-relaxed">
              <strong>What deactivation means:</strong> Your account will be marked as inactive. You won't be able to sign in, and your profile won't appear in user lists. Your data (incidents, tickets, ratings) stays preserved.
            </p>
            <p className="text-xs text-amber-700 mt-2 leading-relaxed">
              💡 Want it permanently deleted? Contact support via Help & Support — we'll erase everything within 7 days.
            </p>
          </div>

          <button onClick={() => setDeleteConfirm(true)}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl text-sm font-bold text-white transition-all hover:scale-[1.02]"
            style={{background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 4px 16px rgba(245,158,11,0.3)'}}>
            <Lock size={14} /> Deactivate My Account
          </button>
        </div>

        {/* App info */}
        <div className="text-center py-4">
          <Image src="/logo.png" alt="BH360" width={40} height={40} className="object-contain mx-auto mb-2 opacity-50" />
          <p className="text-xs text-white opacity-60">BarangayHub 360</p>
          <p className="text-xs text-white opacity-40">Version 1.0.0</p>
        </div>
      </main>

      <ConfirmDialog
        open={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        onConfirm={deactivateAccount}
        title="Deactivate your account?"
        message="You won't be able to sign in until you reactivate. Your data will be preserved. Contact support for permanent deletion."
        confirmText="Yes, Deactivate"
        cancelText="Keep Active"
        variant="warning"
      />
    </div>
  )
}