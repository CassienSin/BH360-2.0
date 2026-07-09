// proxy.js — Next.js 16+ (this file convention was called middleware.js
// in Next.js 15 and earlier).
//
// Purpose: refresh the Supabase auth session on every request. Access
// tokens expire (default: 1 hour); without this, users get silently
// logged out mid-session, and the swallowed cookie-write in
// lib/supabase-server.js has nothing backing it up.
//
// MUST live at the project root (same level as package.json / app/),
// or in src/ if your app directory is there.

import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function proxy(request) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Write refreshed tokens onto both the request (so anything
          // downstream in this same request sees them) and the response
          // (so the browser stores them)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: do not add code between client creation and getUser().
  // This call is what actually refreshes an expired token. getUser()
  // validates against the Supabase Auth server; do not swap it for
  // getSession(), which trusts the cookie unverified.
  await supabase.auth.getUser()

  return response
}

export const config = {
  // Run on everything except static assets — no reason to hit the
  // auth server for images, fonts, or Next's build output.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|logo.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
}