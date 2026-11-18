# Notifications merge checklist

Production (bh-360.vercel.app) and the preview deployments share one Supabase
project. Until this branch is live, production pushes through the older
per-table triggers (setup.sql Section 16), and the new trigger on
`notifications` (Section 18) reaches only the preview, which may push only to
the QA test barangay. The steps below switch push from the old path to the
new one at the moment the production deploy goes live, so there is no window
in which an event is pushed twice or not at all.

## Before merging

- [ ] Push tests on the preview passed (step 5), and lint, tests and build
      pass on the branch.
- [ ] The duty tables are published for realtime (in setup.sql; run once):
      ```sql
      do $$ begin alter publication supabase_realtime add table duty_logs; exception when duplicate_object then null; end $$;
      do $$ begin alter publication supabase_realtime add table public.tanod_duty_schedules; exception when duplicate_object then null; end $$;
      ```
- [ ] Vercel, Production environment: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
      `VAPID_PRIVATE_KEY`, `PUSH_WEBHOOK_SECRET` unchanged (new keys would
      break every existing subscription). `PUSH_ONLY_BARANGAY_IDS` is **not**
      set on Production (Preview only).
- [ ] QA test data deleted (accounts, barangay, records; listed in the test
      report).
- [ ] Point the new trigger at production:
      ```sql
      insert into private.app_config (key, value) values
        ('notifications_push_endpoint_url', 'https://bh-360.vercel.app/api/push/send')
      on conflict (key) do update set value = excluded.value, updated_at = now();
      ```
      Until the deploy, production still runs the old route, which answers
      these posts with a 400 ("No push is defined for table notifications")
      and sends nothing; the old triggers keep pushing as before. One push per
      event either way.

## Merge and deploy

- [ ] Merge `notifications-fix` into `main`. Vercel builds production.
- [ ] Note the time the production deployment became **Ready** (Vercel →
      Deployments → the production deployment). From that instant the new
      `/api/push/send` ignores the old triggers' posts and pushes the
      notification rows.

## Right after the deploy

- [ ] Mark the backlog read. Every event since Section 18 ran has a
      notification row, including events people already saw in the old UI;
      without this, everyone's bell opens with a pile of old unread items.
      Nothing is deleted. Use the Ready time, not `now()`, so rows created
      after the deploy stay unread:
      ```sql
      -- how many will change
      select count(*) from public.notifications
       where read_at is null and created_at < '<Ready time, e.g. 2026-11-20 08:15+08>'::timestamptz;

      update public.notifications
         set read_at = now()
       where read_at is null
         and created_at < '<Ready time, e.g. 2026-11-20 08:15+08>'::timestamptz;
      ```
      (Open bells update live; nothing is pushed: the push trigger runs on
      INSERT only.)
- [ ] Check push went through the new path:
      ```sql
      select status_code, left(content::text, 120) as content, created
        from net._http_response order by created desc limit 20;
      ```
      Expected after the Ready time: `{"sent":…}` for notification rows, and
      `{"sent":0,"ignored":true,…}` for the old triggers' posts. No 400s.
- [ ] One real event end to end (e.g. a ticket reply) shows in the bell and
      arrives once as a push on a subscribed device.
- [ ] Retest on a real Android phone against **bh-360.vercel.app** (not the
      preview): subscribe, then with Chrome in the background send a ticket
      reply and use Settings → "Send test notification". Check that each
      arrives within seconds, shows the barangay-hall badge, and is **not**
      marked "possible spam". On the preview, Chrome's on-device spam filter
      flagged a push; the preview's long, unfamiliar domain (and a site with
      no history on the phone) likely contributed, so it has to be judged on
      the real domain.

## Then

- [ ] Run `supabase/cleanup-after-notifications.sql`: drops the old push
      triggers, `private.dispatch_push()`, `push_endpoint_url`,
      `push_bypass_secret` and `notification_reads`. Run it only after the
      checks above; until then a rollback is still clean.
- [ ] Optional: remove `PUSH_ONLY_BARANGAY_IDS` and the Protection Bypass
      secret from Vercel (the database stops sending the bypass header once
      the cleanup has run).

## Rollback

- **Before the cleanup has run:** Vercel → Instant Rollback to the previous
  production deployment. The old route pushes the old triggers' posts again
  and answers the new trigger with a 400, so there is still exactly one push
  per event. The bell's notifications table stays; the old UI ignores it.
- **After the cleanup:** the old triggers and `notification_reads` are gone,
  so the previous code would push nothing and lose its read markers. Re-run
  the previous commit's `supabase/setup.sql` (it is safe to re-run and
  recreates both), then point `push_endpoint_url` back at production; or
  roll forward with a fix.
