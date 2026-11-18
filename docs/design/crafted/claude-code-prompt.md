# Redesign BH360 in the "Crafted" style

## Read first
1. `AGENTS.md`. For Next.js APIs, check `node_modules/next/dist/docs/`.
2. `docs/design/crafted/DESIGN.md`: the design system (tokens, band, shells, components, rules and the screen-to-route map).
3. `docs/design/crafted/screens/*.png`: the reference screen for every page. Open each one before you restyle its page.
4. `docs/design/crafted/source/kit.py`: exact values, if DESIGN.md leaves anything unclear. The other `.py` files there show how each screen is put together.
5. `docs/design/crafted/BhIcons.jsx`: the custom icon set.

## Branch and safety
- Start from the merged `main` (d8b9c63 or later): `git switch main && git pull && git switch -c redesign/crafted`.
- Commit after each batch. You may push `redesign/crafted` so Vercel builds a preview. Never push to or merge into `main` without asking me.
- The notifications release is still being finished (the smoke test, then `cleanup-after-notifications.sql`). Don't touch:
  - push and notification logic, `public/sw.js`, `/api/push/*`
  - anything in `supabase/`
  - Supabase or Vercel settings
- Don't add `docs/design/crafted/screens/` to git. Add it to `.gitignore`; it's reference only.

## What this task is (and isn't)
- **It is:** presentation only. Change how screens look and how they're laid out to match the references.
- **Keep all of this exactly as it works now:**
  - data loading, realtime channels, roles and permissions
  - routing, including dashboard sections in the URL, refresh behaviour and the back button
  - the responsive breakpoints (`desk`, `phone`, `short` variants, `lib/layout.js`)
  - offline saving, toasts and confirm dialogs
- **It isn't** a new-features task. Some references show things the app doesn't do yet. Don't build their backend:
  - hotspots by purok, patrol gaps and the boundary editor
  - nearest tanod by road time
  - the tanod performance stats
  - admin document review for applications
  - address search on the map
  - Tarsi

  Restyle the closest existing UI, and keep a list called "Shown in design, not built" for the end report.
- **The map pages:** restyle only the chrome around the map (panels, chips, buttons, legend) and switch the pins to the BH icons. The map behaviour is a separate task.
- **Tarsi is a separate task** (`docs/design/tarsi/`). Keep the resident "AI Assistant" tab and page for now. Restyle them, but don't change the tab to "Me" yet.
- **Real data that the references don't show** (an extra card, more rows, empty states): keep it, styled with the same components. Never hard-code the sample names or numbers from the PNGs.

## Batches (stop after each: show me screenshots and wait for my OK)
0. **Plan.** Map every reference PNG to its file(s). List the shared components you'll create or change, and anything in the designs that conflicts with how the app works. Wait for my OK.
1. **Foundations:**
   - Tokens in `app/globals.css`, light and dark, mapped onto the existing `--brand…` variables and the shadcn variables so the current utilities keep working.
   - The `Band` component (gradient, banig weave, drifting dots, soft fade into the page, reduced-motion fallback).
   - The desktop shell (sidebar and band column), the phone shell (band and tab bar, with the red raised Report button for residents) and the auth shell.
   - Restyle `components/ui/{button,card,badge,input,textarea,tabs,avatar,dialog}` to match the kit, and add Tag, Status, Segmented, Chip, StatStrip, Row/Table, BottomSheet and Toggle.
   - Move `BhIcons.jsx` to `components/icons/BhIcons.jsx` and replace the Lucide product icons (nav, categories, roles). Keep Lucide for generic glyphs.
   - Restyle the skeletons to match.
   - Put a style-guide page at `app/dev/crafted/page.jsx` (`app/dev` already exists) showing every component, the band at phone and desktop widths, and both themes.
2. **Public and account:**
   - landing (P01)
   - sign in, register, request access and reset (P02–P07, cards on the full purple band)
   - offline, profile, settings and help (P08–P11)
3. **Resident:** R01–R11.
4. **Official:** O01–O14. For O13 Map, chrome only.
5. **Tanod:** T01–T06. For T05, chrome only.
6. **Admin:** A01–A05.
7. **Polish:**
   - dark mode pass
   - contrast check (WCAG AA) on band text and tags
   - focus rings and keyboard navigation
   - `prefers-reduced-motion`
   - check 360px, 390px, 768px, 1024px and 1440px widths
   - phone landscape (the `short` variant)

## How to check your work
- For each batch, take screenshots at 390×844 (phone) and 1440×900 (desktop) of the restyled pages, and put them next to the matching reference PNGs.
- Note any difference you made on purpose and why.
- `npm run lint`, `npm test` and `npm run build` must pass at the end of every batch.

## End report
- What changed, batch by batch, with the commits.
- Screenshots: before, after and the reference.
- The "Shown in design, not built" list. These become follow-up tasks: map, Tarsi, analytics extras and so on.
- Anything you couldn't match, and why.
