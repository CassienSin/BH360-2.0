'use client'
import { useState } from 'react'
import { MapPin, Plus } from 'lucide-react'
import DashboardFrame from '@/components/crafted/DashboardFrame'
import TabBar from '@/components/crafted/TabBar'
import DashboardSidebar from '@/components/DashboardSidebar'
import DashboardHeader from '@/components/DashboardHeader'
import {
  DashboardIcon, IncidentsIcon, AnnouncementsIcon, TicketsIcon, DocumentsIcon, VerificationsIcon, BlotterIcon,
  TanodsIcon, UsersIcon, MapIcon, CalendarIcon, AnalyticsIcon, HomeIcon, AiIcon, PerformanceIcon,
  InfrastructureIcon, NoiseIcon, FloodIcon,
} from '@/components/icons/BhIcons'
import { Button } from '@/components/ui/button'
import { Card, CardHead } from '@/components/ui/card'
import { StatStrip } from '@/components/ui/stat-strip'
import { Rows, Row, RowTitle } from '@/components/ui/table'
import { Status } from '@/components/ui/tag'
import { useSidebarState } from '@/lib/useSidebarState'

// Invented sample data: nothing here is read from or written to Supabase.
const PROFILE = { id: 'sample', full_name: 'Sample User', barangays: { name: 'Sample Barangay', city: 'Sample City' } }
const NOTIFICATIONS = { items: [], unread: 0, markAllRead() {}, openItem() {} }

const NAV = {
  official: [
    { section: 'MAIN', items: [
      { key: 'dashboard', label: 'Dashboard', icon: DashboardIcon },
      { key: 'incidents', label: 'Incidents', icon: IncidentsIcon, count: 3 },
      { key: 'announcements', label: 'Announcements', icon: AnnouncementsIcon },
    ]},
    { section: 'MANAGE', items: [
      { key: 'tickets', label: 'Tickets', icon: TicketsIcon, count: 2 },
      { key: 'documents', label: 'Documents', icon: DocumentsIcon },
      { key: 'verifications', label: 'Verifications', icon: VerificationsIcon, count: 2 },
      { key: 'blotter', label: 'Blotter / Lupon', icon: BlotterIcon, count: 1, badge: 'OVERDUE' },
      { key: 'tanods', label: 'Tanods', icon: TanodsIcon },
      { key: 'users', label: 'Users', icon: UsersIcon },
    ]},
    { section: 'TOOLS', items: [
      { key: 'map', label: 'Incident map', icon: MapIcon },
      { key: 'calendar', label: 'Calendar', icon: CalendarIcon },
      { key: 'analytics', label: 'Analytics', icon: AnalyticsIcon },
    ]},
  ],
  resident: [
    { section: 'MAIN', items: [
      { key: 'home', label: 'Home', icon: HomeIcon },
      { key: 'announcements', label: 'Announcements', icon: AnnouncementsIcon, count: 1 },
    ]},
    { section: 'MY ACTIVITY', items: [
      { key: 'incidents', label: 'My reports', icon: IncidentsIcon },
      { key: 'tickets', label: 'My tickets', icon: TicketsIcon },
      { key: 'documents', label: 'My documents', icon: DocumentsIcon },
      { key: 'blotter', label: 'My cases', icon: BlotterIcon },
    ]},
    { section: 'SUPPORT', items: [{ key: 'ai', label: 'AI Assistant', icon: AiIcon }]},
  ],
  tanod: [
    { section: 'MAIN', items: [
      { key: 'home', label: 'Duty', icon: HomeIcon },
      { key: 'active', label: 'Assigned', icon: IncidentsIcon, count: 3 },
      { key: 'stats', label: 'Stats', icon: PerformanceIcon },
    ]},
  ],
}

const ROLE = {
  official: { label: 'Barangay Official', home: 'dashboard', column: 'max-w-[100rem]' },
  resident: { label: 'Resident', home: 'home', column: 'max-w-4xl' },
  tanod: { label: 'Tanod', home: 'home', column: 'max-w-2xl' },
}

export default function FramePreview({ role }) {
  const cfg = ROLE[role]
  const [section, setSection] = useState(cfg.home)
  const [sidebarOpen, setSidebarOpen] = useSidebarState(false)
  const title = NAV[role].flatMap(g => g.items).find(i => i.key === section)?.label

  return (
    <DashboardFrame sidebarOpen={sidebarOpen}
      tabBar={role !== 'official' ? <TabBar role={role} activeSection={section} onSelect={setSection} /> : null}
      sidebar={<DashboardSidebar profile={{ ...PROFILE, role }} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}
        activeSection={section} setActiveSection={setSection} navItems={NAV[role]} roleLabel={cfg.label} />}
      header={<DashboardHeader profile={{ ...PROFILE, role }} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}
        columnClass={cfg.column} eyebrow={role === 'official' ? 'Sample eyebrow' : undefined}
        sectionTitle={title} sectionDesc="Sample subtitle under the title."
        actions={role === 'official' ? <><Button variant="onband"><MapPin /> Open map</Button><Button variant="white"><Plus /> New announcement</Button></> : null}
        notificationCenter={NOTIFICATIONS} />}>
      <div className={`${cfg.column} mx-auto space-y-5`}>
        <StatStrip stats={[
          { label: 'Unassigned reports', value: 0, note: '2 this month' },
          { label: 'Tanods on duty', value: '1 of 2', note: 'one on a call', tone: 'ok' },
          { label: 'Tickets to reply', value: 2, note: 'oldest 3 h' },
          { label: 'Overdue KP case', value: 1, note: '2 days past', tone: 'danger' },
        ]} />
        <Card>
          <CardHead title="Waiting on you" sub="Sample rows" action={<Button variant="ghost" size="sm">View all</Button>} />
          <Rows className="border-t border-line">
            <Row className="flex items-center gap-3"><InfrastructureIcon size={20} className="text-brand-strong" /><RowTitle className="flex-1" title="Streetlight out" sub="Ticket · Purok 2" /><Status tone="warn">Waiting 3 h</Status></Row>
            <Row className="flex items-center gap-3"><NoiseIcon size={20} className="text-brand-strong" /><RowTitle className="flex-1" title="Loud karaoke" sub="Report · Purok 3" /><Status tone="info">Assigned</Status></Row>
            <Row critical className="flex items-center gap-3"><FloodIcon size={20} className="text-danger" /><RowTitle className="flex-1" title="Flooding near the creek" sub="Report · Riverside" /><Status tone="danger">Unassigned</Status></Row>
          </Rows>
        </Card>
        {[1, 2, 3].map(i => (
          <Card key={i} className="p-[18px]"><p className="text-sm text-body">Filler card {i}, so the page scrolls under the band and above the tab bar.</p></Card>
        ))}
      </div>
    </DashboardFrame>
  )
}
