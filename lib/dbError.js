/**
 * Telling a deployment gap apart from a real failure.
 *
 * The app and its schema ship separately: Vercel deploys the moment a branch
 * merges, while supabase/setup.sql is run by hand. Between those two moments
 * a newly-added feature queries a table that does not exist yet, and
 * PostgREST answers with something like
 *
 *   Could not find the table 'public.blotter_cases' in the schema cache
 *
 * which is accurate, useless to a resident, and alarming. It names an
 * internal table, blames nothing they can act on, and appears on a dashboard
 * that has otherwise loaded perfectly — every other query in the same
 * Promise.all succeeded.
 *
 * So a missing table or function is treated as "this feature is not
 * deployed here yet": the section stays empty, the console carries the
 * detail for whoever is doing the deploying, and the person using the app is
 * not interrupted. Every other error still surfaces, because those are real.
 */

// PGRST205: table missing from the schema cache. PGRST202: function missing.
// 42P01 / 42883: Postgres's own undefined_table / undefined_function, which
// is what comes back when the cache is fresh but the object truly is absent.
const MISSING_OBJECT_CODES = new Set(['PGRST205', 'PGRST202', '42P01', '42883'])

export function isMissingSchemaObject(error) {
  if (!error) return false
  if (MISSING_OBJECT_CODES.has(error.code)) return true
  // Older PostgREST builds do not always set a code on this one.
  return /schema cache|does not exist/i.test(error.message || '')
}

/**
 * The first error worth telling a person about, out of a batch of settled
 * queries. Returns null when everything either succeeded or failed only
 * because its table has not been created yet.
 *
 * @param {Array<{error?: object}>} results
 * @param {string} context  what was being loaded, for the console line
 */
export function firstRealError(results, context = 'data') {
  const errors = results.map(r => r?.error).filter(Boolean)

  const missing = errors.filter(isMissingSchemaObject)
  if (missing.length) {
    console.warn(
      `[schema] ${missing.length} table(s) used by ${context} are not in this database yet. ` +
      'Run supabase/setup.sql. Detail: ' + missing.map(e => e.message).join(' | ')
    )
  }

  return errors.find(e => !isMissingSchemaObject(e)) || null
}
