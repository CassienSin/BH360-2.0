/**
 * Back-button behaviour for in-app pages.
 *
 * router.back() is right when the user got here from inside the app — it
 * returns them to the exact section they came from (now that sections live
 * in the URL). But a page opened from a push notification, a shared link or
 * a fresh tab has no in-app history: router.back() would leave the app or do
 * nothing. Then we go to `fallback` instead — normally the matching
 * dashboard section, e.g. '/official?section=incidents'.
 *
 * document.referrer is the page that loaded this document. Client-side
 * navigations don't change it, so a same-origin referrer means this tab has
 * been inside the app since that load.
 */
export function goBack(router, fallback) {
  if (typeof window === 'undefined') return
  let fromApp = false
  try {
    fromApp = window.history.length > 1 &&
      !!document.referrer &&
      new URL(document.referrer).origin === window.location.origin
  } catch { /* malformed referrer: treat as external */ }
  if (fromApp) router.back()
  else router.replace(fallback)
}
