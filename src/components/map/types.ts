import type { FacilitySearchResult } from '../../lib/api'

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
  onMarkerPress: (id: string) => void
  onRegionChange: (region: MapRegion) => void
}

export type MapRenderer = 'webview' | 'native'

export function resolveRenderer(): MapRenderer {
  const explicit = process.env['EXPO_PUBLIC_MAP_RENDERER']
  if (explicit === 'webview' || explicit === 'native') return explicit
  return __DEV__ ? 'webview' : 'native'
}
