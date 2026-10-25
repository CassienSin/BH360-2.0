'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, Clock3, Plus, UserRound } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import AppointmentReminderWatcher from '@/components/AppointmentReminderWatcher'
import { AppButton, PageHeader, PageState, StatusBadge } from '@/components/AppUI'
import { useNow } from '@/lib/useNow'

function formatDateTime(value) {
  if (!value) return 'Not set'
  return new Date(value).toLocaleString('en-PH', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

export default function AppointmentsPage() {
  const now = useNow()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [profile, setProfile] = useState(null)
  const [appointments, setAppointments] = useState([])
  const [filter, setFilter] = useState('upcoming')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reload, setReload] = useState(0)

  const loadAppointments = useCallback(async (barangayId) => {
    const { data, error } = await supabase.from('appointments')
      .select('*')
      .eq('barangay_id', barangayId)
      .order('starts_at', { ascending: true })
      .limit(500)
    if (error) throw error
    setAppointments(data || [])
  }, [supabase])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
          router.replace('/login')
          return
        }
        const { data: official, error } = await supabase.from('profiles')
          .select('id, role, barangay_id, barangays(name)')
          .eq('id', user.id)
          .single()
        if (cancelled) return
        if (error || official?.role !== 'official' || !official?.barangay_id) {
          toast.error(error ? 'Could not load your official profile.' : 'Officials only.')
          router.replace('/login')
          return
        }
        setProfile(official)
        await loadAppointments(official.barangay_id)
      } catch (error) {
        console.error('Could not load appointments:', error)
        if (!cancelled) setLoadError('Your appointments could not be loaded. Check your connection and try again.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [supabase, router, loadAppointments, reload])

  function retry() {
    setLoadError('')
    setLoading(true)
    setReload(value => value + 1)
  }

  useEffect(() => {
    if (!profile?.barangay_id) return
    const channel = supabase.channel('official-appointments-list')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'appointments',
        filter: `barangay_id=eq.${profile.barangay_id}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setAppointments(previous => previous.some(item => item.id === payload.new.id)
            ? previous
            : [...previous, payload.new].sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)))
        } else if (payload.eventType === 'UPDATE') {
          setAppointments(previous => previous.map(item =>
            item.id === payload.new.id ? { ...item, ...payload.new } : item
          ))
        } else if (payload.eventType === 'DELETE') {
          setAppointments(previous => previous.filter(item => item.id !== payload.old.id))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile?.barangay_id, supabase])

  const visibleAppointments = appointments.filter(appointment => {
    const upcoming = new Date(appointment.starts_at).getTime() >= now
    return filter === 'all' || (filter === 'upcoming' ? upcoming : !upcoming)
  })

  if (loading) {
    return <PageState fullPage kind="loading" title="Loading appointments…" description="Getting your barangay schedule." />
  }

  return (
    <div className="min-h-screen relative overflow-clip bg-brand">
      <AppointmentReminderWatcher profile={profile} />
      <PageHeader title="Appointments" description={`${profile?.barangays?.name || 'Barangay'} · Appointment schedule`} icon={CalendarDays} onBack={() => router.push('/official')} backLabel="Back to dashboard" actions={<AppButton onClick={() => router.push('/official/calendar/appointments/new')}><Plus size={16} />New Appointment</AppButton>} />

      <main className="relative z-10 mx-auto w-full max-w-[1320px] space-y-4 px-4 sm:px-6 py-6">
        <section className="white-card p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-gray-800">Your appointments</h2>
              <p className="text-xs text-gray-500">{loadError ? 'Appointments unavailable' : `${visibleAppointments.length} shown · ${appointments.length} total`}</p>
            </div>
            <div className="flex rounded-xl bg-[#f5f4ff] p-1" aria-label="Filter appointments">
              {[['upcoming', 'Upcoming'], ['past', 'Past'], ['all', 'All']].map(([key, label]) => (
                <button key={key} onClick={() => setFilter(key)} aria-pressed={filter === key}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold ${filter === key ? 'bg-white text-brand shadow-sm' : 'text-gray-500'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {loadError ? <PageState kind="error" title="Appointments unavailable" description={loadError} actionLabel="Try again" onAction={retry} /> : visibleAppointments.length === 0 ? (
            <PageState icon={CalendarDays} title={filter === 'past' ? 'No past appointments' : filter === 'upcoming' ? 'No upcoming appointments' : 'No appointments yet'} description={appointments.length ? 'There are no appointments in this view. Choose another filter to see your saved appointments.' : 'Create an appointment to keep your barangay activities and reminders organized.'} actionLabel={appointments.length ? 'View all appointments' : 'Create an Appointment'} onAction={() => appointments.length ? setFilter('all') : router.push('/official/calendar/appointments/new')} />
          ) : (
            <div className="space-y-3">
              {visibleAppointments.map(appointment => {
                const past = new Date(appointment.starts_at).getTime() < now
                return (
                  <article key={appointment.id} className="rounded-2xl border border-brand-soft p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="break-words text-sm font-bold text-gray-800">{appointment.title}</h3>
                        {appointment.participant_name && <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500"><UserRound size={12} /> {appointment.participant_name}</p>}
                      </div>
                      <StatusBadge tone={past ? 'neutral' : 'info'}>
                        {past ? 'Past' : 'Scheduled'}
                      </StatusBadge>
                    </div>
                    <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-gray-700"><CalendarDays size={13} style={{ color: 'var(--brand)' }} /> {formatDateTime(appointment.starts_at)}</p>
                    <p className="mt-1.5 flex items-center gap-2 text-xs text-gray-500"><Clock3 size={13} /> Reminder: {formatDateTime(appointment.remind_at)}</p>
                    {appointment.notes && <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-gray-500">{appointment.notes}</p>}
                    <p className={`mt-2 text-xs font-semibold ${appointment.reminder_sent_at ? 'text-emerald-600' : 'text-orange-600'}`}>
                      {appointment.reminder_sent_at ? 'Reminder sent' : 'Reminder pending'}
                    </p>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
