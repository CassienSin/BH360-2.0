-- ============================================================================
-- BarangayHub 360 — DATABASE SETUP
-- ============================================================================
-- Single source of truth for a fresh Supabase project: all tables, RLS
-- policies, functions, triggers, storage, and realtime config.
--
-- This file represents the FINAL, hardened state — not a patch history.
-- It consolidates the initial schema with every fix made after a Supabase
-- Security Advisor pass (function search_path pinning, default PUBLIC
-- execute grants revoked, public-bucket listing removed, the invite-code
-- claim race-condition fix, and the privilege-escalation trigger).
--
-- HOW TO RUN (fresh project): Supabase Dashboard → SQL Editor → paste this
-- entire file → Run. Then complete the MANUAL STEPS at the bottom.
--
-- Idempotency: safe to re-run on a project that already has this schema —
-- table/function/policy creation uses IF NOT EXISTS / OR REPLACE / DROP-then-
-- CREATE patterns throughout.
-- ============================================================================


-- ============================================================================
-- SECTION 1 — TABLES
-- ============================================================================

-- Barangays (PSGC reference data — see scripts/import-psgc.mjs)
create table if not exists barangays (
  id uuid default gen_random_uuid() primary key,
  psgc_code text unique,
  name text not null,
  city text not null,
  province text not null,
  region text not null,
  full_address text generated always as (name || ', ' || city || ', ' || province) stored,
  -- Barangay hall hotline, shown by components/ResponderAvailability.jsx when
  -- nobody is on duty or the category must be referred elsewhere. Nullable:
  -- PSGC import populates the ~42,000 reference rows with no phone number.
  phone text,
  created_at timestamptz default now()
);
create index if not exists idx_barangays_province on barangays(province);
create index if not exists idx_barangays_city on barangays(city);
create index if not exists idx_barangays_name on barangays(name);

-- Profiles (extends Supabase auth users)
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  role text not null check (role in ('resident', 'official', 'tanod')),
  address text,
  phone text,
  avatar_url text,
  barangay_id uuid references barangays(id),
  is_super_admin boolean not null default false,
  deactivated_at timestamptz,
  -- Duty state, maintained by the tanod's DutyToggle and by log_duty_change()
  on_duty boolean not null default false,
  duty_changed_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists idx_profiles_barangay on profiles(barangay_id);

-- Announcements (published_at powers the 60-second undo window: rows only
-- become visible to residents once published_at <= now())
create table if not exists announcements (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  content text not null,
  posted_by uuid references profiles(id),
  barangay_id uuid references barangays(id),
  published_at timestamptz not null default now(),
  created_at timestamptz default now()
);
create index if not exists idx_announcements_barangay on announcements(barangay_id);
create index if not exists idx_announcements_published on announcements(published_at);

-- Incidents
-- legal_basis / response_mode / auto_escalated: captured AT REPORT TIME
-- from lib/legalBasis.js — frozen at creation so the audit trail doesn't
-- silently change if the category-to-law mapping is edited later.
create table if not exists incidents (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text not null,
  location text not null,
  category text,
  priority text check (priority in ('Low', 'Medium', 'High', 'Critical')),
  status text default 'pending' check (status in ('pending', 'assigned', 'resolved')),
  image_url text,
  latitude double precision,
  longitude double precision,
  reported_by uuid references profiles(id),
  assigned_to uuid references profiles(id),
  rating integer check (rating >= 1 and rating <= 5),
  rating_feedback text,
  rated_at timestamptz,
  resolution_notes text,
  resolution_image_url text,
  resolved_at timestamptz,
  legal_basis text,
  response_mode text,
  auto_escalated boolean not null default false,

  -- Priority override audit trail. An official may raise or lower the
  -- law-assigned priority, but the original and the written reason are kept
  -- so the record shows both what the law said and what the official decided.
  original_priority text,
  priority_override_reason text,
  priority_overridden_by uuid references profiles(id),
  priority_overridden_at timestamptz,

  -- Time-to-awareness for Critical alerts: acknowledged_at - created_at
  acknowledged_at timestamptz,
  acknowledged_by uuid references profiles(id),

  -- How the current tanod got here (see auto_assign_tanod / mark_manual_assignment)
  assignment_method text check (assignment_method in ('auto', 'auto_offduty', 'manual', 'reassigned')),
  auto_assigned_at timestamptz,

  barangay_id uuid references barangays(id),
  created_at timestamptz default now()
);
create index if not exists idx_incidents_barangay on incidents(barangay_id);
create index if not exists idx_incidents_location_coords on incidents(latitude, longitude);

comment on column incidents.legal_basis is
  'Law citation captured at report time from lib/legalBasis.js. Frozen at creation.';
comment on column incidents.auto_escalated is
  'True if computePriority() raised the priority above what the reporter chose.';

-- Tickets
create table if not exists tickets (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text not null,
  category text,
  status text default 'open' check (status in ('open', 'in_progress', 'closed')),
  created_by uuid references profiles(id),
  handled_by uuid references profiles(id),
  barangay_id uuid references barangays(id),
  created_at timestamptz default now()
);
create index if not exists idx_tickets_barangay on tickets(barangay_id);

-- Ticket Messages (realtime chat)
create table if not exists ticket_messages (
  id uuid default gen_random_uuid() primary key,
  ticket_id uuid references tickets(id) on delete cascade,
  sender_id uuid references profiles(id),
  message text not null,
  created_at timestamptz default now()
);
create index if not exists idx_ticket_messages_ticket on ticket_messages(ticket_id);

-- Invite Codes
-- used: NOT NULL DEFAULT false (a nullable `used` makes `.eq('used', false)`
-- match nothing, since NULL != false in Postgres — every freshly generated
-- code would read as "invalid").
-- used_by: references auth.users, NOT profiles — the code is claimed
-- immediately after signUp but BEFORE the profile row is inserted, so a
-- profiles FK here would fail every claim with a constraint violation.
create table if not exists invite_codes (
  id uuid default gen_random_uuid() primary key,
  code text not null unique,
  role text not null check (role in ('official', 'tanod')),
  used boolean not null default false,
  used_by uuid references auth.users(id),
  used_at timestamptz,
  barangay_id uuid references barangays(id),
  created_at timestamptz default now()
);

-- Barangay Applications (public /request-access form)
create table if not exists barangay_applications (
  id uuid default gen_random_uuid() primary key,
  full_name text not null,
  email text not null,
  phone text,
  position text,
  message text,
  barangay_id uuid references barangays(id),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  rejection_reason text,
  generated_code text,
  created_at timestamptz default now()
);

-- Support Messages (Help & Support contact form)
create table if not exists support_messages (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id),
  subject text,
  message text not null,
  status text not null default 'open',
  created_at timestamptz default now()
);

-- Duty Logs (append-only history of tanods going on/off duty).
-- Written only by the log_duty_change() trigger, never by a client.
create table if not exists duty_logs (
  id uuid default gen_random_uuid() primary key,
  tanod_id uuid not null references profiles(id) on delete cascade,
  barangay_id uuid references barangays(id),
  went_on_duty boolean not null,
  changed_at timestamptz not null default now()
);

-- Tanod Locations (breadcrumb trail while on duty, for the command map).
-- prune_tanod_locations() trims anything older than 24 hours on every
-- insert, so this table stays small without a scheduled job.
create table if not exists tanod_locations (
  id bigint generated always as identity primary key,
  tanod_id uuid not null references profiles(id) on delete cascade,
  barangay_id uuid not null,
  latitude double precision not null,
  longitude double precision not null,
  accuracy double precision,
  recorded_at timestamptz not null default now()
);
create index if not exists tanod_locations_brgy_time on tanod_locations(barangay_id, recorded_at desc);
create index if not exists tanod_locations_tanod_time on tanod_locations(tanod_id, recorded_at desc);

-- Notification Reads (which in-app notifications a user has dismissed).
-- notif_key is a client-composed string, not a foreign key, because a
-- notification can stand for a row in any of several tables.
create table if not exists notification_reads (
  user_id uuid not null references profiles(id) on delete cascade,
  notif_key text not null,
  read_at timestamptz default now(),
  primary key (user_id, notif_key)
);


-- ----------------------------------------------------------------------------
-- UPGRADE PATH
--
-- The CREATE TABLE statements above only run on a fresh project. A database
-- created from an earlier version of this file already has those tables, so
-- the columns added since then have to be applied separately. Every statement
-- here is a no-op the second time it runs.
-- ----------------------------------------------------------------------------

alter table barangays    add column if not exists phone text;

alter table profiles     add column if not exists on_duty boolean not null default false;
alter table profiles     add column if not exists duty_changed_at timestamptz;
alter table profiles     add column if not exists last_seen_at timestamptz;

alter table invite_codes add column if not exists used_at timestamptz;

alter table incidents    add column if not exists original_priority text;
alter table incidents    add column if not exists priority_override_reason text;
alter table incidents    add column if not exists priority_overridden_by uuid references profiles(id);
alter table incidents    add column if not exists priority_overridden_at timestamptz;
alter table incidents    add column if not exists acknowledged_at timestamptz;
alter table incidents    add column if not exists acknowledged_by uuid references profiles(id);
alter table incidents    add column if not exists assignment_method text;
alter table incidents    add column if not exists auto_assigned_at timestamptz;

do $$ begin
  alter table incidents add constraint incidents_assignment_method_check
    check (assignment_method in ('auto', 'auto_offduty', 'manual', 'reassigned'));
exception when duplicate_object then null; end $$;

-- duty_logs.barangay_id predates this constraint in databases created from
-- an earlier version, so add it where it is missing.
do $$ begin
  alter table duty_logs add constraint duty_logs_barangay_id_fkey
    foreign key (barangay_id) references barangays(id);
exception when duplicate_object then null; end $$;

-- Critical reports nobody has acknowledged yet — the query CriticalAlert
-- runs on every dashboard load.
create index if not exists idx_incidents_unacknowledged
  on incidents(barangay_id, created_at)
  where priority = 'Critical' and acknowledged_at is null;

comment on column barangays.phone is
  'Barangay hall hotline shown by components/ResponderAvailability.jsx.';
comment on column incidents.original_priority is
  'The law-assigned priority at report time. Set only when an official overrides it.';
comment on column incidents.priority_override_reason is
  'Required written justification for the override.';
comment on column incidents.acknowledged_at is
  'When an official first acknowledged the critical alert. Time-to-awareness = acknowledged_at - created_at.';
comment on column incidents.assignment_method is
  'How the current tanod was assigned: auto (trigger), auto_offduty (Critical fallback), manual (official), or reassigned.';


-- ============================================================================
-- SECTION 2 — ENABLE RLS ON EVERYTHING
-- ============================================================================
alter table barangays             enable row level security;
alter table profiles              enable row level security;
alter table announcements         enable row level security;
alter table incidents             enable row level security;
alter table tickets               enable row level security;
alter table ticket_messages       enable row level security;
alter table invite_codes          enable row level security;
alter table barangay_applications enable row level security;
alter table support_messages      enable row level security;
alter table duty_logs             enable row level security;
alter table tanod_locations       enable row level security;
alter table notification_reads    enable row level security;


-- ============================================================================
-- SECTION 3 — HELPER FUNCTIONS
-- SECURITY DEFINER avoids infinite recursion when policies on `profiles`
-- need to read `profiles`. Every function below explicitly revokes the
-- PUBLIC default-execute grant Postgres applies to new functions, then
-- grants only to the roles that legitimately call it — Supabase's linter
-- flags any SECURITY DEFINER function still reachable via that default.
-- ============================================================================

create or replace function public.my_barangay_id()
returns uuid language sql stable security definer set search_path = public
as $$ select barangay_id from profiles where id = auth.uid() $$;
revoke all on function public.my_barangay_id() from public;
grant execute on function public.my_barangay_id() to authenticated, service_role;

create or replace function public.my_role()
returns text language sql stable security definer set search_path = public
as $$ select role from profiles where id = auth.uid() $$;
revoke all on function public.my_role() from public;
grant execute on function public.my_role() to authenticated, service_role;

create or replace function public.am_super_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce(is_super_admin, false) from profiles where id = auth.uid() $$;
revoke all on function public.am_super_admin() from public;
grant execute on function public.am_super_admin() to authenticated, service_role;

-- Location dropdown helpers (register / request-access cascading selects).
-- anon needs these — registration happens before the user is authenticated.
create or replace function get_distinct_provinces()
returns table (province text)
language sql stable set search_path = public
as $$ select distinct province from barangays order by province; $$;
revoke all on function get_distinct_provinces() from public;
grant execute on function get_distinct_provinces() to anon, authenticated, service_role;

create or replace function get_distinct_cities(p_province text)
returns table (city text)
language sql stable set search_path = public
as $$ select distinct city from barangays where province = p_province order by city; $$;
revoke all on function get_distinct_cities(text) from public;
grant execute on function get_distinct_cities(text) to anon, authenticated, service_role;


-- ============================================================================
-- SECTION 4 — TABLE POLICIES
-- ============================================================================

drop policy if exists "barangays: public read" on barangays;
create policy "barangays: public read"
  on barangays for select using (true);

-- PROFILES
drop policy if exists "profiles: read own or same barangay or super admin" on profiles;
create policy "profiles: read own or same barangay or super admin"
  on profiles for select
  using (
    id = auth.uid()
    or (barangay_id is not null and barangay_id = public.my_barangay_id())
    or public.am_super_admin()
  );

drop policy if exists "profiles: insert own" on profiles;
create policy "profiles: insert own"
  on profiles for insert
  with check (id = auth.uid());

drop policy if exists "profiles: update own or super admin" on profiles;
create policy "profiles: update own or super admin"
  on profiles for update
  using (id = auth.uid() or public.am_super_admin())
  with check (id = auth.uid() or public.am_super_admin());
-- NOTE: role/barangay_id/is_super_admin changes are additionally blocked
-- by the trigger in Section 6, even for the account's own row.

-- ANNOUNCEMENTS
drop policy if exists "announcements: read published or staff" on announcements;
create policy "announcements: read published or staff"
  on announcements for select
  using (
    (barangay_id = public.my_barangay_id() and published_at <= now())
    or (barangay_id = public.my_barangay_id() and public.my_role() = 'official')
    or public.am_super_admin()
  );

drop policy if exists "announcements: officials insert own barangay" on announcements;
create policy "announcements: officials insert own barangay"
  on announcements for insert
  with check (
    public.my_role() = 'official'
    and barangay_id = public.my_barangay_id()
    and posted_by = auth.uid()
  );

drop policy if exists "announcements: officials update own barangay" on announcements;
create policy "announcements: officials update own barangay"
  on announcements for update
  using (public.my_role() = 'official' and barangay_id = public.my_barangay_id());

drop policy if exists "announcements: officials delete own barangay" on announcements;
create policy "announcements: officials delete own barangay"
  on announcements for delete
  using (public.my_role() = 'official' and barangay_id = public.my_barangay_id());

-- INCIDENTS
drop policy if exists "incidents: read same barangay or super admin" on incidents;
create policy "incidents: read same barangay or super admin"
  on incidents for select
  using (barangay_id = public.my_barangay_id() or public.am_super_admin());

drop policy if exists "incidents: insert own in own barangay" on incidents;
create policy "incidents: insert own in own barangay"
  on incidents for insert
  with check (reported_by = auth.uid() and barangay_id = public.my_barangay_id());

drop policy if exists "incidents: update by staff or reporter" on incidents;
create policy "incidents: update by staff or reporter"
  on incidents for update
  using (
    barangay_id = public.my_barangay_id()
    and (
      public.my_role() in ('official', 'tanod')  -- dispatch / resolve
      or reported_by = auth.uid()                -- rating after resolution
    )
  );

-- TICKETS
drop policy if exists "tickets: read own or staff same barangay" on tickets;
create policy "tickets: read own or staff same barangay"
  on tickets for select
  using (
    created_by = auth.uid()
    or (barangay_id = public.my_barangay_id() and public.my_role() = 'official')
    or public.am_super_admin()
  );

drop policy if exists "tickets: residents insert own" on tickets;
create policy "tickets: residents insert own"
  on tickets for insert
  with check (created_by = auth.uid() and barangay_id = public.my_barangay_id());

drop policy if exists "tickets: update by officials or creator" on tickets;
create policy "tickets: update by officials or creator"
  on tickets for update
  using (
    (barangay_id = public.my_barangay_id() and public.my_role() = 'official')
    or created_by = auth.uid()
  );

-- TICKET MESSAGES (participants = ticket creator + officials of that barangay)
drop policy if exists "ticket_messages: read by participants" on ticket_messages;
create policy "ticket_messages: read by participants"
  on ticket_messages for select
  using (
    exists (
      select 1 from tickets t
      where t.id = ticket_messages.ticket_id
        and (
          t.created_by = auth.uid()
          or (t.barangay_id = public.my_barangay_id() and public.my_role() = 'official')
        )
    )
  );

drop policy if exists "ticket_messages: insert by participants" on ticket_messages;
create policy "ticket_messages: insert by participants"
  on ticket_messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from tickets t
      where t.id = ticket_messages.ticket_id
        and (
          t.created_by = auth.uid()
          or (t.barangay_id = public.my_barangay_id() and public.my_role() = 'official')
        )
    )
  );

-- INVITE CODES: only staff manage them directly. Registration NEVER reads
-- or writes this table from the client — it goes through the
-- validate_invite_code RPC in Section 5 and the handle_new_user trigger in
-- Section 7, so an anonymous or resident session can never enumerate valid
-- codes.
drop policy if exists "invite_codes: officials manage own barangay codes" on invite_codes;
create policy "invite_codes: officials manage own barangay codes"
  on invite_codes for all
  using (
    (public.my_role() = 'official' and barangay_id = public.my_barangay_id())
    or public.am_super_admin()
  )
  with check (
    (public.my_role() = 'official' and barangay_id = public.my_barangay_id())
    or public.am_super_admin()
  );

-- BARANGAY APPLICATIONS
-- Insert is public (anyone may apply) but constrained to a clean pending
-- application — an anonymous request cannot insert a row pre-marked
-- 'approved' with a fabricated invite code.
drop policy if exists "barangay_applications: anyone can apply" on barangay_applications;
create policy "barangay_applications: anyone can apply"
  on barangay_applications for insert
  with check (
    status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and rejection_reason is null
    and generated_code is null
    and barangay_id is not null
  );

drop policy if exists "barangay_applications: super admin reads" on barangay_applications;
create policy "barangay_applications: super admin reads"
  on barangay_applications for select using (public.am_super_admin());

drop policy if exists "barangay_applications: super admin updates" on barangay_applications;
create policy "barangay_applications: super admin updates"
  on barangay_applications for update using (public.am_super_admin());

-- SUPPORT MESSAGES
drop policy if exists "support_messages: insert own" on support_messages;
create policy "support_messages: insert own"
  on support_messages for insert with check (user_id = auth.uid());

drop policy if exists "support_messages: read own or super admin" on support_messages;
create policy "support_messages: read own or super admin"
  on support_messages for select
  using (user_id = auth.uid() or public.am_super_admin());

drop policy if exists "support_messages: super admin updates" on support_messages;
create policy "support_messages: super admin updates"
  on support_messages for update using (public.am_super_admin());

-- Older databases named these policies differently. Postgres ORs permissive
-- policies together, so leaving the originals in place would quietly keep a
-- second, separately-maintained rule on each table — drop them by their old
-- names before creating the current ones.
drop policy if exists "read duty logs" on duty_logs;
drop policy if exists "read own" on notification_reads;
drop policy if exists "insert own" on notification_reads;
drop policy if exists "read tanod locations" on tanod_locations;
drop policy if exists "tanod inserts own location while on duty" on tanod_locations;

-- DUTY LOGS — read-only to clients. The only writer is log_duty_change(),
-- which is SECURITY DEFINER and so bypasses RLS; deliberately no INSERT
-- policy, because a tanod must not be able to forge their own duty history.
drop policy if exists "duty_logs: read own or official same barangay" on duty_logs;
create policy "duty_logs: read own or official same barangay"
  on duty_logs for select
  using (
    tanod_id = auth.uid()
    or exists (
      select 1 from profiles me
      where me.id = auth.uid()
        and me.role = 'official'
        and me.barangay_id = duty_logs.barangay_id
    )
  );

-- TANOD LOCATIONS — a tanod may only post their OWN position, only while
-- on duty, and only into their own barangay. Officials of that barangay and
-- the tanod themselves can read it. Off-duty location is nobody's business.
drop policy if exists "tanod_locations: read own or official same barangay" on tanod_locations;
create policy "tanod_locations: read own or official same barangay"
  on tanod_locations for select
  using (
    tanod_id = auth.uid()
    or exists (
      select 1 from profiles me
      where me.id = auth.uid()
        and me.role = 'official'
        and me.barangay_id = tanod_locations.barangay_id
    )
  );

drop policy if exists "tanod_locations: on-duty tanod inserts own" on tanod_locations;
create policy "tanod_locations: on-duty tanod inserts own"
  on tanod_locations for insert
  with check (
    tanod_id = auth.uid()
    and exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'tanod'
        and p.on_duty = true
        and p.barangay_id = tanod_locations.barangay_id
    )
  );

-- NOTIFICATION READS — strictly per-user.
drop policy if exists "notification_reads: read own" on notification_reads;
create policy "notification_reads: read own"
  on notification_reads for select using (user_id = auth.uid());

drop policy if exists "notification_reads: insert own" on notification_reads;
create policy "notification_reads: insert own"
  on notification_reads for insert with check (user_id = auth.uid());


-- ============================================================================
-- SECTION 5 — INVITE-CODE VALIDATION
-- The table itself is never client-readable (Section 4), so an anonymous or
-- resident session can never enumerate valid codes. The registration form
-- checks a code through validate_invite_code() to show the barangay it
-- belongs to before the user commits; the code is CLAIMED later, by
-- handle_new_user() in Section 7, inside the signup transaction.
-- ============================================================================

create or replace function validate_invite_code(input_code text, input_role text)
returns table (barangay_id uuid, barangay_name text, barangay_city text, barangay_province text)
language sql security definer set search_path = public
as $$
  select ic.barangay_id, b.name, b.city, b.province
  from invite_codes ic
  join barangays b on b.id = ic.barangay_id
  where ic.code = upper(trim(input_code))
    and ic.role = input_role
    and ic.used = false
$$;
revoke all on function validate_invite_code(text, text) from public;
-- anon is intentional: this runs during registration, before the account exists
grant execute on function validate_invite_code(text, text) to anon, authenticated, service_role;

-- claim_invite_code() used to be called by the client right after signUp.
-- It is gone: handle_new_user() (Section 7) claims the code inside the same
-- transaction that creates the auth user, which is strictly better — a
-- failed claim aborts the signup instead of leaving an account with no
-- profile. Dropped rather than left in place, because a privileged RPC
-- nobody calls is just attack surface waiting for someone to find it.
drop function if exists public.claim_invite_code(text, text, uuid);


-- ============================================================================
-- SECTION 6 — PRIVILEGE-ESCALATION PROTECTION
-- Users can edit their own profile — name, phone, address, avatar, duty
-- state — but a CLIENT request can never change the columns that decide
-- what an account is allowed to do: its role, barangay and admin flag, its
-- verification standing, or its deactivation.
--
-- This is the column-level half of the authorization story. RLS decides
-- WHICH ROWS you may write; this trigger decides WHICH COLUMNS. The
-- "profiles: update own or super admin" policy deliberately lets people
-- edit themselves, so without this trigger self-verification and
-- self-reactivation would both be a single UPDATE away.
--
-- Super admins bypass all of it, and so do server-side/SQL-editor
-- operations (auth.uid() IS NULL — no client session), which is what lets
-- you bootstrap the first super admin below.
-- ============================================================================

create or replace function prevent_privilege_escalation()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  caller_is_super boolean;
  caller_role     text;
  caller_barangay uuid;
begin
  -- No client session (SQL editor, service role, a SECURITY DEFINER call
  -- from a trigger) — trusted path, nothing to guard.
  if auth.uid() is null then
    return new;
  end if;

  select coalesce(is_super_admin, false), role, barangay_id
    into caller_is_super, caller_role, caller_barangay
  from profiles where id = auth.uid();

  if caller_is_super then
    return new;
  end if;

  -- 1. Role, barangay and admin flag: never from a client.
  if new.role is distinct from old.role
     or new.barangay_id is distinct from old.barangay_id
     or new.is_super_admin is distinct from old.is_super_admin
  then
    raise exception 'You cannot change role, barangay, or admin status';
  end if;

  -- 2. Verification standing.
  --
  -- Without this, the whole manual-verification feature is decoration: the
  -- "profiles: update own or super admin" policy lets anyone write their own
  -- row, so a resident could simply set verification_status = 'verified' on
  -- themselves and skip the barangay entirely. It is not enough to check
  -- WHO is updating — it has to be checked HERE, on the columns.
  --
  -- The legitimate path is set_verification_status(), which is SECURITY
  -- DEFINER and so bypasses RLS; auth.uid() inside it is still the official,
  -- which is what the branch below recognises. A direct client UPDATE cannot
  -- reach another person's row at all (RLS), and its own row is refused by
  -- the first test, so those four columns are unreachable from a client.
  if new.verification_status is distinct from old.verification_status
     or new.verification_note is distinct from old.verification_note
     or new.verified_by       is distinct from old.verified_by
     or new.verified_at       is distinct from old.verified_at
  then
    if new.id = auth.uid() then
      raise exception 'You cannot change your own verification status';
    end if;
    if not (caller_role = 'official'
            and caller_barangay is not null
            and caller_barangay = new.barangay_id)
    then
      raise exception 'Only a barangay official of this barangay may change verification';
    end if;
  end if;

  -- 3. Deactivation is one-way from a client. app/settings lets someone
  --    close their own account; nothing lets them reopen it, or close
  --    somebody else's. A super admin (above) can still do both.
  if old.deactivated_at is not null and new.deactivated_at is null then
    raise exception 'You cannot reactivate a deactivated account';
  end if;
  if new.deactivated_at is distinct from old.deactivated_at and new.id <> auth.uid() then
    raise exception 'You cannot deactivate another account';
  end if;

  return new;
end;
$$;
revoke all on function prevent_privilege_escalation() from public;
-- No client role needs EXECUTE — only the trigger below invokes it.
grant execute on function prevent_privilege_escalation() to service_role;

drop trigger if exists protect_profile_privileges on profiles;
create trigger protect_profile_privileges
  before update on profiles
  for each row
  execute function prevent_privilege_escalation();


-- ============================================================================
-- SECTION 7 — SIGNUP, AUTO-DISPATCH AND DUTY TRIGGERS
--
-- These are the pieces that make the app work without the client being
-- trusted: the profile row is created by the database from auth metadata,
-- invite codes are claimed inside that same transaction, and a new incident
-- is assigned to a tanod before it is ever visible.
-- ============================================================================

-- Creates the profile row for every new auth user.
--
-- This is why app/register/page.jsx never inserts into profiles: signup is
-- ONE atomic operation. Two things follow from that. A role string from the
-- client is never trusted — anything unexpected collapses to 'resident'. And
-- an official/tanod signup that cannot claim an unused code for that role
-- raises, which aborts the whole signup: no auth user, no orphaned account,
-- no burnt code. The barangay comes from the CODE, not the client, so a
-- stolen code cannot be pointed at a different barangay.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  meta jsonb := new.raw_user_meta_data;
  v_role text := coalesce(nullif(trim(meta->>'role'), ''), 'resident');
  v_code text := upper(trim(coalesce(meta->>'invite_code', '')));
  v_barangay uuid;
  claimed_barangay uuid;
begin
  if v_role not in ('resident', 'official', 'tanod') then
    v_role := 'resident';
  end if;

  -- Residents pick their own barangay client-side.
  begin
    v_barangay := (meta->>'barangay_id')::uuid;
  exception when others then
    v_barangay := null;
  end;

  -- The claim is atomic: `and used = false` means two signups racing on the
  -- same code cannot both win — the second UPDATE matches zero rows.
  if v_role <> 'resident' then
    update public.invite_codes
       set used = true,
           used_by = new.id,
           used_at = now()
     where upper(trim(code)) = v_code
       and role = v_role
       and used = false
    returning barangay_id into claimed_barangay;

    if claimed_barangay is null then
      raise exception 'invalid_invite_code';
    end if;

    v_barangay := claimed_barangay;
  end if;

  insert into public.profiles (id, full_name, role, barangay_id, phone, address)
  values (
    new.id,
    coalesce(nullif(trim(meta->>'full_name'), ''), 'Resident'),
    v_role,
    v_barangay,
    coalesce(meta->>'phone', ''),
    coalesce(meta->>'address', '')
  );

  return new;
end;
$$;
grant execute on function public.handle_new_user() to anon, authenticated, service_role;

-- Attach it to auth.users, removing any earlier trigger bound to the same
-- function first. Two triggers calling this would insert the profile twice
-- and break every signup with a primary-key violation, so this loop matters
-- more than it looks — the trigger may already exist under another name.
do $$
declare t record;
begin
  for t in
    select tgname from pg_trigger
    where tgrelid = 'auth.users'::regclass
      and not tgisinternal
      and tgfoid = 'public.handle_new_user()'::regprocedure
  loop
    execute format('drop trigger %I on auth.users', t.tgname);
  end loop;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- Assigns a tanod at the moment an incident is created.
--
-- A report that lands in a queue nobody owns is a report nobody answers, so
-- dispatch happens before the row is ever visible. On-duty tanods are picked
-- lightest-load first, then longest-idle, so the work spreads instead of
-- landing repeatedly on whoever sorts first.
--
-- The off-duty fallback is for CRITICAL ONLY, and is marked 'auto_offduty'
-- rather than 'auto' precisely so the dashboard can tell the official to
-- phone the person: a silent assignment to someone asleep would be worse
-- than no assignment at all.
create or replace function public.auto_assign_tanod()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  chosen uuid;
begin
  if new.assigned_to is not null or new.status <> 'pending' then
    return new;
  end if;

  select t.id into chosen
  from profiles t
  left join lateral (
    select count(*) as active from incidents i
    where i.assigned_to = t.id and i.status = 'assigned'
  ) load on true
  left join lateral (
    select max(i2.created_at) as last_assigned from incidents i2
    where i2.assigned_to = t.id
  ) recent on true
  where t.barangay_id = new.barangay_id
    and t.role = 'tanod'
    and t.on_duty = true
    and t.deactivated_at is null
  order by load.active asc, recent.last_assigned asc nulls first, t.id
  limit 1;

  if chosen is not null then
    new.assigned_to := chosen;
    new.status := 'assigned';
    new.assignment_method := 'auto';
    new.auto_assigned_at := now();
    return new;
  end if;

  if new.priority = 'Critical' then
    select t.id into chosen
    from profiles t
    where t.barangay_id = new.barangay_id
      and t.role = 'tanod'
      and t.deactivated_at is null
    order by t.last_seen_at desc nulls last, t.id
    limit 1;

    if chosen is not null then
      new.assigned_to := chosen;
      new.status := 'assigned';
      new.assignment_method := 'auto_offduty';
      new.auto_assigned_at := now();
      return new;
    end if;
  end if;

  -- Nobody available at all — stays pending and visible.
  return new;
end;
$$;
revoke all on function public.auto_assign_tanod() from public;
grant execute on function public.auto_assign_tanod() to anon, authenticated, service_role;

create or replace trigger trg_auto_assign_tanod
  before insert on incidents
  for each row execute function public.auto_assign_tanod();


-- Records that a human, not the trigger, made this assignment.
create or replace function public.mark_manual_assignment()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.assigned_to is distinct from old.assigned_to and new.assigned_to is not null then
    new.assignment_method := case
      when old.assigned_to is null then 'manual'
      else 'reassigned'
    end;
  end if;
  return new;
end;
$$;
revoke all on function public.mark_manual_assignment() from public;
grant execute on function public.mark_manual_assignment() to anon, authenticated, service_role;

create or replace trigger trg_mark_manual_assignment
  before update on incidents
  for each row execute function public.mark_manual_assignment();


-- Duty history. Writing the log here rather than from the client is what
-- makes it evidence: a tanod cannot claim a shift they did not toggle.
create or replace function public.log_duty_change()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.on_duty is distinct from old.on_duty then
    new.duty_changed_at := now();
    insert into public.duty_logs (tanod_id, barangay_id, went_on_duty)
    values (new.id, new.barangay_id, new.on_duty);
  end if;
  return new;
end;
$$;
grant execute on function public.log_duty_change() to anon, authenticated, service_role;

create or replace trigger on_duty_change
  before update on profiles
  for each row execute function public.log_duty_change();


-- Keeps the location breadcrumb table to a 24-hour window without needing a
-- scheduled job — every insert trims that tanod's older rows.
create or replace function public.prune_tanod_locations()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  delete from public.tanod_locations
  where tanod_id = new.tanod_id
    and recorded_at < now() - interval '24 hours';
  return new;
end;
$$;
grant execute on function public.prune_tanod_locations() to anon, authenticated, service_role;

create or replace trigger prune_old_locations
  after insert on tanod_locations
  for each row execute function public.prune_tanod_locations();


-- ============================================================================
-- SECTION 8 — REALTIME
-- ============================================================================
alter table incidents       replica identity full;
alter table tickets         replica identity full;
alter table ticket_messages replica identity full;
alter table announcements   replica identity full;
-- profiles is in the publication because both dashboards depend on it: the
-- official's user directory and dispatch list stay live, and a resident sees
-- their verification decision the moment an official makes it. Realtime
-- still applies the SELECT policies above, so a subscriber only receives
-- rows it could already read.
alter table profiles        replica identity full;
alter table tanod_locations replica identity full;

do $$ begin alter publication supabase_realtime add table incidents;       exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table tickets;         exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table ticket_messages; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table announcements;   exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table profiles;        exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table tanod_locations; exception when duplicate_object then null; end $$;


-- ============================================================================
-- SECTION 9 — STORAGE BUCKETS
--
-- incident-images is PRIVATE and carries a SELECT policy, because the
-- photographs in it are evidence about identifiable people.
--
-- avatars stays public and therefore has no SELECT policy: a public bucket
-- is served by URL without RLS being consulted at all, so a policy there
-- would only enable directory-style enumeration of the whole bucket.
-- Profile photos are already shown to everyone in the barangay, and the
-- trade is different from the one above.
-- ============================================================================

-- PRIVATE. This bucket was public, which meant every photograph attached to
-- an incident was readable by anyone holding the URL, with no session at
-- all — including photographs filed under RA 9262, where the evidence is of
-- someone being hurt at home. That is sensitive personal information under
-- RA 10173, and a public bucket is not a defensible place to keep it.
-- Viewers now mint a short-lived signed URL (lib/storage.js), gated by the
-- SELECT policy below.
insert into storage.buckets (id, name, public)
values ('incident-images', 'incident-images', false)
on conflict (id) do update set public = false;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Who may read an incident photograph.
--
-- Uploads are keyed by uploader: '<user id>/<file>' for a report,
-- '<user id>/resolutions/<file>' for resolution proof. That first folder is
-- what ties an object back to a person, and through them to a barangay —
-- which is the same boundary the incidents table itself is scoped by, so a
-- photo is visible to exactly the people who can already read the report it
-- belongs to.
drop policy if exists "Incident images readable within the barangay" on storage.objects;
create policy "Incident images readable within the barangay"
on storage.objects for select
to authenticated
using (
  bucket_id = 'incident-images'
  and (
    (storage.foldername(name))[1] = auth.uid()::text     -- your own upload
    or public.am_super_admin()
    or exists (
      select 1 from public.profiles p
      where p.id::text = (storage.foldername(name))[1]
        and p.barangay_id = public.my_barangay_id()
    )
  )
);

drop policy if exists "Authenticated users can upload incident images" on storage.objects;
create policy "Authenticated users can upload incident images"
on storage.objects for insert
to authenticated
-- Scoped to the uploader's own folder. Without the path check any signed-in
-- account could write anywhere in the bucket, including over the top of a
-- filename it had guessed — and the read policy above trusts that first
-- folder to say who owns the object.
with check (
  bucket_id = 'incident-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete their own incident images" on storage.objects;
create policy "Users can delete their own incident images"
on storage.objects for delete
to authenticated
using (bucket_id = 'incident-images' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Authenticated users can upload avatars" on storage.objects;
create policy "Authenticated users can upload avatars"
on storage.objects for insert
to authenticated
with check (bucket_id = 'avatars');

drop policy if exists "Users can update own avatars" on storage.objects;
create policy "Users can update own avatars"
on storage.objects for update
to authenticated
using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can delete own avatars" on storage.objects;
create policy "Users can delete own avatars"
on storage.objects for delete
to authenticated
using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);


-- ============================================================================
-- SECTION 10 — MANUAL RESIDENT VERIFICATION
--
-- Registration proves someone owns an email address. It does not prove they
-- live in the barangay. Under RA 7160 Sec. 394 the barangay secretary keeps
-- the record of the barangay's inhabitants and reports the actual number of
-- residents — the barangay is the authority on who lives there, so a human
-- barangay official decides, not the signup form.
--
-- Verification gates DOCUMENT REQUESTS (Section 10), because a barangay
-- certification is an official attestation about a person's residency and
-- cannot honestly be issued to an unchecked account. It deliberately does
-- NOT gate incident reporting: refusing an emergency report because the
-- paperwork is pending would be indefensible.
-- ============================================================================

alter table profiles add column if not exists verification_status text;
alter table profiles add column if not exists verification_note text;
alter table profiles add column if not exists verified_by uuid references profiles(id);
alter table profiles add column if not exists verified_at timestamptz;

-- Grandfather accounts that pre-date manual verification. Only rows with no
-- status yet are touched, so re-running this file never resurrects an
-- account an official has since rejected.
update profiles
set verification_status = 'verified',
    verified_at = coalesce(verified_at, now())
where verification_status is null;

alter table profiles alter column verification_status set default 'pending';
alter table profiles alter column verification_status set not null;

do $$ begin
  alter table profiles add constraint profiles_verification_status_check
    check (verification_status in ('pending', 'verified', 'rejected'));
exception when duplicate_object then null; end $$;

create index if not exists idx_profiles_verification
  on profiles(barangay_id, verification_status);

comment on column profiles.verification_status is
  'Set only through public.set_verification_status() by a barangay official '
  'of the same barangay, or by a super admin. Never self-serve.';

-- Whether the CALLING account may have documents issued in its name.
--
-- This must mirror canRequestDocuments() in lib/verification.js exactly. It
-- previously checked verification_status alone, which was wrong: officials
-- and tanods are created by handle_new_user() with the default 'pending'
-- status (their vetting happened when the barangay issued their invite
-- code), so a checking-status-only version enabled the request form for
-- them in the UI and then rejected the insert at the policy. Same rule,
-- both sides.
create or replace function public.am_verified()
returns boolean language sql stable security definer set search_path = public
as $$
  select coalesce(
    is_super_admin
    or role in ('official', 'tanod')
    or verification_status = 'verified',
    false)
  from profiles where id = auth.uid()
$$;
revoke all on function public.am_verified() from public;
grant execute on function public.am_verified() to authenticated;
grant execute on function public.am_verified() to service_role;

-- The ONLY way verification columns change.
--
-- Deliberately an RPC rather than a broader UPDATE policy on `profiles`: a
-- policy permissive enough to let officials verify residents would also let
-- them rewrite those residents' names, addresses and phone numbers. This
-- function touches four columns and nothing else.
create or replace function public.set_verification_status(
  target_user uuid,
  new_status text,
  note text default null
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  caller_role text;
  caller_barangay uuid;
  caller_super boolean;
  target_barangay uuid;
begin
  if new_status not in ('pending', 'verified', 'rejected') then
    raise exception 'Invalid verification status: %', new_status;
  end if;

  select role, barangay_id, coalesce(is_super_admin, false)
    into caller_role, caller_barangay, caller_super
  from profiles where id = auth.uid();

  if caller_role is null and not caller_super then
    raise exception 'No profile for the calling account';
  end if;

  select barangay_id into target_barangay from profiles where id = target_user;
  if not found then
    raise exception 'No such account';
  end if;

  -- Nobody verifies themselves. An official who could self-verify would
  -- make the whole check ceremonial.
  if target_user = auth.uid() then
    raise exception 'You cannot change your own verification status';
  end if;

  if not (
    caller_super
    or (caller_role = 'official'
        and caller_barangay is not null
        and caller_barangay = target_barangay)
  ) then
    raise exception 'Only a barangay official of this barangay may verify this account';
  end if;

  -- A rejection without a reason is not reviewable, so require one.
  if new_status = 'rejected' and coalesce(btrim(note), '') = '' then
    raise exception 'A rejection must state a reason';
  end if;

  update profiles
  set verification_status = new_status,
      verification_note   = nullif(btrim(coalesce(note, '')), ''),
      verified_by         = auth.uid(),
      verified_at         = now()
  where id = target_user;
end;
$$;
revoke all on function public.set_verification_status(uuid, text, text) from public;
grant execute on function public.set_verification_status(uuid, text, text) to authenticated;


-- ============================================================================
-- SECTION 11 — DOCUMENT REQUESTS (RA 11032)
--
-- RA 11032 (Ease of Doing Business and Efficient Government Service Delivery
-- Act of 2018), which amended RA 9485, binds the barangay to a clock:
--
--   Sec. 6         — the office must publish a Citizen's Charter listing, for
--                    each service, its requirements and its processing time.
--   Sec. 9(b)(1)   — that time may not exceed 3 WORKING DAYS for a simple
--                    transaction, 7 for a complex one and 20 for a highly
--                    technical one, counted from receipt of the complete
--                    application. It may be extended ONCE, for the same
--                    number of days.
--   Sec. 10        — if the office neither approves nor denies within the
--                    prescribed time, the request is DEEMED APPROVED, provided
--                    the requirements were complete and the fees paid.
--   RA 7160 152(c) — separately, a barangay clearance for a business must be
--                    acted on within 7 working days, after which the city or
--                    municipality may issue the permit without it.
--
-- The deadline is computed in lib/documents.js (working days, skipping
-- weekends and Philippine holidays) and FROZEN onto the row at request time,
-- along with the classification and citation. Freezing matters: the deadline
-- a request was subject to must not shift because the holiday table or the
-- service classification was edited months later.
-- ============================================================================

create table if not exists document_requests (
  id uuid default gen_random_uuid() primary key,
  reference_code text not null unique
    default 'DOC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  document_type text not null,
  purpose text not null,
  notes text,
  requested_by uuid references profiles(id),
  barangay_id uuid references barangays(id),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'ready', 'released', 'denied')),

  -- RA 11032 classification, frozen at request time
  ra_classification text not null
    check (ra_classification in ('simple', 'complex', 'highly_technical')),
  processing_days integer not null check (processing_days > 0),
  legal_basis text not null,
  due_at timestamptz not null,

  -- Sec. 9(b)(1): the processing time may be extended once, for the same
  -- number of days. Once `extended` is true there is no second extension.
  extended boolean not null default false,
  extension_reason text,

  -- Sec. 10: recorded when the office let the deadline lapse.
  deemed_approved_at timestamptz,

  handled_by uuid references profiles(id),
  released_at timestamptz,
  denial_reason text,
  created_at timestamptz default now()
);
create index if not exists idx_document_requests_barangay on document_requests(barangay_id, status);
create index if not exists idx_document_requests_requester on document_requests(requested_by);
create index if not exists idx_document_requests_due on document_requests(due_at);

comment on table document_requests is
  'Barangay document requests under RA 11032. due_at is the working-day '
  'deadline computed by lib/documents.js and frozen at request time.';
comment on column document_requests.due_at is
  'End of the last working day allowed by RA 11032 Sec. 9(b)(1). Past this '
  'with no decision, Sec. 10 deems the request approved.';

alter table document_requests enable row level security;

drop policy if exists "document_requests: read own or staff" on document_requests;
create policy "document_requests: read own or staff"
  on document_requests for select
  using (
    requested_by = auth.uid()
    or (barangay_id = public.my_barangay_id() and public.my_role() = 'official')
    or public.am_super_admin()
  );

-- A resident may only file a clean pending request, in their own barangay,
-- for themselves — never one pre-marked released, or with a decision
-- already filled in. Verification is required here and only here: a
-- barangay certification attests to residency the barangay has checked.
drop policy if exists "document_requests: verified residents insert own" on document_requests;
create policy "document_requests: verified residents insert own"
  on document_requests for insert
  with check (
    requested_by = auth.uid()
    and barangay_id = public.my_barangay_id()
    and public.am_verified()
    and status = 'pending'
    and handled_by is null
    and released_at is null
    and denial_reason is null
    and deemed_approved_at is null
    and extended = false
  );

drop policy if exists "document_requests: officials update own barangay" on document_requests;
create policy "document_requests: officials update own barangay"
  on document_requests for update
  using (
    (barangay_id = public.my_barangay_id() and public.my_role() = 'official')
    or public.am_super_admin()
  )
  with check (
    (barangay_id = public.my_barangay_id() and public.my_role() = 'official')
    or public.am_super_admin()
  );

alter table document_requests replica identity full;

do $$ begin
  alter publication supabase_realtime add table document_requests;
exception when duplicate_object then null; end $$;


-- ============================================================================
-- SECTION 12 — SERVER-SIDE ENFORCEMENT OF THE RA 11032 DEADLINE
--
-- RA 11032 Sec. 10 deems a request approved when the office lets the
-- deadline pass. That happens by operation of law, whether or not anybody is
-- looking — so it must not depend on an official opening the queue. The UI
-- computes the same state on read (lib/documents.js deadlineState), but the
-- authoritative record is stamped here, on a schedule.
--
-- pg_cron is a Supabase extension. If it is not enabled on your project the
-- guarded block below skips the schedule rather than failing the whole
-- script — enable it in Dashboard → Database → Extensions and re-run.
-- ============================================================================

create or replace function public.stamp_overdue_document_requests()
returns integer
language sql security definer set search_path = public
as $$
  with stamped as (
    update document_requests
    set deemed_approved_at = due_at
    where deemed_approved_at is null
      and status not in ('released', 'denied')
      and due_at < now()
    returning id
  )
  select count(*)::integer from stamped
$$;
revoke all on function public.stamp_overdue_document_requests() from public;
grant execute on function public.stamp_overdue_document_requests() to service_role;

comment on function public.stamp_overdue_document_requests() is
  'Stamps deemed_approved_at on requests the barangay let run past their '
  'RA 11032 Sec. 9(b)(1) deadline. Idempotent — only ever touches rows whose '
  'deemed_approved_at is still null.';

do $$
begin
  create extension if not exists pg_cron;

  -- Hourly is enough: the deadline is close of business on a working day,
  -- so nothing turns on minute-level precision.
  perform cron.unschedule('stamp-overdue-document-requests')
  where exists (select 1 from cron.job where jobname = 'stamp-overdue-document-requests');

  perform cron.schedule(
    'stamp-overdue-document-requests',
    '7 * * * *',
    $cron$ select public.stamp_overdue_document_requests() $cron$
  );
exception when others then
  raise notice 'pg_cron not available (%), skipping the schedule. Enable it in Dashboard -> Database -> Extensions and re-run this file. The deadline is still computed on read in lib/documents.js.', sqlerrm;
end $$;


-- ============================================================================
-- SECTION 13 — AI RATE LIMITING
--
-- /api/ai-chat and /api/ai-analytics spend real money per call. They verify
-- the caller, which stops strangers, but does nothing about a signed-in
-- account looping requests — the budget is gone either way.
--
-- The counter lives in the database rather than in the route because Vercel
-- runs each request in whatever serverless instance is free; an in-memory
-- limiter there would reset constantly and count only a fraction of calls.
-- ============================================================================

create table if not exists ai_usage_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  route text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_ai_usage_user_time on ai_usage_log(user_id, route, created_at desc);

alter table ai_usage_log enable row level security;

-- No client policy at all: the table is written and read only by the API
-- routes, through the service role, which bypasses RLS. A client that could
-- read it would learn other people's usage; one that could write it could
-- pad the log and lock somebody else out.
drop policy if exists "ai_usage_log: no client access" on ai_usage_log;

-- Records the call and reports whether it was within the allowance, in ONE
-- statement — checking and then inserting separately would let two
-- simultaneous requests both see "under the limit" and both proceed.
create or replace function public.record_ai_call(
  p_user_id uuid,
  p_route text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, used integer, resets_at timestamptz)
language plpgsql security definer set search_path = public
as $$
declare
  v_used integer;
  v_oldest timestamptz;
  -- Taken as seconds rather than an interval: PostgREST passes RPC
  -- arguments as JSON, and an integer needs no cast to be unambiguous.
  v_window interval := make_interval(secs => p_window_seconds);
begin
  select count(*), min(created_at)
    into v_used, v_oldest
  from ai_usage_log
  where user_id = p_user_id
    and route = p_route
    and created_at > now() - v_window;

  if v_used >= p_limit then
    -- Refused calls are NOT logged: logging them would keep pushing the
    -- window forward and turn a brief burst into a permanent lockout.
    return query select false, v_used, v_oldest + v_window;
    return;
  end if;

  insert into ai_usage_log (user_id, route) values (p_user_id, p_route);

  -- Opportunistic cleanup so the table does not grow without bound.
  delete from ai_usage_log
  where created_at < now() - interval '7 days';

  return query select true, v_used + 1, coalesce(v_oldest, now()) + v_window;
end;
$$;
revoke all on function public.record_ai_call(uuid, text, integer, integer) from public;
grant execute on function public.record_ai_call(uuid, text, integer, integer) to service_role;


-- ============================================================================
-- SECTION 14 — KATARUNGANG PAMBARANGAY (the barangay blotter)
--
-- RA 7160 Secs. 399–422. This is the barangay's judicial function, and
-- Sec. 412 makes it a PRECONDITION to court: without a Certificate to File
-- Action the complaint is dismissible for prematurity. It runs on a clock —
-- next working day to summon (Sec. 410(b)), 15 days to mediate, 15 more for
-- the Pangkat extendible once (Sec. 410(e)), 10 days to repudiate a
-- settlement (Sec. 418) before it becomes final (Sec. 416).
--
-- The Sec. 408 eligibility assessment and the citation are FROZEN onto the
-- row at filing, for the same reason the incident and document tables freeze
-- theirs: a case must be judged against the rules that applied when it was
-- taken, not against a table someone edited afterwards.
--
-- One dispute the barangay must not touch: under RA 9262 Sec. 33 a Punong
-- Barangay or Kagawad who mediates a VAWC case, or presses the victim to
-- compromise, is administratively liable. lib/katarungan.js treats that as a
-- prohibition rather than an ineligibility, and the check constraint below
-- makes it structural — a case flagged prohibited can never be moved into
-- mediation or pangkat, whatever the UI does.
-- ============================================================================

create table if not exists blotter_cases (
  id uuid default gen_random_uuid() primary key,
  case_number text not null,
  barangay_id uuid not null references barangays(id),

  -- Optional: this case came out of a reported incident.
  incident_id uuid references incidents(id),

  complainant_id uuid references profiles(id),   -- null when not a registered account
  complainant_name text not null,
  complainant_address text,
  complainant_phone text,
  respondent_name text not null,
  respondent_address text,

  nature text not null,
  description text not null,

  -- Sec. 408 assessment, frozen at filing
  lupon_eligible boolean not null,
  prohibited boolean not null default false,
  exclusion_reasons text[] not null default '{}',
  legal_basis text not null,

  status text not null default 'filed'
    check (status in ('filed', 'mediation', 'pangkat', 'settled',
                      'repudiated', 'cfa_issued', 'referred', 'withdrawn')),

  filed_at timestamptz not null default now(),
  summon_due_at timestamptz,           -- Sec. 410(b), next working day
  first_meeting_at timestamptz,
  mediation_due_at timestamptz,        -- first meeting + 15 days
  pangkat_convened_at timestamptz,
  pangkat_due_at timestamptz,          -- convened + 15 (+15 if extended)
  pangkat_extended boolean not null default false,

  settled_at timestamptz,
  settlement_terms text,
  repudiated_at timestamptz,
  repudiation_reason text,
  cfa_issued_at timestamptz,
  cfa_reason text,
  referred_to text,
  withdrawn_reason text,

  recorded_by uuid references profiles(id),
  created_at timestamptz default now(),

  -- A case number is unique within its barangay, not globally: two barangays
  -- both having a KP-2026-0001 is correct.
  constraint blotter_cases_number_unique unique (barangay_id, case_number),

  -- RA 9262 Sec. 33, enforced by the database rather than by the form.
  constraint blotter_prohibited_never_conciliated
    check (not (prohibited and status in ('mediation', 'pangkat', 'settled'))),

  -- A dispute outside the Lupon's authority cannot be conciliated either.
  constraint blotter_ineligible_never_conciliated
    check (lupon_eligible or status not in ('mediation', 'pangkat', 'settled')),

  -- Sec. 410(e) allows exactly one extension; there is no second.
  constraint blotter_extension_needs_pangkat
    check (not pangkat_extended or pangkat_convened_at is not null),

  -- Sec. 412: a CFA records why conciliation failed.
  constraint blotter_cfa_states_reason
    check (cfa_issued_at is null or coalesce(btrim(cfa_reason), '') <> ''),

  -- Sec. 418: a repudiation is on stated grounds, not a bare assertion.
  constraint blotter_repudiation_states_ground
    check (repudiated_at is null or coalesce(btrim(repudiation_reason), '') <> '')
);

create index if not exists idx_blotter_barangay_status on blotter_cases(barangay_id, status);
create index if not exists idx_blotter_complainant on blotter_cases(complainant_id);
create index if not exists idx_blotter_incident on blotter_cases(incident_id);

comment on table blotter_cases is
  'Katarungang Pambarangay cases (RA 7160 Secs. 399-422). Deadlines are '
  'computed by lib/katarungan.js and frozen on the row.';
comment on column blotter_cases.prohibited is
  'True for disputes the barangay is FORBIDDEN to mediate — VAWC under RA 9262 '
  'Sec. 33. Distinct from lupon_eligible: an ineligible case is referred, a '
  'prohibited one must never be scheduled for conciliation at all.';

-- Sequential per barangay, per year — how a blotter is actually numbered.
-- The advisory lock is transaction-scoped, so two clerks filing at the same
-- moment serialise here instead of racing to the same number and having one
-- of them fail on the unique constraint.
create or replace function public.next_blotter_number(p_barangay uuid)
returns text language plpgsql security definer set search_path = public
as $$
declare
  v_year integer := extract(year from (now() at time zone 'Asia/Manila'));
  v_seq integer;
begin
  perform pg_advisory_xact_lock(hashtext(p_barangay::text || ':' || v_year::text));
  select count(*) + 1 into v_seq
  from blotter_cases
  where barangay_id = p_barangay
    and extract(year from (filed_at at time zone 'Asia/Manila')) = v_year;
  return 'KP-' || v_year || '-' || lpad(v_seq::text, 4, '0');
end;
$$;
revoke all on function public.next_blotter_number(uuid) from public;

-- Assigned by the database, never supplied by the client.
create or replace function public.set_blotter_number()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.case_number is null or btrim(new.case_number) = '' then
    new.case_number := public.next_blotter_number(new.barangay_id);
  end if;
  return new;
end;
$$;
revoke all on function public.set_blotter_number() from public;
grant execute on function public.set_blotter_number() to anon, authenticated, service_role;

create or replace trigger trg_set_blotter_number
  before insert on blotter_cases
  for each row execute function public.set_blotter_number();

alter table blotter_cases enable row level security;

-- A complainant may follow their own case; officials run the Lupon for their
-- barangay. Respondents are recorded by name, not by account, so there is no
-- respondent-side read — matching how a paper blotter works.
drop policy if exists "blotter: read own or officials of the barangay" on blotter_cases;
create policy "blotter: read own or officials of the barangay"
  on blotter_cases for select
  using (
    complainant_id = auth.uid()
    or (barangay_id = public.my_barangay_id() and public.my_role() = 'official')
    or public.am_super_admin()
  );

-- Filing is an official act: the complaint is taken at the barangay hall and
-- recorded by the secretary. Residents raise incidents and tickets, not
-- blotter entries.
drop policy if exists "blotter: officials record for their barangay" on blotter_cases;
create policy "blotter: officials record for their barangay"
  on blotter_cases for insert
  with check (
    barangay_id = public.my_barangay_id()
    and public.my_role() = 'official'
    and recorded_by = auth.uid()
    and status in ('filed', 'referred')
  );

drop policy if exists "blotter: officials update own barangay" on blotter_cases;
create policy "blotter: officials update own barangay"
  on blotter_cases for update
  using (
    (barangay_id = public.my_barangay_id() and public.my_role() = 'official')
    or public.am_super_admin()
  )
  with check (
    (barangay_id = public.my_barangay_id() and public.my_role() = 'official')
    or public.am_super_admin()
  );

alter table blotter_cases replica identity full;
do $$ begin
  alter publication supabase_realtime add table blotter_cases;
exception when duplicate_object then null; end $$;


-- ============================================================================
-- MANUAL STEPS AFTER RUNNING THIS SCRIPT
-- ============================================================================
-- 1. PSGC DATA — populate the barangays table:
--      node scripts/import-psgc.mjs
--    (reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from
--    .env.local; fetches ~42,000 barangays from psgc.gitlab.io)
--
-- 2. FIRST SUPER ADMIN — register a normal account through the app, then
--    in the SQL editor (must be here: the trigger above blocks this from
--    any client request):
--
--      update profiles
--      set is_super_admin = true, barangay_id = null
--      where id = (select id from auth.users where email = 'you@example.com');
--
--    Detaching barangay_id keeps the platform-wide admin account out of
--    every barangay's user list, tanod count, and "same barangay" policy
--    matches — it isn't a resident of anywhere.
--
-- 3. ENV VARS — point the app at this project, in BOTH .env.local and
--    Vercel → Project → Settings → Environment Variables:
--      NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
--      SUPABASE_SERVICE_ROLE_KEY
--    Redeploy after changing Vercel's values — they don't apply retroactively.
--
-- 4. AUTH SETTINGS — Authentication → Sign In / Providers → Email:
--      - Decide on "Confirm email" (off is recommended for demo/defense
--        environments — Supabase's built-in email sender is rate-limited).
--      - Enable "Leaked password protection" if your plan supports it
--        (checks new passwords against HaveIBeenPwned). This is the one
--        Security Advisor finding that has no SQL fix.
--    Set Site URL / redirect URLs to your Vercel domain.
--
-- 5. RESIDENT VERIFICATION — accounts that existed before Section 9 was
--    added are grandfathered in as 'verified' so nobody is locked out by an
--    upgrade. New registrations start as 'pending' and a barangay official
--    verifies them from Official Dashboard → Verifications. Only document
--    requests are gated on this; incident reporting never is.
--
--    To verify an account from the SQL editor (e.g. bootstrapping a demo):
--
--      update profiles
--      set verification_status = 'verified', verified_at = now()
--      where id = '<profile id>';
--
-- 6. VERIFY — Database → Advisors → Security Lints should show only:
--      - validate_invite_code executable by anon/authenticated (by design)
--      - my_role/my_barangay_id/am_super_admin executable by authenticated
--        (required — RLS evaluates them as the querying user)
--      - am_verified/set_verification_status executable by authenticated
--        (by design — set_verification_status does its own authorization)
--    Any other warning means something in this file didn't apply cleanly.
-- ============================================================================