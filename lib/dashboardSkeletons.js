import { DESK_LAYOUT, SIDEBAR_OPEN_BY_DEFAULT } from './layout'

/**
 * Which loading placeholder each dashboard section shows — the one source of
 * truth for both places a dashboard skeleton is drawn:
 *
 *  1. the page itself while its data loads (it knows the section), and
 *  2. the static HTML the server sends before any JavaScript runs (the
 *     Suspense fallback). That HTML is prerendered once per route, so it
 *     cannot know `?section=` or the saved sidebar width. BOOT_SCRIPT, an
 *     inline script in the root layout's <head>, reads both before the first
 *     paint and records them on <html>; CSS then shows the matching skeleton.
 *
 * Both draw the same <DashboardShellSkeleton>, so a refresh shows one stable
 * skeleton from the first paint until the data lands.
 *
 * Kinds: overview | records | announcements | table | analytics | launcher | chat
 * columns: the max-width class each kind's content sits in (resident and
 *          tanod centre a narrow column; official uses the full width).
 * lead:    a block every section of that dashboard starts with ('duty' — the
 *          tanod's duty toggle card).
 */
export const DASHBOARD_SKELETONS = {
  '/official': {
    param: 'section',
    fallback: 'dashboard',
    kinds: {
      dashboard: 'overview', incidents: 'records', announcements: 'announcements', tickets: 'records',
      documents: 'records', verifications: 'records', blotter: 'records', tanods: 'records',
      users: 'table', map: 'launcher', calendar: 'launcher', analytics: 'launcher',
    },
  },
  '/resident': {
    param: 'section',
    fallback: 'home',
    kinds: {
      home: 'overview', announcements: 'announcements', incidents: 'records', tickets: 'records',
      documents: 'records', blotter: 'records', ai: 'launcher',
    },
    columns: { overview: 'max-w-4xl 2xl:max-w-5xl', records: 'max-w-3xl 2xl:max-w-6xl', default: 'max-w-3xl' },
  },
  '/tanod': {
    param: 'section',
    fallback: 'home',
    kinds: { home: 'overview', active: 'records', resolved: 'records', stats: 'analytics' },
    columns: { analytics: 'max-w-3xl', default: 'max-w-2xl' },
    lead: 'duty',
  },
}

/** The distinct skeleton kinds a dashboard can show, default first. */
export function dashboardKinds(path) {
  const { kinds, fallback } = DASHBOARD_SKELETONS[path]
  return [...new Set([kinds[fallback], ...Object.values(kinds)])]
}

/** The max-width class for a kind's column on this dashboard ('' = full). */
export function dashboardColumn(path, kind) {
  const columns = DASHBOARD_SKELETONS[path].columns
  return columns ? columns[kind] || columns.default : ''
}

// Must match lib/useSidebarState.js: desktop layout only; the saved choice,
// or with none, open from 1024px up (lib/layout.js).
const SIDEBAR_KEY = 'sidebarOpen'

const routes = Object.fromEntries(
  Object.entries(DASHBOARD_SKELETONS).map(([path, r]) => [path, { p: r.param, f: r.fallback, k: r.kinds }])
)

// Standalone pages whose static HTML is their loading skeleton (PageSkeleton,
// which ends in #page-shell-end), and every route that draws the app frame.
const SKELETON_PAGES = ['/profile', '/help', '/settings', '/admin']
const APP_ROUTE = '^/(official|resident|tanod|admin|profile|help|settings)(/|$)'

// Must match components/NotificationBanner.jsx: shown when the browser
// supports notifications, permission isn't granted, and it wasn't dismissed
// this session.
const BANNER_DISMISS_KEY = 'notif-banner-dismissed'

/**
 * Runs during HTML parsing, before the first paint and before React. Sets
 *   <html data-sidebar="open|closed">  the saved desktop sidebar width
 *   <html data-skeleton="records">     the section skeleton for this URL
 *   <html data-banner="ask|denied">    the notification banner will show
 *   <html data-app>                    an app page (purple, white header):
 *                                      globals.css paints that on the canvas
 * and holds the first paint until the whole skeleton has been parsed
 * (<link rel=expect blocking=render> → #dash-shell-end / #page-shell-end,
 * the skeleton's last element). Without it a slow phone painted the
 * half-parsed skeleton — the banner over an empty section. Browsers without
 * support paint as before. Only routes whose static HTML is known to contain
 * the marker get it, so nothing can wait on a marker that never comes.
 * Wrapped in try/catch: if storage is blocked the skeleton simply shows the
 * defaults (sidebar open, the dashboard's home section, no banner).
 */
export const BOOT_SCRIPT = `(function(){try{
var d=document.documentElement,p=location.pathname,r=${JSON.stringify(routes)}[p],s=null,b=null;
function hold(id){var l=document.createElement('link');l.rel='expect';l.href='#'+id;l.setAttribute('blocking','render');document.head.appendChild(l)}
try{s=localStorage.getItem(${JSON.stringify(SIDEBAR_KEY)})}catch(e){}
d.setAttribute('data-sidebar',matchMedia(${JSON.stringify(DESK_LAYOUT)}).matches&&(s===null?!matchMedia(${JSON.stringify(SIDEBAR_OPEN_BY_DEFAULT)}).matches:s==='false')?'closed':'open');
if(new RegExp(${JSON.stringify(APP_ROUTE)}).test(p))d.setAttribute('data-app','');
if(${JSON.stringify(SKELETON_PAGES)}.indexOf(p)>=0)hold('page-shell-end');
if(!r)return;
d.setAttribute('data-skeleton',r.k[new URLSearchParams(location.search).get(r.p)]||r.k[r.f]);
hold('dash-shell-end');
try{b=sessionStorage.getItem(${JSON.stringify(BANNER_DISMISS_KEY)})}catch(e){}
var n='Notification' in window?Notification.permission:'granted';
if(n!=='granted'&&!b)d.setAttribute('data-banner',n==='denied'?'denied':'ask');
}catch(e){}})()`
