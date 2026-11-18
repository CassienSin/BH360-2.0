# Notifications merge checklist

Production (bh-360.vercel.app) and the preview deployments share one Supabase
project. Until this branch is live, production pushes through the older
per-table triggers (setup.sql Section 16), and the new trigger on
`notifications` (Section 18) posts to whatever
`notifications_push_endpoint_url` names. The steps below move push from the
old path to the new one at the moment the production deploy goes live, so
every event is pushed once: before the swap the old route pushes the old
triggers' posts and answers the new trigger with a 400; after it, the new
route pushes the notification rows and ignores the old triggers' posts.

(Within the same second as the swap, one event's two posts can land on
different deployments. For replies, new incidents and dispatches the two
pushes share a tag, so a device shows one.)

Do the steps in order. SQL goes in Supabase → SQL Editor.

## 0. What the merge ships

`notifications-fix` was built on the local `responsive-layout` branch, so
merging it also ships that branch's two commits, which are not on `main`:
`ca7ab8e` (dashboard sections in the URL, refresh glitch) and `6fa32c6`
(responsive layout, 75 files). The preview tested all of it together. To
ship those separately, merge `responsive-layout` into `main` first.

## 1. Before merging

- [ ] Lint, tests and build pass on the branch; the preview phone tests
      passed.
- [ ] QA test data deleted (barangay, accounts, records, notifications,
      devices, invite codes, `private.notified_*` rows).
- [ ] The duty tables are published for realtime. Already run during
      testing; safe to run again:
      ```sql
      do $$ begin alter publication supabase_realtime add table duty_logs; exception when duplicate_object then null; end $$;
      do $$ begin alter publication supabase_realtime add table public.tanod_duty_schedules; exception when duplicate_object then null; end $$;
      ```
- [ ] Vercel → the project → **Settings → Environment Variables**, filtered to
      **Production**: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
      `PUSH_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` exist and are
      unchanged (new VAPID keys would break every existing subscription).
      `PUSH_ONLY_BARANGAY_IDS` is **not** set for Production.

## 2. Merge (GitHub)

1. GitHub → the repository → **Pull requests → New pull request**. Base
   `main`, compare `notifications-fix` → **Create pull request**.
2. Wait for the Vercel check on the pull request to pass.
3. **SQL A**, right before merging: point the new trigger at production.
   ```sql
   insert into private.app_config (key, value) values
     ('notifications_push_endpoint_url', 'https://bh-360.vercel.app/api/push/send')
   on conflict (key) do update set value = excluded.value, updated_at = now();
   ```
   Until the deploy, production's current route answers these posts with a
   400 ("No push is defined for table notifications") and sends nothing.
4. **Merge pull request → Create a merge commit → Confirm merge.** Keep the
   branch for now.

## 3. Deploy (Vercel)

5. Vercel → **Deployments**: a Production deployment of the merge commit
   starts. Wait for **Ready**, and write down the time it became Ready
   (hover over the age for the exact time), in Philippine time with
   `+08`, e.g. `2026-11-20 08:15+08`. From that moment
   bh-360.vercel.app runs the new route.

## 4. Right after Ready

6. **SQL B**: mark the backlog read. Every event since Section 18 was
   installed has a notification row, including ones people already saw in
   the old UI; without this, every bell opens with a pile of old unread
   items. Nothing is deleted or pushed (the push trigger runs on INSERT
   only). Use the Ready time, not `now()`, so rows created after the deploy
   stay unread:
   ```sql
   -- how many will change
   select count(*) from public.notifications
    where read_at is null and created_at < '<Ready time>'::timestamptz;

   update public.notifications
      set read_at = now()
    where read_at is null
      and created_at < '<Ready time>'::timestamptz;
   ```
7. **SQL C**: push goes through the new route.
   ```sql
   select id, created, status_code, left(content::text, 120) as content
     from net._http_response
    where created > '<Ready time>'::timestamptz
    order by created desc limit 20;
   ```
   Expected: `{"sent":…}` for notification rows and
   `{"sent":0,"ignored":true,…}` for the old triggers' posts. No 400s after
   the first minute.
8. **Smoke test on a real Android phone, against bh-360.vercel.app** (not
   the preview). Use your own resident and official test accounts in Don
   Andres Soriano so no one else is notified. A reply or status change on
   the resident's **own** ticket notifies only that resident; a new ticket
   or a resident's reply would notify every official there.
   1. Phone, Chrome, bh-360.vercel.app: sign in as the resident →
      **Settings** → turn notifications on → **Send test notification**. It
      arrives within seconds with the barangay-hall badge, is **not**
      marked "possible spam", and makes a sound. If it is silent, check the
      phone's Chrome notification settings for the site.
   2. Phone on the home screen. On a computer, sign in as the official and
      reply on one of the resident's existing tickets. Within seconds the
      phone shows **"New reply on your ticket"** / *Kgd. …: (message)*,
      **once**.
   3. Tap it: Chrome comes forward on that ticket; the bell has no unread
      item for it.
   4. With that ticket open on screen, reply again from the computer: the
      message appears in the conversation and **nothing** shows in the
      shade.
   5. SQL C again: for the reply, one `{"sent":1,…}` row and one
      `"ignored":true` row.

   On the preview, Chrome's spam filter flagged one push; it has to be
   judged on the real domain.

## 5. After the checks pass (the same day)

9. Run **`supabase/cleanup-after-notifications.sql`**: it drops the three
   old push triggers, `private.dispatch_push()`, the `push_endpoint_url` and
   `push_bypass_secret` settings, and `notification_reads`. Until this runs,
   a rollback is still clean (below).
10. **SQL D**: check what is left.
    ```sql
    select key from private.app_config order by key;
    -- expected: notifications_push_endpoint_url, push_webhook_secret (and other
    -- non-push settings); no push_endpoint_url, no push_bypass_secret
    select tgname from pg_trigger where tgname like 'dispatch_%push%';
    -- expected: no rows
    ```
11. Vercel → **Settings → Environment Variables**: delete
    `PUSH_ONLY_BARANGAY_IDS` (Preview). Without it a preview pushes to
    nobody, which is the safe default.
12. Vercel → **Settings → Deployment Protection → Protection Bypass for
    Automation**: revoke the secret (optional; nothing sends it after step
    9).
13. Optional: delete the `notifications-fix` branch on GitHub, and the
    local `responsive-layout` branch.

## Rollback

Roll back if the smoke test fails (no push, a push twice, 4xx/5xx in SQL C)
or the app misbehaves.

- **Before step 9:** Vercel → **Deployments** → the previous production
  deployment (`0cef118`, "Tanod Interface fixes") → **⋯ → Instant
  Rollback**. No SQL needed: the old route pushes the old triggers' posts
  again and answers the new trigger with a 400, so there is still exactly
  one push per event; the old UI ignores the notifications table. Then, on
  the merged pull request, **Revert** and merge the revert pull request, so
  the next push to `main` does not ship it again.
- **After step 9:** the old triggers and `notification_reads` are gone.
  First recreate them, then roll back the deploy:
  1. SQL Editor: run `main`'s `supabase/setup.sql` as of `0cef118`
     (`git show 0cef118:supabase/setup.sql`). It is safe to re-run and
     recreates the old triggers, `private.dispatch_push()` and an **empty**
     `notification_reads` (the old read markers are lost: old bells show
     their items as unread).
  2. ```sql
     insert into private.app_config (key, value) values
       ('push_endpoint_url', 'https://bh-360.vercel.app/api/push/send')
     on conflict (key) do update set value = excluded.value, updated_at = now();
     ```
  3. Instant Rollback and Revert, as above.

  In that order there is no gap: while the new code is still live it
  ignores the recreated triggers' posts and pushes the rows; after the
  rollback the old route pushes the old posts and refuses the new ones.
