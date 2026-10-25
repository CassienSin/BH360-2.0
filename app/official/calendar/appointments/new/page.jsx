    'use client'
import { PageHeader, AppButton, PageState } from '@/components/AppUI'
import { useBrowserValue } from '@/lib/useHydrated'

    import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
    import { useRouter } from 'next/navigation'
    import { AlarmClock, Bell, CalendarDays, Check, Clock3, Plus, UserRound } from 'lucide-react'
    import toast from 'react-hot-toast'
    import { createClient } from '@/lib/supabase'
    import { getPermission, isSupported, notifyAppointmentReminder, requestPermission } from '@/lib/notifications'

    function toLocalInput(date) {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    return local.toISOString().slice(0, 16)
    }

    function formatDateTime(value) {
    if (!value) return 'No reminder set'
    return new Date(value).toLocaleString('en-PH', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit',
    })
    }

    function initialForm() {
    const now = new Date()
    const reminder = new Date(now.getTime() + 30 * 60 * 1000)
    const appointment = new Date(now.getTime() + 60 * 60 * 1000)
    return {
        title: '',
        participant_name: '',
        notes: '',
        starts_at: toLocalInput(appointment),
        remind_at: toLocalInput(reminder),
    }
    }

    export default function AppointmentsPage() {
    const router = useRouter()
    const supabase = useMemo(() => createClient(), [])
    const reminderLock = useRef(false)
    const remindedInThisTab = useRef(new Set())
    const [profile, setProfile] = useState(null)
    const [appointments, setAppointments] = useState([])
    const [form, setForm] = useState(initialForm)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    // The browser's answer when the page opened, overridden by the user's
    // choice here ('default' on the server and during hydration).
    const initialPermission = useBrowserValue(getPermission, 'default')
    const [chosenPermission, setNotificationPermission] = useState(null)
    const notificationPermission = chosenPermission ?? initialPermission

    const loadAppointments = useCallback(async (barangayId) => {
        const { data, error } = await supabase.from('appointments')
        .select('*')
        .eq('barangay_id', barangayId)
        .order('starts_at', { ascending: true })
        .limit(200)
        if (error) throw error
        setAppointments(data || [])
    }, [supabase])

    useEffect(() => {
        let cancelled = false
        async function load() {
        try {
            const { data: { user }, error: authError } = await supabase.auth.getUser()
            if (authError || !user) {
            router.push('/login')
            return
            }
            const { data: prof, error } = await supabase.from('profiles')
            .select('id, role, barangay_id, barangays(name)')
            .eq('id', user.id)
            .single()
            if (cancelled) return
            if (error || prof?.role !== 'official' || !prof?.barangay_id) {
            toast.error(error ? 'Could not load your official profile.' : 'Officials only.')
            router.push('/login')
            return
            }
            setProfile(prof)
            await loadAppointments(prof.barangay_id)
        } catch (error) {
            console.error('Could not load appointments:', error)
            if (!cancelled) toast.error('Could not load appointments. Please refresh.')
        } finally {
            if (!cancelled) setLoading(false)
        }
        }
        load()
        return () => { cancelled = true }
    }, [supabase, router, loadAppointments])

    useEffect(() => {
        if (!profile?.barangay_id) return
        const channel = supabase.channel('appointments-page')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'appointments',
            filter: `barangay_id=eq.${profile.barangay_id}`,
        }, (payload) => {
            if (payload.eventType === 'INSERT') {
            setAppointments(previous => previous.some(item => item.id === payload.new.id)
                ? previous
                : [...previous, payload.new].sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)))
            }
            if (payload.eventType === 'UPDATE') {
            setAppointments(previous => previous.map(item =>
                item.id === payload.new.id ? { ...item, ...payload.new } : item
            ))
            }
            if (payload.eventType === 'DELETE') {
            setAppointments(previous => previous.filter(item => item.id !== payload.old.id))
            }
        })
        .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [profile?.barangay_id, supabase])

    const checkReminders = useCallback(async () => {
        if (!profile?.barangay_id || reminderLock.current) return
        reminderLock.current = true
        try {
        const now = new Date()
        const { data, error } = await supabase.from('appointments')
            .select('id, title, participant_name, starts_at, remind_at')
            .eq('barangay_id', profile.barangay_id)
            .eq('created_by', profile.id)
            .is('reminder_sent_at', null)
            .lte('remind_at', now.toISOString())
            .gt('starts_at', now.toISOString())
            .order('remind_at', { ascending: true })
            .limit(20)
        if (error) throw error

        for (const appointment of data || []) {
            if (remindedInThisTab.current.has(appointment.id)) continue
            const sentAt = new Date().toISOString()
            // Claim the reminder atomically so two open tabs cannot both alert.
            const { data: claimed, error: updateError } = await supabase.from('appointments')
            .update({ reminder_sent_at: sentAt })
            .eq('id', appointment.id)
            .eq('created_by', profile.id)
            .is('reminder_sent_at', null)
            .select('id')
            if (updateError) throw updateError
            if (!claimed?.length) continue

            remindedInThisTab.current.add(appointment.id)
            const delivered = await notifyAppointmentReminder(appointment)
            if (!delivered) toast(`Reminder: ${appointment.title}`, { duration: 8000 })
            setAppointments(previous => previous.map(item =>
            item.id === appointment.id ? { ...item, reminder_sent_at: sentAt } : item
            ))
        }
        } catch (error) {
        console.error('Appointment reminder check failed:', error)
        } finally {
        reminderLock.current = false
        }
    }, [profile, supabase])

    useEffect(() => {
        if (!profile?.barangay_id) return
        // First check right after this render commits, then every 30 s.
        const first = setTimeout(checkReminders, 0)
        const interval = setInterval(checkReminders, 30_000)
        return () => { clearTimeout(first); clearInterval(interval) }
    }, [profile, checkReminders])

    async function requestNotifications() {
        if (!isSupported()) {
        toast.error('This browser does not support desktop notifications.')
        return
        }
        const permission = await requestPermission()
        setNotificationPermission(permission)
        if (permission === 'granted') toast.success('Browser reminders enabled.')
        else toast('You can still receive reminders here while this page is open.')
    }

    async function saveAppointment(event) {
        event.preventDefault()
        if (!profile?.barangay_id) return
        const startsAt = new Date(form.starts_at)
        const remindAt = new Date(form.remind_at)
        if (Number.isNaN(startsAt.getTime()) || Number.isNaN(remindAt.getTime())) {
        toast.error('Choose a valid appointment date and reminder time.')
        return
        }
        if (remindAt >= startsAt) {
        toast.error('Set the reminder before the appointment starts.')
        return
        }
        setSaving(true)
        const { data, error } = await supabase.from('appointments').insert({
        barangay_id: profile.barangay_id,
        created_by: profile.id,
        title: form.title.trim(),
        participant_name: form.participant_name.trim() || null,
        notes: form.notes.trim() || null,
        starts_at: startsAt.toISOString(),
        remind_at: remindAt.toISOString(),
        }).select('*').single()
        setSaving(false)
        if (error) {
        console.error('Appointment save failed:', error)
        toast.error('Could not save appointment. Apply the appointments database migration, then try again.')
        return
        }
        setAppointments(previous => [...previous, data].sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)))
        setForm(initialForm())
        toast.success('Appointment saved.')
    }

    if (loading) {
        return <PageState fullPage kind="loading" title="Loading appointments…" description="Preparing your barangay schedule." />
    }

    return (
        <div className="min-h-screen relative overflow-hidden bg-brand">
        <PageHeader title="New Appointment" description={`${profile?.barangays?.name || 'Barangay'} · Schedule and reminders`} icon={CalendarDays} onBack={() => router.push('/official/calendar/appointments')} backLabel="Back to appointments" actions={<AppButton variant="secondary" onClick={() => router.push('/official/calendar/appointments')}>Appointments list</AppButton>} />

        <main className="relative z-10 mx-auto grid w-full max-w-[1320px] gap-4 px-4 py-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <section className="white-card min-w-0 p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: 'var(--brand-soft)' }}><Plus size={18} style={{ color: 'var(--brand)' }} /></div>
                <div>
                <h2 className="font-bold text-gray-800">Record an appointment</h2>
                <p className="text-xs text-gray-500">Add the schedule and when you should be reminded.</p>
                </div>
            </div>

            <form onSubmit={saveAppointment} className="space-y-4">
                <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-gray-600">Appointment title <span className="text-red-500">*</span></span>
                <input required maxLength={120} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. Building permit consultation" className="input-field w-full rounded-xl px-3.5 py-3 text-sm text-gray-800" />
                </label>
                <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-gray-600">Resident / contact name</span>
                <div className="relative"><UserRound size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input maxLength={120} value={form.participant_name} onChange={e => setForm({ ...form, participant_name: e.target.value })}
                    placeholder="Optional" className="input-field w-full rounded-xl py-3 pl-10 pr-3.5 text-sm text-gray-800" />
                </div>
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                <label className="block min-w-0">
                    <span className="mb-1.5 block text-xs font-semibold text-gray-600">Appointment date & time <span className="text-red-500">*</span></span>
                    <input required type="datetime-local" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })}
                    className="input-field w-full min-w-0 rounded-xl px-3 py-3 text-sm text-gray-800" />
                </label>
                <label className="block min-w-0">
                    <span className="mb-1.5 block text-xs font-semibold text-gray-600">Remind me at <span className="text-red-500">*</span></span>
                    <input required type="datetime-local" value={form.remind_at} onChange={e => setForm({ ...form, remind_at: e.target.value })}
                    className="input-field w-full min-w-0 rounded-xl px-3 py-3 text-sm text-gray-800" />
                </label>
                </div>
                <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-gray-600">Notes</span>
                <textarea rows={3} maxLength={1000} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                    placeholder="Location or details to prepare" className="input-field w-full resize-y rounded-xl px-3.5 py-3 text-sm text-gray-800" />
                </label>
                <AppButton type="submit" busy={saving} busyLabel="Saving appointment…" disabled={saving} className="w-full"><Check size={16} />Save Appointment</AppButton>
            </form>
            </section>

            <section className="min-w-0 space-y-4">
            <div className="white-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: '#fff7ed' }}><Bell size={16} className="text-orange-500" /></div>
                <div>
                    <p className="text-sm font-bold text-gray-800">Browser reminders</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-gray-500">Reminders run while an official page is open. Enable browser notifications for alerts; otherwise you’ll see an in-app reminder.</p>
                </div>
                </div>
                {notificationPermission !== 'granted' && (
                <button onClick={requestNotifications} className="w-fit flex-shrink-0 rounded-lg px-3 py-2 text-xs font-bold" style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>Enable alerts</button>
                )}
                {notificationPermission === 'granted' && <span className="flex items-center gap-1 text-xs font-bold text-emerald-600"><Check size={13} /> Enabled</span>}
            </div>

            <div className="white-card min-w-0 p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                <div><h2 className="font-bold text-gray-800">Saved appointments</h2><p className="text-xs text-gray-500">{appointments.length} recorded</p></div>
                <AlarmClock size={19} style={{ color: 'var(--brand)' }} />
                </div>
                {appointments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-brand-border px-4 py-10 text-center">
                    <CalendarDays size={30} className="mx-auto mb-2 text-gray-300" />
                    <p className="text-sm font-semibold text-gray-600">No appointments yet</p>
                    <p className="mt-1 text-xs text-gray-500">Appointments you record will appear here.</p>
                </div>
                ) : (
                <div className="max-h-[680px] space-y-2 overflow-y-auto pr-1">
                    {appointments.map(appointment => {
                    const reminderSent = Boolean(appointment.reminder_sent_at)
                    const past = new Date(appointment.starts_at) < new Date()
                    return (
                        <article key={appointment.id} className="rounded-2xl border border-brand-soft p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                            <h3 className="break-words text-sm font-bold text-gray-800">{appointment.title}</h3>
                            {appointment.participant_name && <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500"><UserRound size={12} /> {appointment.participant_name}</p>}
                            </div>
                            <span className={`flex-shrink-0 rounded-full px-2 py-1 text-xs font-bold ${past ? 'bg-gray-100 text-gray-500' : 'bg-emerald-50 text-emerald-700'}`}>{past ? 'Past' : 'Scheduled'}</span>
                        </div>
                        <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-gray-700"><CalendarDays size={13} style={{ color: 'var(--brand)' }} /> {formatDateTime(appointment.starts_at)}</p>
                        <p className="mt-1.5 flex items-center gap-2 text-xs text-gray-500"><Clock3 size={13} /> Reminder: {formatDateTime(appointment.remind_at)}</p>
                        {appointment.notes && <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-gray-500">{appointment.notes}</p>}
                        <p className={`mt-2 text-xs font-semibold ${reminderSent ? 'text-emerald-600' : 'text-orange-600'}`}>{reminderSent ? 'Reminder sent' : 'Reminder pending'}</p>
                        </article>
                    )
                    })}
                </div>
                )}
            </div>
            </section>
        </main>
        </div>
    )
    }
