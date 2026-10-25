/**
 * Map providers, in one place.
 *
 * Every URL here can be overridden from .env.local, because the tile and
 * style providers are third-party services that can change their terms.
 * OpenStreetMap's own tile policy recommends exactly this: keep the URL
 * configurable so the app can switch provider without a code change.
 *
 * Defaults (no keys, no sign-up):
 *   - OpenFreeMap vector styles — Positron (clean, default), Liberty
 *     (detailed streets) and Dark (night mode).
 *   - Satellite is OFF unless NEXT_PUBLIC_MAP_SATELLITE_TILES is set to a
 *     raster tile template with your own key, e.g. MapTiler or Esri.
 *
 * NEXT_PUBLIC_* variables are inlined at build time, so each one is read
 * by its full literal name below (process.env[name] would not work).
 */

const OPENFREEMAP = 'https://tiles.openfreemap.org/styles'

const STYLE_LIGHT = process.env.NEXT_PUBLIC_MAP_STYLE_LIGHT || `${OPENFREEMAP}/positron`
const STYLE_STREETS = process.env.NEXT_PUBLIC_MAP_STYLE_STREETS || `${OPENFREEMAP}/liberty`
const STYLE_DARK = process.env.NEXT_PUBLIC_MAP_STYLE_DARK || `${OPENFREEMAP}/dark`

const SATELLITE_TILES = process.env.NEXT_PUBLIC_MAP_SATELLITE_TILES || ''
const SATELLITE_ATTRIBUTION = process.env.NEXT_PUBLIC_MAP_SATELLITE_ATTRIBUTION || 'Imagery © its provider'

/** True when a satellite tile source has been configured. */
export const HAS_SATELLITE = /\{z\}/.test(SATELLITE_TILES)

// A raster-only style. It has no text layers, so it needs no glyph server.
const SATELLITE_STYLE = HAS_SATELLITE
  ? {
      version: 8,
      sources: {
        satellite: {
          type: 'raster',
          tiles: [SATELLITE_TILES],
          tileSize: 256,
          maxzoom: 19,
          attribution: SATELLITE_ATTRIBUTION,
        },
      },
      layers: [{ id: 'satellite', type: 'raster', source: 'satellite' }],
    }
  : null

/** Base map choices shown in the Layers menu. */
export const BASEMAPS = [
  { id: 'clean', label: 'Clean' },
  { id: 'streets', label: 'Streets' },
  ...(HAS_SATELLITE ? [{ id: 'satellite', label: 'Satellite' }] : []),
]

/**
 * The style for a base map choice and theme. Night mode always uses the
 * dark style for the street maps: a bright map in a dark barangay hall is
 * glare. Satellite has no dark variant, so it stays as it is.
 */
export function resolveMapStyle(basemap = 'clean', theme = 'light') {
  if (basemap === 'satellite' && SATELLITE_STYLE) return SATELLITE_STYLE
  if (theme === 'dark') return STYLE_DARK
  return basemap === 'streets' ? STYLE_STREETS : STYLE_LIGHT
}

/** A saved base map choice that is no longer available falls back to Clean. */
export function normalizeBasemap(id) {
  return BASEMAPS.some(b => b.id === id) ? id : 'clean'
}

function parseCenter(value) {
  const [lat, lng] = String(value || '').split(',').map(Number)
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    ? { latitude: lat, longitude: lng }
    : null
}

/**
 * Where an empty map opens. Set NEXT_PUBLIC_MAP_DEFAULT_CENTER="lat,lng"
 * to your barangay hall; the fallback is Cebu City.
 */
export const DEFAULT_VIEW = {
  ...(parseCenter(process.env.NEXT_PUBLIC_MAP_DEFAULT_CENTER) || { latitude: 10.3157, longitude: 123.8854 }),
  zoom: 13,
}
