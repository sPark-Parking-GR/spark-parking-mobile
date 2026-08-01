import { z } from 'zod'

import { ApiError, request, requestNoContent } from './http'
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

async function withAuthRetry<T>(
  identity: IdentityStrategy,
  send: (authHeaders: Record<string, string>) => Promise<T>,
): Promise<T> {
  try {
    return await send(await identity.authHeaders())
  } catch (error) {
    // Exactly one retry, and only for 401: the access token expired between the
    // proactive freshness check and the request landing. A false here means the refresh
    // token is gone too, so retrying could never succeed.
    if (!(error instanceof ApiError) || error.status !== 401) throw error
    if (!(await identity.recoverFromUnauthorized())) throw error
    return send(await identity.authHeaders())
  }
}

function withAuth(init: RequestInit, authHeaders: Record<string, string>): RequestInit {
  return { ...init, headers: { ...(init.headers as Record<string, string>), ...authHeaders } }
}

function authedRequest<T>(path: string, init: RequestInit, identity: IdentityStrategy): Promise<T> {
  return withAuthRetry(identity, (auth) => request<T>(path, withAuth(init, auth)))
}

function authedNoContent(
  path: string,
  init: RequestInit,
  identity: IdentityStrategy,
): Promise<void> {
  return withAuthRetry(identity, (auth) => requestNoContent(path, withAuth(init, auth)))
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

/*
 * The account-scoped read/write seam behind the trips and saved-facility caches. These
 * four calls are the whole contract with the server: shapes are parsed rather than cast,
 * so a route that is not deployed yet, or that answers in a different shape, surfaces as
 * a rejection the caller already handles by falling back to its local cache.
 */

const MY_BOOKINGS_PAGE = 50

const myBookingSchema = z.object({
  id: z.string().min(1),
  accessCode: z.string().min(1),
  status: z.string().min(1),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  vehicleType: z.string().min(1),
  quotedPriceCents: z.number(),
  finalPriceCents: z.number().nullable().optional(),
  currency: z.string().min(1),
  facility: z.object({ id: z.string().min(1), name: z.string() }),
  createdAt: z.string().min(1),
})

export type MyBooking = z.infer<typeof myBookingSchema>

const myBookingsSchema = z.object({ items: z.array(myBookingSchema) })

// `facilityId`, not `id`: the row is the bookmark, and the endpoint keeps archived
// bookmarks in the list carrying `available: false` instead of dropping them, so the
// client — not the server — decides what an unreachable saved spot looks like.
const savedFacilitySchema = z.object({
  facilityId: z.string().min(1),
  name: z.string(),
  address: z.string(),
  available: z.boolean(),
})

export type RemoteSavedFacility = z.infer<typeof savedFacilitySchema>

const savedListSchema = z.object({ items: z.array(savedFacilitySchema) })

export async function listMyBookings(identity: IdentityStrategy): Promise<MyBooking[]> {
  const body = await authedRequest<unknown>(
    `/bookings/mine?skip=0&take=${MY_BOOKINGS_PAGE}`,
    { method: 'GET' },
    identity,
  )
  return myBookingsSchema.parse(body).items
}

export async function listSavedFacilities(
  identity: IdentityStrategy,
): Promise<RemoteSavedFacility[]> {
  const body = await authedRequest<unknown>('/saved-facilities', { method: 'GET' }, identity)
  return savedListSchema.parse(body).items
}

export function saveFacility(facilityId: string, identity: IdentityStrategy): Promise<void> {
  return authedNoContent(
    '/saved-facilities',
    { method: 'POST', body: JSON.stringify({ facilityId }) },
    identity,
  )
}

export function unsaveFacility(facilityId: string, identity: IdentityStrategy): Promise<void> {
  return authedNoContent(`/saved-facilities/${facilityId}`, { method: 'DELETE' }, identity)
}

const issuedTicketSchema = z.object({
  bookingId: z.string().min(1),
  payload: z.string().min(1),
  unixMinute: z.number().int(),
  expiresAt: z.string().min(1),
})

export type IssuedTicket = z.infer<typeof issuedTicketSchema>

/**
 * The owner's rotating barrier code. The signing secret never leaves the server, so every
 * payload is minted per request and stops being accepted a few minutes later — see
 * RotatingQr for the polling that keeps one on screen.
 */
export async function getBookingQr(
  bookingId: string,
  identity: IdentityStrategy,
): Promise<IssuedTicket> {
  const body = await authedRequest<unknown>(
    `/bookings/${bookingId}/qr`,
    { method: 'GET' },
    identity,
  )

  // Reported as a server fault rather than the raw ZodError, because the ticket screen
  // reads "not an ApiError" as "the device is offline" — which a reachable server
  // answering in the wrong shape is not.
  const parsed = issuedTicketSchema.safeParse(body)
  if (!parsed.success) throw new ApiError('Malformed ticket response', 502)

  return parsed.data
}
