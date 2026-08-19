# BarangayHub 360 🛡️

**Smart Barangay Management System** — a web platform that connects residents, barangay tanods, and officials in one place: incident reporting, support tickets with live chat, announcements, analytics, and AI-powered assistance.

> Capstone project. Built with Next.js 16, Supabase, and Tailwind CSS. Deployed on Vercel.

---

## ✨ Features

### For Residents
- **🚨 Incident Reporting** — report emergencies and community issues across 13 categories (fire, flood, theft, medical, noise, garbage, infrastructure, and more). **Priority is not chosen by the reporter** — it is derived from the category via the Philippine law that governs it, so a noise complaint cannot be filed as "Critical" and displace a real emergency
  - ⚖️ Every category shows its governing statute with the specific sections relied on, what those sections say, and a link to the text — and whether the barangay may act directly or must refer to another agency
  - 📍 Pin the exact location on an interactive map or use GPS ("Use My Location" with accuracy feedback)
  - 📷 Attach photo evidence — large photos are automatically compressed client-side (~500KB target) so reports upload fast even on mobile data
- **📄 Document Requests** — request a barangay clearance, certificate of residency or indigency, barangay ID, first-time jobseeker certificate, business clearance or good-moral certificate, with the **RA 11032 deadline shown before you file** and a live countdown in working days afterwards
  - ⏱️ 3 working days for a simple request, 7 for a complex one — weekends and Philippine holidays excluded. If the deadline passes with no decision, your request is **deemed approved** under RA 11032 Sec. 10 and the app says so
  - ✅ Requires a barangay official to have verified your account first, because a barangay certification is an official statement about where you live
- **🎫 Support Tickets** — file inquiries, requests, complaints, or feedback and chat with barangay officials in **real time**, with status tracking (Open → In Progress → Closed)
- **🤖 AI Assistant** — a Claude-powered chatbot that answers common barangay questions (clearances, permits, office hours, how to file complaints)
- **⭐ Service Ratings** — rate resolved incidents and leave feedback for the responding tanod

### For Barangay Tanods (Field Officers)
- **📋 Assignment Dashboard** — active assignments sorted by priority, with realtime notifications when a new incident is assigned (Critical assignments get louder, longer alerts)
- **🗺️ One-tap Navigation** — open the incident location in Google Maps, Waze, or Apple Maps; call the reporter directly from the card
- **✅ Resolution Workflow** — mark incidents resolved with notes and photo proof
- **🏆 Performance & Gamification** — personal stats (resolution rate, average response time, resident ratings), achievements with progress tracking, and recent rating feedback

### For Barangay Officials
- **📢 Announcements** — broadcast to all residents, with quick templates, live preview, draft autosave, and a **60-second undo window** (announcements only become visible to residents after the window closes)
- **🎫 Ticket Management** — realtime chat with residents, one-tap canned replies, resident contact info at a glance, close/reopen workflow with claim-conflict protection
- **📊 Analytics Dashboard** — KPIs with week-over-week trends, tanod leaderboard (weighted performance score), activity heatmap (day × hour), category trends, daily activity charts, and **AI-generated insight reports** powered by Claude
- **🗺️ Live Incident Map** — all geotagged incidents on one map with status/category filters, updating in **real time** as new reports arrive
- **📅 Calendar View** — incidents and announcements by date, with monthly stats
- **📄 Exports** — branded PDF reports and CSV exports (with formula-injection protection)
- **✅ Resident Verification** — every account is confirmed by a named official before the barangay will issue documents in that person's name; approve or reject with a reason, all through a locked-down RPC
- **📑 Document Queue** — requests sorted by RA 11032 deadline (soonest first), with the statutory one-time extension, written denials, and a standing flag for anything already deemed approved under Sec. 10

### For the Super Admin
- **🌐 Platform-wide Incident Feed** — every barangay's incidents in one list, live, with barangay / status / priority filters and a flag for reports left pending past their response window

### Platform
- Role-based access (Resident / Tanod / Official / Super Admin) enforced with Supabase **Row Level Security**
- Realtime updates via Supabase channels (chat messages, ticket status, incident assignments, map markers)
- Session refresh handled at the network boundary (`proxy.js`, the Next.js 16 convention)

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router, Turbopack) |
| Language | JavaScript + TypeScript (gradual migration) |
| Backend / DB | [Supabase](https://supabase.com) — Postgres, Auth, Realtime, Storage, RLS |
| Styling | [Tailwind CSS](https://tailwindcss.com) + custom glassmorphism design system |
| AI | [Anthropic Claude API](https://docs.claude.com) (assistant chatbot + analytics reports) |
| Charts | [Recharts](https://recharts.org) |
| Maps | Interactive map components (`MapPicker`, `IncidentMap`, `MiniMap`) |
| Exports | jsPDF + jspdf-autotable |
| UX | react-hot-toast, lucide-react, browser-image-compression |
| Hosting | [Vercel](https://vercel.com) |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- A [Supabase](https://supabase.com) project
- An [Anthropic API key](https://console.anthropic.com) (for the AI assistant and analytics)

### 1. Clone and install

```bash
git clone https://github.com/CassienSin/BH360-2.0.git
cd BH360-2.0
npm install
```

### 2. Environment variables

Create `.env.local` in the project root:

```bash
# Supabase (Dashboard → Settings → API)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Server-only — never exposed to the browser (no NEXT_PUBLIC_ prefix)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Anthropic (for /api/ai-chat and /api/ai-analytics)
ANTHROPIC_API_KEY=your-anthropic-key
```

Add the same variables in **Vercel → Project → Settings → Environment Variables** for deployment.

### 3. Database setup

In the Supabase SQL editor:

1. Paste **`supabase/setup.sql`** into the SQL editor and run it. It is the single source of truth
   for every table, RLS policy, function, trigger, storage bucket and realtime setting, and it is
   idempotent — safe to re-run on a project that already has an earlier version of the schema.
2. Follow the **MANUAL STEPS** at the bottom of that file (PSGC import, first super admin, auth settings).
3. Verify **RLS policies**: residents see only their own tickets/incidents/document requests; tanods
   see incidents assigned to them; officials are scoped to their `barangay_id`; the super admin sees
   incidents across every barangay; residents only see announcements where `published_at <= now()`.

Re-running `setup.sql` on an existing project adds resident verification and document requests
without disturbing existing data — accounts that pre-date verification are grandfathered in as
verified rather than being locked out.

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Before pushing, catch problems locally instead of on Vercel:

```bash
npm test          # unit tests for the pure legal/date logic
npx tsc --noEmit
npm run build
```

### Tests

`lib/` holds the logic where a wrong answer is a legal claim the app makes on
screen — the RA 11032 working-day deadline, the queue-aging clock, the
category-to-statute table — so that is what is covered:

| Suite | What it pins down |
|---|---|
| `documents.test.js` | 3/7/20-working-day ceilings, Philippine holidays (including the movable Holy Week dates), the deemed-approved rule |
| `triage.test.js` | the two-phase response/resolution clock, and that an automatic assignment does not stop it |
| `legalBasis.test.js` | every category carries a checkable citation; the corrections that prompted the table |
| `storage.test.js` | incident photo paths, legacy public URLs and current bare paths alike |
| `verification.test.js` | who may have a document issued in their name |

```bash
npm test          # once
npm run test:watch
```

---

## 🗂️ Project Structure

```
├── app/                    # Next.js App Router pages
│   ├── admin/              # Super admin portal — manage barangays, accounts, and platform-wide settings
│   ├── api/                # Route handlers (ai-chat, ai-analytics) — server-side Claude API calls
│   ├── help/               # Help center / FAQs and guides for using the platform
│   ├── login/              # Sign in — redirects to the right dashboard by role after auth
│   ├── official/           # Official portal — dashboard, announcements, tickets, analytics, incident map, calendar
│   ├── profile/            # User profile — view and edit personal info, avatar, contact details
│   ├── register/           # Account registration for new residents
│   ├── request-access/     # Access requests for elevated roles (official / tanod), pending approval
│   ├── resident/           # Resident portal — dashboard, incident reporting, support tickets, AI assistant
│   ├── settings/           # Account settings — preferences, password, notifications
│   ├── tanod/              # Tanod field portal — assignments, navigation, resolution workflow, performance stats
│   └── page.tsx            # Landing page (redirects logged-in users to their role's dashboard)
├── components/             # Shared UI (DashboardHeader, Sidebar, MapPicker, ResolveModal, ...)
├── lib/
│   ├── supabase.js         # Browser client (singleton)
│   ├── supabase-server.js  # Server client + getAuthenticatedUser + admin client
│   ├── roles.ts            # dashboardPath — one source of truth per role
│   ├── legalBasis.js       # Incident categories + the RA that governs each one (single source of truth)
│   ├── documents.js        # Citizen's Charter + RA 11032 working-day deadline math
│   ├── verification.js     # What manual verification gates (and what it deliberately doesn't)
│   ├── triage.js           # Queue aging — standing rises with neglect, priority does not
│   ├── timeAgo.js          # Relative-time formatting
│   ├── exports.js          # CSV / branded PDF export utilities
│   └── notifications.js    # Assignment notifications
├── proxy.js                # Supabase session refresh (Next.js 16 network boundary)
└── public/                 # Static assets (logo, icons)
```



---

## 🔒 Security Notes

- **RLS is the authorization layer.** All data access goes through Supabase from the client, so Row Level Security policies — not UI checks — are what actually protect data.
- Server code uses `supabase.auth.getUser()` (verified against the auth server), never `getSession()` (unverified cookie contents).
- The service-role key is server-only and bypasses RLS — it is never imported from client components.
- CSV exports neutralize spreadsheet formula injection (`=`, `+`, `-`, `@` prefixes) since cell contents include resident-supplied text.
- API routes verify the caller via `getAuthenticatedUser()` before spending AI tokens.

---

## 🗺️ Roadmap

- [ ] Server-side enforcement of the RA 11032 deadline (an Edge Function to stamp `deemed_approved_at` and notify, instead of computing it on read)
- [ ] Annual Philippine holiday proclamation import (Eid'l Fitr / Eid'l Adha move each year — see `PROCLAIMED_NON_WORKING_DAYS` in `lib/documents.js`)
- [ ] ID-document upload as part of resident verification
- [ ] Push/SMS notifications for Critical incidents (Edge Function + scheduled publish check)
- [ ] Explicit "Claim ticket" action for officials (replacing auto-claim on open)
- [ ] Date-range filters (7/30/90 days) + cached AI reports on the analytics dashboard
- [ ] Streaming responses for the AI assistant
- [ ] Offline-first incident reporting (PWA + queued submissions)
- [ ] Pagination on list/analytics queries as data grows
- [ ] Shared-module extraction (configs, auth hook, realtime hook) and unit tests for pure helpers
- [ ] Full TypeScript migration

---

## 🎓 About

BarangayHub 360 is a capstone project aimed at modernizing barangay governance in the Philippines — giving residents a faster way to reach their local government, tanods better tools in the field, and officials real visibility into their community.

