const BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://127.0.0.1:3001/api/v1'

export interface FacilitySearchResult {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  distanceMeters: number
  available: boolean
  remainingSlots: number
  priceCents: number | null
  currency: string
  isPromoted: boolean
  rank: number
  thumbnailUrl: string | null
}

export interface FacilityCluster {
  id: string
  lat: number
  lng: number
  count: number
}

export interface FacilitySearchResponse {
  mode: 'points' | 'clusters'
  points: FacilitySearchResult[]
  clusters: FacilityCluster[]
  total: number
}

export interface QuoteLineItem {
  label: string
  durationMinutes: number
  unitPriceCents: number
  quantity: number
  subtotalCents: number
}

export interface PriceQuote {
  facilityId: string
  startsAt: string
  endsAt: string
  durationMinutes: number
  vehicleType: string
  lineItems: QuoteLineItem[]
  totalCents: number
  currency: string
  expiresAt: string
}

export interface FacilityDetail {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  totalCapacity: number
  onlineQuota: number
  vehicleTypes: string[]
  heightRestrictionCm: number | null
  amenities: string[]
  cancellationPolicy: string
  images: { id: string; url: string; altText: string | null }[]
  tariffAssignments: {
    vehicleType: string
    tariffPlan: {
      id: string
      name: string
      isDefault: boolean
      timezone: string
      graceMinutes: number
      incrementMinutes: number
      version: number
      vehicleTypes: string[]
      tiers: {
        id: string
        fromMinute: number
        toMinute: number | null
        unit: string
        blockMinutes: number | null
        rates: { id: string; windowId: string; priceCents: number; currency: string }[]
      }[]
      windows: {
        id: string
        label: string
        dayMask: number
        startMinute: number
        endMinute: number
      }[]
      caps: {
        id: string
        windowMinutes: number
        capCents: number
        scope: string
      }[]
    } | null
  }[]
  rating: { average: number | null; count: number }
}

export interface SearchParams {
  lat: number
  lng: number
  radiusMeters?: number
  bounds?: { north: number; south: number; east: number; west: number }
  startsAt: string
  endsAt: string
  vehicleType?: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase()
  const isWrite = method !== 'GET' && method !== 'HEAD'
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string>) }

  // React Native attaches an (empty) body to every POST, so a bodyless write
  // reaches Fastify with content-type undefined → "Unsupported Media Type".
  // Always send a valid JSON body for writes.
  const body = isWrite ? (init?.body ?? '{}') : init?.body
  if (body != null) headers['Content-Type'] = 'application/json'

  const response = await fetch(`${BASE_URL}${path}`, { ...init, method, headers, body })

  if (!response.ok) {
    const errBody = (await response.json().catch(() => ({}))) as { message?: string }
    throw new Error(errBody.message ?? `Request failed: ${response.status}`)
  }

  return response.json() as Promise<T>
}

export function searchFacilities(
  params: SearchParams,
  opts?: { signal?: AbortSignal },
): Promise<FacilitySearchResponse> {
  const query = new URLSearchParams({
    lat: String(params.lat),
    lng: String(params.lng),
    radiusMeters: String(params.radiusMeters ?? 3000),
    startsAt: params.startsAt,
    endsAt: params.endsAt,
    ...(params.bounds
      ? {
          north: String(params.bounds.north),
          south: String(params.bounds.south),
          east: String(params.bounds.east),
          west: String(params.bounds.west),
        }
      : {}),
    ...(params.vehicleType ? { vehicleType: params.vehicleType } : {}),
  })
  return request<FacilitySearchResponse>(`/facilities/search?${query.toString()}`, {
    signal: opts?.signal as RequestInit['signal'],
  })
}

export function getFacility(id: string): Promise<FacilityDetail> {
  return request<FacilityDetail>(`/facilities/${id}`)
}

export function getQuote(
  id: string,
  startsAt: string,
  endsAt: string,
  vehicleType: string,
): Promise<PriceQuote> {
  const query = new URLSearchParams({ startsAt, endsAt, vehicleType })
  return request<PriceQuote>(`/facilities/${id}/quote?${query.toString()}`)
}
