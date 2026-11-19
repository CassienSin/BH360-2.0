'use client'
import { DashboardShellSkeleton } from '@/components/Skeletons'
import ClientBoundary from '@/components/ClientBoundary'
import DashboardBackdrop from '@/components/DashboardBackdrop'
import { DASHBOARD_SKELETONS } from '@/lib/dashboardSkeletons'
import { useSectionEntrance } from '@/lib/useSectionEntrance'
import SectionContent from '@/components/SectionContent'
import { useUrlSection } from '@/lib/useUrlSection'
import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { loginHref } from '@/lib/loginRedirect'
import { createClient } from '@/lib/supabase'
import { Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import DashboardHeader from '@/components/DashboardHeader'
import DashboardSidebar from '@/components/DashboardSidebar'
import DashboardFrame from '@/components/crafted/DashboardFrame'
import { AnalyticsIcon, AnnouncementsIcon, BlotterIcon, CalendarIcon, DashboardIcon, DocumentsIcon, IncidentsIcon, MapIcon, TanodsIcon, TicketsIcon, UsersIcon, VerificationsIcon } from '@/components/icons/BhIcons'
import ConfirmDialog from '@/components/ConfirmDialog'
import TanodRoster from '@/components/TanodRoster'
import TanodManagement from '@/components/TanodManagement'
import { timeAgo } from '@/lib/timeAgo'
import { exportToCSV, exportToPDF } from '@/lib/export'
import NotificationBanner from '@/components/NotificationBanner'
import AppointmentReminderWatcher from '@/components/AppointmentReminderWatcher'
import { useNotifications } from '@/lib/useNotifications'
import { WaitingCard, RecentIncidentsCard, TodayCard } from '@/components/official/OfficialSections'
import TicketsSection from '@/components/official/TicketsSection'
import UsersSection from '@/components/official/UsersSection'
import AnnouncementsSection from '@/components/official/AnnouncementsSection'
import { SectionLauncher } from '@/components/official/OfficialSections'
import { waitingOnOfficial } from '@/lib/officialQueue'
import { StatStrip } from '@/components/ui/stat-strip'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { isSettled } from '@/lib/recordState'
import { greeting, officialSummary, unassignedIncidents, plural } from '@/lib/homeSummary'
import { notifyCriticalIncident, notifyNewIncident } from '@/lib/notifications'
import IncidentsSection from '@/components/IncidentsSection'
import CriticalAlert from '@/components/CriticalAlert'
import { notify } from '@/components/Toast'
import { firstRealError } from '@/lib/dbError'
import VerificationQueue from '@/components/VerificationQueue'
import DocumentQueue from '@/components/DocumentQueue'
import BlotterQueue from '@/components/BlotterQueue'
import { deadlineState } from '@/lib/documents'
import { stageDeadline as blotterDeadline, isOpen as blotterIsOpen } from '@/lib/katarungan'
import { useNow } from '@/lib/useNow'
import { useSidebarState } from '@/lib/useSidebarState'
import { isPhoneLayout } from '@/lib/layout'
import { subscribeWhenSignedIn } from '@/lib/realtime'

const priorityConfig = {
  Low: { color: '#22c55e', bg: '#f0fdf4', icon: '🟢', order: 1 },
  Medium: { color: '#3b82f6', bg: '#eff6ff', icon: '🔵', order: 2 },
  High: { color: '#f97316', bg: '#fff7ed', icon: '🟠', order: 3 },
  Critical: { color: '#dc2626', bg: '#fef2f2', icon: '🔴', order: 4 },
}

// Supabase silently caps a select at 1,000 rows, so an unbounded query does
// not error when a barangay outgrows it — it just quietly stops showing the
// oldest records. Every list below is bounded explicitly, and says so when
// it is showing a partial view.
const INCIDENT_PAGE_SIZE = 100   // + "Load older" for the rest
const TICKET_LIMIT = 200
const ANNOUNCEMENT_LIMIT = 100
const USER_LIMIT = 300
const INVITE_CODE_LIMIT = 100
const BLOTTER_LIMIT = 200

// Sections, and the placeholder each shows while loading: lib/dashboardSkeletons.js
const { kinds: OFFICIAL_SKELETONS, fallback: OFFICIAL_HOME } = DASHBOARD_SKELETONS['/official']
const OFFICIAL_SECTIONS = Object.keys(OFFICIAL_SKELETONS)

function OfficialDashboard() {
  const now = useNow()
  const router = useRouter()

  const supabase = useMemo(() => createClient(), [])
  const [profile, setProfile] = useState(null)
  // What the database writes for this official: new incidents, tickets and
  // replies, document requests, residents to verify, appointment reminders
  // (supabase/setup.sql Section 18). New incidents already sound the siren
  // and toast below, so the hook stays quiet for those.
  const notificationCenter = useNotifications(profile?.id, { silentTypes: ['incident_new'] })
  const [announcements, setAnnouncements] = useState([])
  const [incidents, setIncidents] = useState([])
  const [tickets, setTickets] = useState([])
  const [tanods, setTanods] = useState([])
  const [users, setUsers] = useState([])
  const [inviteCodes, setInviteCodes] = useState([])
  const [documentRequests, setDocumentRequests] = useState([])
  const [blotterCases, setBlotterCases] = useState([])
  // Today's appointments (hearings, pickups, events) for the dashboard's
  // Today card. Read-only; the calendar is where they are made.
  const [todayAppointments, setTodayAppointments] = useState([])
  const [incidentsHasMore, setIncidentsHasMore] = useState(false)
  const [loadingMoreIncidents, setLoadingMoreIncidents] = useState(false)
  const [activeSection, setActiveSection] = useUrlSection(OFFICIAL_SECTIONS, OFFICIAL_HOME)
  // Open state, remembered on desktop, closed on phones (lib/useSidebarState)
  const [sidebarOpen, setSidebarOpen] = useSidebarState(true)
  const [loading, setLoading] = useState(true)
  const [ticketSearch, setTicketSearch] = useState('')
  const [ticketFilter, setTicketFilter] = useState('all')
  // The blotter's filing form, opened from the band's File a complaint.
  const [blotterFiling, setBlotterFiling] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [userRoleFilter, setUserRoleFilter] = useState('resident')
  const [confirmDialog, setConfirmDialog] = useState(null) // { type, ...data }
  const [generatingCode, setGeneratingCode] = useState(false)
  const hadDropRef = useRef(false) // realtime dropped at some point → refetch on reconnect


  // ---- Data fetching (reusable so realtime reconnects can refresh) ----
  const loadBarangayData = useCallback(async (bid) => {
    // These six queries were sequential (~6 round trips) — run them in parallel
    // Today on this device: midnight to midnight.
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(dayStart); dayEnd.setDate(dayStart.getDate() + 1)
    const [inc, tix, ann, tan, allUsers, codes, docs, blotter, appts] = await Promise.all([
      supabase.from('incidents')
        .select('*, profiles!incidents_reported_by_fkey(full_name)')
        .eq('barangay_id', bid)
        .order('created_at', { ascending: false })
        .limit(INCIDENT_PAGE_SIZE),
      supabase.from('tickets')
        .select('*, profiles!tickets_created_by_fkey(full_name)')
        .eq('barangay_id', bid)
        .order('created_at', { ascending: false })
        .limit(TICKET_LIMIT),
      supabase.from('announcements')
        .select('*')
        .eq('barangay_id', bid)
        .order('created_at', { ascending: false })
        .limit(ANNOUNCEMENT_LIMIT),
      supabase.from('profiles')
        .select('*')
        .eq('role', 'tanod')
        .eq('barangay_id', bid)
        .is('deactivated_at', null),
      supabase.from('profiles')
        .select('*')
        .eq('barangay_id', bid)
        .is('deactivated_at', null)
        .order('created_at', { ascending: false })
        .limit(USER_LIMIT),
      supabase.from('invite_codes')
        // used_by intentionally references auth.users, not profiles: the
        // invite is claimed before the profile row exists during signup.
        .select('*')
        .eq('barangay_id', bid)
        .order('created_at', { ascending: false })
        .limit(INVITE_CODE_LIMIT),
      supabase.from('document_requests')
        .select('*, profiles!document_requests_requested_by_fkey(full_name, phone)')
        .eq('barangay_id', bid)
        .order('due_at', { ascending: true }),
      supabase.from('blotter_cases')
        .select('*')
        .eq('barangay_id', bid)
        .order('filed_at', { ascending: false })
        .limit(BLOTTER_LIMIT),
      supabase.from('appointments')
        .select('id, title, participant_name, starts_at')
        .eq('barangay_id', bid)
        .gte('starts_at', dayStart.toISOString())
        .lt('starts_at', dayEnd.toISOString())
        .order('starts_at', { ascending: true })
        .limit(20),
    ])
    const loadError = firstRealError(
      [inc, tix, ann, tan, allUsers, codes, docs, blotter, appts], 'the official dashboard')
    if (loadError) {
      console.error('Barangay data load failed:', loadError)
      toast.error('Some of the dashboard could not load. Try refreshing.')
    }

    setIncidents(inc.data || [])
    // A full page back means there is probably another one behind it.
    setIncidentsHasMore((inc.data?.length || 0) === INCIDENT_PAGE_SIZE)
    setTickets(tix.data || [])
    setAnnouncements(ann.data || [])
    setTanods(tan.data || [])
    setUsers(allUsers.data || [])
    setInviteCodes(codes.data || [])
    setDocumentRequests(docs.data || [])
    setBlotterCases(blotter.data || [])
    setTodayAppointments(appts.data || [])
  }, [supabase])

  useEffect(() => {
    let cancelled = false
    async function loadData() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (cancelled) return
        if (!session) return router.replace(loginHref())
        const user = session.user
        const { data: prof, error: profError } = await supabase.from('profiles')
          .select('*, barangays(id, name, city, province)')
          .eq('id', user.id).single()
        if (cancelled) return
        // A failed query is not the same as being the wrong role — the catch
        // below reports it rather than signing a valid session out.
        if (profError) throw profError
        if (prof?.role !== 'official') return router.replace(loginHref())
        setProfile(prof)

        if (!prof?.barangay_id) {
          setLoading(false)
          return
        }
        await loadBarangayData(prof.barangay_id)
      } catch (err) {
        console.error('Dashboard load failed:', err)
        if (!cancelled) toast.error('Failed to load dashboard. Please refresh.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadData()
    return () => { cancelled = true }
  }, [supabase, router, loadBarangayData])

  // Real-time subscriptions
  useEffect(() => {
    if (!profile?.barangay_id) return

    const bid = profile.barangay_id

    // Subscribe to incident changes
    const incidentChannel = supabase
      .channel('official-incidents')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'incidents',
        filter: `barangay_id=eq.${bid}`,
      }, async (payload) => {
        if (payload.eventType === 'INSERT') {
          const { data, error } = await supabase
            .from('incidents')
            .select('*, profiles!incidents_reported_by_fkey(full_name)')
            .eq('id', payload.new.id)
            .single()
          // Realtime said an incident arrived; if we cannot read it back the
          // dashboard would just never show it.
          if (error) console.error('Could not load the new incident:', error)
          if (data) {
            // Dedup guard: a reconnect refetch may already have this row
            setIncidents(prev => (prev.some(i => i.id === data.id) ? prev : [data, ...prev]))
            const open = { label: 'Open', onClick: () => router.push(`/official/incident/${data.id}`) }
            if (data.priority === 'Critical') {
              // Stays until someone dismisses it. An unattended emergency
              // alert should not be able to expire quietly.
              notify.critical({
                kind: `Critical · ${data.category || 'Incident'}`,
                title: data.title, body: data.location, action: open,
              })
              notifyCriticalIncident(data)
            } else if (data.priority === 'High') {
              notify.warn({
                kind: `High priority · ${data.category || 'Incident'}`,
                title: data.title, body: data.location, action: open,
              })
              notifyNewIncident(data)
            } else {
              notify.info({ kind: 'New report', title: data.title, body: data.location, action: open })
              notifyNewIncident(data)
            }
          }
        }
        if (payload.eventType === 'UPDATE') {
          setIncidents(prev => prev.map(i =>
            i.id === payload.new.id ? { ...i, ...payload.new } : i
          ))
        }
        if (payload.eventType === 'DELETE') {
          setIncidents(prev => prev.filter(i => i.id !== payload.old.id))
        }
      })
    const leaveIncidentChannel = subscribeWhenSignedIn(supabase, incidentChannel, (status) => {
      // Reconnected after a drop → refetch everything that happened during
      // the gap (phone sleep / wifi blip / backgrounded tab)
      if (status === 'SUBSCRIBED') {
        if (hadDropRef.current) {
          hadDropRef.current = false
          loadBarangayData(bid).catch(err => console.error('Reconnect refresh failed:', err))
        }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        hadDropRef.current = true
      }
    })

    // Subscribe to ticket changes
    const ticketChannel = supabase
      .channel('official-tickets')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tickets',
        filter: `barangay_id=eq.${bid}`,
      }, async (payload) => {
        if (payload.eventType === 'INSERT') {
          const { data, error } = await supabase
            .from('tickets')
            .select('*, profiles!tickets_created_by_fkey(full_name)')
            .eq('id', payload.new.id)
            .single()
          if (error) console.error('Could not load the new ticket:', error)
          if (data) {
            setTickets(prev => (prev.some(t => t.id === data.id) ? prev : [data, ...prev]))
            notify.info({
              kind: 'New ticket',
              title: data.title,
              body: data.profiles?.full_name ? `From ${data.profiles.full_name}` : undefined,
              action: { label: 'Open', onClick: () => router.push(`/official/ticket/${data.id}`) },
            })
          }
        }
        if (payload.eventType === 'UPDATE') {
          setTickets(prev => prev.map(t =>
            t.id === payload.new.id ? { ...t, ...payload.new } : t
          ))
        }
      })
    const leaveTicketChannel = subscribeWhenSignedIn(supabase, ticketChannel)

    // Subscribe to announcement changes
    const announcementChannel = supabase
      .channel('official-announcements')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'announcements',
        filter: `barangay_id=eq.${bid}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setAnnouncements(prev => (prev.some(a => a.id === payload.new.id) ? prev : [payload.new, ...prev]))
        }
        if (payload.eventType === 'DELETE') {
          setAnnouncements(prev => prev.filter(a => a.id !== payload.old.id))
        }
      })
    const leaveAnnouncementChannel = subscribeWhenSignedIn(supabase, announcementChannel)

    // Appointment reminders now arrive as notifications written by the
    // database (supabase/setup.sql Section 18), so nothing here loads them.

    // Profile changes: keeps the dispatch dropdown, tanod list, AND the
    // user directory live. The old handler only patched existing tanods —
    // a newly registered user/tanod never appeared until a full reload.
    const profileChannel = supabase
      .channel('official-profiles')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'profiles',
        filter: `barangay_id=eq.${bid}`,
      }, (payload) => {
        const p = payload.new
        if (p.deactivated_at) return
        setUsers(prev => (prev.some(u => u.id === p.id) ? prev : [p, ...prev]))
        if (p.role === 'tanod') {
          setTanods(prev => (prev.some(t => t.id === p.id) ? prev : [...prev, p]))
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `barangay_id=eq.${bid}`,
      }, (payload) => {
        const p = payload.new
        if (p.deactivated_at) {
          // Deactivated mid-session — remove from both lists
          setUsers(prev => prev.filter(u => u.id !== p.id))
          setTanods(prev => prev.filter(t => t.id !== p.id))
          return
        }
        setUsers(prev => prev.map(u => (u.id === p.id ? { ...u, ...p } : u)))
        if (p.role === 'tanod') {
          setTanods(prev => (prev.some(t => t.id === p.id)
            ? prev.map(t => (t.id === p.id ? { ...t, ...p } : t))
            : [...prev, p])) // reactivated or role changed to tanod
        } else {
          setTanods(prev => prev.filter(t => t.id !== p.id)) // role changed away
        }
      })
    const leaveProfileChannel = subscribeWhenSignedIn(supabase, profileChannel)

    // Document requests. A request the office never sees is a request the
    // office will let run past its RA 11032 deadline, so new ones land in
    // the queue without a reload.
    const documentChannel = supabase
      .channel('official-documents')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'document_requests',
        filter: `barangay_id=eq.${bid}`,
      }, async (payload) => {
        if (payload.eventType === 'INSERT') {
          const { data, error } = await supabase
            .from('document_requests')
            .select('*, profiles!document_requests_requested_by_fkey(full_name, phone)')
            .eq('id', payload.new.id)
            .single()
          if (error) console.error('Could not load the new document request:', error)
          if (!data) return
          setDocumentRequests(prev => (prev.some(d => d.id === data.id) ? prev : [data, ...prev]))
          notify.info({
            kind: 'Document request',
            title: `${data.reference_code} filed`,
            body: 'RA 11032 starts the clock from today.',
            action: { label: 'Open queue', onClick: () => setActiveSection('documents') },
          })
        }
        if (payload.eventType === 'UPDATE') {
          setDocumentRequests(prev => prev.map(d => (d.id === payload.new.id ? { ...d, ...payload.new } : d)))
        }
        if (payload.eventType === 'DELETE') {
          setDocumentRequests(prev => prev.filter(d => d.id !== payload.old.id))
        }
      })
    const leaveDocumentChannel = subscribeWhenSignedIn(supabase, documentChannel)

    return () => {
      leaveIncidentChannel()
      leaveTicketChannel()
      leaveAnnouncementChannel()
      leaveProfileChannel()
      leaveDocumentChannel()
    }
  }, [profile?.barangay_id, supabase, loadBarangayData, router, setActiveSection])

  // Export order: open work first, then priority, then newest. (Filtering
  // lives in IncidentsSection; the export takes every incident.)
  const sortedIncidents = useMemo(() => {
    return [...incidents]
      .sort((a, b) => {
        // Status first (pending/assigned before resolved)
        const statusOrder = { pending: 1, assigned: 2, resolved: 3 }
        const aStatus = statusOrder[a.status] || 4
        const bStatus = statusOrder[b.status] || 4
        if (aStatus !== bStatus) return aStatus - bStatus
        // Then priority (Critical first)
        const aPriority = priorityConfig[a.priority]?.order || 2
        const bPriority = priorityConfig[b.priority]?.order || 2
        if (aPriority !== bPriority) return bPriority - aPriority
        // Finally newest first
        return new Date(b.created_at) - new Date(a.created_at)
      })
  }, [incidents])

  const filteredTickets = useMemo(() => {
    const q = ticketSearch.trim().toLowerCase()
    return tickets.filter(t => {
      const matchesSearch = !q ||
        t.title?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.profiles?.full_name?.toLowerCase().includes(q)
      const matchesFilter = ticketFilter === 'all' || t.status === ticketFilter
      return matchesSearch && matchesFilter
    })
  }, [tickets, ticketSearch, ticketFilter])

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase()
    return users.filter(u => {
      const matchesSearch = !q ||
        u.full_name?.toLowerCase().includes(q) ||
        u.phone?.toLowerCase().includes(q) ||
        u.address?.toLowerCase().includes(q)
      const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter
      return matchesSearch && matchesRole
    })
  }, [users, userSearch, userRoleFilter])

  const navClick = useCallback((key) => {
    setActiveSection(key)
    if (isPhoneLayout()) setSidebarOpen(false)
  }, [setSidebarOpen, setActiveSection])

  // Sections share one scrolling <main>; start each one at the top.
  const mainRef = useRef(null)
  useEffect(() => { mainRef.current?.scrollTo({ top: 0 }) }, [activeSection])

  async function doDispatch(incidentId, tanod) {
    // Atomic: only succeeds while the incident is still pending, so two
    // officials can't double-dispatch the same incident
    const { data: updated, error } = await supabase.from('incidents')
      .update({ assigned_to: tanod.id, status: 'assigned' })
      .eq('id', incidentId)
      .eq('status', 'pending')
      .select()
    if (error) {
      toast.error('Dispatch failed. Please try again.')
      return
    }
    if (!updated || updated.length === 0) {
      toast.error('This incident was already assigned or resolved by someone else.')
      return // realtime will sync the true state
    }
    setIncidents(prev => prev.map(i => i.id === incidentId ? { ...i, assigned_to: tanod.id, status: 'assigned' } : i))
    toast.success(`${tanod.full_name} dispatched successfully!`)
  }

  function dispatchTanod(incidentId, tanodId) {
    const tanod = tanods.find(t => t.id === tanodId)
    if (!tanod) return

    if (!tanod.on_duty) {
      setConfirmDialog({
        type: 'dispatch-offduty',
        title: 'Dispatch off-duty tanod?',
        message: `${tanod.full_name} is currently OFF DUTY and may not see this assignment right away. Consider calling them first${tanod.phone ? ` (${tanod.phone})` : ''}. Dispatch anyway?`,
        confirmText: 'Dispatch Anyway',
        variant: 'danger',
        onConfirm: async () => {
          await doDispatch(incidentId, tanod)
          setConfirmDialog(null)
        }
      })
      return
    }
    doDispatch(incidentId, tanod)
  }

  function resolveIncident(incident) {
    setConfirmDialog({
      type: 'resolve',
      title: 'Mark as resolved?',
      message: `Are you sure "${incident.title}" has been resolved? This will notify the resident and update the incident status.`,
      confirmText: 'Yes, Mark Resolved',
      variant: 'success',
      onConfirm: async () => {
        const { error } = await supabase.from('incidents')
          .update({ status: 'resolved' })
          .eq('id', incident.id)
        if (error) {
          toast.error('Failed to update. Please try again.')
          setConfirmDialog(null)
          return
        }
        setIncidents(prev => prev.map(i => i.id === incident.id ? { ...i, status: 'resolved' } : i))
        toast.success('Incident marked as resolved!')
        setConfirmDialog(null)
      }
    })
  }

  // Officials may adjust the law-assigned priority, but the original value,
  // their name, and a written reason are all recorded.
  async function handlePriorityChange(incident, newPriority, reason) {
    const { error } = await supabase.from('incidents').update({
      priority: newPriority,
      original_priority: incident.original_priority || incident.priority,
      priority_override_reason: reason,
      priority_overridden_by: profile.id,
      priority_overridden_at: new Date().toISOString(),
    }).eq('id', incident.id)
    if (error) { toast.error('Failed to update priority.'); return }
    setIncidents(prev => prev.map(i => i.id === incident.id ? {
      ...i,
      priority: newPriority,
      original_priority: incident.original_priority || incident.priority,
      priority_override_reason: reason,
      priority_overridden_by: profile.id,
    } : i))
    toast.success(`Priority changed to ${newPriority}`)
  }

  // acknowledged_at - created_at is the barangay's real time-to-awareness
  async function acknowledgeCritical(incident) {
    const now = new Date().toISOString()
    const { error } = await supabase.from('incidents').update({
      acknowledged_at: now,
      acknowledged_by: profile.id,
    }).eq('id', incident.id)
    if (error) { toast.error('Could not acknowledge. Try again.'); return }
    setIncidents(prev => prev.map(i => i.id === incident.id
      ? { ...i, acknowledged_at: now, acknowledged_by: profile.id }
      : i))
  }

  async function generateInviteCode(role) {
    if (generatingCode) return
    setGeneratingCode(true)
    const code = `${role.toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
    const { data, error } = await supabase.from('invite_codes').insert({
      code, role, barangay_id: profile.barangay_id
    }).select().single()
    setGeneratingCode(false)
    if (error) { toast.error('Failed to generate code.'); return }
    setInviteCodes(prev => [data, ...prev])
    toast.success(`Code generated: ${code}`)
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copied to clipboard!')
    } catch {
      // Clipboard API can fail on http:// or older webviews — show the code
      // so it can at least be copied manually
      toast(`Copy manually: ${text}`, { duration: 6000 })
    }
  }


  // Older incidents, fetched by CURSOR rather than by offset: the realtime
  // subscription prepends new rows as they arrive, which would shift every
  // offset underneath us and skip records. Paging from the oldest row we
  // already hold is immune to that.
  const loadMoreIncidents = useCallback(async () => {
    if (loadingMoreIncidents || !profile?.barangay_id || incidents.length === 0) return
    setLoadingMoreIncidents(true)
    const oldest = incidents[incidents.length - 1].created_at
    const { data, error } = await supabase.from('incidents')
      .select('*, profiles!incidents_reported_by_fkey(full_name)')
      .eq('barangay_id', profile.barangay_id)
      .lt('created_at', oldest)
      .order('created_at', { ascending: false })
      .limit(INCIDENT_PAGE_SIZE)
    setLoadingMoreIncidents(false)

    if (error) {
      toast.error('Could not load older incidents: ' + error.message)
      return
    }
    const rows = data || []
    setIncidents(prev => {
      const seen = new Set(prev.map(i => i.id))
      return [...prev, ...rows.filter(r => !seen.has(r.id))]
    })
    setIncidentsHasMore(rows.length === INCIDENT_PAGE_SIZE)
  }, [supabase, profile, incidents, loadingMoreIncidents])

  // Accounts still waiting on a human decision. `|| 'pending'` because a
  // row written before verification existed reads as null, and an unknown
  // status must never be treated as verified.
  const pendingVerifications = useMemo(
    () => users.filter(u =>
      u.id !== profile?.id && !u.is_super_admin && (u.verification_status || 'pending') === 'pending'
    ).length,
    [users, profile]
  )

  // Open document requests, and how many have already blown the RA 11032
  // deadline — the second number is the one that carries legal weight.
  const documentCounts = useMemo(() => {
    const open = documentRequests.filter(d => !['released', 'denied'].includes(d.status))
    return { open: open.length, breach: open.filter(d => deadlineState(d).deemedApproved).length }
  }, [documentRequests])

  // Cases still before the Lupon, and how many have run past the period
  // RA 7160 allows for the stage they are in.
  const blotterCounts = useMemo(() => {
    const open = blotterCases.filter(blotterIsOpen)
    return { open: open.length, breach: open.filter(c => blotterDeadline(c).level === 'breach').length }
  }, [blotterCases])

  // Everything the dashboard says, derived once.
  const officialBrief = useMemo(
    () => officialSummary({
      incidents, tickets,
      documentsOpen: documentCounts.open, documentsBreached: documentCounts.breach,
      casesOpen: blotterCounts.open, casesBreached: blotterCounts.breach,
      verificationsPending: pendingVerifications,
      tanodsOnDuty: tanods.filter(t => t.on_duty).length,
      tanodsTotal: tanods.length,
      barangayName: profile?.barangays?.name,
    }),
    [incidents, tickets, documentCounts, blotterCounts, pendingVerifications, tanods, profile]
  )

  // The six numbers on the band (O01): each opens its section.
  const officialStats = useMemo(() => {
    const unassigned = unassignedIncidents(incidents)
    const openIncidents = incidents.filter(i => !isSettled(i.status)).length
    // Open or being handled: the same "needs a reply" as the summary line.
    const openTickets = tickets.filter(t => !isSettled(t.status))
    const onDuty = tanods.filter(t => t.on_duty).length
    const oldest = rows => rows.reduce((min, r) => (!min || r.created_at < min ? r.created_at : min), null)
    const pending = users.filter(u =>
      u.id !== profile?.id && !u.is_super_admin && (u.verification_status || 'pending') === 'pending')
    const oldestTicket = oldest(openTickets)
    const oldestSignup = oldest(pending)
    return [
      { label: 'Unassigned reports', value: unassigned.length, note: `${openIncidents} open`, onClick: () => navClick('incidents') },
      {
        label: 'Tanods on duty',
        value: tanods.length ? `${onDuty} of ${tanods.length}` : 0,
        // Nobody on duty is why the next report would sit unassigned.
        tone: tanods.length === 0 ? 'default' : onDuty === 0 ? 'danger' : 'ok',
        note: tanods.length === 0 ? 'no tanods yet' : onDuty === 0 ? 'nobody on duty' : 'on duty now',
        onClick: () => navClick('tanods'),
      },
      { label: 'Tickets to reply', value: openTickets.length, note: oldestTicket ? `oldest ${timeAgo(oldestTicket)}` : 'all answered', onClick: () => navClick('tickets') },
      {
        label: 'Documents waiting', value: documentCounts.open,
        noteTone: documentCounts.breach > 0 ? 'danger' : 'default',
        note: documentCounts.breach > 0 ? `${documentCounts.breach} past the deadline` : 'all within deadline',
        onClick: () => navClick('documents'),
      },
      { label: 'Residents to verify', value: pending.length, note: oldestSignup ? `oldest ${timeAgo(oldestSignup)}` : 'none waiting', onClick: () => navClick('verifications') },
      {
        label: blotterCounts.breach === 1 ? 'Overdue KP case' : 'Overdue KP cases', value: blotterCounts.breach,
        tone: blotterCounts.breach > 0 ? 'danger' : 'default',
        noteTone: 'default',
        note: `${blotterCounts.open} open`,
        onClick: () => navClick('blotter'),
      },
    ]
  }, [incidents, tickets, tanods, users, profile, documentCounts, blotterCounts, navClick])

  const todayLabel = new Date(now).toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })

  // "Waiting on you" (lib/officialQueue.js), from what is already loaded.
  const waiting = useMemo(() => waitingOnOfficial({
    incidents, tickets, cases: blotterCases, documents: documentRequests, users, selfId: profile?.id, now,
  }), [incidents, tickets, blotterCases, documentRequests, users, profile, now])

  const actOnWaiting = useCallback(item => {
    if (item.kind === 'incident') router.push(`/official/incident/${item.id}`)
    else if (item.kind === 'ticket') router.push(`/official/ticket/${item.id}`)
    else navClick({ case: 'blotter', document: 'documents', verification: 'verifications' }[item.kind])
  }, [router, navClick])


  // One handler for both an update and an insert: BlotterQueue passes
  // 'created' when the row is new, because the filing form lives inside it.
  const handleBlotterChanged = useCallback((id, changes, kind) => {
    if (kind === 'created') {
      setBlotterCases(prev => (prev.some(c => c.id === id) ? prev : [changes, ...prev]))
      return
    }
    setBlotterCases(prev => prev.map(c => (c.id === id ? { ...c, ...changes } : c)))
  }, [])

  const handleVerificationUpdated = useCallback((userId, changes) => {
    setUsers(prev => prev.map(u => (u.id === userId ? { ...u, ...changes } : u)))
    setTanods(prev => prev.map(u => (u.id === userId ? { ...u, ...changes } : u)))
  }, [])

  const handleDocumentUpdated = useCallback((id, changes) => {
    setDocumentRequests(prev => prev.map(d => (d.id === id ? { ...d, ...changes } : d)))
  }, [])

  const sectionTitle = {
    dashboard: 'Dashboard', incidents: 'Incidents', announcements: 'Announcements',
    tickets: 'Tickets', tanods: 'Tanods', analytics: 'Analytics',
    users: 'Users', map: 'Incident map', calendar: 'Calendar',
    verifications: 'Verifications', documents: 'Documents',
    blotter: 'Blotter / Lupon'
  }
  const sectionDesc = {
    dashboard: 'What needs the barangay today', incidents: 'Every report, newest first',
    announcements: 'News and alerts for every resident', tickets: 'Questions and requests from residents',
    tanods: 'Who is on duty and how they respond', analytics: 'Trends and response times',
    users: 'Accounts and invite codes', map: 'Reports by place',
    calendar: 'Hearings, appointments and activity by date',
    verifications: 'Confirm who lives in the barangay (RA 7160, Sec. 394)',
    documents: 'Issue documents within the RA 11032 deadline',
    blotter: 'Katarungang Pambarangay: mediation, Pangkat and Certificates to File Action'
  }

  // What the band says above each section (O02–O14): an eyebrow, a title
  // in plain words, one line from the data, and the section's actions.
  // The short name stays the phone title and the browser-tab title.
  function sectionHead(section) {
    const openTickets = tickets.filter(t => !isSettled(t.status)).length
    const onDuty = tanods.filter(t => t.on_duty).length
    const byRole = role => users.filter(u => u.role === role).length
    switch (section) {
      case 'incidents': return {
        eyebrow: 'Incidents', title: 'Reports from residents',
        desc: 'Priorities follow the law behind each category. Critical reports stay at the top.',
        actions: <Button variant="onband" onClick={() => navClick('map')}><MapIcon size={18} aria-hidden="true" />Open map</Button>,
      }
      case 'tickets': return {
        eyebrow: 'Tickets', title: 'Conversations with residents',
        desc: openTickets ? `${plural(openTickets, 'ticket is', 'tickets are')} waiting on a reply.` : 'Every ticket has a reply.',
      }
      case 'documents': return {
        eyebrow: 'Document requests', title: 'Clearances and certificates',
        desc: `${documentCounts.open} in progress.${documentCounts.breach ? ` ${documentCounts.breach} past the Citizen’s Charter deadline (RA 11032).` : ' All within the RA 11032 deadline.'}`,
      }
      case 'verifications': return {
        eyebrow: 'Verifications', title: 'Confirm who lives here',
        desc: pendingVerifications ? `${plural(pendingVerifications, 'resident is', 'residents are')} waiting. RA 7160, Sec. 394.` : 'Nobody is waiting. RA 7160, Sec. 394.',
      }
      case 'blotter': return {
        eyebrow: 'Blotter / Lupon', title: 'Barangay justice cases',
        desc: `${plural(blotterCounts.open, 'case', 'cases')} before the Lupon.${blotterCounts.breach ? ` ${blotterCounts.breach} ${blotterCounts.breach === 1 ? 'is' : 'are'} past the deadline.` : ''}`,
        actions: !blotterFiling && <Button variant="white" onClick={() => setBlotterFiling(true)}><Plus aria-hidden="true" />File a complaint</Button>,
      }
      case 'tanods': return {
        eyebrow: 'Tanod management', title: 'Your tanods',
        desc: tanods.length ? `${onDuty} of ${tanods.length} on duty now.` : 'No tanods yet. Invite one with a tanod code.',
        actions: <Button variant="white" onClick={() => navClick('users')}><Plus aria-hidden="true" />Invite a tanod</Button>,
      }
      case 'users': return {
        eyebrow: 'User management', title: 'People in your barangay',
        desc: `${plural(byRole('resident'), 'resident', 'residents')}, ${plural(byRole('official'), 'official', 'officials')} and ${plural(byRole('tanod'), 'tanod', 'tanods')}.`,
      }
      case 'announcements': return {
        eyebrow: 'Announcements', title: 'Keep everyone informed',
        desc: 'Everyone in the barangay sees these. Phones with notifications on get an alert.',
        actions: <Button variant="white" onClick={() => router.push('/official/announcement/new')}><Plus aria-hidden="true" />New announcement</Button>,
      }
      default: return { title: sectionTitle[section], desc: sectionDesc[section] }
    }
  }
  const head = sectionHead(activeSection)

  // Each section gets its own browser-tab title (history entries, tab strip).
  useEffect(() => { document.title = `${sectionTitle[activeSection] || 'Dashboard'} · BH360` }, [activeSection]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleExportIncidents(format) {
    const columns = [
      { label: 'Title', key: 'title' },
      { label: 'Category', key: 'category' },
      { label: 'Priority', key: 'priority' },
      { label: 'Status', key: 'status' },
      { label: 'Location', key: 'location' },
      { label: 'Reporter', value: (r) => r.profiles?.full_name || '—' },
      { label: 'Description', key: 'description' },
      { label: 'Date Reported', value: (r) => new Date(r.created_at).toLocaleDateString('en-PH', { dateStyle: 'medium' }) },
    ]
    const data = sortedIncidents
    const filename = `incidents-${profile?.barangays?.name?.replace(/\s/g, '-') || 'barangay'}`
    try {
      if (format === 'csv') {
        exportToCSV(data, filename, columns)
      } else {
        await exportToPDF(data, filename, columns, {
          title: 'Incident Report',
          subtitle: `${data.length} incidents`,
          barangay: profile?.barangays ? `${profile.barangays.name}, ${profile.barangays.city}` : '',
          orientation: 'landscape',
          paperSize: 'a4',
        })
      }
      toast.success(`Exported ${data.length} incidents to ${format.toUpperCase()}!`)
    } catch (err) {
      console.error('Export failed:', err)
      toast.error('Export failed. Please try again.')
    }
  }

  async function handleExportTickets(format) {
    const columns = [
      { label: 'Title', key: 'title' },
      { label: 'Status', key: 'status' },
      { label: 'Sender', value: (r) => r.profiles?.full_name || '—' },
      { label: 'Description', key: 'description' },
      { label: 'Date Created', value: (r) => new Date(r.created_at).toLocaleDateString('en-PH', { dateStyle: 'medium' }) },
    ]
    const data = filteredTickets
    const filename = `tickets-${profile?.barangays?.name?.replace(/\s/g, '-') || 'barangay'}`
    try {
      if (format === 'csv') {
        exportToCSV(data, filename, columns)
      } else {
        await exportToPDF(data, filename, columns, {
          title: 'Ticket Report',
          subtitle: `${data.length} tickets`,
          barangay: profile?.barangays ? `${profile.barangays.name}, ${profile.barangays.city}` : '',
          orientation: 'portrait',
          paperSize: 'a4',
        })
      }
      toast.success(`Exported ${data.length} tickets to ${format.toUpperCase()}!`)
    } catch (err) {
      console.error('Export failed:', err)
      toast.error('Export failed. Please try again.')
    }
  }

  async function handleExportUsers(format) {
    const columns = [
      { label: 'Full Name', key: 'full_name' },
      { label: 'Role', key: 'role' },
      { label: 'Phone', key: 'phone' },
      { label: 'Address', key: 'address' },
      { label: 'Joined', value: (r) => new Date(r.created_at).toLocaleDateString('en-PH', { dateStyle: 'medium' }) },
    ]
    const data = filteredUsers // exports respect the search/role filter, like incidents do
    const filename = `users-${profile?.barangays?.name?.replace(/\s/g, '-') || 'barangay'}`
    try {
      if (format === 'csv') {
        exportToCSV(data, filename, columns)
      } else {
        await exportToPDF(data, filename, columns, {
          title: 'User Directory',
          subtitle: `${data.length} registered users${userRoleFilter !== 'all' ? ` (${userRoleFilter}s)` : ''}`,
          barangay: profile?.barangays ? `${profile.barangays.name}, ${profile.barangays.city}` : '',
          orientation: 'portrait',
          paperSize: 'a4',
        })
      }
      toast.success(`Exported ${data.length} users to ${format.toUpperCase()}!`)
    } catch (err) {
      console.error('Export failed:', err)
      toast.error('Export failed. Please try again.')
    }
  }

  // Sections animate in when the user switches to one — not when the page
  // first loads (lib/useSectionEntrance.js).
  const entering = useSectionEntrance(activeSection, !loading)

  // While loading, the same frame the static HTML showed before JavaScript
  // ran — now with the real sidebar width and banner — so a refresh shows
  // one skeleton throughout, then the content in its place.
  if (loading) {
    return (
      <DashboardShellSkeleton path="/official" kind={OFFICIAL_SKELETONS[activeSection]} section={activeSection}
        sidebarOpen={sidebarOpen} banner={<NotificationBanner />} />
    )
  }

  return (
    <>
      <DashboardFrame mainRef={mainRef} sidebarOpen={sidebarOpen}
        sidebar={<DashboardSidebar
        profile={profile}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        roleLabel="Barangay Official"
        navItems={[
          { section: 'MAIN', items: [
            { key: 'dashboard', label: 'Dashboard', icon: DashboardIcon },
            { key: 'incidents', label: 'Incidents', icon: IncidentsIcon, count: incidents.filter(i => i.status === 'pending').length, hasNew: incidents.filter(i => i.status === 'pending').length > 0 },
            { key: 'announcements', label: 'Announcements', icon: AnnouncementsIcon },
          ]},
          { section: 'MANAGE', items: [
            { key: 'tickets', label: 'Tickets', icon: TicketsIcon, count: tickets.filter(t => t.status === 'open').length, hasNew: tickets.filter(t => t.status === 'open').length > 0 },
            { key: 'documents', label: 'Documents', icon: DocumentsIcon, count: documentCounts.open, badge: documentCounts.breach > 0 ? 'OVERDUE' : undefined, hasNew: documentCounts.open > 0 },
            { key: 'verifications', label: 'Verifications', icon: VerificationsIcon, count: pendingVerifications, hasNew: pendingVerifications > 0 },
            { key: 'blotter', label: 'Blotter / Lupon', icon: BlotterIcon, count: blotterCounts.open, badge: blotterCounts.breach > 0 ? 'OVERDUE' : undefined },
            { key: 'tanods', label: 'Tanods', icon: TanodsIcon },
            { key: 'users', label: 'Users', icon: UsersIcon },
          ]},
          { section: 'TOOLS', items: [
            { key: 'map', label: 'Incident map', icon: MapIcon },
            { key: 'calendar', label: 'Calendar', icon: CalendarIcon },
            { key: 'analytics', label: 'Analytics', icon: AnalyticsIcon },
          ]},
        ]}
      />}
        header={<DashboardHeader
          profile={profile}
          columnClass={'max-w-[100rem]'}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          sectionTitle={head.title}
          sectionDesc={head.desc}
          eyebrow={head.eyebrow}
          actions={head.actions}
          heading={activeSection === 'dashboard' && profile?.barangay_id ? (
            <div className="flex items-end gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold tracking-[0.08em] text-white/75 uppercase">{todayLabel}</p>
                <h1 className="mt-1.5 text-[26px] font-extrabold leading-tight tracking-[-0.6px] text-white">
                  {greeting()}{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}.
                </h1>
                <p className="mt-1.5 text-sm text-white/88 max-w-[70ch]">{officialBrief.text}</p>
              </div>
              <div className="hidden desk:flex shrink-0 gap-2">
                <Button variant="onband" onClick={() => navClick('map')}><MapIcon size={18} aria-hidden="true" />Open map</Button>
                <Button variant="white" onClick={() => router.push('/official/announcement/new')}><AnnouncementsIcon size={18} aria-hidden="true" />New announcement</Button>
              </div>
            </div>
          ) : undefined}
          phoneTitle={sectionTitle[activeSection]}
          notificationCenter={notificationCenter}
          searchData={{
            incidents,
            tickets,
            announcements,
          }}
          onSearchResultClick={(type, item) => {
            if (type === 'incidents') setActiveSection('incidents')
            if (type === 'tickets') router.push(`/official/ticket/${item.id}`)
            if (type === 'announcements') setActiveSection('announcements')
          }}>
          {activeSection === 'dashboard' && profile?.barangay_id && (
            <div className="band-slot"><StatStrip stats={officialStats} className="sm:grid-flow-row sm:grid-cols-3 xl:grid-flow-col xl:grid-cols-none" /></div>
          )}
        </DashboardHeader>}>

          <div className="mx-auto w-full max-w-[100rem]">
           <NotificationBanner />
           <AppointmentReminderWatcher profile={profile} />

          {/* Keyed on the section: switching sections remounts it, which
              eases the new section in (only after a switch — see `entering`
              above and components/SectionContent.jsx). */}
          <SectionContent key={activeSection} entering={entering}>
          {!loading && !profile?.barangay_id && (
            <Card className="mx-auto max-w-2xl px-[18px] py-5">
              <h2 className="text-[15px] font-extrabold text-ink">No barangay on this account</h2>
              <p className="mt-1 text-[13px] text-muted-foreground">Your official account isn&apos;t linked to a barangay yet. Ask your system administrator to link it.</p>
            </Card>
          )}

          {!loading && profile?.barangay_id && activeSection === 'dashboard' && (
            <div className="grid items-start gap-3.5 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
              <div className="min-w-0">
                <WaitingCard items={waiting} onAct={actOnWaiting} />
              </div>
              <div className="flex min-w-0 flex-col gap-3.5">
                <TodayCard appointments={todayAppointments}
                  readyDocuments={documentRequests.filter(d => d.status === 'ready').length}
                  onOpenCalendar={() => router.push('/official/calendar')}
                  onOpenDocuments={() => navClick('documents')} />
                <TanodRoster profile={profile} />
                <RecentIncidentsCard incidents={incidents.slice(0, 4)}
                  onOpen={inc => router.push(`/official/incident/${inc.id}`)}
                  onViewAll={() => navClick('incidents')} />
              </div>
            </div>
          )}

          {!loading && profile?.barangay_id && activeSection === 'incidents' && (
            <IncidentsSection
              hasMore={incidentsHasMore}
              loadingMore={loadingMoreIncidents}
              onLoadMore={loadMoreIncidents}
              incidents={incidents}
              tanods={tanods}
              onDispatch={dispatchTanod}
              onResolve={resolveIncident}
              onExport={(format, data) => handleExportIncidents(format, data)}
              onPriorityChange={handlePriorityChange}     
            />
          )}

          {!loading && profile?.barangay_id && activeSection === 'tickets' && (
            <TicketsSection tickets={tickets} filtered={filteredTickets} now={now}
              search={ticketSearch} onSearch={setTicketSearch}
              filter={ticketFilter} onFilter={setTicketFilter}
              onOpen={t => router.push(`/official/ticket/${t.id}`)}
              onExport={handleExportTickets} />
          )}

          {!loading && profile?.barangay_id && activeSection === 'announcements' && (
            <AnnouncementsSection announcements={announcements} now={now}
              onNew={() => router.push('/official/announcement/new')} />
          )}

          {!loading && profile?.barangay_id && activeSection === 'tanods' && (
            <TanodManagement
              profile={profile}
              onInvite={() => navClick('users')}
              onOpenIncident={id => router.push(`/official/incident/${id}`)}
            />
          )}

          {!loading && profile?.barangay_id && activeSection === 'analytics' && (
            <SectionLauncher icon={AnalyticsIcon} title="Analytics" href="/official/analytics" cta="Open analytics"
              body="Reports by category and place, response times, the tanod leaderboard and an AI summary." onOpen={href => router.push(href)} />
          )}

          {!loading && profile?.barangay_id && activeSection === 'users' && (
            <UsersSection users={users} filtered={filteredUsers}
              search={userSearch} onSearch={setUserSearch}
              role={userRoleFilter} onRole={setUserRoleFilter}
              inviteCodes={inviteCodes} generating={generatingCode}
              onGenerate={generateInviteCode} onCopy={copyToClipboard}
              onExport={handleExportUsers}
              onReview={() => navClick('verifications')} />
          )}

          {!loading && profile?.barangay_id && activeSection === 'verifications' && (
            <div className="">
              <VerificationQueue
                profile={profile}
                users={users}
                onUpdated={handleVerificationUpdated}
              />
            </div>
          )}

          {!loading && profile?.barangay_id && activeSection === 'documents' && (
            <div className="">
              <DocumentQueue
                profile={profile}
                requests={documentRequests}
                onUpdated={handleDocumentUpdated}
              />
            </div>
          )}

          {!loading && profile?.barangay_id && activeSection === 'blotter' && (
            <div className="">
              <BlotterQueue
                profile={profile}
                cases={blotterCases}
                incidents={incidents}
                residents={users.filter(u => u.role === 'resident')}
                onChanged={handleBlotterChanged}
                filing={blotterFiling}
                onFilingChange={setBlotterFiling}
              />
            </div>
          )}

          {!loading && profile?.barangay_id && activeSection === 'map' && (
            <SectionLauncher icon={MapIcon} title="Incident map" href="/official/map" cta="Open the map"
              body="Every open report and on-duty tanod on the map, live, with dispatch from the map." onOpen={href => router.push(href)} />
          )}

          {!loading && profile?.barangay_id && activeSection === 'calendar' && (
            <SectionLauncher icon={CalendarIcon} title="Calendar" href="/official/calendar" cta="Open the calendar"
              body="Hearings, appointments, reports and announcements by day, with reminders." onOpen={href => router.push(href)} />
          )}
          </SectionContent>
          </div>
      </DashboardFrame>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={!!confirmDialog}
        onClose={() => setConfirmDialog(null)}
        onConfirm={confirmDialog?.onConfirm}
        title={confirmDialog?.title}
        message={confirmDialog?.message}
        confirmText={confirmDialog?.confirmText}
        variant={confirmDialog?.variant || 'danger'}
      />
       <CriticalAlert
        incidents={incidents}
        onAcknowledge={acknowledgeCritical}
        onView={(inc) => router.push(`/official/incident/${inc.id}`)}   
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
export default function OfficialDashboardPage() {
  return (
    <>
      <DashboardBackdrop />
      <ClientBoundary fallback={<DashboardShellSkeleton path="/official" />}>
        <OfficialDashboard />
      </ClientBoundary>
    </>
  )
}
