'use client'
import { useRouter } from 'next/navigation'
import DashboardFrame from '@/components/crafted/DashboardFrame'
import DashboardSidebar from '@/components/DashboardSidebar'
import DashboardHeader from '@/components/DashboardHeader'
import {
  AnalyticsIcon, AnnouncementsIcon, BlotterIcon, CalendarIcon, DashboardIcon, DocumentsIcon,
  IncidentsIcon, MapIcon, TanodsIcon, TicketsIcon, UsersIcon, VerificationsIcon,
} from '@/components/icons/BhIcons'
import { useNotifications } from '@/lib/useNotifications'
import { useSidebarState } from '@/lib/useSidebarState'
import { isPhoneLayout } from '@/lib/layout'

/**
 * The official's sidebar, in one place for the dashboard and the TOOLS
 * pages. `counts` are the dashboard's live numbers; the tool pages pass
 * none (they don't load the queues), so their sidebar shows no counts.
 */
export function officialNavItems(counts = {}) {
  const n = (count, extra = {}) => (count == null ? {} : { count, hasNew: count > 0, ...extra })
  return [
    { section: 'MAIN', items: [
      { key: 'dashboard', label: 'Dashboard', icon: DashboardIcon },
      { key: 'incidents', label: 'Incidents', icon: IncidentsIcon, ...n(counts.incidents) },
      { key: 'announcements', label: 'Announcements', icon: AnnouncementsIcon },
    ]},
    { section: 'MANAGE', items: [
      { key: 'tickets', label: 'Tickets', icon: TicketsIcon, ...n(counts.tickets) },
      { key: 'documents', label: 'Documents', icon: DocumentsIcon, ...n(counts.documents, { badge: counts.documentsBreach > 0 ? 'OVERDUE' : undefined }) },
      { key: 'verifications', label: 'Verifications', icon: VerificationsIcon, ...n(counts.verifications) },
      { key: 'blotter', label: 'Blotter / Lupon', icon: BlotterIcon, ...(counts.blotter == null ? {} : { count: counts.blotter, badge: counts.blotterBreach > 0 ? 'OVERDUE' : undefined }) },
      { key: 'tanods', label: 'Tanods', icon: TanodsIcon },
      { key: 'users', label: 'Users', icon: UsersIcon },
    ]},
    { section: 'TOOLS', items: [
      { key: 'map', label: 'Incident map', icon: MapIcon },
      { key: 'calendar', label: 'Calendar', icon: CalendarIcon },
      { key: 'analytics', label: 'Analytics', icon: AnalyticsIcon },
    ]},
  ]
}

/** TOOLS entries that are pages of their own (the rest are dashboard sections). */
export const OFFICIAL_TOOL_PAGES = {
  map: '/official/map',
  calendar: '/official/calendar',
  analytics: '/official/analytics',
}

/** Where a sidebar key goes from a page outside the dashboard. */
export function officialHref(key) {
  return OFFICIAL_TOOL_PAGES[key] || (key === 'dashboard' ? '/official' : `/official?section=${key}`)
}

const NO_SEARCH = { incidents: [], tickets: [], announcements: [] }

/**
 * A TOOLS page (Calendar O12, Analytics O14) inside the official's desktop
 * shell: the sidebar, then the band with the context line, search, the
 * bell and the account menu, the eyebrow, title, line and actions. Phones
 * get the band and the drawer, like the dashboard. `band` sits on the band
 * under the title (a stat strip).
 */
export default function OfficialShell({ profile, active, eyebrow, title, desc, actions, band, children }) {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useSidebarState()
  const notificationCenter = useNotifications(profile?.id, { silentTypes: ['incident_new'] })

  function go(key) {
    if (isPhoneLayout()) setSidebarOpen(false)
    if (key !== active) router.push(officialHref(key))
  }

  return (
    <DashboardFrame sidebarOpen={sidebarOpen}
      sidebar={<DashboardSidebar profile={profile} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}
        activeSection={active} setActiveSection={go} navItems={officialNavItems()} roleLabel="Barangay Official" />}
      header={<DashboardHeader profile={profile} columnClass="max-w-[100rem]"
        sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}
        eyebrow={eyebrow} sectionTitle={title} sectionDesc={desc} actions={actions}
        phoneTitle={officialNavItems().flatMap(g => g.items).find(i => i.key === active)?.label}
        notificationCenter={notificationCenter}
        searchData={NO_SEARCH}
        onSearchResultClick={() => {}}>
        {band && <div className="band-slot">{band}</div>}
      </DashboardHeader>}>
      <div className="mx-auto w-full max-w-[100rem]">{children}</div>
    </DashboardFrame>
  )
}
