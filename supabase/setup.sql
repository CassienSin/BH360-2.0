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
-- validate_invite_code / claim_invite_code RPCs in Section 5, so an
-- anonymous or resident session can never enumerate valid codes.
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
-- SECTION 5 — INVITE-CODE RPCs
-- The table itself is never client-readable (Section 4). Validation and
-- claiming both go through these SECURITY DEFINER functions. Signatures
-- match app/register/page.jsx exactly: input_code, input_role, claimer.
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

create or replace function claim_invite_code(input_code text, input_role text, claimer uuid)
returns boolean
language sql security definer set search_path = public
as $$
  with claimed as (
    update invite_codes
    set used = true, used_by = claimer
    where code = upper(trim(input_code))
      and role = input_role
      and used = false
    returning id
  )
  select exists (select 1 from claimed)
$$;
revoke all on function claim_invite_code(text, text, uuid) from public;
-- authenticated only: claiming happens right after signUp, caller always has a session
grant execute on function claim_invite_code(text, text, uuid) to authenticated, service_role;


-- ============================================================================
-- SECTION 6 — PRIVILEGE-ESCALATION PROTECTION
-- Users can edit their own profile, but never their role, barangay, or
-- admin flag from a CLIENT request. Super admins can still change these
-- (e.g. approving an application), and server-side/SQL-editor operations
-- (auth.uid() IS NULL — no client session) are always allowed, which is
-- what lets you bootstrap the first super admin below.
-- ============================================================================

create or replace function prevent_privilege_escalation()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null
     and (new.role is distinct from old.role
          or new.barangay_id is distinct from old.barangay_id
          or new.is_super_admin is distinct from old.is_super_admin)
     and not exists (
       select 1 from profiles where id = auth.uid() and is_super_admin = true
     )
  then
    raise exception 'You cannot change role, barangay, or admin status';
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
-- No SELECT/listing policy on either bucket: public-bucket files are
-- served by URL (getPublicUrl()) without RLS being consulted at all. A
-- SELECT policy here would only enable directory-style enumeration of
-- every file in the bucket (e.g. every incident photo in every
-- barangay) — Supabase's linter flags this, and the app never needs it.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('incident-images', 'incident-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Authenticated users can upload incident images" on storage.objects;
create policy "Authenticated users can upload incident images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'incident-images');

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
--      - claim_invite_code executable by authenticated (by design)
--      - my_role/my_barangay_id/am_super_admin executable by authenticated
--        (required — RLS evaluates them as the querying user)
--      - am_verified/set_verification_status executable by authenticated
--        (by design — set_verification_status does its own authorization)
--    Any other warning means something in this file didn't apply cleanly.
-- ============================================================================