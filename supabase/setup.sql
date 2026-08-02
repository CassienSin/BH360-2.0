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
-- NOTE: reconstructed from usage across the codebase, not from an original
-- CREATE TABLE dump. Verify column names against actual form submissions
-- if support-message errors ever surface.
create table if not exists support_messages (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id),
  subject text,
  message text not null,
  status text not null default 'open',
  created_at timestamptz default now()
);


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
grant execute on function public.my_barangay_id() to authenticated;

create or replace function public.my_role()
returns text language sql stable security definer set search_path = public
as $$ select role from profiles where id = auth.uid() $$;
revoke all on function public.my_role() from public;
grant execute on function public.my_role() to authenticated;

create or replace function public.am_super_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce(is_super_admin, false) from profiles where id = auth.uid() $$;
revoke all on function public.am_super_admin() from public;
grant execute on function public.am_super_admin() to authenticated;

-- Location dropdown helpers (register / request-access cascading selects).
-- anon needs these — registration happens before the user is authenticated.
create or replace function get_distinct_provinces()
returns table (province text)
language sql stable set search_path = public
as $$ select distinct province from barangays order by province; $$;
revoke all on function get_distinct_provinces() from public;
grant execute on function get_distinct_provinces() to anon, authenticated;

create or replace function get_distinct_cities(p_province text)
returns table (city text)
language sql stable set search_path = public
as $$ select distinct city from barangays where province = p_province order by city; $$;
revoke all on function get_distinct_cities(text) from public;
grant execute on function get_distinct_cities(text) to anon, authenticated;


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
grant execute on function validate_invite_code(text, text) to anon, authenticated;

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
grant execute on function claim_invite_code(text, text, uuid) to authenticated;


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

drop trigger if exists protect_profile_privileges on profiles;
create trigger protect_profile_privileges
  before update on profiles
  for each row
  execute function prevent_privilege_escalation();


-- ============================================================================
-- SECTION 7 — REALTIME
-- ============================================================================
alter table incidents       replica identity full;
alter table tickets         replica identity full;
alter table ticket_messages replica identity full;
alter table announcements   replica identity full;

alter publication supabase_realtime add table incidents;
alter publication supabase_realtime add table tickets;
alter publication supabase_realtime add table ticket_messages;
alter publication supabase_realtime add table announcements;


-- ============================================================================
-- SECTION 8 — STORAGE BUCKETS
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
-- 5. VERIFY — Database → Advisors → Security Lints should show only:
--      - validate_invite_code executable by anon/authenticated (by design)
--      - claim_invite_code executable by authenticated (by design)
--      - my_role/my_barangay_id/am_super_admin executable by authenticated
--        (required — RLS evaluates them as the querying user)
--    Any other warning means something in this file didn't apply cleanly.
-- ============================================================================