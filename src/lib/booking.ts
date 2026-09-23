import type { ConfirmedBooking } from './api'
import { confirmBooking, createBooking } from './api'
import type { IdentityStrategy } from './identity'

export interface BookSpotInput {
  facilityId: string
  startsAt: string
  endsAt: string
  vehicleType: string
  vehiclePlate: string
  idempotencyKey: string
}

export interface HeldBooking {
  bookingId: string
  accessCode: string
  expiresAt: string
  amountCents: number
  currency: string
  // Absent once the booking has left PENDING_PAYMENT — a replay of an already-settled
  // hold — in which case there is nothing left to authorise.
  clientSecret?: string
}

export function newIdempotencyKey(): string {
  return `mob_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

/** Phase 1: holds the slot and opens a manual-capture PaymentIntent. */
export async function holdBooking(
  input: BookSpotInput,
  identity: IdentityStrategy,
): Promise<HeldBooking> {
  const created = await createBooking(input, identity)
  return {
    bookingId: created.bookingId,
    accessCode: created.accessCode,
    expiresAt: created.expiresAt,
    amountCents: created.amountCents,
    currency: created.currency,
    ...(created.clientSecret === undefined ? {} : { clientSecret: created.clientSecret }),
  }
}

/** Phase 2: captures the authorised payment. */
export function settleBooking(
  bookingId: string,
  identity: IdentityStrategy,
): Promise<ConfirmedBooking> {
  return confirmBooking(bookingId, identity)
}

export function holdIsLive(held: HeldBooking, now: number = Date.now()): boolean {
  const expiry = Date.parse(held.expiresAt)
  return Number.isNaN(expiry) || expiry > now
}
