import type { MaterialCommunityIcons } from '@expo/vector-icons'

// Map camera fallback until a device GPS fix arrives (or if permission denied).
export const FALLBACK_CENTER: { lat: number; lng: number } = { lat: 37.9754, lng: 23.7348 }

export const ONBOARDED_STORAGE_KEY = 'spark-onboarded'

export const VEHICLE_TYPES = [
  { value: 'CAR', labelKey: 'vehicleCar' },
  { value: 'MOTORCYCLE', labelKey: 'vehicleMotorcycle' },
  { value: 'VAN', labelKey: 'vehicleVan' },
  { value: 'TRUCK', labelKey: 'vehicleTruck' },
] as const

export function vehicleLabel(vehicleType: string, t: (key: string) => string): string {
  const entry = VEHICLE_TYPES.find((v) => v.value === vehicleType)
  return entry ? t(entry.labelKey) : vehicleType
}

export const VEHICLE_ICONS: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  CAR: 'car',
  MOTORCYCLE: 'motorbike',
  VAN: 'van-passenger',
  TRUCK: 'truck',
}

export const AMENITY_TYPES = [
  { value: 'cctv', labelKey: 'amenityCctv' },
  { value: 'covered', labelKey: 'amenityCovered' },
  { value: 'disabled_spaces', labelKey: 'amenityDisabledSpaces' },
  { value: '24h_access', labelKey: 'amenity24hAccess' },
  { value: 'park_ride', labelKey: 'amenityParkRide' },
  { value: 'free', labelKey: 'amenityFree' },
] as const

export function amenityLabel(amenity: string, t: (key: string) => string): string {
  const entry = AMENITY_TYPES.find((a) => a.value === amenity)
  if (entry) return t(entry.labelKey)
  return amenity
    .split('_')
    .filter(Boolean)
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join(' ')
}

// Total footprint of the floating pill tab bar (height + gap above the safe-area
// inset) — screens with bottom-anchored content add this so nothing sits hidden
// behind the frosted bar. Keep in sync with app/(tabs)/_layout.tsx's tabBar style.
export const TAB_BAR_HEIGHT = 64
export const TAB_BAR_GAP = 16 // matches spacing.md

export function tabBarFloatOffset(insetBottom: number): number {
  return TAB_BAR_HEIGHT + TAB_BAR_GAP + insetBottom
}
