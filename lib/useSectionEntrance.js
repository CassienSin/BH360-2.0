'use client'
import { createContext, useContext, useState } from 'react'

/**
 * Whether a dashboard section should play its entrance animation.
 *
 * Only after the user has moved to another section (nav click, Back,
 * a notification link) since the content first appeared. On a refresh or
 * first visit the content simply replaces the skeleton in place: animating
 * it there made every reload fade, slide and count up from zero.
 *
 * Section changes while `ready` is false (still loading) don't count: there
 * is nothing on screen to transition from.
 */
export function useSectionEntrance(section, ready) {
  const [prev, setPrev] = useState(section)
  const [entered, setEntered] = useState(false)
  // Adjusting state while rendering, per React's "storing information from
  // previous renders" pattern — no effect, so no extra frame without it.
  if (section !== prev) {
    setPrev(section)
    if (ready && !entered) setEntered(true)
  }
  return entered
}

/**
 * true inside a section that is animating in. Read by useCountUp so stat
 * numbers count up when you open a section, not when the page loads.
 */
export const SectionEntranceContext = createContext(false)
export const useEnteringSection = () => useContext(SectionEntranceContext)
