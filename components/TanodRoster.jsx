'use client'
// Save as: components/TanodRoster.jsx
// Used in:  app/official/page.jsx  (see integration notes in chat)
//
// Live roster of every tanod in the official's barangay, with three
// computed states:
//   🟠 Responding — on duty AND currently has an assigned incident
//   🟢 Available  — on duty, no active assignment
//   ⚪ Off duty
// plus an "active Xm ago" freshness line from the heartbeat, and a
// stale warning when someone is on duty but hasn't been seen in a
// while (phone off, app closed).

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { Shield, Phone, AlertTriangle } from 'lucide-react'
import { timeAgo } from '@/lib/timeAgo'

const STALE_MS = 30 * 60 * 1000 // on duty but unseen for 30 min → warn

function statusOf(tanod, activeAssignments) {
  if (!tanod.on_duty) return 'off'
  if ((activeAssignments[tanod.id] || 0) > 0) return 'responding'
  return 'available'
}

const statusConfig = {
  responding: { label: 'Responding', dot: '#f97316', bg: '#fff7ed', color: '#c2410c' },
  available:  { label: 'Available',  dot: '#22c55e', bg: '#f0fdf4', color: '#15803d' },
  off:        { label: 'Off duty',   dot: '#d1d5db', bg: '#fafaff', color: '#9ca3af' },
}

const statusOrder = { responding: 0, available: 1, off: 2 }

export default function TanodRoster({ profile }) {
  const supabase = useMemo(() => createClient(), [])
  const [tanods, setTanods] = useState([])
  const [activeAssignments, setActiveAssignments] = useState({}) // { tanodId: count }
  const [loading, setLoading] = useState(true)
  // Re-render every minute so "active Xm ago" and staleness stay honest
  const [, setTick] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 60 * 1000)
    return () => clearInterval(t)
  }, [])

  // Initial load
  useEffect(() => {
    if (!profile?.barangay_id) return
    let cancelled = false

    async function load() {
      const [{ data: tanodRows }, { data: incidentRows }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, phone, avatar_url, on_duty, duty_changed_at, last_seen_at')
          .eq('barangay_id', profile.barangay_id)
          .eq('role', 'tanod')
          .is('deactivated_at', null),
        supabase
          .from('incidents')
          .select('assigned_to')
          .eq('barangay_id', profile.barangay_id)
          .eq('status', 'assigned'),
      ])
      if (cancelled) return
      setTanods(tanodRows || [])
      const counts = {}
      for (const row of incidentRows || []) {
        if (row.assigned_to) counts[row.assigned_to] = (counts[row.assigned_to] || 0) + 1
      }
      setActiveAssignments(counts)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [profile?.barangay_id, supabase])

  // Realtime: duty toggles + heartbeats + dispatch/resolution changes
  useEffect(() => {
    if (!profile?.barangay_id) return

    const profileChannel = supabase
      .channel('roster-profiles')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `barangay_id=eq.${profile.barangay_id}`,
      }, (payload) => {
        setTanods(prev => prev.map(t =>
          t.id === payload.new.id ? { ...t, ...payload.new } : t
        ))
      })
      .subscribe()

    const incidentChannel = supabase
      .channel('roster-incidents')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'incidents',
        filter: `barangay_id=eq.${profile.barangay_id}`,
      }, async () => {
        // Assignment counts are cheap to recount and hard to patch
        // incrementally (dispatch, resolve, reassign…) — just refetch.
        const { data } = await supabase
          .from('incidents')
          .select('assigned_to')
          .eq('barangay_id', profile.barangay_id)
          .eq('status', 'assigned')
        const counts = {}
        for (const row of data || []) {
          if (row.assigned_to) counts[row.assigned_to] = (counts[row.assigned_to] || 0) + 1
        }
        setActiveAssignments(counts)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(profileChannel)
      supabase.removeChannel(incidentChannel)
    }
  }, [profile?.barangay_id, supabase])

  const sorted = useMemo(() => {
    return [...tanods].sort((a, b) => {
      const sa = statusOrder[statusOf(a, activeAssignments)]
      const sb = statusOrder[statusOf(b, activeAssignments)]
      if (sa !== sb) return sa - sb
      return (a.full_name || '').localeCompare(b.full_name || '')
    })
  }, [tanods, activeAssignments])

  const onDutyCount = tanods.filter(t => t.on_duty).length

  function isStale(t) {
    if (!t.on_duty) return false
    if (!t.last_seen_at) return true
    return Date.now() - new Date(t.last_seen_at).getTime() > STALE_MS
  }

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: 'white', border: '1px solid #e8e3ff', boxShadow: '0 2px 12px rgba(91,84,232,0.06)' }}>

      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100"
        style={{ background: '#fafaff' }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: '#f0fdf4' }}>
            <Shield size={15} className="text-emerald-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-800">Tanod Roster</h3>
            <p className="text-[11px] text-gray-400">Live duty status</p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold"
          style={{
            background: onDutyCount > 0 ? '#f0fdf4' : '#fff1f1',
            color: onDutyCount > 0 ? '#15803d' : '#dc2626',
          }}>
          {onDutyCount} on duty
        </span>
      </div>

      {/* List */}
      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <p className="px-4 py-8 text-center text-sm text-gray-400">Loading roster…</p>
        ) : sorted.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-400">No tanods registered yet.</p>
        ) : (
          sorted.map(t => {
            const status = statusOf(t, activeAssignments)
            const sc = statusConfig[status]
            const stale = isStale(t)
            const assignments = activeAssignments[t.id] || 0
            return (
              <div key={t.id}
                className="px-4 py-3 flex items-center gap-3 border-b border-gray-50 last:border-b-0"
                style={{ opacity: status === 'off' ? 0.6 : 1 }}>

                {/* Avatar + status dot */}
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white overflow-hidden"
                    style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)' }}>
                    {t.avatar_url
                      ? <img src={t.avatar_url} alt={t.full_name} className="w-full h-full object-cover" />
                      : t.full_name?.[0]?.toUpperCase()}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white"
                    style={{ background: sc.dot }} />
                </div>

                {/* Name + freshness */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{t.full_name}</p>
                  <p className="text-[11px] text-gray-400 truncate">
                    {t.on_duty && t.last_seen_at
                      ? `Active ${timeAgo(t.last_seen_at)}`
                      : t.on_duty
                        ? 'Activity unknown'
                        : t.duty_changed_at
                          ? `Off since ${timeAgo(t.duty_changed_at)}`
                          : 'Never on duty yet'}
                    {assignments > 0 && ` · ${assignments} active ${assignments === 1 ? 'incident' : 'incidents'}`}
                  </p>
                </div>

                {/* Stale warning: on duty but unreachable-looking */}
                {stale && (
                  <span title="On duty but not seen recently — consider calling first"
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0"
                    style={{ background: '#fefce8', color: '#a16207' }}>
                    <AlertTriangle size={10} /> Inactive
                  </span>
                )}

                {/* Status badge */}
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0"
                  style={{ background: sc.bg, color: sc.color }}>
                  {sc.label}
                </span>

                {/* Quick call */}
                {t.phone && (
                  <a href={`tel:${t.phone}`} aria-label={`Call ${t.full_name}`}
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors flex-shrink-0">
                    <Phone size={13} />
                  </a>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}