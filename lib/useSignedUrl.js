'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { createSignedIncidentUrl } from '@/lib/storage'

/**
 * Resolves a stored incident photo into a signed, expiring URL.
 *
 * Returns null while it is still resolving and if it fails, so a caller can
 * simply render nothing: a photo the viewer is not allowed to see should
 * look like no photo, not like a broken image. There is deliberately no
 * separate "loading" flag — a spinner where a thumbnail will appear a
 * moment later is noise, and the distinction is not one any caller acts on.
 */
export function useSignedIncidentUrl(stored) {
  const supabase = useMemo(() => createClient(), [])
  // The resolved URL is stored WITH the input it belongs to, so switching to
  // a different photo returns null immediately instead of briefly showing
  // the previous one — and nothing has to be cleared synchronously.
  const [resolved, setResolved] = useState({ key: null, url: null })

  useEffect(() => {
    if (!stored) return
    let cancelled = false
    createSignedIncidentUrl(supabase, stored)
      .then(signed => { if (!cancelled) setResolved({ key: stored, url: signed }) })
    return () => { cancelled = true }
  }, [stored, supabase])

  return stored && resolved.key === stored ? resolved.url : null
}
