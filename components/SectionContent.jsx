'use client'
import { useLayoutEffect, useRef } from 'react'
import { SectionEntranceContext } from '@/lib/useSectionEntrance'

/**
 * Finish every finite CSS animation inside `root` — before the browser has
 * painted, when called from a layout effect. Infinite ones (spinners, live
 * dots) are left running.
 */
function settleEntrances(root) {
  if (!root || typeof root.getAnimations !== 'function') return
  for (const animation of root.getAnimations({ subtree: true })) {
    if (animation.effect?.getComputedTiming().iterations !== Infinity) animation.finish()
  }
}

/**
 * The body of a dashboard section. Give it `key={section}` so switching
 * sections remounts it.
 *
 * - entering (the user switched here): `.content-enter` fades the section
 *   in and staggers its cards; numbers count up (useCountUp).
 * - otherwise (first load / refresh): the content replaces the skeleton in
 *   place. Components inside carry entrances of their own (incident cards,
 *   rows…); those are finished before the first paint, so nothing fades or
 *   slides. Anything that mounts later — a filter change, a live insert —
 *   still animates as usual.
 */
export default function SectionContent({ entering, children }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    if (!entering) settleEntrances(ref.current)
    // Mount only: this is about how the section first appears.
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <SectionEntranceContext value={entering}>
      <div ref={ref} className={entering ? 'content-enter' : undefined}>{children}</div>
    </SectionEntranceContext>
  )
}
