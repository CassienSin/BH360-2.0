'use client'
import { Fragment } from 'react'
import Map, { NavigationControl, AttributionControl } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { resolveMapStyle, DEFAULT_VIEW } from '@/lib/mapConfig'
import styles from './base-map.module.css'

/**
 * The one map component every screen builds on: MapLibre GL with the
 * configured vector style (lib/mapConfig.js), zoom buttons, and the
 * attribution the tile providers require.
 *
 * Attribution is never collapsed behind an "i" button: OpenStreetMap's
 * policy asks for it to stay visible, not hidden behind a toggle.
 *
 * Rotation and tilt are off. A barangay map is read north-up, and a map
 * that rotates under a two-finger pinch on a phone only disorients.
 */
export default function BaseMap({
  ref,
  theme = 'light',
  basemap = 'clean',
  initialViewState,
  interactive = true,
  showZoom = true,
  customAttribution,
  controlsPosition = 'bottom-right',
  className = '',
  onLoad,
  children,
  ...rest
}) {
  return (
    <div className={`${styles.wrap} ${theme === 'dark' ? styles.dark : ''} ${className}`}>
      <Map
        ref={ref}
        initialViewState={initialViewState || DEFAULT_VIEW}
        mapStyle={resolveMapStyle(basemap, theme)}
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
        dragRotate={false}
        pitchWithRotate={false}
        touchPitch={false}
        maxPitch={0}
        interactive={interactive}
        onLoad={(e) => {
          e.target.touchZoomRotate?.disableRotation()
          onLoad?.(e)
        }}
        {...rest}
      >
        {/* Credits first, so they sit in the corner itself with the zoom
            buttons stacked above them. Both are keyed on the credit text:
            the control reads it only when created, and re-adding just one
            of them would swap their order. */}
        <Fragment key={`${controlsPosition}|${customAttribution || ''}`}>
          <AttributionControl position={controlsPosition} compact={false} customAttribution={customAttribution} />
          {interactive && showZoom && <NavigationControl position={controlsPosition} showCompass={false} />}
        </Fragment>
        {children}
      </Map>
    </div>
  )
}
