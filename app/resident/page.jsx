'use client'
import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { DashboardShellSkeleton } from '@/components/Skeletons'
import ClientBoundary from '@/components/ClientBoundary'
import DashboardBackdrop from '@/components/DashboardBackdrop'
import { DASHBOARD_SKELETONS, dashboardColumn } from '@/lib/dashboardSkeletons'
import { useSectionEntrance } from '@/lib/useSectionEntrance'
import SectionContent from '@/components/SectionContent'
import { useUrlSection } from '@/lib/useUrlSection'
import { useRouter } from 'next/navigation'
import { loginHref } from '@/lib/loginRedirect'
import { createClient } from '@/lib/supabase'
import { ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import DashboardHeader from '@/components/DashboardHeader'
import DashboardSidebar from '@/components/DashboardSidebar'
import DashboardFrame from '@/components/crafted/DashboardFrame'
import TabBar from '@/components/crafted/TabBar'
import { ReportRows, TicketRows, DocumentRows, AnnouncementRows, CaseCard, PressingCard, HomeLinks, HomeHotlines, BandAction } from '@/components/resident/ResidentSections'
import { Card } from '@/components/ui/card'
import { Rows, Row } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/notice'
import { Segmented } from '@/components/ui/segmented'
import { SectionLabel, Muted } from '@/components/ui/text'
import { AiIcon, AnnouncementsIcon, BlotterIcon, DocumentsIcon, HomeIcon, IncidentsIcon, TicketsIcon } from '@/components/icons/BhIcons'
import { timeAgoLong, fullDate } from '@/lib/timeAgo'
import RatingModal from '@/components/RatingModal'
import NotificationBanner from '@/components/NotificationBanner'
import { notifyNewAnnouncement, notifyStatusUpdate } from '@/lib/notifications'
import { greeting, activityCounts, summarySentence, mostPressing } from '@/lib/homeSummary'
import { partitionByLiveness } from '@/lib/recordState'
import { useNotifications } from '@/lib/useNotifications'
import { notify } from '@/components/Toast'
import { firstRealError } from '@/lib/dbError'
import { deadlineState, formatDeadline } from '@/lib/documents'
import { canRequestDocuments, documentBlockReason, verificationStyle, isVerified } from '@/lib/verification'
import { isOpen as caseIsOpen } from '@/lib/katarungan'
import { useNow } from '@/lib/useNow'
import { useSidebarState } from '@/lib/useSidebarState'
import { isPhoneLayout } from '@/lib/layout'
import { useLiveAnnouncements } from '@/lib/useLiveAnnouncements'
import { subscribeWhenSignedIn } from '@/lib/realtime'

const sectionTitle = {
  home: 'Home', announcements: 'Announcements',
  incidents: 'My reports', tickets: 'My tickets',
  documents: 'My documents', blotter: 'My cases', ai: 'AI Assistant',
}

// The line under the title on desktop.
const sectionSub = {
  announcements: 'News, alerts and events from your barangay',
  incidents: 'Your reports and where they stand',
  tickets: 'Your conversations with barangay officials',
  documents: 'Clearances and certificates',
  blotter: 'Katarungang Pambarangay',
  ai: 'Quick answers about barangay services',
}

// Sections, and the placeholder each shows while loading: lib/dashboardSkeletons.js
const { kinds: RESIDENT_SKELETONS, fallback: RESIDENT_HOME } = DASHBOARD_SKELETONS['/resident']
const RESIDENT_SECTIONS = Object.keys(RESIDENT_SKELETONS)

function ResidentDashboard() {
  const now = useNow()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [profile, setProfile] = useState(null)
  const [announcements, setAnnouncements] = useState([])
  const [incidents, setIncidents] = useState([])
  const [tickets, setTickets] = useState([])
  const [documentRequests, setDocumentRequests] = useState([])
  const [blotterCases, setBlotterCases] = useState([])
  const [activeSection, setActiveSection] = useUrlSection(RESIDENT_SECTIONS, RESIDENT_HOME)
  // In-page view switches on the band (My reports, My tickets).
  const [reportFilter, setReportFilter] = useState('active')
  const [ticketFilter, setTicketFilter] = useState('open')
  // Starts closed so a phone refresh never renders the drawer open; then
  // the remembered desktop choice (lib/useSidebarState).
  const [sidebarOpen, setSidebarOpen] = useSidebarState(false)
  const [loading, setLoading] = useState(true)
  const [ratingModal, setRatingModal] = useState(null)


  useEffect(() => {
    let cancelled = false
    async function loadData() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.replace(loginHref())
      const user = session.user

      const { data: prof, error: profError } = await supabase
        .from('profiles')
        .select('*, barangays(id, name, city, province, phone)')
        .eq('id', user.id)
        .maybeSingle()

      if (cancelled) return
      if (profError || !prof) {
        toast.error('Could not load your profile. Please refresh.')
        setLoading(false)
        return
      }
      setProfile(prof)

      if (!prof.barangay_id) {
        setLoading(false)
        return
      }

      // Parallel instead of one-after-another — noticeably faster first paint
      const [annRes, incRes, tixRes, docRes, kpRes] = await Promise.all([
        supabase.from('announcements').select('*')
          .eq('barangay_id', prof.barangay_id)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase.from('incidents').select('*')
          .eq('reported_by', user.id)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase.from('tickets').select('*')
          .eq('created_by', user.id)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase.from('document_requests').select('*')
          .eq('requested_by', user.id)
          .order('created_at', { ascending: false })
          .limit(100),
        // Cases where this resident is the recorded complainant. The blotter
        // is kept by the barangay, so this is read-only — but a complainant
        // should be able to see where their own case has got to.
        supabase.from('blotter_cases').select('*')
          .eq('complainant_id', user.id)
          .order('filed_at', { ascending: false })
          .limit(50),
      ])

      if (cancelled) return
      // A table that has not been created yet is a deployment gap, not
      // something a resident can act on — see lib/dbError.js.
      const firstError = firstRealError(
        [annRes, incRes, tixRes, docRes, kpRes], 'the resident dashboard')
      if (firstError) {
        console.error('Resident dashboard load failed:', firstError)
        toast.error('Some of your dashboard could not load. Pull down to refresh.')
      }

      setAnnouncements(annRes.data || [])
      setIncidents(incRes.data || [])
      setTickets(tixRes.data || [])
      setDocumentRequests(docRes.data || [])
      setBlotterCases(kpRes.data || [])
      setLoading(false)
    }
    loadData()
    return () => { cancelled = true }
  }, [supabase, router])

  // The listener below outlives any one render. It reads the CURRENT
  // notification preferences through this ref, so a change made while the
  // dashboard is open applies at once, without resubscribing the channel.
  const prefsRef = useRef(profile?.notification_prefs || {})
  useEffect(() => { prefsRef.current = profile?.notification_prefs || {} })

  // Real-time subscriptions — one channel, and the incident/ticket
  // listeners are now FILTERED to this user's own rows. Previously they
  // subscribed to updates on EVERY incident and ticket in the database
  // (whatever RLS allowed through), doing a state .map() per event.
  // New announcements, live — see lib/useLiveAnnouncements for why this
  // is not a plain INSERT listener.
  useLiveAnnouncements(supabase, profile?.barangay_id, (row) => {
    // De-dupe: a reload racing this could already have the row
    setAnnouncements(prev => (prev.some(a => a.id === row.id) ? prev : [row, ...prev]))
    if (prefsRef.current.announcements !== false) {
      notify.info({
        kind: 'Announcement',
        title: row.title,
        action: { label: 'Read it', onClick: () => setActiveSection('announcements') },
      })
      notifyNewAnnouncement(row)
    }
  })

  useEffect(() => {
    if (!profile?.barangay_id) return

    const channel = supabase
      .channel(`resident-${profile.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'incidents',
        filter: `reported_by=eq.${profile.id}`,
      }, (payload) => {
        setIncidents(prev => prev.map(i => {
          if (i.id === payload.new.id) {
            if (payload.old.status !== payload.new.status) {
              const statusMessage = {
                assigned: 'A tanod is on the way',
                resolved: 'Your report has been resolved',
              }
              if (statusMessage[payload.new.status] && prefsRef.current.incidents !== false) {
                notify.success({
                  kind: 'Your report',
                  title: statusMessage[payload.new.status],
                  body: payload.new.title,
                  id: `incident-${payload.new.id}-${payload.new.status}`,
                  action: {
                    label: 'Open',
                    onClick: () => router.push(`/resident/incident/${payload.new.id}`),
                  },
                })
                notifyStatusUpdate({ id: payload.new.id, title: payload.new.title }, payload.new.status)
              }
            }
            return { ...i, ...payload.new }
          }
          return i
        }))
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'tickets',
        filter: `created_by=eq.${profile.id}`,
      }, (payload) => {
        setTickets(prev => prev.map(t =>
          t.id === payload.new.id ? { ...t, ...payload.new } : t
        ))
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'document_requests',
        filter: `requested_by=eq.${profile.id}`,
      }, (payload) => {
        setDocumentRequests(prev => prev.map(d =>
          d.id === payload.new.id ? { ...d, ...payload.new } : d
        ))
        if (payload.old.status !== payload.new.status) {
          const update = {
            processing: { severity: 'info', title: 'The barangay started processing your document' },
            ready: {
              severity: 'success', title: 'Your document is ready for pickup',
              body: 'Bring a valid ID to the barangay hall.',
            },
            released: { severity: 'success', title: 'Your document has been released' },
            denied: {
              severity: 'warn', title: 'Your document request was denied',
              body: payload.new.denial_reason || 'Open the request to see the reason given.',
            },
          }[payload.new.status]
          if (update) {
            const { severity, ...rest } = update
            notify[severity]({
              kind: 'Document request',
              id: `doc-${payload.new.id}-${payload.new.status}`,
              action: { label: 'View', onClick: () => setActiveSection('documents') },
              ...rest,
            })
          }
        }
      })
      // A resident's own verification decision, so the account stops saying
      // "pending" the moment an official acts on it.
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${profile.id}`,
      }, (payload) => {
        setProfile(prev => (prev ? { ...prev, ...payload.new } : prev))
        if (payload.old.verification_status !== payload.new.verification_status) {
          if (payload.new.verification_status === 'verified') {
            // Verification exists to unlock exactly one thing, so the toast
            // opens that door rather than announcing a permission change and
            // leaving the resident to work out what it bought them.
            notify.success({
              kind: 'Verified',
              title: 'Your account is verified',
              body: 'You can now request barangay clearances and certificates.',
              action: {
                label: 'Request a document',
                onClick: () => router.push('/resident/documents/new'),
              },
            })
          } else if (payload.new.verification_status === 'rejected') {
            notify.warn({
              kind: 'Verification',
              title: 'A barangay official could not verify your account',
              body: payload.new.verification_note
                || 'Open your dashboard to see what the barangay needs.',
              action: { label: 'See why', onClick: () => setActiveSection('home') },
            })
          }
        }
      })
    const leaveChannel = subscribeWhenSignedIn(supabase, channel)

    return () => {
      leaveChannel()
    }
  }, [profile?.id, profile?.barangay_id, supabase, router, setActiveSection])

  // Stable, so the home tiles that call it are not rebuilt every render.
  const navClick = useCallback((key) => {
    setActiveSection(key)
    if (isPhoneLayout()) setSidebarOpen(false)
  }, [setSidebarOpen, setActiveSection])

  // Sections share one scrolling <main>; start each one at the top.
  const mainRef = useRef(null)
  useEffect(() => { mainRef.current?.scrollTo({ top: 0 }) }, [activeSection])

  // Each section gets its own browser-tab title (history entries, tab strip).
  useEffect(() => { document.title = `${sectionTitle[activeSection] || 'Dashboard'} · BH360` }, [activeSection])

  // Throws on failure so the improved RatingModal shows its error state
  // and re-enables its buttons; the old version silently ignored a failed
  // update and thanked the user for feedback that was never saved.
  async function handleRating({ rating, feedback }) {
    const incidentId = ratingModal.id
    const ratedAt = new Date().toISOString()
    const { error } = await supabase.from('incidents').update({
      rating,
      rating_feedback: feedback,
      rated_at: ratedAt,
    }).eq('id', incidentId)

    if (error) throw error

    setIncidents(prev => prev.map(i =>
      i.id === incidentId ? { ...i, rating, rating_feedback: feedback, rated_at: ratedAt } : i
    ))
    toast.success('Thank you for your feedback! ⭐')
    setRatingModal(null)
  }

  const openDocumentCount = documentRequests.filter(
    d => !['released', 'denied'].includes(d.status)
  ).length

  const { live: liveIncidents, done: doneIncidents } = useMemo(
    () => partitionByLiveness(incidents),
    [incidents]
  )
  const { live: liveTickets, done: doneTickets } = useMemo(
    () => partitionByLiveness(tickets),
    [tickets]
  )
  const { live: liveDocuments, done: doneDocuments } = useMemo(
    () => partitionByLiveness(documentRequests),
    [documentRequests]
  )
  // The blotter has its own vocabulary for "still going", so it brings its
  // own predicate rather than the generic one.
  const { live: liveCases, done: doneCases } = useMemo(
    () => partitionByLiveness(blotterCases, k => !caseIsOpen(k)),
    [blotterCases]
  )

  // What the database writes for this resident: replies and status changes
  // on their tickets, progress on their reports, documents, blotter cases,
  // verification, announcements (supabase/setup.sql Section 18). New
  // announcements already get their own toast below, so the hook stays
  // quiet for those.
  const notificationCenter = useNotifications(profile?.id, { silentTypes: ['announcement', 'incident_status'] })
  const { rows: notificationRows, markRead: markNotificationsRead } = notificationCenter

  // Unread announcements are the ones with an unread notification. (Ones
  // published before notifications existed have none, so they count as
  // read rather than arriving as a backlog.)
  const unreadAnnouncementRows = useMemo(
    () => notificationRows.filter(n => n.type === 'announcement' && !n.read_at),
    [notificationRows]
  )
  const unreadAnnouncementIds = useMemo(
    () => new Set(unreadAnnouncementRows.map(n => n.entity_id)),
    [unreadAnnouncementRows]
  )
  const unreadAnnouncementCount = unreadAnnouncementIds.size

  // Everything the home screen says, derived once. The counts are of what
  // is outstanding, never of how many rows exist — the old tiles read "15"
  // when 13 of them were resolved, which answers nothing.
  const counts = useMemo(
    () => activityCounts({
      incidents, tickets, documentRequests, blotterCases,
      unreadAnnouncements: unreadAnnouncementCount,
      isCaseOpen: caseIsOpen,
    }),
    [incidents, tickets, documentRequests, blotterCases, unreadAnnouncementCount]
  )

  const homeSummary = useMemo(
    () => summarySentence(counts, { barangayName: profile?.barangays?.name }),
    [counts, profile]
  )

  const pressing = useMemo(
    () => mostPressing({ incidents, documentRequests }),
    [incidents, documentRequests]
  )

  // The nearest RA 11032 deadline still running, for the tile caption.
  const nextDocumentDue = useMemo(() => {
    const open = documentRequests
      .filter(d => !['released', 'denied'].includes(d.status) && d.due_at)
      .sort((a, b) => new Date(a.due_at) - new Date(b.due_at))[0]
    if (!open) return null
    const state = deadlineState(open)
    return state.label || `due ${formatDeadline(open.due_at)}`
  }, [documentRequests])




  // Opening the section is what marks them read, which is what finally
  // clears the badge.
  useEffect(() => {
    if (activeSection !== 'announcements') return
    if (unreadAnnouncementRows.length === 0) return
    markNotificationsRead(unreadAnnouncementRows.map(n => n.id))
  }, [activeSection, unreadAnnouncementRows, markNotificationsRead])

  // Separate from unread: this one means "posted recently", which is why it
  // stays put while you read rather than vanishing under you.
  const recentAnnouncementCount = announcements.filter(a =>
    (now - new Date(a.created_at)) / (1000 * 60 * 60 * 24) <= 1
  ).length

  // Sections animate in when the user switches to one — not when the page
  // first loads (lib/useSectionEntrance.js).
  const entering = useSectionEntrance(activeSection, !loading)

  const todayLabel = new Date(now).toLocaleDateString('en-PH', { weekday: 'long', month: 'short', day: 'numeric' })

  // What sits on the band under the title, per section (R01, R04, R07).
  const bandSlot = {
    home: (
      <PressingCard pressing={pressing}
        incident={pressing?.kind === 'incident' ? incidents.find(i => i.id === pressing.id) : null}
        allClearNote={unreadAnnouncementCount > 0
          ? `${unreadAnnouncementCount} announcement${unreadAnnouncementCount === 1 ? '' : 's'} went up since you last looked`
          : 'Everything you have filed has been dealt with'}
        onOpen={() => pressing?.href && router.push(pressing.href)} />
    ),
    incidents: (
      <Segmented onBand full size="lg" label="Show reports" value={reportFilter} onChange={setReportFilter}
        items={[{ value: 'active', label: 'Active', count: liveIncidents.length }, { value: 'resolved', label: 'Resolved', count: doneIncidents.length }]} />
    ),
    tickets: (
      <div className="flex flex-col gap-3">
        <BandAction onClick={() => router.push('/resident/ticket/new')}>Ask the barangay</BandAction>
        <Segmented onBand full size="lg" label="Show conversations" value={ticketFilter} onChange={setTicketFilter}
          items={[{ value: 'open', label: 'Open', count: liveTickets.length }, { value: 'closed', label: 'Closed', count: doneTickets.length }]} />
      </div>
    ),
    documents: <BandAction onClick={() => router.push('/resident/documents/new')}>Request a document</BandAction>,
  }[activeSection]

  // While loading, the same frame the static HTML showed before JavaScript
  // ran — now with the real sidebar width and banner — so a refresh shows
  // one skeleton throughout, then the content in its place.
  if (loading) {
    return (
      <DashboardShellSkeleton path="/resident" kind={RESIDENT_SKELETONS[activeSection]} section={activeSection}
        sidebarOpen={sidebarOpen} banner={<NotificationBanner />} />
    )
  }

  return (
    <>
      <DashboardFrame mainRef={mainRef} sidebarOpen={sidebarOpen}
        tabBar={<TabBar role="resident" activeSection={activeSection} onSelect={setActiveSection} />}
        sidebar={<DashboardSidebar
        profile={profile}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        roleLabel="Resident"
        navItems={[
          { section: 'MAIN', items: [
            { key: 'home', label: 'Home', icon: HomeIcon },
            { key: 'announcements', label: 'Announcements', icon: AnnouncementsIcon, count: unreadAnnouncementCount, hasNew: unreadAnnouncementCount > 0 },
          ]},
          { section: 'MY ACTIVITY', items: [
            { key: 'incidents', label: 'My reports', icon: IncidentsIcon, count: incidents.filter(i => i.status === 'pending').length },
            { key: 'tickets', label: 'My tickets', icon: TicketsIcon, count: tickets.filter(t => t.status === 'open').length },
            { key: 'documents', label: 'My documents', icon: DocumentsIcon, count: openDocumentCount },
            { key: 'blotter', label: 'My cases', icon: BlotterIcon, count: blotterCases.filter(caseIsOpen).length },
          ]},
          { section: 'SUPPORT', items: [
            { key: 'ai', label: 'AI Assistant', icon: AiIcon },
          ]},
        ]}
      />}
        header={<DashboardHeader
          profile={profile}
          columnClass={dashboardColumn('/resident', RESIDENT_SKELETONS[activeSection])}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          sectionTitle={sectionTitle[activeSection]}
          sectionDesc={sectionSub[activeSection]}
          phoneTitle={profile?.barangays?.name ? `Brgy. ${profile.barangays.name}` : 'Home'}
          heading={activeSection === 'home' ? (
            <>
              <p className="text-xs font-bold tracking-[0.08em] text-white/75 uppercase">{todayLabel}</p>
              <h1 className="mt-1.5 text-[26px] font-extrabold leading-tight tracking-[-0.6px] text-white">
                {greeting()}{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}.
              </h1>
              <p className="mt-1.5 hidden desk:block text-sm text-white/88 max-w-[62ch]">{homeSummary.text}</p>
            </>
          ) : undefined}
          bandExtend={activeSection === 'home' ? 8 : undefined}
          notificationCenter={notificationCenter}
          searchData={{ incidents, tickets, announcements }}
          onSearchResultClick={(type, item) => {
            if (type === 'incidents') router.push(`/resident/incident/${item.id}`)
            if (type === 'tickets') router.push(`/resident/ticket/${item.id}`)
            if (type === 'announcements') setActiveSection('announcements')
          }}>
          {bandSlot && <div className="band-slot">{bandSlot}</div>}
        </DashboardHeader>}>

          <div className="mx-auto w-full max-w-[100rem]">
          {/* In the same column as the section below it. */}
          <div className={`${dashboardColumn('/resident', RESIDENT_SKELETONS[activeSection])} mx-auto`}>
            <NotificationBanner />
          </div>

          {/* Keyed on the section: switching sections remounts it, which
              eases the new section in (only after a switch — see `entering`
              above and components/SectionContent.jsx). */}
          <SectionContent key={activeSection} entering={entering}>
          {!loading && !profile?.barangay_id && (
            <Card lift className="max-w-2xl mx-auto px-[18px] py-5">
              <h2 className="text-[15px] font-extrabold text-ink">No barangay on your account yet</h2>
              <Muted className="mt-1">Your account isn’t linked to a barangay. Contact support or check your profile.</Muted>
              <Button className="mt-3" onClick={() => router.push('/profile')}>Go to your profile</Button>
            </Card>
          )}

          {!loading && profile?.barangay_id && activeSection === 'home' && (
            <div className="flex flex-col gap-3.5 max-w-4xl 2xl:max-w-5xl mx-auto">
              {/* Account verification. Shown on Home rather than as a blocking
                  interstitial: an unverified resident can still do everything
                  urgent — report an incident, open a ticket — and only document
                  issuance waits on a barangay official. */}
              {!isVerified(profile) && (
                <Notice tone={profile?.verification_status === 'rejected' ? 'danger' : 'warn'} title={`${verificationStyle(profile?.verification_status).label}.`}>
                  {documentBlockReason(profile)}
                  {profile?.verification_note && <span className="block mt-1">{profile.verification_note}</span>}
                  <button onClick={() => router.push('/profile')} className="mt-1.5 block text-xs font-bold text-brand-strong hover:text-brand-deep">Check your profile details</button>
                </Notice>
              )}

              <HomeLinks items={[
                {
                  key: 'documents', icon: DocumentsIcon, title: 'Request a document',
                  sub: counts.documents.open ? `${counts.documents.open} in progress${nextDocumentDue ? ` · ${nextDocumentDue}` : ''}` : 'Clearance, residency, indigency',
                  onClick: () => router.push('/resident/documents/new'),
                },
                {
                  key: 'tickets', icon: TicketsIcon, title: 'Ask the barangay',
                  sub: counts.tickets.open ? `${counts.tickets.open} open ${counts.tickets.open === 1 ? 'conversation' : 'conversations'}` : 'Chat with an official',
                  count: counts.tickets.open,
                  onClick: () => (tickets.length ? navClick('tickets') : router.push('/resident/ticket/new')),
                },
                {
                  key: 'blotter', icon: BlotterIcon, title: 'My cases',
                  sub: counts.cases.open ? `${counts.cases.open} ongoing · Lupon hearings and status` : 'Lupon hearings and status',
                  count: counts.cases.open,
                  onClick: () => navClick('blotter'),
                },
                {
                  key: 'announcements', icon: AnnouncementsIcon, title: 'Announcements',
                  sub: unreadAnnouncementCount ? `${unreadAnnouncementCount} unread` : 'News and alerts from the hall',
                  count: unreadAnnouncementCount,
                  onClick: () => navClick('announcements'),
                },
              ]} />

              <div>
                <SectionLabel>Emergency hotlines</SectionLabel>
                <HomeHotlines hallPhone={profile?.barangays?.phone} />
              </div>

              {announcements.length > 0 && (
                <div>
                  <div className="flex items-center justify-between">
                    <SectionLabel>Latest announcements</SectionLabel>
                    <button onClick={() => navClick('announcements')} className="mb-2 text-xs font-bold text-brand-strong hover:text-brand-deep">View all</button>
                  </div>
                  <Card>
                    <Rows>
                      {announcements.slice(0, 2).map(n => {
                        const unread = unreadAnnouncementIds.has(n.id)
                        return (
                          <Row key={n.id} as="button" interactive onClick={() => navClick('announcements')} className="flex items-center gap-3">
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-bold text-ink">{n.title}</span>
                              <span className="block truncate text-xs text-muted-foreground" title={fullDate(n.created_at)}>
                                {unread && <span className="mr-1.5 inline-block size-[7px] rounded-full bg-brand-strong align-middle" aria-hidden="true" />}
                                {timeAgoLong(n.created_at)} · {n.content}
                              </span>
                              <span className="sr-only">{unread ? 'Unread' : 'Read'}</span>
                            </span>
                            <ChevronRight size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                          </Row>
                        )
                      })}
                    </Rows>
                  </Card>
                </div>
              )}
            </div>
          )}

          {!loading && profile?.barangay_id && activeSection === 'announcements' && (
            <div className="flex flex-col gap-3.5 max-w-3xl mx-auto">
              <AnnouncementRows announcements={announcements} unreadIds={unreadAnnouncementIds}
                emptyText="No announcements yet. Your barangay posts news, alerts and events here." />
              {recentAnnouncementCount > 0 && (
                <Muted className="text-center text-xs">{recentAnnouncementCount} posted in the last day.</Muted>
              )}
            </div>
          )}

          {!loading && profile?.barangay_id && activeSection === 'incidents' && (
            <div className="flex flex-col gap-3.5 max-w-3xl 2xl:max-w-6xl mx-auto">
              <ReportRows
                incidents={reportFilter === 'active' ? liveIncidents : doneIncidents}
                onOpen={inc => router.push(`/resident/incident/${inc.id}`)}
                onRate={inc => setRatingModal(inc)}
                emptyText={reportFilter === 'active'
                  ? (incidents.length ? 'Nothing in progress. Your resolved reports are under Resolved.' : 'You haven’t sent a report yet. When something needs the barangay, report it and follow it here.')
                  : 'No resolved reports yet.'}
                emptyAction={reportFilter === 'active' ? <Button size="sm" onClick={() => router.push('/resident/report')}>Report an incident</Button> : null}
              />
            </div>
          )}

          {!loading && profile?.barangay_id && activeSection === 'tickets' && (
            <div className="flex flex-col gap-3.5 max-w-3xl 2xl:max-w-6xl mx-auto">
              <TicketRows
                tickets={ticketFilter === 'open' ? liveTickets : doneTickets}
                onOpen={t => router.push(`/resident/ticket/${t.id}`)}
                emptyText={ticketFilter === 'open'
                  ? 'No open conversations. Ask the barangay a question and an official answers here.'
                  : 'No closed conversations yet.'}
              />
            </div>
          )}

          {/* MY DOCUMENTS — barangay certifications, and the clock RA 11032
              puts the barangay on for each one. */}
          {!loading && profile?.barangay_id && activeSection === 'documents' && (
            <div className="flex flex-col gap-3.5 max-w-3xl 2xl:max-w-6xl mx-auto">
              {!canRequestDocuments(profile) && (
                <Notice tone="warn">{documentBlockReason(profile)}</Notice>
              )}
              <DocumentRows requests={[...liveDocuments, ...doneDocuments]}
                emptyText="You haven’t requested a document yet. Clearances, residency and indigency certificates are issued here." />
              {/* The promise, stated plainly. */}
              <Muted className="text-xs">
                Processing times follow the barangay’s Citizen’s Charter (RA 11032, Secs. 9(b)(1) and 10): 3 working days for a simple request, 7 for a complex one, 20 for a highly technical one, extendable once. If no decision comes in time, your request is deemed approved. You’ll get a notification when a document is ready.
              </Muted>
            </div>
          )}

          {/* MY BLOTTER CASES — read-only. The blotter is the barangay's
              record, kept by the secretary; a complainant does not edit it,
              but they should be able to see where their case has got to and
              what the law says happens next. */}
          {!loading && profile?.barangay_id && activeSection === 'blotter' && (
            <div className="flex flex-col gap-3.5 max-w-3xl 2xl:max-w-6xl mx-auto">
              {blotterCases.length === 0 && (
                <Card lift className="px-[18px] py-5">
                  <Muted>You have no cases on record. Cases are filed at the barangay hall by the secretary.</Muted>
                </Card>
              )}
              {[...liveCases, ...doneCases].map(kase => <CaseCard key={kase.id} kase={kase} />)}
              <Card className="px-[18px] py-4">
                <SectionLabel as="h2">What happens next</SectionLabel>
                <p className="text-sm leading-[1.55] text-body">
                  The barangay summons the other party by the next working day. The Punong Barangay then has 15 days from your first meeting to help you settle (RA 7160, Sec. 410). If it isn’t settled, a Pangkat gets 15 more. Only when conciliation fails does the barangay issue a Certificate to File Action, which lets you go to court (Sec. 412). To open a case, go to the barangay hall.
                </p>
              </Card>
            </div>
          )}

          {!loading && profile?.barangay_id && activeSection === 'ai' && (
            <div className="max-w-3xl mx-auto">
              <Card lift className="px-[18px] py-5">
                <AiIcon size={24} className="text-brand-strong" />
                <h2 className="mt-3 text-[17px] font-extrabold text-ink">Ask the assistant</h2>
                <Muted className="mt-1">Quick answers about barangay services, documents and your reports, any time. For an emergency, call 911.</Muted>
                <Button className="mt-4" onClick={() => router.push('/resident/ai')}>Start a conversation</Button>
              </Card>
            </div>
          )}

          </SectionContent>
          </div>
      </DashboardFrame>
      <RatingModal
        open={!!ratingModal}
        onClose={() => setRatingModal(null)}
        onSubmit={handleRating}
        incident={ratingModal}
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
export default function ResidentDashboardPage() {
  return (
    <>
      <DashboardBackdrop />
      <ClientBoundary fallback={<DashboardShellSkeleton path="/resident" />}>
        <ResidentDashboard />
      </ClientBoundary>
    </>
  )
}
