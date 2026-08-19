export const INCIDENT_BUCKET = 'incident-images'

// An hour is long enough for someone to read a report and open the photo,
// short enough that a URL pasted into a group chat stops working.
export const SIGNED_URL_TTL_SECONDS = 3600

// Re-sign a little early so a URL handed to an <img> is never about to die.
const REFRESH_MARGIN_MS = 5 * 60 * 1000

/**
 * Signed URLs for incident photographs.
 *
 * The incident-images bucket is PRIVATE. It used to be public, which meant
 * every photo attached to a report was readable by anyone with the URL and
 * no session at all — including photographs filed under RA 9262, where the
 * evidence is of someone being hurt at home. That is sensitive personal
 * information under RA 10173 (Data Privacy Act), and a public bucket is not
 * a defensible place to keep it.
 *
 * Access is now decided by a storage policy (supabase/setup.sql, Section 9):
 * you may read a photo if you uploaded it, if its uploader belongs to your
 * barangay, or if you are the super admin. The URL is minted per request and
 * expires.
 */

/**
 * The object path inside the bucket, from whatever is stored on the row.
 *
 * Rows written before the bucket went private hold a full public URL
 * (".../object/public/incident-images/<path>"); rows written since hold the
 * path alone. Both have to keep working, so normalise here rather than
 * migrating a column that photos already point at.
 */
export function incidentImagePath(stored) {
  if (!stored || typeof stored !== 'string') return null
  const trimmed = stored.trim()
  if (!trimmed) return null

  const marker = `/${INCIDENT_BUCKET}/`
  const at = trimmed.indexOf(marker)
  if (at !== -1) {
    // Drop any ?token=... left over from a previously signed URL.
    return trimmed.slice(at + marker.length).split('?')[0]
  }
  // Already a bare path.
  return trimmed.replace(/^\/+/, '').split('?')[0]
}

// Module-level so a list of twenty incidents does not mint twenty URLs per
// re-render. Keyed by path; entries carry their own expiry.
const cache = new Map()

/**
 * @returns {Promise<string|null>} a signed URL, or null if it could not be
 * created (no access, missing object, network failure).
 */
export async function createSignedIncidentUrl(supabase, stored) {
  const path = incidentImagePath(stored)
  if (!path) return null

  const hit = cache.get(path)
  if (hit && hit.expiresAt > Date.now()) return hit.url

  const { data, error } = await supabase.storage
    .from(INCIDENT_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)

  if (error || !data?.signedUrl) {
    // Not worth a toast: a missing photo should degrade to "no photo", not
    // interrupt someone reading an incident report.
    console.warn('Could not sign incident image:', path, error?.message)
    return null
  }

  cache.set(path, {
    url: data.signedUrl,
    expiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000 - REFRESH_MARGIN_MS,
  })
  return data.signedUrl
}

/** Drop cached URLs — call on sign-out so the next account re-signs. */
export function clearSignedUrlCache() {
  cache.clear()
}
