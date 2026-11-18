'use client'
import { useEffect, useRef, useState } from 'react'
import { useEnteringSection } from '@/lib/useSectionEntrance'

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Animates a number from its previous value to `value` (ease-out, ~600ms),
 * so stat tiles tick over when the data changes live. Non-numbers ("3/5",
 * "92%") are returned untouched, and so is everything when the user prefers
 * reduced motion.
 *
 * The first value shows as-is — a refresh should not count every number up
 * from zero — except inside a section the user just switched to, where the
 * count-up is part of that section's entrance (see useSectionEntrance).
 */
export function useCountUp(value, duration = 600) {
  const numeric = typeof value === 'number' && Number.isFinite(value)
  const entering = useEnteringSection()
  const startFromZero = numeric && entering && !reducedMotion()
  const [shown, setShown] = useState(startFromZero ? 0 : value)
  const fromRef = useRef(startFromZero ? 0 : value)

  useEffect(() => {
    if (!numeric) return
    const from = typeof fromRef.current === 'number' ? fromRef.current : value
    fromRef.current = value
    if (from === value || reducedMotion()) {
      setShown(value)
      return
    }
    let frame
    const start = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setShown(Math.round(from + (value - from) * eased))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, numeric, duration])

  // A placeholder ("—") that just became a number shows the number at once.
  return numeric && typeof shown === 'number' ? shown : value
}

/** Drop-in element for places that render a count inline. */
export function CountUp({ value }) {
  return useCountUp(value)
}
