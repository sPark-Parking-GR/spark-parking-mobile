import type { ThemeContextValue, ThemeMode } from '../../theme'
import Svg, { Defs, G, LinearGradient, Path, Stop } from 'react-native-svg'

import type { FacilityKind } from '../../lib/api'

export type PinColors = Pick<
  ThemeContextValue['colors'],
  'pri' | 'pri2' | 'map' | 'card2' | 'ok' | 'muted' | 'surface'
>

// FREE_PUBLIC's dark-mode backing: colors.ok is tuned to sit on a badge chip, not
// fill a whole pin, and colors.surface (the light-mode icon color) is near-black
// in dark mode — icon and background would both read as "dark green blob". This
// deep green keeps the pin premium instead, with the theme's own vibrant `ok`
// green promoted to the icon so it actually stands out.
const FREE_PUBLIC_DARK_BG = '#0F3D28'

// Pin color signals facility kind only, not live booking status (that's the
// badge's job — FacilityCard, SelectedFacilityCard). BUSINESS always renders
// the same as the "Διαθέσιμο"/Available look — the default brand pin.
function pinTones(
  kind: FacilityKind,
  colors: PinColors,
  mode: ThemeMode,
): { back: string; fg: string } {
  if (kind === 'FREE_PUBLIC') {
    return mode === 'dark'
      ? { back: FREE_PUBLIC_DARK_BG, fg: colors.ok }
      : { back: colors.ok, fg: colors.surface }
  }
  if (kind !== 'BUSINESS') return { back: colors.muted, fg: colors.card2 }
  return { back: colors.map, fg: 'url(#sparkMark)' }
}

function pinGradientStops(colors: PinColors) {
  return [
    { offset: '0', color: colors.pri2 },
    { offset: '0.495', color: colors.pri },
    { offset: '0.803', color: colors.pri },
  ] as const
}

// sPark brand mark (assets/logo_transparent.svg) — already a map pin.
export const LOGO_VIEWBOX = '0 0 318 421'
export const LOGO_PATHS = [
  'M237.25 149.5H312.822C312.822 52 232.859 1 156.859 1C80.8585 1 5 73.5 5 149.5C5.00015 193.5 10.3674 218 33.7501 258.5H198.25C200.459 258.5 202.212 260.293 201.566 262.405C196.773 278.074 168.161 310.133 158.861 316.536C157.684 317.346 156.238 316.983 155.213 315.987C150.167 311.087 146.102 307.78 139.322 301H57.7132C65.5664 318.492 136.785 404.249 155.895 411.68C156.549 411.935 157.117 411.95 157.771 411.694C179.964 402.989 312.822 272.311 312.822 192H74.2501V149.5C74.2501 112.5 112.358 68.5 156.859 68.5C196.859 68.5 237.25 105.5 237.25 149.5Z',
]

// Brand gradient locked into the mark (assets/logo.svg): deep cerulean → vibrant cyan.
export const LOGO_GRADIENT = [
  { offset: '0', color: '#0D7FB6' },
  { offset: '0.495', color: '#1094D4' },
  { offset: '0.803', color: '#32A5DC' },
] as const

// Deep navy canvas the gradient mark is locked to (colors.md → color.main_bg).
export const MARK_BG = '#020C14'

// Omit `color` to render the full brand gradient; pass a color to flatten it.
export function LogoMark({ size, color }: { size: number; color?: string }) {
  return (
    <Svg width={size} height={(size * 421) / 318} viewBox={LOGO_VIEWBOX}>
      {!color && (
        <Defs>
          <LinearGradient id="sparkMark" x1="0" y1="0" x2="1" y2="1">
            {LOGO_GRADIENT.map((s) => (
              <Stop key={s.offset} offset={s.offset} stopColor={s.color} />
            ))}
          </LinearGradient>
        </Defs>
      )}
      {LOGO_PATHS.map((d) => (
        <Path key={d} d={d} fill={color ?? 'url(#sparkMark)'} />
      ))}
    </Svg>
  )
}

// --- Map marker: the logo itself, on a solid navy pin silhouette. ---
// The silhouette is the mark's outer pin boundary (rounded head → point), rebuilt
// symmetrically from the logo's own control points so the dark fill follows the
// logo curvature top and bottom and covers all of its transparent negative space.
const PIN_SILHOUETTE =
  'M159 1' +
  'C235 1 312.822 52 312.822 149.5' +
  'L312.822 192' +
  'C312.822 272.311 179.964 402.989 159 412' +
  'C138.036 402.989 5.178 272.311 5.178 192' +
  'L5.178 149.5' +
  'C5.178 52 83 1 159 1Z'

const PIN_WIDTH = 34
const PIN_PAD = 12
// Rim: navy stroke on the silhouette so the dark backing overhangs the mark edges.
const PIN_RIM = 18
const VB_W = 318 + PIN_PAD * 2
const VB_H = 421 + PIN_PAD * 2
const PIN_VIEWBOX = `${-PIN_PAD} ${-PIN_PAD} ${VB_W} ${VB_H}`
// Silhouette tip (bottom point) in logo space — anchors the pin on the coordinate.
const TIP_X = 159
const TIP_Y = 412
// Shrink the mark inside the silhouette so navy breathes around the ribbon.
const LOGO_SCALE = 0.78
const LOGO_CX = 158.9
const LOGO_CY = 206.5
// Lift the mark: halve the top gap, hand that space to the bottom.
const LOGO_SHIFT_Y = -14
const LOGO_TRANSFORM = `translate(${LOGO_CX * (1 - LOGO_SCALE)} ${LOGO_CY * (1 - LOGO_SCALE) + LOGO_SHIFT_Y}) scale(${LOGO_SCALE})`

export const PIN_SIZE = { width: PIN_WIDTH, height: (PIN_WIDTH * VB_H) / VB_W }
export const PIN_ANCHOR = { x: (TIP_X + PIN_PAD) / VB_W, y: (TIP_Y + PIN_PAD) / VB_H }

function gradientStopsMarkup(colors: PinColors): string {
  return pinGradientStops(colors)
    .map((s) => `<stop offset="${s.offset}" stop-color="${s.color}"/>`)
    .join('')
}

// SVG markup string for the WebView (Leaflet) renderer.
export function pinSvgMarkup(kind: FacilityKind, colors: PinColors, mode: ThemeMode): string {
  const { back, fg } = pinTones(kind, colors, mode)
  const silhouette = `<path d="${PIN_SILHOUETTE}" fill="${back}" stroke="${back}" stroke-width="${PIN_RIM}" stroke-linejoin="round"/>`
  const fgPaths = `<g transform="${LOGO_TRANSFORM}">${LOGO_PATHS.map((d) => `<path d="${d}" fill="${fg}"/>`).join('')}</g>`
  return (
    `<svg width="${PIN_SIZE.width}" height="${PIN_SIZE.height}" viewBox="${PIN_VIEWBOX}">` +
    `<defs><linearGradient id="sparkMark" x1="0" y1="0" x2="1" y2="1">${gradientStopsMarkup(colors)}</linearGradient></defs>` +
    silhouette +
    fgPaths +
    `</svg>`
  )
}

// Native (react-native-svg) marker.
export function MapPin({
  kind,
  colors,
  mode,
}: {
  kind: FacilityKind
  colors: PinColors
  mode: ThemeMode
}) {
  const { back, fg } = pinTones(kind, colors, mode)
  return (
    <Svg width={PIN_SIZE.width} height={PIN_SIZE.height} viewBox={PIN_VIEWBOX}>
      <Defs>
        <LinearGradient id="sparkMark" x1="0" y1="0" x2="1" y2="1">
          {pinGradientStops(colors).map((s) => (
            <Stop key={s.offset} offset={s.offset} stopColor={s.color} />
          ))}
        </LinearGradient>
      </Defs>
      <Path
        d={PIN_SILHOUETTE}
        fill={back}
        stroke={back}
        strokeWidth={PIN_RIM}
        strokeLinejoin="round"
      />
      <G transform={LOGO_TRANSFORM}>
        {LOGO_PATHS.map((d) => (
          <Path key={d} d={d} fill={fg} />
        ))}
      </G>
    </Svg>
  )
}
