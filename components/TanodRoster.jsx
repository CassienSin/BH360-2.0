'use client'
// Used in app/official/page.jsx (the dashboard's Tanods card, O01).
//
// Live roster of every tanod in the official's barangay, with three
// computed states:
//   Responding: on duty and has an assigned incident
//   Available:  on duty, no active assignment
//   Off duty
// plus an "active Xm ago" freshness line from the heartbeat, and a
// stale warning when someone is on duty but hasn't been seen in a
// while (phone off, app closed).

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { Phone } from 'lucide-react'
import { Card, CardHead } from '@/components/ui/card'
import { Rows, Row, RowTitle } from '@/components/ui/table'
import { Status, Tag } from '@/components/ui/tag'
import { Avatar } from '@/components/ui/avatar'
import { Muted } from '@/components/ui/text'
import { timeAgo } from '@/lib/timeAgo'
import { useNow } from '@/lib/useNow'
import { subscribeWhenSignedIn } from '@/lib/realtime'

const STALE_MS = 30 * 60 * 1000 // on duty but unseen for 30 min → warn

function statusOf(tanod, activeAssignments) {
  if (!tanod.on_duty) return 'off'
  if ((activeAssignments[tanod.id] || 0) > 0) return 'responding'
  return 'available'
}

const statusConfig = {
  responding: { label: 'Responding', tone: 'ok' },
  available:  { label: 'Available',  tone: 'info' },
  off:        { label: 'Off duty',   tone: 'quiet' },
}

const statusOrder = { responding: 0, available: 1, off: 2 }

export default function TanodRoster({ profile }) {
  const now = useNow()
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
    const leaveProfileChannel = subscribeWhenSignedIn(supabase, profileChannel)

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
        const { data, error } = await supabase
          .from('incidents')
          .select('assigned_to')
          .eq('barangay_id', profile.barangay_id)
          .eq('status', 'assigned')
        // A failure here would show every tanod on zero active assignments,
        // which reads as "free" and skews who gets dispatched next.
        if (error) console.error('Could not recount active assignments:', error)
        const counts = {}
        for (const row of data || []) {
          if (row.assigned_to) counts[row.assigned_to] = (counts[row.assigned_to] || 0) + 1
        }
        setActiveAssignments(counts)
      })
    const leaveIncidentChannel = subscribeWhenSignedIn(supabase, incidentChannel)

    return () => {
      leaveProfileChannel()
      leaveIncidentChannel()
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
    return now - new Date(t.last_seen_at).getTime() > STALE_MS
  }

  const total = tanods.length
  return (
    <Card>
      <CardHead title="Tanods"
        action={!loading && total > 0 && (
          <span className={`text-[13px] font-bold ${onDutyCount > 0 ? 'text-ok' : 'text-danger'}`}>
            {onDutyCount} of {total} on duty
          </span>
        )} />

      <div className="max-h-96 overflow-y-auto border-t border-line">
        {loading ? (
          <Muted className="px-[18px] py-5">Loading the roster…</Muted>
        ) : sorted.length === 0 ? (
          <Muted className="px-[18px] py-5">No tanods yet. Tanods join with an invite code from Users.</Muted>
        ) : (
          <Rows>
            {sorted.map(t => {
              const status = statusOf(t, activeAssignments)
              const sc = statusConfig[status]
              const stale = isStale(t)
              const assignments = activeAssignments[t.id] || 0
              return (
                <Row key={t.id} className="flex items-center gap-3">
                  <Avatar name={t.full_name} src={t.avatar_url} size="sm" tone={t.on_duty ? 'ok' : 'brand'} />
                  <RowTitle className="flex-1" title={t.full_name}
                    sub={(t.on_duty && t.last_seen_at
                      ? `Active ${timeAgo(t.last_seen_at)}`
                      : t.on_duty
                        ? 'Activity unknown'
                        : t.duty_changed_at
                          ? `Off since ${timeAgo(t.duty_changed_at)}`
                          : 'Never on duty yet')
                      + (assignments > 0 ? ` · ${assignments} active ${assignments === 1 ? 'incident' : 'incidents'}` : '')} />
                  {/* On duty but not seen in a while: call before dispatching. */}
                  {stale && <Tag tone="warn" className="shrink-0" title="On duty but not seen recently. Call first.">Inactive</Tag>}
                  <Status tone={sc.tone} className="shrink-0">{sc.label}</Status>
                  {t.phone && (
                    <a href={`tel:${t.phone}`} aria-label={`Call ${t.full_name}`}
                      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-surface-sunk hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-strong">
                      <Phone size={15} strokeWidth={1.9} />
                    </a>
                  )}
                </Row>
              )
            })}
          </Rows>
        )}
      </div>
    </Card>
  )
}
