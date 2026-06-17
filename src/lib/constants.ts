// Map camera fallback until a device GPS fix arrives (or if permission denied).
export const FALLBACK_CENTER: { lat: number; lng: number } = { lat: 37.9754, lng: 23.7348 }

export const VEHICLE_TYPES = [
  { value: 'CAR', label: 'Αυτοκίνητο' },
  { value: 'MOTORCYCLE', label: 'Μηχανή' },
  { value: 'VAN', label: 'Βαν' },
  { value: 'TRUCK', label: 'Φορτηγό' },
] as const
