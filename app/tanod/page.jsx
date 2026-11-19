'use client'
import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { DashboardShellSkeleton } from '@/components/Skeletons'
import ClientBoundary from '@/components/ClientBoundary'
import DashboardBackdrop from '@/components/DashboardBackdrop'
import { DASHBOARD_SKELETONS } from '@/lib/dashboardSkeletons'
import { useSectionEntrance } from '@/lib/useSectionEntrance'
import SectionContent from '@/components/SectionContent'
import { useUrlSection } from '@/lib/useUrlSection'
import { useRouter } from 'next/navigation'
import { loginHref } from '@/lib/loginRedirect'
import { createClient } from '@/lib/supabase'
import { CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import DashboardHeader from '@/components/DashboardHeader'
import DashboardSidebar from '@/components/DashboardSidebar'
import DashboardFrame from '@/components/crafted/DashboardFrame'
import TabBar from '@/components/crafted/TabBar'
import { HomeIcon, IncidentsIcon, PerformanceIcon } from '@/components/icons/BhIcons'
import ResolveModal from '@/components/ResolveModal'
import DutyToggle from '@/components/DutyToggle'
import DutyScheduleSummary from '@/components/DutyScheduleSummary'
import { timeAgo } from '@/lib/timeAgo'
import NotificationBanner from '@/components/NotificationBanner'
import CriticalAlert from '@/components/CriticalAlert'
import { playSiren } from '@/lib/audioAlert'
import { notifyNewAssignment, notifyNewAnnouncement } from '@/lib/notifications'
import { notify } from '@/components/Toast'
import { greeting } from '@/lib/homeSummary'
import { KINDS } from '@/lib/offline/outbox'
import { enqueue, drainOutbox } from '@/lib/offline/sync'
import * as snapshot from '@/lib/offline/snapshot'
import { useSidebarState } from '@/lib/useSidebarState'
import { useUrlParam } from '@/lib/useUrlParam'
import { useNow } from '@/lib/useNow'
import { Card, CardHead } from '@/components/ui/card'
import { Rows, Row, RowTitle } from '@/components/ui/table'
import { Tag, Status } from '@/components/ui/tag'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { StatStrip } from '@/components/ui/stat-strip'
import { Notice } from '@/components/ui/notice'
import { Muted } from '@/components/ui/text'
import {
  AssignmentHero, UpNextCard, AssignmentList, DoneList, AssignmentPanel, HandledChart, ByTypeCard,
} from '@/components/tanod/TanodSections'
import { useNotifications } from '@/lib/useNotifications'
import { isPhoneLayout } from '@/lib/layout'
import { useLiveAnnouncements } from '@/lib/useLiveAnnouncements'
import { subscribeWhenSignedIn } from '@/lib/realtime'
import {
  byUrgency, overdueAssignments,
  tanodSummary, tanodStats, handledByDay, resolvedByCategory,
} from '@/lib/tanod'



const PAGE_SIZE = 50
const INCIDENT_SELECT = '*, profiles!incidents_reported_by_fkey(full_name, phone)'
const SEEN_ALERTS_KEY = 'bh360-tanod-alerts-seen'

// Incident photos live in a private bucket, so the URL has to be signed
// per viewer. Opening in a new tab still works — the signed URL carries its
// own token and expires on its own.
const SECTION_TITLES = {
  home: 'Duty',
  active: 'Assigned to me',
  resolved: 'Assigned to me',
  stats: 'My performance',
}
const SECTION_SUBS = {
  home: 'Your duty and what is assigned to you',
  active: 'Worst first, then the one waiting longest',
  resolved: 'What you have closed, with your notes',
  stats: 'How you are doing, from your own reports',
}

const ACHIEVEMENTS = [
  { icon: '🎯', title: 'First Resolution', desc: 'Resolve your first incident', target: 1, type: 'count' },
  { icon: '⭐', title: 'Rising Star', desc: 'Resolve 10 incidents', target: 10, type: 'count' },
  { icon: '🏆', title: 'Champion', desc: 'Resolve 50 incidents', target: 50, type: 'count' },
  { icon: '💎', title: 'Excellence', desc: '90% resolution rate', target: 90, type: 'rate' },
]


// Which placeholder each section shows while its data loads.
// Sections, and the placeholder each shows while loading: lib/dashboardSkeletons.js
const { kinds: TANOD_SKELETONS, fallback: TANOD_HOME } = DASHBOARD_SKELETONS['/tanod']
const TANOD_SECTIONS = Object.keys(TANOD_SKELETONS)

function TanodDashboard() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [profile, setProfile] = useState(null)
  // What the database writes for this tanod (supabase/setup.sql Section
  // 18). Dispatches already raise the alert below, so the hook stays quiet
  // for those and the bell keeps the record.
  const notificationCenter = useNotifications(profile?.id, { silentTypes: ['incident_assigned'] })
  const [incidents, setIncidents] = useState([])
  const [activeSection, setActiveSection] = useUrlSection(TANOD_SECTIONS, TANOD_HOME)
  // T03: the assignment panel, in the URL so the phone's Back closes it.
  const [assignmentId, openAssignment, closeAssignment] = useUrlParam('assignment')
  const now = useNow()
  // Open state, remembered on desktop, closed on phones (lib/useSidebarState)
  const [sidebarOpen, setSidebarOpen] = useSidebarState(true)
  const [loading, setLoading] = useState(true)
  const [resolveModal, setResolveModal] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  // The refetch on tab focus must not silently shrink a list the tanod has
  // already paged through.
  const pageSizeRef = useRef(PAGE_SIZE)
  const [busyStamp, setBusyStamp] = useState(null)

  // Critical assignments this tanod has already acknowledged on this device.
  // acknowledged_at alone can't say that: an official acknowledging the
  // report on their own dashboard stamps it too, and the tanod still has
  // to be told. Kept per device, so a reload doesn't sound the siren again.
  const [seenAlerts, setSeenAlerts] = useState(() => {
    if (typeof window === 'undefined') return new Set()
    try { return new Set(JSON.parse(localStorage.getItem(SEEN_ALERTS_KEY) || '[]')) } catch { return new Set() }
  })
  const [staleSince, setStaleSince] = useState(null)

  // Mirror of incident ids, so the realtime handler can tell "new to me"
  // apart from "update to something I already have" without relying on
  // payload.old (which is empty unless the table has REPLICA IDENTITY FULL)
  const incidentIdsRef = useRef(new Set())
  useEffect(() => {
    incidentIdsRef.current = new Set(incidents.map(i => i.id))
  }, [incidents])


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
          router.replace(loginHref())
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
          // Offline, this is the first thing to fail — and returning here
          // meant the snapshot below never ran, so a tanod with no signal
          // got "please refresh" and a blank page instead of the
          // assignments already on their phone.
          const cachedProfile = await snapshot.load(user.id, 'profile')
          if (cachedProfile?.rows?.[0]) {
            setProfile(cachedProfile.rows[0])
            const cachedIncidents = await snapshot.load(user.id, 'incidents')
            if (cachedIncidents) {
              setIncidents(cachedIncidents.rows)
              setStaleSince(cachedIncidents.savedAt)
            }
            setHasMore(false)
            setLoading(false)
            return
          }
          console.error('Could not load your profile:', profError)
          toast.error('Could not load your profile. Please refresh.')
          setLoading(false)
          return
        }
        if (prof?.role !== 'tanod') {
          router.replace(loginHref())
          return
        }
        setProfile(prof)
        // Kept so the next load with no signal has something to render.
        snapshot.save(user.id, 'profile', [prof])

        try {
          const { rows, hasMore } = await fetchIncidents(user.id)
          if (cancelled) return
          setIncidents(rows)
          setHasMore(hasMore)
          setStaleSince(null)
          snapshot.save(user.id, 'incidents', rows)
        } catch (loadErr) {
          // No signal, or the request failed. Show what was last loaded
          // rather than an empty page — and say when it is from, so nobody
          // reads month-old assignments as today's.
          const cached = await snapshot.load(user.id, 'incidents')
          if (cancelled) return
          if (!cached) throw loadErr
          setIncidents(cached.rows)
          setHasMore(false)
          setStaleSince(cached.savedAt)
        }
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

  // Anything queued in a previous session goes out as soon as this one has
  // a profile to send it as.
  useEffect(() => {
    if (!profile?.id) return
    drainOutbox(profile.id)
  }, [profile?.id])

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

  // Barangay announcements reach tanods live too.
  useLiveAnnouncements(supabase, profile?.barangay_id, (row) => {
    const text = row.content || ''
    notify.info({
      kind: 'Announcement',
      title: row.title,
      body: text.length > 140 ? `${text.slice(0, 140)}…` : text,
    })
    notifyNewAnnouncement(row)
  })

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
            // The blocking alert (CriticalAlert below) takes it from here:
            // siren, flashing title and a system notification, the same as
            // the officials get.
            return
          } else if (data.priority === 'High') {
            playSiren()
            notify.critical({
              kind: `High priority · ${data.category || 'Assignment'}`,
              title: data.title,
              body: data.location,
              id: toastId,
              action: { label: 'Open', onClick: () => setActiveSection('active') },
            })
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
    const leaveIncidentChannel = subscribeWhenSignedIn(supabase, incidentChannel)

    return () => {
      leaveIncidentChannel()
    }
  }, [profile?.id, supabase, setActiveSection])

  // Stable, so the home tiles that call it are not rebuilt every render.
  const navClick = useCallback((key) => {
    setActiveSection(key)
    if (isPhoneLayout()) setSidebarOpen(false)
  }, [setSidebarOpen, setActiveSection])

  // Sections share one scrolling <main>; start each one at the top.
  const mainRef = useRef(null)
  useEffect(() => { mainRef.current?.scrollTo({ top: 0 }) }, [activeSection])

  // Each section gets its own browser-tab title (history entries, tab strip).
  useEffect(() => { document.title = `${SECTION_TITLES[activeSection] || 'Dashboard'} · BH360` }, [activeSection])

  /**
   * Record having seen an assignment, or having reached it.
   *
   * The value sent is only a request — stamp_incident_response() in the
   * database decides what the time says and whose name is on it, so a
   * response time cannot be edited after the fact.
   */
  async function acknowledgeAlert(incident) {
    setSeenAlerts(prev => {
      const next = new Set(prev).add(incident.id)
      try { localStorage.setItem(SEEN_ALERTS_KEY, JSON.stringify([...next].slice(-200))) } catch { /* private mode */ }
      return next
    })
    // Records "seen" with the server's clock — unless an official already
    // stamped it, in which case the database keeps the first stamp anyway.
    if (!incident.acknowledged_at) await stampResponse(incident, 'acknowledged_at')
  }

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
      // The tap is not lost. A tanod standing in a dead spot is exactly who
      // this is for, so it goes in the outbox and syncs when signal returns.
      const kind = field === 'arrived_at' ? KINDS.ARRIVE : KINDS.ACKNOWLEDGE
      const queued = await enqueue(kind,
        { id: incident.id, queuedAt: new Date().toISOString() },
        { userId: profile?.id })

      if (!queued) {
        console.error('Could not record response, and could not queue it:', error)
        toast.error('Could not save that, and this browser will not let it be held. Try again with a signal.')
        return
      }

      // Show it locally so the card moves on. The database has the last
      // word when this syncs — its own stamp is what counts.
      setIncidents(prev => prev.map(i => (i.id === incident.id
        ? { ...i, [field]: new Date().toISOString(), queuedOffline: true }
        : i)))
      notify.info({
        kind: 'Saved for later',
        title: incident.title,
        body: 'No signal — this will be sent the moment you are back online.',
        id: `queued-${incident.id}-${field}`,
      })
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
      // A resolution written in the field is worth holding onto. Only the
      // row is queued — a photo that never uploaded cannot be replayed from
      // here, so the modal stays open when there is one.
      if (imageUrl) {
        toast.error('Could not save. The photo needs a connection — try again when you have one.')
        return
      }
      const queued = await enqueue(KINDS.RESOLVE,
        { id: incidentId, notes, imageUrl: null, resolvedAt },
        { userId: profile?.id })
      if (!queued) {
        toast.error('Failed to save resolution. Please try again.')
        return
      }
      setIncidents(prev => prev.map(i =>
        i.id === incidentId
          ? { ...i, status: 'resolved', resolution_notes: notes, resolved_at: resolvedAt, queuedOffline: true }
          : i
      ))
      setResolveModal(null)
      notify.info({
        kind: 'Saved for later',
        title: 'Resolution held',
        body: 'No signal — it will be sent the moment you are back online.',
        id: `queued-resolve-${incidentId}`,
      })
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

  const recentRatings = useMemo(
    () => resolvedIncidents.filter(i => i.rating).slice(0, 5),
    [resolvedIncidents]
  )

  // The tanod's sidebar on desktop (phones use the tab bar: Duty ·
  // Assigned · Stats). Resolved is reached from Assigned.
  const navItems = [
    { section: 'MAIN', items: [
      { key: 'home', label: 'Duty', icon: HomeIcon },
      { key: 'active', label: 'Assigned', icon: IncidentsIcon, count: assignedIncidents.length, hasNew: assignedIncidents.length > 0 },
      { key: 'resolved', label: 'Done', icon: CheckCircle },
      { key: 'stats', label: 'Stats', icon: PerformanceIcon },
    ]},
  ]

  // Sections animate in when the user switches to one — not when the page
  // first loads (lib/useSectionEntrance.js).
  const entering = useSectionEntrance(activeSection, !loading)

  // While loading, the same frame the static HTML showed before JavaScript
  // ran — now with the real sidebar width and banner — so a refresh shows
  // one skeleton throughout, then the content in its place.
  if (loading) {
    return (
      <DashboardShellSkeleton path="/tanod" kind={TANOD_SKELETONS[activeSection]} section={activeSection}
        sidebarOpen={sidebarOpen} banner={<NotificationBanner />} />
    )
  }

  const column = activeSection === 'stats' ? 'max-w-3xl' : 'max-w-2xl'
  const hero = assignedIncidents[0] || null
  const todayLabel = new Date(now).toLocaleDateString('en-PH', { weekday: 'long', month: 'short', day: 'numeric' })
  const assigned = activeSection === 'active' || activeSection === 'resolved'
  const handlers = {
    busy: hero ? busyStamp === hero.id : false,
    onOpen: inc => openAssignment(inc.id),
    onStamp: (inc, field) => stampResponse(inc, field),
    onResolve: inc => setResolveModal(inc),
    onDirections: openDirections,
  }

  // What sits on the band under the title, per section (T01, T02, T06).
  const bandSlot = activeSection === 'home' ? (
    <div className="flex flex-col gap-3.5">
      <DutyToggle profile={profile} />
      {hero ? (
        <AssignmentHero inc={hero} {...handlers} />
      ) : (
        <Card lift className="px-[18px] py-3.5">
          <Status tone="ok">All clear</Status>
          <p className="mt-1 text-[15px] font-bold text-ink">{brief.text}</p>
          <Muted className="mt-0.5">{profile?.on_duty ? 'You will be told the moment something comes in.' : 'Go on duty so the barangay can dispatch to you.'}</Muted>
        </Card>
      )}
    </div>
  ) : assigned ? (
    <Segmented onBand full label="Assigned to me" value={activeSection} onChange={key => setActiveSection(key, { replace: true })}
      items={[{ value: 'active', label: 'Active', count: assignedIncidents.length }, { value: 'resolved', label: 'Done', count: resolvedIncidents.length }]} />
  ) : activeSection === 'stats' ? (
    <StatStrip className="sm:grid-flow-row sm:grid-cols-4" stats={[
      { label: 'Resolved', value: stats.resolvedThisMonth, note: `this month · ${stats.resolvedTotal} in all` },
      { label: 'Avg. response', value: stats.respond.label || '—', note: stats.respond.sample ? `over ${stats.respond.sample} report${stats.respond.sample === 1 ? '' : 's'}` : 'nothing yet' },
      { label: 'Resolved rate', value: stats.totalAssigned ? `${stats.resolutionRate}%` : '—', note: stats.totalAssigned ? `of ${stats.totalAssigned} assigned` : 'nothing assigned yet' },
      { label: 'Resident rating', value: stats.avgRating ? `${stats.avgRating} / 5` : '—', note: stats.ratedCount ? `${stats.ratedCount} rating${stats.ratedCount === 1 ? '' : 's'}` : 'no ratings yet' },
    ]} />
  ) : null

  const openInc = assignmentId ? incidents.find(i => i.id === assignmentId) : null

  return (
    <>
      <DashboardFrame mainRef={mainRef} sidebarOpen={sidebarOpen}
        tabBar={<TabBar role="tanod" activeSection={activeSection} onSelect={setActiveSection} />}
        sidebar={<DashboardSidebar
        profile={profile}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        roleLabel="Tanod"
        navItems={navItems}
      />}
        header={<DashboardHeader
          profile={profile}
          columnClass={column}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          sectionTitle={SECTION_TITLES[activeSection]}
          sectionDesc={SECTION_SUBS[activeSection]}
          phoneTitle={activeSection === 'home' ? `Tanod${profile?.barangays?.name ? ` · ${profile.barangays.name}` : ''}` : SECTION_TITLES[activeSection]}
          heading={activeSection === 'home' ? (
            <>
              <p className="text-xs font-bold tracking-[0.08em] text-white/75 uppercase">{todayLabel}</p>
              <h1 className="mt-1.5 text-[26px] font-extrabold leading-tight tracking-[-0.6px] text-white">
                {greeting()}{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}.
              </h1>
            </>
          ) : undefined}
          notificationCenter={notificationCenter}
          searchData={{ incidents, tickets: [], announcements: [] }}
          onSearchResultClick={(type, item) => openAssignment(item.id)}>
          {bandSlot && <div className="band-slot">{bandSlot}</div>}
        </DashboardHeader>}>

          <div className="mx-auto w-full max-w-[100rem]">
          <div className={`${column} mx-auto`}><NotificationBanner /></div>

          {/* Keyed on the section: switching sections remounts it, which
              eases the new section in (only after a switch — see `entering`
              above and components/SectionContent.jsx). */}
          <SectionContent key={activeSection} entering={entering}>
          {staleSince && (
            <Notice tone="info" className={`${column} mx-auto mb-3.5`}>
              Showing what was last loaded, as of {snapshot.asOf(staleSince)}.
            </Notice>
          )}

          {activeSection === 'home' && (
            <div className="mx-auto flex max-w-2xl flex-col gap-3.5">
              <UpNextCard items={assignedIncidents.slice(1, 4)} now={now} onOpen={handlers.onOpen} onSeeAll={() => navClick('active')} />
              <StatStrip lift={false} stats={[
                { label: 'Not opened yet', value: unacknowledged, tone: unacknowledged ? 'danger' : 'default', note: `${assignedIncidents.length} assigned` },
                { label: 'Past their time', value: overdue.length, tone: overdue.length ? 'danger' : 'default', note: overdue.length ? 'respond when you can' : 'all within target' },
                { label: 'Avg. response', value: stats.respond.label || '—', note: 'to the first response' },
              ]} className="grid-cols-3 sm:grid-flow-row sm:grid-cols-3" />
              <DutyScheduleSummary profile={profile} />
            </div>
          )}

          {activeSection === 'active' && (
            <div className="mx-auto flex max-w-2xl flex-col gap-3.5">
              <AssignmentList items={assignedIncidents} now={now} onOpen={handlers.onOpen}
                empty={profile?.on_duty ? 'New assignments show up here the moment the barangay dispatches you.' : 'Go on duty from the Duty tab so the barangay can dispatch to you.'} />
              {hasMore && (
                <Button variant="secondary" className="self-center" onClick={loadMore} disabled={loadingMore} aria-busy={loadingMore || undefined}>
                  {loadingMore ? 'Loading…' : 'Load older assignments'}
                </Button>
              )}
            </div>
          )}

          {activeSection === 'resolved' && (
            <div className="mx-auto flex max-w-2xl flex-col gap-3.5">
              <DoneList items={resolvedIncidents} onOpen={handlers.onOpen} />
              {hasMore && (
                <Button variant="secondary" className="self-center" onClick={loadMore} disabled={loadingMore} aria-busy={loadingMore || undefined}>
                  {loadingMore ? 'Loading…' : 'Load older'}
                </Button>
              )}
            </div>
          )}

          {activeSection === 'stats' && (
            <div className="mx-auto flex max-w-3xl flex-col gap-3.5">
              <HandledChart days={handledByDay(incidents, 7, now)} />
              <ByTypeCard rows={resolvedByCategory(incidents)} />

              {/* How fast, in three parts, each with the sample it came from. */}
              <Card>
                <CardHead title="How fast" sub="Averages over your reports" />
                <Rows className="border-t border-line">
                  {[
                    ['To respond', 'from the report to your first response', stats.respond],
                    ['To get there', 'from responding to arriving', stats.travel],
                    ['To resolve', 'from the report to resolved', stats.resolve],
                  ].map(([label, sub, s]) => (
                    <Row key={label} className="flex items-center gap-3">
                      <RowTitle className="flex-1" title={label} sub={`${sub}${s.sample ? ` · ${s.sample} report${s.sample === 1 ? '' : 's'}` : ''}`} />
                      <span className="text-[15px] font-extrabold text-ink tabular-nums">{s.label || '—'}</span>
                    </Row>
                  ))}
                </Rows>
              </Card>

              <Card>
                <CardHead title="Milestones" />
                <Rows className="border-t border-line">
                  {ACHIEVEMENTS.map(badge => {
                    const progress = badge.type === 'count' ? stats.resolvedTotal : stats.resolutionRate
                    const unlocked = progress >= badge.target
                    return (
                      <Row key={badge.title} className="flex items-center gap-3">
                        <RowTitle className="flex-1" title={badge.title} sub={badge.desc} />
                        {unlocked
                          ? <Status tone="ok">Reached</Status>
                          : <span className="text-xs font-bold text-muted-foreground tabular-nums">{badge.type === 'count' ? `${Math.min(progress, badge.target)} of ${badge.target}` : `${progress}% of ${badge.target}%`}</span>}
                      </Row>
                    )
                  })}
                </Rows>
              </Card>

              {recentRatings.length > 0 && (
                <Card>
                  <CardHead title="Recent ratings" action={stats.avgRating && <span className="text-xs font-bold text-muted-foreground">{stats.avgRating} / 5 average</span>} />
                  <Rows className="border-t border-line">
                    {recentRatings.map(inc => (
                      <Row key={inc.id} className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-ink">{inc.title}</p>
                          <p className="mt-0.5 text-[13px] text-body">{inc.rating_feedback ? <>&ldquo;{inc.rating_feedback}&rdquo;</> : 'No written feedback'}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">From {inc.profiles?.full_name || 'a resident'} · {timeAgo(inc.rated_at || inc.resolved_at)}</p>
                        </div>
                        <Tag tone="warn" className="shrink-0">{inc.rating} / 5</Tag>
                      </Row>
                    ))}
                  </Rows>
                </Card>
              )}
            </div>
          )}

          </SectionContent>
          </div>
      </DashboardFrame>

      {/* T03: the assignment, full screen; Back closes it (?assignment=). */}
      {openInc && (
        <AssignmentPanel inc={openInc} now={now} busy={busyStamp === openInc.id}
          onClose={closeAssignment}
          onStamp={(inc, field) => stampResponse(inc, field)}
          onResolve={inc => setResolveModal(inc)}
          onDirections={openDirections}
          onCall={callReporter} />
      )}

      <CriticalAlert
        audience="tanod"
        incidents={incidents}
        isPending={(i) => i.priority === 'Critical' && i.status === 'assigned' && !i.arrived_at
          && i.acknowledged_by !== profile?.id && !seenAlerts.has(i.id)}
        onAcknowledge={acknowledgeAlert}
        onView={() => setActiveSection('active')}
      />

      <ResolveModal
        open={!!resolveModal}
        onClose={() => setResolveModal(null)}
        onResolve={handleResolve}
        incident={resolveModal}
        userId={profile?.id}
      />
    </>
  )
}

/**
 * The section lives in the URL (?section=…), read with useSearchParams, and
 * the sidebar width in localStorage — see components/ClientBoundary.jsx.
 * The fallback is the static loading frame; the backdrop sits outside the
 * boundary so it is drawn once and never restarts.
 */
export default function TanodDashboardPage() {
  return (
    <>
      <DashboardBackdrop />
      <ClientBoundary fallback={<DashboardShellSkeleton path="/tanod" />}>
        <TanodDashboard />
      </ClientBoundary>
    </>
  )
}
