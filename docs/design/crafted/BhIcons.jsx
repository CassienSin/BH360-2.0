'use client'
/**
 * BH360's own icon set: the identity icons (navigation, incident
 * categories, roles). Generic UI glyphs (X, Check, arrows, etc.) stay on lucide-react.
 *
 * Two states from one drawing:
 *   default: outline with a 16% tint of the current colour (duotone)
 *   active:  solid, with inner details knocked out in
 *            var(--bh-icon-knockout, #fff)
 * Use `active` for the selected sidebar item, pressed tabs, etc.
 *
 * Colour always comes from `currentColor`, so icons follow the text colour
 * (category colours on map pins, muted grey in lists, white on purple...).
 *
 * The props match lucide-react (size, strokeWidth, className, style), so
 * swapping an import is usually all a call site needs.
 *
 * Drawn on a 24×24 grid with a 1.75 stroke. Generated from one source; edit there, not here.
 */

// [kind, onBody, d]  kind: 0 body · 1 line · 2 dot
const ICONS = {
  // Dashboard (barangay hall)
  dashboard: [
    [0, 0, 'M3 10L12 4.5L21 10V20H3Z'],
    [1, 1, 'M3 10h18M8 13v4M12 13v4M16 13v4'],
    [1, 0, 'M1.5 20.5h21M12 4.5V1.75h3l-1 1 1 1h-3'],
  ],
  // Home
  home: [
    [0, 0, 'M3.5 10.5L12 4l8.5 6.5V20a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z'],
    [1, 1, 'M10 21v-4.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V21'],
  ],
  // Incidents (siren)
  incidents: [
    [0, 0, 'M6 17v-4a6 6 0 0 1 12 0v4z'],
    [0, 0, 'M4 17.5h16v3.5H4z'],
    [1, 0, 'M12 2v1.75M4.5 5.5L6 7M19.5 5.5L18 7'],
    [1, 1, 'M9.75 13a2.25 2.25 0 0 1 2.25-2.25'],
  ],
  // Announcements (megaphone)
  announcements: [
    [0, 0, 'M3 10v4h3l9 5V5l-9 5H3z'],
    [0, 0, 'M7 14.5l1.4 4.5h2.4l-.9-3.9z'],
    [1, 0, 'M18 9a3 3 0 0 1 0 6M20 6.5a6.5 6.5 0 0 1 0 11'],
  ],
  // Tickets
  tickets: [
    [0, 0, 'M3 7a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v3a2 2 0 0 0 0 4v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a2 2 0 0 0 0-4z'],
    [1, 1, 'M15 7v1.5M15 11.25v1.5M15 15.5V17M6.5 10h5M6.5 14h3'],
  ],
  // Documents (certificate + seal)
  documents: [
    [0, 0, 'M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z'],
    [1, 1, 'M8.5 7h7M8.5 10h7M8.5 13h3.5'],
    [2, 1, 'M15.5 14.1a2.4 2.4 0 1 1 0 4.8a2.4 2.4 0 1 1 0 -4.8z'],
  ],
  // Verifications (ID + check)
  verifications: [
    [0, 0, 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z'],
    [2, 1, 'M8.5 8.35a1.9 1.9 0 1 1 0 3.8a1.9 1.9 0 1 1 0 -3.8z'],
    [1, 1, 'M5.75 15.75c.5-1.4 1.5-2 2.75-2s2.25.6 2.75 2M13.75 11.75l1.6 1.6 3.15-3.35'],
  ],
  // Blotter / Lupon (gavel)
  blotter: [
    [0, 0, 'M13.5 3.5l7 7-2.6 2.6-7-7z'],
    [1, 0, 'M12.25 10.75L4.5 18.5'],
    [0, 0, 'M3 19.25h9v2.25H3z'],
  ],
  // Tanods (shield + star)
  tanods: [
    [0, 0, 'M12 2.5l7.5 3V11c0 5-3.5 8.5-7.5 10.5C8 19.5 4.5 16 4.5 11V5.5z'],
    [2, 1, 'M12 7.8l1.1 2.3 2.5.3-1.8 1.7.5 2.5-2.3-1.2-2.3 1.2.5-2.5-1.8-1.7 2.5-.3z'],
  ],
  // Users
  users: [
    [0, 0, 'M9 4.0a3.5 3.5 0 1 1 0 7.0a3.5 3.5 0 1 1 0 -7.0z'],
    [0, 0, 'M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6z'],
    [1, 0, 'M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.3c2 .7 3.5 2.6 3.5 5.7'],
  ],
  // Map (pin + house)
  map: [
    [0, 0, 'M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z'],
    [2, 1, 'M9 11.5L12 9l3 2.5V14H9z'],
  ],
  // Calendar
  calendar: [
    [0, 0, 'M4 6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z'],
    [1, 1, 'M4 9.5h16'],
    [1, 0, 'M8 3v3.5M16 3v3.5'],
    [2, 1, 'M7.5 12.5h3.5V16H7.5z'],
  ],
  // Analytics (bars + spark)
  analytics: [
    [0, 0, 'M4 14h3.5v6H4zM10.25 10h3.5v10h-3.5zM16.5 6h3.5v14h-3.5z'],
    [1, 0, 'M2.5 21h19'],
    [2, 0, 'M6.5 3.5l.75 1.75L9 6l-1.75.75L6.5 8.5l-.75-1.75L4 6l1.75-.75z'],
  ],
  // AI assistant (bubble + spark)
  ai: [
    [0, 0, 'M4 4.5h16a1 1 0 0 1 1 1V16a1 1 0 0 1-1 1h-9l-5 4v-4H4a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1z'],
    [2, 1, 'M12 7l1.1 2.7 2.7 1.1-2.7 1.1L12 14.6l-1.1-2.7-2.7-1.1 2.7-1.1z'],
  ],
  // My performance (trophy)
  performance: [
    [0, 0, 'M7 3.5h10V9a5 5 0 0 1-10 0z'],
    [1, 0, 'M7 5.5H4.5V7a3 3 0 0 0 3 3M17 5.5h2.5V7a3 3 0 0 1-3 3M12 14v3.5'],
    [0, 0, 'M8.5 17.75h7v3h-7z'],
  ],
  // Fire
  fire: [
    [0, 0, 'M12 2c1.2 3.4 6.5 5.6 6.5 11.5a6.5 6.5 0 0 1-13 0c0-2.8 1.3-4.7 2.8-6 .2 1.8 1 3.1 2.3 3.7C10.2 7.9 11 4.8 12 2z'],
    [1, 1, 'M12 19.25c-1.6 0-2.6-1.1-2.6-2.5 0-1.5 1.15-2.4 2.6-3.9 1.45 1.5 2.6 2.4 2.6 3.9 0 1.4-1 2.5-2.6 2.5z'],
  ],
  // Medical
  medical: [
    [0, 0, 'M4 7h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z'],
    [1, 0, 'M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2'],
    [2, 1, 'M10.75 10h2.5v2.25h2.25v2.5h-2.25V17h-2.5v-2.25H8.5v-2.5h2.25z'],
  ],
  // Violence (alert)
  violence: [
    [0, 0, 'M10.3 4.2a2 2 0 0 1 3.4 0l7.6 13.2a2 2 0 0 1-1.7 3H4.4a2 2 0 0 1-1.7-3z'],
    [1, 1, 'M12 9.5v4.25'],
    [2, 1, 'M12 15.7a1.05 1.05 0 1 1 0 2.1a1.05 1.05 0 1 1 0 -2.1z'],
  ],
  // Flood (house + water)
  flood: [
    [0, 0, 'M5 12L12 6l7 6v4.5H5z'],
    [1, 0, 'M2.5 18.5c1.6 0 1.6 1.1 3.2 1.1s1.6-1.1 3.2-1.1 1.6 1.1 3.1 1.1 1.6-1.1 3.2-1.1 1.6 1.1 3.2 1.1 1.5-1.1 3.1-1.1'],
    [1, 1, 'M10.5 16.5v-2.5h3v2.5'],
  ],
  // Drugs (capsule)
  drugs: [
    [0, 0, 'M6.34 12L12 6.34a4 4 0 0 1 5.66 5.66L12 17.66a4 4 0 0 1-5.66-5.66z'],
    [1, 1, 'M9.17 9.17l5.66 5.66'],
    [1, 0, 'M18 18.5l2.5-2.5M19.25 21l2.25-2.25'],
  ],
  // Theft (bag + alert)
  theft: [
    [0, 0, 'M5 9h14l-1.2 11.1a1 1 0 0 1-1 .9H7.2a1 1 0 0 1-1-.9z'],
    [1, 0, 'M9 9V7a3 3 0 0 1 6 0v2'],
    [1, 1, 'M12 12.25v3.5'],
    [2, 1, 'M12 17.150000000000002a0.95 0.95 0 1 1 0 1.9a0.95 0.95 0 1 1 0 -1.9z'],
  ],
  // Animals (paw)
  animals: [
    [0, 0, 'M12 12c2.6 0 5 2.6 5 5 0 1.7-1.3 2.5-2.6 2.5-1 0-1.5-.5-2.4-.5s-1.4.5-2.4.5C8.3 19.5 7 18.7 7 17c0-2.4 2.4-5 5-5z'],
    [0, 0, 'M6.5 8.2a1.8 1.8 0 1 1 0 3.6a1.8 1.8 0 1 1 0 -3.6zM9.75 4.45a1.8 1.8 0 1 1 0 3.6a1.8 1.8 0 1 1 0 -3.6zM14.25 4.45a1.8 1.8 0 1 1 0 3.6a1.8 1.8 0 1 1 0 -3.6zM17.5 8.2a1.8 1.8 0 1 1 0 3.6a1.8 1.8 0 1 1 0 -3.6z'],
  ],
  // Garbage (bin)
  garbage: [
    [0, 0, 'M6 7.5h12l-1 12.6a1 1 0 0 1-1 .9H8a1 1 0 0 1-1-.9z'],
    [1, 0, 'M4 7.5h16M9.5 7.5V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2.5'],
    [1, 1, 'M10 11v6M14 11v6'],
  ],
  // Traffic (cone)
  traffic: [
    [0, 0, 'M10.2 4h3.6l4 14H6.2z'],
    [0, 0, 'M3.5 18h17v2.75h-17z'],
    [1, 1, 'M8.7 9.75h6.6M7.6 13.75h8.8'],
  ],
  // Infrastructure (streetlight)
  infrastructure: [
    [1, 0, 'M7 20V6.5A2.5 2.5 0 0 1 9.5 4H13'],
    [0, 0, 'M13 3.5h6a1 1 0 0 1 1 1V5a2.5 2.5 0 0 1-2.5 2.5h-3A2.5 2.5 0 0 1 12 5v-.5a1 1 0 0 1 1-1z'],
    [1, 0, 'M14 10.5l-.75 1.5M18 10.5l.75 1.5M16 10.75v1.75'],
    [0, 0, 'M4 19.5h6v2H4z'],
  ],
  // Vandalism (spray can)
  vandalism: [
    [0, 0, 'M7 9h7a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1z'],
    [0, 0, 'M8.5 5.5h4V9h-4z'],
    [1, 1, 'M6 13h9'],
    [2, 0, 'M18 5.4a0.85 0.85 0 1 1 0 1.7a0.85 0.85 0 1 1 0 -1.7zM20.75 3.4a0.85 0.85 0 1 1 0 1.7a0.85 0.85 0 1 1 0 -1.7zM20.75 7.4a0.85 0.85 0 1 1 0 1.7a0.85 0.85 0 1 1 0 -1.7zM18 9.4a0.85 0.85 0 1 1 0 1.7a0.85 0.85 0 1 1 0 -1.7z'],
  ],
  // Noise (speaker)
  noise: [
    [0, 0, 'M4 9.5h3l5-4v13l-5-4H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1z'],
    [1, 0, 'M15.5 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11'],
  ],
  // Other (clipboard)
  other: [
    [0, 0, 'M6 4.5h12a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1z'],
    [0, 0, 'M9 3h6v3H9z'],
    [2, 1, 'M8.75 12.15a1.1 1.1 0 1 1 0 2.2a1.1 1.1 0 1 1 0 -2.2zM12 12.15a1.1 1.1 0 1 1 0 2.2a1.1 1.1 0 1 1 0 -2.2zM15.25 12.15a1.1 1.1 0 1 1 0 2.2a1.1 1.1 0 1 1 0 -2.2z'],
  ],
  // Resident
  resident: [
    [0, 0, 'M12 3.5a3.5 3.5 0 1 1 0 7.0a3.5 3.5 0 1 1 0 -7.0z'],
    [0, 0, 'M5 20.5c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5z'],
  ],
  // Official (badge)
  official: [
    [0, 0, 'M12 3.5a3.5 3.5 0 1 1 0 7.0a3.5 3.5 0 1 1 0 -7.0z'],
    [0, 0, 'M5 20.5c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5z'],
    [2, 1, 'M12.00 15.00L12.68 16.67L14.47 16.80L13.09 17.96L13.53 19.70L12.00 18.75L10.47 19.70L10.91 17.96L9.53 16.80L11.32 16.67z'],
  ],
}

export const BH_ICON_NAMES = Object.keys(ICONS)

const KNOCKOUT = 'var(--bh-icon-knockout, #fff)'

export function BhIcon({
  name, size = 24, active = false, strokeWidth = 1.75, title,
  className, style, ...rest
}) {
  const parts = ICONS[name]
  if (!parts) return null
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style}
      role={title ? 'img' : undefined} aria-hidden={title ? undefined : true}
      {...rest}>
      {title && <title>{title}</title>}
      {parts.map(([kind, onBody, d], i) => {
        const ink = active && onBody ? KNOCKOUT : 'currentColor'
        if (kind === 0) {
          return <path key={i} d={d} fill="currentColor" fillOpacity={active ? 1 : 0.16} />
        }
        if (kind === 1) return <path key={i} d={d} stroke={ink} />
        return <path key={i} d={d} fill={ink} stroke="none" />
      })}
    </svg>
  )
}

function make(name, displayName) {
  const Icon = props => <BhIcon name={name} {...props} />
  Icon.displayName = displayName
  return Icon
}

export const DashboardIcon = make('dashboard', 'DashboardIcon')
export const HomeIcon = make('home', 'HomeIcon')
export const IncidentsIcon = make('incidents', 'IncidentsIcon')
export const AnnouncementsIcon = make('announcements', 'AnnouncementsIcon')
export const TicketsIcon = make('tickets', 'TicketsIcon')
export const DocumentsIcon = make('documents', 'DocumentsIcon')
export const VerificationsIcon = make('verifications', 'VerificationsIcon')
export const BlotterIcon = make('blotter', 'BlotterIcon')
export const TanodsIcon = make('tanods', 'TanodsIcon')
export const UsersIcon = make('users', 'UsersIcon')
export const MapIcon = make('map', 'MapIcon')
export const CalendarIcon = make('calendar', 'CalendarIcon')
export const AnalyticsIcon = make('analytics', 'AnalyticsIcon')
export const AiIcon = make('ai', 'AiIcon')
export const PerformanceIcon = make('performance', 'PerformanceIcon')
export const FireIcon = make('fire', 'FireIcon')
export const MedicalIcon = make('medical', 'MedicalIcon')
export const ViolenceIcon = make('violence', 'ViolenceIcon')
export const FloodIcon = make('flood', 'FloodIcon')
export const DrugsIcon = make('drugs', 'DrugsIcon')
export const TheftIcon = make('theft', 'TheftIcon')
export const AnimalsIcon = make('animals', 'AnimalsIcon')
export const GarbageIcon = make('garbage', 'GarbageIcon')
export const TrafficIcon = make('traffic', 'TrafficIcon')
export const InfrastructureIcon = make('infrastructure', 'InfrastructureIcon')
export const VandalismIcon = make('vandalism', 'VandalismIcon')
export const NoiseIcon = make('noise', 'NoiseIcon')
export const OtherIcon = make('other', 'OtherIcon')
export const ResidentIcon = make('resident', 'ResidentIcon')
export const OfficialIcon = make('official', 'OfficialIcon')

/** Incident category → icon, keyed like CATEGORY_CONFIG in lib/legalBasis.js. */
export const CATEGORY_BH_ICONS = {
  Fire: FireIcon,
  Medical: MedicalIcon,
  Violence: ViolenceIcon,
  Flood: FloodIcon,
  Drugs: DrugsIcon,
  Theft: TheftIcon,
  Animals: AnimalsIcon,
  Garbage: GarbageIcon,
  Traffic: TrafficIcon,
  Infrastructure: InfrastructureIcon,
  Vandalism: VandalismIcon,
  Noise: NoiseIcon,
  Other: OtherIcon,
}
