'use client'

import { useEffect, useMemo, useRef } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { notifyAppointmentReminder } from '@/lib/notifications'

/** Sends due appointment reminders while any official dashboard page is open. */
export default function AppointmentReminderWatcher({ profile }) {
  const supabase = useMemo(() => createClient(), [])
  const locked = useRef(false)

  useEffect(() => {
    if (!profile?.id || !profile?.barangay_id) return undefined

    let cancelled = false
    async function checkReminders() {
      if (locked.current) return
      locked.current = true
      try {
        const now = new Date().toISOString()
        const { data, error } = await supabase.from('appointments')
          .select('id, title, participant_name, starts_at, remind_at')
          .eq('barangay_id', profile.barangay_id)
          .eq('created_by', profile.id)
          .is('reminder_sent_at', null)
          .lte('remind_at', now)
          .gt('starts_at', now)
          .order('remind_at', { ascending: true })
          .limit(20)
        if (error) throw error

        for (const appointment of data || []) {
          if (cancelled) return
          const sentAt = new Date().toISOString()
          const { data: claimed, error: claimError } = await supabase.from('appointments')
            .update({ reminder_sent_at: sentAt })
            .eq('id', appointment.id)
            .eq('created_by', profile.id)
            .is('reminder_sent_at', null)
            .select('id')
          if (claimError) throw claimError
          if (!claimed?.length) continue

          const shown = await notifyAppointmentReminder(appointment)
          if (!shown) toast(`Reminder: ${appointment.title}`, { duration: 8000 })
        }
      } catch (error) {
        console.error('Appointment reminder check failed:', error)
      } finally {
        locked.current = false
      }
    }

    checkReminders()
    const interval = setInterval(checkReminders, 30_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [profile?.id, profile?.barangay_id, supabase])

  return null
}
