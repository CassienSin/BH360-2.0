-- ============================================================================
-- CLEANUP AFTER THE NOTIFICATIONS MERGE
-- ============================================================================
-- Run this ONCE, after the notifications branch is merged AND Vercel shows
-- the production deployment of it as live. Until then the live site's older
-- code still reads notification_reads, and setup.sql Section 18 deliberately
-- left everything below in place (production and preview share one
-- database, so Section 18 had to be additive only).
--
-- By the time this runs, push already flows through the new path: the
-- merge checklist pointed notifications_push_endpoint_url at production
-- before the deploy, and the new /api/push/send ignores the old triggers'
-- payloads. So these are no-ops being removed, and nobody loses or gains a
-- push by running it.
--
-- What it removes:
--   1. The three per-table push triggers and private.dispatch_push(),
--      which only they used.
--   2. push_endpoint_url, the setting only those triggers read.
--   3. notification_reads. Read state lives on notifications.read_at now.
--   4. push_bypass_secret, if it is still there from preview testing.
-- ============================================================================

begin;

drop trigger if exists dispatch_incident_push_trigger on incidents;
drop trigger if exists dispatch_ticket_message_push_trigger on ticket_messages;
drop trigger if exists dispatch_incident_assignment_push_trigger on incidents;
drop function if exists private.dispatch_push();

delete from private.app_config where key in ('push_endpoint_url', 'push_bypass_secret');

do $$ begin alter publication supabase_realtime drop table notification_reads; exception when others then null; end $$;
drop table if exists notification_reads;

commit;
