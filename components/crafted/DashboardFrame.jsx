import styles from './frame.module.css'

/**
 * The dashboard shell (DESIGN.md §4), shared by the live page and its
 * loading skeleton so the two line up exactly.
 *
 *   sidebar  the sidebar (or its skeleton): 232px, 64px collapsed
 *   header   the band header (DashboardHeader or its skeleton). It sits
 *            inside the scrolling <main>, so the band scrolls with the
 *            content and the first card overlaps it.
 *   tabBar   the phone tab bar (residents and tanods); content gets room
 *            for it at the bottom
 *
 * The column's left margin follows the sidebar width through
 * .dash-shell / data-sidebar (globals.css), which the boot script also
 * sets before the first paint.
 */
export default function DashboardFrame({ sidebar, header, tabBar, children, mainRef, sidebarOpen, className = '', ...rest }) {
  return (
    <div className={`dash-shell ${styles.frame} ${className}`}
      data-sidebar={sidebarOpen === undefined ? undefined : sidebarOpen ? 'open' : 'closed'}
      {...rest}>
      {sidebar}
      <div className={`dash-shell-column ${styles.column}`}>
        <main ref={mainRef} className={styles.main} data-tabbar={tabBar ? '' : undefined}>
          {header}
          <div className={styles.content}>{children}</div>
        </main>
        {tabBar}
      </div>
    </div>
  )
}
