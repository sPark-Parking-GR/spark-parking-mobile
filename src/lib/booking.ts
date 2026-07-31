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

export function newIdempotencyKey(): string {
  return `mob_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export async function bookSpot(
  input: BookSpotInput,
  identity: IdentityStrategy,
): Promise<{ code: string }> {
  const created = await createBooking(input, identity)
  const confirmed = await confirmBooking(created.bookingId, identity)
  return { code: confirmed.accessCode }
}
