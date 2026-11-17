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
import { ArrowLeft } from 'lucide-react'
import { NotificationBannerView } from '@/components/NotificationBanner'
import { DASHBOARD_SKELETONS, dashboardKinds, dashboardColumn } from '@/lib/dashboardSkeletons'
import ui from '@/components/app-ui.module.css'
import desktop from '@/components/desktop-pages.module.css'

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
        <Skeleton className="w-10 h-10 rounded-2xl flex-shrink-0" />
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

/** A white-on-purple section label ("NEEDS THE BARANGAY"). */
function LabelSkeleton({ className = 'w-36' }) {
  return <Skeleton tone="brand" className={`h-3 mb-3 rounded-md ${className}`} />
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
        <Skeleton className="h-[62px] w-full rounded-2xl mt-4" />
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
          <Skeleton className="w-11 h-11 rounded-2xl flex-shrink-0" />
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
        <Skeleton className="h-11 w-full rounded-2xl" />
        <div className="flex gap-2 overflow-hidden">
          {[14, 20, 20, 20].map((w, i) => <Skeleton key={i} className="h-8 rounded-full flex-shrink-0" style={{ width: `${w * 4}px` }} />)}
        </div>
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-8 w-40 rounded-xl" />
          <Skeleton className="h-8 w-24 rounded-xl" />
        </div>
      </div>
      <Skeleton tone="brand" className="h-3 w-24 rounded-md !mt-4" />
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
        <Skeleton tone="brand" className="h-3 w-16 rounded-md my-0.5" />
        <div className="h-10 w-40 rounded-2xl bg-white/90" />
      </div>
      <div className="flex items-center gap-2.5 mt-2 mb-0.5 px-0.5">
        <Skeleton tone="brand" className="h-3 w-24 rounded-md my-0.5" />
        <span className="flex-1 h-px bg-white/20" aria-hidden="true" />
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
        <Skeleton className="w-10 h-10 rounded-2xl flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-60 max-w-full" />
        </div>
      </div>
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="white-card p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-2xl flex-shrink-0" />
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
      <Skeleton className="w-11 h-11 rounded-2xl flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-3 w-56 max-w-full" />
      </div>
    </div>
  )
  const rows = (n) => [...Array(n)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)
  return (
    <div className="space-y-6">
      <div className="white-card p-5">
        {header}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Skeleton className="h-10 rounded-2xl" />
          <Skeleton className="h-10 rounded-2xl" />
        </div>
        <div className="space-y-2">{rows(4)}</div>
      </div>
      <div className="white-card p-5">
        {header}
        <Skeleton className="h-11 w-full rounded-2xl mb-3" />
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
      <Skeleton className="w-16 h-16 rounded-3xl mb-4" />
      <Skeleton className="h-6 w-48 mb-2" />
      <Skeleton className="h-3.5 w-72 max-w-full mb-6" />
      <Skeleton className="h-11 w-44 rounded-2xl" />
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
          {side === 'left' && <Skeleton tone="brand" className="w-8 h-8 rounded-full flex-shrink-0" />}
          <Skeleton tone="brand" className={`h-14 ${w} rounded-2xl`} />
        </div>
      ))}
      <Skeleton tone="brand" className="h-12 w-full rounded-2xl mt-4" />
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
      <div className="w-full sm:w-[456px] h-20 sm:h-16 rounded-2xl bg-white/90 flex items-center gap-3 px-[18px]">
        <Skeleton className="w-9 h-9 rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-3 w-52 max-w-full" />
        </div>
        <Skeleton className="w-11 h-6 rounded-full flex-shrink-0" />
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------------
   Dashboard frame
   ---------------------------------------------------------------------- */

/** Mirrors components/DashboardSidebar.jsx, open and collapsed. Which one
 *  shows is CSS (see .dash-shell in globals.css). */
function SidebarSkeleton() {
  return (
    <aside className="dash-shell-aside hidden desk:flex fixed top-0 left-0 h-dvh flex-col bg-white overflow-hidden z-30"
      style={{ boxShadow: '4px 0 24px rgba(91,84,232,0.1)' }} aria-hidden="true">
      {/* Open (w-64) */}
      <div className="dash-shell-sb-open flex-col h-full">
        <div className="flex items-center gap-3 px-4 py-4" style={{ borderBottom: '1px solid var(--brand-soft)' }}>
          <div className="w-9 h-9 relative flex-shrink-0">
            <Image src="/logo.png" alt="" fill sizes="36px" loading="eager" className="object-contain" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm text-gray-800">BH360</p>
            <Skeleton className="h-2.5 w-28 mt-1.5" />
          </div>
          <Skeleton className="w-8 h-8 rounded-xl" />
        </div>
        <div className="px-3 py-3 border-b border-gray-100">
          <div className="rounded-2xl p-3 h-[171px]" style={{ background: 'linear-gradient(135deg, var(--brand-soft), white)', border: '1px solid var(--brand-border)' }}>
            <Skeleton className="h-3 w-20 mb-3" />
            <div className="grid grid-cols-2 gap-2">
              {[...Array(4)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-white" />)}
            </div>
          </div>
        </div>
        <div className="px-3 h-[69px] flex items-center border-b border-gray-100">
          <Skeleton className="h-[37px] w-full rounded-xl" />
        </div>
        <div className="px-3 py-3 space-y-4 flex-1 overflow-hidden">
          {[2, 4, 3].map((n, s) => (
            <div key={s}>
              <Skeleton className="h-2.5 w-16 ml-3 mb-3" />
              <div className="space-y-0.5">
                {[...Array(n)].map((_, i) => (
                  <div key={i} className="h-[46px] px-3 flex items-center gap-3">
                    <Skeleton className="w-4 h-4 rounded-md flex-shrink-0" />
                    <Skeleton className="h-3 flex-1 max-w-[120px]" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="px-3 py-3">
          <Skeleton className="h-[59px] w-full rounded-2xl" />
        </div>
      </div>
      {/* Collapsed (w-16) */}
      <div className="dash-shell-sb-closed flex-col items-center h-full">
        <div className="h-[69px] w-full flex items-center justify-center" style={{ borderBottom: '1px solid var(--brand-soft)' }}>
          <div className="w-9 h-9 relative">
            <Image src="/logo.png" alt="" fill sizes="36px" loading="eager" className="object-contain" />
          </div>
        </div>
        <div className="flex-1 py-4 space-y-2.5 overflow-hidden">
          {[...Array(9)].map((_, i) => <Skeleton key={i} className="w-9 h-9 rounded-xl" />)}
        </div>
        <div className="py-3">
          <Skeleton className="w-9 h-9 rounded-full" />
        </div>
      </div>
    </aside>
  )
}

/** Mirrors components/DashboardHeader.jsx (76px). */
function DashboardHeaderSkeleton() {
  return (
    <div className={`bg-white min-h-[76px] px-4 sm:px-6 py-3 flex items-center justify-between gap-4 ${ui.dashboardHeader || ''} ${ui.safeTop}`} aria-hidden="true">
      <div className="flex items-center gap-3 min-w-0">
        <Skeleton className="w-11 h-11 rounded-xl desk:hidden flex-shrink-0" />
        <div className="space-y-2 min-w-0">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-3 w-52 max-w-full" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="hidden lg:block h-10 lg:w-72 xl:w-[450px] rounded-xl" />
        <Skeleton className="hidden sm:block h-9 w-24 rounded-xl" />
        <Skeleton className="w-9 h-9 rounded-xl" />
        <Skeleton className="w-9 h-9 rounded-full" />
      </div>
    </div>
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
 * The whole dashboard frame — sidebar, header, banner, section — while a
 * dashboard loads. Drawn in two places that must look identical:
 *
 * - The page's Suspense fallback (the static HTML, before JavaScript):
 *   leave `kind`, `sidebarOpen` and `banner` out. It renders every section
 *   variant and the predicted banner; CSS shows the ones the boot script in
 *   lib/dashboardSkeletons.js chose for this URL and this browser.
 * - The page itself while its data loads: pass the section's `kind`, the
 *   real `sidebarOpen`, and `banner={<NotificationBanner />}`.
 *
 * The ambient background is not part of it: the page draws that once,
 * outside the boundary (DashboardBackdrop), so it never restarts.
 */
export function DashboardShellSkeleton({ path, kind, sidebarOpen, banner }) {
  const { lead } = DASHBOARD_SKELETONS[path]
  const kinds = kind ? [kind] : dashboardKinds(path)
  return (
    <div className="dash-shell min-h-dvh flex relative"
      data-sidebar={sidebarOpen === undefined ? undefined : sidebarOpen ? 'open' : 'closed'}
      role="status" aria-label="Loading" aria-busy="true">
      <SidebarSkeleton />
      <div className="dash-shell-column flex-1 flex flex-col min-w-0 relative z-10 h-dvh overflow-hidden">
        <DashboardHeaderSkeleton />
        <div className="flex-1 pad-safe overflow-hidden [scrollbar-gutter:stable]">
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
        </div>
      </div>
      {/* End of the static skeleton: the boot script holds the first paint
          until the browser has parsed this far (lib/dashboardSkeletons.js). */}
      {!kind && <div id="dash-shell-end" hidden />}
    </div>
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
      <div className={ui.headerInner}>
        <span className={ui.back}><ArrowLeft size={19} /></span>
        {title ? (
          <>
            {Icon && <span className={ui.headerIcon}><Icon size={21} /></span>}
            <div className={ui.heading}><h1>{title}</h1>{description && <p>{description}</p>}</div>
          </>
        ) : (
          <div className={`${ui.heading} space-y-2`}>
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-3 w-60 max-w-full" />
          </div>
        )}
        {/* A header button (Settings' Save): wraps to its own row on phones,
            like the real one. */}
        {actions && <div className={ui.headerActions}><Skeleton className="h-11 w-full sm:w-36 rounded-xl" /></div>}
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
        <Skeleton className="w-11 h-11 rounded-2xl flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className={`h-4 ${title}`} />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      {[...Array(lines)].map((_, i) => <Skeleton key={i} className={`h-3 ${i % 2 ? 'w-4/5' : 'w-full'}`} />)}
    </div>
  )
}

/** app/profile: the profile card, the tab row, the open tab's card. */
function ProfileBody() {
  return (
    <main className={`relative z-10 max-w-3xl mx-auto px-4 py-8 space-y-6 ${desktop.profilePage}`}>
      <div className={`white-card overflow-hidden ${desktop.profileCard}`}>
        <Skeleton className="h-24 w-full rounded-none" />
        <div className="px-6 pb-6 -mt-12 relative">
          <div className="w-20 h-20 rounded-3xl bg-white p-1"><Skeleton className="w-full h-full rounded-[20px]" /></div>
          <Skeleton className="h-6 w-48 mt-4" />
          <Skeleton className="h-5 w-28 mt-2 rounded-full" />
          <Skeleton className="h-3 w-full mt-4" />
          <Skeleton className="h-3 w-2/3 mt-2" />
        </div>
      </div>
      <div className={`flex gap-2 pb-1 ${desktop.profileTabs}`}>
        {[78, 102, 105].map((w, i) => <Skeleton key={i} tone="brand" className="h-9 rounded-2xl" style={{ width: w }} />)}
      </div>
      <CardLines title="w-40" lines={4} />
    </main>
  )
}

/** app/help: hero, the tab list, the FAQ. */
function HelpBody() {
  return (
    <main className={`relative z-10 max-w-2xl mx-auto px-4 py-6 space-y-4 ${desktop.helpPage}`}>
      <div className={`glass-card p-5 flex items-center gap-3 ${desktop.wide}`}>
        <Skeleton tone="brand" className="w-12 h-12 rounded-2xl flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton tone="brand" className="h-4 w-44" />
          <Skeleton tone="brand" className="h-3 w-64 max-w-full" />
        </div>
      </div>
      <div className={`white-card p-2 ${desktop.helpTabs}`}>
        <div className="grid grid-cols-4 lg:grid-cols-1 gap-1 lg:gap-1.5">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-[60px] lg:h-[44px] rounded-xl" />)}
        </div>
      </div>
      <div className="space-y-3">
        <div className="white-card p-4 h-[76px] flex items-center"><Skeleton className="h-11 w-full rounded-2xl" /></div>
        <div className={`space-y-2 ${desktop.faqGrid}`}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="white-card px-4 h-[52px] flex items-center"><Skeleton className="h-3.5 w-3/4" /></div>
          ))}
        </div>
      </div>
    </main>
  )
}

/** app/settings: five setting cards (three columns on desktop). */
function SettingsBody() {
  return (
    <main className={`relative z-10 max-w-2xl mx-auto px-4 py-6 space-y-4 ${desktop.settingsPage}`}>
      <CardLines title="w-28" lines={8} />
      <CardLines title="w-24" lines={3} />
      <CardLines title="w-28" lines={1} />
      <CardLines title="w-24" lines={3} />
      <CardLines title="w-36" lines={5} />
      <div className="h-[88px]" />
    </main>
  )
}

/**
 * A standalone page (profile, help, settings, admin…): its header, then the
 * body. `header` is { title, description, icon } — the page's real header
 * text. `layout` picks a body that mirrors that page; without one, a column
 * of cards (optionally under a row of `tabs`).
 */
export function PageSkeleton({ header = {}, layout, cards = 3, maxWidth = 768, tabs = 0 }) {
  let body
  if (layout === 'profile') body = <ProfileBody />
  else if (layout === 'help') body = <HelpBody />
  else if (layout === 'settings') body = <SettingsBody />
  else body = (
    <div className="mx-auto p-4 sm:p-6 space-y-4" style={{ maxWidth }}>
      {tabs > 0 && (
        <div className="flex gap-2">
          {[...Array(tabs)].map((_, i) => <Skeleton key={i} tone="brand" className="h-9 w-24 rounded-2xl" />)}
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
      <div className={ui.headerInner} style={maxWidth ? { maxWidth } : undefined}>
        <span className={ui.back}><ArrowLeft size={19} /></span>
        <span className={ui.headerIcon}><Skeleton className="w-5 h-5 rounded-md" /></span>
        <div className={`${ui.heading} space-y-2`}>
          <Skeleton className="h-5 w-48 max-w-full" />
          <Skeleton className="h-3 w-40 max-w-full" />
        </div>
        {pills && (
          <div className={`${ui.headerActions} ${ui.desktopOnly}`}>
            <Skeleton className="h-[26px] w-20 rounded-[9px]" />
            <Skeleton className="h-[26px] w-20 rounded-[9px]" />
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
      <Skeleton className="h-11 w-full rounded-2xl" />
    </div>
  )
}

/** Location: address line, the map (same fluid height as MiniMap there), directions. */
function LocationCardSkeleton() {
  return (
    <div className="white-card p-5 space-y-3">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-3.5 w-40" />
      <Skeleton className="w-full rounded-2xl" style={{ height: 'clamp(180px, 32dvh, 340px)' }} />
      <Skeleton className="h-11 w-full rounded-2xl" />
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
          <div className={`rounded-2xl px-4 py-4 flex items-start gap-3 bg-white/85 ${desktop.wide}`}>
            <Skeleton className="w-10 h-10 rounded-2xl flex-shrink-0" />
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
        <span className={ui.back}><ArrowLeft size={19} /></span>
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
              <div className={`${w} h-16 rounded-2xl ${side === 'left' ? 'bg-white/90 p-3 space-y-2' : 'skeleton-shimmer skeleton-on-brand'}`}>
                {side === 'left' && <><Skeleton className="h-3 w-1/2" /><Skeleton className="h-3 w-4/5" /></>}
              </div>
            </div>
          ))}
        </div>
        <Skeleton tone="brand" className="h-12 w-full rounded-2xl mt-3 flex-shrink-0" />
      </main>
      <div id="page-shell-end" hidden />
    </div>
  )
}
