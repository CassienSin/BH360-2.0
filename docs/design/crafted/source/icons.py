# BH360 icon set — single source of truth.
# 24x24 grid, 1.75 stroke. Each part: (kind, on_body, d)
#   kind: 'body'   main silhouette  (outline: 16% tint + stroke | active: solid)
#         'line'   detail stroke    (on body + active -> knockout colour)
#         'dot'    small filled mark (on body + active -> knockout colour)
#   on_body: True when the part sits on top of a body shape

def circ(cx, cy, r):
    return f"M{cx} {cy - r}a{r} {r} 0 1 1 0 {2*r}a{r} {r} 0 1 1 0 {-2*r}z"

STAR = "M12 7.8l1.1 2.3 2.5.3-1.8 1.7.5 2.5-2.3-1.2-2.3 1.2.5-2.5-1.8-1.7 2.5-.3z"
SHIELD = "M12 2.5l7.5 3V11c0 5-3.5 8.5-7.5 10.5C8 19.5 4.5 16 4.5 11V5.5z"

ICONS = {
  # ---------- navigation ----------
  'dashboard': ('Dashboard (barangay hall)', [
    ('body', False, 'M3 10L12 4.5L21 10V20H3Z'),
    ('line', True,  'M3 10h18M8 13v4M12 13v4M16 13v4'),
    ('line', False, 'M1.5 20.5h21M12 4.5V1.75h3l-1 1 1 1h-3'),
  ]),
  'home': ('Home', [
    ('body', False, 'M3.5 10.5L12 4l8.5 6.5V20a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z'),
    ('line', True,  'M10 21v-4.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V21'),
  ]),
  'incidents': ('Incidents (siren)', [
    ('body', False, 'M6 17v-4a6 6 0 0 1 12 0v4z'),
    ('body', False, 'M4 17.5h16v3.5H4z'),
    ('line', False, 'M12 2v1.75M4.5 5.5L6 7M19.5 5.5L18 7'),
    ('line', True,  'M9.75 13a2.25 2.25 0 0 1 2.25-2.25'),
  ]),
  'announcements': ('Announcements (megaphone)', [
    ('body', False, 'M3 10v4h3l9 5V5l-9 5H3z'),
    ('body', False, 'M7 14.5l1.4 4.5h2.4l-.9-3.9z'),
    ('line', False, 'M18 9a3 3 0 0 1 0 6M20 6.5a6.5 6.5 0 0 1 0 11'),
  ]),
  'tickets': ('Tickets', [
    ('body', False, 'M3 7a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v3a2 2 0 0 0 0 4v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a2 2 0 0 0 0-4z'),
    ('line', True,  'M15 7v1.5M15 11.25v1.5M15 15.5V17M6.5 10h5M6.5 14h3'),
  ]),
  'documents': ('Documents (certificate + seal)', [
    ('body', False, 'M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z'),
    ('line', True,  'M8.5 7h7M8.5 10h7M8.5 13h3.5'),
    ('dot',  True,  circ(15.5, 16.5, 2.4)),
  ]),
  'verifications': ('Verifications (ID + check)', [
    ('body', False, 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z'),
    ('dot',  True,  circ(8.5, 10.25, 1.9)),
    ('line', True,  'M5.75 15.75c.5-1.4 1.5-2 2.75-2s2.25.6 2.75 2M13.75 11.75l1.6 1.6 3.15-3.35'),
  ]),
  'blotter': ('Blotter / Lupon (gavel)', [
    ('body', False, 'M13.5 3.5l7 7-2.6 2.6-7-7z'),
    ('line', False, 'M12.25 10.75L4.5 18.5'),
    ('body', False, 'M3 19.25h9v2.25H3z'),
  ]),
  'tanods': ('Tanods (shield + star)', [
    ('body', False, SHIELD),
    ('dot',  True,  STAR),
  ]),
  'users': ('Users', [
    ('body', False, circ(9, 7.5, 3.5)),
    ('body', False, 'M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6z'),
    ('line', False, 'M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.3c2 .7 3.5 2.6 3.5 5.7'),
  ]),
  'map': ('Map (pin + house)', [
    ('body', False, 'M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z'),
    ('dot',  True,  'M9 11.5L12 9l3 2.5V14H9z'),
  ]),
  'calendar': ('Calendar', [
    ('body', False, 'M4 6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z'),
    ('line', True,  'M4 9.5h16'),
    ('line', False, 'M8 3v3.5M16 3v3.5'),
    ('dot',  True,  'M7.5 12.5h3.5V16H7.5z'),
  ]),
  'analytics': ('Analytics (bars + spark)', [
    ('body', False, 'M4 14h3.5v6H4zM10.25 10h3.5v10h-3.5zM16.5 6h3.5v14h-3.5z'),
    ('line', False, 'M2.5 21h19'),
    ('dot',  False, 'M6.5 3.5l.75 1.75L9 6l-1.75.75L6.5 8.5l-.75-1.75L4 6l1.75-.75z'),
  ]),
  'ai': ('AI assistant (bubble + spark)', [
    ('body', False, 'M4 4.5h16a1 1 0 0 1 1 1V16a1 1 0 0 1-1 1h-9l-5 4v-4H4a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1z'),
    ('dot',  True,  'M12 7l1.1 2.7 2.7 1.1-2.7 1.1L12 14.6l-1.1-2.7-2.7-1.1 2.7-1.1z'),
  ]),
  'performance': ('My performance (trophy)', [
    ('body', False, 'M7 3.5h10V9a5 5 0 0 1-10 0z'),
    ('line', False, 'M7 5.5H4.5V7a3 3 0 0 0 3 3M17 5.5h2.5V7a3 3 0 0 1-3 3M12 14v3.5'),
    ('body', False, 'M8.5 17.75h7v3h-7z'),
  ]),
  # ---------- incident categories ----------
  'fire': ('Fire', [
    ('body', False, 'M12 2c1.2 3.4 6.5 5.6 6.5 11.5a6.5 6.5 0 0 1-13 0c0-2.8 1.3-4.7 2.8-6 .2 1.8 1 3.1 2.3 3.7C10.2 7.9 11 4.8 12 2z'),
    ('line', True,  'M12 19.25c-1.6 0-2.6-1.1-2.6-2.5 0-1.5 1.15-2.4 2.6-3.9 1.45 1.5 2.6 2.4 2.6 3.9 0 1.4-1 2.5-2.6 2.5z'),
  ]),
  'medical': ('Medical', [
    ('body', False, 'M4 7h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z'),
    ('line', False, 'M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2'),
    ('dot',  True,  'M10.75 10h2.5v2.25h2.25v2.5h-2.25V17h-2.5v-2.25H8.5v-2.5h2.25z'),
  ]),
  'violence': ('Violence (alert)', [
    ('body', False, 'M10.3 4.2a2 2 0 0 1 3.4 0l7.6 13.2a2 2 0 0 1-1.7 3H4.4a2 2 0 0 1-1.7-3z'),
    ('line', True,  'M12 9.5v4.25'),
    ('dot',  True,  circ(12, 16.75, 1.05)),
  ]),
  'flood': ('Flood (house + water)', [
    ('body', False, 'M5 12L12 6l7 6v4.5H5z'),
    ('line', False, 'M2.5 18.5c1.6 0 1.6 1.1 3.2 1.1s1.6-1.1 3.2-1.1 1.6 1.1 3.1 1.1 1.6-1.1 3.2-1.1 1.6 1.1 3.2 1.1 1.5-1.1 3.1-1.1'),
    ('line', True,  'M10.5 16.5v-2.5h3v2.5'),
  ]),
  'drugs': ('Drugs (capsule)', [
    ('body', False, 'M6.34 12L12 6.34a4 4 0 0 1 5.66 5.66L12 17.66a4 4 0 0 1-5.66-5.66z'),
    ('line', True,  'M9.17 9.17l5.66 5.66'),
    ('line', False, 'M18 18.5l2.5-2.5M19.25 21l2.25-2.25'),
  ]),
  'theft': ('Theft (bag + alert)', [
    ('body', False, 'M5 9h14l-1.2 11.1a1 1 0 0 1-1 .9H7.2a1 1 0 0 1-1-.9z'),
    ('line', False, 'M9 9V7a3 3 0 0 1 6 0v2'),
    ('line', True,  'M12 12.25v3.5'),
    ('dot',  True,  circ(12, 18.1, 0.95)),
  ]),
  'animals': ('Animals (paw)', [
    ('body', False, 'M12 12c2.6 0 5 2.6 5 5 0 1.7-1.3 2.5-2.6 2.5-1 0-1.5-.5-2.4-.5s-1.4.5-2.4.5C8.3 19.5 7 18.7 7 17c0-2.4 2.4-5 5-5z'),
    ('body', False, circ(6.5, 10, 1.8) + circ(9.75, 6.25, 1.8) + circ(14.25, 6.25, 1.8) + circ(17.5, 10, 1.8)),
  ]),
  'garbage': ('Garbage (bin)', [
    ('body', False, 'M6 7.5h12l-1 12.6a1 1 0 0 1-1 .9H8a1 1 0 0 1-1-.9z'),
    ('line', False, 'M4 7.5h16M9.5 7.5V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2.5'),
    ('line', True,  'M10 11v6M14 11v6'),
  ]),
  'traffic': ('Traffic (cone)', [
    ('body', False, 'M10.2 4h3.6l4 14H6.2z'),
    ('body', False, 'M3.5 18h17v2.75h-17z'),
    ('line', True,  'M8.7 9.75h6.6M7.6 13.75h8.8'),
  ]),
  'infrastructure': ('Infrastructure (streetlight)', [
    ('line', False, 'M7 20V6.5A2.5 2.5 0 0 1 9.5 4H13'),
    ('body', False, 'M13 3.5h6a1 1 0 0 1 1 1V5a2.5 2.5 0 0 1-2.5 2.5h-3A2.5 2.5 0 0 1 12 5v-.5a1 1 0 0 1 1-1z'),
    ('line', False, 'M14 10.5l-.75 1.5M18 10.5l.75 1.5M16 10.75v1.75'),
    ('body', False, 'M4 19.5h6v2H4z'),
  ]),
  'vandalism': ('Vandalism (spray can)', [
    ('body', False, 'M7 9h7a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1z'),
    ('body', False, 'M8.5 5.5h4V9h-4z'),
    ('line', True,  'M6 13h9'),
    ('dot',  False, circ(18, 6.25, 0.85) + circ(20.75, 4.25, 0.85) + circ(20.75, 8.25, 0.85) + circ(18, 10.25, 0.85)),
  ]),
  'noise': ('Noise (speaker)', [
    ('body', False, 'M4 9.5h3l5-4v13l-5-4H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1z'),
    ('line', False, 'M15.5 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11'),
  ]),
  'other': ('Other (clipboard)', [
    ('body', False, 'M6 4.5h12a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1z'),
    ('body', False, 'M9 3h6v3H9z'),
    ('dot',  True,  circ(8.75, 13.25, 1.1) + circ(12, 13.25, 1.1) + circ(15.25, 13.25, 1.1)),
  ]),
  # ---------- roles ----------
  'resident': ('Resident', [
    ('body', False, circ(12, 7, 3.5)),
    ('body', False, 'M5 20.5c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5z'),
  ]),
  'official': ('Official (badge)', [
    ('body', False, circ(12, 7, 3.5)),
    ('body', False, 'M5 20.5c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5z'),
    ('dot',  True,  'M12.00 15.00L12.68 16.67L14.47 16.80L13.09 17.96L13.53 19.70L12.00 18.75L10.47 19.70L10.91 17.96L9.53 16.80L11.32 16.67z'),
  ]),
}

GROUPS = [
  ('Navigation', ['dashboard', 'home', 'incidents', 'announcements', 'tickets', 'documents', 'verifications',
                  'blotter', 'tanods', 'users', 'map', 'calendar', 'analytics', 'ai', 'performance']),
  ('Incident categories', ['fire', 'medical', 'violence', 'flood', 'drugs', 'theft', 'animals', 'garbage',
                           'traffic', 'infrastructure', 'vandalism', 'noise', 'other']),
  ('Roles', ['resident', 'official', 'tanods']),
]


def svg(name, size=24, active=False, color='currentColor', knockout='#fff', sw=1.75, xmlns=True):
    parts = []
    for kind, on_body, d in ICONS[name][1]:
        if kind == 'body':
            if active:
                parts.append(f'<path d="{d}" fill="{color}" stroke="{color}"/>')
            else:
                parts.append(f'<path d="{d}" fill="{color}" fill-opacity="0.16" stroke="{color}"/>')
        elif kind == 'line':
            c = knockout if (active and on_body) else color
            parts.append(f'<path d="{d}" fill="none" stroke="{c}"/>')
        else:  # dot
            c = knockout if (active and on_body) else color
            parts.append(f'<path d="{d}" fill="{c}" stroke="none"/>')
    ns = ' xmlns="http://www.w3.org/2000/svg"' if xmlns else ''
    return (f'<svg{ns} width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" '
            f'stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
            + ''.join(parts) + '</svg>')
