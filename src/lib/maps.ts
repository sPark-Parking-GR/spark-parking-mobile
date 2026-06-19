import { createMapContext } from '@spark/maps'
import type { MapProviderConfig } from '@spark/maps'

const PROVIDER = (process.env['EXPO_PUBLIC_MAP_PROVIDER'] ?? 'google') as MapProviderConfig['provider']

function getMapsConfig(): MapProviderConfig {
  switch (PROVIDER) {
    case 'mapbox':
      return {
        provider: 'mapbox',
        config: { accessToken: process.env['EXPO_PUBLIC_MAPBOX_TOKEN']! },
      }
    case 'google':
    default:
      return {
        provider: 'google',
        config: { apiKey: process.env['EXPO_PUBLIC_GOOGLE_MAPS_KEY']! },
      }
  }
}

export const maps = createMapContext(getMapsConfig())
