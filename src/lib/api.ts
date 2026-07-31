import { ApiError, request } from './http'
import type { IdentityStrategy } from './identity'

export type FacilityKind = 'BUSINESS' | 'FREE_PUBLIC' | 'RESTRICTED' | 'UNKNOWN'

export interface FacilitySearchResult {
  id: string
  name: string
  address: string
  kind: FacilityKind
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
  kind: FacilityKind
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

async function authedRequest<T>(
  path: string,
  init: RequestInit,
  identity: IdentityStrategy,
): Promise<T> {
  const attempt = async (): Promise<T> =>
    request<T>(path, {
      ...init,
      headers: { ...(init.headers as Record<string, string>), ...(await identity.authHeaders()) },
    })

  try {
    return await attempt()
  } catch (error) {
    // Exactly one retry, and only for 401: the access token expired between the
    // proactive freshness check and the request landing. A false here means the refresh
    // token is gone too, so retrying could never succeed.
    if (!(error instanceof ApiError) || error.status !== 401) throw error
    if (!(await identity.recoverFromUnauthorized())) throw error
    return attempt()
  }
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

export interface CreateBookingInput {
  facilityId: string
  startsAt: string
  endsAt: string
  vehicleType: string
  vehiclePlate: string
  idempotencyKey: string
}

export interface BookingResult {
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

export function createBooking(
  input: CreateBookingInput,
  identity: IdentityStrategy,
): Promise<BookingResult> {
  const body = {
    facilityId: input.facilityId,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    vehicleType: input.vehicleType,
    vehiclePlate: input.vehiclePlate,
    sourceChannel: 'MOBILE' as const,
  }
  return authedRequest<BookingResult>(
    '/bookings',
    {
      method: 'POST',
      headers: { 'Idempotency-Key': input.idempotencyKey },
      body: JSON.stringify(body),
    },
    identity,
  )
}

export function confirmBooking(
  bookingId: string,
  identity: IdentityStrategy,
): Promise<ConfirmedBooking> {
  return authedRequest<ConfirmedBooking>(
    `/bookings/${bookingId}/confirm`,
    { method: 'POST' },
    identity,
  )
}
