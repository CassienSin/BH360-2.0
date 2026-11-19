'use client'
import { PageSkeleton } from '@/components/Skeletons'
import { PAGE_HEADERS } from '@/lib/pageHeaders'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { loginHref } from '@/lib/loginRedirect'
import { goBack } from '@/lib/goBack'
import { createClient } from '@/lib/supabase'
import { Download, Loader2, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmDialog from '@/components/ConfirmDialog'
import { isSupported, getPermission, requestPermission } from '@/lib/notifications'
import { pushSupport, isSubscribed, subscribeToPush } from '@/lib/push'
import PageShell from '@/components/crafted/PageShell'
import { Card } from '@/components/ui/card'
import { Rows, Row } from '@/components/ui/table'
import { Toggle } from '@/components/ui/toggle'
import { Segmented } from '@/components/ui/segmented'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/notice'
import { SectionLabel, Muted } from '@/components/ui/text'

export default function SettingsPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState('default')
  // This device is registered for background push (what the test needs).
  const [pushReady, setPushReady] = useState(false)
  const [testing, setTesting] = useState(false)
  const [exporting, setExporting] = useState(false)

  const [prefs, setPrefs] = useState({
    incidents: true,
    tickets: true,
    announcements: true,
    sounds: true,
  })
  const [language, setLanguage] = useState('en')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.replace(loginHref())

      const { data: prof, error } = await supabase.from('profiles')
        .select('*, barangays(name, city)')
        .eq('id', user.id).maybeSingle()

      if (cancelled) return
      if (error || !prof) {
        toast.error('Could not load your settings. Please refresh.')
        setLoading(false)
        return
      }

      setProfile(prof)
      if (prof.notification_prefs) setPrefs(prof.notification_prefs)
      if (prof.language) setLanguage(prof.language)
      if (isSupported()) setNotificationPermission(getPermission())
      // Not awaited: it waits for the service worker, which never comes if
      // registration failed, and the page must not hang on that.
      if (pushSupport().supported) {
        isSubscribed().then(subscribed => { if (!cancelled) setPushReady(subscribed) }).catch(() => {})
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [supabase, router])

  // Any change to prefs/language marks the page dirty so the Save button
  // can show there's something to save — previously toggling and pressing
  // Back silently discarded changes with no hint anything was unsaved.
  function updatePrefs(next) { setPrefs(next); setDirty(true) }
  function updateLanguage(next) { setLanguage(next); setDirty(true) }

  async function saveSettings() {
    if (!profile || saving) return
    setSaving(true)
    const { error } = await supabase.from('profiles').update({
      notification_prefs: prefs,
      language: language,
    }).eq('id', profile.id)

    if (error) {
      toast.error('Failed to save settings: ' + error.message)
    } else {
      toast.success('Settings saved!')
      setDirty(false)
    }
    setSaving(false)
  }

  // Uses the shared notifications lib — which handles the Android Chrome
  // constructor crash and legacy Safari — instead of duplicating raw
  // Notification calls here (the raw `new Notification(...)` test toast
  // was the exact Android crash we fixed in the lib).
  async function enableNotifications() {
    if (!isSupported()) {
      toast.error('Browser notifications not supported')
      return
    }
    const permission = await requestPermission()
    setNotificationPermission(permission)
    if (permission === 'granted') {
      // Register this device for background push too, so the test button
      // (and notifications with the app closed) work straight away.
      const push = pushSupport().supported ? await subscribeToPush() : { ok: false }
      setPushReady(push.ok)
      toast.success('Notifications enabled!')
    } else if (permission === 'denied') {
      toast.error('Notifications blocked. You can enable them in browser settings.')
    }
  }

  // A real push, through the push service, to this person's own devices:
  // it arrives the way every notification does, so it shows whether the
  // phone delivers them with the app in the background. (A notification
  // shown from this open page proved nothing about that.)
  async function sendTestPush() {
    setTesting(true)
    try {
      const res = await fetch('/api/push/test', { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) toast.error(body.error || 'Could not send a test notification.')
      else if (body.sent > 0) toast.success(body.sent === 1
        ? 'Test sent. It should appear in a few seconds, even with the app closed.'
        : `Test sent to your ${body.sent} devices. It should appear in a few seconds.`)
      else toast.error(body.reason || 'No device received the test.')
    } catch {
      toast.error('Could not reach the server. Check your connection.')
    } finally {
      setTesting(false)
    }
  }

  async function downloadMyData() {
    if (!profile || exporting) return
    setExporting(true)
    const toastId = toast.loading('Preparing your data...')

    try {
      const [incidentsRes, ticketsRes] = await Promise.all([
        supabase.from('incidents').select('*').eq('reported_by', profile.id),
        supabase.from('tickets').select('*').eq('created_by', profile.id),
      ])

      if (incidentsRes.error || ticketsRes.error) {
        throw incidentsRes.error || ticketsRes.error
      }

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
        incidents: incidentsRes.data || [],
        tickets: ticketsRes.data || [],
        exported_at: new Date().toISOString(),
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const safeName = (profile.full_name || 'user').replace(/\s+/g, '-')
      a.download = `bh360-data-${safeName}.json`
      document.body.appendChild(a) // Firefox needs the anchor in the DOM
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      toast.success('Data exported!', { id: toastId })
    } catch (err) {
      console.error('downloadMyData failed:', err)
      toast.error('Could not export your data. Please try again.', { id: toastId })
    } finally {
      setExporting(false)
    }
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
      window.location.replace('/')
    }, 1500)
  }

  if (loading) return <PageSkeleton layout="settings" header={{ ...PAGE_HEADERS.settings, actions: true }} />

  const permission = notificationPermission === 'granted'
    ? { tone: 'ok', title: 'Notifications are on for this device.', text: 'Alerts reach you even with the app closed.' }
    : notificationPermission === 'denied'
      ? { tone: 'danger', title: 'Notifications are blocked.', text: 'Allow them for this site in your browser settings.' }
      : { tone: 'warn', title: 'Notifications are off for this device.', text: 'Turn them on to hear about your reports right away.' }

  return (
    <PageShell
      title={PAGE_HEADERS.settings.title}
      sub={PAGE_HEADERS.settings.description}
      subOnDesktop
      onBack={() => goBack(router, '/')}
      actions={(
        <Button variant="white" size="sm" onClick={saveSettings} disabled={!dirty || saving} aria-busy={saving || undefined}>
          {saving ? <><Loader2 className="animate-spin" aria-hidden="true" />Saving…</> : dirty ? 'Save' : 'Saved'}
        </Button>
      )}>

      {/* Notifications */}
      <Card lift>
        <SectionLabel as="h2" className="px-[18px] pt-3.5 mb-1">Notifications</SectionLabel>
        <Notice tone={permission.tone} title={permission.title} className="mx-[18px] mt-1 mb-2">
          {permission.text}
          {notificationPermission === 'default' && (
            <span className="block mt-2"><Button size="sm" onClick={enableNotifications}>Turn on notifications</Button></span>
          )}
          {notificationPermission === 'granted' && pushReady && (
            <span className="block mt-2">
              <Button size="sm" variant="secondary" onClick={sendTestPush} disabled={testing} aria-busy={testing || undefined}>
                {testing ? 'Sending…' : 'Send a test notification'}
              </Button>
            </span>
          )}
        </Notice>
        <Rows>
          {[
            { key: 'incidents', label: 'Report updates', desc: 'New reports, assignments and status changes' },
            { key: 'tickets', label: 'Ticket replies', desc: 'When someone answers your ticket' },
            { key: 'announcements', label: 'Announcements', desc: 'News and events from the barangay' },
            { key: 'sounds', label: 'Sounds', desc: 'Play a sound for important alerts' },
          ].map(row => (
            <Row key={row.key} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-ink">{row.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{row.desc}</p>
              </div>
              <Toggle label={row.label} checked={!!prefs[row.key]} onCheckedChange={v => updatePrefs({ ...prefs, [row.key]: v })} />
            </Row>
          ))}
        </Rows>
      </Card>

      {/* Appearance: language (the theme choice comes with the dark-mode pass) */}
      <Card className="px-[18px] py-3.5">
        <SectionLabel as="h2">Appearance</SectionLabel>
        <p id="language-label" className="text-sm font-bold text-ink mb-2">Language</p>
        <Segmented label="Language" full value={language} onChange={updateLanguage}
          items={[{ value: 'en', label: 'English' }, { value: 'tl', label: 'Tagalog' }]} />
        <p className="text-xs text-muted-foreground mt-2">Your choice is saved. The app shows English for now.</p>
      </Card>

      {/* Install */}
      <Card className="px-[18px] py-3.5">
        <SectionLabel as="h2">Install as an app</SectionLabel>
        <ul className="space-y-1.5 text-[13px] leading-[1.55] text-body">
          <li><strong className="text-ink">iPhone:</strong> tap Share, then “Add to Home Screen”.</li>
          <li><strong className="text-ink">Android:</strong> tap the menu (⋮), then “Install app”.</li>
          <li><strong className="text-ink">Computer:</strong> use the install icon in the address bar.</li>
        </ul>
      </Card>

      {/* Account */}
      <Card>
        <SectionLabel as="h2" className="px-[18px] pt-3.5 mb-1">Account</SectionLabel>
        <Rows>
          <Row as="button" interactive onClick={() => router.push('/profile')} className="flex items-center gap-3">
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-bold text-ink">Change password</span>
              <span className="block text-xs text-muted-foreground mt-0.5">On your profile page</span>
            </span>
            <ChevronRight size={16} className="text-muted-foreground" aria-hidden="true" />
          </Row>
          <Row as="button" interactive onClick={downloadMyData} disabled={exporting} className="flex items-center gap-3 disabled:opacity-60">
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-bold text-ink">Download my data</span>
              <span className="block text-xs text-muted-foreground mt-0.5">Your profile, reports and tickets as a JSON file</span>
            </span>
            {exporting ? <Loader2 size={16} className="animate-spin text-muted-foreground" aria-hidden="true" /> : <Download size={16} className="text-muted-foreground" aria-hidden="true" />}
          </Row>
          <Row as="button" interactive onClick={() => setDeleteConfirm(true)} className="flex items-center gap-3">
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-bold text-danger">Deactivate my account</span>
              <span className="block text-xs text-muted-foreground mt-0.5">You can’t sign in after this. Your reports and tickets are kept.</span>
            </span>
            <ChevronRight size={16} className="text-muted-foreground" aria-hidden="true" />
          </Row>
        </Rows>
      </Card>
      <Muted className="text-center text-xs">Want your data deleted for good? Ask through Help. BarangayHub 360 · version 1.0.0</Muted>

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
    </PageShell>
  )
}
