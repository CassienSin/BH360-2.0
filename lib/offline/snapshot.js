'use client'
import { SNAPSHOTS, put, get } from '@/lib/offline/db'

/**
 * The last thing we successfully loaded, kept so a lost signal shows what
 * you were sent rather than an empty page.
 *
 * Kept at the app layer rather than in the service worker on purpose. A
 * service worker cache is shared by everyone who uses that browser and
 * cannot sensibly be cleared on sign-out, which on a shared barangay phone
 * means one person's reports sitting where the next person can read them.
 * Here every entry is keyed by user id and dropped when they sign out.
 */

const key = (userId, name) => `${userId}:${name}`

export async function save(userId, name, rows) {
  if (!userId || !Array.isArray(rows)) return
  await put(SNAPSHOTS, {
    key: key(userId, name),
    rows,
    savedAt: new Date().toISOString(),
  })
}

/**
 * @returns {{rows: any[], savedAt: string}|null} — null when there is
 * nothing stored, which the caller must show as an empty state rather than
 * as data.
 */
export async function load(userId, name) {
  if (!userId) return null
  const entry = await get(SNAPSHOTS, key(userId, name))
  if (!entry?.rows) return null
  return { rows: entry.rows, savedAt: entry.savedAt }
}

/** "as of 12:04" — deliberately a time, not "recently". */
export function asOf(savedAt) {
  if (!savedAt) return null
  const when = new Date(savedAt)
  if (Number.isNaN(when.getTime())) return null
  return when.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true })
}
