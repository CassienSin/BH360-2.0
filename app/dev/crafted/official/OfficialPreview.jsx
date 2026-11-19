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
import { WaitingCard, RecentIncidentsCard } from '@/components/official/OfficialSections'
import IncidentsSection from '@/components/IncidentsSection'
import DocumentQueue from '@/components/DocumentQueue'
import VerificationQueue from '@/components/VerificationQueue'
import BlotterQueue from '@/components/BlotterQueue'
import { waitingOnOfficial } from '@/lib/officialQueue'
import { useSidebarState } from '@/lib/useSidebarState'
import { PROFILE, TANODS, INCIDENTS, TICKETS, USERS, DOCUMENTS, CASES, ANNOUNCEMENTS } from './fixtures'

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
export default function OfficialPreview({ initial }) {
  const [section, setSection] = useState(initial)
  const [sidebarOpen, setSidebarOpen] = useSidebarState(false)
  const title = NAV.flatMap(g => g.items).find(i => i.key === section)?.label
  const waiting = useMemo(() => waitingOnOfficial({
    incidents: INCIDENTS, tickets: TICKETS, cases: CASES, documents: DOCUMENTS, users: USERS, selfId: PROFILE.id,
  }), [])

  const home = section === 'dashboard'
  return (
    <DashboardFrame sidebarOpen={sidebarOpen}
      sidebar={<DashboardSidebar profile={PROFILE} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}
        activeSection={section} setActiveSection={setSection} navItems={NAV} roleLabel="Barangay Official" />}
      header={<DashboardHeader profile={PROFILE} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}
        columnClass="max-w-[100rem]" sectionTitle={title} sectionDesc="Sample subtitle"
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
        phoneTitle={home ? 'Dashboard' : undefined}
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
            <div className="flex min-w-0 flex-col gap-3.5">
              <WaitingCard items={waiting} onAct={noop} />
              <RecentIncidentsCard incidents={INCIDENTS} onOpen={noop} onViewAll={noop} />
            </div>
          </div>
        )}
        {section === 'incidents' && (
          <IncidentsSection incidents={INCIDENTS} tanods={TANODS} hasMore={false} loadingMore={false}
            onLoadMore={noop} onDispatch={noop} onResolve={noop} onExport={noop} onPriorityChange={noop} />
        )}
        {section === 'documents' && <DocumentQueue profile={PROFILE} requests={DOCUMENTS} onUpdated={noop} />}
        {section === 'verifications' && <VerificationQueue profile={PROFILE} users={USERS} onUpdated={noop} />}
        {section === 'blotter' && <BlotterQueue profile={PROFILE} cases={CASES} incidents={INCIDENTS} residents={USERS} onChanged={noop} />}
        {!['dashboard', 'incidents', 'documents', 'verifications', 'blotter'].includes(section) && (
          <p className="text-sm text-muted-foreground">Not in the preview yet: {section}. ({TICKETS.length} tickets, {ANNOUNCEMENTS.length} announcements in the fixtures.)</p>
        )}
      </div>
    </DashboardFrame>
  )
}
