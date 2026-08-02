'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase'

/**
 * Live responder availability for a barangay.
 *
 * Residents reporting an emergency deserve to know whether anyone is
 * actually there to receive it. Without this, a report submitted at 3am
 * looks identical to one submitted at noon — and a resident who believes
 * a tanod is coming will wait instead of calling an agency that could
 * actually respond. False reassurance is the dangerous failure mode here,
 * not discouraging news.
 *
 * "On duty" for tanods is the explicit on_duty flag they control.
 * "Active" for officials is inferred from last_seen_at, since officials
 * have no duty toggle — someone whose dashboard was open in the last
 * 15 minutes is plausibly reachable.
 */

const OFFICIAL_ACTIVE_WINDOW_MS = 15 * 60 * 1000

export function useBarangayAvailability(barangayId) {
  const supabase = useMemo(() => createClient(), [])
  const [responders, setResponders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!barangayId) { setLoading(false); return }
    let cancelled = false

    async function load() {
      const { data, error: err } = await supabase
        .from('profiles')
        .select('id, full_name, role, phone, on_duty, last_seen_at')
        .eq('barangay_id', barangayId)
        .in('role', ['tanod', 'official'])
        .is('deactivated_at', null)

      if (cancelled) return
      if (err) {
        // Availability is advisory — never block reporting because it failed
        console.warn('Availability lookup failed:', err.message)
        setError(true)
      }
      setResponders(data || [])
      setLoading(false)
    }
    load()

    // Duty toggles and heartbeats arrive live, so the strip stays honest
    // while the resident is still filling in the form
    const channel = supabase
      .channel(`availability-${barangayId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `barangay_id=eq.${barangayId}`,
      }, (payload) => {
        setResponders(prev => prev.map(p => (p.id === payload.new.id ? { ...p, ...payload.new } : p)))
      })
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [barangayId, supabase])

  return useMemo(() => {
    const now = Date.now()
    const tanodsOnDuty = responders.filter(r => r.role === 'tanod' && r.on_duty)
    const officialsActive = responders.filter(r =>
      r.role === 'official' &&
      r.last_seen_at &&
      now - new Date(r.last_seen_at).getTime() < OFFICIAL_ACTIVE_WINDOW_MS
    )

    // Three honest states rather than a binary online/offline
    const level =
      tanodsOnDuty.length > 0 ? 'staffed'
      : officialsActive.length > 0 ? 'limited'
      : 'unstaffed'

    return {
      loading,
      error,
      level,                                   // 'staffed' | 'limited' | 'unstaffed'
      tanodsOnDuty,
      officialsActive,
      tanodCount: tanodsOnDuty.length,
      officialCount: officialsActive.length,
      totalTanods: responders.filter(r => r.role === 'tanod').length,
    }
  }, [responders, loading, error])
}