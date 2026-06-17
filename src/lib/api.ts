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
  thumbnailUrl: string | null
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
  images: Array<{ id: string; url: string; altText: string | null }>
  tariffPlans: Array<{
    id: string
    name: string
    rules: Array<{ id: string; type: string; priceCents: number; currency: string; vehicleTypes: string[] }>
  }>
  rating: { average: number | null; count: number }
}

export interface CreateBookingResponse {
  bookingId: string
  accessCode: string
  expiresAt: string
  amountCents: number
  currency: string
  clientSecret?: string
  alreadyExisted: boolean
}

export interface ConfirmedBooking {
  bookingId: string
  accessCode: string
  status: string
  startsAt: string
  endsAt: string
  finalPriceCents: number
  currency: string
}

export interface BookingDetail {
  id: string
  accessCode: string
  status: string
  startsAt: string
  endsAt: string
  vehiclePlate: string
  vehicleType: string
  quotedPriceCents: number
  finalPriceCents: number | null
  currency: string
  facility: { id: string; name: string; address: string }
  statusHistory: Array<{ status: string; changedAt: string }>
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
): Promise<FacilitySearchResult[]> {
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
  return request<FacilitySearchResult[]>(`/facilities/search?${query.toString()}`, {
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

export function createBooking(
  body: {
    facilityId: string
    startsAt: string
    endsAt: string
    vehicleType: string
    vehiclePlate: string
    guestEmail: string
    guestPhone?: string
  },
  idempotencyKey: string,
): Promise<CreateBookingResponse> {
  return request<CreateBookingResponse>('/bookings', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ ...body, sourceChannel: 'MOBILE' }),
  })
}

export function confirmBooking(id: string): Promise<ConfirmedBooking> {
  return request<ConfirmedBooking>(`/bookings/${id}/confirm`, { method: 'POST' })
}

export function getBooking(id: string): Promise<BookingDetail> {
  return request<BookingDetail>(`/bookings/${id}`)
}
