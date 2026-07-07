import { createClient } from './supabase'

// Lazy singleton instead of creating the client at import time — module
// scope runs during SSR evaluation too, and this way the client is only
// constructed in the environment that actually calls these functions.
let _client = null
function getClient() {
  if (!_client) _client = createClient()
  return _client
}

// Provinces/cities/barangays essentially never change, but the request-
// access form refetches them every time its dropdowns mount. A simple
// in-memory cache makes back-navigation and re-renders instant and cuts
// repeat network calls. It resets on page reload, which is plenty fresh
// for this data.
const cache = new Map()

async function cached(key, fetcher) {
  if (cache.has(key)) return cache.get(key)
  const result = await fetcher()
  // Only cache successful, non-empty results so a transient network
  // failure doesn't get pinned as "no options" for the whole session.
  if (result && result.length > 0) cache.set(key, result)
  return result
}

export async function getProvinces() {
  return cached('provinces', async () => {
    const { data, error } = await getClient().rpc('get_distinct_provinces')
    // Errors were silently swallowed before — a failed load looked
    // identical to "there are no provinces", which made the signup
    // dropdown appear mysteriously empty with nothing in the console.
    if (error) console.error('getProvinces failed:', error.message)
    return data?.map(r => r.province) || []
  })
}

export async function getCities(province) {
  if (!province) return []
  return cached(`cities:${province}`, async () => {
    const { data, error } = await getClient().rpc('get_distinct_cities', { p_province: province })
    if (error) console.error('getCities failed:', error.message)
    return data?.map(r => r.city) || []
  })
}

export async function getBarangays(province, city) {
  if (!province || !city) return []
  return cached(`barangays:${province}:${city}`, async () => {
    const { data, error } = await getClient()
      .from('barangays')
      .select('id, name')
      .eq('province', province)
      .eq('city', city)
      .order('name')
    if (error) console.error('getBarangays failed:', error.message)
    return data || []
  })
}

export async function getBarangayById(id) {
  if (!id) return null
  // maybeSingle() returns null cleanly for zero rows; single() treats
  // "not found" as an error, which muddies real errors with expected ones.
  const { data, error } = await getClient()
    .from('barangays')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) console.error('getBarangayById failed:', error.message)
  return data
}