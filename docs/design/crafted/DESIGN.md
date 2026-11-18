# BH360 "Crafted" design system

This is the source of truth for the redesign. The reference screens are in `screens/`: one PNG per screen, named by role. `source/` holds the Python that generated them. `source/kit.py` has every exact value (colours, sizes, radii, shadows) if something here is unclear.

Screen name prefixes:

| Prefix | Screens |
|---|---|
| `R` | resident (phone) |
| `O` | official (desktop) |
| `T` | tanod (phone) |
| `A` | admin (desktop) |
| `P` | public and account pages |
| `MAP` | incident map |
| `M` | Tarsi, the assistant (built later, in its own task) |

## 1. The idea in one paragraph
The look has three layers:
- **A purple band** at the top of every screen, with a slowly moving woven pattern (banig) and drifting white dots. It fades softly into a light lavender-grey page.
- **Calm white cards** on that page: hairline borders, no glass, no glows, no gradients on buttons.
- **The BH360 custom icons** (outline normally, solid when active).

Colour means something: purple is the brand and the primary action, red is only for emergencies and overdue items, and green means done or on duty. Copy is plain and local, with Filipino greetings ("Magandang gabi, Aljho.").

## 2. Tokens

### Light (default)
| Token | Value | Use |
|---|---|---|
| `--ink` | `#1A1830` | headings, primary text |
| `--body` | `#4A4763` | body text |
| `--muted` | `#6B6884` | secondary text, labels |
| `--line` | `#E7E5F0` | borders, dividers |
| `--page` | `#F6F5FA` | page background |
| `--surface` | `#FFFFFF` | cards, sheets, inputs |
| `--surface-sunk` | `#FAFAFD` | table header row |
| `--track` | `#EFEEF5` | segmented control track, quiet tag bg |
| `--brand` | `#5B54E8` | band end colour, charts |
| `--brand-strong` | `#4A43D4` | primary buttons, links, active nav text |
| `--brand-deep` | `#2E2A8C` | link hover, nav-instruction card |
| `--brand-soft` | `#EFEDFC` | active nav background, selected rows, brand tags |
| `--band-from` / `--band-to` | `#4F48DC` / `#5B54E8` | header band gradient |
| `--danger` / `--danger-soft` | `#D92D4B` / `#FDECEF` | emergencies, overdue, critical |
| `--ok` / `--ok-soft` | `#14834F` / `#E7F6EE` | resolved, verified, on duty |
| `--warn` / `--warn-soft` | `#B45309` / `#FEF4E2` | waiting, high priority, unsaved |
| `--info` / `--info-soft` | `#2563EB` / `#EAF1FE` | processing, assigned |

### Dark (first pass, not yet designed)
These map the same roles. Check contrast (AA) and send me screenshots before polishing.

| Token | Value |
|---|---|
| `--page` | `#0F0D24` |
| `--surface` | `#18152F` |
| `--surface-sunk` | `#1D1A38` |
| `--line` | `#2A2650` |
| `--ink` | `#F1F0FA` |
| `--body` | `#C9C6E0` |
| `--muted` | `#9C99B8` |
| `--brand-strong` (links and text) | `#A49FF6` |
| primary button background | `#5B54E8` |
| `--brand-soft` | `#24204A` |
| `--band-from` / `--band-to` | `#17143E` / `#221D5C` |
| weave opacity | 0.07 (light mode: 0.11) |

Tones: danger `#F0627A` on `rgba(217,45,75,.16)`, ok `#3DC48A` on `rgba(20,131,79,.2)`, warn `#F0A35A` on `rgba(180,83,9,.2)`, info `#6EA0FF` on `rgba(37,99,235,.18)`.

### Type
Sora (already self-hosted with `next/font`), weights 400 to 800.

| Role | Size / weight / tracking |
|---|---|
| Desktop page title (on band) | 28 / 800 / -0.7px |
| Phone greeting (on band) | 26 / 800 / -0.6px |
| Phone screen title (on band) | 17 / 800 |
| Eyebrow (on band) | 12 / 700 / 0.08–0.1em uppercase, white at 75% |
| Card title | 15 / 800 |
| Row title | 14 / 700 |
| Body | 14 / 400–500, line-height 1.55 |
| Secondary | 12–13 / 400–600, muted |
| Section label | 12 / 700 / 0.06em uppercase, muted |
| Stat number | 24 / 800 / -0.6px, tabular numbers |

### Shape and spacing
- **Radius:** cards 14, buttons and inputs 10 (large buttons 12), tags 6, chips 9, sheets 20–22 at the top.
- **Card border:** 1px `--line`. Shadows are rare: the stat strip and the phone's top card use `0 12px 28px -18px rgba(26,24,48,.35–.5)`, and floating panels and sheets use `0 24px 48px -24px rgba(10,8,40,.45)`.
- **Spacing:** phone padding 16 and gap 14; desktop content padding 18 × 28 and gap 16–20; row padding 12 × 18 (desktop) or 12 × 14 (phone).

## 3. The header band
This is the signature element, so get it exactly right. It's one component, `<Band solid={px} fade={px} />`.
- **Purple gradient:** `--band-from` to `--band-to` over the solid height.
- **Shade:** a soft shade at the bottom of the solid part, `rgba(74,67,212,.25)`.
- **Banig weave:** two `repeating-linear-gradient`s at ±45° (white 2px, transparent to 14px) at 56px size and opacity 0.11. It animates its `background-position` by 56px over 40s, linear and infinite.
- **Dots:** 12 to 30 small white dots (2–4px, 70% white) drift up 12px and back over 6s, with staggered delays.
- **The fade:** below the solid height the band does not stop. It eases into `--page` over the fade height (phones 84px, desktop 120px, landing 200px) through `color-mix(in srgb, var(--brand) X%, var(--page))` stops at 82% / 55% / 26% / 8%. The weave and dots fade out with a mask over the same range. There must be no hard edge between purple and page.
- **Overlap:** content cards overlap the band. The first card sits on the purple, so the band shows behind it.
- **What sits on the fade:** nothing but white surfaces (cards, pills, inputs). Grey labels don't go on it; move them inside the card instead.
- **Reduced motion:** no weave or dot animation.

Where the band appears:
- **Phone screens:** it holds the logo or back button, the title and actions. On Home it's tall, with the greeting.
- **Desktop:** it spans the main column, not the sidebar. It holds the context line, search, bell, eyebrow, title, subtitle and actions.
- **Auth pages:** the band fills the whole screen (`solid` = 100%, no fade), with a white card centred on it.

## 4. Shells
- **Desktop shell:**
  - Sidebar: 232px, flush white, 1px right hairline. It has the logo with the barangay name, nav groups (MAIN, MANAGE, TOOLS) with 11px uppercase muted labels, and 36px nav items. The active item gets `--brand-soft` with `--brand-strong` text and the solid icon. Counts sit on the right, red only for overdue. The user and sign-out sit at the bottom.
  - Main column: the band, then content.
- **Phone shell:**
  - The band, then content, then the bottom tab bar: white, 1px top hairline, 22px icons with an 11px label.
  - The resident tab bar has a raised red **Report** button in the centre (54px circle with a white 4px ring). It is the only red on a normal screen, because it's the emergency entry.
  - The tanod tab bar is Duty, Assigned, Map and Stats.
  - Footer action bars (Continue, Send report) are white with a top hairline and sit above the tab bar.
- **Auth shell:**
  - Desktop: a full purple band with the logo top-left and "Back to home" top-right. The white card is centred (440px wide; 560–600px for long forms), with white links under the card. "Life in danger? Call 911 first." sits at the bottom.
  - Phone: the same, on one screen.

## 5. Components (match `source/kit.py`)
- **Button:**
  - Height 40 (small 34, large 52) and radius 10 (large 12), 13px/700 text (large 15px).
  - Kinds:
    - `primary`: brand-strong fill.
    - `secondary`: white with a line border.
    - `ghost`: brand text only.
    - `danger`: red fill, only for emergency or destructive actions.
    - `onband`: `rgba(20,17,80,.28)` fill with white text, for the band.
    - `white`: white fill with brand text, the primary action on the band.
  - Use one primary per screen. No gradients and no glow.
- **IconButton:** 40×40, radius 10, in `onband` or `plain` (white with a border).
- **Tag:** height 22, radius 6, 12px/700, tone foreground on tone-soft background.
- **Status:** a 7px dot plus 12px/700 text in the tone colour (no background). Use it for row states.
- **Card:** white, 1px line, radius 14, overflow hidden. `CardHead` has a 15px/800 title, an optional 12px muted subtitle, and an action on the right.
- **Rows and tables:**
  - Rows are divided by 1px lines; no zebra stripes.
  - Table header: 12px/700 muted on `--surface-sunk`.
  - Cell title: 14/700 with a 12px muted subtitle, truncated with an ellipsis.
  - Selected row: `--brand-soft` with a 3px inset brand bar on the left.
  - Critical row: a faint `--danger-soft` tint.
- **Field:** a 13/700 label above a 46px input with radius 10 and a 1px line border, an optional leading icon in muted, and a brand border on focus. Textareas have 12 × 14 padding.
- **Segmented:**
  - On page: a `--track` background with radius 12 and padding 4. Items are 32px tall with radius 9, and the active one is white with a 1px shadow.
  - On band: a `rgba(20,17,80,.28)` track, with the active item white and brand-coloured.
- **Chip** (map layers and filters): 32px tall, radius 9, white with a border. Active ones are brand-filled.
- **Avatar:** rounded square (radius 8–12) with initials. Brand-soft and brand by default; ok-soft for tanods on duty.
- **Progress:** 4 segments, 4px tall with a 4px gap, green.
- **Stat strip:** one white card split by vertical hairlines. Each cell has a 12px muted label, a 24px/800 number (muted when zero, red only when overdue) and a 12px note.
- **Bottom sheet (phone):** radius 20–22 at the top, a 40×4 grab handle, and a dimmed `rgba(26,24,48,.42)` scrim behind it.
- **Toggle:** 44×26, green when on.
- **Empty and help text:** 12–13px muted. Don't use illustrations except Tarsi, later.

## 6. Icons
- Use `BhIcons.jsx` (copied in this folder) for every product icon: nav, categories, roles and empty states.
  - Outline by default; `active` gives the solid version with a knock-out (the `--bh-icon-knockout` colour).
  - Category icons: fire, medical, violence, flood, drugs, theft, animals, garbage, traffic, infrastructure, vandalism, noise, other.
- Lucide stays only for small generic UI glyphs (search, chevrons, close, plus, phone, camera, send), at 1.9 stroke.
- Icons in lists are bare icons in the row's colour. **Don't put icons in tinted tiles or chips.**
- Category colour:
  - fire, medical and violence use `--danger`;
  - everything else uses `--brand-strong`;
  - resolved items use `--ok` or muted.

## 7. Rules (don'ts)
- No glassmorphism, blur panels, glow blobs, gradient buttons or rainbow accents. The user explicitly rejected an "AI feeling" look.
- No tinted icon tiles. Use one primary button per screen.
- Red only for emergencies, critical priority and overdue items. Never red for decoration.
- Don't invent data. The designs use sample data; the app shows real data. Phone numbers that aren't known show "Tap to call", and mobile numbers show the user's own or the `09XX XXX XXXX` placeholder.
- Greetings: "Magandang umaga / hapon / gabi, {first name}." by local time.
- Plain words: "Waiting on you", "Tanod on the way · about 5 min", "Ready for pickup". Cite the law where the app already does (RA 7160, RA 11032, RA 10173).

## 8. Motion
- Band weave and dots (above).
- **Skeletons:** keep the existing system, but restyle it with `--track` blocks at radius 6–14, shaped like the real cards.
- **Hover:** borders darken slightly; there's no lift.
- **Sheets:** slide up in 320ms with `cubic-bezier(.2,.8,.2,1)`.
- The critical map pin pulses.
- Everything respects `prefers-reduced-motion`.

## 9. Screen map (design to route)
| Design | Route / section |
|---|---|
| R01-Home (Main), R04/R05 reports, R06 ticket chat, R07/R08 documents, R09 announcements, R10 cases, R11 assistant | `app/resident/page.jsx` sections and `app/resident/{report,incident,ticket,documents,ai}` |
| R02/R03 report flow | `app/resident/report` |
| O01 to O14 | `app/official/page.jsx` sections and `app/official/{incident,ticket,announcement,calendar,map,analytics}` |
| T01 to T06 | `app/tanod/page.jsx` and its components (`TanodDutyWorkspace`, etc.) |
| A01 to A05 | `app/admin/page.jsx` |
| P01 landing | `app/page.tsx` |
| P02/P04 sign in | `app/login` |
| P02b/P05/P06 register | `app/register` |
| P03 request access | `app/request-access` |
| P07 reset | `app/reset-password` |
| P08 offline | `app/offline` |
| P09 profile | `app/profile` |
| P10 settings | `app/settings` |
| P11 help | `app/help` |
| MAP01 to MAP09 | the map task (later); restyle the map chrome only in this task |
| M01/M02 Tarsi | the Tarsi task (later); don't build it here |
