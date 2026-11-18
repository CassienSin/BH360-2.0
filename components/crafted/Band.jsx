import styles from './band.module.css'

/**
 * The purple header band (DESIGN.md §3): the brand gradient, the slowly
 * moving banig weave and drifting white dots, easing into the page colour
 * with no hard edge.
 *
 * It sits absolutely behind its parent, which must be `position: relative`
 * and must lift its own content above it (`position: relative; z-index: 1`,
 * or the `bandContent` class from shell.module.css).
 *
 *   mode="extend" (default): the band covers the parent, stays solid for
 *     `extend` px more below it (so the first card overlaps the purple),
 *     then fades into var(--page) over `fade` px. Content-sized: the band
 *     grows with the title above it, whatever the screen width.
 *   mode="fill": covers the parent exactly, no fade (auth pages, banners).
 *
 * extend/fade: numbers (px) or any CSS length. Leave them out to use the
 * defaults: 28/84 on phones, 24/120 on desktop (band.module.css). A
 * className can set --band-extend / --band-fade per breakpoint.
 *
 * Decoration only: aria-hidden, no pointer events. With reduced motion the
 * weave and dots hold still.
 */
export default function Band({ mode = 'extend', extend, fade, dots = 14, seed = 1, className = '', style }) {
  const vars = {}
  if (extend != null) vars['--band-extend'] = typeof extend === 'number' ? `${extend}px` : extend
  if (fade != null) vars['--band-fade'] = typeof fade === 'number' ? `${fade}px` : fade
  return (
    <div aria-hidden="true" className={`${styles.band} ${mode === 'fill' ? styles.fill : styles.extend} ${className}`}
      style={{ ...vars, ...style }}>
      <div className={styles.weave}>
        <span className={styles.weaveA} />
        <span className={styles.weaveB} />
      </div>
      <div className={styles.shade} />
      <div className={styles.dots}>
        {Array.from({ length: dots }, (_, i) => {
          const size = (i % 3) + 2
          return (
            <span key={i} className={styles.dot} style={{
              left: `${(i * 37 + 11 + seed * 7) % 100}%`,
              top: `${(i * 53 + 5 + seed * 3) % (mode === 'fill' ? 100 : 86)}%`,
              width: size,
              height: size,
              animationDelay: `${((i * 0.41) % 6).toFixed(2)}s`,
            }} />
          )
        })}
      </div>
    </div>
  )
}
