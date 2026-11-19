/**
 * Loading placeholders. Each one mirrors the layout of the content it
 * stands in for — same widths, heights and columns, measured against the
 * real screens — so when the data lands nothing jumps: the blocks are
 * simply replaced in place.
 *
 * They show immediately. (An earlier version hid every skeleton for its
 * first 150ms to spare fast loads a flash; but a skeleton only ever replaces
 * a page that is already gone, so the delay just showed an empty purple
 * screen instead — twice per refresh, as each new skeleton restarted it.)
 *
 * Static chrome that never depends on data — page titles, the logo, the
 * notification banner — is drawn for real, so it doesn't change either.
 *
 * They live at module level on purpose: declared inside a page component
 * they become a new component type on every render, and React remounts
 * them each time (restarting the shimmer).
 */
import Image from 'next/image'
import { ArrowLeft, Bell, Menu, Search } from 'lucide-react'
import { NotificationBannerView } from '@/components/NotificationBanner'
import { DASHBOARD_SKELETONS, dashboardKinds, dashboardColumn } from '@/lib/dashboardSkeletons'
import ui from '@/components/app-ui.module.css'
import header from '@/components/dashboard-header.module.css'
import Band from '@/components/crafted/Band'
import DashboardFrame from '@/components/crafted/DashboardFrame'
import TabBar from '@/components/crafted/TabBar'
import PageShell from '@/components/crafted/PageShell'

/** One shimmering block. tone="brand" for use on the purple background. */
export function Skeleton({ className = '', style, tone, as: Tag = 'div' }) {
  // as="span" (displayed as a block) where the bar stands in for text inside
  // a heading or paragraph: a <div> there is invalid HTML.
  return (
    <Tag
      className={`skeleton-shimmer ${tone === 'brand' ? 'skeleton-on-brand' : ''} ${Tag === 'span' ? 'block' : ''} ${className}`}
      style={style}
      aria-hidden="true"
    />
  )
}

/* ----------------------------------------------------------------------
   Dashboard sections
   ---------------------------------------------------------------------- */

/** One list card: icon tile, title and two text lines. */
function RecordCardSkeleton() {
  return (
    <div className="white-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <Skeleton className="w-10 h-10 rounded-[10px] flex-shrink-0" />
        <div className="flex-1 space-y-2.5 pt-0.5">
          <Skeleton className="h-4 w-1/2" />
          <div className="flex gap-2">
            <Skeleton className="h-4 w-16 rounded-full" />
            <Skeleton className="h-4 w-20 rounded-full" />
          </div>
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-2/5" />
        </div>
      </div>
    </div>
  )
}

/** A section label above a card ("NEEDS THE BARANGAY"). */
function LabelSkeleton({ className = 'w-36' }) {
  return <Skeleton className={`h-3 mb-3 rounded-md ${className}`} />
}

/** Mirrors components/HomeSummary.jsx: greeting card, tile grid, an action. */
function OverviewSkeleton({ tiles = 4 }) {
  const cols = tiles === 6 ? 'grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6' : 'grid-cols-2 lg:grid-cols-4'
  return (
    <div className="space-y-6">
      <div className="white-card p-5 sm:p-6">
        <Skeleton className="h-6 w-60 max-w-full" />
        <Skeleton className="h-3.5 w-full max-w-[62ch] mt-3.5" />
        <Skeleton className="h-3.5 w-3/5 mt-2" />
        <Skeleton className="h-[62px] w-full rounded-[10px] mt-4" />
      </div>
      <div>
        <LabelSkeleton />
        <div className={`grid ${cols} gap-3`}>
          {[...Array(tiles)].map((_, i) => (
            <div key={i} className="white-card p-4 pl-[18px]">
              <Skeleton className="w-4 h-4 rounded-md" />
              <Skeleton className="h-[26px] w-9 mt-2.5 rounded-lg" />
              <Skeleton className="h-3.5 w-3/4 mt-1.5" />
              <Skeleton className="h-3 w-1/2 mt-1.5" />
            </div>
          ))}
        </div>
      </div>
      <div>
        <LabelSkeleton className="w-28" />
        <div className="white-card p-4 flex items-center gap-3.5">
          <Skeleton className="w-11 h-11 rounded-[10px] flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48 max-w-full" />
            <Skeleton className="h-3 w-72 max-w-full" />
          </div>
        </div>
      </div>
    </div>
  )
}

/** Record list (incidents, tickets, documents…): the shared search/filter
 *  card (components/RecordListToolbar.jsx), a group label, then cards. */
function RecordListSkeleton({ rows = 4 }) {
  return (
    <div className="space-y-3">
      <div className="white-card p-3 space-y-2.5">
        <Skeleton className="h-11 w-full rounded-[10px]" />
        <div className="flex gap-2 overflow-hidden">
          {[14, 20, 20, 20].map((w, i) => <Skeleton key={i} className="h-8 rounded-full flex-shrink-0" style={{ width: `${w * 4}px` }} />)}
        </div>
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-8 w-40 rounded-xl" />
          <Skeleton className="h-8 w-24 rounded-xl" />
        </div>
      </div>
      <Skeleton className="h-3 w-24 rounded-md !mt-4" />
      {/* Same container grid as RecordGroup / IncidentsSection. */}
      <div className="@container">
        <div className="grid gap-3 @5xl:grid-cols-2">
          {[...Array(rows)].map((_, i) => <RecordCardSkeleton key={i} />)}
        </div>
      </div>
    </div>
  )
}

/** Announcement feed: a header card, then posts. */
function AnnouncementsSkeleton({ rows = 2 }) {
  return (
    <div className="space-y-3">
      <div className="white-card p-4 flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-[10px] flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-60 max-w-full" />
        </div>
      </div>
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="white-card p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-[10px] flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-11/12" />
          <Skeleton className="h-3 w-3/5" />
        </div>
      ))}
    </div>
  )
}

/** A titled card holding rows: invite codes and the user list. */
function TableSkeleton() {
  const header = (
    <div className="flex items-center gap-3 mb-4">
      <Skeleton className="w-11 h-11 rounded-[10px] flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-3 w-56 max-w-full" />
      </div>
    </div>
  )
  const rows = (n) => [...Array(n)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-[10px]" />)
  return (
    <div className="space-y-6">
      <div className="white-card p-5">
        {header}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Skeleton className="h-10 rounded-[10px]" />
          <Skeleton className="h-10 rounded-[10px]" />
        </div>
        <div className="space-y-2">{rows(4)}</div>
      </div>
      <div className="white-card p-5">
        {header}
        <Skeleton className="h-11 w-full rounded-[10px] mb-3" />
        <div className="space-y-2">{rows(3)}</div>
      </div>
    </div>
  )
}

/** Performance page: header card, stat tiles, chart panels. */
function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="white-card p-6 space-y-2.5">
        <Skeleton className="h-3 w-36" />
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-3.5 w-56 max-w-full" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="white-card p-4 space-y-2.5">
            <Skeleton className="w-8 h-8 rounded-xl" />
            <Skeleton className="h-6 w-12" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="white-card p-5 space-y-4">
        <Skeleton className="h-4 w-40" />
        <div className="flex items-end gap-2 h-40">
          {[45, 70, 35, 85, 60, 50, 75].map((h, j) => (
            <Skeleton key={j} className="flex-1 rounded-t-lg rounded-b-none" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
    </div>
  )
}

/** A centred card that opens another page (Map, Calendar, Analytics, AI). */
function LauncherSkeleton() {
  return (
    <div className="white-card p-8 flex flex-col items-center">
      <Skeleton className="w-16 h-16 rounded-[14px] mb-4" />
      <Skeleton className="h-6 w-48 mb-2" />
      <Skeleton className="h-3.5 w-72 max-w-full mb-6" />
      <Skeleton className="h-11 w-44 rounded-[10px]" />
    </div>
  )
}

/** Chat thread: alternating bubbles and a composer. */
function ChatSkeleton() {
  const bubbles = [['left', 'w-2/3'], ['right', 'w-1/2'], ['left', 'w-3/5'], ['right', 'w-2/5'], ['left', 'w-1/2']]
  return (
    <div className="flex flex-col gap-3">
      {bubbles.map(([side, w], i) => (
        <div key={i} className={`flex items-end gap-2 ${side === 'right' ? 'flex-row-reverse' : ''}`}>
          {side === 'left' && <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />}
          <Skeleton className={`h-14 ${w} rounded-[10px]`} />
        </div>
      ))}
      <Skeleton className="h-12 w-full rounded-[10px] mt-4" />
    </div>
  )
}

// The officials' home has six tiles in rows of three; the others four.
const OVERVIEW_TILES = { '/official': 6 }

/**
 * The placeholder for one dashboard section.
 * kind: overview | records | announcements | table | analytics | launcher | chat
 */
export function SectionSkeleton({ kind = 'records', path }) {
  // The resident dashboard is on the Crafted rows (components/resident).
  if (path === '/resident') {
    if (kind === 'overview') return <ResidentHomeSkeleton />
    if (kind === 'records') return <RowsCard rows={4} lift progress />
    if (kind === 'announcements') return <RowsCard rows={3} lift lines={3} />
    if (kind === 'launcher') return <RowsCard rows={1} lift lines={3} />
  }
  if (path === '/tanod') {
    if (kind === 'overview') {
      return (
        <div className="flex flex-col gap-3.5">
          <RowsCard rows={2} label trailing={<Skeleton className="size-4" />} />
          <RowsCard rows={1} lines={1} />
        </div>
      )
    }
    if (kind === 'records') return <RowsCard rows={3} lift lines={1} />
  }
  if (path === '/official') {
    if (kind === 'overview') return <OfficialHomeSkeleton />
    if (kind === 'records') return <ListCardSkeleton rows={5} />
    if (kind === 'announcements') return <ListCardSkeleton rows={3} lines={1} />
    if (kind === 'table') {
      return (
        <div className="grid items-start gap-3.5 xl:grid-cols-[minmax(0,1fr)_384px]">
          <ListCardSkeleton rows={5} />
          <RowsCard rows={3} label />
        </div>
      )
    }
    if (kind === 'launcher') {
      return (
        <div className="white-card shadow-[var(--shadow-lift)] flex items-center gap-4 px-[18px] py-5">
          <Skeleton className="size-12 rounded-[12px] shrink-0" />
          <div className="flex-1 space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-3/4" /></div>
          <Skeleton className="hidden sm:block h-10 w-36 rounded-[10px]" />
        </div>
      )
    }
  }
  switch (kind) {
    case 'overview': return <OverviewSkeleton tiles={OVERVIEW_TILES[path] || 4} />
    case 'announcements': return <AnnouncementsSkeleton />
    case 'table': return <TableSkeleton />
    case 'analytics': return <AnalyticsSkeleton />
    case 'launcher': return <LauncherSkeleton />
    case 'chat': return <ChatSkeleton />
    default: return <RecordListSkeleton />
  }
}

/** The tanod's duty toggle card, which heads every tanod section. */
function DutySkeleton({ column }) {
  return (
    <div className={`${column} mx-auto mb-4`}>
      <div className="white-card w-full h-[72px] flex items-center gap-3 px-[18px]">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-3 w-52 max-w-full" />
        </div>
        <Skeleton className="w-11 h-[26px] rounded-full flex-shrink-0" />
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------------
   Dashboard frame
   ---------------------------------------------------------------------- */

// Nav items per group, as each dashboard's sidebar draws them.
const NAV_GROUPS = { '/official': [3, 6, 3], '/resident': [2, 4, 1], '/tanod': [4] }
const TAB_ROLE = { '/resident': 'resident', '/tanod': 'tanod' }

/** Mirrors components/DashboardSidebar.jsx, open and collapsed. Which one
 *  shows is CSS (see .dash-shell in globals.css). */
function SidebarSkeleton({ groups }) {
  const items = groups.reduce((a, b) => a + b, 0)
  return (
    <aside className="dash-shell-aside hidden desk:flex fixed top-0 left-0 h-dvh flex-col bg-surface overflow-hidden z-30 border-r border-line" aria-hidden="true">
      {/* Open (232px) */}
      <div className="dash-shell-sb-open flex-col h-full">
        <div className="flex items-center gap-2.5 pl-[18px] pr-3 pt-4 pb-2">
          <div className="w-8 h-8 relative flex-shrink-0">
            <Image src="/logo.png" alt="" fill sizes="32px" loading="eager" className="object-contain" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold text-ink whitespace-nowrap">BarangayHub 360</p>
            <Skeleton className="h-2.5 w-24 mt-1.5" />
          </div>
        </div>
        <div className="flex-1 overflow-hidden px-3">
          {groups.map((n, g) => (
            <div key={g} className="mt-1.5">
              <Skeleton className="h-2.5 w-14 mx-2.5 mt-3.5 mb-2.5" />
              {[...Array(n)].map((_, i) => (
                <div key={i} className="h-9 px-2.5 flex items-center gap-[11px]">
                  <Skeleton className="w-[18px] h-[18px] rounded-[5px] flex-shrink-0" />
                  <Skeleton className="h-3 flex-1 max-w-[110px]" />
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="px-3 pt-2.5 pb-3.5 border-t border-line flex items-center gap-2.5 pl-[18px]">
          <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        </div>
      </div>
      {/* Collapsed (64px) */}
      <div className="dash-shell-sb-closed flex-col items-center h-full">
        <div className="pt-4 pb-2">
          <div className="w-8 h-8 relative">
            <Image src="/logo.png" alt="" fill sizes="32px" loading="eager" className="object-contain" />
          </div>
        </div>
        <div className="flex-1 pt-3 space-y-2 overflow-hidden">
          {[...Array(items)].map((_, i) => <Skeleton key={i} className="w-10 h-10 rounded-lg" />)}
        </div>
        <div className="py-3.5 border-t border-line w-full flex justify-center">
          <Skeleton className="w-[34px] h-[34px] rounded-lg" />
        </div>
      </div>
    </aside>
  )
}

/** What sits on the band under the title, per dashboard and section kind.
 *  Resident: Home has the greeting and the first card; the record lists a
 *  switch. Official: the dashboard has the greeting and the stat strip. */
function BandSlotSkeleton({ path, kind }) {
  if (path === '/official') {
    if (kind !== 'overview') return null
    return (
      <>
        <div className={header.customHeading}>
          <Skeleton tone="brand" className="h-3 w-40" />
          <Skeleton tone="brand" className="h-[30px] w-72 max-w-full mt-2 rounded-lg" />
          <Skeleton tone="brand" className="h-3.5 w-96 max-w-full mt-2.5" />
        </div>
        <div className="band-slot">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border border-line bg-line shadow-[var(--shadow-lift)] sm:grid-cols-3 xl:grid-cols-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-surface px-4 py-3.5 sm:px-[18px] space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-6 w-10" />
                <Skeleton className="h-2.5 w-16" />
              </div>
            ))}
          </div>
        </div>
      </>
    )
  }
  if (path === '/tanod') {
    // T01: greeting, duty switch, the assignment card; T02: the Active /
    // Done switch; T06: the four numbers.
    if (kind === 'overview') {
      return (
        <>
          <div className={header.customHeading}>
            <Skeleton tone="brand" className="h-3 w-36" />
            <Skeleton tone="brand" className="h-[30px] w-64 max-w-full mt-2 rounded-lg" />
          </div>
          <div className="band-slot flex flex-col gap-3.5">
            <div className="h-[62px] rounded-[12px] bg-[var(--onband)]" />
            <div className="white-card shadow-[var(--shadow-lift)] px-[18px] py-3.5 space-y-2.5">
              <Skeleton className="h-[22px] w-24 rounded-md" />
              <Skeleton className="h-4 w-56 max-w-full" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
        </>
      )
    }
    if (kind === 'records') return <div className="band-slot"><div className="h-[42px] rounded-xl bg-[var(--onband)]" /></div>
    if (kind === 'analytics') {
      return (
        <div className="band-slot">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border border-line bg-line shadow-[var(--shadow-lift)] sm:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-surface px-4 py-3.5 space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-6 w-12" /><Skeleton className="h-2.5 w-16" /></div>
            ))}
          </div>
        </div>
      )
    }
    return null
  }
  if (path !== '/resident') return null
  if (kind === 'overview') {
    return (
      <>
        <div className={header.customHeading}>
          <Skeleton tone="brand" className="h-3 w-36" />
          <Skeleton tone="brand" className="h-[30px] w-64 max-w-full mt-2 rounded-lg" />
        </div>
        <div className="band-slot">
          <div className="white-card shadow-[var(--shadow-lift)] px-[18px] py-3.5 space-y-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-4 w-56 max-w-full" />
            <Skeleton className="h-1 w-full mt-3" />
          </div>
        </div>
      </>
    )
  }
  if (kind === 'records') return <div className="band-slot"><div className="h-[42px] rounded-xl bg-[var(--onband)]" /></div>
  return null
}

/** Mirrors components/DashboardHeader.jsx on its band: the same classes, so
 *  the heights match; placeholder bars where text depends on data. */
function DashboardHeaderSkeleton({ column = '', path, kind, kinds = [] }) {
  // Dashboards whose Home draws its own heading on the band.
  const slots = path === '/resident' || path === '/official' || path === '/tanod'
  return (
    <header className={header.header} aria-hidden="true">
      <Band seed={2} />
      <div className={`${header.inner} ${column}`}>
        <div className={header.topbar}>
          <span className={`${header.onband} ${header.phoneOnly}`}><Menu size={18} strokeWidth={1.9} /></span>
          <div className={`${header.phoneTitle} flex`}><Skeleton tone="brand" className="h-4 w-32" /></div>
          <div className={header.context}><Skeleton tone="brand" className="h-3 w-64 max-w-full" /></div>
          <span className={header.searchPill}><Search size={16} strokeWidth={1.9} /><span className={header.searchText}>Search reports, people…</span></span>
          <span className={`${header.onband} ${header.phoneOnly}`}><Search size={18} strokeWidth={1.9} /></span>
          <span className={header.onband}><Bell size={16} /></span>
          <span className={`${header.deskOnly} w-[38px] h-[38px] rounded-[10px] bg-[var(--onband)]`} />
        </div>
        {!(slots && kind === 'overview') && (
          <div className={`${header.heading} ${slots && !kind ? 'dash-shell-heading' : ''}`}>
            <div className="min-w-0 flex-1">
              <Skeleton tone="brand" className="h-[30px] w-64 max-w-full rounded-lg" />
              <Skeleton tone="brand" className="h-3.5 w-80 max-w-full mt-2.5" />
            </div>
          </div>
        )}
        {slots && (kind
          ? <BandSlotSkeleton path={path} kind={kind} />
          : kinds.map((k, i) => (
            <div key={k} className="dash-shell-variant" data-kind={k} data-default={i === 0 ? '' : undefined}>
              <BandSlotSkeleton path={path} kind={k} />
            </div>
          )))}
      </div>
    </header>
  )
}

/** The notification banner as it will appear, before any JavaScript runs.
 *  CSS shows it only when the boot script predicted it (html[data-banner]). */
function BootBanner() {
  return (
    <>
      <div className="dash-shell-banner" data-state="ask" inert><NotificationBannerView state="ask" /></div>
      <div className="dash-shell-banner" data-state="denied" inert><NotificationBannerView state="denied" /></div>
    </>
  )
}

/**
 * The whole dashboard frame — sidebar, band header, banner, section, tab
 * bar — while a dashboard loads. Drawn in two places that must look
 * identical:
 *
 * - The page's Suspense fallback (the static HTML, before JavaScript):
 *   leave `kind`, `section`, `sidebarOpen` and `banner` out. It renders
 *   every section variant and the predicted banner; CSS shows the ones the
 *   boot script in lib/dashboardSkeletons.js chose for this URL and browser.
 * - The page itself while its data loads: pass the section's `kind`, the
 *   `section` (lights its tab), the real `sidebarOpen`, and
 *   `banner={<NotificationBanner />}`.
 *
 * Both use components/crafted/DashboardFrame, like the loaded page.
 */
export function DashboardShellSkeleton({ path, kind, section, sidebarOpen, banner }) {
  const { lead, fallback, kinds: kindMap } = DASHBOARD_SKELETONS[path]
  const kinds = kind ? [kind] : dashboardKinds(path)
  const role = TAB_ROLE[path]
  const headerColumn = path === '/official' ? 'max-w-[100rem]' : dashboardColumn(path, kind || kindMap[fallback]) || 'max-w-2xl'
  return (
    <>
      <DashboardFrame
        sidebarOpen={sidebarOpen}
        role="status" aria-label="Loading" aria-busy="true"
        sidebar={<SidebarSkeleton groups={NAV_GROUPS[path] || [3, 3]} />}
        header={<DashboardHeaderSkeleton column={headerColumn} path={path} kind={kind} kinds={kinds} />}
        tabBar={role ? <TabBar role={role} activeSection={section} /> : null}>
        <div className="mx-auto w-full max-w-[100rem]">
        {kinds.map((k, i) => (
          <div key={k} className={kind ? undefined : 'dash-shell-variant'}
            data-kind={kind ? undefined : k} data-default={!kind && i === 0 ? '' : undefined}>
            {/* The banner sits in the section's column, as on the page. */}
            <div className={`${path === '/resident' ? dashboardColumn(path, k) : ''} mx-auto`}>
              {banner === undefined ? <BootBanner /> : banner}
            </div>
            {lead === 'duty' && <DutySkeleton column={dashboardColumn(path, k) || 'max-w-2xl'} />}
            <div className={`${dashboardColumn(path, k)} mx-auto`}>
              <SectionSkeleton kind={k} path={path} />
            </div>
          </div>
        ))}
        </div>
      </DashboardFrame>
      {/* End of the static skeleton: the boot script holds the first paint
          until the browser has parsed this far (lib/dashboardSkeletons.js). */}
      {!kind && <div id="dash-shell-end" hidden />}
    </>
  )
}

/* ----------------------------------------------------------------------
   Standalone pages
   ---------------------------------------------------------------------- */

/**
 * Mirrors components/AppUI.jsx PageHeader. With a title it draws the real
 * header text (it never depends on data); without one, placeholder bars.
 */
function PageHeaderSkeleton({ title, description, icon: Icon, actions = false }) {
  return (
    <header className={ui.header} aria-hidden="true">
      <Band mode="fill" dots={8} seed={3} />
      <div className={ui.headerInner}>
        <span className={ui.back}><ArrowLeft size={18} strokeWidth={1.9} /></span>
        {title ? (
          <>
            {Icon && <span className={ui.headerIcon}><Icon size={21} /></span>}
            <div className={ui.heading}><h1>{title}</h1>{description && <p>{description}</p>}</div>
          </>
        ) : (
          <div className={`${ui.heading} space-y-2`}>
            <Skeleton tone="brand" className="h-4 w-44" />
            <Skeleton tone="brand" className="h-3 w-60 max-w-full" />
          </div>
        )}
        {/* A header button (Settings' Save): wraps to its own row on phones,
            like the real one. */}
        {actions && <div className={ui.headerActions}><Skeleton tone="brand" className="h-11 w-full sm:w-36 rounded-xl" /></div>}
      </div>
    </header>
  )
}

function PageFrame({ header, children }) {
  return (
    <div className="min-h-dvh relative overflow-clip bg-brand" role="status" aria-label="Loading" aria-busy="true">
      <PageHeaderSkeleton {...header} />
      {children}
      {/* End of the static skeleton: the boot script holds the first paint
          until the browser has parsed this far (lib/dashboardSkeletons.js). */}
      <div id="page-shell-end" hidden />
    </div>
  )
}

function CardLines({ title = 'w-1/3', lines = 2, className = '' }) {
  return (
    <div className={`white-card p-5 space-y-3 ${className}`}>
      <div className="flex items-center gap-3 mb-1">
        <Skeleton className="w-11 h-11 rounded-[10px] flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className={`h-4 ${title}`} />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      {[...Array(lines)].map((_, i) => <Skeleton key={i} className={`h-3 ${i % 2 ? 'w-4/5' : 'w-full'}`} />)}
    </div>
  )
}

/* ---- Account pages on PageShell (profile, help, settings) ---- */

/** A row of placeholder text in a card: a title bar and a shorter sub bar;
 *  `lines` adds body lines, `progress` the 4-step bar of a live report. */
function RowLines({ title = 'w-2/5', sub = 'w-3/5', trailing, lines = 0, progress = false }) {
  return (
    <div className="flex items-start gap-3 px-3.5 sm:px-[18px] py-3">
      <div className="flex-1 space-y-2">
        <Skeleton className={`h-3.5 ${title}`} />
        {sub && <Skeleton className={`h-3 ${sub}`} />}
        {[...Array(lines)].map((_, i) => <Skeleton key={i} className={`h-3 ${i % 2 ? 'w-4/5' : 'w-full'}`} />)}
        {progress && <Skeleton className="h-1 w-full max-w-[268px] !mt-3" />}
      </div>
      {trailing}
    </div>
  )
}

/** A white card of rows divided by hairlines; `lift` for the first card on the band. */
function RowsCard({ rows, lift = false, label = false, trailing, lines = 0, progress = false }) {
  return (
    <div className={`white-card overflow-hidden ${lift ? 'shadow-[var(--shadow-lift)]' : ''}`}>
      {label && <Skeleton className="h-2.5 w-24 mx-[18px] mt-4 mb-1.5" />}
      <div className="divide-y divide-line">
        {[...Array(rows)].map((_, i) => <RowLines key={i} trailing={trailing} lines={lines} progress={progress} />)}
      </div>
    </div>
  )
}

/** An official list card (O02, O04–O10): the toolbar row (a switch and a
 *  search box), then rows. */
function ListCardSkeleton({ rows = 5, lines = 0 }) {
  return (
    <div className="white-card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2.5 px-3.5 sm:px-[18px] py-3">
        <Skeleton className="h-10 w-64 max-w-full rounded-xl" />
        <Skeleton className="h-9 w-56 max-w-full rounded-[10px]" />
      </div>
      <div className="h-9 border-t border-line bg-surface-sunk" />
      <div className="divide-y divide-line">
        {[...Array(rows)].map((_, i) => <RowLines key={i} lines={lines} trailing={<Skeleton className="h-[34px] w-20 rounded-[10px]" />} />)}
      </div>
    </div>
  )
}

/** The official dashboard body (O01): "Waiting on you" and the recent
 *  on the left; Today, the tanods and recent incidents on the right. */
function OfficialHomeSkeleton() {
  const action = <Skeleton className="h-[34px] w-16 rounded-[10px]" />
  return (
    <div className="grid items-start gap-3.5 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
      <RowsCard rows={5} label trailing={action} />
      <div className="flex flex-col gap-3.5">
        <RowsCard rows={2} label />
        <RowsCard rows={2} label />
        <RowsCard rows={3} label />
      </div>
    </div>
  )
}

/** The resident Home body: the links card, then the hotlines grid. */
function ResidentHomeSkeleton() {
  return (
    <div className="flex flex-col gap-3.5">
      <RowsCard rows={4} trailing={<Skeleton className="size-4" />} />
      <div>
        <Skeleton className="h-2.5 w-36 mb-2.5" />
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border border-line bg-line">
          {[0, 1, 2].map(i => (
            <div key={i} className={`bg-surface px-3.5 py-3 space-y-2 ${i === 2 ? 'col-span-2' : ''}`}>
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** The segmented control on the band (three or four items). */
function BandSegmented({ items }) {
  return (
    <div className="flex gap-1 rounded-xl bg-[var(--onband)] p-1">
      {[...Array(items)].map((_, i) => <div key={i} className={`h-8 flex-1 rounded-[9px] ${i === 0 ? 'bg-white' : ''}`} />)}
    </div>
  )
}

/** app/profile: avatar, name and tag on the band, the sections, the details card and links. */
function ProfileShellSkeleton({ header }) {
  return (
    <PageShell title={header.title} onBack={true}
      bandContent={
        <>
          <div className="flex items-center gap-3.5">
            <div className="size-16 rounded-[14px] bg-white" />
            <div className="space-y-2">
              <Skeleton tone="brand" className="h-5 w-44" />
              <Skeleton tone="brand" className="h-[22px] w-28" />
            </div>
          </div>
          <BandSegmented items={3} />
        </>
      }>
      <RowsCard rows={5} lift />
      <RowsCard rows={3} trailing={<Skeleton className="size-4" />} />
    </PageShell>
  )
}

/** app/help: the sections on the band, search, the questions, "Still stuck?". */
function HelpShellSkeleton({ header }) {
  return (
    <PageShell title={header.title} sub={header.description} subOnDesktop onBack={true} bandContent={<BandSegmented items={4} />}>
      <div className="h-[48px] rounded-[10px] border border-line bg-surface shadow-[var(--shadow-lift)]" />
      <RowsCard rows={5} label trailing={<Skeleton className="size-4" />} />
      <RowsCard rows={3} />
    </PageShell>
  )
}

/** app/settings: notifications with toggles, appearance, install, account. */
function SettingsShellSkeleton({ header }) {
  return (
    <PageShell title={header.title} sub={header.description} subOnDesktop onBack={true}
      actions={<div className="h-[34px] w-16 rounded-[10px] bg-white" />}>
      <RowsCard rows={4} lift label trailing={<Skeleton className="h-[26px] w-11 rounded-full" />} />
      <div className="white-card px-[18px] py-4 space-y-3">
        <Skeleton className="h-2.5 w-24" />
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
      <RowsCard rows={3} label />
    </PageShell>
  )
}

/**
 * A standalone page (profile, help, settings, admin…): its header, then the
 * body. `header` is { title, description, icon } — the page's real header
 * text. `layout` picks a body that mirrors that page; without one, a column
 * of cards (optionally under a row of `tabs`).
 */
export function PageSkeleton({ header = {}, layout, cards = 3, maxWidth = 768, tabs = 0 }) {
  // The account pages are on the Crafted PageShell: their skeletons are too.
  const Shell = { profile: ProfileShellSkeleton, help: HelpShellSkeleton, settings: SettingsShellSkeleton }[layout]
  if (Shell) {
    return (
      <div role="status" aria-label="Loading" aria-busy="true">
        <Shell header={header} />
        {/* End of the static skeleton: the boot script holds the first paint
            until the browser has parsed this far (lib/dashboardSkeletons.js). */}
        <div id="page-shell-end" hidden />
      </div>
    )
  }
  const body = (
    <div className="mx-auto p-4 sm:p-6 space-y-4" style={{ maxWidth }}>
      {tabs > 0 && (
        <div className="flex gap-2">
          {[...Array(tabs)].map((_, i) => <Skeleton key={i} tone="brand" className="h-9 w-24 rounded-[10px]" />)}
        </div>
      )}
      {[...Array(cards)].map((_, i) => <CardLines key={i} lines={i === 0 ? 5 : 2} />)}
    </div>
  )
  return <PageFrame header={header}>{body}</PageFrame>
}

/**
 * Incident detail, matching each page's layout:
 * - official: the PageShell with two columns from 1024px (app/official/incident/[id]).
 * - resident: the PageShell with the map on the band (app/resident/incident/[id]).
 */
export function IncidentDetailSkeleton({ variant = 'official' }) {
  if (variant === 'resident') {
    // app/resident/incident/[id] on the Crafted PageShell: the map on the
    // band, the status, then the progress card.
    return (
      <div role="status" aria-label="Loading" aria-busy="true">
        <PageShell title={<Skeleton as="span" tone="brand" className="h-4 w-48 max-w-full" />} onBack={true}
          bandContent={<div className="white-card shadow-[var(--shadow-lift)] h-[clamp(180px,26dvh,300px)]" />}>
          <Skeleton className="h-[62px] w-full rounded-[10px]" />
          <RowsCard rows={4} />
          <RowsCard rows={1} lines={2} />
        </PageShell>
        <div id="page-shell-end" hidden />
      </div>
    )
  }
  // app/official/incident/[id] on the PageShell (O03): the report card and
  // the activity on the left; the map and the dispatch list on the right.
  return (
    <div role="status" aria-label="Loading" aria-busy="true">
      <PageShell maxWidth={1120} onBack={true}
        title={<Skeleton as="span" tone="brand" className="h-[30px] w-72 max-w-full rounded-lg" />}
        sub={<Skeleton as="span" tone="brand" className="mt-1 h-3.5 w-56 max-w-full" />}>
        <div className="grid items-start gap-3.5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-3.5">
            <div className="white-card shadow-[var(--shadow-lift)] px-[18px] py-4 space-y-3">
              <div className="flex gap-1.5"><Skeleton className="h-[22px] w-16 rounded-md" /><Skeleton className="h-[22px] w-20 rounded-md" /></div>
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-4/5" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-16 w-full rounded-[10px]" />
            </div>
            <RowsCard rows={3} label />
          </div>
          <div className="flex flex-col gap-3.5">
            <div className="white-card shadow-[var(--shadow-lift)] overflow-hidden">
              <Skeleton className="h-[clamp(200px,30dvh,280px)] w-full rounded-none" />
              <div className="px-[18px] py-3"><Skeleton className="h-3.5 w-3/5" /></div>
            </div>
            <RowsCard rows={2} label trailing={<Skeleton className="h-[34px] w-20 rounded-[10px]" />} />
          </div>
        </div>
      </PageShell>
      <div id="page-shell-end" hidden />
    </div>
  )
}

/** Ticket conversation, matching the official and resident ticket pages: the chat header (back,
 *  avatar, title and status), the message column, the composer at the
 *  bottom of the screen. */
export function TicketDetailSkeleton({ variant = 'official' }) {
  // app/resident/ticket/[id] and app/official/ticket/[id]: the band
  // header, the thread, the composer (officials: a wider column).
  const col = variant === 'resident' ? 'max-w-2xl' : 'max-w-3xl'
  const runs = [['left', 'w-3/5'], ['right', 'w-1/2'], ['left', 'w-2/3'], ['right', 'w-2/5']]
  return (
    <div className="relative isolate flex h-dvh flex-col overflow-hidden bg-page" role="status" aria-label="Loading" aria-busy="true">
      <div className="relative px-4 pt-[max(16px,env(safe-area-inset-top,0px))] pb-3" aria-hidden="true">
        <Band extend={0} fade={56} dots={10} seed={4} />
        <div className={`relative z-[1] mx-auto flex ${col} items-center gap-2.5`}>
          <span className="flex size-10 items-center justify-center rounded-[10px] bg-[var(--onband)] text-white"><ArrowLeft size={18} strokeWidth={1.9} /></span>
          <div className="flex-1 space-y-2"><Skeleton tone="brand" className="h-4 w-48 max-w-full" /><Skeleton tone="brand" className="h-3 w-36" /></div>
        </div>
      </div>
      <div className={`relative z-[1] mx-auto flex w-full ${col} flex-1 flex-col gap-3 overflow-hidden px-4 pt-2`}>
        {runs.map(([side, w], i) => (
          <div key={i} className={`flex ${side === 'right' ? 'justify-end' : 'items-end gap-2'}`}>
            {side === 'left' && <Skeleton className="size-8 rounded-lg flex-shrink-0" />}
            <div className={`${w} h-14 rounded-[16px] ${side === 'right' ? 'bg-[var(--brand-soft)]' : 'border border-line bg-surface'}`} />
          </div>
        ))}
      </div>
      <div className="relative z-[2] border-t border-line bg-surface px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom,0px))]">
        <div className={`mx-auto flex ${col} gap-2`}><Skeleton className="h-11 flex-1 rounded-[10px]" /><Skeleton className="size-11 rounded-[10px]" /></div>
      </div>
      <div id="page-shell-end" hidden />
    </div>
  )
}
