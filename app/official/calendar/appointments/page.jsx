'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CalendarDays, Clock3, Loader2, Plus, UserRound } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import AppointmentReminderWatcher from '@/components/AppointmentReminderWatcher'

function formatDateTime(value) {
  if (!value) return 'Not set'
  return new Date(value).toLocaleString('en-PH', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

export default function AppointmentsPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [profile, setProfile] = useState(null)
  const [appointments, setAppointments] = useState([])
  const [filter, setFilter] = useState('upcoming')
  const [loading, setLoading] = useState(true)

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

  const now = Date.now()
  const visibleAppointments = appointments.filter(appointment => {
    const upcoming = new Date(appointment.starts_at).getTime() >= now
    return filter === 'all' || (filter === 'upcoming' ? upcoming : !upcoming)
  })

  if (loading) {
    return <div className="min-h-screen bg-brand flex items-center justify-center"><Loader2 size={30} className="animate-spin text-white" /></div>
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-brand">
      <AppointmentReminderWatcher profile={profile} />
      <header className="relative z-10 border-b border-[#f0effe] bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <button onClick={() => router.push('/official')} aria-label="Back to dashboard"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl hover:bg-gray-100">
            <ArrowLeft size={18} className="text-gray-600" />
          </button>
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl" style={{ background: '#f0effe' }}>
            <CalendarDays size={18} style={{ color: '#5B54E8' }} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold text-gray-800">Appointments</h1>
            <p className="truncate text-xs text-gray-400">{profile?.barangays?.name || 'Barangay'} · appointment schedule</p>
          </div>
          <button onClick={() => router.push('/official/calendar/appointments/new')}
            className="flex flex-shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)' }}>
            <Plus size={14} /> <span className="hidden sm:inline">New appointment</span><span className="sm:hidden">New</span>
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-5xl space-y-4 px-4 py-6">
        <section className="white-card p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-gray-800">Your appointments</h2>
              <p className="text-xs text-gray-400">{visibleAppointments.length} shown · {appointments.length} total</p>
            </div>
            <div className="flex rounded-xl bg-[#f5f4ff] p-1" aria-label="Filter appointments">
              {[['upcoming', 'Upcoming'], ['past', 'Past'], ['all', 'All']].map(([key, label]) => (
                <button key={key} onClick={() => setFilter(key)}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold ${filter === key ? 'bg-white text-[#5B54E8] shadow-sm' : 'text-gray-500'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {visibleAppointments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#e8e3ff] px-4 py-12 text-center">
              <CalendarDays size={30} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm font-semibold text-gray-600">{filter === 'past' ? 'No past appointments' : 'No appointments yet'}</p>
              <p className="mt-1 text-xs text-gray-400">Create an appointment and it will appear in this list.</p>
              <button onClick={() => router.push('/official/calendar/appointments/new')}
                className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)' }}>
                <Plus size={14} /> Create appointment
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleAppointments.map(appointment => {
                const past = new Date(appointment.starts_at).getTime() < Date.now()
                return (
                  <article key={appointment.id} className="rounded-2xl border border-[#f0effe] p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="break-words text-sm font-bold text-gray-800">{appointment.title}</h3>
                        {appointment.participant_name && <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500"><UserRound size={12} /> {appointment.participant_name}</p>}
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${past ? 'bg-gray-100 text-gray-500' : 'bg-emerald-50 text-emerald-700'}`}>
                        {past ? 'Past' : 'Scheduled'}
                      </span>
                    </div>
                    <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-gray-700"><CalendarDays size={13} style={{ color: '#5B54E8' }} /> {formatDateTime(appointment.starts_at)}</p>
                    <p className="mt-1.5 flex items-center gap-2 text-xs text-gray-500"><Clock3 size={13} /> Reminder: {formatDateTime(appointment.remind_at)}</p>
                    {appointment.notes && <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-gray-500">{appointment.notes}</p>}
                    <p className={`mt-2 text-[10px] font-semibold ${appointment.reminder_sent_at ? 'text-emerald-600' : 'text-orange-600'}`}>
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
