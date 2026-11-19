'use client'
import { useMemo, useState } from 'react'
import DashboardFrame from '@/components/crafted/DashboardFrame'
import DashboardSidebar from '@/components/DashboardSidebar'
import DashboardHeader from '@/components/DashboardHeader'
import {
  DashboardIcon, IncidentsIcon, AnnouncementsIcon, TicketsIcon, DocumentsIcon, VerificationsIcon, BlotterIcon,
  TanodsIcon, UsersIcon, MapIcon, CalendarIcon, AnalyticsIcon,
} from '@/components/icons/BhIcons'
import { Button } from '@/components/ui/button'
import { StatStrip } from '@/components/ui/stat-strip'
import { WaitingCard, RecentIncidentsCard, TodayCard } from '@/components/official/OfficialSections'
import IncidentsSection from '@/components/IncidentsSection'
import DocumentQueue from '@/components/DocumentQueue'
import VerificationQueue from '@/components/VerificationQueue'
import BlotterQueue from '@/components/BlotterQueue'
import TicketsSection from '@/components/official/TicketsSection'
import TanodManagement from '@/components/TanodManagement'
import UsersSection from '@/components/official/UsersSection'
import AnnouncementsSection from '@/components/official/AnnouncementsSection'
import { waitingOnOfficial } from '@/lib/officialQueue'
import { useSidebarState } from '@/lib/useSidebarState'
import { useNow } from '@/lib/useNow'
import { useHydrated } from '@/lib/useHydrated'
import { PROFILE, TANODS, INCIDENTS, TICKETS, USERS, DOCUMENTS, CASES, ANNOUNCEMENTS, APPOINTMENTS } from './fixtures'

// The band heading per section, as app/official/page.jsx sets it.
const HEADS = {
  incidents: { eyebrow: 'Incidents', title: 'Reports from residents', desc: 'Priorities follow the law behind each category. Critical reports stay at the top.', map: true },
  tickets: { eyebrow: 'Tickets', title: 'Conversations with residents', desc: '2 tickets are waiting on a reply.' },
  documents: { eyebrow: 'Document requests', title: 'Clearances and certificates', desc: '3 in progress. 1 past the Citizen’s Charter deadline (RA 11032).' },
  verifications: { eyebrow: 'Verifications', title: 'Confirm who lives here', desc: '2 residents are waiting. RA 7160, Sec. 394.' },
  blotter: { eyebrow: 'Blotter / Lupon', title: 'Barangay justice cases', desc: '2 cases before the Lupon. 1 is past the deadline.' },
  tanods: { eyebrow: 'Tanod management', title: 'Your tanods', desc: '1 of 2 on duty now.' },
  users: { eyebrow: 'User management', title: 'People in your barangay', desc: '3 residents, 1 official and 2 tanods.' },
  announcements: { eyebrow: 'Announcements', title: 'Keep everyone informed', desc: 'Everyone in the barangay sees these. Phones with notifications on get an alert.' },
}

const NOTIFICATIONS = { items: [], unread: 0, markAllRead() {}, openItem() {} }
const noop = () => {}

const NAV = [
  { section: 'MAIN', items: [
    { key: 'dashboard', label: 'Dashboard', icon: DashboardIcon },
    { key: 'incidents', label: 'Incidents', icon: IncidentsIcon, count: 2, hasNew: true },
    { key: 'announcements', label: 'Announcements', icon: AnnouncementsIcon },
  ]},
  { section: 'MANAGE', items: [
    { key: 'tickets', label: 'Tickets', icon: TicketsIcon, count: 2, hasNew: true },
    { key: 'documents', label: 'Documents', icon: DocumentsIcon, count: 3, badge: 'OVERDUE' },
    { key: 'verifications', label: 'Verifications', icon: VerificationsIcon, count: 2, hasNew: true },
    { key: 'blotter', label: 'Blotter / Lupon', icon: BlotterIcon, count: 2, badge: 'OVERDUE' },
    { key: 'tanods', label: 'Tanods', icon: TanodsIcon },
    { key: 'users', label: 'Users', icon: UsersIcon },
  ]},
  { section: 'TOOLS', items: [
    { key: 'map', label: 'Incident map', icon: MapIcon },
    { key: 'calendar', label: 'Calendar', icon: CalendarIcon },
    { key: 'analytics', label: 'Analytics', icon: AnalyticsIcon },
  ]},
]

/** The official dashboard's sections with invented data (fixtures.js), for
 *  checking the Crafted styling without an official account. Actions do
 *  nothing; components that load their own data show their empty state. */
/** The fixtures' times come from Date.now() when the module loads, so the
 *  server and the browser would disagree on every "4m ago": render in the
 *  browser only, after hydration, so there is nothing to mismatch. */
export default function OfficialPreview(props) {
  const hydrated = useHydrated()
  return hydrated ? <PreviewBody {...props} /> : null
}

function PreviewBody({ initial }) {
  const [section, setSection] = useState(initial)
  const [sidebarOpen, setSidebarOpen] = useSidebarState(false)
  const title = NAV.flatMap(g => g.items).find(i => i.key === section)?.label
  const waiting = useMemo(() => waitingOnOfficial({
    incidents: INCIDENTS, tickets: TICKETS, cases: CASES, documents: DOCUMENTS, users: USERS, selfId: PROFILE.id,
  }), [])

  const home = section === 'dashboard'
  const now = useNow()
  const [userRole, setUserRole] = useState('resident')
  const [ticketSearch, setTicketSearch] = useState('')
  const [ticketFilter, setTicketFilter] = useState('all')
  const tickets = TICKETS.filter(t => (ticketFilter === 'all' || t.status === ticketFilter) && t.title.toLowerCase().includes(ticketSearch.toLowerCase()))
  return (
    <DashboardFrame sidebarOpen={sidebarOpen}
      sidebar={<DashboardSidebar profile={PROFILE} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}
        activeSection={section} setActiveSection={setSection} navItems={NAV} roleLabel="Barangay Official" />}
      header={<DashboardHeader profile={PROFILE} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}
        columnClass="max-w-[100rem]" sectionTitle={HEADS[section]?.title || title} sectionDesc={HEADS[section]?.desc || 'Sample subtitle'}
        eyebrow={HEADS[section]?.eyebrow}
        actions={HEADS[section]?.map ? <Button variant="onband"><MapIcon size={18} aria-hidden="true" />Open map</Button> : undefined}
        heading={home ? (
          <div className="flex items-end gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold tracking-[0.08em] text-white/75 uppercase">Wednesday, November 18</p>
              <h1 className="mt-1.5 text-[26px] font-extrabold leading-tight tracking-[-0.6px] text-white">Magandang hapon, Sample.</h1>
              <p className="mt-1.5 text-sm text-white/88 max-w-[70ch]">A sample summary sentence about what needs the barangay.</p>
            </div>
            <div className="hidden desk:flex shrink-0 gap-2">
              <Button variant="onband"><MapIcon size={18} aria-hidden="true" />Open map</Button>
              <Button variant="white"><AnnouncementsIcon size={18} aria-hidden="true" />New announcement</Button>
            </div>
          </div>
        ) : undefined}
        phoneTitle={title}
        notificationCenter={NOTIFICATIONS}>
        {home && (
          <div className="band-slot">
            <StatStrip className="sm:grid-flow-row sm:grid-cols-3 xl:grid-flow-col xl:grid-cols-none" stats={[
              { label: 'Unassigned reports', value: 2, note: '3 open' },
              { label: 'Tanods on duty', value: '1 of 2', tone: 'ok', note: 'on duty now' },
              { label: 'Tickets to reply', value: 2, note: 'oldest 3h ago' },
              { label: 'Documents waiting', value: 3, noteTone: 'danger', note: '1 past the deadline' },
              { label: 'Residents to verify', value: 2, note: 'oldest 1d ago' },
              { label: 'Overdue KP case', value: 1, tone: 'danger', noteTone: 'default', note: '2 open' },
            ]} />
          </div>
        )}
      </DashboardHeader>}>
      <div className="mx-auto w-full max-w-[100rem]">
        {home && (
          <div className="grid items-start gap-3.5 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
            <div className="min-w-0"><WaitingCard items={waiting} onAct={noop} /></div>
            <div className="flex min-w-0 flex-col gap-3.5">
              <TodayCard appointments={APPOINTMENTS} readyDocuments={1} onOpenCalendar={noop} onOpenDocuments={noop} />
              <RecentIncidentsCard incidents={INCIDENTS} onOpen={noop} onViewAll={noop} />
            </div>
          </div>
        )}
        {section === 'incidents' && (
          <IncidentsSection incidents={INCIDENTS} tanods={TANODS} hasMore={false} loadingMore={false}
            onLoadMore={noop} onDispatch={noop} onResolve={noop} onExport={noop} onPriorityChange={noop} />
        )}
        {section === 'tickets' && (
          <TicketsSection tickets={TICKETS} filtered={tickets} now={now} search={ticketSearch} onSearch={setTicketSearch}
            filter={ticketFilter} onFilter={setTicketFilter} onOpen={noop} onExport={noop} />
        )}
        {section === 'announcements' && <AnnouncementsSection announcements={ANNOUNCEMENTS} now={now} onNew={noop} />}
        {section === 'users' && (
          <UsersSection users={USERS} filtered={USERS.filter(u => userRole === 'all' || u.role === userRole)} search="" onSearch={noop}
            role={userRole} onRole={setUserRole} generating={false} onGenerate={noop} onCopy={noop} onExport={noop} onReview={noop}
            inviteCodes={[{ id: 'c1', code: 'SMP-OFF-0000', role: 'official' }, { id: 'c2', code: 'SMP-TAN-0001', role: 'tanod', used: true, used_by: 't2' }]} />
        )}
        {section === 'tanods' && <TanodManagement profile={PROFILE} onInvite={noop} onOpenIncident={noop} />}
        {section === 'documents' && <DocumentQueue profile={PROFILE} requests={DOCUMENTS} onUpdated={noop} />}
        {section === 'verifications' && <VerificationQueue profile={PROFILE} users={USERS} onUpdated={noop} />}
        {section === 'blotter' && <BlotterQueue profile={PROFILE} cases={CASES} incidents={INCIDENTS} residents={USERS.filter(u => u.role === 'resident')} onChanged={noop} />}
        {!['dashboard', 'incidents', 'announcements', 'tickets', 'users', 'tanods', 'documents', 'verifications', 'blotter'].includes(section) && (
          <p className="text-sm text-muted-foreground">Not in the preview yet: {section}.</p>
        )}
      </div>
    </DashboardFrame>
  )
}
