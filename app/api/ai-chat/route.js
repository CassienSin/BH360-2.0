import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// ── Limits ────────────────────────────────────────────────────────────────
const MAX_MESSAGES = 20          // conversation window sent upstream
const MAX_MESSAGE_LENGTH = 4000  // chars per message
const RATE_LIMIT = 20            // requests per user...
const RATE_WINDOW_MS = 60_000    // ...per minute

// Best-effort in-memory rate limiter. On serverless (Vercel etc.) each
// warm instance has its own map, so this is a speed bump rather than a
// wall — good enough to stop casual abuse. For a hard guarantee, back it
// with Upstash Redis or a Postgres counter.
const hits = new Map()
function rateLimited(userId) {
  const now = Date.now()
  const entry = hits.get(userId)
  if (!entry || now - entry.start > RATE_WINDOW_MS) {
    hits.set(userId, { start: now, count: 1 })
    return false
  }
  entry.count++
  return entry.count > RATE_LIMIT
}

const SYSTEM_PROMPT = `You are a helpful AI assistant for BarangayHub 360, a barangay management system in the Philippines.
You help residents with common barangay questions such as:
- How to get barangay clearance, certificates, permits
- How to file complaints
- Barangay schedules and events
- General barangay rules and procedures
- How to use the BarangayHub 360 system

Keep answers concise, friendly, and helpful. You can respond in English or Filipino depending on what the resident uses.`

export async function POST(request) {
  try {
    // ── 1. Require a signed-in user ──────────────────────────────────────
    // Without this, ANYONE who finds the URL can burn your Anthropic
    // credits from a curl loop. Adjust to match your lib/supabase server
    // helper if you already have one.
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { cookies: { getAll: () => cookieStore.getAll() } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ reply: 'Please sign in to use the assistant.' }, { status: 401 })
    }

    // ── 2. Rate limit per user ───────────────────────────────────────────
    if (rateLimited(user.id)) {
      return Response.json(
        { reply: 'You are sending messages too quickly. Please wait a minute and try again.' },
        { status: 429 }
      )
    }

    // ── 3. Validate and sanitize input ───────────────────────────────────
    // request.json() throws on malformed JSON — previously that was an
    // unhandled 500. And messages were forwarded upstream unchecked, so a
    // client could send arbitrary roles, objects, or megabytes of text.
    let body
    try {
      body = await request.json()
    } catch {
      return Response.json({ reply: 'Invalid request.' }, { status: 400 })
    }

    const rawMessages = Array.isArray(body?.messages) ? body.messages : null
    if (!rawMessages || rawMessages.length === 0) {
      return Response.json({ reply: 'No message provided.' }, { status: 400 })
    }

    const messages = rawMessages
      .filter(m => (m?.role === 'user' || m?.role === 'assistant') && typeof m?.content === 'string')
      .slice(-MAX_MESSAGES) // keep only the most recent turns
      .map(m => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_LENGTH) }))

    if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
      return Response.json({ reply: 'Invalid conversation format.' }, { status: 400 })
    }

    // ── 4. Call the Anthropic API ────────────────────────────────────────
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('chat route: ANTHROPIC_API_KEY is not set')
      return Response.json({ reply: 'The assistant is not configured yet.' }, { status: 503 })
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages,
      }),
      // Don't let a hung upstream request hold the connection open forever
      signal: AbortSignal.timeout(30_000),
    })

    const data = await response.json()

    if (!response.ok || data.error) {
      // Log the real error server-side; don't leak upstream details
      // (which can include account/quota info) to the browser.
      console.error('Anthropic API error:', response.status, data.error?.message)
      const status = response.status === 429 ? 429 : 502
      return Response.json(
        { reply: 'Sorry, the assistant is unavailable right now. Please try again shortly.' },
        { status }
      )
    }

    // ── 5. Extract the reply ─────────────────────────────────────────────
    // content is an array of blocks; joining all text blocks is safer than
    // assuming content[0] exists and is text.
    const reply = (data.content || [])
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n')

    if (!reply) {
      return Response.json(
        { reply: 'Sorry, I could not generate a response. Please try again.' },
        { status: 502 }
      )
    }

    return Response.json({ reply })
  } catch (err) {
    console.error('chat route failed:', err)
    const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError'
    return Response.json(
      { reply: timedOut
        ? 'The assistant took too long to respond. Please try again.'
        : 'Something went wrong. Please try again.' },
      { status: timedOut ? 504 : 500 }
    )
  }
}