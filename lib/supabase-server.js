import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

/**
 * Validate env vars once at module load — a missing variable otherwise
 * surfaces as a cryptic fetch error deep inside a request instead of a
 * clear message at boot/build time.
 */
function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing environment variable: ${name}. ` +
      `Add it to .env.local (and to your Vercel project settings).`
    )
  }
  return value
}

const SUPABASE_URL = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
const SUPABASE_ANON_KEY = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')

/**
 * Cookie-based server client for Server Components, Route Handlers, and
 * Server Actions. Runs as the logged-in user — RLS policies apply.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Expected when called from a Server Component: Next.js forbids
          // writing cookies there. Safe to ignore as long as middleware
          // refreshes the session (see supabase middleware docs).
        }
      },
    },
  })
}

/**
 * Auth guard for API routes. Returns the verified user or null.
 *
 * Important: this uses getUser(), which validates the JWT against the
 * Supabase Auth server — NOT getSession(), which merely decodes whatever
 * the cookie claims and can be spoofed. On the server, always trust
 * getUser() only.
 *
 * Usage in a route handler:
 *
 *   import { getAuthenticatedUser } from '@/lib/supabase-server'
 *
 *   export async function POST(request) {
 *     const { user, supabase } = await getAuthenticatedUser()
 *     if (!user) {
 *       return Response.json({ error: 'Unauthorized' }, { status: 401 })
 *     }
 *     // ... user.id is trustworthy here; queries via `supabase` respect RLS
 *   }
 */
export async function getAuthenticatedUser() {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { user: null, supabase }
  return { user, supabase }
}

/**
 * Service-role client — BYPASSES ALL ROW LEVEL SECURITY.
 *
 * Only for server-side jobs that legitimately need cross-user access
 * (e.g. sending notifications for a whole barangay). Rules:
 *   1. NEVER import this from a 'use client' file — the key must not
 *      reach the browser. (SUPABASE_SERVICE_ROLE_KEY has no NEXT_PUBLIC_
 *      prefix precisely so Next.js won't bundle it client-side.)
 *   2. Do your own authorization checks before using it; RLS won't
 *      protect you here.
 *   3. Prefer the cookie client above whenever the logged-in user's own
 *      permissions are sufficient.
 */
export function createAdminClient() {
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  return createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}