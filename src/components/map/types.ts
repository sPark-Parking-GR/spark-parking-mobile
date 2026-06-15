import type { FacilitySearchResult } from '../../lib/api'

export interface MapRegion {
  lat: number
  lng: number
  radiusMeters: number
}

export interface MapProps {
  center: { lat: number; lng: number }
  // Bump to force a recenter even if center coordinates are unchanged.
  centerNonce: number
  results: FacilitySearchResult[]
  onMarkerPress: (id: string) => void
  onRegionChange: (region: MapRegion) => void
}

export type MapRenderer = 'webview' | 'native'

export function resolveRenderer(): MapRenderer {
  const explicit = process.env['EXPO_PUBLIC_MAP_RENDERER']
  if (explicit === 'webview' || explicit === 'native') return explicit
  return __DEV__ ? 'webview' : 'native'
}
