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
import desktop from '@/components/desktop-pages.module.css'
import header from '@/components/dashboard-header.module.css'
import Band from '@/components/crafted/Band'
import DashboardFrame from '@/components/crafted/DashboardFrame'
import TabBar from '@/components/crafted/TabBar'
import PageShell from '@/components/crafted/PageShell'

/** One shimmering block. tone="brand" for use on the purple background. */
export function Skeleton({ className = '', style, tone }) {
  return (
    <div
      className={`skeleton-shimmer ${tone === 'brand' ? 'skeleton-on-brand' : ''} ${className}`}
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

/** A resident list (incidents, tickets, documents, blotter): the count and
 *  the section's action button, a group label, then cards. */
function ResidentRecordListSkeleton({ rows = 3 }) {
  // Same elements and classes as the resident sections and RecordGroup,
  // with placeholders in place of the text, so the spacing is identical.
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <Skeleton className="h-3 w-16 rounded-md my-0.5" />
        <div className="h-10 w-40 rounded-[10px] bg-surface border border-line" />
      </div>
      <div className="flex items-center gap-2.5 mt-2 mb-0.5 px-0.5">
        <Skeleton className="h-3 w-24 rounded-md my-0.5" />
        <span className="flex-1 h-px bg-line" aria-hidden="true" />
      </div>
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
  switch (kind) {
    case 'overview': return <OverviewSkeleton tiles={OVERVIEW_TILES[path] || 4} />
    case 'announcements': return <AnnouncementsSkeleton />
    case 'table': return <TableSkeleton />
    case 'analytics': return <AnalyticsSkeleton />
    case 'launcher': return <LauncherSkeleton />
    case 'chat': return <ChatSkeleton />
    default: return path === '/resident' ? <ResidentRecordListSkeleton /> : <RecordListSkeleton />
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

/** Mirrors components/DashboardHeader.jsx on its band: the same classes, so
 *  the heights match; placeholder bars where text depends on data. */
function DashboardHeaderSkeleton({ column = '' }) {
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
        <div className={header.heading}>
          <div className="min-w-0 flex-1">
            <Skeleton tone="brand" className="h-[30px] w-64 max-w-full rounded-lg" />
            <Skeleton tone="brand" className="h-3.5 w-80 max-w-full mt-2.5" />
          </div>
        </div>
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
        header={<DashboardHeaderSkeleton column={headerColumn} />}
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

/** A row of placeholder text in a card: a title bar and a shorter sub bar. */
function RowLines({ title = 'w-2/5', sub = 'w-3/5', trailing }) {
  return (
    <div className="flex items-center gap-3 px-3.5 sm:px-[18px] py-3">
      <div className="flex-1 space-y-2">
        <Skeleton className={`h-3.5 ${title}`} />
        {sub && <Skeleton className={`h-3 ${sub}`} />}
      </div>
      {trailing}
    </div>
  )
}

/** A white card of rows divided by hairlines; `lift` for the first card on the band. */
function RowsCard({ rows, lift = false, label = false, trailing }) {
  return (
    <div className={`white-card overflow-hidden ${lift ? 'shadow-[var(--shadow-lift)]' : ''}`}>
      {label && <Skeleton className="h-2.5 w-24 mx-[18px] mt-4 mb-1.5" />}
      <div className="divide-y divide-line">
        {[...Array(rows)].map((_, i) => <RowLines key={i} trailing={trailing} />)}
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

/** Header of a detail page: back, the category tile, title lines, and (from
 *  640px) the status pills — like PageHeader with actionsDesktopOnly. */
function DetailHeaderSkeleton({ pills = true, maxWidth }) {
  return (
    <header className={ui.header} aria-hidden="true">
      <Band mode="fill" dots={8} seed={3} />
      <div className={ui.headerInner} style={maxWidth ? { maxWidth } : undefined}>
        <span className={ui.back}><ArrowLeft size={18} strokeWidth={1.9} /></span>
        <span className={ui.headerIcon}><Skeleton tone="brand" className="w-5 h-5 rounded-md" /></span>
        <div className={`${ui.heading} space-y-2`}>
          <Skeleton tone="brand" className="h-5 w-48 max-w-full" />
          <Skeleton tone="brand" className="h-3 w-40 max-w-full" />
        </div>
        {pills && (
          <div className={`${ui.headerActions} ${ui.desktopOnly}`}>
            <Skeleton tone="brand" className="h-[26px] w-20 rounded-[9px]" />
            <Skeleton tone="brand" className="h-[26px] w-20 rounded-[9px]" />
          </div>
        )}
      </div>
    </header>
  )
}

/** "What was reported": text, the reporter facts, an action. */
function ReportCardSkeleton() {
  return (
    <div className="white-card p-5 space-y-3">
      <Skeleton className="h-3 w-32" />
      <Skeleton className="h-3.5 w-full" />
      <Skeleton className="h-3.5 w-3/4" />
      <div className="flex flex-wrap gap-2 pt-2">
        <Skeleton className="h-11 w-32 rounded-xl" />
        <Skeleton className="h-11 w-44 rounded-xl" />
      </div>
      <Skeleton className="h-11 w-full rounded-[10px]" />
    </div>
  )
}

/** Location: address line, the map (same fluid height as MiniMap there), directions. */
function LocationCardSkeleton() {
  return (
    <div className="white-card p-5 space-y-3">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-3.5 w-40" />
      <Skeleton className="w-full rounded-[10px]" style={{ height: 'clamp(180px, 32dvh, 340px)' }} />
      <Skeleton className="h-11 w-full rounded-[10px]" />
    </div>
  )
}

function FactsCardSkeleton({ lines = 4 }) {
  return (
    <div className="white-card p-5 space-y-3">
      <Skeleton className="h-3 w-28" />
      {[...Array(lines)].map((_, i) => <Skeleton key={i} className={`h-3 ${i % 3 === 2 ? 'w-2/3' : 'w-full'}`} />)}
    </div>
  )
}

/**
 * Incident detail, matching each page's layout:
 * - official: two columns (1fr / 340px) from 1024px; pills under the header
 *   on phones (app/official/incident/[id]).
 * - resident: the status panel across the top, then the report and side
 *   columns of desktop.incidentPage (app/resident/incident/[id]).
 */
export function IncidentDetailSkeleton({ variant = 'official' }) {
  if (variant === 'resident') {
    return (
      <div className="min-h-dvh relative overflow-clip bg-brand" role="status" aria-label="Loading" aria-busy="true">
        <DetailHeaderSkeleton pills={false} />
        <main className={`max-w-2xl mx-auto px-4 py-5 space-y-4 ${desktop.incidentPage}`}>
          <div className={`rounded-[10px] px-4 py-4 flex items-start gap-3 bg-white/85 ${desktop.wide}`}>
            <Skeleton className="w-10 h-10 rounded-[10px] flex-shrink-0" />
            <div className="flex-1 space-y-2 pt-0.5">
              <Skeleton className="h-3.5 w-48" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3 sm:hidden" />
            </div>
          </div>
          <div className={`space-y-4 ${desktop.incidentMain}`}>
            <ReportCardSkeleton />
            <LocationCardSkeleton />
          </div>
          <div className={`space-y-4 ${desktop.incidentSide}`}>
            <FactsCardSkeleton lines={5} />
            <FactsCardSkeleton lines={3} />
          </div>
        </main>
        <div id="page-shell-end" hidden />
      </div>
    )
  }
  return (
    <div className="min-h-dvh bg-brand" role="status" aria-label="Loading" aria-busy="true">
      <DetailHeaderSkeleton maxWidth={1040} />
      <main className="max-w-5xl mx-auto px-4 py-5 pb-28 lg:pb-8">
        <div className="flex sm:hidden items-center gap-1.5 mb-3">
          <Skeleton tone="brand" className="h-[26px] w-20 rounded-full" />
          <Skeleton tone="brand" className="h-[26px] w-20 rounded-full" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
          <div className="space-y-4">
            <ReportCardSkeleton />
            <LocationCardSkeleton />
          </div>
          <div className="space-y-4">
            <FactsCardSkeleton lines={6} />
            <FactsCardSkeleton lines={3} />
          </div>
        </div>
      </main>
      <div id="page-shell-end" hidden />
    </div>
  )
}

/** Ticket conversation, matching the official and resident ticket pages: the chat header (back,
 *  avatar, title and status), the message column, the composer at the
 *  bottom of the screen. */
export function TicketDetailSkeleton() {
  const bubbles = [['left', 'w-3/5'], ['right', 'w-1/2'], ['left', 'w-2/3'], ['right', 'w-2/5'], ['left', 'w-1/2']]
  return (
    <div className="h-dvh flex flex-col relative overflow-hidden bg-brand" role="status" aria-label="Loading" aria-busy="true">
      <div className={`bg-white relative z-20 px-3 sm:px-6 py-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))] flex items-center gap-2 sm:gap-3 ${desktop.header}`}
        style={{ borderBottom: '1px solid var(--brand-soft)' }} aria-hidden="true">
        <span className={ui.back}><ArrowLeft size={18} strokeWidth={1.9} /></span>
        <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <Skeleton className="h-4 w-40 max-w-full" />
          <Skeleton className="h-3 w-56 max-w-full" />
        </div>
        <Skeleton className="h-9 w-20 rounded-xl flex-shrink-0" />
      </div>
      <main className={`flex-1 relative z-10 flex flex-col max-w-2xl w-full mx-auto px-3 sm:px-4 py-4 overflow-hidden ${desktop.chatPage}`}>
        <div className="flex-1 flex flex-col gap-3 overflow-hidden">
          <Skeleton tone="brand" className="h-6 w-24 rounded-full self-center" />
          {bubbles.map(([side, w], i) => (
            <div key={i} className={`flex items-end gap-2 ${side === 'right' ? 'flex-row-reverse' : ''}`}>
              {side === 'left' && <Skeleton tone="brand" className="w-7 h-7 rounded-full flex-shrink-0" />}
              <div className={`${w} h-16 rounded-[10px] ${side === 'left' ? 'bg-white/90 p-3 space-y-2' : 'skeleton-shimmer skeleton-on-brand'}`}>
                {side === 'left' && <><Skeleton className="h-3 w-1/2" /><Skeleton className="h-3 w-4/5" /></>}
              </div>
            </div>
          ))}
        </div>
        <Skeleton tone="brand" className="h-12 w-full rounded-[10px] mt-3 flex-shrink-0" />
      </main>
      <div id="page-shell-end" hidden />
    </div>
  )
}
