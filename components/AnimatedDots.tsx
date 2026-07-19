// Animated background dots — the floating specks behind every page's
// brand gradient. This was copy-pasted into ~20 pages before being
// extracted; only the dot count ever varied.
//
// Positions are derived from the index (not Math.random()) so the server
// and client render identical markup — no hydration mismatch.

type Dot = {
  size: number
  left: number
  top: number
  duration: number
  delay: number
}

function makeDots(count: number): Dot[] {
  return Array.from({ length: count }, (_, i) => ({
    size: ((i * 7) % 6) + 3,
    left: (i * 17 + 13) % 100,
    top: (i * 23 + 7) % 100,
    duration: ((i * 3) % 6) + 4,
    delay: (i * 0.7) % 4,
  }))
}

// Secondary layer of smaller, slower dots (used on the landing page).
function makeSmallDots(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    left: (i * 31 + 5) % 100,
    top: (i * 19 + 11) % 100,
    duration: ((i * 4) % 8) + 5,
    delay: (i * 0.9) % 6,
  }))
}

export default function AnimatedDots({
  count = 20,
  smallCount = 0,
}: {
  count?: number
  smallCount?: number
}) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {makeDots(count).map((dot, i) => (
        <div
          key={i}
          style={{
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
          }}
        />
      ))}
      {makeSmallDots(smallCount).map((dot, i) => (
        <div
          key={`sm-${i}`}
          style={{
            position: 'absolute',
            width: '3px',
            height: '3px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.25)',
            left: `${dot.left}%`,
            top: `${dot.top}%`,
            animation: `floatReverse ${dot.duration}s ease-in-out infinite`,
            animationDelay: `${dot.delay}s`,
          }}
        />
      ))}
    </div>
  )
}
