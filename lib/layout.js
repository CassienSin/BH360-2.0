/**
 * Which layout the dashboards use, in one place.
 *
 * Phone layout (sidebar as a slide-in drawer, compact header): narrower than
 * 768px — or shorter than 500px, which is a phone held sideways (844×390).
 * Width alone gave a landscape phone the desktop layout: a 256px sidebar and
 * a 76px header left about 200px for content.
 *
 * Desktop layout everywhere else. The matching Tailwind variant is `desk:`
 * (globals.css), and the CSS media blocks use the same two queries.
 */
export const DESK_LAYOUT = '(min-width: 768px) and (min-height: 500px)'
export const PHONE_LAYOUT = '(max-width: 767px), (max-height: 499px)'

/**
 * With no saved choice, the sidebar starts open only from this width up.
 * On a tablet (768–1023px) an open 256px sidebar left ~500px for content
 * and truncated the header title, so it starts collapsed to icons there.
 */
export const SIDEBAR_OPEN_BY_DEFAULT = '(min-width: 1024px)'

export function isPhoneLayout() {
  return typeof window !== 'undefined' && window.matchMedia(PHONE_LAYOUT).matches
}
