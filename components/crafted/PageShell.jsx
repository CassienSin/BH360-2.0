import Image from 'next/image'
import { ChevronLeft } from 'lucide-react'
import Band from './Band'
import styles from './shell.module.css'

/**
 * A standalone screen on the band (DESIGN.md §4 phone shell): the band
 * holds the back button (or the logo), the title and actions; the content
 * cards overlap it; an optional footer action bar (Continue, Send report)
 * is pinned to the bottom, white with a top hairline.
 *
 *   title, sub    17/800 on phones; on desktop the title is 28/800
 *   eyebrow       desktop only, above the title
 *   onBack        shows the back button (otherwise the logo)
 *   actions       right of the title (onband icon buttons, a white button)
 *   bandContent   more content on the band, under the title (a segmented
 *                 control, a greeting…)
 *   footer        the bottom action bar
 *   maxWidth      the content column (default 640; the band spans the page)
 *   extend/fade   how far the band reaches under the content (Band props)
 */
export default function PageShell({
  title, sub, eyebrow, onBack, backLabel = 'Back', actions, bandContent, footer, children,
  maxWidth = 640, extend, fade, className = '',
}) {
  const column = { maxWidth }
  return (
    <div className={`${styles.page} ${className}`} data-footer={footer ? '' : undefined}>
      <div className={styles.pageHead}>
        <Band seed={5} dots={12} extend={extend} fade={fade} />
        <div className={styles.pageHeadInner} style={column}>
          <div className={styles.pageTop}>
            {onBack ? (
              <button type="button" onClick={onBack} className={styles.onbandIcon} aria-label={backLabel}>
                <ChevronLeft size={18} strokeWidth={1.9} aria-hidden="true" />
              </button>
            ) : (
              <Image src="/logo.png" alt="" width={30} height={30} className={styles.logoOnBand} />
            )}
            <div className={styles.pageTitles}>
              {eyebrow && <p className={styles.pageEyebrow}>{eyebrow}</p>}
              <h1 className={styles.pageTitle}>{title}</h1>
              {sub && <p className={styles.pageSub}>{sub}</p>}
            </div>
            {actions && <div className={styles.pageActions}>{actions}</div>}
          </div>
          {bandContent}
        </div>
      </div>
      <div className={styles.pageBody} style={column}>{children}</div>
      {footer && <div className={styles.footerBar}><div className={styles.footerInner} style={column}>{footer}</div></div>}
    </div>
  )
}
