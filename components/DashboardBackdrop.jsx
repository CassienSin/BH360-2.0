// Fixed positions, so server and browser draw the same dots.
const DOTS = Array.from({ length: 20 }, (_, i) => ({
  size: ((i * 7) % 6) + 3,
  left: (i * 17 + 13) % 100,
  top: (i * 23 + 7) % 100,
  duration: ((i * 3) % 6) + 4,
  delay: (i * 0.7) % 4,
}))

/**
 * The dashboards' purple background with its drifting dots and soft glows.
 *
 * Rendered once by each dashboard page *outside* its loading boundary, so
 * the loading skeleton and the loaded page sit on the very same layer:
 * nothing about the background changes, and its float animations never
 * restart, when one replaces the other. (Each dashboard used to draw its own
 * copy, which reset mid-drift as the page took over from the skeleton.)
 *
 * Decoration only. The dots are hidden for reduced motion (CSS, so the
 * server's first paint already honours it).
 */
export default function DashboardBackdrop() {
  return (
    <div className="fixed inset-0 bg-brand pointer-events-none" aria-hidden="true">
      <div className="absolute inset-0 overflow-hidden motion-reduce:hidden">
        {DOTS.map((dot, i) => (
          <div key={i} style={{
            position: 'absolute',
            width: `${dot.size}px`,
            height: `${dot.size}px`,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.4)',
            left: `${dot.left}%`,
            top: `${dot.top}%`,
            animation: `float ${dot.duration}s ease-in-out infinite`,
            animationDelay: `${dot.delay}s`,
            filter: 'blur(0.5px)',
          }} />
        ))}
      </div>
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 right-20 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'white', filter: 'blur(80px)', animation: 'float 8s ease-in-out infinite' }} />
        <div className="absolute bottom-20 left-20 w-72 h-72 rounded-full opacity-10"
          style={{ background: 'white', filter: 'blur(60px)', animation: 'floatReverse 10s ease-in-out infinite' }} />
      </div>
    </div>
  )
}
