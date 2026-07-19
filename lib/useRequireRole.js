'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'

export const PROFILE_SELECT = '*, barangays(id, name, city, province)'

/**
 * Client-side auth gate for dashboard pages: requires a signed-in user,
 * loads their profile (with barangay), and redirects to /login when the
 * role doesn't match. Pass no role to only require a session (resident
 * dashboard — any signed-in profile may view it).
 *
 * NOTE: this check is UX only — a malicious user can bypass any
 * client-side gate. Real enforcement lives in the RLS policies.
 *
 * Returns { supabase, profile, setProfile, authLoading }. Load page data
 * in an effect keyed on `profile?.id` — it stays null until the user has
 * passed the check.
 */
export function useRequireRole(role = null) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [profile, setProfile] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function check() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.replace('/login')

      const { data: prof, error } = await supabase
        .from('profiles')
        .select(PROFILE_SELECT)
        .eq('id', session.user.id)
        .maybeSingle()

      if (cancelled) return
      if (role && prof?.role !== role) return router.replace('/login')
      if (!role && (error || !prof)) {
        toast.error('Could not load your profile. Please refresh.')
        setAuthLoading(false)
        return
      }
      setProfile(prof)
      setAuthLoading(false)
    }

    check()
    return () => { cancelled = true }
  }, [supabase, router, role])

  return { supabase, profile, setProfile, authLoading }
}
