'use client'
import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { MapPin, CheckCircle, Clock, AlertTriangle, Home, Phone, Navigation, TrendingUp, Award, Zap, FileText, Star } from 'lucide-react'
import toast from 'react-hot-toast'
import dynamic from 'next/dynamic'
import DashboardHeader from '@/components/DashboardHeader'
import DashboardSidebar from '@/components/DashboardSidebar'
import ResolveModal from '@/components/ResolveModal'
import DutyToggle from '@/components/DutyToggle'
import { timeAgo, timeAgoLong, fullDate } from '@/lib/timeAgo'
import NotificationBanner from '@/components/NotificationBanner'
import { notifyNewAssignment } from '@/lib/notifications'
import { CATEGORY_CONFIG } from '@/lib/legalBasis'
import { notify } from '@/components/Toast'
import { useSignedIncidentUrl } from '@/lib/useSignedUrl'
import RecordCard, { RecordGroup, Chip } from '@/components/RecordCard'
import { HomeSummary, ActivityTile, TileGrid } from '@/components/HomeSummary'
import { greeting } from '@/lib/homeSummary'
import { toneFor } from '@/lib/recordState'
import { computeStanding, STANDING_STYLE, activeWindowLabel } from '@/lib/triage'
import {
  RESPONSE_STEPS, responseStage, nextAction, byUrgency, overdueAssignments,
  tanodSummary, mostUrgentAssignment, tanodStats,
} from '@/lib/tanod'


const MiniMap = dynamic(() => import('@/components/MiniMap'), { ssr: false })

const PAGE_SIZE = 50
const INCIDENT_SELECT = '*, profiles!incidents_reported_by_fkey(full_name, phone)'

const DOTS = Array.from({ length: 20 }, (_, i) => ({
  size: ((i * 7) % 6) + 3,
  left: (i * 17 + 13) % 100,
  top: (i * 23 + 7) % 100,
  duration: ((i * 3) % 6) + 4,
  delay: (i * 0.7) % 4,
}))

const AnimatedDots = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
    {DOTS.map((dot, i) => (
      <div
        key={i}
        style={{
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
        }}
      />
    ))}
  </div>
)


// Incident photos live in a private bucket, so the URL has to be signed
// per viewer. Opening in a new tab still works — the signed URL carries its
// own token and expires on its own.
function IncidentPhoto({ stored, alt, className, imgClassName, style }) {
  const signed = useSignedIncidentUrl(stored)
  if (!signed) return null
  return (
    <a href={signed} target="_blank" rel="noopener noreferrer" className={className} style={style}>
      <img src={signed} alt={alt} className={imgClassName} loading="lazy" />
    </a>
  )
}

const PRIORITY_CONFIG = {
  Low: { color: '#22c55e', bg: '#f0fdf4', icon: '🟢', order: 1 },
  Medium: { color: '#3b82f6', bg: '#eff6ff', icon: '🔵', order: 2 },
  High: { color: '#f97316', bg: '#fff7ed', icon: '🟠', order: 3 },
  Critical: { color: '#dc2626', bg: '#fef2f2', icon: '🔴', order: 4 },
}

const SECTION_TITLES = {
  home: 'Home',
  active: 'Active Assignments',
  resolved: 'Resolved Incidents',
  stats: 'My Performance',
}

const ACHIEVEMENTS = [
  { icon: '🎯', title: 'First Resolution', desc: 'Resolve your first incident', target: 1, type: 'count' },
  { icon: '⭐', title: 'Rising Star', desc: 'Resolve 10 incidents', target: 10, type: 'count' },
  { icon: '🏆', title: 'Champion', desc: 'Resolve 50 incidents', target: 50, type: 'count' },
  { icon: '💎', title: 'Excellence', desc: '90% resolution rate', target: 90, type: 'rate' },
]

export default function TanodDashboard() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [profile, setProfile] = useState(null)
  const [incidents, setIncidents] = useState([])
  const [activeSection, setActiveSection] = useState('home')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [resolveModal, setResolveModal] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  // The refetch on tab focus must not silently shrink a list the tanod has
  // already paged through.
  const pageSizeRef = useRef(PAGE_SIZE)
  const [busyStamp, setBusyStamp] = useState(null)
  const [directionsMenu, setDirectionsMenu] = useState(null)

  // Mirror of incident ids, so the realtime handler can tell "new to me"
  // apart from "update to something I already have" without relying on
  // payload.old (which is empty unless the table has REPLICA IDENTITY FULL)
  const incidentIdsRef = useRef(new Set())
  useEffect(() => {
    incidentIdsRef.current = new Set(incidents.map(i => i.id))
  }, [incidents])

  // ---- Sidebar persistence ----
  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('sidebarOpen')
    if (saved !== null) {
      setSidebarOpen(JSON.parse(saved))
    } else if (window.innerWidth < 768) {
      setSidebarOpen(false)
    }
  }, [])

  useEffect(() => {
    if (mounted) {
      localStorage.setItem('sidebarOpen', JSON.stringify(sidebarOpen))
    }
  }, [sidebarOpen, mounted])

  // Only react when the viewport actually crosses the breakpoint.
  // The old version also ran on mount, which stomped the saved preference.
  useEffect(() => {
    let wasMobile = window.innerWidth < 768
    const handleResize = () => {
      const isMobile = window.innerWidth < 768
      if (isMobile !== wasMobile) {
        setSidebarOpen(!isMobile)
        wasMobile = isMobile
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // ---- Data loading ----
  // Bounded, like the official queue. A tanod's history only grows, and
  // loading every incident they have ever been sent slows the page down for
  // the assignments they actually need now.
  const fetchIncidents = useCallback(async (userId, limit = PAGE_SIZE) => {
    const { data, error } = await supabase
      .from('incidents')
      .select(INCIDENT_SELECT)
      .eq('assigned_to', userId)
      .order('created_at', { ascending: false })
      .limit(limit + 1)
    if (error) throw error
    const rows = data || []
    return { rows: rows.slice(0, limit), hasMore: rows.length > limit }
  }, [supabase])

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      try {
        const { data: { session }, error: authError } = await supabase.auth.getSession()
        if (authError || !session) {
          router.push('/login')
          return
        }
        const user = session.user

        const { data: prof, error: profError } = await supabase
          .from('profiles')
          .select('*, barangays(id, name, city, province)')
          .eq('id', user.id)
          .single()

        if (cancelled) return
      // A failed query is not the same as being the wrong role. Sending
      // someone to the login page for a network blip signs them out of a
      // session that is perfectly valid.
        if (profError) {
          console.error('Could not load your profile:', profError)
          toast.error('Could not load your profile. Please refresh.')
          setLoading(false)
          return
        }
        if (prof?.role !== 'tanod') {
          router.push('/login')
          return
        }
        setProfile(prof)

        const { rows, hasMore } = await fetchIncidents(user.id)
        if (cancelled) return
        setIncidents(rows)
        setHasMore(hasMore)
      } catch (err) {
        console.error('Failed to load dashboard:', err)
        if (!cancelled) toast.error('Failed to load your assignments. Please refresh.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadData()

    return () => { cancelled = true }
  }, [supabase, router, fetchIncidents])

  // Revalidate when the tab regains focus. The realtime filter only delivers
  // rows where assigned_to is still this tanod, so re-assignments AWAY from
  // them never arrive as events — a focus refetch clears those stale cards.
  useEffect(() => {
    if (!profile?.id) return
    const onVisible = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const { rows, hasMore } = await fetchIncidents(profile.id, pageSizeRef.current)
        setIncidents(rows)
        setHasMore(hasMore)
      } catch {
        // Non-critical background refresh — stay quiet on failure
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [profile?.id, fetchIncidents])

  // ---- Realtime subscription ----
  useEffect(() => {
    if (!profile?.id) return

    const incidentChannel = supabase
      .channel(`tanod-incidents-${profile.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'incidents',
        filter: `assigned_to=eq.${profile.id}`,
      }, async (payload) => {
        if (payload.eventType === 'DELETE') {
          setIncidents(prev => prev.filter(i => i.id !== payload.old.id))
          return
        }

        // "New assignment" = a row we don't already have, currently assigned.
        // This works regardless of REPLICA IDENTITY (the old code compared
        // payload.old.status, which is usually not populated).
        const alreadyHave = incidentIdsRef.current.has(payload.new.id)
        const isNewAssignment = !alreadyHave && payload.new.status === 'assigned'

        if (isNewAssignment) {
          const { data, error } = await supabase
            .from('incidents')
            .select(INCIDENT_SELECT)
            .eq('id', payload.new.id)
            .single()
          if (error || !data) return

          setIncidents(prev => {
            if (prev.some(i => i.id === data.id)) return prev.map(i => (i.id === data.id ? data : i))
            return [data, ...prev]
          })

          const toastId = `assignment-${data.id}`
          if (data.priority === 'Critical') {
      notify.critical({
        kind: `Critical · ${data.category || 'Assignment'}`,
        title: data.title,
        body: data.location,
      })
          } else if (data.priority === 'High') {
            toast(`⚠️ HIGH PRIORITY: ${data.title}`, { duration: 6000, icon: '🟠', id: toastId })
          } else {
      notify.warn({
        kind: 'New assignment',
        title: data.title,
        body: data.location,
      })
          }
          notifyNewAssignment(data)
        } else if (payload.eventType === 'UPDATE') {
          // Merge so the joined reporter profile is preserved
          setIncidents(prev => prev.map(i => (i.id === payload.new.id ? { ...i, ...payload.new } : i)))
        } else if (payload.eventType === 'INSERT' && !alreadyHave) {
          // Inserted directly in a non-assigned status — still track it
          setIncidents(prev => (prev.some(i => i.id === payload.new.id) ? prev : [payload.new, ...prev]))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(incidentChannel)
    }
  }, [profile?.id, supabase])

  function navClick(key) {
    setActiveSection(key)
    if (window.innerWidth < 768) setSidebarOpen(false)
  }

  /**
   * Record having seen an assignment, or having reached it.
   *
   * The value sent is only a request — stamp_incident_response() in the
   * database decides what the time says and whose name is on it, so a
   * response time cannot be edited after the fact.
   */
  async function stampResponse(incident, field) {
    if (busyStamp) return
    setBusyStamp(incident.id)
    const { data, error } = await supabase
      .from('incidents')
      .update({ [field]: new Date().toISOString() })
      .eq('id', incident.id)
      .select(INCIDENT_SELECT)
      .single()
    setBusyStamp(null)

    if (error || !data) {
      console.error('Could not record response:', error)
      toast.error('Could not save that. Check your signal and try again.')
      return
    }

    // Take the row back from the database rather than guessing — the stamp
    // it wrote is the one that counts.
    setIncidents(prev => prev.map(i => (i.id === data.id ? { ...i, ...data } : i)))
    notify.success({
      kind: field === 'arrived_at' ? 'On scene' : 'On the way',
      title: incident.title,
      body: field === 'arrived_at'
        ? 'The barangay can see you have arrived.'
        : 'The barangay knows you have seen this.',
      id: `stamp-${incident.id}-${field}`,
    })
  }

  async function loadMore() {
    if (!profile?.id || loadingMore) return
    setLoadingMore(true)
    const next = pageSizeRef.current + PAGE_SIZE
    try {
      const { rows, hasMore: more } = await fetchIncidents(profile.id, next)
      pageSizeRef.current = next
      setIncidents(rows)
      setHasMore(more)
    } catch (err) {
      console.error('Could not load older assignments:', err)
      toast.error('Could not load older assignments.')
    } finally {
      setLoadingMore(false)
    }
  }

  async function handleResolve({ notes, imageUrl, resolvedAt }) {
    const incidentId = resolveModal.id
    const { error } = await supabase.from('incidents').update({
      status: 'resolved',
      resolution_notes: notes,
      resolution_image_url: imageUrl,
      resolved_at: resolvedAt,
    }).eq('id', incidentId)

    if (error) {
      // Keep the modal open so the tanod's notes/photo aren't lost
      toast.error('Failed to save resolution. Please try again.')
      return
    }

    setIncidents(prev => prev.map(i =>
      i.id === incidentId
        ? { ...i, status: 'resolved', resolution_notes: notes, resolution_image_url: imageUrl, resolved_at: resolvedAt }
        : i
    ))
    toast.success('Incident resolved! Great work! 🛡️', { id: `resolved-${incidentId}` })
    setResolveModal(null)
  }

  function openDirections(provider, lat, lng) {
    const urls = {
      google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
      waze: `https://www.waze.com/ul?ll=${lat},${lng}&navigate=yes`,
      apple: `https://maps.apple.com/?daddr=${lat},${lng}`,
    }
    window.open(urls[provider], '_blank', 'noopener,noreferrer')
    setDirectionsMenu(null)
  }

  function callReporter(phone) {
    if (!phone) {
      toast.error('No phone number available')
      return
    }
    window.location.href = `tel:${phone}`
  }

  // ---- Derived data (memoized) ----
  // Worst first, and within one priority the one waiting longest — see
  // byUrgency. The old comparator put the newest first, which is the
  // opposite of a queue.
  const assignedIncidents = useMemo(
    () => incidents.filter(i => i.status === 'assigned').sort(byUrgency),
    [incidents]
  )

  const resolvedIncidents = useMemo(
    () => incidents.filter(i => i.status === 'resolved'),
    [incidents]
  )

  const stats = useMemo(() => tanodStats(incidents), [incidents])

  const overdue = useMemo(
    () => overdueAssignments(assignedIncidents),
    [assignedIncidents]
  )

  const unacknowledged = useMemo(
    () => assignedIncidents.filter(i => !i.acknowledged_at).length,
    [assignedIncidents]
  )

  const brief = useMemo(
    () => tanodSummary({
      assignments: assignedIncidents,
      onDuty: Boolean(profile?.on_duty),
      barangayName: profile?.barangays?.name,
    }),
    [assignedIncidents, profile]
  )

  const urgent = useMemo(
    () => mostUrgentAssignment(assignedIncidents),
    [assignedIncidents]
  )

  // Counts of what still needs doing, not totals. "Unopened" is the one
  // that did not exist before: a tanod could be sent three reports and the
  // dashboard could not tell them which they had actually looked at.
  const tanodTiles = useMemo(() => [
    {
      key: 'unopened', icon: <AlertTriangle size={17} />, tone: 'waiting',
      count: unacknowledged, quiet: unacknowledged === 0,
      label: unacknowledged === 1 ? 'Not opened yet' : 'Not opened yet',
      caption: `${assignedIncidents.length} assigned`,
      onClick: () => navClick('active'),
    },
    {
      key: 'overdue', icon: <Clock size={17} />, tone: 'overdue',
      count: overdue.length, quiet: overdue.length === 0,
      label: overdue.length === 1 ? 'Past its time' : 'Past their time',
      caption: overdue.length ? 'respond as soon as you can' : 'all within target',
      onClick: () => navClick('active'),
    },
    {
      key: 'month', icon: <Zap size={17} />, tone: 'done',
      count: stats.resolvedThisMonth, quiet: stats.resolvedThisMonth === 0,
      label: 'Resolved this month',
      caption: `${stats.resolvedTotal} all time`,
      onClick: () => navClick('stats'),
    },
    {
      key: 'response', icon: <Award size={17} />, tone: 'info',
      count: stats.respond.label || '—', quiet: !stats.respond.label,
      label: 'Average response',
      caption: stats.respond.sample
        ? `over ${stats.respond.sample} report${stats.respond.sample === 1 ? '' : 's'}`
        : 'nothing acknowledged yet',
      onClick: () => navClick('stats'),
    },
  ], [unacknowledged, assignedIncidents.length, overdue.length, stats])

  const recentRatings = useMemo(
    () => resolvedIncidents.filter(i => i.rating).slice(0, 5),
    [resolvedIncidents]
  )

  const navItems = [
    { section: 'MAIN', items: [
      { key: 'home', label: 'Home', icon: Home },
      { key: 'active', label: 'Active Assignments', icon: AlertTriangle, count: assignedIncidents.length, hasNew: assignedIncidents.length > 0 },
      { key: 'resolved', label: 'Resolved', icon: CheckCircle },
      { key: 'stats', label: 'My Performance', icon: TrendingUp, badge: 'NEW' },
    ]},
  ]

  const Skeleton = ({ className }) => <div className={`skeleton-shimmer ${className}`} />
  const CardSkeleton = () => (
    <div className="white-card p-5">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-2xl flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex relative overflow-hidden bg-brand">
      <AnimatedDots />
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-20 right-20 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'white', filter: 'blur(80px)', animation: 'float 8s ease-in-out infinite' }} />
        <div className="absolute bottom-20 left-20 w-72 h-72 rounded-full opacity-10"
          style={{ background: 'white', filter: 'blur(60px)', animation: 'floatReverse 10s ease-in-out infinite' }} />
      </div>

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <DashboardSidebar
        profile={profile}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        roleLabel="Tanod"
        stats={[
          { label: 'Active', value: assignedIncidents.length, color: '#f97316', key: 'active' },
          { label: 'Resolved', value: resolvedIncidents.length, color: '#22c55e', key: 'resolved' },
          { label: 'This Month', value: stats.resolvedThisMonth, color: '#5B54E8', key: 'stats' },
          { label: 'Success', value: `${stats.resolutionRate}%`, color: '#3b82f6', key: 'stats' },
        ]}
        navItems={navItems}
      />

      <div className={`flex-1 flex flex-col min-w-0 relative z-10 transition-all duration-300 h-screen overflow-hidden ${sidebarOpen ? 'md:ml-64' : 'md:ml-16'}`}>
        <DashboardHeader
          profile={profile}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          sectionTitle={SECTION_TITLES[activeSection]}
          sectionDesc="Field officer portal"
          notifications={assignedIncidents.map(i => ({
            id: i.id,
            type: 'assignment',
            icon: PRIORITY_CONFIG[i.priority]?.icon || '🛡️',
            color: PRIORITY_CONFIG[i.priority]?.bg || '#fef9c3',
            title: `${i.priority || ''}: ${i.title}`,
            subtitle: `📍 ${i.location}`,
            created_at: i.created_at,
            data: i,
          }))}
          searchData={{ incidents, tickets: [], announcements: [] }}
          onNotificationClick={() => setActiveSection('active')}
          onSearchResultClick={() => setActiveSection('active')}
        />

        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          <NotificationBanner />

          {!loading && profile && (
            <div className="max-w-2xl mx-auto mb-4 fade-up">
              <DutyToggle profile={profile} />
            </div>
          )}

          {loading && (
            <div className="space-y-3 fade-up max-w-2xl mx-auto">
              {[...Array(3)].map((_, i) => <CardSkeleton key={i} />)}
            </div>
          )}

          {!loading && activeSection === 'home' && (
            <div className="space-y-6 fade-up max-w-2xl mx-auto">
              <HomeSummary
                greeting={greeting()}
                name={profile?.full_name?.split(' ')[0]}
                summary={brief.text}
                pressing={urgent}
                allClearNote={profile?.on_duty
                  ? 'On duty — you will be told the moment something comes in'
                  : 'Go on duty so the barangay can dispatch to you'}
                onOpen={() => navClick('active')}
              />

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-3 text-white/85">
                  {brief.allClear ? 'Your record' : 'Needs you'}
                </p>
                <TileGrid tiles={tanodTiles} render={(tile, className) => (
                  <ActivityTile {...tile} className={className} />
                )} />
              </div>

              {assignedIncidents.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-white/85">Next up</p>
                    <button onClick={() => navClick('active')}
                      className="text-xs font-semibold text-white/75 hover:text-white transition-colors">
                      View all →
                    </button>
                  </div>
                  <div className="space-y-2">
                    {assignedIncidents.slice(0, 3).map(inc => {
                      const cat = CATEGORY_CONFIG[inc.category] || CATEGORY_CONFIG.Other
                      const standing = computeStanding(inc)
                      const stage = responseStage(inc)
                      return (
                        <RecordCard key={inc.id}
                          tone={standing.aged ? 'overdue' : toneFor(inc.status)}
                          icon={<span aria-hidden="true">{cat.icon}</span>}
                          iconBg={cat.bg}
                          title={inc.title}
                          meta={inc.location ? `📍 ${inc.location}` : 'No location given'}
                          badges={standing.aged
                            ? <Chip bg={STANDING_STYLE[standing.level].bg} color={STANDING_STYLE[standing.level].color}>
                                {standing.label}
                              </Chip>
                            : <Chip bg="#f0effe" color="#5B54E8">{RESPONSE_STEPS[stage]}</Chip>}
                          when={timeAgo(inc.created_at)}
                          onClick={() => navClick('active')}
                          ariaLabel={`${inc.title} — ${RESPONSE_STEPS[stage]}`} />
                      )
                    })}
                  </div>
                </div>
              )}

              {assignedIncidents.length === 0 && (
                <div className="white-card p-8 text-center">
                  <CheckCircle size={40} className="mx-auto text-emerald-300 mb-3" />
                  <p className="font-semibold text-gray-700">All clear!</p>
                  <p className="text-gray-400 text-sm mt-1">No active assignments right now.</p>
                </div>
              )}
            </div>
          )}

          {!loading && activeSection === 'active' && (
            <div className="space-y-4 fade-up max-w-2xl mx-auto">
              {assignedIncidents.length === 0 && (
                <div className="white-card p-10 text-center">
                  <CheckCircle size={40} className="mx-auto text-emerald-300 mb-3" />
                  <p className="font-semibold text-gray-700">All clear!</p>
                  <p className="text-gray-400 text-sm mt-1">No active assignments right now.</p>
                </div>
              )}
              {assignedIncidents.map(inc => {
                const cat = CATEGORY_CONFIG[inc.category] || CATEGORY_CONFIG.Other
                const hasCoords = inc.latitude && inc.longitude
                const standing = computeStanding(inc)
                const stage = responseStage(inc)
                const action = nextAction(inc)
                const stamping = busyStamp === inc.id
                return (
                  <div key={inc.id} className="white-card p-5 pl-6 relative overflow-visible">
                    {/* The rail says how this one stands — priority normally,
                        the aging colour once it is past its response time,
                        which is the more urgent fact while it applies. */}
                    <span className="absolute left-0 top-5 bottom-5 w-1 rounded-r" aria-hidden="true"
                      style={{ background: standing.aged
                        ? STANDING_STYLE[standing.level].color
                        : (PRIORITY_CONFIG[inc.priority]?.color || '#9ca3af') }} />

                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 text-xl" style={{ background: cat.bg }}>
                        {cat.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-gray-800">{inc.title}</h3>
                          {inc.priority && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-bold flex items-center gap-1"
                              style={{
                                background: PRIORITY_CONFIG[inc.priority]?.bg,
                                color: PRIORITY_CONFIG[inc.priority]?.color,
                              }}>
                              <span>{PRIORITY_CONFIG[inc.priority]?.icon}</span> {inc.priority}
                            </span>
                          )}
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                            style={{ background: '#f0effe', color: '#5B54E8' }}>
                            {RESPONSE_STEPS[stage]}
                          </span>
                          {/* The same aging signal the officials' queue
                              shows. The person expected to respond had no
                              way of seeing it. */}
                          {standing.aged && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-bold flex items-center gap-1"
                              style={{
                                background: STANDING_STYLE[standing.level].bg,
                                color: STANDING_STYLE[standing.level].color,
                              }}
                              title={`${inc.priority} reports target ${activeWindowLabel(inc)}.`}>
                              <Clock size={10} /> {standing.label}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-500 text-sm mt-1">{inc.description}</p>
                        <div className="flex items-center gap-1 mt-2 text-gray-400 text-xs">
                          <MapPin size={12} /><span>{inc.location}</span>
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-gray-400 text-xs" title={fullDate(inc.created_at)}>
                          <Clock size={12} />
                          <span>Reported by {inc.profiles?.full_name || 'Unknown'} · {timeAgoLong(inc.created_at)}</span>
                        </div>
                      </div>
                    </div>

                    <IncidentPhoto stored={inc.image_url} alt="Incident evidence"
                      className="block mb-3 rounded-2xl overflow-hidden"
                      imgClassName="w-full max-h-48 object-cover"
                      style={{ border: '1px solid #f0effe' }} />

                    {hasCoords && (
                      <div className="mb-3 relative">
                        <MiniMap lat={inc.latitude} lng={inc.longitude} />
                        <div className="absolute top-2 left-2 px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1"
                          style={{ background: 'rgba(255,255,255,0.95)', color: '#5B54E8', backdropFilter: 'blur(10px)' }}>
                          <MapPin size={10} /> Reported Location
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      {hasCoords && (
                        <div className="relative">
                          <button
                            onClick={() => setDirectionsMenu(directionsMenu === inc.id ? null : inc.id)}
                            aria-expanded={directionsMenu === inc.id}
                            className="w-full py-2.5 rounded-2xl text-xs font-bold transition-all hover:scale-105 flex items-center justify-center gap-1.5"
                            style={{ background: '#f0effe', color: '#5B54E8', border: '1px solid #e8e3ff' }}>
                            <Navigation size={12} /> Navigate
                          </button>
                          {directionsMenu === inc.id && (
                            <>
                              {/* Invisible backdrop: click anywhere else to close */}
                              <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={() => setDirectionsMenu(null)} />
                              <div className="absolute bottom-full left-0 right-0 mb-2 rounded-2xl overflow-hidden fade-up"
                                style={{ background: 'white', boxShadow: '0 16px 48px rgba(91,84,232,0.2)', border: '1px solid #e8e3ff', zIndex: 9999 }}>
                                <button onClick={() => openDirections('google', inc.latitude, inc.longitude)}
                                  className="w-full px-3 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors">
                                  🗺️ Google Maps
                                </button>
                                <button onClick={() => openDirections('waze', inc.latitude, inc.longitude)}
                                  className="w-full px-3 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors border-t border-gray-100">
                                  🚗 Waze
                                </button>
                                <button onClick={() => openDirections('apple', inc.latitude, inc.longitude)}
                                  className="w-full px-3 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors border-t border-gray-100">
                                  🍎 Apple Maps
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      <button onClick={() => callReporter(inc.profiles?.phone)}
                        disabled={!inc.profiles?.phone}
                        title={inc.profiles?.phone || 'No phone number on file'}
                        className="w-full py-2.5 rounded-2xl text-xs font-bold transition-all hover:scale-105 disabled:opacity-40 disabled:hover:scale-100 flex items-center justify-center gap-1.5"
                        style={{ background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa' }}>
                        <Phone size={12} /> Call
                      </button>

                      <button onClick={() => setResolveModal(inc)}
                        className={`w-full py-2.5 rounded-2xl text-xs font-bold transition-all hover:scale-105 flex items-center justify-center gap-1.5 ${!hasCoords && 'col-span-2'}`}
                        style={stage >= 2
                          ? { background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: 'white', boxShadow: '0 4px 16px rgba(34,197,94,0.3)' }
                          : { background: '#f0fdf4', color: '#16a34a', border: '1px solid #dcfce7' }}>
                        <CheckCircle size={12} /> Resolve
                      </button>
                    </div>

                    {/* What to do next, one step at a time. Nothing here
                        existed before — a tanod could only resolve, so the
                        barangay never learned when anyone had seen a report
                        or reached it. */}
                    {action && action.key !== 'resolve' && (
                      <button onClick={() => stampResponse(inc, action.field)}
                        disabled={stamping}
                        className="w-full py-3 rounded-2xl text-sm font-black text-white transition-transform
                          active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
                        style={{
                          background: action.key === 'acknowledge'
                            ? 'linear-gradient(135deg, #5B54E8, #7C75F0)'
                            : 'linear-gradient(135deg, #f59e0b, #d97706)',
                          boxShadow: action.key === 'acknowledge'
                            ? '0 8px 24px rgba(91,84,232,0.35)'
                            : '0 8px 24px rgba(245,158,11,0.35)',
                        }}>
                        {action.key === 'acknowledge'
                          ? <><Navigation size={15} /> {stamping ? 'Saving…' : action.label}</>
                          : <><MapPin size={15} /> {stamping ? 'Saving…' : action.label}</>}
                      </button>
                    )}

                    {/* The trail so far, and how far it has to go. */}
                    <ol className="flex items-center mt-3.5 pt-3.5 border-t" style={{ borderColor: '#f3f4f6' }}>
                      {RESPONSE_STEPS.map((label, i) => {
                        const state = i < stage ? 'done' : i === stage ? 'now' : 'todo'
                        const dot = state === 'done' ? '#10b981' : state === 'now' ? '#5B54E8' : '#e5e7eb'
                        const ink = state === 'done' ? '#047857' : state === 'now' ? '#5B54E8' : '#9ca3af'
                        return (
                          <li key={label} className="contents">
                            {i > 0 && (
                              <span className="flex-1 h-0.5 mx-1.5 rounded-sm min-w-[10px]" aria-hidden="true"
                                style={{ background: i <= stage ? '#10b981' : '#e5e7eb' }} />
                            )}
                            <span className="flex items-center gap-1.5 flex-shrink-0">
                              <span className="w-2 h-2 rounded-full flex-shrink-0" aria-hidden="true"
                                style={{ background: dot, ...(state === 'now' ? { boxShadow: '0 0 0 3px rgba(91,84,232,0.18)' } : {}) }} />
                              <span className={`text-[10.5px] font-semibold ${state === 'now' ? '' : 'hidden sm:inline'}`}
                                style={{ color: ink }}>{label}</span>
                            </span>
                          </li>
                        )
                      })}
                    </ol>
                  </div>
                )
              })}

              {hasMore && (
                <div className="pt-1 pb-2 text-center">
                  <button onClick={loadMore} disabled={loadingMore}
                    className="px-5 py-2.5 rounded-2xl text-xs font-bold disabled:opacity-50"
                    style={{ background: 'white', color: '#5B54E8', border: '1px solid #e8e3ff' }}>
                    {loadingMore ? 'Loading…' : 'Load older assignments'}
                  </button>
                </div>
              )}
            </div>
          )}

          {!loading && activeSection === 'resolved' && (
            <div className="space-y-3 fade-up max-w-2xl mx-auto">
              {resolvedIncidents.length === 0 && (
                <div className="white-card p-10 text-center">
                  <p className="text-gray-400 text-sm">No resolved incidents yet.</p>
                </div>
              )}
              <RecordGroup label="Resolved" count={resolvedIncidents.length}>
                {resolvedIncidents.map(inc => {
                  const cat = CATEGORY_CONFIG[inc.category] || CATEGORY_CONFIG.Other
                  return (
                    <div key={inc.id} className="space-y-2">
                      <RecordCard
                        tone="done"
                        icon={<span aria-hidden="true">{cat.icon}</span>}
                        iconBg="#f3f4f6"
                        title={inc.title}
                        meta={inc.location ? `📍 ${inc.location}` : 'No location given'}
                        badges={inc.rating
                          ? <Chip bg="#fffbeb" color="#b45309">★ {inc.rating}</Chip>
                          : <Chip bg="#d1fae5" color="#047857">Resolved</Chip>}
                        when={timeAgo(inc.resolved_at || inc.created_at)}
                        ariaLabel={`${inc.title} — resolved`} />

                      {/* What the tanod wrote and photographed is the record
                          of the job, so it stays visible rather than moving
                          behind a tap. */}
                      {(inc.resolution_notes || inc.resolution_image_url) && (
                        <div className="ml-[22px] px-3 py-2.5 rounded-xl flex items-start gap-2.5"
                          style={{ background: '#f0fdf4', border: '1px solid #dcfce7' }}>
                          <FileText size={12} className="text-emerald-600 mt-0.5 flex-shrink-0" aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            {inc.resolution_notes && (
                              <p className="text-[11.5px] text-emerald-900 leading-relaxed">{inc.resolution_notes}</p>
                            )}
                            <IncidentPhoto stored={inc.resolution_image_url} alt="Resolution proof"
                              className="block mt-2 rounded-lg overflow-hidden"
                              imgClassName="w-full max-h-28 object-cover"
                              style={{ border: '1px solid #dcfce7', maxWidth: '180px' }} />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </RecordGroup>
            </div>
          )}

          {!loading && activeSection === 'stats' && (
            <div className="space-y-6 fade-up max-w-3xl mx-auto">
              <div className="white-card p-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#5B54E8' }}>Performance Dashboard</p>
                  <h2 className="text-2xl font-bold text-gray-800" style={{ letterSpacing: '-0.5px' }}>Your Impact 🏆</h2>
                  <p className="text-gray-400 text-sm mt-1">Keep up the great work, {profile?.full_name?.split(' ')[0]}!</p>
                </div>
                <div className="w-16 h-16 rounded-3xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 8px 24px rgba(34,197,94,0.4)' }}>
                  <Award size={28} className="text-white" />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Each of these now says what it measures. "Avg Response"
                    used to be resolved_at - created_at — the time to finish
                    the job, presented as the time to answer the call — and
                    every average carries the sample it came from, because
                    the stamps only start existing now. */}
                {[
                  { label: 'Resolved, all time', value: stats.resolvedTotal, note: `${stats.resolutionRate}% of what you were sent`, icon: CheckCircle, color: '#22c55e', bg: '#f0fdf4' },
                  { label: 'Resolved this month', value: stats.resolvedThisMonth, note: 'since the 1st', icon: Zap, color: '#f97316', bg: '#fff7ed' },
                  { label: 'Time to respond', value: stats.respond.label || 'N/A', note: stats.respond.sample ? `over ${stats.respond.sample} report${stats.respond.sample === 1 ? '' : 's'}` : 'nothing acknowledged yet', icon: Clock, color: '#3b82f6', bg: '#eff6ff' },
                  { label: 'Rating from residents', value: stats.avgRating ? `${stats.avgRating}★` : 'N/A', note: stats.ratedCount ? `from ${stats.ratedCount} rating${stats.ratedCount === 1 ? '' : 's'}` : 'not rated yet', icon: Star, color: '#f59e0b', bg: '#fffbeb' },
                ].map(({ label, value, note, icon: Icon, color, bg }) => (
                  <div key={label} className="white-card p-4">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-3" style={{ background: bg }}>
                      <Icon size={18} style={{ color }} />
                    </div>
                    <p className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</p>
                    <p className="text-xs font-semibold text-gray-700 mt-1">{label}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: '#9ca3af' }}>{note}</p>
                  </div>
                ))}
              </div>

              {/* The two halves of a response, which nobody could see
                  before because neither was being recorded. */}
              <div className="grid grid-cols-2 gap-3">
                <div className="white-card p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#9ca3af' }}>Travel time</p>
                  <p className="text-xl font-bold text-gray-800 mt-1 tabular-nums">{stats.travel.label || 'N/A'}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: '#9ca3af' }}>
                    {stats.travel.sample ? `acknowledged to on scene, over ${stats.travel.sample}` : 'no arrivals recorded yet'}
                  </p>
                </div>
                <div className="white-card p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#9ca3af' }}>Start to finish</p>
                  <p className="text-xl font-bold text-gray-800 mt-1 tabular-nums">{stats.resolve.label || 'N/A'}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: '#9ca3af' }}>
                    {stats.resolve.sample ? `reported to resolved, over ${stats.resolve.sample}` : 'nothing resolved yet'}
                  </p>
                </div>
              </div>

              {/* Resolution Rate */}
              <div className="white-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-gray-800 text-sm">Resolution Rate</h3>
                    <p className="text-xs text-gray-400">Percentage of incidents you've resolved</p>
                  </div>
                  <p className="text-3xl font-black" style={{ color: stats.resolutionRate >= 80 ? '#22c55e' : stats.resolutionRate >= 50 ? '#f97316' : '#ef4444' }}>
                    {stats.resolutionRate}%
                  </p>
                </div>
                <div className="relative h-3 rounded-full overflow-hidden" style={{ background: '#f3f4f6' }}>
                  <div className="absolute inset-y-0 left-0 transition-all duration-1000 rounded-full"
                    style={{
                      width: `${stats.resolutionRate}%`,
                      background: stats.resolutionRate >= 80
                        ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                        : stats.resolutionRate >= 50
                        ? 'linear-gradient(90deg, #f97316, #ea580c)'
                        : 'linear-gradient(90deg, #ef4444, #dc2626)',
                    }} />
                </div>
                <div className="flex items-center gap-2 mt-3 text-xs">
                  <span className="text-gray-400">{resolvedIncidents.length} of {stats.totalAssigned} incidents resolved</span>
                </div>
              </div>

              {/* Badges/Achievements with progress toward locked ones */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-3 text-white opacity-60">Achievements</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {ACHIEVEMENTS.map(badge => {
                    const current = badge.type === 'count' ? resolvedIncidents.length : stats.resolutionRate
                    const unlocked = badge.type === 'count'
                      ? current >= badge.target
                      : current >= badge.target && stats.totalAssigned >= 5
                    const progress = Math.min((current / badge.target) * 100, 100)
                    return (
                      <div key={badge.title} className={`white-card p-4 text-center transition-all ${unlocked ? '' : 'opacity-60'}`}>
                        <div className={`text-3xl mb-2 ${unlocked ? '' : 'grayscale opacity-60'}`}>{badge.icon}</div>
                        <p className="text-xs font-bold text-gray-800">{badge.title}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{badge.desc}</p>
                        {unlocked ? (
                          <div className="mt-2 inline-block px-2 py-0.5 rounded-full text-[9px] font-bold"
                            style={{ background: '#f0fdf4', color: '#16a34a' }}>
                            UNLOCKED
                          </div>
                        ) : (
                          <div className="mt-2">
                            <div className="relative h-1 rounded-full overflow-hidden mx-auto" style={{ background: '#f3f4f6', maxWidth: '80px' }}>
                              <div className="absolute inset-y-0 left-0 rounded-full"
                                style={{ width: `${progress}%`, background: '#a78bfa' }} />
                            </div>
                            <p className="text-[9px] text-gray-400 mt-1">
                              {badge.type === 'count' ? `${current}/${badge.target}` : `${current}% of ${badge.target}%`}
                            </p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Recent Ratings */}
              {recentRatings.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-white opacity-60">Recent Ratings</p>
                    {stats.avgRating && (
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full"
                        style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)' }}
                        title={`Average of all ${stats.ratedCount} rating${stats.ratedCount === 1 ? '' : 's'}`}>
                        <Star size={12} className="text-white fill-white" />
                        <span className="text-xs font-bold text-white">{stats.avgRating} / 5.0</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    {recentRatings.map(inc => {
                      const cat = CATEGORY_CONFIG[inc.category] || CATEGORY_CONFIG.Other
                      return (
                        <div key={inc.id} className="white-card p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 text-base" style={{ background: cat.bg }}>
                              {cat.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <p className="text-sm font-bold text-gray-800 truncate">{inc.title}</p>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <div className="flex gap-0.5">
                                    {[1, 2, 3, 4, 5].map(s => (
                                      <Star key={s} size={11} fill={s <= inc.rating ? '#f59e0b' : 'none'} color={s <= inc.rating ? '#f59e0b' : '#d1d5db'} />
                                    ))}
                                  </div>
                                  <span className="text-xs font-bold text-amber-700">{inc.rating}.0</span>
                                </div>
                              </div>
                              {inc.rating_feedback ? (
                                <p className="text-xs text-gray-500 italic">"{inc.rating_feedback}"</p>
                              ) : (
                                <p className="text-xs text-gray-300">No written feedback</p>
                              )}
                              <p className="text-[10px] text-gray-400 mt-1">
                                From {inc.profiles?.full_name || 'a resident'} · {timeAgo(inc.rated_at || inc.resolved_at)}
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

        </main>
      </div>

      <ResolveModal
        open={!!resolveModal}
        onClose={() => setResolveModal(null)}
        onResolve={handleResolve}
        incident={resolveModal}
        userId={profile?.id}
      />
    </div>
  )
}