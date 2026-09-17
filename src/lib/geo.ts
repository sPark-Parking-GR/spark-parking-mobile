export interface LatLng {
  lat: number
  lng: number
}

const EARTH_RADIUS_METERS = 6_371_000

export function computeDistanceMeters(a: LatLng, b: LatLng): number {
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const dLat = lat2 - lat1
  const dLng = ((b.lng - a.lng) * Math.PI) / 180

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)))
}

export const DEFAULT_DISTANCE_COST_CENTS_PER_METER = 0.15

export function generalizedCostCents(
  priceCents: number | null,
  distanceMeters: number,
  costPerMeterCents: number = DEFAULT_DISTANCE_COST_CENTS_PER_METER,
): number {
  if (priceCents == null) return Number.POSITIVE_INFINITY
  return priceCents + distanceMeters * costPerMeterCents
}
