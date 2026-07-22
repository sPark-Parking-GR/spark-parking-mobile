import type { FacilityCluster, FacilitySearchResult } from '../../lib/api'

export interface MapBounds {
  north: number
  south: number
  east: number
  west: number
}

export interface MapRegion {
  lat: number
  lng: number
  radiusMeters: number
  bounds: MapBounds
}

export interface MapProps {
  center: { lat: number; lng: number }
  // Bump to force a recenter even if center coordinates are unchanged.
  centerNonce: number
  // The user's GPS position, marked with a distinct point.
  user: { lat: number; lng: number } | null
  // Camera fit to keep both the user and the nearest parking(s) in view.
  fitBounds: MapBounds | null
  // Bump to (re)apply fitBounds even if the bounds are unchanged.
  fitNonce: number
  results: FacilitySearchResult[]
  // Grid-aggregated clusters shown on zoomed-out views instead of points.
  clusters: FacilityCluster[]
  // Optional analytics hook on cluster tap; the zoom-in is handled in-renderer.
  onClusterPress?: (cluster: FacilityCluster) => void
  onRegionChange: (region: MapRegion) => void
  // The user started moving the map (gesture only, not a programmatic camera
  // move). Fires once at gesture start, so location-lock UI reacts without lag.
  onUserGesture?: () => void
  // Tap on empty map (no spot, no open card) — used to collapse the sheet and
  // dismiss the selected-spot card.
  onMapPress: () => void
  // A spot marker was selected — used to collapse the sheet and show the
  // selected-spot card above it.
  onSpotSelect: (id: string) => void
  // How far (px) to shift a centered point's on-screen position from the literal
  // screen middle, read fresh whenever the map centers a point. Positive moves
  // the point up (toward the top bar), negative moves it down (toward the
  // sheet/card) — so it lands in the middle of whatever viewport is still
  // actually visible between the top search bar and the bottom sheet/card.
  getCenterOffsetPx: () => number
}

export type MapRenderer = 'webview' | 'native'

export function resolveRenderer(): MapRenderer {
  const explicit = process.env['EXPO_PUBLIC_MAP_RENDERER']
  if (explicit === 'webview' || explicit === 'native') return explicit
  return __DEV__ ? 'webview' : 'native'
}
