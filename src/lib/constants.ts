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
