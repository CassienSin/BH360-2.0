/**
 * The page colour behind a dashboard.
 *
 * Rendered once by each dashboard page *outside* its loading boundary, so
 * the loading skeleton and the loaded page sit on the very same layer and
 * nothing behind them changes when one replaces the other.
 *
 * Crafted (DESIGN.md §1): a calm lavender-grey page. The purple lives in
 * the band at the top of the main column (components/crafted/Band), not
 * behind the whole screen; the old drifting dots and glow blobs are gone.
 */
export default function DashboardBackdrop() {
  return <div className="fixed inset-0 bg-page pointer-events-none" aria-hidden="true" />
}
